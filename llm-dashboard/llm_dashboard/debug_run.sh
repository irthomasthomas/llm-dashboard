#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}LLM Dashboard - Debug Mode${NC}"

# Check if SQLite is installed
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}SQLite3 is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if the database exists
DB_PATH="/home/thomas/.config/io.datasette.llm/logs.db"
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Database not found at: $DB_PATH${NC}"
    echo "Please check the path in app.py if this is incorrect."
    
    # Ask user if they want to continue
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}Database found at: $DB_PATH${NC}"
    
    # Check if database has required table
    TABLE_CHECK=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='responses';")
    if [ "$TABLE_CHECK" -eq "0" ]; then
        echo -e "${RED}The 'responses' table was not found in the database.${NC}"
        
        # Show available tables
        echo "Available tables:"
        sqlite3 "$DB_PATH" ".tables"
        
        # Ask user if they want to continue
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}The 'responses' table was found.${NC}"
        
        # Check for chat.completion.chunk records
        CHUNK_CHECK=$(sqlite3 "$DB_PATH" "SELECT count(*) FROM responses WHERE response_json LIKE '%chat.completion.chunk%';")
        if [ "$CHUNK_CHECK" -eq "0" ]; then
            echo -e "${YELLOW}Warning: No records with 'chat.completion.chunk' were found.${NC}"
        else
            echo -e "${GREEN}Found $CHUNK_CHECK records with 'chat.completion.chunk'.${NC}"
            
            # Check date range
            echo "Date range in database:"
            sqlite3 "$DB_PATH" "SELECT MIN(datetime_utc), MAX(datetime_utc) FROM responses WHERE response_json LIKE '%chat.completion.chunk%';"
        fi
    fi
fi

# Check if virtual environment exists, if not create it
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python -m venv venv
    source venv/bin/activate
    pip install flask pandas
else
    source venv/bin/activate
fi

# Run the Flask application with debug enabled
echo -e "${GREEN}Starting LLM Dashboard...${NC}"
FLASK_DEBUG=1 python app.py
