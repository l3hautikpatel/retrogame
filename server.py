#!/usr/bin/env python3
"""
Simple HTTP Server for Retro Console Development
Serves the application with proper MIME types and CORS headers
"""

import http.server
import socketserver
import sys
import os

# Configuration
PORT = 8000
DIRECTORY = "."

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP Request Handler with CORS support"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        """Add CORS headers to all responses"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.end_headers()
    
    def guess_type(self, path):
        """Override to add proper MIME types for JavaScript modules"""
        mimetype = super().guess_type(path)
        
        # Ensure JavaScript modules are served with correct MIME type
        if path.endswith('.js') or path.endswith('.mjs'):
            return 'application/javascript'
        
        # JSON files
        if path.endswith('.json'):
            return 'application/json'
        
        return mimetype

def run_server():
    """Start the development server"""
    
    # Change to the script's directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    try:
        with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
            print(f"""
╔═══════════════════════════════════════════════════════════════╗
║                    🎮 RETRO CONSOLE SERVER                    ║
╚═══════════════════════════════════════════════════════════════╝

Server running at: http://localhost:{PORT}

📺 Host Interface:        http://localhost:{PORT}/host/
📱 Controller Interface:  http://localhost:{PORT}/controllers/

Press Ctrl+C to stop the server
            """)
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\nShutting down server...")
        sys.exit(0)
    except OSError as e:
        if e.errno == 48:  # Address already in use
            print(f"\n❌ Error: Port {PORT} is already in use.")
            print(f"Please close the application using this port or change PORT in server.py")
            sys.exit(1)
        else:
            raise

if __name__ == "__main__":
    run_server()