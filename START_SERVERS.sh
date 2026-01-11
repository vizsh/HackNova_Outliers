#!/bin/bash

# Start Backend and Frontend Servers
# This script starts both servers for the logistics management system

echo "Starting HackNova Logistics Management System..."
echo ""

# Function to check if port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo "Port $1 is already in use. Stopping existing process..."
        lsof -ti:$1 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Check and clear ports
check_port 3000
check_port 5173

# Start Backend
echo "Starting Backend Server (Port 3000)..."
cd "HackNova 2 1522/HackNova 2/backend"
node server.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started with PID: $BACKEND_PID"
echo "Backend logs: backend.log"
echo ""

# Wait for backend to start
sleep 3

# Start Frontend
echo "Starting Frontend Server (Port 5173)..."
cd "../frontend"
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started with PID: $FRONTEND_PID"
echo "Frontend logs: frontend.log"
echo ""

# Wait for frontend to start
sleep 3

echo "========================================="
echo "Servers Started Successfully!"
echo "========================================="
echo ""
echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Test Accounts:"
echo "  Operator: operator@example.com / password"
echo "  Driver:   driver@example.com / password"
echo "  Customer: customer@example.com / password"
echo ""
echo "To stop servers, run: kill $BACKEND_PID $FRONTEND_PID"
echo "Or press Ctrl+C and run: pkill -f 'node server.js' && pkill -f 'vite'"
echo ""

# Keep script running
wait
