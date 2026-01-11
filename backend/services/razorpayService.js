const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (amount, currency = 'INR', receipt) => {
    try {
        const options = {
            amount: amount * 100, // Amount in paise
            currency,
            receipt,
            payment_capture: 1
        };
        const order = await instance.orders.create(options);
        return order;
    } catch (error) {
        console.error('Razorpay Error:', error);
        // HACKATHON FALLBACK: If API fails (invalid keys), return mock order
        // This ensures the demo flow continues even without valid keys
        console.log('⚠️ Using MOCK Razorpay Order due to API failure');
        return {
            id: `order_mock_${Date.now()}`,
            entity: 'order',
            amount: amount * 100,
            currency: currency,
            receipt: receipt,
            status: 'created'
        };
    }
};

const verifySignature = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

    return expectedSignature === razorpay_signature;
};

module.exports = {
    createOrder,
    verifySignature,
    getKeyId: () => process.env.RAZORPAY_KEY_ID
};
