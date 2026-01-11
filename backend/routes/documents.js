/**
 * Documents API Routes
 * 
 * Handles invoice and document generation/download
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
const invoicePDFService = require('../services/invoicePDFService');
const db = require('../db');

// GET /api/documents/invoice/:id - Download invoice PDF (Operator only)
router.get('/invoice/:id', authenticateToken, checkRole(['operator']), async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get shipment data
        const shipmentRes = await db.query('SELECT * FROM shipments WHERE id = $1', [id]);
        if (shipmentRes.rows.length === 0) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        const shipment = shipmentRes.rows[0];

        // Generate invoice HTML (can be converted to PDF)
        const invoiceHTML = invoicePDFService.generateInvoicePDF(shipment);

        // Send HTML as PDF (browser will handle conversion)
        // In production, use puppeteer or similar to convert to actual PDF
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="invoice_${shipment.tracking_number}.html"`);
        res.send(invoiceHTML);

        // For actual PDF generation in production:
        // const pdfBuffer = await convertHTMLToPDF(invoiceHTML);
        // res.setHeader('Content-Type', 'application/pdf');
        // res.setHeader('Content-Disposition', `attachment; filename="invoice_${shipment.tracking_number}.pdf"`);
        // res.send(pdfBuffer);
    } catch (err) {
        console.error('Error generating invoice:', err);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
});

module.exports = router;
