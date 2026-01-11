console.log('Line 1');
require('dotenv').config();
console.log('Line 3');
const express = require('express');
console.log('Line 5');
const http = require('http');
console.log('Line 7');
const { Server } = require('socket.io');
console.log('Line 9');
const cors = require('cors');
console.log('Line 11');
const db = require('./db');
console.log('Line 13');

const app = express();
console.log('Line 16');
const server = http.createServer(app);
console.log('Line 18');
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
console.log('Line 24');

const PORT = process.env.PORT || 3000;
console.log('Line 27');

app.use(cors());
console.log('Line 30');
app.use(express.json());
console.log('Line 32');

// Import Routes
let authRoutes, dataRoutes, aiRoutes, customerRoutes;

try {
    console.log('Loading auth routes...');
    authRoutes = require('./routes/auth');
    console.log('Loading data routes...');
    dataRoutes = require('./routes/data');
    console.log('Loading ai routes...');
    aiRoutes = require('./routes/ai');
    console.log('Loading customer routes...');
    customerRoutes = require('./routes/customer');
} catch (error) {
    console.error("CRITICAL: Failed to load routes:", error);
    process.exit(1);
}

console.log('Routes loaded. Using them...');
try {
    app.use('/api/auth', authRoutes);
    app.use('/api/data', dataRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/customer', customerRoutes);
} catch (e) {
    console.error("Route loading error", e);
}

console.log('Setting up Socket...');
const driverLocations = {};
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join_room', (room) => socket.join(room));
    socket.on('location:update', (data) => {
        driverLocations[data.driverId] = { lat: data.lat, lng: data.lng, timestamp: Date.now() };
        io.emit('driver:location', { driverId: data.driverId, lat: data.lat, lng: data.lng });
    });
});

console.log('Checking DB...');
console.log('Database Access: OK');

app.get('/', (req, res) => {
    res.send('HackNova 2 Backend API Running');
});

console.log('Starting listen...');
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
