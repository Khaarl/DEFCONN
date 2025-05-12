import http.server
import socketserver
import webbrowser
import os
from pathlib import Path

PORT = 8000
DIRECTORY = str(Path(__file__).parent.absolute())

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Method', 'GET')
        super().end_headers()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run_server():
    os.chdir(DIRECTORY)
    print(f"Project directory: {DIRECTORY}")
    print("Checking required files...")
    
    required_files = ['index.html', 'p5.min.js', 'sketch.js']
    for file in required_files:
        if not os.path.exists(file):
            print(f"Warning: {file} not found in project directory")

    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"\nServing at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server")
        webbrowser.open_new_tab(f"http://localhost:{PORT}/index.html")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")

if __name__ == "__main__":
    run_server()