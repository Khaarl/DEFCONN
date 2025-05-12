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
    print("File check complete.") # Added log

    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"\nServing at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server")
        
        try:
            webbrowser.open_new_tab(f"http://localhost:{PORT}/index.html")
        except Exception as e:
            print(f"Error opening browser: {e}")
            print("Please manually open http://localhost:8000/index.html in your browser.")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped")
        except Exception as e:
            print(f"An error occurred during server operation: {e}") # Catch other errors

if __name__ == "__main__":
    run_server()