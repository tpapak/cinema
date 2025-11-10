#!/bin/bash

echo "========================================="
echo "CINeMA Build Verification"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# Function to check file exists and size
check_file() {
  local file=$1
  local min_size=$2
  local description=$3
  
  if [ -f "$file" ]; then
    SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
    if [ "$SIZE" -gt "$min_size" ]; then
      echo -e "${GREEN}✓${NC} $description"
      echo "  File: $file"
      echo "  Size: $(du -h "$file" | cut -f1)"
      PASS=$((PASS+1))
      return 0
    else
      echo -e "${RED}✗${NC} $description (file too small: $SIZE bytes)"
      FAIL=$((FAIL+1))
      return 1
    fi
  else
    echo -e "${RED}✗${NC} $description (file not found)"
    FAIL=$((FAIL+1))
    return 1
  fi
}

# Function to check directory exists and has files
check_dir() {
  local dir=$1
  local description=$2
  
  if [ -d "$dir" ]; then
    COUNT=$(ls -1 "$dir" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$COUNT" -gt 0 ]; then
      echo -e "${GREEN}✓${NC} $description"
      echo "  Directory: $dir"
      echo "  Files: $COUNT"
      PASS=$((PASS+1))
      return 0
    else
      echo -e "${RED}✗${NC} $description (directory empty)"
      FAIL=$((FAIL+1))
      return 1
    fi
  else
    echo -e "${RED}✗${NC} $description (directory not found)"
    FAIL=$((FAIL+1))
    return 1
  fi
}

# Function to check gulp task exists
check_gulp_task() {
  local task=$1
  local description=$2
  
  if gulp --tasks 2>/dev/null | grep -q "^$task$\|── $task$"; then
    echo -e "${GREEN}✓${NC} $description"
    PASS=$((PASS+1))
    return 0
  else
    echo -e "${RED}✗${NC} $description (task not found)"
    FAIL=$((FAIL+1))
    return 1
  fi
}

echo "=== 1. Core Build Files ==="
echo ""
check_file ".tmp/scripts/bundle.js" 1000000 "JavaScript bundle (bundle.js)"
check_dir ".tmp/templates" "Handlebars templates compiled"
check_file "package.json" 100 "Package configuration"
check_file "gulpfile.js" 1000 "Gulp build configuration"
check_file "bower.json" 50 "Bower configuration"
echo ""

echo "=== 2. Node Modules ==="
echo ""
check_dir "node_modules" "NPM dependencies installed"
check_file "node_modules/.bin/gulp" 100 "Gulp CLI installed"
check_file "node_modules/.bin/browserify" 100 "Browserify installed"
echo ""

echo "=== 3. Bower Components ==="
echo ""
check_dir "bower_components" "Bower dependencies installed"
check_dir "bower_components/jquery/dist" "jQuery installed"
check_dir "bower_components/handlebars" "Handlebars installed"
check_dir "bower_components/bootstrap-sass" "Bootstrap installed"
echo ""

echo "=== 4. Source Files ==="
echo ""
check_dir "app/scripts" "JavaScript source files"
check_dir "app/styles" "SCSS style files"
check_dir "app/templates" "Handlebars template sources"
check_file "app/index.html" 1000 "Main HTML file"
echo ""

echo "=== 5. Build Scripts ==="
echo ""
check_file "build-scripts.sh" 50 "JavaScript build script"
check_file "clean-build.sh" 50 "Clean build script"
check_file "serve.sh" 50 "Development server script"
echo ""

echo "=== 6. Gulp Tasks Available ==="
echo ""
check_gulp_task "clean" "clean task"
check_gulp_task "build" "build task"
check_gulp_task "serve" "serve task"
check_gulp_task "scripts" "scripts task"
check_gulp_task "styles" "styles task"
check_gulp_task "templates" "templates task"
echo ""

echo "=== 7. Configuration Files ==="
echo ""
check_file ".nvmrc" 5 "Node version specification"
check_file ".editorconfig" 10 "Editor configuration"
if [ -f "config.json" ]; then
  check_file "config.json" 10 "Application configuration"
else
  echo -e "${YELLOW}ℹ${NC} Application configuration (config.json) - using defaults"
fi
echo ""

echo "=== 8. Build Output Validation ==="
echo ""

# Check if bundle.js is valid JavaScript
if [ -f ".tmp/scripts/bundle.js" ]; then
  if head -1 .tmp/scripts/bundle.js | grep -q "function"; then
    echo -e "${GREEN}✓${NC} JavaScript bundle is valid"
    PASS=$((PASS+1))
  else
    echo -e "${RED}✗${NC} JavaScript bundle may be corrupted"
    FAIL=$((FAIL+1))
  fi
fi

# Check template count
if [ -d ".tmp/templates" ]; then
  TEMPLATE_COUNT=$(ls -1 .tmp/templates/*.js 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TEMPLATE_COUNT" -gt 15 ]; then
    echo -e "${GREEN}✓${NC} Templates compiled ($TEMPLATE_COUNT files)"
    PASS=$((PASS+1))
  else
    echo -e "${YELLOW}⚠${NC} Only $TEMPLATE_COUNT templates compiled (expected 20+)"
  fi
fi

# Check Node version
echo ""
NODE_VERSION=$(node --version 2>/dev/null)
if [ ! -z "$NODE_VERSION" ]; then
  echo -e "${GREEN}✓${NC} Node.js available: $NODE_VERSION"
  PASS=$((PASS+1))
else
  echo -e "${RED}✗${NC} Node.js not found"
  FAIL=$((FAIL+1))
fi

# Check npm version
NPM_VERSION=$(npm --version 2>/dev/null)
if [ ! -z "$NPM_VERSION" ]; then
  echo -e "${GREEN}✓${NC} npm available: $NPM_VERSION"
  PASS=$((PASS+1))
else
  echo -e "${RED}✗${NC} npm not found"
  FAIL=$((FAIL+1))
fi

echo ""
echo "=== 9. PureScript Build (Optional) ==="
echo ""

# Check if PureScript output exists
if [ -d "app/scripts/purescripts/output" ]; then
  PURS_MODULES=$(ls -1 app/scripts/purescripts/output 2>/dev/null | wc -l | tr -d ' ')
  if [ "$PURS_MODULES" -gt 50 ]; then
    echo -e "${GREEN}✓${NC} PureScript compiled ($PURS_MODULES modules)"
    echo "  Directory: app/scripts/purescripts/output"
    echo "  Modules: $PURS_MODULES"
    PASS=$((PASS+1))
  else
    echo -e "${YELLOW}⚠${NC} Only $PURS_MODULES PureScript modules (expected 100+)"
  fi
else
  echo -e "${YELLOW}ℹ${NC} PureScript not compiled (optional - using pre-built if available)"
fi

# Check if Spago is available
if command -v spago &> /dev/null; then
  SPAGO_VERSION=$(spago version 2>/dev/null | head -1)
  echo -e "${GREEN}✓${NC} Spago available: $SPAGO_VERSION"
  PASS=$((PASS+1))
else
  echo -e "${YELLOW}ℹ${NC} Spago not installed (PureScript builds unavailable)"
fi

# Check if PureScript compiler is available
if command -v purs &> /dev/null; then
  PURS_VERSION=$(purs --version 2>/dev/null)
  echo -e "${GREEN}✓${NC} PureScript compiler: $PURS_VERSION"
  PASS=$((PASS+1))
else
  echo -e "${YELLOW}ℹ${NC} PureScript compiler not installed"
fi

echo ""
echo "========================================="
echo "Build Verification Summary"
echo "========================================="
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ Build verification PASSED${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Start server: ./serve.sh"
  echo "  2. Open browser: http://localhost:9000"
  echo "  3. Check console: node save-console.mjs"
  exit 0
else
  echo -e "${RED}✗ Build verification FAILED${NC}"
  echo ""
  echo "To fix issues:"
  echo "  1. Run: npm install --legacy-peer-deps"
  echo "  2. Run: bower install"
  echo "  3. Run: ./clean-build.sh"
  exit 1
fi
