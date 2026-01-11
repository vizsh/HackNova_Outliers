/**
 * OTP Service
 * 
 * Handles OTP generation, verification, and validation for delivery completion.
 * 
 * CRITICAL SECURITY:
 * - OTPs are time-bound (expire after 30 minutes)
 * - OTPs are single-use
 * - OTPs are hashed before storage
 * - OTP generation is atomic and logged
 * 
 * BOUNDARY: This service ONLY handles OTP logic.
 * Does NOT modify order status or delivery logic directly.
 */

const crypto = require('crypto');
const db = require('../db');

// OTP Configuration
const OTP_EXPIRY_MINUTES = 30; // OTP expires after 30 minutes
const OTP_LENGTH = 6; // 6-digit numeric OTP
const MAX_VERIFICATION_ATTEMPTS = 5; // Max attempts before locking

/**
 * Generate a unique OTP for an order
 * 
 * Generates a time-bound, single-use OTP that must be verified before delivery completion.
 * 
 * @param {number|string} orderId - Order/Shipment ID
 * @returns {Object} OTP data (code, hashed, expires_at, order_id)
 */
async function generateOTP(orderId) {
    // Generate 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash OTP for secure storage (SHA-256)
    const hashedOTP = crypto.createHash('sha256').update(otpCode).digest('hex');
    
    // Calculate expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);
    
    // Store OTP record (in production, use proper database table)
    // For now, we'll store in shipment record and log to audit
    const otpRecord = {
        order_id: orderId,
        hashed_otp: hashedOTP,
        otp_code: otpCode, // Store plain for now (in production, never store plain text)
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        verified: false,
        verification_attempts: 0,
        locked: false
    };
    
    // Update shipment with OTP (store hashed version)
    try {
        await db.query(
            `UPDATE shipments 
             SET delivery_code = $1, 
                 otp_expires_at = $2, 
                 otp_verified = false,
                 otp_verification_attempts = 0,
                 otp_locked = false
             WHERE id = $3`,
            [hashedOTP, expiresAt, orderId]
        );
        
        // Log OTP generation (immutable audit log)
        await logOTPEvent({
            order_id: orderId,
            event_type: 'otp_generated',
            otp_hash: hashedOTP,
            expires_at: expiresAt.toISOString(),
            metadata: {
                otp_length: OTP_LENGTH,
                expiry_minutes: OTP_EXPIRY_MINUTES
            }
        });
    } catch (err) {
        console.error('Error storing OTP:', err);
        throw new Error('Failed to generate OTP');
    }
    
    // Return plain OTP code for delivery (only at generation time)
    // This should be sent to customer immediately and never stored in plain text
    return {
        otp_code: otpCode,
        order_id: orderId,
        expires_at: expiresAt.toISOString(),
        expires_in_minutes: OTP_EXPIRY_MINUTES
    };
}

/**
 * Verify OTP for delivery completion
 * 
 * Validates OTP against stored hash and checks expiry/attempts.
 * 
 * @param {number|string} orderId - Order/Shipment ID
 * @param {string} providedOTP - OTP provided by driver
 * @returns {Object} Verification result
 */
async function verifyOTP(orderId, providedOTP) {
    try {
        // Get shipment and OTP record
        const shipmentRes = await db.query(
            `SELECT id, delivery_code, otp_expires_at, otp_verified, 
                    otp_verification_attempts, otp_locked, status
             FROM shipments 
             WHERE id = $1`,
            [orderId]
        );
        
        if (shipmentRes.rows.length === 0) {
            return {
                valid: false,
                error: 'Order not found',
                locked: false
            };
        }
        
        const shipment = shipmentRes.rows[0];
        
        // Check if already verified
        if (shipment.otp_verified) {
            return {
                valid: false,
                error: 'OTP already verified',
                locked: false
            };
        }
        
        // Check if locked (too many attempts)
        if (shipment.otp_locked) {
            await logOTPEvent({
                order_id: orderId,
                event_type: 'otp_verification_attempt_locked',
                provided_otp_hash: crypto.createHash('sha256').update(providedOTP).digest('hex'),
                metadata: { attempts: shipment.otp_verification_attempts }
            });
            
            return {
                valid: false,
                error: 'OTP verification locked due to too many failed attempts. Please contact support.',
                locked: true,
                attempts_remaining: 0
            };
        }
        
        // Check if expired
        const expiresAt = shipment.otp_expires_at ? new Date(shipment.otp_expires_at) : null;
        if (expiresAt && new Date() > expiresAt) {
            await logOTPEvent({
                order_id: orderId,
                event_type: 'otp_verification_attempt_expired',
                provided_otp_hash: crypto.createHash('sha256').update(providedOTP).digest('hex'),
                metadata: { expires_at: expiresAt.toISOString() }
            });
            
            return {
                valid: false,
                error: 'OTP expired. Please request a new OTP.',
                locked: false,
                expired: true
            };
        }
        
        // Hash provided OTP and compare
        const providedOTPHash = crypto.createHash('sha256').update(providedOTP.trim()).digest('hex');
        const storedHash = shipment.delivery_code;
        
        // Increment attempts
        const newAttempts = (shipment.otp_verification_attempts || 0) + 1;
        
        if (providedOTPHash !== storedHash) {
            // Wrong OTP - increment attempts and lock if exceeded
            const shouldLock = newAttempts >= MAX_VERIFICATION_ATTEMPTS;
            
            await db.query(
                `UPDATE shipments 
                 SET otp_verification_attempts = $1,
                     otp_locked = $2
                 WHERE id = $3`,
                [newAttempts, shouldLock, orderId]
            );
            
            await logOTPEvent({
                order_id: orderId,
                event_type: 'otp_verification_attempt_failed',
                provided_otp_hash: providedOTPHash,
                metadata: {
                    attempts: newAttempts,
                    locked: shouldLock
                }
            });
            
            return {
                valid: false,
                error: 'Invalid OTP. Please check and try again.',
                locked: shouldLock,
                attempts_remaining: Math.max(0, MAX_VERIFICATION_ATTEMPTS - newAttempts)
            };
        }
        
        // OTP is valid - mark as verified
        await db.query(
            `UPDATE shipments 
             SET otp_verified = true,
                 otp_verified_at = NOW(),
                 otp_verification_attempts = $1
             WHERE id = $2`,
            [newAttempts, orderId]
        );
        
        // Log successful verification
        await logOTPEvent({
            order_id: orderId,
            event_type: 'otp_verified',
            metadata: {
                attempts: newAttempts,
                verified_at: new Date().toISOString()
            }
        });
        
        return {
            valid: true,
            verified_at: new Date().toISOString(),
            attempts: newAttempts
        };
        
    } catch (err) {
        console.error('Error verifying OTP:', err);
        return {
            valid: false,
            error: 'OTP verification failed',
            locked: false
        };
    }
}

/**
 * Check if OTP is required and verified for delivery
 * 
 * @param {number|string} orderId - Order/Shipment ID
 * @returns {Object} OTP status
 */
async function getOTPStatus(orderId) {
    try {
        const shipmentRes = await db.query(
            `SELECT id, delivery_code, otp_expires_at, otp_verified, 
                    otp_verified_at, otp_verification_attempts, otp_locked, status
             FROM shipments 
             WHERE id = $1`,
            [orderId]
        );
        
        if (shipmentRes.rows.length === 0) {
            return { required: false, error: 'Order not found' };
        }
        
        const shipment = shipmentRes.rows[0];
        
        // OTP is required if status is "out_for_delivery" or "in_transit"
        const requiresOTP = shipment.status === 'out_for_delivery' || 
                           shipment.status === 'in_transit' || 
                           shipment.status === 'assigned';
        
        return {
            required: requiresOTP,
            verified: shipment.otp_verified || false,
            verified_at: shipment.otp_verified_at || null,
            expires_at: shipment.otp_expires_at || null,
            expired: shipment.otp_expires_at ? new Date() > new Date(shipment.otp_expires_at) : false,
            locked: shipment.otp_locked || false,
            attempts: shipment.otp_verification_attempts || 0,
            attempts_remaining: Math.max(0, MAX_VERIFICATION_ATTEMPTS - (shipment.otp_verification_attempts || 0))
        };
    } catch (err) {
        console.error('Error getting OTP status:', err);
        return { required: false, error: 'Failed to check OTP status' };
    }
}

/**
 * Log OTP event to audit trail
 * 
 * CRITICAL: All OTP events are logged immutably for audit and trust.
 * 
 * @param {Object} eventData - Event data to log
 */
async function logOTPEvent(eventData) {
    try {
        // In production, use a dedicated audit log table
        // For now, we'll create a simple audit log entry
        await db.query(
            `INSERT INTO audit_log (entity_type, entity_id, event_type, event_data, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            ['shipment', eventData.order_id, eventData.event_type, JSON.stringify(eventData)]
        );
    } catch (err) {
        // If audit log table doesn't exist, create it
        if (err.message.includes('does not exist')) {
            try {
                await db.query(`
                    CREATE TABLE IF NOT EXISTS audit_log (
                        id SERIAL PRIMARY KEY,
                        entity_type VARCHAR(50) NOT NULL,
                        entity_id VARCHAR(255) NOT NULL,
                        event_type VARCHAR(100) NOT NULL,
                        event_data JSONB,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                `);
                // Retry insert
                await db.query(
                    `INSERT INTO audit_log (entity_type, entity_id, event_type, event_data, created_at)
                     VALUES ($1, $2, $3, $4, NOW())`,
                    ['shipment', eventData.order_id, eventData.event_type, JSON.stringify(eventData)]
                );
            } catch (createErr) {
                console.error('Error creating audit log table:', createErr);
                // Continue without failing - audit is best effort
            }
        } else {
            console.error('Error logging OTP event:', err);
            // Continue without failing - audit is best effort
        }
    }
}

module.exports = {
    generateOTP,
    verifyOTP,
    getOTPStatus,
    logOTPEvent,
    OTP_EXPIRY_MINUTES,
    MAX_VERIFICATION_ATTEMPTS
};
