const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');

// Middleware to ensure user is customer
const ensureCustomer = (req, res, next) => {
    if (req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    next();
};

// 1. Get My Notifications
router.get('/notifications', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM notifications WHERE user_id = $1', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Report an Issue
router.post('/issues', authenticateToken, ensureCustomer, async (req, res) => {
    const { shipment_id, type, description } = req.body;
    try {
        const result = await db.query(
            'INSERT INTO issues (shipment_id, user_id, type, description) VALUES ($1, $2, $3, $4) RETURNING *',
            [shipment_id, req.user.id, type, description]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Download Dummy Document (Invoice/POD)
router.get('/documents/:type/:id', authenticateToken, ensureCustomer, (req, res) => {
    const { type, id } = req.params;

    // In a real app, this would fetch a file from S3 or generate a real PDF.
    // Here we send a simple text file acting as a PDF for prototype purposes.

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_${id}.pdf"`);

    // Minimal valid PDF header to trick browser preview if needed, or just text content used as mock
    const dummyContent = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 50 >>
stream
BT /F1 24 Tf 100 700 Td (MOCK ${type.toUpperCase()} DOCUMENT #${id}) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000155 00000 n 
0000000300 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
400
%%EOF
    `;

    res.send(dummyContent.trim());
});

// ============================================================================
// NEW CUSTOMER-FACING INTELLIGENCE ENDPOINTS
// ============================================================================
// These endpoints provide customer-friendly intelligence features.
// BOUNDARY: They only format existing intelligence for customer consumption.
// They do NOT modify core delivery logic.

const customerIntelligence = require('../services/customerIntelligence');
const customerEventService = require('../services/customerEventService');

// 4. Get Customer-Friendly ETA with Confidence Band
router.get('/shipments/:id/eta', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;
        
        // Verify shipment belongs to customer
        const result = await db.query('SELECT * FROM shipments WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        const etaInfo = await customerIntelligence.getCustomerETA(id);
        res.json(etaInfo);
    } catch (err) {
        console.error('Error getting customer ETA:', err);
        res.status(500).json({ error: 'Failed to calculate ETA' });
    }
});

// 5. Get Delivery Reliability Indicator
router.get('/shipments/:id/reliability', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;
        
        // Verify shipment belongs to customer
        const result = await db.query('SELECT * FROM shipments WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        const reliability = await customerIntelligence.getDeliveryReliability(id);
        res.json(reliability);
    } catch (err) {
        console.error('Error getting delivery reliability:', err);
        res.status(500).json({ error: 'Failed to calculate reliability' });
    }
});

// 6. Request Delivery Reschedule (Event-Based)
router.post('/shipments/:id/reschedule', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const { new_preferred_date, reason } = req.body;
        const customerId = req.user.id;
        
        if (!new_preferred_date) {
            return res.status(400).json({ error: 'New preferred date is required' });
        }
        
        // Verify shipment belongs to customer
        const result = await db.query('SELECT * FROM shipments WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        // Create reschedule request event (does NOT modify shipment)
        const event = customerEventService.requestReschedule(customerId, id, new_preferred_date, reason);
        
        // Store event in database (or emit for operator)
        // For now, we'll store in a simple events array
        // In production, this would go to a proper event store
        
        // Emit event to operator (via socket if available)
        const io = req.app.get('io');
        if (io) {
            io.emit('customer_event', {
                type: 'reschedule_request',
                shipment_id: id,
                customer_id: customerId,
                new_preferred_date,
                reason
            });
        }
        
        res.json({
            success: true,
            message: 'Reschedule request submitted. Operator will review and confirm.',
            event_id: event.id,
            status: event.status
        });
    } catch (err) {
        console.error('Error processing reschedule request:', err);
        res.status(500).json({ error: 'Failed to process reschedule request' });
    }
});

// 7. Update Delivery Instructions (Event-Based)
router.post('/shipments/:id/instructions', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const { instructions } = req.body;
        const customerId = req.user.id;
        
        if (!instructions) {
            return res.status(400).json({ error: 'Instructions are required' });
        }
        
        // Verify shipment belongs to customer
        const result = await db.query('SELECT * FROM shipments WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        // Create instruction update event (does NOT block delivery)
        const event = customerEventService.updateDeliveryInstructions(customerId, id, instructions);
        
        // Emit to operator if needed
        const io = req.app.get('io');
        if (io) {
            io.emit('customer_event', {
                type: 'instruction_update',
                shipment_id: id,
                customer_id: customerId,
                instructions
            });
        }
        
        res.json({
            success: true,
            message: 'Delivery instructions updated successfully.',
            event_id: event.id,
            status: event.status
        });
    } catch (err) {
        console.error('Error updating instructions:', err);
        res.status(500).json({ error: 'Failed to update instructions' });
    }
});

// 8. Request Driver Contact (Returns Masked Number)
router.post('/shipments/:id/contact-driver', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const customerId = req.user.id;
        
        // Verify shipment belongs to customer
        const result = await db.query('SELECT * FROM shipments WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        // Create contact request event (returns masked number)
        const result_contact = await customerEventService.requestDriverContact(customerId, id);
        
        if (result_contact.error) {
            return res.status(400).json(result_contact);
        }
        
        res.json({
            success: true,
            masked_number: result_contact.masked_number,
            message: 'Use this number to contact your driver. Calls are routed through our system.',
            event_id: result_contact.id
        });
    } catch (err) {
        console.error('Error processing contact request:', err);
        res.status(500).json({ error: 'Failed to process contact request' });
    }
});

// 9. Submit Structured Feedback (Enhanced)
router.post('/shipments/:id/feedback-structured', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            on_time_given_circumstances,
            driver_professionalism,
            issues_beyond_driver_control,
            free_text_feedback
        } = req.body;
        const customerId = req.user.id;
        
        // Verify shipment belongs to customer and is delivered
        const result = await db.query(
            'SELECT * FROM shipments WHERE id = $1 AND customer_id = $2 AND status = $3',
            [id, customerId, 'delivered']
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Delivered shipment not found' });
        }
        
        const shipment = result.rows[0];
        
        // Store structured feedback with attribution
        // In production, would use proper feedback table
        // For now, we'll create a feedback entry with attribution fields
        
        // Use existing feedback attribution service to analyze
        const feedbackAttribution = require('../services/feedbackAttribution');
        const attribution = await feedbackAttribution.analyzeFeedbackAttribution(
            {
                customer_feedback_text: free_text_feedback || '',
                customer_rating: driver_professionalism || 5
            },
            {
                delay_minutes: 0, // Would get from actual delivery data
                delivery_urgency: shipment.freight_type === 'Fragile' ? 'high' : 'medium'
            }
        );
        
        // Store feedback (using existing feedback endpoint logic)
        await db.query(
            'INSERT INTO feedback (shipment_id, driver_id, rating, comment) VALUES ($1, $2, $3, $4)',
            [id, shipment.driver_id, driver_professionalism || 5, JSON.stringify({
                on_time_given_circumstances,
                driver_professionalism,
                issues_beyond_driver_control,
                free_text_feedback,
                attribution: {
                    driver_attribution: attribution.driver_attribution,
                    system_attribution: attribution.system_attribution,
                    fairness_flag: attribution.fairness_flag
                }
            })]
        );
        
        res.json({
            success: true,
            message: 'Thank you for your feedback!',
            feedback_id: Date.now()
        });
    } catch (err) {
        console.error('Error submitting structured feedback:', err);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

// 10. Report Issue with Categories (Enhanced)
router.post('/shipments/:id/issues-categorized', authenticateToken, ensureCustomer, async (req, res) => {
    try {
        const { id } = req.params;
        const { category, description } = req.body;
        const customerId = req.user.id;
        
        const validCategories = [
            'delivery_delayed',
            'address_issue',
            'package_concern',
            'driver_communication_issue'
        ];
        
        if (!category || !validCategories.includes(category)) {
            return res.status(400).json({ 
                error: 'Valid category required',
                valid_categories: validCategories
            });
        }
        
        // Verify shipment belongs to customer
        const result = await db.query('SELECT * FROM shipments WHERE id = $1 AND customer_id = $2', [id, customerId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }
        
        // Create issue event (does NOT block delivery completion)
        const event = customerEventService.createCustomerEvent({
            customer_id: customerId,
            shipment_id: id,
            event_type: 'customer.issue_report',
            payload: {
                category,
                description,
                reported_at: new Date().toISOString(),
                customer_expectation: 'Our support team will contact you within 24 hours.'
            },
            status: 'pending'
        });
        
        // Store issue (using existing issues table)
        await db.query(
            'INSERT INTO issues (shipment_id, user_id, type, description) VALUES ($1, $2, $3, $4)',
            [id, customerId, category, description]
        );
        
        // Emit to support/operator
        const io = req.app.get('io');
        if (io) {
            io.emit('customer_issue', {
                category,
                shipment_id: id,
                customer_id: customerId,
                description
            });
        }
        
        res.json({
            success: true,
            message: 'Issue reported successfully. Our support team will contact you soon.',
            issue_id: event.id,
            category,
            customer_expectation: 'You will receive a response within 24 hours. This does not affect your delivery completion.'
        });
    } catch (err) {
        console.error('Error reporting issue:', err);
        res.status(500).json({ error: 'Failed to report issue' });
    }
});

module.exports = router;
