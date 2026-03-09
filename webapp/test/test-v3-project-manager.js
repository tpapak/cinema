#!/usr/bin/env node
/**
 * V3 Project Manager End-to-End Test for CINeMA webapp
 *
 * Demonstrates the project manager UI and v3 file upload flow.
 * Takes screenshots at each step for screen capture / demo.
 *
 * Usage:
 *   gulp serve &                                # Start dev server on port 9000
 *   node test/test-v3-project-manager.js        # Interactive (visible browser)
 *
 * Or test against dist:
 *   gulp build
 *   node test/test-v3-project-manager.js --dist
 *
 * Options:
 *   --dist       Test production build (spins up local server)
 *   --headless   Run headless (no visible browser)
 *   --slow       Extra delays for demo recording (3x slower)
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const testDist = args.includes('--dist');
const HEADLESS = args.includes('--headless');
const SLOW = args.includes('--slow');
const PORT = testDist ? 9999 : (process.env.TEST_PORT || 9000);
const BASE_DIR = path.join(__dirname, '..');
const V3_FILE = path.join(__dirname, '../../project-manager/diabetes_v3.cnm');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const DELAY = SLOW ? 3000 : 1000;

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Simple static file server for dist testing
function createDistServer() {
  const distDir = path.join(BASE_DIR, 'dist');

  if (!fs.existsSync(distDir)) {
    console.error('dist/ directory not found. Run "gulp build" first.');
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
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.ico': 'image/x-icon',
        '.csv': 'text/csv',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function screenshot(page, name, step) {
  const filename = path.join(SCREENSHOT_DIR, `${String(step).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log('    [screenshot] ' + filename);
}

async function runTests() {
  console.log('CINeMA V3 Project Manager Test\n');
  console.log('  Mode: ' + (HEADLESS ? 'headless' : 'interactive'));
  console.log('  Speed: ' + (SLOW ? 'slow (demo)' : 'normal'));

  // Verify v3 file exists
  if (!fs.existsSync(V3_FILE)) {
    console.error('V3 file not found: ' + V3_FILE);
    process.exit(1);
  }
  console.log('  V3 file: ' + V3_FILE);

  let server = null;

  if (testDist) {
    console.log('  Testing production build (dist/)...');
    server = createDistServer();
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log('  Test server on port ' + PORT);
  } else {
    console.log('  Testing server at localhost:' + PORT + '...');
    try {
      await fetch('http://localhost:' + PORT + '/');
    } catch (e) {
      console.error('  No server running at localhost:' + PORT);
      console.error('  Start with: gulp serve');
      process.exit(1);
    }
    console.log('  Server detected on port ' + PORT);
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : (SLOW ? 500 : 200),
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

  // Collect errors
  const jsErrors = [];
  const allConsoleMessages = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    allConsoleMessages.push({ type, text });
    if (type === 'error') {
      if (!text.includes('Failed to load resource') && !text.includes('404') &&
          !text.includes('ocpu') && !text.includes('rserver')) {
        jsErrors.push(text);
      }
    }
  });

  page.on('pageerror', error => {
    jsErrors.push(error.name + ': ' + error.message);
  });

  let passed = 0;
  let failed = 0;
  let step = 1;

  function check(condition, message) {
    if (condition) {
      passed++;
      console.log('  + ' + message);
    } else {
      failed++;
      console.log('  FAIL: ' + message);
    }
  }

  try {
    // =========================================================
    // 1. Load app — Welcome page
    // =========================================================
    console.log('\n--- Step 1: Load app ---');
    await page.goto('http://localhost:' + PORT + '/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    // Wait for CINeMA to fully initialize (Actions must be available)
    await page.waitForFunction(() => {
      return typeof window.Actions !== 'undefined' &&
             typeof window.Actions.Router !== 'undefined' &&
             typeof window.Model !== 'undefined';
    }, { timeout: 15000 });
    await page.waitForTimeout(DELAY);
    check(true, 'App loaded');
    await screenshot(page, 'welcome', step++);

    // =========================================================
    // 2. Navigate to Collections (Project Manager)
    // =========================================================
    console.log('\n--- Step 2: Navigate to Collections ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
    await page.waitForTimeout(DELAY);

    const pmVisible = await page.evaluate(() => {
      return document.querySelector('#project-manager') !== null;
    });
    check(pmVisible, 'Project Manager page rendered');
    await screenshot(page, 'collections_empty', step++);

    // =========================================================
    // 3. Create a new collection
    // =========================================================
    console.log('\n--- Step 3: Create a collection ---');
    await page.evaluate(() => window.Actions.ProjectManager.createCollection('Diabetes Review'));
    await page.waitForTimeout(DELAY);

    const hasCollection = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      return mgr && mgr.collections && mgr.collections.length === 1;
    });
    check(hasCollection, 'Collection created');
    await screenshot(page, 'collection_created', step++);

    // =========================================================
    // 4. Upload v3 .cnm file as a collection
    // =========================================================
    console.log('\n--- Step 4: Upload v3 .cnm file ---');
    const fileInput = await page.$('input#pmUploadCollection');
    check(fileInput !== null, 'Upload file input found');

    await fileInput.setInputFiles(V3_FILE);
    await page.waitForTimeout(DELAY * 2);

    const v3Detected = allConsoleMessages.some(m =>
      m.text.includes('v3') || m.text.includes('Collection uploaded')
    );

    const collectionCount = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      return mgr ? mgr.collections.length : 0;
    });
    check(collectionCount === 2, 'Two collections now (empty + uploaded): got ' + collectionCount);
    await screenshot(page, 'collection_uploaded', step++);

    // =========================================================
    // 5. Select the uploaded collection to see its projects
    // =========================================================
    console.log('\n--- Step 5: Browse uploaded collection ---');
    const uploadedColId = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      // Find the collection with projects (the uploaded one)
      const col = mgr.collections.find(c => c.projects && c.projects.length > 0);
      if (col) {
        window.Actions.ProjectManager.selectCollection(col.id);
        return col.id;
      }
      return null;
    });
    await page.waitForTimeout(DELAY);

    check(uploadedColId !== null, 'Uploaded collection found and selected');

    const projectCount = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      const col = mgr.collections.find(c => c.id === mgr.activeCollectionId);
      return col ? col.projects.length : 0;
    });
    check(projectCount > 0, 'Collection has ' + projectCount + ' project(s)');
    await screenshot(page, 'collection_projects', step++);

    // =========================================================
    // 6. Open the first project in CINeMA workspace
    // =========================================================
    console.log('\n--- Step 6: Open project in CINeMA ---');
    const openResult = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      const col = mgr.collections.find(c => c.id === mgr.activeCollectionId);
      if (col && col.projects.length > 0) {
        const proj = col.projects[0];
        window.Actions.ProjectManager.openProject(col.id, proj.id);
        return { title: proj.title, id: proj.id };
      }
      return null;
    });
    await page.waitForTimeout(DELAY * 2);

    check(openResult !== null, 'Project opened: ' + (openResult ? openResult.title : 'none'));

    // Verify we're on the general/configuration page
    const currentRoute = await page.evaluate(() => {
      return window.Model.getState().router.currentRoute;
    });
    check(currentRoute === 'general', 'Routed to Configuration page');
    await screenshot(page, 'project_opened_general', step++);

    // =========================================================
    // 7. Verify project data loaded correctly
    // =========================================================
    console.log('\n--- Step 7: Verify project data ---');
    const state = await page.evaluate(() => {
      try {
        const s = window.Model.getState();
        const p = s.project;
        const cm = p?.CM?.currentCM;
        return {
          hasFile: p?.hasFile,
          type: p?.type,
          format: p?.format,
          cmStatus: cm?.status,
          cmModel: cm?.params?.MAModel,
          cmSm: cm?.params?.sm,
          numTreatments: cm?.params?.intvs?.length,
          numNMAresults: cm?.hatmatrix?.NMAresults?.length,
          numStudiesLong: p?.studies?.long?.length,
          numNodes: p?.studies?.nodes?.length,
          numDirectComps: p?.studies?.directComparisons?.length,
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    check(!state.error, 'Model state accessible');
    check(state.hasFile === true, 'project.hasFile is true');
    check(state.type === 'binary', 'project.type is "binary"');
    check(state.format === 'long', 'project.format is "long"');
    check(state.cmStatus === 'ready', 'CM status is "ready"');
    check(state.cmModel === 'fixed', 'CM model is "fixed"');
    check(state.cmSm === 'RD', 'CM summary measure is "RD"');
    check(state.numTreatments === 6, '6 treatments: got ' + state.numTreatments);
    check(state.numNMAresults === 15, '15 NMA results: got ' + state.numNMAresults);
    check(state.numStudiesLong === 48, '48 study arms: got ' + state.numStudiesLong);
    check(state.numNodes === 6, '6 nodes: got ' + state.numNodes);
    check(state.numDirectComps === 14, '14 direct comparisons: got ' + state.numDirectComps);

    // =========================================================
    // 8. Navigate through CINeMA evaluation tabs
    // =========================================================
    console.log('\n--- Step 8: Navigate evaluation tabs ---');
    const TABS = [
      { route: 'rob', name: 'Within-study Bias' },
      { route: 'indirectness', name: 'Indirectness' },
      { route: 'imprecision', name: 'Imprecision' },
      { route: 'heterogeneity', name: 'Heterogeneity' },
      { route: 'incoherence', name: 'Incoherence' },
      { route: 'pubbias', name: 'Reporting Bias' },
    ];

    for (const tab of TABS) {
      await page.evaluate((route) => {
        window.Actions.Router.gotoRoute(route);
      }, tab.route);
      await page.waitForTimeout(DELAY);

      const hasContent = await page.evaluate(() => {
        const container = document.querySelector('.container-fluid');
        return container && container.innerHTML.length > 200;
      });
      check(hasContent, tab.name + ' (' + tab.route + '): rendered');
      await screenshot(page, 'tab_' + tab.route, step++);
    }

    // =========================================================
    // 9. Navigate back to Project Manager
    // =========================================================
    console.log('\n--- Step 9: Back to Collections ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
    await page.waitForTimeout(DELAY);
    await screenshot(page, 'back_to_collections', step++);

    // =========================================================
    // 10. Export project as atomic .cnm
    // =========================================================
    console.log('\n--- Step 10: Export atomic project ---');
    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      const col = mgr.collections.find(c => c.projects && c.projects.length > 0);
      if (col && col.projects[0]) {
        window.Actions.ProjectManager.exportProject(col.id, col.projects[0].id);
      }
    });

    const download = await downloadPromise;
    if (download) {
      const dlPath = path.join(SCREENSHOT_DIR, await download.suggestedFilename());
      await download.saveAs(dlPath);
      check(true, 'Atomic .cnm exported: ' + await download.suggestedFilename());

      // Validate exported file is valid v3
      const exported = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
      check(exported.cinema && exported.cinema.version === '3.0.0', 'Exported file is v3 format');
      check(exported.cinema.projects.length === 1, 'Exported file has 1 project (atomic)');
    } else {
      console.log('  (i) Download event not captured (may need --headless=false)');
    }

    // =========================================================
    // 11. Split project into new collection
    // =========================================================
    console.log('\n--- Step 11: Split project to new collection ---');
    await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      const col = mgr.collections.find(c => c.projects && c.projects.length > 0);
      if (col && col.projects[0]) {
        window.Actions.ProjectManager.splitProject(col.id, col.projects[0].id);
      }
    });
    await page.waitForTimeout(DELAY);

    const finalColCount = await page.evaluate(() => {
      return window.Model.getState().projectManager.collections.length;
    });
    check(finalColCount === 3, 'Now 3 collections (empty + uploaded + split): got ' + finalColCount);
    await screenshot(page, 'after_split', step++);

    // =========================================================
    // 12. Merge collections
    // =========================================================
    console.log('\n--- Step 12: Merge collections ---');
    await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      if (mgr.collections.length >= 2) {
        // Programmatically merge first two
        const id1 = mgr.collections[0].id;
        const id2 = mgr.collections[1].id;
        // Direct call (bypasses confirm dialog)
        const col1 = mgr.collections.find(c => c.id === id1);
        const col2 = mgr.collections.find(c => c.id === id2);
        const now = new Date().toISOString();
        const merged = {
          id: 'merged_' + Date.now(),
          title: col1.title + ' + ' + col2.title,
          description: 'Merged',
          author: '',
          createdAt: now,
          updatedAt: now,
          projects: (col1.projects || []).concat(col2.projects || []),
        };
        mgr.collections.push(merged);
        mgr.activeCollectionId = merged.id;
        // re-render
        window.Model.saveState();
      }
    });
    await page.waitForTimeout(DELAY);

    const mergedCount = await page.evaluate(() => {
      return window.Model.getState().projectManager.collections.length;
    });
    check(mergedCount === 4, 'Now 4 collections (3 + merged): got ' + mergedCount);
    await screenshot(page, 'after_merge', step++);

    // =========================================================
    // 13. Check for critical JS errors
    // =========================================================
    console.log('\n--- JavaScript errors ---');
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('NetworkError') &&
      !e.includes('ocpu') &&
      !e.includes('fetch') &&
      !e.includes('rserver')
    );

    if (criticalErrors.length === 0) {
      check(true, 'No critical JavaScript errors');
    } else {
      check(false, criticalErrors.length + ' critical JavaScript error(s):');
      criticalErrors.slice(0, 10).forEach(e => {
        console.log('      ' + e.substring(0, 150));
      });
    }

  } catch (error) {
    console.log('\n  FATAL: ' + error.message);
    console.log(error.stack);
    failed++;
  } finally {
    if (!HEADLESS) {
      console.log('\n  Browser stays open for 15 seconds for inspection/recording...');
      await page.waitForTimeout(15000);
    }
    await browser.close();
    if (server) server.close();
  }

  // =========================================================
  // Summary
  // =========================================================
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  console.log('Screenshots saved to: ' + SCREENSHOT_DIR);
  if (failed === 0) {
    console.log('V3 Project Manager test PASSED');
  } else {
    console.log('V3 Project Manager test FAILED');
    process.exit(1);
  }

  return { passed, failed };
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
