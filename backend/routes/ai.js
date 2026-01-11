const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
const db = require('../db');

// AI SERVICE URL
const AI_SERVICE_URL = 'http://localhost:8000';

// Predict Delay
router.post('/predict-delay', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        // Forward request to Python Service
        const response = await axios.post(`${AI_SERVICE_URL}/predict-delay`, req.body);
        res.json(response.data);
    } catch (err) {
        console.error('AI Service Error:', err.message);
        res.status(502).json({ error: 'AI Service Unavailable' });
    }
});

// Optimize Route
router.post('/optimize-route', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        // Forward request to Python Service
        const response = await axios.post(`${AI_SERVICE_URL}/optimize-route`, req.body);
        res.json(response.data);
    } catch (err) {
        console.error('AI Service Error:', err.message);
        res.status(502).json({ error: 'AI Service Unavailable' });
    }
});

// Analyze Vehicle Health
router.post('/vehicle-health', authenticateToken, checkRole(['operator']), async (req, res) => {
    const { vehicle_id } = req.body;
    try {
        // Fetch vehicle details from DB (mock or real)
        const vRes = await db.query('SELECT * FROM vehicles WHERE id = $1', [vehicle_id]);
        if (vRes.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });

        const vehicle = vRes.rows[0];

        // Mock mileage/year logic if not in DB, for now assume we pass it or random
        const payload = {
            mileage: vehicle.mileage || 12000, // Mock
            last_service_date: "2024-01-01",
            vehicle_year: 2018
        };

        const response = await axios.post(`${AI_SERVICE_URL}/maintenance-alert`, payload);
        res.json(response.data);
    } catch (err) {
        console.error('AI Service Error:', err.message);
        res.status(502).json({ error: 'AI Service Unavailable' });
    }
});

module.exports = router;
