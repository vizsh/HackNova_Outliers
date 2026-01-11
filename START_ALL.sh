#!/bin/bash

echo "========================================="
echo "Starting HackNova Logistics System"
echo "========================================="
echo ""

# Kill existing processes
echo "Stopping existing processes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
sleep 2

# Navigate to project root
cd "$(dirname "$0")"

# Start Backend
echo "Starting Backend Server..."
cd "backend"
node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo "Backend logs: backend.log"
sleep 3

# Check if backend started
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is running on http://localhost:3000"
else
    echo "❌ Backend failed to start. Check backend.log"
    exit 1
fi

# Start Frontend
echo ""
echo "Starting Frontend Server..."
cd "../frontend"
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo "Frontend logs: frontend.log"
sleep 5

# Check if frontend started
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend is running on http://localhost:5173"
else
    echo "⚠️  Frontend may still be starting. Check frontend.log"
fi

echo ""
echo "========================================="
echo "🚀 Servers Started Successfully!"
echo "========================================="
echo ""
echo "📍 Access Points:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo ""
echo "🔐 Test Accounts:"
echo "   Operator: operator@example.com / password"
echo "   Driver:   driver@example.com / password"
echo "   Customer: customer@example.com / password"
echo ""
echo "💬 Chatbot: Click blue chat icon (bottom-right) on any interface"
echo "📄 Invoice: Operator Dashboard → Documents → PDF button"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep script running
wait
