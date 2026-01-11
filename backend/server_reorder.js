console.log('Server Start');
require('dotenv').config(); // Uncommenting to see if it works now with bcryptjs? No, keep it specific.

// TRY LOADING ROUTES FIRST
try {
    console.log('Loading auth routes EARLY...');
    const authTest = require('./routes/auth');
    console.log('Auth Loaded EARLY');
} catch (e) {
    console.error('EARLY LOAD FAIL:', e);
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const PORT = 3000; // Hardcoded

app.use(cors());
app.use(express.json());

let authRoutes, dataRoutes, aiRoutes, customerRoutes;
try {
    authRoutes = require('./routes/auth');
    dataRoutes = require('./routes/data');
    aiRoutes = require('./routes/ai');
    customerRoutes = require('./routes/customer');
} catch (error) {
    console.error("Failed to load routes:", error);
    process.exit(1);
}

// ... app.use ...
try {
    app.use('/api/auth', authRoutes);
    app.use('/api/data', dataRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/customer', customerRoutes);
} catch (e) {
}

const driverLocations = {};
io.on('connection', (socket) => {
    // ... (simplified for debug)
    console.log('Connect', socket.id);
});

console.log('DB Check');
// db.query... mock

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
