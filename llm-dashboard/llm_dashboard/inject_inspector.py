#!/usr/bin/env python3
import re

# Read the current index.html
with open('static/index.html', 'r') as f:
    html_content = f.read()

# Read our inspector script
with open('static/inspector.js', 'r') as f:
    inspector_script = f.read()

# Insert our script at the beginning of the body
body_position = html_content.find('<body>')
updated_html = html_content[:body_position + 6] + '\n<script>\n' + inspector_script + '\n</script>\n' + html_content[body_position + 6:]

# Save the updated index.html
with open('static/index.html', 'w') as f:
    f.write(updated_html)

print("Debug inspector successfully injected into index.html")
