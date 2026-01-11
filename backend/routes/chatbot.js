/**
 * Chatbot API Routes
 * 
 * Handles chatbot requests from all interfaces (operator, driver, customer)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const chatbotService = require('../services/geminiChatbot');
const db = require('../db');

// POST /api/chatbot/message
router.post('/message', authenticateToken, async (req, res) => {
    try {
        const { message, context } = req.body;
        const role = req.user.role;
        const userId = req.user.id;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get additional context if available
        let additionalContext = context || {};
        
        // If shipment context is provided, fetch shipment data
        if (context && context.shipment_id) {
            try {
                const shipmentRes = await db.query('SELECT * FROM shipments WHERE id = $1', [context.shipment_id]);
                if (shipmentRes.rows.length > 0) {
                    additionalContext.shipment = shipmentRes.rows[0];
                }
            } catch (err) {
                console.error('Error fetching shipment context:', err);
            }
        }

        // Get user data for context
        try {
            const userRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (userRes.rows.length > 0) {
                additionalContext.userData = userRes.rows[0];
            }
        } catch (err) {
            console.error('Error fetching user context:', err);
        }

        // Generate response using Gemini
        const response = await chatbotService.generateResponse(message, role, additionalContext);

        res.json({
            response,
            role,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error processing chatbot message:', err);
        res.status(500).json({ error: 'Failed to process message', details: err.message });
    }
});

// POST /api/chatbot/test - Test chatbot with sample questions
router.post('/test', authenticateToken, async (req, res) => {
    try {
        const role = req.user.role;
        const results = await chatbotService.testChatbot(role);
        
        res.json({
            role,
            results,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error testing chatbot:', err);
        res.status(500).json({ error: 'Failed to test chatbot', details: err.message });
    }
});

module.exports = router;
