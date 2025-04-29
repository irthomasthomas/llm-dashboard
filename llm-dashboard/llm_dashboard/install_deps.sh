#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Installing dependencies for LLM Dashboard...${NC}"

# Check if virtual environment exists, if not create it
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo -e "${YELLOW}Installing required packages...${NC}"
pip install -r requirements.txt

echo -e "${GREEN}Dependencies installed successfully!${NC}"
echo -e "Now you can run the application with: ${YELLOW}./debug_run.sh${NC}"
