#!/bin/bash

echo "========================================="
echo "CINeMA Repository Cleaning"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to get directory size
get_size() {
  du -sh "$1" 2>/dev/null | cut -f1
}

# Function to safely remove directory/file
safe_remove() {
  local path=$1
  local description=$2

  if [ -e "$path" ]; then
    SIZE=$(get_size "$path")
    echo -e "${YELLOW}Removing:${NC} $description"
    echo "  Path: $path"
    echo "  Size: $SIZE"
    rm -rf "$path"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}  ✓ Removed${NC}"
    else
      echo -e "${RED}  ✗ Failed to remove${NC}"
    fi
    echo ""
  else
    echo -e "${BLUE}Skipping:${NC} $description (not found)"
    echo ""
  fi
}

echo "This script will remove the following:"
echo "  1. Build artifacts (.tmp/, dist/)"
echo "  2. Dependencies (node_modules/, bower_components/)"
echo "  3. Log files (*.log)"
echo "  4. PID files (*.pid)"
echo "  5. Temporary files"
echo ""
echo -e "${YELLOW}WARNING: This will require reinstalling dependencies!${NC}"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "=== 1. Build Artifacts ==="
echo ""

safe_remove ".tmp" "Temporary build directory (.tmp/)"
safe_remove "dist" "Distribution directory (dist/)"

echo "=== 2. Dependencies ==="
echo ""

safe_remove "node_modules" "Node modules (node_modules/)"
safe_remove "bower_components" "Bower components (bower_components/)"

echo "=== 3. Lock Files ==="
echo ""

safe_remove "package-lock.json" "npm lock file"
safe_remove ".pnpm-lock.yaml" "pnpm lock file"

echo "=== 4. Log Files ==="
echo ""

# Find and remove log files
if ls *.log 1> /dev/null 2>&1; then
  for file in *.log; do
    if [ -f "$file" ]; then
      SIZE=$(get_size "$file")
      echo -e "${YELLOW}Removing:${NC} $file"
      echo "  Size: $SIZE"
      rm -f "$file"
      echo -e "${GREEN}  ✓ Removed${NC}"
      echo ""
    fi
  done
else
  echo -e "${BLUE}No log files found${NC}"
  echo ""
fi

echo "=== 5. PID Files ==="
echo ""

# Find and remove PID files
if ls *.pid 1> /dev/null 2>&1; then
  for file in *.pid; do
    if [ -f "$file" ]; then
      echo -e "${YELLOW}Removing:${NC} $file"
      rm -f "$file"
      echo -e "${GREEN}  ✓ Removed${NC}"
      echo ""
    fi
  done
else
  echo -e "${BLUE}No PID files found${NC}"
  echo ""
fi

echo "=== 6. Temporary Files ==="
echo ""

safe_remove "console-output.txt" "Console output file"
safe_remove "screenshot.png" "Screenshot file"
safe_remove ".DS_Store" "macOS metadata"

# Remove .DS_Store recursively
if find . -name ".DS_Store" -type f 2>/dev/null | grep -q .; then
  echo -e "${YELLOW}Removing:${NC} All .DS_Store files"
  find . -name ".DS_Store" -type f -delete
  echo -e "${GREEN}  ✓ Removed${NC}"
  echo ""
fi

echo "=== 7. PureScript Build Artifacts ==="
echo ""

echo -e "${YELLOW}⚠ WARNING: PureScript output cannot be rebuilt (outdated source code)${NC}"
echo -e "${YELLOW}  Skipping: app/scripts/purescripts/output/${NC}"
echo -e "${YELLOW}  This directory contains 336 pre-compiled modules that are needed.${NC}"
echo ""

# Only clean cache and temp files, NOT output
safe_remove "app/scripts/purescripts/.spago" "PureScript package cache"
safe_remove "app/scripts/purescripts/.pulp-cache" "PureScript pulp cache"
safe_remove "app/scripts/purescripts/node_modules" "PureScript npm dependencies"
safe_remove "app/scripts/purescripts/bower_components" "PureScript bower dependencies"
safe_remove "app/scripts/purescripts/package-lock.json" "PureScript lock file"

# Also clean root level PureScript temp files
safe_remove ".purs-temp" "Root PureScript temp directory"
safe_remove ".spago" "Root Spago cache directory"

echo "========================================="
echo "Cleanup Summary"
echo "========================================="
echo ""

# Check what's left
echo "Remaining files:"
echo ""

echo "Source files:"
ls -lh app/ 2>/dev/null | head -5 | tail -4
echo ""

echo "Configuration files:"
ls -lh package.json gulpfile.js bower.json .nvmrc 2>/dev/null
echo ""

echo "Build scripts:"
ls -lh *.sh 2>/dev/null
echo ""

# Calculate total repo size
TOTAL_SIZE=$(get_size ".")
echo "Total repository size: $TOTAL_SIZE"
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Reinstall dependencies:"
echo "     ${YELLOW}npm install --legacy-peer-deps${NC}"
echo "     ${YELLOW}bower install${NC}"
echo ""
echo "  2. Rebuild application:"
echo "     ${YELLOW}./2_build.sh${NC}"
echo ""
echo "  3. Verify build:"
echo "     ${YELLOW}./3_verify-build.sh${NC}"
echo ""
