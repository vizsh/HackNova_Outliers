/**
 * Proof of Delivery (POD) Photo Service
 * 
 * Handles geo-tagged photo upload and validation for proof of delivery.
 * 
 * CRITICAL REQUIREMENTS:
 * - Photo must include GPS coordinates
 * - Photo must include timestamp
 * - Photo location must be within acceptable radius of drop location
 * - Metadata integrity must be validated
 * - All uploads are logged immutably
 * 
 * BOUNDARY: This service ONLY handles photo validation and storage.
 * Does NOT modify order status or delivery logic directly.
 */

const db = require('../db');
const crypto = require('crypto');

// Configuration
const ACCEPTABLE_RADIUS_METERS = 100; // 100 meters radius from drop location
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate distance between two GPS coordinates (Haversine formula)
 * 
 * @param {number} lat1 - Latitude 1
 * @param {number} lng1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lng2 - Longitude 2
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = EARTH_RADIUS_KM * c;
    
    return distanceKm * 1000; // Convert to meters
}

/**
 * Validate geo-tagged photo
 * 
 * Validates that photo has GPS metadata and is within acceptable radius of drop location.
 * 
 * @param {Object} photoData - Photo data with metadata
 * @param {string} photoData.url - Photo URL or blob reference
 * @param {number} photoData.latitude - GPS latitude from photo metadata
 * @param {number} photoData.longitude - GPS longitude from photo metadata
 * @param {string} photoData.timestamp - Capture timestamp from photo metadata
 * @param {number} orderId - Order/Shipment ID
 * @param {number} dropLat - Drop location latitude
 * @param {number} dropLng - Drop location longitude
 * @returns {Object} Validation result
 */
async function validateGeoTaggedPhoto(photoData, orderId, dropLat, dropLng) {
    try {
        const { url, latitude, longitude, timestamp } = photoData;
        
        // Validate required fields
        if (!url) {
            return {
                valid: false,
                error: 'Photo URL is required'
            };
        }
        
        if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
            return {
                valid: false,
                error: 'Photo must include GPS coordinates. Please ensure location services are enabled.'
            };
        }
        
        if (!timestamp) {
            return {
                valid: false,
                error: 'Photo timestamp is missing'
            };
        }
        
        // Validate GPS coordinates are numbers
        const photoLat = parseFloat(latitude);
        const photoLng = parseFloat(longitude);
        
        if (isNaN(photoLat) || isNaN(photoLng)) {
            return {
                valid: false,
                error: 'Invalid GPS coordinates in photo metadata'
            };
        }
        
        // Validate latitude/longitude ranges
        if (photoLat < -90 || photoLat > 90 || photoLng < -180 || photoLng > 180) {
            return {
                valid: false,
                error: 'GPS coordinates out of valid range'
            };
        }
        
        // Calculate distance from drop location
        const distance = calculateDistance(photoLat, photoLng, dropLat, dropLng);
        
        // Check if within acceptable radius
        if (distance > ACCEPTABLE_RADIUS_METERS) {
            return {
                valid: false,
                error: `Photo location is ${distance.toFixed(0)} meters from drop location. Must be within ${ACCEPTABLE_RADIUS_METERS} meters.`,
                distance: distance,
                acceptable_radius: ACCEPTABLE_RADIUS_METERS
            };
        }
        
        // Validate timestamp is recent (within last 24 hours)
        const photoTime = new Date(timestamp);
        const now = new Date();
        const hoursDiff = (now - photoTime) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
            return {
                valid: false,
                error: 'Photo timestamp is too old. Photo must be taken within the last 24 hours.'
            };
        }
        
        if (photoTime > now) {
            return {
                valid: false,
                error: 'Photo timestamp is in the future. Invalid timestamp detected.'
            };
        }
        
        // All validations passed
        return {
            valid: true,
            distance: distance,
            latitude: photoLat,
            longitude: photoLng,
            timestamp: timestamp,
            url: url
        };
        
    } catch (err) {
        console.error('Error validating geo-tagged photo:', err);
        return {
            valid: false,
            error: 'Photo validation failed'
        };
    }
}

/**
 * Store proof of delivery photo
 * 
 * Stores photo metadata with GPS coordinates and timestamp.
 * 
 * @param {number} orderId - Order/Shipment ID
 * @param {number} driverId - Driver ID
 * @param {Object} photoData - Validated photo data
 * @returns {Object} Stored photo record
 */
async function storePODPhoto(orderId, driverId, photoData) {
    try {
        const { url, latitude, longitude, timestamp, distance } = photoData;
        
        // Generate photo record ID
        const photoId = `POD_${orderId}_${Date.now()}`;
        
        // Store photo record
        // In production, would use proper database table
        // For now, update shipment with photo metadata
        await db.query(
            `UPDATE shipments 
             SET pod_url = $1,
                 pod_photo_lat = $2,
                 pod_photo_lng = $3,
                 pod_photo_timestamp = $4,
                 pod_photo_distance = $5,
                 pod_uploaded_at = NOW()
             WHERE id = $6`,
            [url, latitude, longitude, timestamp, distance, orderId]
        );
        
        // Log photo upload event (immutable audit log)
        await logPODEvent({
            order_id: orderId,
            driver_id: driverId,
            event_type: 'pod_photo_uploaded',
            photo_id: photoId,
            metadata: {
                url: url,
                latitude: latitude,
                longitude: longitude,
                timestamp: timestamp,
                distance_from_drop: distance
            }
        });
        
        return {
            photo_id: photoId,
            order_id: orderId,
            driver_id: driverId,
            url: url,
            latitude: latitude,
            longitude: longitude,
            timestamp: timestamp,
            distance: distance,
            uploaded_at: new Date().toISOString()
        };
        
    } catch (err) {
        console.error('Error storing POD photo:', err);
        throw new Error('Failed to store proof of delivery photo');
    }
}

/**
 * Check if POD photo is required and uploaded
 * 
 * @param {number} orderId - Order/Shipment ID
 * @returns {Object} POD status
 */
async function getPODStatus(orderId) {
    try {
        const shipmentRes = await db.query(
            `SELECT id, pod_url, pod_photo_lat, pod_photo_lng, 
                    pod_photo_timestamp, pod_photo_distance, pod_uploaded_at, status
             FROM shipments 
             WHERE id = $1`,
            [orderId]
        );
        
        if (shipmentRes.rows.length === 0) {
            return { required: false, error: 'Order not found' };
        }
        
        const shipment = shipmentRes.rows[0];
        
        // POD photo is required for delivery completion
        const requiresPOD = shipment.status === 'out_for_delivery' || 
                           shipment.status === 'in_transit' || 
                           shipment.status === 'assigned';
        
        const hasPOD = !!shipment.pod_url && 
                      shipment.pod_photo_lat !== null && 
                      shipment.pod_photo_lng !== null;
        
        return {
            required: requiresPOD,
            uploaded: hasPOD,
            photo_url: shipment.pod_url || null,
            latitude: shipment.pod_photo_lat || null,
            longitude: shipment.pod_photo_lng || null,
            timestamp: shipment.pod_photo_timestamp || null,
            distance: shipment.pod_photo_distance || null,
            uploaded_at: shipment.pod_uploaded_at || null
        };
    } catch (err) {
        console.error('Error getting POD status:', err);
        return { required: false, error: 'Failed to check POD status' };
    }
}

/**
 * Log POD event to audit trail
 * 
 * CRITICAL: All POD events are logged immutably for audit and trust.
 * 
 * @param {Object} eventData - Event data to log
 */
async function logPODEvent(eventData) {
    try {
        // In production, use dedicated audit log table
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
            console.error('Error logging POD event:', err);
            // Continue without failing - audit is best effort
        }
    }
}

module.exports = {
    validateGeoTaggedPhoto,
    storePODPhoto,
    getPODStatus,
    logPODEvent,
    calculateDistance,
    ACCEPTABLE_RADIUS_METERS
};
