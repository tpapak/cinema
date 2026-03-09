#!/usr/bin/env node
/**
 * V2 Exchange Format Upload Test for CINeMA webapp
 *
 * Tests that uploading a v2 JSON file (from MetaInsight or other NMA tools)
 * works via the v2 bridge, populates the model state correctly, and all
 * domain tabs render without errors.
 *
 * Usage:
 *   gulp serve &                       # Start dev server on port 9000
 *   node test/test-v2-upload.js        # Test against running server
 *
 * Or test against dist:
 *   gulp build
 *   node test/test-v2-upload.js --dist
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const testDist = args.includes('--dist');
const PORT = testDist ? 9999 : (process.env.TEST_PORT || 9000);
const BASE_DIR = path.join(__dirname, '..');
const V2_FILE = path.join(__dirname, '../../schemata/metainsight/export_v2.json');
const HEADLESS = args.includes('--headless');

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
        '.ico': 'image/x-icon',
        '.pdf': 'application/pdf',
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

async function runTests() {
  console.log('CINeMA V2 Exchange Format Upload Test\n');

  // Verify v2 file exists
  if (!fs.existsSync(V2_FILE)) {
    console.error('V2 export file not found: ' + V2_FILE);
    process.exit(1);
  }
  console.log('  Found v2 file: ' + V2_FILE);

  let server = null;

  if (testDist) {
    console.log('  Testing production build (dist/)...');
    server = createDistServer();
    await new Promise(resolve => server.listen(PORT, resolve));
    console.log('  Test server started on port ' + PORT);
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
  const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 200 });
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
    jsErrors.push(error.name + ': ' + error.message);
  });

  let passed = 0;
  let failed = 0;

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
    console.log('\n--- Loading app ---');
    await page.goto('http://localhost:' + PORT + '/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(1500);
    check(true, 'App loaded');

    // =========================================================
    // 2. Navigate to Projects page
    // =========================================================
    console.log('\n--- Navigating to Projects page ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);
    check(true, 'On Projects page');

    // =========================================================
    // 3. Upload v2 JSON file via file input
    // =========================================================
    console.log('\n--- Uploading v2 JSON file ---');
    const fileInput = await page.$('input#uploadProject');
    check(fileInput !== null, 'File input found');

    await fileInput.setInputFiles(V2_FILE);
    await page.waitForTimeout(3000);

    // Check v2 bridge console log
    const v2Detected = allConsoleMessages.some(m =>
      m.text.includes('Detected CINeMA v2 exchange format')
    );
    check(v2Detected, 'V2 bridge detected v2 format (console log)');

    // =========================================================
    // 4. Verify Model state after upload
    // =========================================================
    console.log('\n--- Verifying Model state ---');
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
          numRowNames: cm?.hatmatrix?.rowNames?.length,
          numColNames: cm?.hatmatrix?.colNames?.length,
          numDirectRowNames: cm?.directRowNames?.length,
          numIndirectRowNames: cm?.indirectRowNames?.length,
          numStudyContributions: cm?.studycontributions ? Object.keys(cm.studycontributions).length : 0,
          numStudiesLong: p?.studies?.long?.length,
          numNodes: p?.studies?.nodes?.length,
          numDirectComps: p?.studies?.directComparisons?.length,
          numIndirectComps: p?.studies?.indirectComparisons?.length,
          numRobs: p?.studies?.robs ? Object.keys(p.studies.robs).length : 0,
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
    check(state.numTreatments === 6, '6 treatments in network');
    check(state.numNMAresults === 15, '15 NMA comparison results');
    check(state.numRowNames === 15, '15 hat matrix row names');
    check(state.numColNames === 14, '14 hat matrix column names');
    check(state.numDirectRowNames === 14, '14 direct row names');
    check(state.numIndirectRowNames === 1, '1 indirect row name');
    check(state.numStudyContributions === 15, '15 study contribution entries');
    check(state.numStudiesLong === 48, '48 study arms (long format)');
    check(state.numNodes === 6, '6 treatment nodes');
    check(state.numDirectComps === 14, '14 direct comparisons');
    check(state.numIndirectComps === 1, '1 indirect comparison');
    check(state.numRobs === 22, '22 studies with ROB values');

    // =========================================================
    // 5. Verify NMA results data integrity (spot checks)
    // =========================================================
    console.log('\n--- Verifying NMA data integrity ---');
    const nmaChecks = await page.evaluate(() => {
      try {
        const cm = window.Model.getState().project.CM.currentCM;
        const nma = cm.hatmatrix.NMAresults;

        const aceBB = nma.find(r => r['_row'] === 'ACE:BBlocker');
        const aceARB = nma.find(r => r['_row'] === 'ACE:ARB');

        return {
          aceBB_effect: aceBB?.['NMA treatment effect'],
          aceBB_hasDirect: aceBB?.['Direct'] !== undefined,
          aceBB_hasIndirect: aceBB?.['Indirect'] !== undefined,
          aceBB_hasSIDE: aceBB?.['SideIF'] !== undefined,
          aceARB_effect: aceARB?.['NMA treatment effect'],
          aceARB_hasDirect: aceARB?.['Direct'] !== undefined,
          aceARB_hasIndirect: aceARB?.['Indirect'] !== undefined,
          aceARB_propDir: aceARB?.['PropDir'],
          heter_tau2: cm.hatmatrix.NMAheterResults?.[0]?.['heterVarNtw'],
          dbt_Q: cm.hatmatrix.dbt?.[0]?.['Q_dbt'],
          // studycontributions are re-keyed by study ID (not name)
        // AASK is study id "1"
        studyContrib_AASK: cm.studycontributions?.['ACE:ARB']?.['1'],
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    check(!nmaChecks.error, 'NMA data accessible');
    check(Math.abs(nmaChecks.aceBB_effect - (-0.0189)) < 0.001, 'ACE:BBlocker effect ~ -0.0189');
    check(nmaChecks.aceBB_hasDirect, 'ACE:BBlocker has direct estimate (mixed comparison)');
    check(nmaChecks.aceBB_hasIndirect, 'ACE:BBlocker has indirect estimate (mixed comparison)');
    check(nmaChecks.aceBB_hasSIDE, 'ACE:BBlocker has SIDE test (mixed comparison)');
    check(!nmaChecks.aceARB_hasDirect, 'ACE:ARB has NO direct estimate (indirect-only)');
    check(nmaChecks.aceARB_hasIndirect, 'ACE:ARB has indirect estimate');
    check(nmaChecks.aceARB_propDir === 0, 'ACE:ARB PropDir is 0 (indirect-only)');
    check(typeof nmaChecks.heter_tau2 === 'number', 'Network heterogeneity tau2 is present');
    check(typeof nmaChecks.dbt_Q === 'number', 'Design-by-treatment Q is present');
    check(Math.abs(nmaChecks.studyContrib_AASK - 0.4418) < 0.01, 'AASK contributes ~44% to ACE:ARB');

    // =========================================================
    // 6. Navigate to each tab and verify rendering
    // =========================================================
    console.log('\n--- Testing tab rendering ---');
    const TABS = [
      { route: 'general', name: 'Network Plot' },
      { route: 'rob', name: 'Within-study Bias' },
      { route: 'indirectness', name: 'Indirectness' },
      { route: 'imprecision', name: 'Imprecision' },
      { route: 'heterogeneity', name: 'Heterogeneity' },
      { route: 'incoherence', name: 'Incoherence' },
      { route: 'pubbias', name: 'Publication Bias' },
    ];

    for (const tab of TABS) {
      await page.evaluate((route) => {
        window.Actions.Router.gotoRoute(route);
      }, tab.route);
      await page.waitForTimeout(1500);

      const result = await page.evaluate(() => {
        const c = document.querySelector('.container-fluid');
        if (!c) return { hasContent: false, routedId: 'no-container', childCount: 0 };
        // Check for routed content: either .routed element or any content child
        // (different tabs use different patterns: some have .routed, some don't)
        const routed = c.querySelector('.routed');
        if (routed && routed.innerHTML.length > 50) {
          return { hasContent: true, routedId: routed.id || 'routed', childCount: routed.children.length };
        }
        // Fall back: check if any non-header, non-footer child has content
        let contentChild = null;
        for (let i = 0; i < c.children.length; i++) {
          const ch = c.children[i];
          if (ch.id !== 'header' && !ch.classList.contains('footerContainer') && ch.innerHTML.length > 100) {
            contentChild = ch;
            break;
          }
        }
        return {
          hasContent: !!contentChild,
          routedId: contentChild?.id || 'unnamed',
          childCount: contentChild?.children?.length || 0,
        };
      });

      check(result.hasContent, tab.name + ' (' + tab.route + '): rendered content (id=' + result.routedId + ', children=' + result.childCount + ')');
    }

    // =========================================================
    // 7. Check for critical JS errors
    // =========================================================
    console.log('\n--- JavaScript errors ---');
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('Exception') &&
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
        console.log('      ' + e.substring(0, 120));
      });
    }

    // Non-critical (expected without R server)
    const nonCritical = jsErrors.filter(e =>
      e.includes('ocpu') || e.includes('fetch') || e.includes('rserver') || e.includes('NetworkError')
    );
    if (nonCritical.length > 0) {
      console.log('  (i) ' + nonCritical.length + ' non-critical errors (expected without R server)');
    }

  } catch (error) {
    console.log('\n  FATAL: ' + error.message);
    failed++;
  } finally {
    if (!HEADLESS) {
      console.log('\n  Waiting 10 seconds for inspection...');
      await page.waitForTimeout(10000);
    }
    await browser.close();
    if (server) server.close();
  }

  // =========================================================
  // Summary
  // =========================================================
  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (failed === 0) {
    console.log('V2 upload test PASSED');
  } else {
    console.log('V2 upload test FAILED');
    process.exit(1);
  }

  return { passed, failed };
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
