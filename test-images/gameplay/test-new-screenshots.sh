#!/bin/bash

# Test the 3 new English gameplay screenshots
# Usage: ./test-new-screenshots.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="/home/user/MegaBonk"

echo "================================================"
echo "🎮 Testing 3 New English Screenshots"
echo "================================================"
echo ""

# Define the screenshots
declare -a SCREENSHOTS=(
    "level_38_boss_portal_clean.png|Level 38 - Boss Portal (BASELINE)|18 items|80-90%"
    "level_86_roberto_crypt.png|Level 86 - Roberto Crypt (INTERMEDIATE)|21 items|70-80%"
    "level_98_final_boss.png|Level 98 - Final Boss (STRESS TEST)|22 items|60-70%"
)

# Check which screenshots exist
echo "📸 Checking Screenshots..."
echo "----------------------------"

existing_count=0
missing_count=0

for item in "${SCREENSHOTS[@]}"; do
    IFS='|' read -r filename description items accuracy <<< "$item"
    filepath="${SCRIPT_DIR}/pc-1080p/${filename}"

    if [ -f "$filepath" ]; then
        filesize=$(du -h "$filepath" | cut -f1)
        echo "  ✅ ${filename}"
        echo "     ${description}"
        echo "     Items: ${items} | Target Accuracy: ${accuracy}"
        echo "     Size: ${filesize}"
        echo ""
        ((existing_count++))
    else
        echo "  ❌ ${filename}"
        echo "     ${description}"
        echo "     NOT FOUND"
        echo ""
        ((missing_count++))
    fi
done

echo "Status: ${existing_count}/3 screenshots available"
echo ""

if [ $existing_count -eq 0 ]; then
    echo "❌ No screenshots found!"
    echo ""
    echo "Please save the 3 screenshots from the chat:"
    echo "  1. Right-click each screenshot"
    echo "  2. Select 'Save Image As...'"
    echo "  3. Save to: ${SCRIPT_DIR}/pc-1080p/"
    echo "  4. Use the filenames shown above"
    echo ""
    exit 1
fi

echo "================================================"
echo "📋 Ground Truth Summary"
echo "================================================"
echo ""

echo "Screenshot 1: Level 38 - Boss Portal"
echo "-------------------------------------"
echo "Expected Items:"
echo "  • Green Potion"
echo "  • Banana (x3)"
echo "  • Yellow Wrench"
echo "  • First Aid Kit (x2)"
echo "  • Blue Orb (x2)"
echo "  • ... and 13 more items"
echo ""
echo "Special Features:"
echo "  • Clean UI, no visual effects"
echo "  • Stats panel visible (Boss Curses, Challenges, etc.)"
echo "  • Quest text: 'Find the Boss Portal', 'Defeat the Boss'"
echo "  • BEST for baseline accuracy testing"
echo ""

echo "Screenshot 2: Level 86 - Roberto (Crypt)"
echo "-----------------------------------------"
echo "Expected Items:"
echo "  • Green Slime (x4)"
echo "  • Blue Portal (x5)"
echo "  • Green Wrench (x4)"
echo "  • Burger (x5)"
echo "  • Yellow Tool (x5)"
echo "  • ... and 16 more items"
echo ""
echo "Special Features:"
echo "  • Character: Roberto"
echo "  • Quest: 'Kill Spooky Steve'"
echo "  • Many duplicate counts (x2, x3, x4, x5)"
echo "  • Indoor lighting, purple portal effects"
echo "  • TESTS duplicate detection"
echo ""

echo "Screenshot 3: Level 98 - Final Boss"
echo "------------------------------------"
echo "Expected Items:"
echo "  • Red Soda (x5)"
echo "  • Orange Item (x6)"
echo "  • Orange Orb (x4)"
echo "  • Blue Orb (x5)"
echo "  • Blue Gear (x4)"
echo "  • ... and 17 more items"
echo ""
echo "Special Features:"
echo "  • Heavy fire/particle effects"
echo "  • Red/orange lighting (dramatic)"
echo "  • Final boss arena chaos"
echo "  • STRESS TEST for extreme conditions"
echo ""

echo "================================================"
echo "🧪 Testing Instructions"
echo "================================================"
echo ""

echo "Method 1: Browser Testing (Interactive)"
echo "----------------------------------------"
echo ""
echo "1. Start the dev server:"
echo "   cd ${PROJECT_ROOT}"
echo "   bun run dev"
echo ""
echo "2. Open http://localhost:5173"
echo ""
echo "3. Go to: Advisor tab → Build Scanner"
echo ""
echo "4. For each screenshot:"
echo "   a. Click 'Upload Screenshot'"
echo "   b. Select the screenshot file"
echo "   c. Click '🎯 Hybrid: OCR + CV (Phase 3)'"
echo "   d. Review detected items"
echo ""
echo "5. Validate accuracy (F12 console):"
cat << 'EOF'

   // For Screenshot 1 (Level 38)
   const groundTruth = [
       "Green Potion", "Banana", "Banana", "Banana",
       "Yellow Wrench", "Tomato", "Red Spiky Item",
       "Blue Portal", "Green Wrench", "Blue Penguin",
       "White Hand", "First Aid Kit", "First Aid Kit",
       "Blue Orb", "Blue Orb", "Green Plant", "Pink Item",
       "Yellow Item", "Yellow Gear", "Wrench",
       "First Aid Kit", "Yellow Puzzle"
   ];

   const detected = window.getCurrentScanResults();
   const metrics = window.testUtils.calculateAccuracyMetrics(detected, groundTruth);

   console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
   console.log(`Precision: ${(metrics.precision * 100).toFixed(1)}%`);
   console.log(`Recall: ${(metrics.recall * 100).toFixed(1)}%`);
   console.log(`Detected: ${detected.length} items`);
   console.log(`Expected: ${groundTruth.length} items`);

EOF
echo ""

echo "Method 2: Quick Visual Test"
echo "----------------------------"
echo ""
echo "Just upload and see what gets detected!"
echo "Look for:"
echo "  ✅ Correct items detected"
echo "  ✅ Item counts (x2, x3, etc.) detected"
echo "  ❌ Missed items (false negatives)"
echo "  ❌ Wrong items (false positives)"
echo ""

echo "================================================"
echo "📊 Expected Results"
echo "================================================"
echo ""

echo "Screenshot 1 (Clean UI):"
echo "  Target: 80-90% accuracy"
echo "  Should detect most items correctly"
echo "  May struggle with similar-looking items"
echo ""

echo "Screenshot 2 (Duplicates):"
echo "  Target: 70-80% accuracy"
echo "  Should detect item counts (x4, x5)"
echo "  Indoor lighting may reduce accuracy"
echo ""

echo "Screenshot 3 (Visual Chaos):"
echo "  Target: 60-70% accuracy"
echo "  Heavy effects will obscure some items"
echo "  Still should detect major items"
echo ""

echo "================================================"
echo "🔧 Improvement Strategy"
echo "================================================"
echo ""

echo "After testing, use results to improve detection:"
echo ""
echo "If Screenshot 1 < 80%:"
echo "  → Adjust OCR confidence threshold"
echo "  → Improve fuzzy matching"
echo "  → Add more item name variations"
echo ""
echo "If Screenshot 2 misses duplicates:"
echo "  → Improve count number detection (x2, x3)"
echo "  → Adjust color/brightness for indoor scenes"
echo "  → Fine-tune purple effect handling"
echo ""
echo "If Screenshot 3 < 60%:"
echo "  → Add preprocessing to reduce visual effects"
echo "  → Increase CV template matching weight"
echo "  → Filter out red/orange color bias"
echo ""

echo "================================================"

if [ $existing_count -eq 3 ]; then
    echo ""
    echo "🎉 All 3 screenshots ready for testing!"
    echo ""
    echo "Start testing:"
    echo "  cd ${PROJECT_ROOT}"
    echo "  bun run dev"
    echo ""
    echo "Then open: http://localhost:5173"
    echo "Navigate to: Advisor → Build Scanner"
    echo ""
fi
