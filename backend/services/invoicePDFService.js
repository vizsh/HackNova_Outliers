/**
 * Invoice PDF Service
 * 
 * Generates formatted PDF invoices with financial data for operator downloads.
 * 
 * Features:
 * - Formatted invoice layout
 * - Financial breakdown
 * - Company details
 * - Itemized charges
 */

/**
 * Generate PDF invoice content (base64 or HTML to PDF)
 * For now, we'll use a simple PDF format with proper structure
 * In production, use libraries like pdfkit, jspdf, or puppeteer
 */
function generateInvoicePDF(shipment) {
    // Extract invoice data
    const invoiceNumber = shipment.tracking_number || `INV-${shipment.id}`;
    const invoiceDate = shipment.created_at ? new Date(shipment.created_at).toLocaleDateString() : new Date().toLocaleDateString();
    const dueDate = shipment.delivery_timestamp ? new Date(shipment.delivery_timestamp).toLocaleDateString() : 'N/A';
    const amount = shipment.invoice_amount || 0;
    const tax = amount * 0.18; // 18% GST
    const subtotal = amount - tax;
    
    // Build HTML for PDF (in production, use proper PDF library)
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 40px;
            color: #333;
        }
        .header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .company-details h1 {
            margin: 0;
            color: #2563eb;
            font-size: 28px;
        }
        .invoice-info {
            text-align: right;
        }
        .invoice-info h2 {
            margin: 0;
            color: #1e40af;
            font-size: 24px;
        }
        .details-section {
            margin: 30px 0;
        }
        .details-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .detail-item {
            padding: 10px;
            background: #f3f4f6;
            border-radius: 5px;
        }
        .detail-label {
            font-weight: bold;
            color: #6b7280;
            font-size: 12px;
            text-transform: uppercase;
        }
        .detail-value {
            font-size: 16px;
            color: #111827;
            margin-top: 5px;
        }
        .financial-table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
        }
        .financial-table th {
            background: #2563eb;
            color: white;
            padding: 12px;
            text-align: left;
        }
        .financial-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        .financial-table tr:last-child td {
            border-bottom: none;
        }
        .amount-cell {
            text-align: right;
            font-weight: bold;
        }
        .total-row {
            background: #f3f4f6;
            font-size: 18px;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }
        .status-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-paid {
            background: #10b981;
            color: white;
        }
        .status-pending {
            background: #f59e0b;
            color: white;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <div class="company-details">
                <h1>SwiftLogistics Premium</h1>
                <p>123 Business Street, Mumbai, MH 400001</p>
                <p>Phone: +91 123 456 7890 | Email: info@swiftlogistics.com</p>
                <p>GSTIN: 27AABCU9603R1ZX</p>
            </div>
            <div class="invoice-info">
                <h2>INVOICE</h2>
                <p><strong>Invoice #:</strong> ${invoiceNumber}</p>
                <p><strong>Date:</strong> ${invoiceDate}</p>
                <p><strong>Status:</strong> <span class="status-badge ${shipment.payment_status === 'paid' ? 'status-paid' : 'status-pending'}">${shipment.payment_status === 'paid' ? 'PAID' : 'PENDING'}</span></p>
            </div>
        </div>
    </div>

    <div class="details-section">
        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Customer Information</div>
                <div class="detail-value">Customer ID: ${shipment.customer_id || 'N/A'}</div>
                <div class="detail-value">Tracking: ${invoiceNumber}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Delivery Details</div>
                <div class="detail-value">From: ${shipment.origin || 'N/A'}</div>
                <div class="detail-value">To: ${shipment.destination || 'N/A'}</div>
                <div class="detail-value">Delivered: ${dueDate}</div>
            </div>
        </div>
    </div>

    <table class="financial-table">
        <thead>
            <tr>
                <th>Description</th>
                <th class="amount-cell">Amount (₹)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Freight Charges</td>
                <td class="amount-cell">${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td>GST (18%)</td>
                <td class="amount-cell">${tax.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
                <td><strong>Total Amount</strong></td>
                <td class="amount-cell"><strong>₹${amount.toFixed(2)}</strong></td>
            </tr>
        </tbody>
    </table>

    <div class="details-section">
        <h3>Financial Summary</h3>
        <div class="details-grid">
            <div class="detail-item">
                <div class="detail-label">Subtotal</div>
                <div class="detail-value">₹${subtotal.toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Tax (GST 18%)</div>
                <div class="detail-value">₹${tax.toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Total</div>
                <div class="detail-value">₹${amount.toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Payment Status</div>
                <div class="detail-value">${shipment.payment_status === 'paid' ? 'Paid' : 'Pending'}</div>
            </div>
        </div>
    </div>

    <div class="footer">
        <p>Thank you for your business!</p>
        <p>This is a computer-generated invoice. No signature required.</p>
        <p>For any queries, please contact us at support@swiftlogistics.com</p>
    </div>
</body>
</html>
    `.trim();

    // Return HTML content (can be converted to PDF using puppeteer or similar)
    // For now, we'll return HTML and use browser's print to PDF
    return htmlContent;
}

/**
 * Generate PDF invoice for operator download
 * 
 * @param {Object} shipment - Shipment data
 * @returns {Buffer|string} PDF content
 */
async function generateInvoice(shipment) {
    try {
        // Generate HTML invoice
        const htmlContent = generateInvoicePDF(shipment);
        
        // In production, convert HTML to PDF using puppeteer or similar
        // For now, return HTML which can be converted to PDF on client side or using puppeteer
        
        return htmlContent;
    } catch (error) {
        console.error('Error generating invoice:', error);
        throw new Error('Failed to generate invoice');
    }
}

module.exports = {
    generateInvoice,
    generateInvoicePDF
};
