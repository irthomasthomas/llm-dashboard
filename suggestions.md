# LLM Logs Dashboard Analysis and Improvement Suggestions

## Improvement Suggestions

### 1. LLM Evaluation Dashboard

Add a tab that displays evaluation data from the `feedback` table:

```python
@app.route('/api/feedback-available', methods=['GET'])
def check_feedback_available():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if feedback table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
        has_feedback_table = cursor.fetchone() is not None
        
        conn.close()
        
        return jsonify({
            'has_feedback': has_feedback_table,
            'success': True
        })
    except Exception as e:
        return jsonify({
            'error': str(e),
            'has_feedback': False,
            'success': False
        }), 500
```

Add an endpoint to fetch evaluation data:

```python
@app.route('/api/evaluations', methods=['GET'])
def get_evaluations():
    try:
        # Get filters from request
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        feedback_type = request.args.get('feedback_type', 'all')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if feedback table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
        if not cursor.fetchone():
            return jsonify({
                'error': 'Feedback table does not exist',
                'success': False
            }), 404
            
        # Build query
        base_query = """
        SELECT f.id, f.response_id, f.datetime_utc, f.feedback, f.comment,
               r.model, r.response_json
        FROM feedback f
        LEFT JOIN responses r ON f.response_id = r.id
        """
        
        params = []
        where_clauses = []
        
        if start_date:
            where_clauses.append("f.datetime_utc >= ?")
            params.append(start_date)
        
        if end_date:
            where_clauses.append("f.datetime_utc <= ?")
            params.append(end_date)
            
        if feedback_type != 'all':
            where_clauses.append("f.feedback = ?")
            params.append(feedback_type)
            
        if where_clauses:
            base_query += " WHERE " + " AND ".join(where_clauses)
            
        base_query += " ORDER BY f.datetime_utc DESC"
        
        cursor.execute(base_query, params)
        rows = cursor.fetchall()
        
        # Process data
        evaluations = []
        for row in rows:
            id, response_id, datetime_utc, feedback, comment, model, response_json = row
            
            # Extract relevant parts of response_json if needed
            try:
                response_data = json.loads(response_json) if response_json else {}
                prompt = response_data.get('prompt', '')
                completion = response_data.get('response', '')
                usage = response_data.get('usage', {})
                
                evaluations.append({
                    'id': id,
                    'response_id': response_id,
                    'datetime': datetime_utc,
                    'feedback': feedback,
                    'comment': comment,
                    'model': model,
                    'prompt_summary': prompt[:100] + "..." if len(prompt) > 100 else prompt,
                    'tokens': usage.get('total_tokens', 0),
                    'cost': usage.get('cost', 0)
                })
                
            except Exception as e:
                print(f"Error processing evaluation {id}: {e}")
                # Include partial data
                evaluations.append({
                    'id': id,
                    'response_id': response_id,
                    'datetime': datetime_utc,
                    'feedback': feedback,
                    'comment': comment,
                    'model': model,
                    'error': str(e)
                })
                
        conn.close()
        
        return jsonify({
            'evaluations': evaluations,
            'success': True
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500
```

### 2. Advanced Prompt Browser with Formatting Options

```python
@app.route('/api/prompt-response-detail/<response_id>', methods=['GET'])
def get_prompt_response_detail(response_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the response data
        cursor.execute("SELECT id, model, response_json, datetime_utc FROM responses WHERE id = ?", [response_id])
        row = cursor.fetchone()
        
        if not row:
            return jsonify({
                'error': 'Response not found',
                'success': False
            }), 404
            
        id, model, response_json_str, datetime_utc = row
        
        # Get any feedback for this response
        has_feedback_table = False
        feedback_data = None
        
        # Check if feedback table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
        if cursor.fetchone():
            has_feedback_table = True
            cursor.execute("SELECT id, feedback, comment, datetime_utc FROM feedback WHERE response_id = ?", [id])
            feedback_row = cursor.fetchone()
            
            if feedback_row:
                feedback_id, feedback, comment, feedback_datetime = feedback_row
                feedback_data = {
                    'id': feedback_id,
                    'type': feedback,
                    'comment': comment,
                    'datetime': feedback_datetime
                }
        
        # Parse response JSON
        try:
            response_data = json.loads(response_json_str)
            
            # Extract content based on response structure
            prompt = response_data.get('prompt', '')
            completion = response_data.get('completion', '')
            
            # Handle different response formats
            if 'choices' in response_data and len(response_data['choices']) > 0:
                choice = response_data['choices'][0]
                if 'message' in choice and 'content' in choice['message']:
                    completion = choice['message']['content']
            
            usage = response_data.get('usage', {})
            
            # Prepare formats for display
            result = {
                'id': id,
                'model': model,
                'datetime': datetime_utc,
                'prompt': prompt,
                'completion': completion,
                'usage': usage,
                'has_feedback': has_feedback_table,
                'feedback': feedback_data,
                'raw_json': response_json_str,
                'success': True
            }
            
            conn.close()
            return jsonify(result)
            
        except json.JSONDecodeError:
            conn.close()
            return jsonify({
                'id': id,
                'model': model,
                'datetime': datetime_utc,
                'raw_json': response_json_str,
                'error': 'Failed to parse response JSON',
                'has_feedback': has_feedback_table,
                'feedback': feedback_data,
                'success': False
            })
            
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500
```

### 3. Prompt Analytics Dashboard

Add an endpoint to analyze prompt patterns and effectiveness:

```python
@app.route('/api/prompt-analytics', methods=['GET'])
def get_prompt_analytics():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get prompts and their performance metrics
        query = """
        SELECT r.id, r.model, r.response_json, r.datetime_utc,
               f.feedback
        FROM responses r
        LEFT JOIN feedback f ON r.id = f.response_id
        WHERE r.datetime_utc BETWEEN ? AND ?
        """
        
        cursor.execute(query, [start_date, end_date])
        rows = cursor.fetchall()
        
        # Analyze prompts
        prompt_lengths = []
        prompt_patterns = {}
        model_effectiveness = {}
        
        for row in rows:
            id, model, response_json_str, datetime_utc, feedback = row
            
            try:
                response_data = json.loads(response_json_str)
                prompt = response_data.get('prompt', '')
                
                # Analyze length
                prompt_length = len(prompt)
                prompt_lengths.append(prompt_length)
                
                # Analyze structure patterns (simple examples)
                has_context = "context:" in prompt.lower()
                has_examples = "example" in prompt.lower()
                has_steps = any(word in prompt.lower() for word in ["step", "steps", "procedure", "instructions"])
                
                pattern_key = f"context:{has_context}_examples:{has_examples}_steps:{has_steps}"
                prompt_patterns[pattern_key] = prompt_patterns.get(pattern_key, 0) + 1
                
                # Analyze effectiveness by model
                if model not in model_effectiveness:
                    model_effectiveness[model] = {
                        'count': 0,
                        'positive_feedback': 0,
                        'negative_feedback': 0,
                        'no_feedback': 0,
                        'avg_tokens': 0,
                        'total_tokens': 0
                    }
                
                model_effectiveness[model]['count'] += 1
                
                if feedback == 'positive':
                    model_effectiveness[model]['positive_feedback'] += 1
                elif feedback == 'negative':
                    model_effectiveness[model]['negative_feedback'] += 1
                else:
                    model_effectiveness[model]['no_feedback'] += 1
                    
                # Add token usage
                usage = response_data.get('usage', {})
                tokens = usage.get('total_tokens', 0)
                model_effectiveness[model]['total_tokens'] += tokens
                
            except Exception as e:
                print(f"Error analyzing prompt {id}: {e}")
        
        # Calculate averages
        for model in model_effectiveness:
            if model_effectiveness[model]['count'] > 0:
                model_effectiveness[model]['avg_tokens'] = model_effectiveness[model]['total_tokens'] / model_effectiveness[model]['count']
        
        # Calculate prompt length statistics
        prompt_length_stats = {
            'min': min(prompt_lengths) if prompt_lengths else 0,
            'max': max(prompt_lengths) if prompt_lengths else 0,
            'avg': sum(prompt_lengths) / len(prompt_lengths) if prompt_lengths else 0,
            'distribution': {}
        }
        
        # Create length buckets
        buckets = [0, 100, 500, 1000, 2000, 5000, float('inf')]
        bucket_names = ['0-100', '101-500', '501-1000', '1001-2000', '2001-5000', '5000+']
        
        for i in range(len(bucket_names)):
            prompt_length_stats['distribution'][bucket_names[i]] = 0
            
        for length in prompt_lengths:
            for i in range(len(buckets) - 1):
                if buckets[i] <= length < buckets[i+1]:
                    prompt_length_stats['distribution'][bucket_names[i]] += 1
                    break
        
        conn.close()
        
        return jsonify({
            'prompt_length_stats': prompt_length_stats,
            'prompt_patterns': prompt_patterns,
            'model_effectiveness': model_effectiveness,
            'success': True
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500
```

### 4. Model Comparison Tool

Add an endpoint that compares different models:

```python
@app.route('/api/model-comparison', methods=['GET'])
def get_model_comparison():
    try:
        model1 = request.args.get('model1')
        model2 = request.args.get('model2')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not model1 or not model2:
            return jsonify({
                'error': 'Two models must be specified',
                'success': False
            }), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get data for both models
        model_data = {}
        
        for model in [model1, model2]:
            query = """
            SELECT r.id, r.response_json, r.datetime_utc,
                   f.feedback
            FROM responses r
            LEFT JOIN feedback f ON r.id = f.response_id
            WHERE r.model = ? AND r.datetime_utc BETWEEN ? AND ?
            """
            
            cursor.execute(query, [model, start_date, end_date])
            rows = cursor.fetchall()
            
            # Initialize model statistics
            model_data[model] = {
                'request_count': len(rows),
                'total_tokens': 0,
                'prompt_tokens': 0,
                'completion_tokens': 0,
                'total_cost': 0,
                'positive_feedback': 0,
                'negative_feedback': 0,
                'feedback_rate': 0,
                'avg_response_time': 0,
                'avg_tokens_per_request': 0,
                'avg_cost_per_request': 0,
                'cost_per_1k_tokens': 0,
                'avg_prompt_length': 0,
                'avg_completion_length': 0
            }
            
            total_prompt_length = 0
            total_completion_length = 0
            
            # Process each row
            for row in rows:
                id, response_json_str, datetime_utc, feedback = row
                
                try:
                    response_data = json.loads(response_json_str)
                    
                    # Extract data
                    prompt = response_data.get('prompt', '')
                    completion = response_data.get('completion', '')
                    
                    # Handle different response formats
                    if 'choices' in response_data and len(response_data['choices']) > 0:
                        choice = response_data['choices'][0]
                        if 'message' in choice and 'content' in choice['message']:
                            completion = choice['message']['content']
                    
                    usage = response_data.get('usage', {})
                    
                    # Accumulate metrics
                    model_data[model]['total_tokens'] += usage.get('total_tokens', 0)
                    model_data[model]['prompt_tokens'] += usage.get('prompt_tokens', 0)
                    model_data[model]['completion_tokens'] += usage.get('completion_tokens', 0)
                    model_data[model]['total_cost'] += usage.get('cost', 0)
                    
                    total_prompt_length += len(prompt)
                    total_completion_length += len(completion)
                    
                    # Count feedback
                    if feedback == 'positive':
                        model_data[model]['positive_feedback'] += 1
                    elif feedback == 'negative':
                        model_data[model]['negative_feedback'] += 1
                    
                except Exception as e:
                    print(f"Error processing record {id}: {e}")
            
            # Calculate derived metrics
            if model_data[model]['request_count'] > 0:
                model_data[model]['avg_tokens_per_request'] = model_data[model]['total_tokens'] / model_data[model]['request_count']
                model_data[model]['avg_cost_per_request'] = model_data[model]['total_cost'] / model_data[model]['request_count']
                model_data[model]['avg_prompt_length'] = total_prompt_length / model_data[model]['request_count']
                model_data[model]['avg_completion_length'] = total_completion_length / model_data[model]['request_count']
                
                total_feedback = model_data[model]['positive_feedback'] + model_data[model]['negative_feedback']
                model_data[model]['feedback_rate'] = total_feedback / model_data[model]['request_count']
                
            if model_data[model]['total_tokens'] > 0:
                model_data[model]['cost_per_1k_tokens'] = (model_data[model]['total_cost'] / model_data[model]['total_tokens']) * 1000
        
        conn.close()
        
        # Calculate comparative metrics
        if model_data[model1]['request_count'] > 0 and model_data[model2]['request_count'] > 0:
            comparison = {
                'cost_difference_percent': ((model_data[model2]['avg_cost_per_request'] - model_data[model1]['avg_cost_per_request']) / model_data[model1]['avg_cost_per_request']) * 100 if model_data[model1]['avg_cost_per_request'] > 0 else 0,
                'tokens_difference_percent': ((model_data[model2]['avg_tokens_per_request'] - model_data[model1]['avg_tokens_per_request']) / model_data[model1]['avg_tokens_per_request']) * 100 if model_data[model1]['avg_tokens_per_request'] > 0 else 0,
                'efficiency_ratio': (model_data[model1]['cost_per_1k_tokens'] / model_data[model2]['cost_per_1k_tokens']) if model_data[model2]['cost_per_1k_tokens'] > 0 else 0,
                'feedback_comparison': (model_data[model2]['positive_feedback'] / max(1, model_data[model2]['request_count'])) - (model_data[model1]['positive_feedback'] / max(1, model_data[model1]['request_count']))
            }
        else:
            comparison = {
                'error': 'Not enough data for one or both models'
            }
            
        return jsonify({
            'model_data': model_data,
            'comparison': comparison,
            'success': True
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500
```

### 5. Interactive Prompt Template Builder

Add a feature to create and test prompt templates based on successful prompts:

```python
@app.route('/api/successful-prompts', methods=['GET'])
def get_successful_prompts():
    try:
        # Get top successful prompts based on feedback
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if feedback table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
        has_feedback = cursor.fetchone() is not None
        
        if has_feedback:
            # Get prompts with positive feedback
            query = """
            SELECT r.id, r.model, r.response_json, r.datetime_utc,
                   f.feedback, f.comment
            FROM responses r
            JOIN feedback f ON r.id = f.response_id
            WHERE f.feedback = 'positive'
            ORDER BY r.datetime_utc DESC
            LIMIT 10
            """
            
            cursor.execute(query)
        else:
            # Without feedback table, get prompts with lowest token usage
            query = """
            SELECT r.id, r.model, r.response_json, r.datetime_utc
            FROM responses r
            WHERE r.response_json LIKE '%total_tokens%'
            ORDER BY r.datetime_utc DESC
            LIMIT 10
            """
            
            cursor.execute(query)
            
        rows = cursor.fetchall()
        
        # Process prompts
        successful_prompts = []
        for row in rows:
            if has_feedback:
                id, model, response_json_str, datetime_utc, feedback, comment = row
            else:
                id, model, response_json_str, datetime_utc = row
                feedback, comment = None, None
                
            try:
                response_data = json.loads(response_json_str)
                prompt = response_data.get('prompt', '')
                
                # Extract template structure
                template_structure = extract_template_structure(prompt)
                
                successful_prompts.append({
                    'id': id,
                    'model': model,
                    'datetime': datetime_utc,
                    'prompt_preview': prompt[:200] + "..." if len(prompt) > 200 else prompt,
                    'template_structure': template_structure,
                    'feedback': feedback,
                    'comment': comment
                })
                
            except Exception as e:
                print(f"Error processing prompt {id}: {e}")
        
        conn.close()
        
        return jsonify({
            'successful_prompts': successful_prompts,
            'has_feedback': has_feedback,
            'success': True
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500

def extract_template_structure(prompt):
    # Simple template structure extraction
    sections = []
    
    # Look for common patterns
    if "Context:" in prompt:
        sections.append("Context")
    if "Instructions:" in prompt:
        sections.append("Instructions")
    if "Example" in prompt:
        sections.append("Examples")
    if "Format:" in prompt or "Output format:" in prompt:
        sections.append("Output Format")
    if "Question:" in prompt:
        sections.append("Question")
    
    # If none found, try to split by newlines and identify potential sections
    if not sections:
        lines = prompt.split('\n')
        current_section = None
        for line in lines:
            line = line.strip()
            if line and line.endswith(':'):
                potential_section = line[:-1].strip()
                if len(potential_section.split()) <= 3:  # Likely a section header
                    sections.append(potential_section)
    
    return sections
```

### 6. Cost Optimization Recommendations

Add a feature that analyzes usage patterns and provides cost-saving recommendations:

```python
@app.route('/api/cost-recommendations', methods=['GET'])
def get_cost_recommendations():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get token and cost data by model
        query = """
        SELECT model, response_json
        FROM responses
        WHERE response_json LIKE '%usage%' AND response_json LIKE '%cost%'
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Process data
        model_data = {}
        for row in rows:
            model, response_json_str = row
            
            try:
                response_data = json.loads(response_json_str)
                usage = response_data.get('usage', {})
                
                if model not in model_data:
                    model_data[model] = {
                        'count': 0,
                        'total_tokens': 0,
                        'prompt_tokens': 0,
                        'completion_tokens': 0,
                        'total_cost': 0,
                        'prompt_ratio': 0,
                        'completion_ratio': 0
                    }
                
                model_data[model]['count'] += 1
                model_data[model]['total_tokens'] += usage.get('total_tokens', 0)
                model_data[model]['prompt_tokens'] += usage.get('prompt_tokens', 0)
                model_data[model]['completion_tokens'] += usage.get('completion_tokens', 0)
                model_data[model]['total_cost'] += usage.get('cost', 0)
                
            except Exception as e:
                print(f"Error processing record for model {model}: {e}")
        
        # Calculate ratios and per-token costs
        for model in model_data:
            if model_data[model]['total_tokens'] > 0:
                model_data[model]['prompt_ratio'] = model_data[model]['prompt_tokens'] / model_data[model]['total_tokens']
                model_data[model]['completion_ratio'] = model_data[model]['completion_tokens'] / model_data[model]['total_tokens']
                
                model_data[model]['cost_per_1k_tokens'] = (model_data[model]['total_cost'] / model_data[model]['total_tokens']) * 1000
                
                if model_data[model]['prompt_tokens'] > 0:
                    model_data[model]['prompt_cost_per_1k'] = (model_data[model]['total_cost'] * model_data[model]['prompt_ratio'] / model_data[model]['prompt_tokens']) * 1000
                
                if model_data[model]['completion_tokens'] > 0:
                    model_data[model]['completion_cost_per_1k'] = (model_data[model]['total_cost'] * model_data[model]['completion_ratio'] / model_data[model]['completion_tokens']) * 1000
        
        # Generate recommendations
        recommendations = []
        
        # 1. Check for high prompt-to-completion ratios
        for model in model_data:
            if model_data[model]['prompt_ratio'] > 0.8 and model_data[model]['total_tokens'] > 1000:
                recommendations.append({
                    'type': 'high_prompt_ratio',
                    'model': model,
                    'ratio': model_data[model]['prompt_ratio'],
                    'message': f"High prompt-to-completion ratio ({model_data[model]['prompt_ratio']:.2f}) for {model}. Consider caching results or using embeddings for frequently used context."
                })
        
        # 2. Find potential model downgrades
        models_by_cost = sorted(model_data.keys(), key=lambda m: model_data[m]['cost_per_1k_tokens'])
        for i in range(len(models_by_cost)-1):
            cheaper_model = models_by_cost[i]
            expensive_model = models_by_cost[i+1]
            
            cost_diff = model_data[expensive_model]['cost_per_1k_tokens'] - model_data[cheaper_model]['cost_per_1k_tokens']
            
            if cost_diff > 1.0 and model_data[expensive_model]['count'] > 10:  # Significant difference
                potential_savings = (model_data[expensive_model]['total_tokens'] / 1000) * cost_diff
                
                recommendations.append({
                    'type': 'model_downgrade',
                    'expensive_model': expensive_model,
                    'cheaper_model': cheaper_model,
                    'cost_difference_per_1k': cost_diff,
                    'potential_savings': potential_savings,
                    'message': f"Consider testing {cheaper_model} as a replacement for {expensive_model}. Potential savings: ${potential_savings:.2f}"
                })
        
        # 3. Check for increasing token usage trends
        if len(model_data) > 0:
            # Get token usage over time
            query = """
            SELECT date(datetime_utc) as day, sum(json_extract(response_json, '$.usage.total_tokens')) as daily_tokens
            FROM responses
            WHERE response_json LIKE '%usage%' AND response_json LIKE '%total_tokens%'
            GROUP BY day
            ORDER BY day DESC
            LIMIT 30
            """
            
            cursor.execute(query)
            rows = cursor.fetchall()
            
            days = []
            tokens = []
            for row in rows:
                day, token_count = row
                days.append(day)
                tokens.append(token_count)
            
            # Check if there's a significant increase in the last week
            if len(tokens) >= 7:
                last_week_avg = sum(tokens[:7]) / 7
                previous_week_avg = sum(tokens[7:14]) / 7 if len(tokens) >= 14 else None
                
                if previous_week_avg and last_week_avg > previous_week_avg * 1.3:  # 30% increase
                    recommendations.append({
                        'type': 'increasing_usage',
                        'last_week_avg': last_week_avg,
                        'previous_week_avg': previous_week_avg,
                        'percent_increase': ((last_week_avg / previous_week_avg) - 1) * 100,
                        'message': f"Token usage has increased by {((last_week_avg / previous_week_avg) - 1) * 100:.1f}% in the last week. Review recent changes that might have increased verbosity."
                    })
        
        conn.close()
        
        return jsonify({
            'model_data': model_data,
            'recommendations': recommendations,
            'success': True
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }), 500
```

### 7. Centralized Frontend Improvements

1. Reorganize the `static/index.html` file to include tabbed navigation:

```html
<div class="container mt-4">
  <ul class="nav nav-tabs" id="mainTabs" role="tablist">
    <li class="nav-item">
      <a class="nav-link active" id="dashboard-tab" data-toggle="tab" href="#dashboard" role="tab">Token Usage Dashboard</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" id="models-tab" data-toggle="tab" href="#models" role="tab">Model Comparison</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" id="prompts-tab" data-toggle="tab" href="#prompts" role="tab">Prompt Browser</a>
    </li>
    <li class="nav-item" id="evaluations-tab-container">
      <a class="nav-link" id="evaluations-tab" data-toggle="tab" href="#evaluations" role="tab">Evaluations</a>
    </li>
    <li class="nav-item">
      <a class="nav-link" id="optimize-tab" data-toggle="tab" href="#optimize" role="tab">Cost Optimization</a>
    </li>
  </ul>
  
  <div class="tab-content" id="mainTabsContent">
    <!-- Original dashboard content -->
    <div class="tab-pane fade show active" id="dashboard" role="tabpanel">
      <!-- Existing dashboard content here -->
    </div>
    
    <!-- Model comparison tab -->
    <div class="tab-pane fade" id="models" role="tabpanel">
      <!-- Model comparison UI -->
    </div>
    
    <!-- Prompt browser tab -->
    <div class="tab-pane fade" id="prompts" role="tabpanel">
      <!-- Prompt browser UI -->
    </div>
    
    <!-- Evaluations tab -->
    <div class="tab-pane fade" id="evaluations" role="tabpanel">
      <!-- Evaluations UI -->
    </div>
    
    <!-- Cost optimization tab -->
    <div class="tab-pane fade" id="optimize" role="tabpanel">
      <!-- Cost optimization UI -->
    </div>
  </div>
</div>
```

2. Add JavaScript to check for and enable the evaluations tab only if feedback data is available:

```javascript
// Check if feedback data is available
async function checkFeedbackAvailable() {
  try {
    const response = await fetch('/api/feedback-available');
    const data = await response.json();
    
    const evaluationsTab = document.getElementById('evaluations-tab');
    const evaluationsTabContainer = document.getElementById('evaluations-tab-container');
    
    if (data.success && data.has_feedback) {
      evaluationsTab.classList.remove('disabled');
      evaluationsTabContainer.setAttribute('title', 'Evaluation data available');
    } else {
      evaluationsTab.classList.add('disabled');
      evaluationsTabContainer.setAttribute('title', 'No evaluation data available');
      
      // Add a badge to indicate it's unavailable
      const badge = document.createElement('span');
      badge.className = 'badge badge-secondary ml-1';
      badge.textContent = 'Unavailable';
      evaluationsTab.appendChild(badge);
    }
  } catch (error) {
    console.error('Error checking for feedback availability:', error);
  }
}

// Call when page loads
document.addEventListener('DOMContentLoaded', function() {
  checkFeedbackAvailable();
});
```

## Overall Architecture Improvements

1. **Refactor Backend**: Split app.py into multiple modules for better organization:
   - `models.py` for database models and queries
   - `routes.py` for API endpoints
   - `utils.py` for utility functions
   - `analysis.py` for data analysis functions

2. **Error Handling**: Replace the various injection scripts with proper error handling and code organization.

3. **Documentation**: Add comprehensive documentation to explain the purpose of each file and API endpoint, including example requests and responses.

4. **Testing**: Enhance test coverage using test_api.py as a foundation, but add more comprehensive test cases.

5. **Docker Support**: Add a Dockerfile and docker-compose.yml to simplify deployment across different environments.

6. **User Preferences**: Add a system to save user preferences (like default date ranges, preferred view) to localStorage.

7. **Export Functionality**: Add the ability to export data in CSV or Excel format for further analysis.

These improvements would make the dashboard more comprehensive, providing not just token usage data but also insights into prompt quality, model effectiveness, and cost optimization opportunities.
