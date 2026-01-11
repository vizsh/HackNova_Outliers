#!/bin/bash
set -e

echo "=========================================="
echo "🚀 HackNova Logistics System - Startup"
echo "=========================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Clean up
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true
sleep 2

# Check dependencies
echo "📦 Checking dependencies..."
if [ ! -d "backend/node_modules" ]; then
    echo "   Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "   Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Start Backend
echo ""
echo "🔧 Starting Backend Server..."
cd backend
node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
echo "   Logs: ../backend.log"

# Wait for backend
sleep 5

# Test backend
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running on http://localhost:3000"
else
    echo "   ❌ Backend failed to start"
    echo "   Check backend.log:"
    tail -20 ../backend.log
    exit 1
fi

# Test login endpoint
echo "   Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"operator@example.com","password":"password"}')
if echo "$LOGIN_RESPONSE" | grep -q "token"; then
    echo "   ✅ Login endpoint working"
else
    echo "   ⚠️  Login endpoint issue: $LOGIN_RESPONSE"
fi

# Start Frontend
echo ""
echo "🎨 Starting Frontend Server..."
cd ../frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
echo "   Logs: ../frontend.log"

# Wait for frontend
sleep 8

# Test frontend
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running on http://localhost:5173"
else
    echo "   ⚠️  Frontend may still be starting..."
fi

echo ""
echo "=========================================="
echo "✅ Servers Started Successfully!"
echo "=========================================="
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
echo "💡 Features Available:"
echo "   - OTP Verification & Geo-tagged POD"
echo "   - AI Chatbot (blue chat icon)"
echo "   - Invoice PDF Download"
echo "   - Route Optimization"
echo "   - Real-time Tracking"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Keep running
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
