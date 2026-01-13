#!/bin/bash

# Quick test script for English-only screenshot testing
# Usage: ./test-english.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/home/user/MegaBonk"
SCREENSHOT="${SCRIPT_DIR}/pc-1080p/level_33_early_game_english.png"

echo "================================================"
echo "🎮 MegaBonk English-Only Quick Test"
echo "================================================"
echo ""

# Check if screenshot exists
if [ -f "$SCREENSHOT" ]; then
    echo "✅ Screenshot found: level_33_early_game_english.png"
    filesize=$(du -h "$SCREENSHOT" | cut -f1)
    echo "   Size: ${filesize}"
    echo ""
else
    echo "❌ Screenshot not found!"
    echo ""
    echo "Please save Screenshot 1 (Level 33, English) to:"
    echo "   ${SCRIPT_DIR}/pc-1080p/level_33_early_game_english.png"
    echo ""
    echo "Steps:"
    echo "  1. Right-click the first screenshot in your chat"
    echo "  2. Select 'Save Image As...'"
    echo "  3. Save to the path above"
    echo ""
    echo "Or use the quick test page:"
    echo "  firefox ${SCRIPT_DIR}/quick-test.html"
    echo ""
    exit 1
fi

echo "📋 Ground Truth (19 items):"
echo "----------------------------"
echo "  • First Aid Kit"
echo "  • Wrench"
echo "  • Feather"
echo "  • Banana"
echo "  • Cheese"
echo "  • Portal (x4)"
echo "  • Burger"
echo "  • Blue Orb (x3)"
echo "  • Green Plant"
echo "  • Boomerang"
echo "  • Yellow Wrench"
echo "  • Teal Wrench"
echo "  • Chili Pepper"
echo "  • Hoodie"
echo ""

echo "🚀 Starting dev server..."
echo "----------------------------"
echo ""

cd "$PROJECT_ROOT"

# Check if already running
if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "✅ Dev server already running on http://localhost:5173"
    echo ""
else
    echo "Starting: bun run dev"
    echo ""
    # Start dev server in background
    bun run dev > /dev/null 2>&1 &
    DEV_PID=$!
    echo "Dev server started (PID: ${DEV_PID})"
    echo ""
    sleep 3
fi

echo "================================================"
echo "📸 Next Steps:"
echo "================================================"
echo ""
echo "1. Open browser:"
echo "   firefox http://localhost:5173 &"
echo ""
echo "2. Navigate to:"
echo "   Advisor tab → Build Scanner section"
echo ""
echo "3. Upload screenshot:"
echo "   ${SCREENSHOT}"
echo ""
echo "4. Run detection:"
echo "   Click '🎯 Hybrid: OCR + CV (Phase 3)'"
echo ""
echo "5. Validate in browser console (F12):"
cat << 'EOF'

   const groundTruth = [
       "First Aid Kit", "Wrench", "Feather", "Banana", "Cheese",
       "Portal", "Portal", "Portal", "Portal",
       "Burger", "Blue Orb", "Blue Orb", "Blue Orb",
       "Green Plant", "Boomerang", "Yellow Wrench", "Teal Wrench",
       "Chili Pepper", "Hoodie"
   ];

   const detected = window.getCurrentScanResults();
   const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);

   console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
   console.log(`Precision: ${(metrics.precision * 100).toFixed(1)}%`);
   console.log(`Recall: ${(metrics.recall * 100).toFixed(1)}%`);
   console.log(`True Positives: ${metrics.truePositives} / 19`);
   console.log(`False Positives: ${metrics.falsePositives}`);
   console.log(`False Negatives: ${metrics.falseNegatives}`);

EOF
echo ""
echo "================================================"
echo "🎯 Target Accuracy: 75-85%"
echo "================================================"
echo ""
echo "If accuracy is low, let me know what was:"
echo "  • Correctly detected"
echo "  • Missed (false negatives)"
echo "  • Incorrectly detected (false positives)"
echo ""
echo "I'll tune the parameters to improve accuracy!"
echo ""
