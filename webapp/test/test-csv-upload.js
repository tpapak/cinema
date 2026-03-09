#!/usr/bin/env node
/**
 * CSV Upload End-to-End Test for CINeMA webapp
 *
 * Tests the complete CSV upload → column recognition → project creation
 * → Proceed → Configuration flow. Can run against:
 *   - Live production:  cinema.med.auth.gr  (--live)
 *   - Local dev server: localhost:9000       (default)
 *   - Local dist build: localhost:9999       (--dist)
 *
 * The CSV upload is done via the File API (DataTransfer injection)
 * because Playwright can't access host files inside Docker/remote contexts.
 *
 * Usage:
 *   node test/test-csv-upload.js              # Test local dev server
 *   node test/test-csv-upload.js --live       # Test cinema.med.auth.gr
 *   node test/test-csv-upload.js --dist       # Test production build
 *   node test/test-csv-upload.js --headless   # Run headless
 *   node test/test-csv-upload.js --slow       # Extra delays for recording
 *   node test/test-csv-upload.js --pm         # Test Project Manager CSV upload
 *
 * Modes:
 *   Default (no --pm):  Tests the original project.js fetchProject flow
 *                        (My Projects → upload CSV → auto-detect → Proceed)
 *   --pm:               Tests the Project Manager uploadCSV flow
 *                        (Projects page → Upload Dataset → auto-detect → Proceed)
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const DIST = args.includes('--dist');
const HEADLESS = args.includes('--headless');
const SLOW = args.includes('--slow');
const PM_MODE = args.includes('--pm');
const PORT = DIST ? 9999 : (process.env.TEST_PORT || 9000);
const BASE_URL = LIVE
  ? 'https://cinema.med.auth.gr'
  : 'http://localhost:' + PORT;
const BASE_DIR = path.join(__dirname, '..');
const CSV_FILE = path.join(__dirname, '../app/model/Elliott_2007.csv');
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
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath);
      const types = {
        '.html': 'text/html', '.js': 'application/javascript',
        '.css': 'text/css', '.json': 'application/json',
        '.png': 'image/png', '.svg': 'image/svg+xml',
        '.csv': 'text/csv', '.woff': 'font/woff',
        '.woff2': 'font/woff2', '.ttf': 'font/ttf',
      };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function screenshot(page, name, step) {
  const filename = path.join(SCREENSHOT_DIR, `csv_${String(step).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log('    [screenshot] ' + filename);
}

async function runTests() {
  const MODE_LABEL = PM_MODE ? 'Project Manager CSV upload' : 'Legacy project.js CSV upload';
  console.log('CINeMA CSV Upload Test (' + MODE_LABEL + ')\n');
  console.log('  Target: ' + BASE_URL);
  console.log('  Mode:   ' + (HEADLESS ? 'headless' : 'interactive'));
  console.log('  Speed:  ' + (SLOW ? 'slow (demo)' : 'normal'));

  // Read the CSV content that we'll inject via File API
  let csvContent;
  if (fs.existsSync(CSV_FILE)) {
    csvContent = fs.readFileSync(CSV_FILE, 'utf8');
    console.log('  CSV:    ' + CSV_FILE + ' (' + csvContent.length + ' bytes)');
  } else {
    console.log('  CSV:    will fetch from server (model/Elliott_2007.csv)');
    csvContent = null; // will fetch in-browser
  }

  let server = null;
  if (DIST) {
    server = createDistServer();
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log('  Dist server on port ' + PORT);
  } else if (!LIVE) {
    try { await fetch('http://localhost:' + PORT + '/'); }
    catch (e) {
      console.error('  No server at localhost:' + PORT + '. Start with: gulp serve');
      process.exit(1);
    }
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : (SLOW ? 500 : 200),
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: LIVE, // cinema.med.auth.gr may have cert issues
  });
  const page = await context.newPage();

  // Collect errors
  const jsErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
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
    // 1. Load app
    // =========================================================
    console.log('\n--- Step 1: Load app ---');
    await page.goto(BASE_URL + '/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    await page.waitForFunction(() => {
      return typeof window.Actions !== 'undefined' &&
             typeof window.Actions.Router !== 'undefined';
    }, { timeout: 15000 });
    await page.waitForTimeout(DELAY);
    check(true, 'App loaded at ' + BASE_URL);
    await screenshot(page, 'welcome', step++);

    if (PM_MODE) {
      // =======================================================
      // PROJECT MANAGER MODE: Upload CSV via the PM uploadCSV
      // =======================================================
      await runProjectManagerCSVFlow(page, csvContent, check, screenshot, step, DELAY);
    } else {
      // =======================================================
      // LEGACY MODE: Upload CSV via project.js fetchProject
      // =======================================================
      await runLegacyCSVFlow(page, csvContent, check, screenshot, step, DELAY);
    }

    // =========================================================
    // Check for JS errors
    // =========================================================
    console.log('\n--- JavaScript errors ---');
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('NetworkError') && !e.includes('ocpu') &&
      !e.includes('fetch') && !e.includes('rserver')
    );
    if (criticalErrors.length === 0) {
      check(true, 'No critical JavaScript errors');
    } else {
      check(false, criticalErrors.length + ' critical JS error(s):');
      criticalErrors.slice(0, 10).forEach(e => console.log('      ' + e.substring(0, 200)));
    }

  } catch (error) {
    console.log('\n  FATAL: ' + error.message);
    console.log(error.stack);
    failed++;
  } finally {
    if (!HEADLESS) {
      console.log('\n  Browser stays open for 10 seconds for inspection...');
      await page.waitForTimeout(10000).catch(() => {});
    }
    await browser.close();
    if (server) server.close();
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (failed === 0) {
    console.log('CSV upload test PASSED');
  } else {
    console.log('CSV upload test FAILED');
    process.exit(1);
  }
  return { passed, failed };
}

// ==============================================================
// LEGACY FLOW: Upload CSV through project.js fetchProject
// This replicates exactly what cinema.med.auth.gr does
// ==============================================================
async function runLegacyCSVFlow(page, csvContent, check, screenshot, step, DELAY) {
  // 2. Navigate to My Projects (the project upload page)
  console.log('\n--- Step 2: Navigate to Project page ---');
  await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
  await page.waitForTimeout(DELAY);

  const hasFilesInput = await page.evaluate(() => {
    return document.querySelector('#files') !== null;
  });
  check(hasFilesInput, 'Dataset uploader with #files input found');
  await screenshot(page, 'project_page', step++);

  // 3. Upload CSV via File API injection
  console.log('\n--- Step 3: Upload CSV file ---');
  const uploadResult = await page.evaluate(async (csv) => {
    // If csv is null, fetch it from the server
    let csvText = csv;
    if (!csvText) {
      const resp = await fetch('model/Elliott_2007.csv');
      csvText = await resp.text();
    }

    // Create a File object and inject into #files input
    const file = new File([csvText], 'Elliott_2007.csv', { type: 'text/csv' });
    const dt = new DataTransfer();
    dt.items.add(file);

    const input = document.querySelector('#files');
    if (!input) return { error: 'input#files not found' };

    input.files = dt.files;

    // Trigger onchange — fetchProject is bound via onchange="Actions.Project.fetchProject(this)"
    // We need to call it directly since the DOM attribute handler expects `this` = the input
    window.Actions.Project.fetchProject(input);

    return { ok: true, csvLength: csvText.length };
  }, csvContent);

  check(!uploadResult.error, 'CSV uploaded via File API (' + (uploadResult.csvLength || '?') + ' bytes)');
  await page.waitForTimeout(DELAY * 2);
  await screenshot(page, 'csv_uploaded', step++);

  // 4. Verify project details rendered
  console.log('\n--- Step 4: Verify project recognition ---');
  const projectState = await page.evaluate(() => {
    try {
      const p = window.Model.getState().project;
      return {
        hasFile: p.hasFile,
        title: p.title,
        filename: p.filename,
        format: p.format,
        type: p.type,
        isRecognized: p.isRecognized,
        hasStudies: typeof p.studies !== 'undefined',
        numStudies: p.studies ? Object.keys(_.groupBy(p.studies.long, 'id')).length : 0,
        numNodes: p.studies ? p.studies.nodes.length : 0,
        numDirect: p.studies ? p.studies.directComparisons.length : 0,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  check(!projectState.error, 'Project state accessible');
  check(projectState.hasFile === true, 'project.hasFile = true');
  check(projectState.title === 'Elliott_2007', 'project.title = "Elliott_2007"');
  check(projectState.format === 'long', 'Auto-detected format = "long"');
  check(projectState.type === 'binary', 'Auto-detected type = "binary"');
  check(projectState.isRecognized === true, 'File was auto-recognized');
  check(projectState.hasStudies === true, 'Studies were built');
  check(projectState.numStudies === 22, '22 studies: got ' + projectState.numStudies);
  check(projectState.numNodes === 6, '6 treatments: got ' + projectState.numNodes);
  check(projectState.numDirect === 14, '14 direct comparisons: got ' + projectState.numDirect);
  await screenshot(page, 'project_details', step++);

  // 5. Verify the "Proceed" button is visible and the summary shows
  console.log('\n--- Step 5: Verify Summary and Proceed ---');
  const uiCheck = await page.evaluate(() => {
    const html = document.querySelector('#project').innerHTML;
    return {
      hasProceed: html.includes('Proceed'),
      hasSummary: html.includes('Summary'),
      hasStudiesLabel: html.includes('Studies'),
      hasInterventions: html.includes('Interventions'),
      hasComparisons: html.includes('Comparisons'),
      hasFormatBadge: html.includes('long'),
      hasTypeBadge: html.includes('binary'),
    };
  });
  check(uiCheck.hasProceed, '"Proceed" button present');
  check(uiCheck.hasSummary, 'Summary section present');
  check(uiCheck.hasStudiesLabel, 'Studies count shown');
  check(uiCheck.hasInterventions, 'Interventions count shown');
  check(uiCheck.hasComparisons, 'Comparisons count shown');
  check(uiCheck.hasFormatBadge, 'Format "long" badge shown');
  check(uiCheck.hasTypeBadge, 'Outcome "binary" badge shown');

  // 6. Click Proceed → Configuration page
  console.log('\n--- Step 6: Click Proceed ---');
  await page.evaluate(() => {
    window.Actions.Project.proceed();
  });
  await page.waitForTimeout(DELAY * 2);

  const currentRoute = await page.evaluate(() => {
    return window.Model.getState().router.currentRoute;
  });
  check(currentRoute === 'general', 'Routed to Configuration (general): got "' + currentRoute + '"');
  await screenshot(page, 'configuration_page', step++);

  // 7. Verify Configuration page content
  console.log('\n--- Step 7: Verify Configuration page ---');
  const configCheck = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      hasNetworkPlot: html.includes('Network Plot'),
      hasAnalysisModel: html.includes('Analysis model') || html.includes('Define your analysis'),
      hasFixedEffect: html.includes('Fixed effect'),
      hasRandomEffects: html.includes('Random effects'),
      hasEffectMeasure: html.includes('Effect measure') || html.includes('Odds Ratio'),
      hasInterventions: html.includes('Interventions') || html.includes('intervention'),
      hasACE: html.includes('ACE'),
      hasBBlocker: html.includes('BBlocker'),
      hasCCB: html.includes('CCB'),
      hasDiuretic: html.includes('Diuretic'),
      hasARB: html.includes('ARB'),
      hasPlacebo: html.includes('Placebo'),
    };
  });
  check(configCheck.hasNetworkPlot, 'Network Plot section present');
  check(configCheck.hasAnalysisModel, 'Analysis model section present');
  check(configCheck.hasFixedEffect, 'Fixed effect option present');
  check(configCheck.hasRandomEffects, 'Random effects option present');
  check(configCheck.hasEffectMeasure, 'Effect measure selector present');
  check(configCheck.hasACE, 'ACE treatment listed');
  check(configCheck.hasBBlocker, 'BBlocker treatment listed');
  check(configCheck.hasCCB, 'CCB treatment listed');
  check(configCheck.hasDiuretic, 'Diuretic treatment listed');
  check(configCheck.hasARB, 'ARB treatment listed');
  check(configCheck.hasPlacebo, 'Placebo treatment listed');
  await screenshot(page, 'configuration_verified', step++);

  // 8. Verify the comparison matrix data table
  console.log('\n--- Step 8: Verify comparison data ---');
  const tableCheck = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    let rowCount = 0;
    if (tables.length > 0) {
      const rows = tables[0].querySelectorAll('tbody tr');
      rowCount = rows.length;
    }
    return {
      tableCount: tables.length,
      rowCount: rowCount,
      hasStudyNames: document.body.innerHTML.includes('AASK') &&
                     document.body.innerHTML.includes('ALLHAT'),
    };
  });
  check(tableCheck.tableCount > 0, 'Data table(s) rendered: ' + tableCheck.tableCount + ' table(s)');
  check(tableCheck.rowCount > 0, 'Comparison rows present: ' + tableCheck.rowCount + ' rows');
  check(tableCheck.hasStudyNames, 'Study names visible (AASK, ALLHAT)');
}

// ==============================================================
// PROJECT MANAGER FLOW: Upload CSV via PM.update.uploadCSV
// This tests our new uploadCSV function in projectManager.js
// ==============================================================
async function runProjectManagerCSVFlow(page, csvContent, check, screenshot, step, DELAY) {
  // 2. Navigate to Collections (Project Manager)
  console.log('\n--- Step 2: Navigate to Project Manager ---');
  await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
  await page.waitForTimeout(DELAY);

  const pmVisible = await page.evaluate(() => {
    return document.querySelector('#project-manager') !== null;
  });
  check(pmVisible, 'Project Manager page rendered');
  await screenshot(page, 'pm_page', step++);

  // 3. Create a collection (needed for PM CSV upload)
  console.log('\n--- Step 3: Create collection ---');
  await page.evaluate(() => window.Actions.ProjectManager.newCollection('CSV Test Collection'));
  await page.waitForTimeout(DELAY);

  const hasCollection = await page.evaluate(() => {
    const mgr = window.Model.getState().projectManager;
    return mgr && mgr.collection && mgr.collection.title === 'CSV Test Collection';
  });
  check(hasCollection, 'Collection created: CSV Test Collection');

  // 4. Check that the CSV upload input exists
  console.log('\n--- Step 4: Verify CSV upload input ---');
  const hasCsvInput = await page.evaluate(() => {
    return document.querySelector('#pmUploadCSV') !== null;
  });
  check(hasCsvInput, 'CSV upload input (#pmUploadCSV) found');
  await screenshot(page, 'pm_collection_ready', step++);

  // 5. Upload CSV via File API injection into #pmUploadCSV
  console.log('\n--- Step 5: Upload CSV via Project Manager ---');
  const uploadResult = await page.evaluate(async (csv) => {
    let csvText = csv;
    if (!csvText) {
      try {
        const resp = await fetch('model/Elliott_2007.csv');
        csvText = await resp.text();
      } catch (e) {
        return { error: 'Could not fetch CSV: ' + e.message };
      }
    }

    const file = new File([csvText], 'Elliott_2007.csv', { type: 'text/csv' });
    const dt = new DataTransfer();
    dt.items.add(file);

    const input = document.querySelector('#pmUploadCSV');
    if (!input) return { error: 'input#pmUploadCSV not found' };

    input.files = dt.files;

    // Trigger change event (jQuery delegation picks this up)
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);

    return { ok: true, csvLength: csvText.length };
  }, csvContent);

  check(!uploadResult.error, 'CSV injected and change triggered (' + (uploadResult.csvLength || '?') + ' bytes)');
  await page.waitForTimeout(DELAY * 3);
  await screenshot(page, 'pm_csv_uploaded', step++);

  // 6. Verify project was created in legacy state
  console.log('\n--- Step 6: Verify project state after PM CSV upload ---');
  const projectState = await page.evaluate(() => {
    try {
      const p = window.Model.getState().project;
      return {
        hasFile: p.hasFile,
        title: p.title,
        filename: p.filename,
        format: p.format,
        type: p.type,
        isRecognized: p.isRecognized,
        hasStudies: typeof p.studies !== 'undefined',
        numStudies: p.studies ? Object.keys(_.groupBy(p.studies.long, 'id')).length : 0,
        numNodes: p.studies ? p.studies.nodes.length : 0,
        numDirect: p.studies ? p.studies.directComparisons.length : 0,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  check(!projectState.error, 'Project state accessible');
  check(projectState.hasFile === true, 'project.hasFile = true');
  check(projectState.title === 'Elliott_2007', 'project.title = "Elliott_2007"');
  check(projectState.format === 'long', 'Auto-detected format = "long"');
  check(projectState.type === 'binary', 'Auto-detected type = "binary"');
  check(projectState.hasStudies === true, 'Studies were built');
  check(projectState.numStudies === 22, '22 studies: got ' + projectState.numStudies);
  check(projectState.numNodes === 6, '6 treatments: got ' + projectState.numNodes);
  check(projectState.numDirect === 14, '14 direct comparisons: got ' + projectState.numDirect);

  // 7. Verify we were routed to the project (configuration) page
  console.log('\n--- Step 7: Verify routing after CSV upload ---');
  const currentRoute = await page.evaluate(() => {
    return window.Model.getState().router.currentRoute;
  });
  check(currentRoute === 'project', 'Routed to project page: got "' + currentRoute + '"');
  await screenshot(page, 'pm_csv_project_page', step++);

  // 8. Verify the project page shows summary and Proceed
  console.log('\n--- Step 8: Verify project page content ---');
  const uiCheck = await page.evaluate(() => {
    const body = document.body.innerHTML;
    return {
      hasProceed: body.includes('Proceed'),
      hasSummary: body.includes('Summary'),
      hasStudiesLabel: body.includes('Studies'),
      hasFormatBadge: body.includes('long'),
      hasTypeBadge: body.includes('binary'),
      hasProjectDetails: body.includes('Project details'),
    };
  });
  check(uiCheck.hasProjectDetails, 'Project details section present');
  check(uiCheck.hasProceed, '"Proceed" button present');
  check(uiCheck.hasSummary, 'Summary section present');
  check(uiCheck.hasFormatBadge, 'Format "long" shown');
  check(uiCheck.hasTypeBadge, 'Outcome "binary" shown');

  // 9. Click Proceed → Configuration page
  console.log('\n--- Step 9: Click Proceed to Configuration ---');
  await page.evaluate(() => {
    window.Actions.Project.proceed();
  });
  await page.waitForTimeout(DELAY * 2);

  const configRoute = await page.evaluate(() => {
    return window.Model.getState().router.currentRoute;
  });
  check(configRoute === 'general', 'Routed to Configuration: got "' + configRoute + '"');
  await screenshot(page, 'pm_csv_configuration', step++);

  // 10. Verify Configuration content
  console.log('\n--- Step 10: Verify Configuration page ---');
  const configCheck = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      hasNetworkPlot: html.includes('Network Plot'),
      hasAnalysisModel: html.includes('Analysis model') || html.includes('Define your analysis'),
      hasACE: html.includes('ACE'),
      hasPlacebo: html.includes('Placebo'),
      hasDiuretic: html.includes('Diuretic'),
    };
  });
  check(configCheck.hasNetworkPlot, 'Network Plot section present');
  check(configCheck.hasAnalysisModel, 'Analysis model section present');
  check(configCheck.hasACE, 'ACE treatment listed');
  check(configCheck.hasPlacebo, 'Placebo treatment listed');
  check(configCheck.hasDiuretic, 'Diuretic treatment listed');
  await screenshot(page, 'pm_csv_config_verified', step++);

  // 11. Navigate back to Projects and verify the project is in the collection
  console.log('\n--- Step 11: Verify project visible in Projects page ---');
  await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
  await page.waitForTimeout(DELAY * 2);

  const collectionState = await page.evaluate(() => {
    try {
      const mgr = window.Model.getState().projectManager;
      if (!mgr || !mgr.collection) return { error: 'No collection found' };
      return {
        collectionTitle: mgr.collection.title,
        projectCount: mgr.collection.projects.length,
        activeProjectId: mgr.activeProjectId,
        projects: mgr.collection.projects.map(p => ({
          id: p.id,
          title: p.title,
          hasDataset: !!(p.dataset && p.dataset.studies && p.dataset.studies.length > 0),
          studyCount: (p.dataset && p.dataset.studies) ? p.dataset.studies.length : 0,
        })),
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  check(!collectionState.error, 'Collection state accessible');
  check(collectionState.projectCount === 1, 'Collection has 1 project: got ' + collectionState.projectCount);
  if (collectionState.projects && collectionState.projects.length > 0) {
    const proj = collectionState.projects[0];
    check(proj.title === 'Elliott_2007', 'Project title is "Elliott_2007": got "' + proj.title + '"');
    check(proj.hasDataset === true, 'Project has dataset with studies');
    check(proj.studyCount > 0, 'Project has ' + proj.studyCount + ' study arms');
  }
  check(collectionState.activeProjectId !== null, 'Project is marked as active');

  // Verify the project row is visible in the DOM
  const domCheck = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      hasProjectRow: html.includes('Elliott_2007'),
      hasActiveIndicator: html.includes('active') || html.includes('Active'),
    };
  });
  check(domCheck.hasProjectRow, 'Project "Elliott_2007" visible in Projects table');
  check(domCheck.hasActiveIndicator, 'Active project indicator shown');
  await screenshot(page, 'pm_csv_back_to_projects', step++);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
