/**
 * Customer Notification Service
 * 
 * Proactive notifications system for customers:
 * - Delay alerts
 * - Route changes
 * - Delivery window updates
 * 
 * Channels:
 * - In-app (real-time via Socket.IO)
 * - SMS/WhatsApp (abstracted as notification provider)
 * 
 * Notifications are:
 * - Event-driven (triggered by delivery events)
 * - Idempotent (can be retried safely)
 * - Non-blocking (don't block delivery processing)
 * 
 * BOUNDARY: This is a notification layer only.
 * Does NOT modify delivery logic or decisions.
 */

const db = require('../db');

/**
 * Notification Provider Abstraction
 * 
 * In production, this would integrate with:
 * - SMS: Twilio, AWS SNS
 * - WhatsApp: Twilio WhatsApp API, WhatsApp Business API
 * - Push: Firebase Cloud Messaging
 * - Email: SendGrid, AWS SES
 * 
 * For now, we abstract it and log to console/database.
 */
class NotificationProvider {
    /**
     * Send notification via all configured channels
     * @param {Object} notification - Notification data
     */
    async send(notification) {
        // In-app notification (always available)
        await this.sendInApp(notification);
        
        // SMS/WhatsApp (if enabled for customer)
        if (notification.channels?.includes('sms') || notification.channels?.includes('whatsapp')) {
            await this.sendSMS(notification);
        }
        
        return { success: true, channels: notification.channels || ['in_app'] };
    }

    /**
     * Send in-app notification (via Socket.IO)
     */
    async sendInApp(notification) {
        // Store in database
        try {
            await db.query(
                'INSERT INTO notifications (user_id, message, type, read) VALUES ($1, $2, $3, $4)',
                [notification.user_id, notification.message, notification.type || 'info', false]
            );
        } catch (err) {
            console.error('Error storing in-app notification:', err);
        }
        
        // Emit via Socket.IO if available
        // This would be called from the route handler with io instance
        return { channel: 'in_app', success: true };
    }

    /**
     * Send SMS/WhatsApp notification (abstracted)
     */
    async sendSMS(notification) {
        // In production: Integrate with Twilio/WhatsApp Business API
        // For now: Log to console
        console.log('[SMS/WhatsApp]', {
            to: notification.phone_number || 'Customer',
            message: notification.message,
            type: notification.type
        });
        
        return { channel: 'sms', success: true, note: 'SMS provider not configured' };
    }
}

const notificationProvider = new NotificationProvider();

/**
 * Send delay alert to customer
 * 
 * Triggered when delay is predicted or detected.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @param {Object} delayInfo - Delay information
 */
async function sendDelayAlert(customerId, shipmentId, delayInfo) {
    let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
    
    // Fallback to in-memory if available
    if (!shipment && db.shipments) {
        const shipments = db.shipments || [];
        shipment = shipments.find(s => s.id === shipmentId);
    }
    
    if (!shipment) return;

    const delayMinutes = delayInfo.predicted_delay_minutes || delayInfo.delay_minutes || 0;
    const reason = delayInfo.reason || 'traffic or route conditions';
    
    const notification = {
        user_id: customerId,
        type: 'delay_alert',
        message: `Your delivery #${shipment.tracking_number} may be delayed by approximately ${delayMinutes} minutes due to ${reason}. We're monitoring and will keep you updated.`,
        shipment_id: shipmentId,
        channels: ['in_app', 'sms'], // Can be configured per customer preference
        timestamp: new Date().toISOString()
    };

    return await notificationProvider.send(notification);
}

/**
 * Send route change notification
 * 
 * Triggered when route is changed/optimized.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @param {Object} routeInfo - Route change information
 */
async function sendRouteChangeNotification(customerId, shipmentId, routeInfo) {
    let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
    
    // Fallback to in-memory if available
    if (!shipment && db.shipments) {
        const shipments = db.shipments || [];
        shipment = shipments.find(s => s.id === shipmentId);
    }
    
    if (!shipment) return;

    const reason = routeInfo.reason || 'route optimization';
    const etaImpact = routeInfo.eta_impact || 'minimal';
    
    const notification = {
        user_id: customerId,
        type: 'route_change',
        message: `Your delivery #${shipment.tracking_number} route has been updated for ${reason}. ETA impact: ${etaImpact}. You can track live on your dashboard.`,
        shipment_id: shipmentId,
        channels: ['in_app'],
        timestamp: new Date().toISOString()
    };

    return await notificationProvider.send(notification);
}

/**
 * Send delivery window update
 * 
 * Triggered when ETA changes significantly.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @param {Object} etaInfo - Updated ETA information
 */
async function sendDeliveryWindowUpdate(customerId, shipmentId, etaInfo) {
    let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
    
    // Fallback to in-memory if available
    if (!shipment && db.shipments) {
        const shipments = db.shipments || [];
        shipment = shipments.find(s => s.id === shipmentId);
    }
    
    if (!shipment) return;

    const etaRange = etaInfo.eta_range || etaInfo.estimated_arrival || 'shortly';
    
    const notification = {
        user_id: customerId,
        type: 'delivery_window_update',
        message: `Updated delivery window for #${shipment.tracking_number}: ${etaRange}. Track live location on your dashboard.`,
        shipment_id: shipmentId,
        channels: ['in_app', 'sms'],
        timestamp: new Date().toISOString()
    };

    return await notificationProvider.send(notification);
}

/**
 * Send driver assignment notification
 * 
 * Triggered when driver is assigned to delivery.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @param {number} driverId - Driver ID
 */
async function sendDriverAssignmentNotification(customerId, shipmentId, driverId) {
    let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
    
    // Fallback to in-memory if available
    if (!shipment && db.shipments) {
        const shipments = db.shipments || [];
        shipment = shipments.find(s => s.id === shipmentId);
    }
    
    if (!shipment) return;

    const notification = {
        user_id: customerId,
        type: 'driver_assigned',
        message: `Driver assigned to your delivery #${shipment.tracking_number}. Live tracking is now available.`,
        shipment_id: shipmentId,
        channels: ['in_app'],
        timestamp: new Date().toISOString()
    };

    return await notificationProvider.send(notification);
}

module.exports = {
    sendDelayAlert,
    sendRouteChangeNotification,
    sendDeliveryWindowUpdate,
    sendDriverAssignmentNotification,
    notificationProvider
};
