# Add this to the app.py file

@app.route('/standalone')
def standalone():
    return send_from_directory('standalone', 'index.html')

@app.route('/standalone/<path:filename>')
def standalone_files(filename):
    return send_from_directory('standalone', filename)
