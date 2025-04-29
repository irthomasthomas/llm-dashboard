#!/usr/bin/env python3
import re

# Read the current index.html
with open('static/index.html', 'r') as f:
    html_content = f.read()

# Check if we need to add the script (avoid duplicate additions)
if '<script src="model-filter-fix.js">' not in html_content:
    # Add the script reference before the closing body tag
    insert_position = html_content.find('</body>')
    updated_html = html_content[:insert_position] + '\n<script src="model-filter-fix.js"></script>\n' + html_content[insert_position:]
    
    # Write the updated HTML
    with open('static/index.html', 'w') as f:
        f.write(updated_html)
    
    print("model-filter-fix.js reference added to index.html")
else:
    print("model-filter-fix.js reference already exists in index.html")
