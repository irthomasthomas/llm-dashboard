#!/usr/bin/env python3
import os
import sqlite3
import json
import traceback
import sys
from datetime import datetime, timedelta
from flask import Flask, jsonify, request, render_template, send_from_directory
import pandas as pd

app = Flask(__name__, static_folder='static')

# Database path
DB_PATH = '/home/thomas/.config/io.datasette.llm/logs.db'

# Enable debugging
app.config['DEBUG'] = True

# Create standalone directory if it doesn't exist
os.makedirs('standalone', exist_ok=True)

# Helper function to get database connection
def get_db_connection():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        # Test if connection works
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        return conn
    except Exception as e:
        print(f"Database connection error: {e}", file=sys.stderr)
        traceback.print_exc()
        raise

# Helper function to format dates for display
def format_date(date_str):
    try:
        # Handle various date formats
        if date_str is None:
            return None
            
        # Print raw date for debugging
        print(f"Parsing date: {date_str}")
            
        # Try different formats
        formats_to_try = [
            '%Y-%m-%dT%H:%M:%S.%f',  # With microseconds
            '%Y-%m-%dT%H:%M:%S.%f+00:00',  # With timezone
            '%Y-%m-%dT%H:%M:%S.%fZ',  # With Z timezone
            '%Y-%m-%dT%H:%M:%S',  # Without microseconds
            '%Y-%m-%d %H:%M:%S.%f',  # Space separator with microseconds
            '%Y-%m-%d %H:%M:%S'  # Space separator without microseconds
        ]
        
        # Remove timezone if present (we'll handle it separately)
        if '+' in date_str:
            cleaned_date = date_str.split('+')[0]
        elif 'Z' in date_str:
            cleaned_date = date_str.replace('Z', '')
        else:
            cleaned_date = date_str
        
        # Try each format
        for fmt in formats_to_try:
            try:
                dt = datetime.strptime(cleaned_date, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
                
        # If all formats fail, try to extract just the date part
        if 'T' in date_str:
            date_part = date_str.split('T')[0]
            try:
                dt = datetime.strptime(date_part, '%Y-%m-%d')
                return date_part
            except ValueError:
                pass
        
        # Last resort - match any YYYY-MM-DD pattern
        import re
        match = re.search(r'(\d{4}-\d{2}-\d{2})', date_str)
        if match:
            return match.group(1)
        
        # If all formats fail, return None
        print(f"Could not parse date: {date_str}")
        return None
    except Exception as e:
        print(f"Error formatting date {date_str}: {e}")
        traceback.print_exc()
        return None

@app.route('/api/debug-info', methods=['GET'])
def get_debug_info():
    """Endpoint to help debug issues with database and date formats"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        debug_info = {
            "db_path": DB_PATH,
            "db_exists": os.path.exists(DB_PATH),
            "tables": [],
            "sample_dates": [],
            "date_parsing_tests": []
        }
        
        # Get tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        debug_info["tables"] = [row[0] for row in cursor.fetchall()]
        
        # Check if responses table exists
        if 'responses' in debug_info["tables"]:
            # Get a few sample dates
            cursor.execute("SELECT datetime_utc FROM responses LIMIT 5")
            sample_dates = [row[0] for row in cursor.fetchall()]
            debug_info["sample_dates"] = sample_dates
            
            # Test date parsing
            for date_str in sample_dates:
                parsed = format_date(date_str)
                debug_info["date_parsing_tests"].append({
                    "original": date_str,
                    "parsed": parsed,
                    "success": parsed is not None
                })
            
            # Check for chat.completion.chunk records
            cursor.execute("SELECT COUNT(*) FROM responses WHERE response_json LIKE '%chat.completion.chunk%'")
            debug_info["chunk_record_count"] = cursor.fetchone()[0]
            
            # Get date range for chunk records
            cursor.execute("SELECT MIN(datetime_utc), MAX(datetime_utc) FROM responses WHERE response_json LIKE '%chat.completion.chunk%'")
            min_date, max_date = cursor.fetchone()
            debug_info["chunk_min_date"] = min_date
            debug_info["chunk_max_date"] = max_date
            debug_info["chunk_min_date_parsed"] = format_date(min_date)
            debug_info["chunk_max_date_parsed"] = format_date(max_date)
            
            # Check a sample record
            cursor.execute("SELECT id, model, datetime_utc, response_json FROM responses WHERE response_json LIKE '%chat.completion.chunk%' LIMIT 1")
            row = cursor.fetchone()
            if row:
                sample = dict(row)
                # Include just the first 500 chars of response_json to avoid huge output
                sample["response_json"] = sample["response_json"][:500] + "..." if len(sample["response_json"]) > 500 else sample["response_json"]
                debug_info["sample_record"] = sample
        
        conn.close()
        return jsonify(debug_info)
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

# Get available date range in the database
@app.route('/api/date-range', methods=['GET'])
def get_date_range():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the min and max dates
        query = "SELECT MIN(datetime_utc), MAX(datetime_utc) FROM responses WHERE response_json LIKE '%chat.completion.chunk%'"
        cursor.execute(query)
        result = cursor.fetchone()
        
        min_date_str = result[0] if result[0] else None
        max_date_str = result[1] if result[1] else None
        
        print(f"Raw min date: {min_date_str}")
        print(f"Raw max date: {max_date_str}")
        
        min_date = format_date(min_date_str)
        max_date = format_date(max_date_str)
        
        print(f"Formatted min date: {min_date}")
        print(f"Formatted max date: {max_date}")
        
        # If we couldn't parse the dates, fall back to reasonable defaults
        if not min_date or not max_date:
            today = datetime.now()
            min_date = (today - timedelta(days=30)).strftime('%Y-%m-%d')
            max_date = today.strftime('%Y-%m-%d')
            
        conn.close()
        
        return jsonify({
            'min_date': min_date,
            'max_date': max_date,
            'success': True,
            'raw_min_date': min_date_str,
            'raw_max_date': max_date_str
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500

# Get all available models
@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get distinct models from filtered responses
        query = "SELECT DISTINCT model FROM responses WHERE response_json LIKE '%chat.completion.chunk%' ORDER BY model"
        cursor.execute(query)
        models = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        
        print(f"Found {len(models)} models")
        
        return jsonify({
            'models': models,
            'success': True
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500

# Get token usage data based on filters
@app.route('/api/token-data', methods=['GET'])
def get_token_data():
    try:
        # Get filters from request
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        model = request.args.get('model', 'all')
        
        print(f"Request params: start_date={start_date}, end_date={end_date}, model={model}")
        
        # Validate dates
        if not start_date or not end_date:
            return jsonify({
                'error': 'Start date and end date are required',
                'success': False
            }), 400
        
        # Add one day to end_date for inclusive filtering
        try:
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
            end_date_obj = end_date_obj + timedelta(days=1)
            end_date_next = end_date_obj.strftime('%Y-%m-%d')
        except ValueError:
            return jsonify({
                'error': f'Invalid date format for end_date: {end_date}. Expected YYYY-MM-DD.',
                'success': False
            }), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if database exists and has the required table
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='responses'")
            if not cursor.fetchone():
                return jsonify({
                    'error': 'The database does not contain a "responses" table',
                    'success': False
                }), 500
        except Exception as e:
            return jsonify({
                'error': f'Error accessing database: {str(e)}',
                'success': False
            }), 500
        
        # More flexible date query
        # First fetch all matching records and filter dates in Python
        # This approach is more flexible with different date formats
        base_query = """
        SELECT id, model, response_json, datetime_utc
        FROM responses 
        WHERE response_json LIKE '%chat.completion.chunk%'
        """
        
        params = []
        
        if model != 'all':
            base_query += " AND model = ?"
            params.append(model)
        
        print(f"Executing query: {base_query}")
        print(f"With params: {params}")
        
        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        
        print(f"Found {len(rows)} matching records")
        
        # Process the data and filter by dates in Python
        data = []
        for row in rows:
            id, model, response_json_str, datetime_utc = row
            
            try:
                # Parse date
                record_date = format_date(datetime_utc)
                
                # Skip if date couldn't be parsed or is outside our range
                if not record_date:
                    continue
                    
                if record_date < start_date or record_date > end_date:
                    continue
                
                # Parse JSON
                response_json = json.loads(response_json_str)
                
                # Extract usage data
                usage = response_json.get('usage', {})
                completion_tokens = usage.get('completion_tokens', 0)
                prompt_tokens = usage.get('prompt_tokens', 0)
                total_tokens = usage.get('total_tokens', 0)
                cost = usage.get('cost', 0)
                
                # Add to dataset
                data.append({
                    'id': id,
                    'model': model,
                    'date': record_date,
                    'completion_tokens': completion_tokens,
                    'prompt_tokens': prompt_tokens,
                    'total_tokens': total_tokens,
                    'cost': cost
                })
            except json.JSONDecodeError:
                print(f"Failed to parse JSON for ID: {id}")
            except Exception as e:
                print(f"Error processing record {id}: {e}")
        
        conn.close()
        
        print(f"Processed {len(data)} valid records")
        
        # Group by model
        if data:
            df = pd.DataFrame(data)
            
            # Group by model
            model_summary = df.groupby('model').agg({
                'id': 'count',
                'prompt_tokens': 'sum',
                'completion_tokens': 'sum',
                'total_tokens': 'sum',
                'cost': 'sum'
            }).reset_index()
            
            model_summary.columns = ['model', 'requests', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'total_cost']
            
            # Calculate additional metrics
            model_summary['avg_cost_per_request'] = model_summary['total_cost'] / model_summary['requests']
            # Avoid division by zero
            model_summary['cost_per_1k_tokens'] = model_summary.apply(
                lambda row: (row['total_cost'] / row['total_tokens']) * 1000 if row['total_tokens'] > 0 else 0, 
                axis=1
            )
            model_summary = model_summary.fillna(0)  # Replace NaN with 0
            
            # Convert to dictionary for serialization
            result = model_summary.to_dict(orient='records')
            
            # Overall stats
            overall_stats = {
                'total_requests': int(df['id'].count()),
                'total_prompt_tokens': int(df['prompt_tokens'].sum()),
                'total_completion_tokens': int(df['completion_tokens'].sum()),
                'total_tokens': int(df['total_tokens'].sum()),
                'total_cost': float(df['cost'].sum()),
                'avg_cost_per_request': float(df['cost'].mean()) if len(df) > 0 else 0
            }
            
            # Group by date
            if 'date' in df.columns and not df['date'].isna().all():
                date_summary = df.groupby('date').agg({
                    'id': 'count',
                    'prompt_tokens': 'sum',
                    'completion_tokens': 'sum',
                    'total_tokens': 'sum',
                    'cost': 'sum'
                }).reset_index()
                
                date_summary.columns = ['date', 'requests', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'total_cost']
                date_summary = date_summary.sort_values('date')
                
                # Convert to dictionary for serialization
                date_data = date_summary.to_dict(orient='records')
            else:
                date_data = []
            
            return jsonify({
                'model_data': result,
                'overall_stats': overall_stats,
                'date_data': date_data,
                'success': True
            })
        else:
            return jsonify({
                'model_data': [],
                'overall_stats': {
                    'total_requests': 0,
                    'total_prompt_tokens': 0,
                    'total_completion_tokens': 0,
                    'total_tokens': 0,
                    'total_cost': 0,
                    'avg_cost_per_request': 0
                },
                'date_data': [],
                'success': True
            })
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500

# Sample daily data API
@app.route('/api/sample-records', methods=['GET'])
def get_sample_records():
    try:
        # Get filters from request
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        model = request.args.get('model', 'all')
        
        # Validate dates
        if not start_date or not end_date:
            return jsonify({
                'error': 'Start date and end date are required',
                'success': False
            }), 400
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Similar to token-data, pull all records and filter dates in Python
        base_query = """
        SELECT id, model, response_json, datetime_utc
        FROM responses 
        WHERE response_json LIKE '%chat.completion.chunk%'
        """
        
        params = []
        
        if model != 'all':
            base_query += " AND model = ?"
            params.append(model)
        
        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        
        # Process the data
        data = []
        for row in rows:
            id, model, response_json_str, datetime_utc = row
            
            try:
                # Parse date
                record_date = format_date(datetime_utc)
                
                # Skip if date couldn't be parsed or is outside our range
                if not record_date:
                    continue
                    
                if record_date < start_date or record_date > end_date:
                    continue
                
                # Parse JSON
                response_json = json.loads(response_json_str)
                
                # Extract usage data
                usage = response_json.get('usage', {})
                completion_tokens = usage.get('completion_tokens', 0)
                prompt_tokens = usage.get('prompt_tokens', 0)
                total_tokens = usage.get('total_tokens', 0)
                cost = usage.get('cost', 0)
                
                # Format datetime for display
                formatted_dt = datetime_utc
                if '+' in datetime_utc:
                    try:
                        dt = datetime.strptime(datetime_utc.split('+')[0], '%Y-%m-%dT%H:%M:%S.%f')
                        formatted_dt = dt.strftime('%Y-%m-%d %H:%M:%S')
                    except:
                        pass
                
                # Add to dataset
                data.append({
                    'id': id,
                    'model': model,
                    'prompt_tokens': prompt_tokens,
                    'completion_tokens': completion_tokens,
                    'total_tokens': total_tokens,
                    'cost': cost,
                    'datetime': formatted_dt
                })
            except Exception as e:
                print(f"Error processing record {id}: {e}")
        
        conn.close()
        
        # Sort by cost and take top 10
        if data:
            sorted_data = sorted(data, key=lambda x: x['cost'], reverse=True)
            top_data = sorted_data[:10]
            
            return jsonify({
                'records': top_data,
                'success': True
            })
        else:
            return jsonify({
                'records': [],
                'success': True
            })
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500

# Serve the main page
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

# Serve the standalone page
@app.route('/standalone')
def standalone():
    return send_from_directory('standalone', 'index.html')

@app.route('/standalone/<path:filename>')
def standalone_files(filename):
    return send_from_directory('standalone', filename)

# Create a simple fix to update the frontend when model filter changes
@app.route('/js-fix')
def js_fix():
    js_fix_content = """
// Direct script to fix model filtering
document.addEventListener('DOMContentLoaded', function() {
    console.log('Model filtering fix loaded');
    
    const applyFiltersBtn = document.getElementById('applyFilters');
    
    if (applyFiltersBtn) {
        console.log('Apply Filters button found, replacing event handler');
        
        // Clone to remove old handlers
        const newBtn = applyFiltersBtn.cloneNode(true);
        applyFiltersBtn.parentNode.replaceChild(newBtn, applyFiltersBtn);
        
        // Add new handler
        newBtn.addEventListener('click', function() {
            console.log('Apply Filters clicked (fixed handler)');
            
            // Get filters
            const dateRange = $('#dateRangePicker').data('daterangepicker');
            const modelFilter = document.getElementById('modelFilter');
            
            if (dateRange && modelFilter) {
                const startDate = dateRange.startDate.format('YYYY-MM-DD');
                const endDate = dateRange.endDate.format('YYYY-MM-DD');
                const modelValue = modelFilter.value;
                
                console.log('Filters:', { startDate, endDate, model: modelValue });
                
                // Clear all visualizations
                clearVisualizations();
                
                // Load data with new filters
                loadFilteredData(startDate, endDate, modelValue);
            }
        });
    }
    
    function clearVisualizations() {
        // Clear stats
        document.getElementById('totalRequests').textContent = '0';
        document.getElementById('totalTokens').textContent = '0';
        document.getElementById('totalCost').textContent = '$0.00';
        document.getElementById('avgCost').textContent = '$0.00';
        
        // Clear tables
        document.getElementById('tableBody').innerHTML = '';
        document.getElementById('highCostTableBody').innerHTML = '';
        
        // Clear charts
        if (window.tokenUsageChart) {
            window.tokenUsageChart.data.labels = [];
            window.tokenUsageChart.data.datasets[0].data = [];
            window.tokenUsageChart.data.datasets[1].data = [];
            window.tokenUsageChart.update();
        }
        
        if (window.costChart) {
            window.costChart.data.labels = [];
            window.costChart.data.datasets[0].data = [];
            window.costChart.update();
        }
        
        if (window.tokenDistributionChart) {
            window.tokenDistributionChart.data.datasets[0].data = [0, 0];
            window.tokenDistributionChart.update();
        }
        
        if (window.costEfficiencyChart) {
            window.costEfficiencyChart.data.labels = [];
            window.costEfficiencyChart.data.datasets[0].data = [];
            window.costEfficiencyChart.update();
        }
    }
    
    function loadFilteredData(startDate, endDate, model) {
        // Show loading
        document.getElementById('loadingOverlay').style.display = 'flex';
        
        // Load data
        $.ajax({
            url: `/api/token-data?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(model)}`,
            method: 'GET',
            success: function(data) {
                console.log('Data loaded successfully:', data);
                
                if (data.success) {
                    // Update stats
                    document.getElementById('totalRequests').textContent = formatNumber(data.overall_stats.total_requests);
                    document.getElementById('totalTokens').textContent = formatNumber(data.overall_stats.total_tokens);
                    document.getElementById('totalCost').textContent = formatCurrency(data.overall_stats.total_cost);
                    document.getElementById('avgCost').textContent = formatCurrency(data.overall_stats.avg_cost_per_request);
                    
                    // Update charts
                    updateCharts(data);
                    
                    // Update table
                    updateTable(data.model_data);
                    
                    // Load high-cost records
                    loadHighCostRecords(startDate, endDate, model);
                } else {
                    console.error('API returned error:', data.error);
                    hideLoading();
                }
            },
            error: function(xhr, status, error) {
                console.error('API request failed:', error);
                hideLoading();
            }
        });
    }
    
    function loadHighCostRecords(startDate, endDate, model) {
        $.ajax({
            url: `/api/sample-records?start_date=${startDate}&end_date=${endDate}&model=${encodeURIComponent(model)}`,
            method: 'GET',
            success: function(data) {
                hideLoading();
                
                if (data.success) {
                    // Update high-cost table
                    updateHighCostTable(data.records);
                } else {
                    console.error('API returned error:', data.error);
                }
            },
            error: function(xhr, status, error) {
                console.error('High-cost records request failed:', error);
                hideLoading();
            }
        });
    }
    
    function updateCharts(data) {
        // Update token usage chart
        if (window.tokenUsageChart) {
            const models = data.model_data.map(item => {
                const parts = item.model.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.model;
            });
            const promptTokens = data.model_data.map(item => parseInt(item.prompt_tokens) || 0);
            const completionTokens = data.model_data.map(item => parseInt(item.completion_tokens) || 0);
            
            window.tokenUsageChart.data.labels = models;
            window.tokenUsageChart.data.datasets[0].data = promptTokens;
            window.tokenUsageChart.data.datasets[1].data = completionTokens;
            window.tokenUsageChart.update();
        }
        
        // Update cost chart
        if (window.costChart) {
            const models = data.model_data.map(item => {
                const parts = item.model.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.model;
            });
            const costs = data.model_data.map(item => parseFloat(item.total_cost) || 0);
            
            window.costChart.data.labels = models;
            window.costChart.data.datasets[0].data = costs;
            window.costChart.update();
        }
        
        // Update token distribution chart
        if (window.tokenDistributionChart) {
            window.tokenDistributionChart.data.datasets[0].data = [
                parseInt(data.overall_stats.total_prompt_tokens) || 0,
                parseInt(data.overall_stats.total_completion_tokens) || 0
            ];
            window.tokenDistributionChart.update();
        }
        
        // Update cost efficiency chart
        if (window.costEfficiencyChart) {
            const models = data.model_data.map(item => {
                const parts = item.model.split('/');
                return parts.length > 1 ? parts[parts.length - 1] : item.model;
            });
            const costPer1kTokens = data.model_data.map(item => parseFloat(item.cost_per_1k_tokens) || 0);
            
            window.costEfficiencyChart.data.labels = models;
            window.costEfficiencyChart.data.datasets[0].data = costPer1kTokens;
            window.costEfficiencyChart.update();
        }
    }
    
    function updateTable(data) {
        const tableBody = document.getElementById('tableBody');
        
        if (tableBody) {
            tableBody.innerHTML = '';
            
            data.forEach(item => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${item.model}</td>
                    <td>${formatNumber(item.requests)}</td>
                    <td>${formatNumber(item.prompt_tokens)}</td>
                    <td>${formatNumber(item.completion_tokens)}</td>
                    <td>${formatNumber(item.total_tokens)}</td>
                    <td>${formatCurrency(item.total_cost)}</td>
                    <td>${formatCurrency(item.avg_cost_per_request)}</td>
                    <td>${formatCurrency(item.cost_per_1k_tokens)}</td>
                `;
                
                tableBody.appendChild(row);
            });
        }
    }
    
    function updateHighCostTable(data) {
        const highCostTableBody = document.getElementById('highCostTableBody');
        
        if (highCostTableBody) {
            highCostTableBody.innerHTML = '';
            
            data.forEach(item => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${item.id}</td>
                    <td>${item.model}</td>
                    <td>${formatNumber(item.prompt_tokens)}</td>
                    <td>${formatNumber(item.completion_tokens)}</td>
                    <td>${formatNumber(item.total_tokens)}</td>
                    <td>${formatCurrency(item.cost)}</td>
                    <td>${item.datetime}</td>
                `;
                
                highCostTableBody.appendChild(row);
            });
        }
    }
    
    function hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
    
    function formatNumber(num) {
        return new Intl.NumberFormat().format(Math.round(num || 0));
    }
    
    function formatCurrency(num) {
        return '$' + (parseFloat(num) || 0).toFixed(2);
    }
});
    """
    return js_fix_content, 200, {'Content-Type': 'application/javascript'}

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
