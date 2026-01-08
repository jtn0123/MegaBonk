#!/usr/bin/env python3
"""
MegaBonk Guide - Simple HTTP Server
Launches the guide on http://localhost:8000 with mobile access support

Usage:
    python3 serve.py         # Launch on default port 8000
    python3 serve.py 3000    # Launch on custom port

Access from phone:
    1. Make sure your computer and phone are on the same WiFi
    2. Run this script
    3. Look for "Access from mobile:" in the output
    4. Open that URL on your phone
"""

import http.server
import socketserver
import sys
import socket
import os
from pathlib import Path

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

# Change to the src directory where index.html is located
script_dir = Path(__file__).parent
src_dir = script_dir / "src"

if not src_dir.exists():
    print(f"❌ Error: {src_dir} directory not found!")
    sys.exit(1)

os.chdir(src_dir)

# Get port from command line or use default
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

# Get local IP address
def get_local_ip():
    try:
        # Connect to external address to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

local_ip = get_local_ip()
local_url = f"http://{local_ip}:{PORT}"
localhost_url = f"http://localhost:{PORT}"

# Create simple HTTP server
Handler = http.server.SimpleHTTPRequestHandler

# Add CORS headers for development
class CORSRequestHandler(Handler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

print("\n" + "="*60)
print("🎮 MegaBonk Complete Guide - Server Starting...")
print("="*60)

try:
    # Generate QR code for mobile access
    if HAS_QRCODE:
        qr = qrcode.QRCode(version=1, box_size=1, border=1)
        qr.add_data(local_url)
        qr.make(fit=True)

        print("\n📱 MOBILE ACCESS - Scan this QR code:")
        print("─"*60)
        qr.print_ascii(invert=True)
        print("─"*60)
    else:
        print("\n💡 Tip: Install 'qrcode' for QR codes: pip install qrcode")

    print(f"\n✅ Server running!")
    print(f"\n🖥️  Desktop Access:")
    print(f"   {localhost_url}")
    print(f"\n📱 Mobile Access (same WiFi):")
    print(f"   {local_url}")
    print(f"\n⚙️  Controls:")
    print(f"   Press Ctrl+C to stop")
    print("\n" + "="*60 + "\n")

    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        httpd.serve_forever()

except KeyboardInterrupt:
    print("\n\n👋 Server stopped. Thanks for using MegaBonk Guide!")
except OSError as e:
    if "Address already in use" in str(e):
        print(f"\n❌ Error: Port {PORT} is already in use!")
        print(f"   Try a different port: python3 serve.py 3000")
    else:
        print(f"\n❌ Error: {e}")
    sys.exit(1)
