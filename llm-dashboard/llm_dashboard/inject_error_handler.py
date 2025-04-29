#!/usr/bin/env python3

with open('static/index.html', 'r') as f:
    html_content = f.read()

with open('static/error-handler.js', 'r') as f:
    error_handler = f.read()

# Replace existing function definitions with the new ones
html_content = html_content.replace('function initDateRangePicker() {', '// Original initDateRangePicker replaced\nasync function initDateRangePicker() {')
html_content = html_content.replace('function loadModels() {', '// Original loadModels replaced\nasync function loadModels() {')
html_content = html_content.replace('function loadData() {', '// Original loadData replaced\nasync function loadData() {')
html_content = html_content.replace('function loadHighCostRecords() {', '// Original loadHighCostRecords replaced\nasync function loadHighCostRecords() {')

# Add new error handler functions before the end of the body
insert_position = html_content.find('</body>')
new_html = html_content[:insert_position] + '\n<script>\n' + error_handler + '\n</script>\n' + html_content[insert_position:]

with open('static/index.html', 'w') as f:
    f.write(new_html)

print("Error handler successfully injected into index.html")
