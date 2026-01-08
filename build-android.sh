#!/bin/bash
# MegaBonk Guide - Android APK Builder using Bubblewrap
# This script packages the PWA as a standalone Android APK

set -e  # Exit on error

echo "📱 MegaBonk Guide - Android APK Builder"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed!"
    echo "   Install from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed!"
    exit 1
fi

echo "✅ npm version: $(npm --version)"

# Check if Bubblewrap is installed
if ! command -v bubblewrap &> /dev/null; then
    echo ""
    echo "📦 Installing Bubblewrap CLI..."
    npm install -g @bubblewrap/cli
    echo "✅ Bubblewrap installed!"
fi

echo ""
echo "🚀 Starting build process..."
echo ""

# Start the local server in background
echo "🌐 Starting local server..."
python3 serve.py &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo ""
echo "📋 Bubblewrap will now ask you some questions..."
echo "   Recommended answers:"
echo "   - Host: localhost"
echo "   - Port: 8000"
echo "   - Start URL: /"
echo "   - Name: MegaBonk Complete Guide"
echo "   - Package ID: com.megabonk.guide"
echo "   - Display: standalone"
echo ""
echo "Press ENTER to continue..."
read

# Initialize Bubblewrap project (if not already done)
if [ ! -f "twa-manifest.json" ]; then
    echo "🔧 Initializing Bubblewrap project..."
    bubblewrap init --manifest=http://localhost:8000/manifest.json
else
    echo "✅ Bubblewrap project already initialized"
fi

echo ""
echo "🔨 Building Android APK..."
bubblewrap build

echo ""
echo "✅ Build complete!"
echo ""
echo "📱 Your APK is ready at:"
echo "   ./app-release-signed.apk"
echo ""
echo "📲 To install on connected Android device:"
echo "   bubblewrap install"
echo ""
echo "   Or manually:"
echo "   1. Transfer app-release-signed.apk to your phone"
echo "   2. Enable 'Install from Unknown Sources'"
echo "   3. Tap the APK file and install"
echo ""

# Stop the server
kill $SERVER_PID

echo "🎮 Done! Enjoy MegaBonk Guide on Android!"
