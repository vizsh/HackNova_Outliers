/**
 * Gemini Chatbot Service
 * 
 * AI-powered chatbot trained on logistics dataset using Google Gemini API.
 * Provides intelligent responses based on CSV data analysis.
 * 
 * Features:
 * - Context-aware responses
 * - Dataset-based knowledge
 * - Role-specific answers (operator, driver, customer)
 * - Natural language understanding
 */

// Use HTTPS for Gemini API (Node.js compatible, no SDK needed)
const fs = require('fs');
const path = require('path');
const https = require('https');

// Gemini API Configuration
const GEMINI_API_KEY = 'AIzaSyDL6cKoTmFQMthrnNJqQLDlrHL7S7sqioY';

// Dataset path
const DATASET_PATH = path.join(__dirname, '../db/logistics_ai_enriched_dataset.csv');

// Load and process CSV dataset for context
let datasetContext = '';
let datasetLoaded = false;

/**
 * Load and process CSV dataset
 */
function loadDataset() {
    try {
        if (!datasetLoaded && fs.existsSync(DATASET_PATH)) {
            const csvContent = fs.readFileSync(DATASET_PATH, 'utf-8');
            const lines = csvContent.split('\n').slice(0, 100); // Use first 100 rows for context
            datasetContext = lines.join('\n');
            datasetLoaded = true;
            console.log('[Chatbot] Dataset loaded successfully');
        }
    } catch (error) {
        console.error('[Chatbot] Error loading dataset:', error);
        datasetContext = 'Logistics dataset information available.';
    }
}

// Load dataset on module initialization
loadDataset();

/**
 * Get role-specific system prompt
 */
function getSystemPrompt(role) {
    const rolePrompts = {
        operator: `You are an intelligent logistics operations assistant. You help operators manage deliveries, routes, drivers, and optimize operations. 
        Use the following dataset context to provide accurate, data-driven insights about deliveries, routes, driver performance, and logistics metrics.
        Always provide actionable recommendations based on the data.`,

        driver: `You are a helpful delivery driver assistant. You help drivers with route navigation, delivery instructions, customer communication, 
        and understanding delivery status. Use the dataset context to provide helpful information about routes, delivery procedures, and best practices.
        Be concise and practical in your responses.`,

        customer: `You are a friendly customer service assistant for a logistics company. You help customers track their shipments, understand delivery status,
        answer questions about their orders, and provide support. Use the dataset context to provide accurate tracking information and delivery estimates.
        Be friendly, helpful, and clear in your responses.`
    };

    return rolePrompts[role] || rolePrompts.customer;
}

/**
 * Generate chatbot response using Gemini API
 * 
 * @param {string} message - User message
 * @param {string} role - User role (operator, driver, customer)
 * @param {Object} context - Additional context (shipment data, etc.)
 * @returns {Promise<string>} Chatbot response
 */
async function generateResponse(message, role = 'customer', context = {}) {
    try {
        const systemPrompt = getSystemPrompt(role);
        
        // Build context string from additional context
        let contextString = '';
        if (context.shipment) {
            contextString += `\nCurrent Shipment: ${JSON.stringify(context.shipment, null, 2)}\n`;
        }
        if (context.userData) {
            contextString += `\nUser Data: ${JSON.stringify(context.userData, null, 2)}\n`;
        }

        // Build full prompt with dataset context
        const fullPrompt = `${systemPrompt}

Dataset Context (Sample):
${datasetContext}

${contextString}

User Question: ${message}

Please provide a helpful, accurate response based on the dataset context and user's role as a ${role}. 
If the question is about specific data not in the context, provide general guidance based on logistics best practices.
Keep responses concise and actionable.`;

        // Use Gemini API via HTTPS (Node.js compatible)
        const postData = JSON.stringify({
            contents: [{
                parts: [{
                    text: fullPrompt
                }]
            }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const data = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseData = '';
                
                res.on('data', (chunk) => {
                    responseData += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`Gemini API error: ${res.statusCode} - ${parsed.error?.message || responseData}`));
                        }
                    } catch (err) {
                        reject(new Error(`Failed to parse response: ${err.message}`));
                    }
                });
            });

            req.on('error', (err) => {
                reject(new Error(`Request failed: ${err.message}`));
            });

            req.write(postData);
            req.end();
        });
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text.trim();
        }
        
        throw new Error('Invalid response from Gemini API');
    } catch (error) {
        console.error('[Chatbot] Error generating response:', error);
        
        // Fallback response
        if (error.message.includes('API key') || error.message.includes('403')) {
            return 'I apologize, but there seems to be an issue with the AI service. Please try again later or contact support.';
        }
        
        // Provide helpful fallback based on role
        const fallbackResponses = {
            operator: 'I understand you\'re looking for operational insights. Based on logistics best practices, I recommend checking the dashboard for real-time metrics and route optimization suggestions.',
            driver: 'I\'m here to help with your delivery. Please check the delivery details in your dashboard, and if you need specific route information, use the navigation feature.',
            customer: 'Thank you for your question. For shipment tracking, please check your tracking number in the dashboard. If you need immediate assistance, our support team is available 24/7.'
        };

        return fallbackResponses[role] || 'I apologize for the inconvenience. Please try rephrasing your question or contact support for assistance.';
    }
}

/**
 * Test chatbot with sample questions
 */
async function testChatbot(role = 'customer') {
    const testQuestions = {
        operator: [
            'What are the key performance metrics I should monitor?',
            'How can I optimize delivery routes?',
            'Which drivers are performing best?',
            'What are common delay causes?'
        ],
        driver: [
            'How do I complete a delivery?',
            'What should I do if I\'m running late?',
            'How do I contact a customer?',
            'What are the delivery verification steps?'
        ],
        customer: [
            'How can I track my shipment?',
            'What do I do if my delivery is delayed?',
            'How do I reschedule a delivery?',
            'What is the delivery time estimate?'
        ]
    };

    const questions = testQuestions[role] || testQuestions.customer;
    const results = [];

    for (const question of questions) {
        try {
            const response = await generateResponse(question, role);
            results.push({ question, response, success: true });
        } catch (error) {
            results.push({ question, response: error.message, success: false });
        }
    }

    return results;
}

module.exports = {
    generateResponse,
    testChatbot,
    loadDataset
};
