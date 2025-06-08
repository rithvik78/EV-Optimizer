#!/bin/bash

# EV Charging Optimizer - Frontend Setup & Start Script
# This script sets up and starts the React frontend server

set -e  # Exit on any error

echo "⚛️  EV Charging Optimizer - Frontend Setup"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${BLUE}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

node_version=$(node --version | cut -d"v" -f2)
required_version="18.0.0"

if [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" = "$required_version" ]]; then
    echo -e "${GREEN}✓ Node.js $node_version is compatible${NC}"
else
    echo -e "${RED}✗ Node.js 18+ required. Found: $node_version${NC}"
    echo "Please install Node.js 18 or higher"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

npm_version=$(npm --version)
echo -e "${GREEN}✓ npm $npm_version found${NC}"

# Navigate to frontend directory
cd "$(dirname "$0")/frontend"

# Check if .env file exists in root
if [ ! -f "../.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found!${NC}"
    echo "Please create .env file with your API keys:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your API keys"
    echo ""
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules not found. Installing dependencies...${NC}"
    install_deps=true
else
    echo -e "${BLUE}Checking if dependencies need to be updated...${NC}"
    # Check if package.json is newer than node_modules
    if [ "package.json" -nt "node_modules" ]; then
        echo -e "${YELLOW}package.json is newer than node_modules. Updating dependencies...${NC}"
        install_deps=true
    else
        echo -e "${GREEN}✓ Dependencies are up to date${NC}"
        install_deps=false
    fi
fi

# Install/update dependencies if needed
if [ "$install_deps" = true ]; then
    echo -e "${BLUE}Installing React dependencies...${NC}"
    npm install
    
    # Check if installation was successful
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Check if backend is running
echo -e "${BLUE}Checking if backend server is running...${NC}"
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend server is running${NC}"
else
    echo -e "${YELLOW}⚠ Backend server not detected${NC}"
    echo "Make sure to start the backend server first:"
    echo "  ./backend.sh"
    echo ""
fi

# Health check function for frontend
check_frontend() {
    local max_attempts=60  # React dev server takes longer to start
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    return 1
}

# Start the React development server
echo -e "${GREEN}🚀 Starting React frontend server...${NC}"
echo "Frontend will start on http://localhost:3000"
echo "The app will automatically open in your default browser"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Set environment variable to disable browser auto-open if desired
# export BROWSER=none

# Start React development server
npm start &
frontend_pid=$!

# Wait for frontend to start
echo -e "${BLUE}Waiting for frontend to start...${NC}"
if check_frontend; then
    echo -e "${GREEN}✓ Frontend server is running successfully!${NC}"
    echo ""
    echo -e "${GREEN}🎉 EV Charging Optimizer is ready!${NC}"
    echo ""
    echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
    echo -e "${BLUE}Backend API:${NC} http://localhost:8080/api"
    echo ""
    echo -e "${GREEN}Available features:${NC}"
    echo "  📊 Real-time Dashboard    - Solar, weather, and pricing data"
    echo "  ⚡ Charging Optimizer     - AI-powered session planning"
    echo "  🗺️  Interactive Map       - 3,520+ LA charging stations"
    echo "  🛣️  Route Planner         - Optimal routes with charging stops"
    echo "  🤖 Claude AI Assistant   - Conversational charging advice"
    echo ""
else
    echo -e "${RED}✗ Failed to start frontend server${NC}"
    kill $frontend_pid 2>/dev/null || true
    exit 1
fi

# Keep the script running
echo -e "${BLUE}Frontend is running. Press Ctrl+C to stop...${NC}"
wait $frontend_pid