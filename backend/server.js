const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');

// Initialize App
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set('io', io);

const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// DEBUG: Log all requests
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Root Route (Helpful Message)
app.get('/', (req, res) => {
  res.json({
    message: 'HackNova Backend API Running',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      data: '/api/data',
      ai: '/api/ai',
      customer: '/api/customer',
      routeOptimization: '/api/route-optimization'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Import Routes
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const aiRoutes = require('./routes/ai');
const customerRoutes = require('./routes/customer');
const intelligenceRoutes = require('./routes/intelligence'); // NEW: Intelligence routes
const chatbotRoutes = require('./routes/chatbot'); // NEW: Chatbot routes
const documentsRoutes = require('./routes/documents'); // NEW: Documents/Invoice routes

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/intelligence', intelligenceRoutes); // NEW: Intelligence decision-support endpoints
app.use('/api/chatbot', chatbotRoutes); // NEW: Chatbot endpoints
app.use('/api/documents', documentsRoutes); // NEW: Documents/Invoice endpoints
app.use('/api/payments', require('./routes/payments')); // NEW: Razorpay Payments

// Socket.IO Logic
const driverLocations = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('location:update', (data) => {
    const timestamp = Date.now();
    console.log(`[Socket] Location update from Driver ${data.driverId}:`, data.lat, data.lng);
    driverLocations[data.driverId] = {
      lat: data.lat,
      lng: data.lng,
      timestamp: timestamp
    };
    // Broadcast to all clients (operator, customer) with timestamp
    io.emit('driver:location', {
      driverId: data.driverId,
      lat: data.lat,
      lng: data.lng,
      timestamp: timestamp
    });
  });

  // NEW: Operator triggers Driver GPS
  socket.on('operator:request-location', (data) => {
    console.log(`[Socket] Operator requested location for Driver ${data.driverId}`);
    // Broadcast to all clients; Driver client will filter by ID
    io.emit('request:location', { driverId: data.driverId });
  });

  // Handle location denial from driver
  socket.on('location:denied', (data) => {
    console.log(`[Socket] Driver ${data.driverId} denied location request`);
    // Optionally notify operator that location was denied
    io.emit('location:denied', { driverId: data.driverId });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });

  // NEW: Customer notification handler (event-driven)
  // Customers can subscribe to shipment-specific notifications
  socket.on('customer:subscribe', (data) => {
    const { shipment_id, customer_id } = data;
    if (shipment_id && customer_id) {
      const room = `customer:${customer_id}:shipment:${shipment_id}`;
      socket.join(room);
      console.log(`[Socket] Customer ${customer_id} subscribed to shipment ${shipment_id}`);
    }
  });

  socket.on('customer:unsubscribe', (data) => {
    const { shipment_id, customer_id } = data;
    if (shipment_id && customer_id) {
      const room = `customer:${customer_id}:shipment:${shipment_id}`;
      socket.leave(room);
      console.log(`[Socket] Customer ${customer_id} unsubscribed from shipment ${shipment_id}`);
    }
  });
});

// NEW: Helper function to emit customer notifications (for use in routes/services)
// This is called when customer events are triggered (delay, route change, etc.)
const emitCustomerNotification = (customerId, shipmentId, notification) => {
  const room = `customer:${customerId}:shipment:${shipmentId}`;
  io.to(room).emit('customer_notification', {
    type: notification.type,
    message: notification.message,
    shipment_id: shipmentId,
    timestamp: new Date().toISOString()
  });
  console.log(`[Socket] Customer notification sent: ${customerId} - ${notification.type}`);
};

// Make emitCustomerNotification available to routes
app.set('emitCustomerNotification', emitCustomerNotification);

console.log('HackNova Backend Initialized.');

// Start Server
const port = PORT;
server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  // process.exit(1); // Optional: Keep alive for now to debug
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});
