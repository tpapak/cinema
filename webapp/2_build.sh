#!/bin/bash
set -e

echo "========================================="
echo "CINeMA Build Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from correct directory
if [ ! -f "package.json" ]; then
  echo -e "${RED}Error: package.json not found. Run this script from the webapp directory.${NC}"
  exit 1
fi

# Load NVM if available
if [ -s "$NVM_DIR/nvm.sh" ]; then
  echo -e "${YELLOW}Loading NVM...${NC}"
  . "$NVM_DIR/nvm.sh"
  
  if [ -f ".nvmrc" ]; then
    echo -e "${YELLOW}Using Node version from .nvmrc...${NC}"
    nvm use
  fi
fi

# Step 1: Build PureScript
echo -e "${YELLOW}Step 1: Building PureScript...${NC}"
cd app/scripts/purescripts
if spago build; then
  echo -e "${GREEN}✓ PureScript build successful${NC}"
else
  echo -e "${RED}✗ PureScript build failed${NC}"
  echo -e "${YELLOW}Note: There may be missing dependencies. Check packages.dhall and spago.dhall${NC}"
  cd ../../..
  exit 1
fi
cd ../../..

# Step 2: Build JavaScript bundle
echo -e "${YELLOW}Step 2: Building JavaScript bundle...${NC}"
if bash build-scripts.sh; then
  echo -e "${GREEN}✓ JavaScript bundle created${NC}"
else
  echo -e "${RED}✗ JavaScript bundle failed${NC}"
  exit 1
fi

# Step 3: Run Gulp build
echo -e "${YELLOW}Step 3: Running Gulp build...${NC}"
if gulp build; then
  echo -e "${GREEN}✓ Gulp build successful${NC}"
else
  echo -e "${RED}✗ Gulp build failed${NC}"
  exit 1
fi

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${GREEN}Output is in the 'dist' directory${NC}"
echo -e "${GREEN}=========================================${NC}"
