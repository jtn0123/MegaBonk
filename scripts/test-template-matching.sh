#!/bin/bash

# ========================================
# MegaBonk Template Matching Test Script
# ========================================
# Quick testing script for template matching system

set -e

echo "================================================"
echo "🎮 MegaBonk Template Matching Test"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-flight Checks${NC}"
echo "----------------------------"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Bun installed"

# Check if src/images/items exists
if [ ! -d "src/images/items" ]; then
    echo -e "${RED}❌ Item images not found${NC}"
    exit 1
fi

ITEM_COUNT=$(ls src/images/items/*.png 2>/dev/null | wc -l)
echo -e "${GREEN}✓${NC} Found $ITEM_COUNT item images"

# Check if computer-vision.ts exists
if [ ! -f "src/modules/computer-vision.ts" ]; then
    echo -e "${RED}❌ Computer vision module not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Computer vision module exists"

echo ""
echo -e "${BLUE}🚀 Starting Development Server${NC}"
echo "----------------------------"

# Kill any existing dev server
pkill -f "vite" 2>/dev/null || true

# Start dev server in background
echo "Starting Vite server..."
bun run dev > /tmp/megabonk-dev.log 2>&1 &
DEV_PID=$!

# Wait for server to be ready
echo "Waiting for server to start..."
for i in {1..30}; do
    if curl -s http://localhost:5173 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Server ready at http://localhost:5173"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server failed to start${NC}"
        cat /tmp/megabonk-dev.log
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${YELLOW}📸 TESTING INSTRUCTIONS${NC}"
echo "================================================"
echo ""
echo "1. Open your browser:"
echo "   ${BLUE}http://localhost:5173${NC}"
echo ""
echo "2. Navigate to:"
echo "   ${BLUE}Advisor Tab → Build Scanner${NC}"
echo ""
echo "3. Upload the screenshot:"
echo "   - Use your Level 52 Spanish screenshot"
echo "   - Or any other gameplay screenshot"
echo ""
echo "4. Click the button:"
echo "   ${BLUE}🎯 Hybrid: OCR + CV (Phase 3)${NC}"
echo ""
echo "5. Wait for detection (4-5 seconds)"
echo ""
echo "6. Check results:"
echo "   - How many items detected?"
echo "   - Are counts correct (x2, x3, etc.)?"
echo "   - Any false positives?"
echo "   - Confidence scores reasonable?"
echo ""
echo "================================================"
echo ""

# Open browser automatically (optional)
if command -v xdg-open &> /dev/null; then
    echo "Opening browser..."
    xdg-open http://localhost:5173 2>/dev/null &
elif command -v open &> /dev/null; then
    echo "Opening browser..."
    open http://localhost:5173 2>/dev/null &
fi

echo ""
echo -e "${YELLOW}💡 VALIDATION CHECKLIST${NC}"
echo "----------------------------"
echo "□ All items in inventory bar detected?"
echo "□ Count numbers recognized (x2, x3, x4, x5)?"
echo "□ Confidence scores >75%?"
echo "□ Detection time <10 seconds?"
echo "□ No false positives (<2 wrong items)?"
echo "□ Common items detected (Borgar, Wrench, Beer)?"
echo ""
echo "================================================"
echo ""

echo -e "${BLUE}📊 Expected Results for Level 52 Screenshot:${NC}"
echo "  - Items detected: 18-21"
echo "  - Accuracy: 85-90%"
echo "  - Detection time: 4-5 seconds"
echo "  - Counts: x2, x3, x4, x5 recognized"
echo ""

echo -e "${YELLOW}⚠️  TROUBLESHOOTING${NC}"
echo "----------------------------"
echo "If detection fails:"
echo "  1. Check browser console (F12) for errors"
echo "  2. Verify templates loaded (check Network tab)"
echo "  3. Look for 'cv.load_templates' log message"
echo "  4. Try refreshing the page"
echo ""
echo "If accuracy is low (<70%):"
echo "  1. Check which items are missed"
echo "  2. Note similarity threshold (currently 0.75)"
echo "  3. Report back which items failed"
echo ""

echo "================================================"
echo -e "${GREEN}✓${NC} Test environment ready!"
echo "================================================"
echo ""
echo "Press Ctrl+C when done testing to stop server"
echo ""

# Wait for user to stop
trap "echo ''; echo 'Stopping server...'; kill $DEV_PID 2>/dev/null; exit 0" INT TERM

# Keep script running
tail -f /tmp/megabonk-dev.log

