
**Core Concept:** Transform the dashboard from a purely *cost/token monitoring* tool into a more holistic *LLM interaction analysis and improvement* platform.

**I. New Feature: Prompt & Response Browser Tab**

*   **Goal:** Allow users to inspect individual LLM interactions (prompts, responses, metadata) easily.
*   **UI:**
    *   A new tab, e.g., "Interaction Browser".
    *   Main view: A filterable, paginated table/list of recent interactions.
    *   Columns: Timestamp, Model, Prompt (truncated), Response (truncated), Total Tokens, Cost, Latency (if available), Feedback Status (icon/link if feedback exists).
    *   Filtering/Search: By date range, model, keywords in prompt/response, min/max tokens, min/max cost, feedback presence/value.
    *   Detail View (when a row is clicked):
        *   Displays the *full* prompt and response content.
        *   **Smart Rendering:**
            *   Detect content type (heuristic based on structure or markers).
            *   Render JSON prettily (collapsible).
            *   Render Markdown as formatted HTML.
            *   Render Code (Python, Shell, JS, etc.) with syntax highlighting (e.g., using `highlight.js` or similar).
            *   Render plain text within `<pre>` tags.
            *   Allow manual selection of renderer if detection fails.
        *   Show all metadata: full timestamp, model, provider (if logged), tokens (prompt, completion, total), cost, latency, session ID (if logged), request ID, associated feedback details (with a link to the Evals tab entry).
*   **Backend:**
    *   New API endpoint (e.g., `/api/interactions`) that queries the `responses` table.
    *   Needs access to the *full prompt and response content*. **Crucially, your current code only extracts `response_json`. You'll need to ensure the `responses` table (or the JSON within it) contains the actual prompt text and the full generated response text.** Let's assume `responses` has `prompt` and `response` columns, or they are within `prompt_json` / `response_json`.
    *   The API should support pagination, filtering (date, model, keywords via `LIKE %...%`), and sorting.
    *   Need logic to fetch the content needed for the detail view based on the interaction ID.
*   **Schema Assumption:** Assumes `responses` table contains columns like `id`, `model`, `prompt` (TEXT), `response` (TEXT), `datetime_utc`, `duration_ms` (INTEGER, optional for latency), `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost`, `request_json` (TEXT, optional, for full request details), `response_json` (TEXT, for metadata/usage). *Your provided `responses` schema seems incorrect (duplicate of `feedback`). You'll need to work with the actual schema.*

**II. New Feature: Evals / Feedback Tab**

*   **Goal:** Analyze human feedback/evaluations provided for LLM responses.
*   **UI:**
    *   A new tab, e.g., "Feedback Analysis".
    *   **Conditional Visibility:** This tab should be greyed out or hidden if the `feedback` table doesn't exist in `logs.db`. Check this on application startup or via a dedicated API endpoint.
    *   **Dashboard:**
        *   Summary Stats: Total feedback entries, distribution of feedback values (e.g., counts/percentages for '👍', '👎', ratings 1-5), average rating.
        *   Charts: Feedback trends over time, feedback distribution per model.
    *   **Feedback Log:**
        *   Filterable, paginated table of feedback entries.
        *   Columns: Feedback Timestamp, Feedback Value, Comment, Model (from joined `responses`), Prompt (truncated, linked), Response (truncated, linked), Original Response Timestamp.
        *   Filtering: By date range, model, feedback value, keywords in comment.
    *   **Detail View / Linking:**
        *   Clicking a feedback entry should prominently display:
            *   The feedback itself (value, comment).
            *   **The associated Prompt and Response content.** This is the key link. Render it using the same "Smart Rendering" as the Prompt Browser.
            *   Metadata of the original response (model, tokens, cost, timestamp).
        *   Clicking the truncated Prompt/Response in the table could jump to the full detail view in the "Interaction Browser" tab, or show a modal.
*   **Backend:**
    *   API endpoint (e.g., `/api/check-feedback-table`) to see if the tab should be enabled.
    *   API endpoint (e.g., `/api/feedback-data`) to fetch aggregated stats and the feedback log.
    *   Requires a `JOIN` between the `feedback` table and the `responses` table on `feedback.response_id = responses.id` (or whatever the foreign key relationship is).
    *   Needs to fetch `prompt`, `response`, `model`, etc., from the `responses` table along with the feedback details.
    *   Handle potential cases where a `response_id` in `feedback` doesn't exist in `responses` (e.g., data cleanup).

**III. Enhancements to Existing Dashboard & Features**

*   **Broader Data Inclusion:**
    *   Modify queries to optionally include logs *other than* `chat.completion.chunk`. Add a filter for log 'type' if that information is available (e.g., 'completion', 'embedding', 'chat'). The current hardcoding `WHERE response_json LIKE '%chat.completion.chunk%'` is very restrictive.
*   **Latency Tracking:**
    *   If response duration is logged (e.g., `duration_ms` column or within JSON), add metrics: Average Latency, p95/p99 Latency per model.
    *   Add latency charts (histogram, trend over time).
*   **Error Tracking:**
    *   If API errors are logged (e.g., a `status` column or error details in `response_json`), add an "Errors" section or tab.
    *   Show error counts by type, model, over time.
    *   Allow browsing error details.
*   **Cost Calculation Flexibility:**
    *   Allow defining custom cost models (e.g., $/1M prompt tokens, $/1M completion tokens) per model in the UI, especially if the logged `cost` is missing or inaccurate. Apply these dynamically for stats.
*   **Improved Filtering UI:**
    *   Make filters (date, model, type) more prominent and apply consistently across relevant tabs.
    *   Consider multi-select for models.
*   **Data Export:**
    *   Add "Export CSV/JSON" buttons for aggregated data tables (model summary, date summary) and potentially for filtered interaction/feedback logs.
*   **UI/UX:**
    *   Use tabs for navigation (Overview, Interaction Browser, Feedback Analysis, Settings?).
    *   Improve loading indicators and error messages.
    *   Ensure mobile responsiveness.

**IV. Backend & Data Improvements**

*   **Robust Date Handling:** Revisit `format_date`. Using `dateutil.parser.parse` might be more robust than manually trying formats. Ensure timezone awareness if relevant. Standardize dates *at the point of logging* if possible.
*   **ORM Usage:** Consider using SQLAlchemy. It simplifies queries (especially JOINs), makes schema management easier, and reduces the risk of SQL injection compared to raw string formatting (though you are using parameterized queries, which is good).
*   **Database Schema Check:** Add checks at startup to verify required tables and columns exist, providing helpful error messages if not.
*   **Configuration:** Move DB path, default date ranges, etc., to a configuration file or environment variables instead of hardcoding.
*   **Refactor Data Fetching:** Consolidate data fetching logic. The `get_token_data` and `get_sample_records` have very similar initial data fetching steps. Refactor this into a shared function that takes filters and returns a Pandas DataFrame or list of dicts, which can then be processed differently by each endpoint.

**Implementation Steps:**

1.  **Verify `responses` Schema:** Get the *actual* schema for the `responses` table. Identify where prompt, full response, latency, and other key fields are stored.
2.  **Backend - Interaction API:** Create the `/api/interactions` endpoint to fetch and filter individual log entries, including prompt/response text.
3.  **Frontend - Interaction Browser Tab:** Build the UI, table, filters, and detail view with smart rendering.
4.  **Backend - Feedback Check & API:** Create endpoints to check for the `feedback` table and fetch joined feedback/response data.
5.  **Frontend - Feedback Tab:** Build the UI, conditional visibility, stats, log table, and detail view linking back to prompts/responses.
6.  **Refactor & Enhance:** Implement other improvements iteratively (latency, errors, broader filtering, UI tweaks, backend cleanup).

By implementing these changes, especially the Interaction Browser and Feedback Analysis tabs with their tight integration, the dashboard will become a much more powerful tool for understanding and improving LLM usage.



**1. Conditional Feedback Tab Check**

*   **Suggestion:** Add an API endpoint to check if the `feedback` table exists. The frontend can then use this to enable/disable the "Feedback Analysis" tab.

*   **Backend Snippet (`app.py`):**
    ```python
    @app.route('/api/check-feedback-feature', methods=['GET'])
    def check_feedback_feature():
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='feedback'")
            table_exists = cursor.fetchone() is not None
            conn.close()
            return jsonify({'feedback_enabled': table_exists})
        except Exception as e:
            if conn:
                conn.close()
            # Log the error properly in a real app
            print(f"Error checking feedback table: {e}", file=sys.stderr)
            return jsonify({'feedback_enabled': False, 'error': str(e)}), 500
    ```

*   **Frontend Snippet (JavaScript):**
    ```javascript
    // In your main JS file, during initialization
    fetch('/api/check-feedback-feature')
        .then(response => response.json())
        .then(data => {
            const feedbackTabLink = document.getElementById('feedbackTabLink'); // Assuming you give your tab link an ID
            if (feedbackTabLink) {
                if (data.feedback_enabled) {
                    feedbackTabLink.classList.remove('disabled'); // Or remove a 'hidden' class
                    feedbackTabLink.setAttribute('aria-disabled', 'false');
                    // Potentially add click listener here if not already present
                } else {
                    feedbackTabLink.classList.add('disabled');
                    feedbackTabLink.setAttribute('aria-disabled', 'true');
                    // Ensure no click listener is active or make it do nothing
                }
            }
        })
        .catch(error => console.error('Error checking feedback feature:', error));
    ```

**2. Interaction Browser API Endpoint**

*   **Suggestion:** Create an endpoint to fetch paginated and filterable interaction logs. *Crucially assumes your `responses` table has `prompt` and `response` text columns (or similar).*

*   **Backend Snippet (`app.py`):**
    ```python
    # Assuming responses table has columns: id, model, datetime_utc, prompt, response, total_tokens, cost, duration_ms
    @app.route('/api/interactions', methods=['GET'])
    def get_interactions():
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        model_filter = request.args.get('model', None)
        search_term = request.args.get('search', None)
        # Add date filters similarly to get_token_data if needed

        offset = (page - 1) * per_page

        base_query = """
        SELECT id, model, datetime_utc,
               substr(prompt, 1, 150) as prompt_snippet,  -- Fetch only snippets for the list view
               substr(response, 1, 150) as response_snippet,
               total_tokens, cost, duration_ms -- Assuming duration_ms exists
        FROM responses
        WHERE 1=1 -- Start WHERE clause
        """
        count_query = "SELECT COUNT(*) FROM responses WHERE 1=1"
        params = []
        count_params = []

        if model_filter and model_filter != 'all':
            base_query += " AND model = ?"
            count_query += " AND model = ?"
            params.append(model_filter)
            count_params.append(model_filter)

        if search_term:
            # Basic search (Consider SQLite FTS5 for performance on large datasets)
            base_query += " AND (prompt LIKE ? OR response LIKE ?)"
            count_query += " AND (prompt LIKE ? OR response LIKE ?)"
            like_term = f"%{search_term}%"
            params.extend([like_term, like_term])
            count_params.extend([like_term, like_term])

        # Add date filtering logic here based on `datetime_utc` if required,
        # using the `format_date` approach or directly if formats are consistent.
        # Remember `format_date` is slow for filtering in DB, better to filter
        # on the raw `datetime_utc` column like:
        # base_query += " AND datetime_utc >= ? AND datetime_utc < ?"
        # params.extend([start_date_str, end_date_next_str])

        base_query += " ORDER BY datetime_utc DESC LIMIT ? OFFSET ?"
        params.extend([per_page, offset])

        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute(count_query, count_params)
            total_items = cursor.fetchone()[0]

            cursor.execute(base_query, params)
            interactions = [dict(row) for row in cursor.fetchall()]

            conn.close()

            return jsonify({
                'interactions': interactions,
                'total_items': total_items,
                'page': page,
                'per_page': per_page,
                'total_pages': (total_items + per_page - 1) // per_page
            })
        except Exception as e:
            # Handle error, close connection if open
            print(f"Error fetching interactions: {e}", file=sys.stderr)
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/interaction/<int:interaction_id>', methods=['GET'])
    def get_interaction_detail(interaction_id):
        # Fetch FULL prompt and response for a single ID
        query = """
        SELECT id, model, datetime_utc, prompt, response, response_json, prompt_json, -- etc
               total_tokens, cost, duration_ms, feedback.* -- Join feedback if needed
        FROM responses
        LEFT JOIN feedback ON responses.id = feedback.response_id -- Adjust join column if needed
        WHERE responses.id = ?
        """
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(query, (interaction_id,))
            interaction = cursor.fetchone()
            conn.close()

            if interaction:
                return jsonify(dict(interaction))
            else:
                return jsonify({'error': 'Interaction not found'}), 404
        except Exception as e:
             print(f"Error fetching interaction detail {interaction_id}: {e}", file=sys.stderr)
             traceback.print_exc()
             return jsonify({'error': str(e)}), 500
    ```

**3. Frontend Smart Rendering Snippet**

*   **Suggestion:** Use JavaScript to detect content type and apply appropriate rendering/syntax highlighting in the detail view modal or page.

*   **Frontend Snippet (JavaScript, inside detail view logic):**
    ```javascript
    function displayInteractionDetail(interaction) {
        const promptContainer = document.getElementById('detailPromptContent');
        const responseContainer = document.getElementById('detailResponseContent');
        const metadataContainer = document.getElementById('detailMetadata'); // Add other elements as needed

        // --- Metadata Display ---
        metadataContainer.innerHTML = `
            <p><strong>Model:</strong> ${interaction.model || 'N/A'}</p>
            <p><strong>Timestamp:</strong> ${interaction.datetime_utc || 'N/A'}</p>
            <p><strong>Tokens:</strong> ${interaction.total_tokens || 'N/A'} (Total)</p>
            <p><strong>Cost:</strong> ${formatCurrency(interaction.cost)}</p>
            <p><strong>Latency:</strong> ${interaction.duration_ms ? interaction.duration_ms + ' ms' : 'N/A'}</p>
            ${interaction.feedback ? `<p><strong>Feedback:</strong> ${interaction.feedback} (${interaction.comment || 'No comment'})</p>` : ''}
        `; // Adapt based on actual fields

        // --- Smart Rendering ---
        renderContent(promptContainer, interaction.prompt || '');
        renderContent(responseContainer, interaction.response || '');

        // --- Show Detail View ---
        // Code to make the modal/detail section visible
    }

    function renderContent(container, content) {
        container.innerHTML = ''; // Clear previous content
        const pre = document.createElement('pre');
        const code = document.createElement('code');

        // Basic JSON detection
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            try {
                const jsonObj = JSON.parse(content);
                code.textContent = JSON.stringify(jsonObj, null, 2);
                code.className = 'language-json'; // For highlight.js
                pre.appendChild(code);
                container.appendChild(pre);
                hljs.highlightElement(code); // Apply highlighting if using highlight.js
                return;
            } catch (e) { /* Not valid JSON, fallback */ }
        }

        // Basic Markdown detection (very simple)
        // Use a library like 'marked.js' for robust parsing
        // if (content.includes('\n## ') || content.includes('\n* ') || content.includes('\n- ')) {
        //    container.innerHTML = marked.parse(content); // If using marked.js library
        //    return;
        // }

        // Basic Code detection (e.g., Python - simplistic)
        if (content.includes('def ') || content.includes('import ') || content.includes('class ')) {
             code.textContent = content;
             code.className = 'language-python'; // For highlight.js
             pre.appendChild(code);
             container.appendChild(pre);
             hljs.highlightElement(code);
             return;
        }
        
        // Basic Shell detection
        if (content.trim().startsWith('#!/') || content.includes(' && ') || content.includes(' | ')) {
             code.textContent = content;
             code.className = 'language-shell'; // For highlight.js
             pre.appendChild(code);
             container.appendChild(pre);
             hljs.highlightElement(code);
             return;
        }


        // Default to plain text
        code.textContent = content;
        code.className = 'language-plaintext';
        pre.appendChild(code);
        container.appendChild(pre);
        // Apply basic styling or highlight as plaintext
        // hljs.highlightElement(code); // Optionally highlight plaintext too
    }

    // Example Helper (you already have similar ones)
    function formatCurrency(num) {
        return '$' + (parseFloat(num) || 0).toFixed(4); // Show more precision for potential low costs
    }

    // Make sure to include highlight.js library and its CSS
    // <link rel="stylesheet" href="/path/to/styles/default.min.css">
    // <script src="/path/to/highlight.min.js"></script>
    // <script>hljs.highlightAll();</script> // Or call highlightElement as needed
    ```

**4. Feedback API with Prompt/Response Linking**

*   **Suggestion:** Modify the feedback API to `JOIN` with `responses` and include relevant context.

*   **Backend Snippet (`app.py`):**
    ```python
    @app.route('/api/feedback-data', methods=['GET'])
    def get_feedback_data():
        # Add filters: date range, feedback value, model, etc.
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        # Add other filters as needed

        query = """
        SELECT
            f.id as feedback_id,
            f.response_id,
            f.datetime_utc as feedback_timestamp,
            f.feedback,
            f.comment,
            r.model,
            r.datetime_utc as response_timestamp,
            substr(r.prompt, 1, 100) as prompt_snippet, -- Snippets for list view
            substr(r.response, 1, 100) as response_snippet
        FROM feedback f
        JOIN responses r ON f.response_id = r.id -- Ensure 'r.id' is the correct PK for responses
        WHERE 1=1
        """
        params = []

        # Add date range filtering on f.datetime_utc or r.datetime_utc as needed
        # Example filtering feedback timestamp:
        # if start_date and end_date:
        #     query += " AND f.datetime_utc >= ? AND f.datetime_utc < ?"
        #     try:
        #          end_date_obj = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        #          end_date_next = end_date_obj.strftime('%Y-%m-%d')
        #          params.extend([start_date, end_date_next])
        #     except ValueError:
        #         return jsonify({'error': 'Invalid date format'}), 400

        query += " ORDER BY f.datetime_utc DESC"
        # Add LIMIT/OFFSET for pagination if expecting many feedback entries

        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute(query, params)
            feedback_items = [dict(row) for row in cursor.fetchall()]
            conn.close()

            # Calculate summary stats (distribution, counts) here if needed
            # feedback_summary = calculate_feedback_summary(feedback_items)

            return jsonify({
                'feedback_log': feedback_items,
                # 'summary': feedback_summary
            })
        except Exception as e:
            print(f"Error fetching feedback data: {e}", file=sys.stderr)
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
    ```

**5. Track Latency**

*   **Suggestion:** If `duration_ms` (or similar) exists in `responses`, add it to the data aggregation and display.

*   **Backend Snippet (Modify `get_token_data`):**
    ```python
    # Inside the loop processing rows in get_token_data
    # ... after parsing JSON ...
    duration_ms = response_json.get('duration_ms', None) # Or get from a direct column if available
    # Also fetch it from the DB if it's a direct column

    # Add to the data list
    data.append({
        'id': id,
        'model': model,
        'date': record_date,
        'completion_tokens': completion_tokens,
        'prompt_tokens': prompt_tokens,
        'total_tokens': total_tokens,
        'cost': cost,
        'duration_ms': duration_ms # Add latency
    })

    # ... later, when creating the Pandas DataFrame ...
    if data:
        df = pd.DataFrame(data)
        # Convert duration to numeric, coercing errors to NaN
        df['duration_ms'] = pd.to_numeric(df['duration_ms'], errors='coerce')

        # Group by model
        model_summary = df.groupby('model').agg({
            'id': 'count',
            'prompt_tokens': 'sum',
            'completion_tokens': 'sum',
            'total_tokens': 'sum',
            'cost': 'sum',
            'duration_ms': ['mean', 'median', lambda x: x.quantile(0.95)] # Add aggregations
        }).reset_index()

        # Flatten multi-index columns and rename
        model_summary.columns = [
            'model', 'requests', 'prompt_tokens', 'completion_tokens',
            'total_tokens', 'total_cost', 'avg_latency_ms', 'median_latency_ms', 'p95_latency_ms'
        ]

        # Add to overall stats
        overall_stats = {
             # ... other stats ...
             'avg_latency_ms': float(df['duration_ms'].mean()) if not df['duration_ms'].isnull().all() else 0,
             'median_latency_ms': float(df['duration_ms'].median()) if not df['duration_ms'].isnull().all() else 0,
             'p95_latency_ms': float(df['duration_ms'].quantile(0.95)) if not df['duration_ms'].isnull().all() else 0
        }

        # ... rest of the function ...
    ```
*   **Frontend:** Update tables and potentially add new charts (e.g., a bar chart for P95 latency per model) to display this data.