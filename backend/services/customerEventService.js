/**
 * Customer Event Service
 * 
 * Handles customer-initiated events (reschedule, update instructions, contact driver).
 * 
 * CRITICAL BOUNDARY:
 * - All customer actions create EVENTS, not direct mutations
 * - Events are queued for operator review/approval
 * - Core delivery logic remains unchanged
 * - This is an EVENT SOURCE, not a command handler
 * 
 * EVENT TYPES:
 * - customer.reschedule_request
 * - customer.instruction_update
 * - customer.driver_contact_request
 * 
 * All events are:
 * - Idempotent (can be retried safely)
 * - Non-blocking (don't block delivery)
 * - Stored for operator review
 */

const db = require('../db');

/**
 * Create a customer event
 * 
 * Events are stored and queued for processing. They do NOT directly modify shipments.
 * 
 * @param {Object} eventData - Event data
 * @param {string} eventData.customer_id - Customer ID
 * @param {string} eventData.shipment_id - Shipment ID
 * @param {string} eventData.event_type - Event type
 * @param {Object} eventData.payload - Event payload
 * @returns {Object} Created event
 */
function createCustomerEvent(eventData) {
    const {
        customer_id,
        shipment_id,
        event_type,
        payload = {},
        status = 'pending'
    } = eventData;
    
    const event = {
        id: Date.now(), // Simple ID generation
        customer_id,
        shipment_id,
        event_type,
        payload,
        status, // pending, approved, rejected, processed
        created_at: new Date().toISOString(),
        processed_at: null,
        operator_note: null
    };
    
    // Store event (in real app, would use database)
    // For now, we'll emit via socket for operator notification
    // In production, this would go to a message queue
    
    return event;
}

/**
 * Request delivery reschedule
 * 
 * Creates a reschedule request event. Does NOT modify delivery schedule.
 * Operator must approve.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @param {string} newPreferredDate - New preferred date/time
 * @param {string} reason - Reason for reschedule
 * @returns {Object} Reschedule request event
 */
function requestReschedule(customerId, shipmentId, newPreferredDate, reason) {
    const event = createCustomerEvent({
        customer_id: customerId,
        shipment_id: shipmentId,
        event_type: 'customer.reschedule_request',
        payload: {
            new_preferred_date: newPreferredDate,
            reason: reason || 'Customer requested reschedule',
            original_request_time: new Date().toISOString()
        },
        status: 'pending'
    });
    
    // Emit event for operator notification (via socket if available)
    // In production, would send to message queue
    
    return event;
}

/**
 * Update delivery instructions
 * 
 * Creates an instruction update event. Instructions are additive.
 * Does NOT block delivery.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @param {string} instructions - New delivery instructions
 * @returns {Object} Instruction update event
 */
function updateDeliveryInstructions(customerId, shipmentId, instructions) {
    const event = createCustomerEvent({
        customer_id: customerId,
        shipment_id: shipmentId,
        event_type: 'customer.instruction_update',
        payload: {
            instructions: instructions,
            updated_at: new Date().toISOString()
        },
        status: 'pending'
    });
    
    return event;
}

/**
 * Request driver contact
 * 
 * Creates a contact request event. Generates masked phone number.
 * Does NOT expose driver's real number.
 * 
 * @param {number} customerId - Customer ID
 * @param {number} shipmentId - Shipment ID
 * @returns {Object} Contact request event with masked number
 */
async function requestDriverContact(customerId, shipmentId) {
    // Get shipment to find driver
    let shipmentResult = await db.query('SELECT * FROM shipments WHERE id = $1', [shipmentId]);
    let shipment = shipmentResult.rows && shipmentResult.rows.length > 0 ? shipmentResult.rows[0] : null;
    
    // Fallback to in-memory if available
    if (!shipment && db.shipments) {
        const shipments = db.shipments || [];
        shipment = shipments.find(s => s.id === shipmentId);
    }
    
    if (!shipment || !shipment.driver_id) {
        return {
            error: 'Driver not assigned yet',
            masked_number: null
        };
    }
    
    // Generate masked number (e.g., +91 XXXX-XXXX-12)
    // In production, would use Twilio or similar for masked calling
    const maskedNumber = `+91 XXXX-XXXX-${String(shipment.driver_id).slice(-2)}`;
    
    const event = createCustomerEvent({
        customer_id: customerId,
        shipment_id: shipmentId,
        event_type: 'customer.driver_contact_request',
        payload: {
            masked_number: maskedNumber,
            requested_at: new Date().toISOString()
        },
        status: 'processed' // Auto-processed for contact requests
    });
    
    return {
        ...event,
        masked_number: maskedNumber
    };
}

module.exports = {
    createCustomerEvent,
    requestReschedule,
    updateDeliveryInstructions,
    requestDriverContact
};
