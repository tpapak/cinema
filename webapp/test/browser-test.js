#!/usr/bin/env node
/**
 * Browser test for CINeMA webapp
 * 
 * Tests that the app loads without critical JavaScript errors.
 * This test requires a full build first (gulp build or gulp serve running).
 * 
 * Usage: 
 *   gulp serve &  # Start dev server in background
 *   node test/browser-test.js
 * 
 * Or test against dist:
 *   gulp build
 *   node test/browser-test.js --dist
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
  console.log('🧪 CINeMA Browser Test\n');
  
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
    console.log('  node test/browser-test.js --dist      # Test production build');
    console.log('  node test/browser-test.js --external  # Test running gulp serve');
    process.exit(0);
  }
  
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect errors and all console messages
  const jsErrors = [];
  const networkErrors = [];
  const allConsoleMessages = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    allConsoleMessages.push({ type, text });
    
    if (type === 'error') {
      // Filter out resource loading errors (handled separately)
      if (!text.includes('Failed to load resource') && !text.includes('404')) {
        jsErrors.push(text);
      }
    }
  });
  
  page.on('pageerror', error => {
    jsErrors.push(`${error.name}: ${error.message}`);
    allConsoleMessages.push({ type: 'pageerror', text: `${error.name}: ${error.message}` });
  });
  
  page.on('requestfailed', request => {
    const url = request.url();
    // Only track critical failures
    if (url.includes('.js') || url.includes('.css')) {
      networkErrors.push(url);
    }
  });
  
  let testsPassed = true;
  const results = {
    title: null,
    networkErrors: [],
    jsErrors: [],
    checks: {}
  };
  
  try {
    // Navigate to app
    console.log(`\n📄 Loading http://localhost:${PORT}/...`);
    const response = await page.goto(`http://localhost:${PORT}/`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    results.httpStatus = response.status();
    console.log(`   HTTP Status: ${results.httpStatus}`);
    
    // Wait a bit for scripts to execute
    await page.waitForTimeout(2000);
    
    // Check page title
    results.title = await page.title();
    console.log(`   Page title: "${results.title}"`);
    
    if (results.title !== 'CINeMA') {
      console.log('   ⚠️  Unexpected title');
    }
    
    // Check for JavaScript errors
    results.jsErrors = jsErrors;
    
    // Filter out expected errors (e.g., R server not running)
    const criticalErrors = jsErrors.filter(e => 
      !e.includes('Exception') &&  // Generic exception (likely R server)
      !e.includes('NetworkError') &&
      !e.includes('ocpu') &&
      !e.includes('fetch')
    );
    
    if (criticalErrors.length > 0) {
      console.log(`\n❌ JavaScript errors (${criticalErrors.length}):`);
      const errorCounts = {};
      criticalErrors.forEach(e => {
        const key = e.substring(0, 60);
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      Object.entries(errorCounts).slice(0, 5).forEach(([err, count]) => {
        console.log(`   ${err}${count > 1 ? ` (x${count})` : ''}`);
      });
      testsPassed = false;
    } else if (jsErrors.length > 0) {
      console.log(`\n⚠️  Non-critical errors (${jsErrors.length}):`);
      jsErrors.slice(0, 3).forEach(e => console.log(`   ${e}`));
      console.log('   (These are expected when R server is not running)');
    } else {
      console.log('\n✓ No JavaScript errors');
    }
    
    // Check for critical network errors
    results.networkErrors = networkErrors;
    if (networkErrors.length > 0) {
      console.log(`\n⚠️  Failed to load ${networkErrors.length} resources:`);
      networkErrors.slice(0, 5).forEach(url => {
        const shortUrl = url.replace(`http://localhost:${PORT}`, '');
        console.log(`   ${shortUrl}`);
      });
    }
    
    // Run page checks
    console.log('\n📋 Page checks:');
    
    // Check GRADE namespace (templates)
    results.checks.gradeNamespace = await page.evaluate(() => {
      return typeof window.GRADE !== 'undefined';
    });
    console.log(`   ${results.checks.gradeNamespace ? '✓' : '❌'} GRADE namespace defined`);
    if (!results.checks.gradeNamespace) testsPassed = false;
    
    // Check jQuery
    results.checks.jquery = await page.evaluate(() => {
      return typeof window.$ !== 'undefined' || typeof window.jQuery !== 'undefined';
    });
    console.log(`   ${results.checks.jquery ? '✓' : '❌'} jQuery loaded`);
    if (!results.checks.jquery) testsPassed = false;
    
    // Check Handlebars
    results.checks.handlebars = await page.evaluate(() => {
      return typeof window.Handlebars !== 'undefined';
    });
    console.log(`   ${results.checks.handlebars ? '✓' : '❌'} Handlebars loaded`);
    if (!results.checks.handlebars) testsPassed = false;
    
    // Check if main app initialized (Router exists)
    results.checks.router = await page.evaluate(() => {
      return typeof window.Router !== 'undefined' || 
             document.querySelector('[data-route]') !== null ||
             document.body.innerHTML.length > 100;
    });
    console.log(`   ${results.checks.router ? '✓' : '⚠️ '} App content rendered`);
    
    // Check if Messages.alertify exists
    results.checks.alertify = await page.evaluate(() => {
      try {
        return typeof window.Actions !== 'undefined' && 
               typeof window.Actions.alertify === 'function';
      } catch(e) {
        return false;
      }
    });
    console.log(`   ${results.checks.alertify ? '✓' : '❌'} Actions.alertify available`);
    
    // Print ALL console messages
    if (allConsoleMessages.length > 0) {
      console.log(`\n📝 All console messages (${allConsoleMessages.length}):`);
      allConsoleMessages.forEach(({ type, text }) => {
        const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'log' ? '📋' : '  ';
        console.log(`   ${prefix} [${type}] ${text.substring(0, 200)}`);
      });
    } else {
      console.log('\n📝 No console messages');
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
    console.log('✅ Browser tests PASSED');
  } else {
    console.log('❌ Browser tests FAILED');
    process.exit(1);
  }
  
  return results;
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
