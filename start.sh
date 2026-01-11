#!/bin/bash
set -e

echo "🚀 Starting HackNova Logistics System"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Clean up any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start Backend
echo "🔧 Starting Backend Server..."
cd backend
node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
sleep 4

# Verify backend
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "   ✅ Backend is running on http://localhost:3000"
else
    echo "   ❌ Backend failed to start"
    echo "   Check backend.log for errors"
    exit 1
fi

# Start Frontend
echo ""
echo "🎨 Starting Frontend Server..."
cd ../frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"
sleep 6

# Verify frontend
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "   ✅ Frontend is running on http://localhost:5173"
else
    echo "   ⚠️  Frontend may still be starting..."
fi

echo ""
echo "========================================"
echo "✅ Servers Started Successfully!"
echo "========================================"
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
echo "💡 Features:"
echo "   - OTP Verification & Geo-tagged POD"
echo "   - AI Chatbot (click blue chat icon)"
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

# Keep script running and handle cleanup
trap "echo ''; echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
