#!/usr/bin/env node
/**
 * Upload Test for CINeMA webapp
 * 
 * Tests that uploading a .cnm project file works and ROB section renders.
 * 
 * Usage: 
 *   gulp serve &  # Start dev server in background
 *   node test/upload-rob-test.js --external
 * 
 * Or test against dist:
 *   gulp build
 *   node test/upload-rob-test.js --dist
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const testDist = args.includes('--dist');
const externalServer = args.includes('--external');
const PORT = externalServer ? 9000 : 9999;
const BASE_DIR = path.join(__dirname, '..');
const PROJECT_FILE = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');

// Simple static file server for dist testing
function createDistServer() {
  const distDir = path.join(BASE_DIR, 'dist');
  
  if (!fs.existsSync(distDir)) {
    console.error('❌ dist/ directory not found. Run "gulp build" first.');
    process.exit(1);
  }
  
  return http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';
    
    const filePath = path.join(distDir, url);
    
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      
      const ext = path.extname(filePath);
      const contentTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript', 
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.pdf': 'application/pdf',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function runTests() {
  console.log('🧪 CINeMA Upload & ROB Render Test\n');
  
  // Verify project file exists
  if (!fs.existsSync(PROJECT_FILE)) {
    console.error(`❌ Project file not found: ${PROJECT_FILE}`);
    process.exit(1);
  }
  console.log(`✓ Found project file: ${PROJECT_FILE}`);
  
  let server = null;
  
  if (testDist) {
    console.log('Testing production build (dist/)...');
    server = createDistServer();
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log(`✓ Test server started on port ${PORT}`);
  } else if (externalServer) {
    console.log(`Testing external server at localhost:${PORT}...`);
    // Check if server is running
    try {
      await fetch(`http://localhost:${PORT}/`);
    } catch (e) {
      console.error(`❌ No server running at localhost:${PORT}`);
      console.error('   Start with: gulp serve');
      process.exit(1);
    }
    console.log(`✓ External server detected on port ${PORT}`);
  } else {
    console.log('No server mode specified.');
    console.log('Usage:');
    console.log('  node test/upload-rob-test.js --dist      # Test production build');
    console.log('  node test/upload-rob-test.js --external  # Test running gulp serve');
    process.exit(0);
  }
  
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect errors
  const jsErrors = [];
  const allConsoleMessages = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    allConsoleMessages.push({ type, text });
    
    if (type === 'error') {
      if (!text.includes('Failed to load resource') && !text.includes('404')) {
        jsErrors.push(text);
      }
    }
  });
  
  page.on('pageerror', error => {
    jsErrors.push(`${error.name}: ${error.message}`);
  });
  
  let testsPassed = true;
  const results = {
    checks: {}
  };
  
  try {
    // Read the project file content
    const projectContent = fs.readFileSync(PROJECT_FILE, 'utf-8');
    
    // Set localStorage BEFORE loading the page (so the app sees it on init)
    await page.addInitScript((content) => {
      localStorage.state = content;
    }, projectContent);
    
    // Navigate to app
    console.log(`\n📄 Loading http://localhost:${PORT}/...`);
    await page.goto(`http://localhost:${PORT}/`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for app to initialize
    await page.waitForTimeout(2000);
    console.log('✓ App loaded');
    
    // Navigate to Projects page and load cached project
    console.log('\n📂 Navigating to Projects page...');
    await page.click('a.project');
    await page.waitForTimeout(2000);
    console.log('✓ On Projects page');
    
    // Click "Load cached Project" button to load the state from localStorage
    console.log('\n📤 Loading cached project (diabetes_basic.cnm)...');
    const loadCachedBtn = await page.$('button:has-text("Load cached Project")');
    if (loadCachedBtn) {
      await loadCachedBtn.click();
      await page.waitForTimeout(3000);
      console.log('✓ Clicked "Load cached Project" button');
    } else {
      // Try loading directly via Model
      console.log('   Load button not found, loading via Model.loadCachedModel()...');
      await page.evaluate(() => {
        if (window.Model && window.Model.loadCachedModel) {
          window.Model.loadCachedModel();
        }
      });
      await page.waitForTimeout(3000);
    }
    
    // Check if project was loaded successfully
    results.checks.projectLoaded = await page.evaluate(() => {
      // Check the Model state (not just localStorage)
      try {
        if (window.Model) {
          const state = window.Model.getState();
          return state.project && state.project.hasFile === true;
        }
        return false;
      } catch (e) {
        return false;
      }
    });
    console.log(`   ${results.checks.projectLoaded ? '✓' : '❌'} Project loaded into Model state`);
    if (!results.checks.projectLoaded) testsPassed = false;
    
    // Navigate to ROB page
    console.log('\n🎯 Navigating to Within-study bias (ROB) page...');
    
    // Check if ROB is available
    const robAvailable = await page.evaluate(() => {
      if (window.Model) {
        const state = window.Model.getState();
        return state.project?.CM?.currentCM?.status === 'ready';
      }
      return false;
    });
    console.log(`   ROB available: ${robAvailable}`);
    
    // Navigate using Actions.Router
    await page.evaluate(() => {
      Actions.Router.gotoRoute('rob');
    });
    await page.waitForTimeout(3000);
    console.log('✓ Navigated to ROB page');
    
    // Check if ROB content is rendered
    console.log('\n📋 Checking ROB rendering...');
    
    // Check for ROB-specific elements
    results.checks.robContainer = await page.evaluate(() => {
      return document.querySelector('#contentStudyLimitations, #netRob, .compRobSelector') !== null;
    });
    console.log(`   ${results.checks.robContainer ? '✓' : '❌'} ROB container rendered`);
    if (!results.checks.robContainer) testsPassed = false;
    
    results.checks.netRobElement = await page.evaluate(() => {
      return document.querySelector('#netRob') !== null;
    });
    console.log(`   ${results.checks.netRobElement ? '✓' : '❌'} NetRob element present`);
    
    results.checks.robSelector = await page.evaluate(() => {
      return document.querySelector('#netRobSelector') !== null;
    });
    console.log(`   ${results.checks.robSelector ? '✓' : '❌'} ROB selector present`);
    
    results.checks.comparisonBoxes = await page.evaluate(() => {
      const boxes = document.querySelectorAll('.compRobSelector');
      return boxes.length > 0;
    });
    console.log(`   ${results.checks.comparisonBoxes ? '✓' : '❌'} Comparison ROB boxes rendered`);
    
    // Count the comparison boxes
    const boxCount = await page.evaluate(() => {
      return document.querySelectorAll('.compRobSelector').length;
    });
    if (boxCount > 0) {
      console.log(`   ✓ Found ${boxCount} comparison ROB boxes`);
    }
    
    // Check for ROB rule selector
    results.checks.ruleSelector = await page.evaluate(() => {
      const selector = document.querySelector('#netRob select, select[onchange*="selectRule"]');
      return selector !== null;
    });
    console.log(`   ${results.checks.ruleSelector ? '✓' : '❌'} ROB rule selector present`);
    
    // Print any JavaScript errors
    const criticalErrors = jsErrors.filter(e => 
      !e.includes('Exception') &&
      !e.includes('NetworkError') &&
      !e.includes('ocpu') &&
      !e.includes('fetch')
    );
    
    if (criticalErrors.length > 0) {
      console.log(`\n❌ JavaScript errors (${criticalErrors.length}):`);
      criticalErrors.slice(0, 5).forEach(e => console.log(`   ${e}`));
      testsPassed = false;
    }
    
  } catch (error) {
    console.log(`\n❌ Test error: ${error.message}`);
    testsPassed = false;
  } finally {
    await browser.close();
    if (server) server.close();
  }
  
  // Final result
  console.log('\n' + '='.repeat(50));
  if (testsPassed) {
    console.log('✅ Upload & ROB render test PASSED');
  } else {
    console.log('❌ Upload & ROB render test FAILED');
    process.exit(1);
  }
  
  return results;
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
