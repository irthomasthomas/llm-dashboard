#!/usr/bin/env python3
import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL for local Flask server
BASE_URL = "http://localhost:5000"

def print_separator():
    print("\n" + "="*80 + "\n")

def test_date_range_api():
    """Test the date range API endpoint"""
    print("Testing /api/date-range API...")
    response = requests.get(f"{BASE_URL}/api/date-range")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Response: {json.dumps(data, indent=2)}")
        if data.get('success', False):
            print("Date range API test: SUCCESS")
            return data.get('min_date'), data.get('max_date')
        else:
            print(f"Date range API test: FAILED - {data.get('error', 'Unknown error')}")
            return None, None
    else:
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Error: Could not get date range")
        return None, None

def test_models_api():
    """Test the models API endpoint"""
    print("Testing /api/models API...")
    response = requests.get(f"{BASE_URL}/api/models")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Response: {json.dumps(data, indent=2)}")
        if data.get('success', False):
            print("Models API test: SUCCESS")
            return data.get('models', [])
        else:
            print(f"Models API test: FAILED - {data.get('error', 'Unknown error')}")
            return []
    else:
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Error: Could not get models")
        return []

def test_token_data_api(start_date, end_date, model='all'):
    """Test the token data API endpoint with filters"""
    print(f"Testing /api/token-data API with start_date={start_date}, end_date={end_date}, model={model}...")
    
    params = {
        'start_date': start_date,
        'end_date': end_date,
        'model': model
    }
    
    response = requests.get(f"{BASE_URL}/api/token-data", params=params)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Status: {response.status_code} ({response.reason})")
        
        # Show abbreviated response to avoid huge output
        abbreviated_data = data.copy()
        if 'model_data' in abbreviated_data:
            abbreviated_data['model_data'] = f"[{len(abbreviated_data['model_data'])} model records]"
            for model_record in data['model_data'][:2]:  # Show first 2 as examples
                print(f"Sample model data: {json.dumps(model_record, indent=2)}")
                
        if 'date_data' in abbreviated_data:
            abbreviated_data['date_data'] = f"[{len(abbreviated_data['date_data'])} date records]"
            for date_record in data['date_data'][:2]:  # Show first 2 as examples
                print(f"Sample date data: {json.dumps(date_record, indent=2)}")
        
        print(f"Response summary: {json.dumps(abbreviated_data, indent=2)}")
        
        if data.get('success', False):
            print("Token data API test: SUCCESS")
            return True
        else:
            print(f"Token data API test: FAILED - {data.get('error', 'Unknown error')}")
            return False
    else:
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Error: Could not get token data")
        return False

def main():
    print_separator()
    print("API TEST SCRIPT")
    print_separator()
    
    # Test date range API
    min_date, max_date = test_date_range_api()
    print_separator()
    
    if not min_date or not max_date:
        print("Cannot continue testing without valid date range")
        sys.exit(1)
    
    # Test models API
    models = test_models_api()
    print_separator()
    
    if not models:
        print("Warning: No models found")
    
    # Test token data API with 'all' models
    test_token_data_api(min_date, max_date, 'all')
    print_separator()
    
    # Test token data API with a specific model (if available)
    if models:
        test_token_data_api(min_date, max_date, models[0])
        print_separator()
    
    # Test debug info API
    print("Testing /api/debug-info API...")
    response = requests.get(f"{BASE_URL}/api/debug-info")
    if response.status_code == 200:
        data = response.json()
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Response: {json.dumps(data, indent=2)}")
    else:
        print(f"Status: {response.status_code} ({response.reason})")
        print(f"Error: Could not get debug info")
    
    print_separator()
    print("API TEST COMPLETE")

if __name__ == "__main__":
    main()
