#!/bin/bash

# EV Charging Optimizer - Backend Setup & Start Script
# This script sets up and starts the Flask backend server

set -e  # Exit on any error

echo "🔋 EV Charging Optimizer - Backend Setup"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Python 3.11+ is installed
echo -e "${BLUE}Checking Python version...${NC}"
python_version=$(python3 --version 2>&1 | cut -d" " -f2)
required_version="3.11.0"

if [[ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" = "$required_version" ]]; then
    echo -e "${GREEN}✓ Python $python_version is compatible${NC}"
else
    echo -e "${RED}✗ Python 3.11+ required. Found: $python_version${NC}"
    echo "Please install Python 3.11 or higher"
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")/backend"

# Skip virtual environment - use system Python as requested
echo -e "${YELLOW}Using system Python (no virtual environment)${NC}"

# Check if pip3 is available
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}✗ pip3 not found${NC}"
    echo "Please install pip3"
    exit 1
fi

# Upgrade pip3 (commented out - already done)
# echo -e "${BLUE}Upgrading pip3...${NC}"
# pip3 install --upgrade pip

# Install dependencies with pip3 (commented out - already installed)
# echo -e "${BLUE}Installing Python dependencies with pip3...${NC}"
# echo "This may take a few minutes for Python 3.13 compatibility..."
# pip3 install -r requirements.txt --user

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found!${NC}"
    echo "Please create .env file with your API keys:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your API keys"
    echo ""
fi

# Create necessary directories
echo -e "${BLUE}Creating necessary directories...${NC}"
mkdir -p ../models ../api_data ../config

# Check if models exist
if [ ! -f "../models/random_forest_ladwp_model.pkl" ]; then
    echo -e "${YELLOW}Warning: ML models not found in ../models/${NC}"
    echo "The system will work with reduced functionality"
    echo "Run the training notebooks to generate models"
    echo ""
fi

# Health check function
check_server() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
            return 0
        fi
        sleep 1
        ((attempt++))
    done
    return 1
}

# Start the Flask server
echo -e "${GREEN}🚀 Starting Flask backend server...${NC}"
echo "Server will start on http://localhost:8080"
echo "API endpoints available at http://localhost:8080/api"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Start server in background for health check
python3 app.py &
server_pid=$!

# Wait for server to start
echo -e "${BLUE}Waiting for server to start...${NC}"
sleep 5  # Give server time to start
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend server is running successfully!${NC}"
    echo ""
    echo -e "${GREEN}Available endpoints:${NC}"
    echo "  GET  /api/health              - System health check"
    echo "  GET  /api/current-conditions  - Real-time conditions"
    echo "  POST /api/optimize-session    - Charging optimization"
    echo "  GET  /api/stations            - EV charging stations"
    echo "  POST /api/claude-chat         - Claude AI assistant"
    echo "  POST /api/route-optimization  - Route planning"
    echo ""
else
    echo -e "${RED}✗ Failed to start backend server${NC}"
    kill $server_pid 2>/dev/null || true
    exit 1
fi

# Wait for server process
wait $server_pid