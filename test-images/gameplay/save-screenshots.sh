#!/bin/bash

# Script to help save and organize gameplay screenshots
# Usage: ./save-screenshots.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${SCRIPT_DIR}/pc-1080p"

echo "================================================"
echo "📸 MegaBonk Screenshot Saver"
echo "================================================"
echo ""
echo "This script will help you save the 4 gameplay screenshots"
echo "to the correct directory with the correct filenames."
echo ""
echo "Target directory: ${TARGET_DIR}"
echo ""

# Create directory if it doesn't exist
mkdir -p "${TARGET_DIR}"

echo "Instructions:"
echo "-------------"
echo "1. Right-click on each screenshot in your chat"
echo "2. Select 'Save Image As...'"
echo "3. Save to: ${TARGET_DIR}"
echo "4. Use the filenames below:"
echo ""

# Define the expected screenshots
declare -a screenshots=(
    "level_33_early_game_english.png|Screenshot 1: Level 33, English, 14 items"
    "level_803_late_game_russian.png|Screenshot 2: Level 803, Russian, 70+ items (STRESS TEST)"
    "level_52_mid_game_spanish.png|Screenshot 3: Level 52, Spanish, 19 items"
    "level_281_late_game_turkish_boss.png|Screenshot 4: Level 281, Turkish, boss fight"
)

echo "Expected Screenshots:"
echo "--------------------"
for item in "${screenshots[@]}"; do
    IFS='|' read -r filename description <<< "$item"
    echo "  📄 ${filename}"
    echo "     ${description}"
    echo ""
done

# Check which screenshots are already saved
echo "Checking current status..."
echo "-------------------------"

count=0
for item in "${screenshots[@]}"; do
    IFS='|' read -r filename description <<< "$item"
    filepath="${TARGET_DIR}/${filename}"

    if [ -f "$filepath" ]; then
        filesize=$(du -h "$filepath" | cut -f1)
        echo "  ✅ ${filename} (${filesize})"
        ((count++))
    else
        echo "  ❌ ${filename} (not found)"
    fi
done

echo ""
echo "Progress: ${count}/4 screenshots saved"
echo ""

if [ $count -eq 4 ]; then
    echo "🎉 All screenshots are saved!"
    echo ""
    echo "Next steps:"
    echo "-----------"
    echo "1. Start the dev server:"
    echo "   cd /home/user/MegaBonk && bun run dev"
    echo ""
    echo "2. Open http://localhost:5173"
    echo ""
    echo "3. Go to: Advisor tab → Build Scanner section"
    echo ""
    echo "4. Upload a screenshot and click 'Hybrid: OCR + CV'"
    echo ""
    echo "5. Validate accuracy using the ground truth in:"
    echo "   ${SCRIPT_DIR}/ground-truth.json"
    echo ""
else
    echo "⏳ Please save the remaining screenshots and run this script again."
    echo ""
    echo "Quick method:"
    echo "  1. Open: file://${SCRIPT_DIR}/quick-test.html"
    echo "  2. Drag and drop each screenshot"
    echo "  3. Click 'Save to Test Directory'"
    echo ""
fi

echo "================================================"
