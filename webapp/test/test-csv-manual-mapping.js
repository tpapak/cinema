#!/usr/bin/env node
/**
 * CSV Manual Column Mapping End-to-End Test for CINeMA webapp
 *
 * Tests the flow when a CSV has non-standard column names that
 * can't be auto-detected:
 *   Upload CSV → select Format/Type → map columns → Check file → Proceed
 *
 * Uses Elliott_2007_custom_columns.csv which has renamed headers:
 *   StudyName,StudyID,Treatment,Events,SampleSize,RiskOfBias,Indir
 * instead of the expected:
 *   study,id,t,r,n,rob,indirectness
 *
 * Usage:
 *   node test/test-csv-manual-mapping.js              # interactive
 *   node test/test-csv-manual-mapping.js --headless    # headless
 *   node test/test-csv-manual-mapping.js --slow        # slow demo
 *   node test/test-csv-manual-mapping.js --pm          # Project Manager path
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const HEADLESS = args.includes('--headless');
const SLOW = args.includes('--slow');
const PM_MODE = args.includes('--pm');
const PORT = process.env.TEST_PORT || 9000;
const BASE_URL = 'http://localhost:' + PORT;
const CSV_FILE = path.join(__dirname, 'Elliott_2007_custom_columns.csv');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const DELAY = SLOW ? 3000 : 1000;

// Column mapping: required field → CSV column name
const COLUMN_MAP = {
  id: 'StudyID',
  t: 'Treatment',
  r: 'Events',
  n: 'SampleSize',
  rob: 'RiskOfBias',
  indirectness: 'Indir',
};

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page, name, step) {
  const filename = path.join(SCREENSHOT_DIR, `manual_${String(step).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log('    [screenshot] ' + filename);
}

async function runTests() {
  const MODE_LABEL = PM_MODE ? 'Project Manager path' : 'Legacy path';
  console.log('CINeMA Manual Column Mapping Test (' + MODE_LABEL + ')\n');
  console.log('  Target: ' + BASE_URL);
  console.log('  Mode:   ' + (HEADLESS ? 'headless' : 'interactive'));
  console.log('  Speed:  ' + (SLOW ? 'slow (demo)' : 'normal'));

  const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
  console.log('  CSV:    ' + CSV_FILE + ' (' + csvContent.length + ' bytes)');
  console.log('  Columns: ' + csvContent.split('\n')[0].trim());

  // Verify dev server
  try { await fetch(BASE_URL + '/'); }
  catch (e) {
    console.error('  No server at ' + BASE_URL + '. Start with: cd webapp && gulp serve');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: HEADLESS,
    slowMo: HEADLESS ? 0 : (SLOW ? 500 : 200),
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });
  const page = await context.newPage();

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
    await page.goto(BASE_URL + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => {
      return typeof window.Actions !== 'undefined' &&
             typeof window.Actions.Router !== 'undefined';
    }, { timeout: 15000 });
    await page.waitForTimeout(DELAY);
    check(true, 'App loaded');
    await screenshot(page, 'welcome', step++);

    if (PM_MODE) {
      // Create collection first
      console.log('\n--- Step 2: Create collection via PM ---');
      await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
      await page.waitForTimeout(DELAY);
      await page.evaluate(() => window.Actions.ProjectManager.newCollection('Manual Mapping Test'));
      await page.waitForTimeout(DELAY);
      check(true, 'Collection created');
      await screenshot(page, 'pm_collection', step++);

      // Upload CSV via PM
      console.log('\n--- Step 3: Upload custom CSV via PM ---');
      const uploadResult = await page.evaluate(async (csv) => {
        const file = new File([csv], 'Elliott_2007_custom_columns.csv', { type: 'text/csv' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector('#pmUploadCSV');
        if (!input) return { error: '#pmUploadCSV not found' };
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
      }, csvContent);
      check(!uploadResult.error, 'CSV uploaded via PM');
      await page.waitForTimeout(DELAY * 2);
    } else {
      // Legacy path: navigate to project page
      console.log('\n--- Step 2: Navigate to Project page ---');
      await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
      await page.waitForTimeout(DELAY);
      await screenshot(page, 'project_page', step++);

      // Upload CSV via legacy #files input
      console.log('\n--- Step 3: Upload custom CSV via legacy ---');
      const uploadResult = await page.evaluate(async (csv) => {
        const file = new File([csv], 'Elliott_2007_custom_columns.csv', { type: 'text/csv' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.querySelector('#files');
        if (!input) return { error: '#files not found' };
        input.files = dt.files;
        window.Actions.Project.fetchProject(input);
        return { ok: true };
      }, csvContent);
      check(!uploadResult.error, 'CSV uploaded via legacy');
      await page.waitForTimeout(DELAY * 2);
    }

    // =========================================================
    // 4. Verify file is NOT auto-recognized
    // =========================================================
    console.log('\n--- Step 4: Verify file NOT auto-recognized ---');
    const projectState = await page.evaluate(() => {
      try {
        const p = window.Model.getState().project;
        return {
          hasFile: p.hasFile,
          title: p.title,
          isRecognized: p.isRecognized,
          hasFormat: typeof p.format !== 'undefined' && p.format !== null,
          hasType: typeof p.type !== 'undefined' && p.type !== null,
          hasStudies: typeof p.studies !== 'undefined',
          columns: p.rawData ? p.rawData.columns : [],
        };
      } catch (e) {
        return { error: e.message };
      }
    });

    check(!projectState.error, 'Project state accessible');
    check(projectState.hasFile === true, 'project.hasFile = true');
    check(projectState.isRecognized === false, 'File NOT auto-recognized (isRecognized = false)');
    check(projectState.hasStudies === false, 'No studies built yet');
    check(projectState.columns.includes('StudyID'), 'Custom column "StudyID" found');
    check(projectState.columns.includes('Events'), 'Custom column "Events" found');
    check(projectState.columns.includes('Indir'), 'Custom column "Indir" found');
    await screenshot(page, 'not_recognized', step++);

    // =========================================================
    // 5. Select Format = long, Type = binary
    // =========================================================
    console.log('\n--- Step 5: Select Format and Type ---');
    // Make sure we're on the project page for the selection UI
    const currentRoute = await page.evaluate(() => window.Model.getState().router.currentRoute);
    if (currentRoute !== 'project') {
      await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
      await page.waitForTimeout(DELAY);
    }

    // Select format = long
    await page.evaluate(() => {
      window.Actions.Project.selectFormat({ value: 'long' });
    });
    await page.waitForTimeout(DELAY / 2);

    // Select type = binary
    await page.evaluate(() => {
      window.Actions.Project.selectType({ value: 'binary' });
    });
    await page.waitForTimeout(DELAY / 2);

    // Save format/type selection
    await page.evaluate(() => {
      window.Actions.Project.saveFormatType();
    });
    await page.waitForTimeout(DELAY);

    const afterSave = await page.evaluate(() => {
      const p = window.Model.getState().project;
      return {
        format: p.format,
        type: p.type,
        hasSettings: typeof p.settings !== 'undefined' && p.settings !== null,
        requiredCount: p.settings ? p.settings.required.length : 0,
      };
    });

    check(afterSave.format === 'long', 'Format set to "long"');
    check(afterSave.type === 'binary', 'Type set to "binary"');
    check(afterSave.hasSettings, 'Settings object created');
    check(afterSave.requiredCount === 6, 'Required fields: ' + afterSave.requiredCount + ' (expected 6: id,t,r,n,rob,indirectness)');
    await screenshot(page, 'format_type_saved', step++);

    // =========================================================
    // 6. Map columns
    // =========================================================
    console.log('\n--- Step 6: Map columns to fields ---');
    const mapResult = await page.evaluate((colMap) => {
      try {
        const fields = Object.keys(colMap);
        for (const field of fields) {
          window.Actions.Project.selectColumn({ value: colMap[field] }, field);
        }
        return { ok: true };
      } catch (e) {
        return { error: e.message };
      }
    }, COLUMN_MAP);

    check(!mapResult.error, 'All columns mapped');
    await page.waitForTimeout(DELAY);

    // Verify all required fields are mapped
    const mappingState = await page.evaluate(() => {
      const p = window.Model.getState().project;
      const reqs = p.settings.required;
      const mapped = reqs.filter(r => r.selected !== '--');
      return {
        mappedCount: mapped.length,
        totalRequired: reqs.length,
        mappings: reqs.map(r => r.name + ' → ' + r.selected),
        allSelected: mapped.length === reqs.length,
      };
    });

    check(mappingState.allSelected, 'All ' + mappingState.totalRequired + ' required fields mapped');
    mappingState.mappings.forEach(m => console.log('      ' + m));
    await screenshot(page, 'columns_mapped', step++);

    // =========================================================
    // 7. Click "Check file"
    // =========================================================
    console.log('\n--- Step 7: Check file ---');
    await page.evaluate(() => {
      return window.Actions.Project.checkFile();
    });
    await page.waitForTimeout(DELAY * 2);

    const afterCheck = await page.evaluate(() => {
      const p = window.Model.getState().project;
      return {
        hasStudies: typeof p.studies !== 'undefined',
        numStudies: p.studies ? Object.keys(_.groupBy(p.studies.long, 'id')).length : 0,
        numNodes: p.studies ? p.studies.nodes.length : 0,
        numDirect: p.studies ? p.studies.directComparisons.length : 0,
        canProceed: typeof p.studies !== 'undefined' && p.format && p.type,
      };
    });

    check(afterCheck.hasStudies, 'Studies built after Check file');
    check(afterCheck.numStudies === 22, '22 studies: got ' + afterCheck.numStudies);
    check(afterCheck.numNodes === 6, '6 treatments: got ' + afterCheck.numNodes);
    check(afterCheck.numDirect === 14, '14 direct comparisons: got ' + afterCheck.numDirect);
    check(afterCheck.canProceed, 'Can now Proceed');
    await screenshot(page, 'file_checked', step++);

    // =========================================================
    // 8. Click Proceed → Configuration
    // =========================================================
    console.log('\n--- Step 8: Proceed to Configuration ---');
    await page.evaluate(() => {
      window.Actions.Project.proceed();
    });
    await page.waitForTimeout(DELAY * 2);

    const configRoute = await page.evaluate(() => window.Model.getState().router.currentRoute);
    check(configRoute === 'general', 'Routed to Configuration: got "' + configRoute + '"');
    await screenshot(page, 'configuration', step++);

    // =========================================================
    // 9. Verify Configuration page
    // =========================================================
    console.log('\n--- Step 9: Verify Configuration page ---');
    const configCheck = await page.evaluate(() => {
      const html = document.body.innerHTML;
      return {
        hasNetworkPlot: html.includes('Network Plot'),
        hasACE: html.includes('ACE'),
        hasBBlocker: html.includes('BBlocker'),
        hasCCB: html.includes('CCB'),
        hasDiuretic: html.includes('Diuretic'),
        hasARB: html.includes('ARB'),
        hasPlacebo: html.includes('Placebo'),
      };
    });
    check(configCheck.hasNetworkPlot, 'Network Plot present');
    check(configCheck.hasACE, 'ACE treatment listed');
    check(configCheck.hasBBlocker, 'BBlocker treatment listed');
    check(configCheck.hasCCB, 'CCB treatment listed');
    check(configCheck.hasDiuretic, 'Diuretic treatment listed');
    check(configCheck.hasARB, 'ARB treatment listed');
    check(configCheck.hasPlacebo, 'Placebo treatment listed');
    await screenshot(page, 'config_verified', step++);

    // =========================================================
    // 10. If PM mode, verify project in collection
    // =========================================================
    if (PM_MODE) {
      console.log('\n--- Step 10: Verify project in collection ---');
      await page.evaluate(() => window.Actions.Router.gotoRoute('collections'));
      await page.waitForTimeout(DELAY * 2);

      const colState = await page.evaluate(() => {
        const mgr = window.Model.getState().projectManager;
        if (!mgr || !mgr.collection) return { error: 'No collection' };
        return {
          projectCount: mgr.collection.projects.length,
          activeProjectId: mgr.activeProjectId,
          projects: mgr.collection.projects.map(p => ({
            title: p.title,
            hasDataset: !!(p.dataset && p.dataset.studies && p.dataset.studies.length > 0),
          })),
        };
      });

      check(!colState.error, 'Collection accessible');
      check(colState.projectCount === 1, 'Collection has 1 project: got ' + colState.projectCount);
      if (colState.projects && colState.projects.length > 0) {
        check(colState.projects[0].hasDataset, 'Project has dataset');
      }
      check(colState.activeProjectId !== null, 'Project is active');
      await screenshot(page, 'back_to_projects', step++);
    }

    // =========================================================
    // JS errors check
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
  }

  console.log('\n' + '='.repeat(50));
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (failed === 0) {
    console.log('Manual column mapping test PASSED');
  } else {
    console.log('Manual column mapping test FAILED');
    process.exit(1);
  }
  return { passed, failed };
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
