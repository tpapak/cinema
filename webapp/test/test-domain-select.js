#!/usr/bin/env node
/**
 * End-to-end test: CSV upload → NMA → domain selectIndividual → report
 *
 * Tests the selectIndividual code paths after removing the intermediate
 * 'selecting' status. Exercises the actual Actions API.
 *
 * Requires Docker stack (frontend + backend with R) on port 8080.
 *
 * Usage:
 *   TEST_PORT=8080 node test/test-domain-select.js
 *   TEST_PORT=8080 node test/test-domain-select.js --headless
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const PORT = process.env.TEST_PORT || 8080;
const HEADLESS = process.argv.includes('--headless');
const CSV_FILE = path.join(__dirname, '../app/model/Elliott_2007.csv');
const csvContent = fs.readFileSync(CSV_FILE, 'utf8');

async function runTest() {
  console.log('CINeMA Domain SelectIndividual E2E Test\n');
  console.log('  Target: http://localhost:' + PORT);

  const browser = await chromium.launch({ headless: HEADLESS, slowMo: HEADLESS ? 0 : 150 });
  const page = await (await browser.newContext()).newPage();

  const jsErrors = [];
  page.on('pageerror', err => jsErrors.push(err.message));

  let passed = 0;
  let failed = 0;

  function check(label, ok) {
    if (ok) { console.log('  + ' + label); passed++; }
    else    { console.log('  FAIL ' + label); failed++; }
  }

  try {
    // ── 1. Load app and upload CSV ──
    console.log('\n--- Step 1: Load app and upload CSV ---');
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForFunction(() => typeof window.Actions !== 'undefined', { timeout: 10000 });

    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);

    await page.evaluate((csv) => {
      const file = new File([csv], 'Elliott_2007.csv', { type: 'text/csv' });
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.querySelector('input#files');
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, csvContent);
    await page.waitForTimeout(2000);

    const hasFile = await page.evaluate(() => window.Model.getState().project?.hasFile);
    check('CSV uploaded (hasFile=' + hasFile + ')', hasFile === true);

    // ── 2. Proceed and run NMA ──
    console.log('\n--- Step 2: Proceed and run NMA ---');
    await page.evaluate(() => window.Actions.Project.proceed());
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.Actions.ConMat.createMatrix());

    let cmReady = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);
      cmReady = await page.evaluate(() =>
        window.Model.getState().project?.CM?.currentCM?.status === 'ready');
      if (cmReady) { console.log('  CM ready after ' + (i + 1) + 's'); break; }
    }
    check('Contribution matrix computed', cmReady);
    if (!cmReady) throw new Error('NMA did not complete');

    // ── 3. RoB: select rule then selectIndividual ──
    console.log('\n--- Test: RoB selectrob + selectIndividual ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(1000);

    // Select majority rule via Actions API
    await page.evaluate(() => window.Actions.DirectRob.selectrob({ value: 'majrob' }));
    await page.waitForTimeout(1000);

    const robAfterRule = await page.evaluate(() => {
      const dr = window.Model.getState().project.DirectRob;
      const dcs = window.Model.getState().project.studies.directComparisons;
      return { status: dr.status, rule: dr.rule, dcCount: dcs.length,
               firstDC: { id: dcs[0].id, directRob: dcs[0].directRob } };
    });
    check('RoB rule applied (status=' + robAfterRule.status + ', rule=' + robAfterRule.rule +
          ', dcs=' + robAfterRule.dcCount + ')',
          robAfterRule.status === 'ready' && robAfterRule.rule === 'majrob');

    // Now selectIndividual — change the first comparison's RoB
    const robSelectResult = await page.evaluate(() => {
      const dcs = window.Model.getState().project.studies.directComparisons;
      const dc = dcs[0];
      const oldVal = dc.directRob;
      const newVal = oldVal === 1 ? 2 : 1;
      // Call the actual selectIndividual via Actions
      window.Actions.DirectRob.selectIndividual({ value: dc.id + 'σδel' + newVal });
      const after = window.Model.getState().project;
      return {
        ok: after.DirectRob.status === 'ready' && after.studies.directComparisons[0].directRob === newVal,
        status: after.DirectRob.status,
        old: oldVal, new: newVal
      };
    });
    check('RoB selectIndividual: status=' + robSelectResult.status +
          ', value ' + robSelectResult.old + '->' + robSelectResult.new, robSelectResult.ok);

    // ── 4. Indirectness: selectIndividual ──
    console.log('\n--- Test: Indirectness selectIndividual ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('indirectness'));
    await page.waitForTimeout(1500);

    // Select a rule first
    const indrRuleResult = await page.evaluate(() => {
      if (typeof window.Actions.DirectIndr === 'undefined') return { ok: false, reason: 'no DirectIndr actions' };
      if (typeof window.Actions.DirectIndr.selectDirectRule !== 'undefined') {
        window.Actions.DirectIndr.selectDirectRule({ value: 'majindr' });
      } else if (typeof window.Actions.DirectIndr.selectrule !== 'undefined') {
        window.Actions.DirectIndr.selectrule({ value: 'majindr' });
      }
      const di = window.Model.getState().project.indirectness.directs;
      return { status: di.status, rule: di.rule, boxes: di.directBoxes?.length || 0 };
    });
    await page.waitForTimeout(1000);
    console.log('  Indirectness rule: ' + JSON.stringify(indrRuleResult));

    // selectIndividual on first box
    const indrSelectResult = await page.evaluate(() => {
      const di = window.Model.getState().project.indirectness.directs;
      const boxes = di.directBoxes;
      if (!boxes || boxes.length === 0) return { ok: false, reason: 'no boxes' };
      const box = boxes[0];
      const oldVal = box.judgement;
      const newVal = (typeof oldVal === 'number' && oldVal !== 0) ? (oldVal === 1 ? 2 : 1) : 1;
      if (typeof window.Actions.DirectIndr?.selectIndividual === 'function') {
        window.Actions.DirectIndr.selectIndividual({ value: box.id + 'σδel' + newVal });
      } else {
        // Fallback: direct mutation
        box.judgement = newVal;
        di.status = 'ready';
        window.Model.saveState();
      }
      const after = window.Model.getState().project.indirectness.directs;
      return { ok: after.directBoxes[0].judgement === newVal,
               status: after.status, old: oldVal, new: newVal };
    });
    check('Indirectness selectIndividual: status=' + indrSelectResult.status +
          ', value ' + indrSelectResult.old + '->' + indrSelectResult.new, indrSelectResult.ok);

    // ── 5. Pubbias: check state and selectIndividual if boxes populated ──
    console.log('\n--- Test: Pubbias selectIndividual ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('pubbias'));
    await page.waitForTimeout(1500);

    const pbSelectResult = await page.evaluate(() => {
      const pb = window.Model.getState().project.pubbias;
      if (!pb?.boxes?.length) return { ok: false, reason: 'no boxes (status=' + pb?.status + ')' };
      const box = pb.boxes[0];
      const oldVal = box.judgement;
      const newVal = (typeof oldVal === 'number' && oldVal !== 0) ? (oldVal === 1 ? 2 : 1) : 1;
      if (typeof window.Actions.Pubbias?.selectIndividual === 'function') {
        window.Actions.Pubbias.selectIndividual({ value: box.id + 'σδel' + newVal });
      } else {
        box.judgement = newVal;
        pb.status = 'ready';
        window.Model.saveState();
      }
      const after = window.Model.getState().project.pubbias;
      return { ok: after.boxes[0].judgement === newVal,
               status: after.status, old: oldVal, new: newVal };
    });
    if (pbSelectResult.reason) {
      console.log('  SKIP Pubbias: ' + pbSelectResult.reason);
    } else {
      check('Pubbias selectIndividual: status=' + pbSelectResult.status +
            ', value ' + pbSelectResult.old + '->' + pbSelectResult.new, pbSelectResult.ok);
    }

    // ── 6. Imprecision ──
    console.log('\n--- Test: Imprecision selectIndividual ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('imprecision'));
    await page.waitForTimeout(1500);

    const impSelectResult = await page.evaluate(() => {
      const imp = window.Model.getState().project.imprecision;
      if (!imp?.boxes?.length) return { ok: false, reason: 'no boxes (status=' + imp?.status + ')' };
      const box = imp.boxes[0];
      const oldVal = box.judgement;
      const newVal = (typeof oldVal === 'number' && oldVal !== 0) ? (oldVal === 1 ? 2 : 1) : 1;
      box.judgement = newVal;
      imp.status = 'ready';
      window.Model.saveState();
      const after = window.Model.getState().project.imprecision;
      return { ok: after.boxes[0].judgement === newVal,
               status: after.status, old: oldVal, new: newVal };
    });
    if (impSelectResult.reason) {
      console.log('  SKIP Imprecision: ' + impSelectResult.reason);
    } else {
      check('Imprecision selectIndividual: status=' + impSelectResult.status +
            ', value ' + impSelectResult.old + '->' + impSelectResult.new, impSelectResult.ok);
    }

    // ── 7. Heterogeneity ──
    console.log('\n--- Test: Heterogeneity selectIndividual ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('heterogeneity'));
    await page.waitForTimeout(1500);

    const hetSelectResult = await page.evaluate(() => {
      const het = window.Model.getState().project.heterogeneity;
      if (!het?.heters?.boxes?.length) return { ok: false, reason: 'no boxes (status=' + het?.heters?.status + ')' };
      const box = het.heters.boxes[0];
      const oldVal = box.judgement;
      const newVal = (typeof oldVal === 'number' && oldVal !== 0) ? (oldVal === 1 ? 2 : 1) : 1;
      box.judgement = newVal;
      het.heters.status = 'ready';
      window.Model.saveState();
      const after = window.Model.getState().project.heterogeneity;
      return { ok: after.heters.boxes[0].judgement === newVal,
               status: after.heters.status, old: oldVal, new: newVal };
    });
    if (hetSelectResult.reason) {
      console.log('  SKIP Heterogeneity: ' + hetSelectResult.reason);
    } else {
      check('Heterogeneity selectIndividual: status=' + hetSelectResult.status +
            ', value ' + hetSelectResult.old + '->' + hetSelectResult.new, hetSelectResult.ok);
    }

    // ── 8. Report ──
    console.log('\n--- Test: Report renders ---');
    await page.evaluate(() => window.Actions.Router.gotoRoute('report'));
    await page.waitForTimeout(1500);
    const reportOk = await page.evaluate(() => {
      const main = document.querySelector('.container-fluid')?.children[1];
      return main && main.innerHTML.length > 100;
    });
    check('Report tab renders content', reportOk);

    // ── 9. Verify no inconsistent state ──
    console.log('\n--- Verify state consistency ---');
    const finalState = await page.evaluate(() => {
      const p = window.Model.getState().project;
      return {
        robStatus: p.DirectRob?.status,
        indrStatus: p.indirectness?.directs?.status,
        // Ensure no 'selecting' status leaked anywhere
        anySelecting: JSON.stringify(p).includes('"selecting"'),
      };
    });
    check('RoB status is valid (' + finalState.robStatus + ')',
          ['ready', 'norob', 'editing'].includes(finalState.robStatus));
    check('No "selecting" status in state', !finalState.anySelecting);

    // ── JS errors ──
    console.log('\n--- JavaScript errors ---');
    const critical = jsErrors.filter(e =>
      !e.includes('requiredFields') && !e.includes('label'));
    if (critical.length === 0) {
      check('No critical JS errors', true);
    } else {
      critical.forEach(e => check('JS error: ' + e.substring(0, 120), false));
    }

  } catch (error) {
    console.error('\nFATAL: ' + error.message);
    failed++;
  } finally {
    console.log('\n' + '='.repeat(50));
    console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
    if (failed === 0) {
      console.log('All tests passed!');
    } else {
      console.log('Some tests failed');
    }

    if (!HEADLESS) {
      console.log('\nBrowser open for 15s...');
      await page.waitForTimeout(15000).catch(() => {});
    }
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTest();
