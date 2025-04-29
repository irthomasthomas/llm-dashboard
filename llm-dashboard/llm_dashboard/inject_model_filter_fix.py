#!/usr/bin/env python3
import re

# Read the current index.html
with open('static/index.html', 'r') as f:
    html_content = f.read()

# Read our fix
with open('static/fix-model-filter.js', 'r') as f:
    fix_script = f.read()

# Insert our script before the closing body tag
insert_position = html_content.find('</body>')
updated_html = html_content[:insert_position] + '\n<script>\n' + fix_script + '\n</script>\n' + html_content[insert_position:]

# Save the updated index.html
with open('static/index.html', 'w') as f:
    f.write(updated_html)

print("Model filter fix successfully injected into index.html")
