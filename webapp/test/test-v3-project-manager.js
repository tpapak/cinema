#!/usr/bin/env node
/**
 * V3 Project Manager End-to-End Test for CINeMA webapp
 * (Single-collection model)
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
  console.log('CINeMA V3 Project Manager Test (single-collection model)\n');
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
    // Pass title directly to avoid prompt dialog
    await page.evaluate(() => window.Actions.ProjectManager.newCollection('Diabetes Review'));
    await page.waitForTimeout(DELAY);

    const hasCollection = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      return mgr && mgr.collection && mgr.collection.title === 'Diabetes Review';
    });
    check(hasCollection, 'Collection created: Diabetes Review');
    await screenshot(page, 'collection_created', step++);

    // =========================================================
    // 4. Upload v3 .cnm file into the collection as a project
    // =========================================================
    console.log('\n--- Step 4: Upload v3 .cnm file as project ---');
    const fileInputProject = await page.$('input#pmUploadProject');
    check(fileInputProject !== null, 'Upload project file input found');

    if (fileInputProject) {
      await fileInputProject.setInputFiles(V3_FILE);
      await page.waitForTimeout(DELAY * 2);
    }

    const projectCount = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      return mgr && mgr.collection ? mgr.collection.projects.length : 0;
    });
    check(projectCount > 0, 'Collection has ' + projectCount + ' project(s) after upload');
    await screenshot(page, 'project_uploaded', step++);

    // =========================================================
    // 5. Verify collection state
    // =========================================================
    console.log('\n--- Step 5: Verify collection state ---');
    const colState = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      if (!mgr || !mgr.collection) return null;
      return {
        title: mgr.collection.title,
        projectCount: mgr.collection.projects.length,
        firstProjectTitle: mgr.collection.projects[0] ? mgr.collection.projects[0].title : null,
        hasStudies: mgr.collection.projects[0] &&
                    mgr.collection.projects[0].dataset &&
                    mgr.collection.projects[0].dataset.studies &&
                    mgr.collection.projects[0].dataset.studies.length > 0,
      };
    });
    check(colState !== null, 'Collection state accessible');
    if (colState) {
      check(colState.projectCount > 0, 'Has ' + colState.projectCount + ' project(s)');
      check(colState.firstProjectTitle !== null, 'First project: ' + colState.firstProjectTitle);
      check(colState.hasStudies === true, 'First project has study data');
    }

    // =========================================================
    // 6. Open the first project in CINeMA workspace
    // =========================================================
    console.log('\n--- Step 6: Open project in CINeMA ---');
    const openResult = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      if (mgr && mgr.collection && mgr.collection.projects.length > 0) {
        const proj = mgr.collection.projects[0];
        window.Actions.ProjectManager.openProject(proj.id);
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
    // 9. Navigate back to Collections page
    // =========================================================
    console.log('\n--- Step 9: Back to Collections ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
    await page.waitForTimeout(DELAY);
    await screenshot(page, 'back_to_collections', step++);

    // Verify collection is still intact after round-trip
    const afterRoundTrip = await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      return mgr && mgr.collection && mgr.collection.projects.length > 0;
    });
    check(afterRoundTrip, 'Collection intact after round-trip through evaluation');

    // =========================================================
    // 10. Export project as .cnm
    // =========================================================
    console.log('\n--- Step 10: Export project as .cnm ---');
    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    await page.evaluate(() => {
      const mgr = window.Model.getState().projectManager;
      if (mgr && mgr.collection && mgr.collection.projects[0]) {
        window.Actions.ProjectManager.exportProject(mgr.collection.projects[0].id);
      }
    });

    const dl = await downloadPromise;
    if (dl) {
      const dlPath = path.join(SCREENSHOT_DIR, await dl.suggestedFilename());
      await dl.saveAs(dlPath);
      check(true, 'Project .cnm exported: ' + await dl.suggestedFilename());

      // Validate exported file is valid v3
      const exported = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
      check(exported.cinema && exported.cinema.version === '3.0.0', 'Exported file is v3 format');
      check(exported.cinema.projects.length === 1, 'Exported file has 1 project');
    } else {
      console.log('  (i) Download event not captured (may need --headless=false)');
    }

    // =========================================================
    // 11. Export collection as .cdb
    // =========================================================
    console.log('\n--- Step 11: Export collection as .cdb ---');
    const dlPromise2 = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

    await page.evaluate(() => {
      window.Actions.ProjectManager.exportCollection();
    });

    const dl2 = await dlPromise2;
    if (dl2) {
      const dlPath2 = path.join(SCREENSHOT_DIR, await dl2.suggestedFilename());
      await dl2.saveAs(dlPath2);
      check(true, 'Collection .cdb exported: ' + await dl2.suggestedFilename());

      const exportedCol = JSON.parse(fs.readFileSync(dlPath2, 'utf8'));
      check(exportedCol.cinema && exportedCol.cinema.version === '3.0.0', 'Exported .cdb is v3 format');
      check(exportedCol.cinema.projects.length > 0, 'Exported .cdb has projects');
    } else {
      console.log('  (i) Download event not captured (may need --headless=false)');
    }

    // =========================================================
    // 12. Verify UI elements on collections page
    // =========================================================
    console.log('\n--- Step 12: Verify collections page UI ---');
    const uiState = await page.evaluate(() => {
      return {
        hasResetButton: document.querySelector('[onclick*="resetApp"]') !== null
                     || document.querySelector('button.btn-danger') !== null,
        hasUploadCnm: document.querySelector('#pmUploadProject') !== null,
        hasUploadCsv: document.querySelector('#pmUploadCSV') !== null,
        hasUploadCdb: document.querySelector('#pmUploadCollection'),
        projectCount: window.Model.getState().projectManager.collection.projects.length,
      };
    });
    check(uiState.hasResetButton, 'Reset CINeMA button present');
    check(uiState.hasUploadCnm, 'Upload Project (.cnm) button present');
    check(uiState.hasUploadCsv, 'Upload Dataset (.csv) button present');
    check(!uiState.hasUploadCdb, 'Upload Collection (.cdb) hidden when collection active');
    check(uiState.projectCount === 1, 'Collection still has 1 project');
    await screenshot(page, 'collections_ui_verified', step++);

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
