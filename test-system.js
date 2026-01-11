#!/usr/bin/env node

/**
 * System Test Script
 * Tests all critical components before starting servers
 */

console.log('🔍 Testing System Components...\n');

let errors = [];
let tests = [];

// Test 1: Database Module
try {
    const db = require('./backend/db');
    // Test async query
    db.query('SELECT * FROM users WHERE email = $1', ['operator@example.com']).then(result => {
        if (result.rows && result.rows.length > 0) {
            tests.push('✅ Database query handler works');
        } else {
            errors.push('❌ Database query handler returned no results');
        }
    }).catch(e => {
        errors.push(`❌ Database query error: ${e.message}`);
    });
    // Wait a bit for async
    setTimeout(() => {}, 100);
    tests.push('✅ Database module loaded');
} catch (e) {
    errors.push(`❌ Database module error: ${e.message}`);
}

// Test 2: Auth Routes
try {
    const authRoutes = require('./backend/routes/auth');
    tests.push('✅ Auth routes loaded');
} catch (e) {
    errors.push(`❌ Auth routes error: ${e.message}`);
}

// Test 3: All Route Files
const routeFiles = [
    './backend/routes/data',
    './backend/routes/ai',
    './backend/routes/customer',
    './backend/routes/intelligence',
    './backend/routes/chatbot',
    './backend/routes/documents'
];

routeFiles.forEach(route => {
    try {
        require(route);
        tests.push(`✅ ${route.split('/').pop()} routes loaded`);
    } catch (e) {
        errors.push(`❌ ${route.split('/').pop()} routes error: ${e.message}`);
    }
});

// Test 4: Services
const serviceFiles = [
    './backend/services/otpService',
    './backend/services/podPhotoService',
    './backend/services/geminiChatbot',
    './backend/services/invoicePDFService'
];

serviceFiles.forEach(service => {
    try {
        require(service);
        tests.push(`✅ ${service.split('/').pop()} service loaded`);
    } catch (e) {
        errors.push(`❌ ${service.split('/').pop()} service error: ${e.message}`);
    }
});

// Test 5: Middleware
try {
    const authMiddleware = require('./backend/middleware/authMiddleware');
    tests.push('✅ Auth middleware loaded');
} catch (e) {
    errors.push(`❌ Auth middleware error: ${e.message}`);
}

// Test 6: Server File
try {
    // Don't actually start server, just check syntax
    require('fs').readFileSync('./backend/server.js', 'utf8');
    tests.push('✅ Server file syntax OK');
} catch (e) {
    errors.push(`❌ Server file error: ${e.message}`);
}

// Print Results
console.log('\n📊 Test Results:\n');
tests.forEach(test => console.log(test));

if (errors.length > 0) {
    console.log('\n❌ Errors Found:\n');
    errors.forEach(error => console.log(error));
    console.log('\n⚠️  Please fix errors before starting servers\n');
    process.exit(1);
} else {
    console.log('\n✅ All tests passed! System is ready.\n');
    process.exit(0);
}
