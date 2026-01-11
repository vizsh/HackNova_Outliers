const express = require('express');
const router = express.Router();
const razorpayService = require('../services/razorpayService');
const { authenticateToken } = require('../middleware/authMiddleware');
const db = require('../db');

// Middleware: Ensure user is customer
const ensureCustomer = (req, res, next) => {
    if (req.user.role !== 'customer') {
        return res.status(403).json({ error: 'Access denied. Customers only.' });
    }
    next();
};

// 1. GET /api/payments/unpaid
router.get('/unpaid', authenticateToken, ensureCustomer, async (req, res) => {
    const customerId = req.user.id;

    // Get unpaid shipments
    let result = await db.query(
        "SELECT * FROM shipments WHERE customer_id = $1 AND payment_status = 'pending'",
        [customerId]
    );

    // If no unpaid shipments exist, create some demo ones for hackathon
    if (result.rows.length === 0) {
        // Create a demo unpaid shipment
        await db.query('INSERT INTO shipments', [
            `TRK-DEMO-${Date.now()}`, // tracking
            'Mumbai', 'Delhi', // origin, dest
            19.0760, 72.8777, 28.6139, 77.2090, // coords
            customerId, // customer_id
            true, // payment_locked (true for demo)
            'Standard', 500, null // freight info
        ]);

        // Fetch again
        result = await db.query(
            "SELECT * FROM shipments WHERE customer_id = $1 AND payment_status = 'pending'",
            [customerId]
        );
    }

    res.json(result.rows);
});

// 2. POST /api/payments/create
router.post('/create', authenticateToken, ensureCustomer, async (req, res) => {
    const { shipment_id, amount } = req.body;

    try {
        const order = await razorpayService.createOrder(amount, 'INR', `receipt_${shipment_id}`);

        // Return EXACT JSON required for frontend
        res.json({
            razorpay_order_id: order.id,
            amount: amount,
            currency: "INR",
            key_id: razorpayService.getKeyId()
        });
    } catch (error) {
        res.status(500).json({ error: 'Order creation failed' });
    }
});

// 3. POST /api/payments/verify
router.post('/verify', authenticateToken, ensureCustomer, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, shipment_id } = req.body;

    const isValid = razorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (isValid) {
        // Update shipment status to paid
        // Using db.query directly mimicking the behavior expected in db/index.js mock
        const shipment = db.shipments.find(s => s.id == shipment_id);
        if (shipment) {
            shipment.payment_status = 'paid';
            shipment.payment_locked = false;
        }

        res.json({ success: true, message: 'Payment verified' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid signature' });
    }
});

module.exports = router;
