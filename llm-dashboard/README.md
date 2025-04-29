# LLM Dashboard

A dynamic web application for analyzing and visualizing token usage and costs from your LLM API calls. This application connects directly to your LLM logs database and provides interactive visualizations and filtering options.

## Features

- **Dynamic Date Range Selection**: Choose any date range to analyze
- **Model Filtering**: Filter data by specific models
- **Interactive Visualizations**:
  - Daily usage trends (tokens, costs, requests)
  - Token distribution by model
  - Cost analysis
  - Token type breakdown (prompt vs. completion)
  - Cost efficiency comparison
- **High-Cost Request Analysis**: View your most expensive API calls
- **Responsive Design**: Works on desktop and mobile

## Setup

### Prerequisites

- Python 3.7+
- Flask
- pandas
- SQLite database with LLM logs

### Installation

1. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install required packages:
   ```bash
   pip install flask pandas
   ```

3. Update the database path:
   Open `app.py` and update the `DB_PATH` variable if your SQLite database is in a different location.

### Running the Application

1. Start the Flask server:
   ```bash
   python app.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Database Requirements

The analyzer expects the following in your SQLite database:
- A table called `responses`
- Columns including: `id`, `model`, `response_json`, `datetime_utc`
- `response_json` should contain token usage data in a format similar to:
  ```json
  {
    "usage": {
      "completion_tokens": 121,
      "prompt_tokens": 143216,
      "total_tokens": 143337,
      "cost": 0.070062
    }
  }
  ```

## Customization

- To modify the visualization style, edit the CSS in the `static/index.html` file
- To add new chart types, add new Chart.js instances in the JavaScript section

## Security Note

This application is designed for local use only. If you intend to deploy it publicly, make sure to:
1. Implement proper authentication
2. Use a production-ready server instead of Flask's development server
3. Consider sanitizing any sensitive information in your database
