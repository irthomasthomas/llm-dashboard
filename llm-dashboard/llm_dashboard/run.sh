#!/bin/bash

# Check if virtual environment exists, if not create it
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
    source venv/bin/activate
    pip install flask pandas
else
    source venv/bin/activate
fi

# Run the Flask application
echo "Starting LLM Dashboard..."
python app.py
