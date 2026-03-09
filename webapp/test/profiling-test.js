#!/usr/bin/env node
/**
 * Automated Profiling Test for CINeMA webapp
 * 
 * Simulates realistic user interactions:
 * - Upload project
 * - Select Average ROB, press Reset
 * - Select Maximum, change some boxes
 * - Proceed and select Minimum
 * 
 * Collects timing data for render performance analysis.
 */

const { chromium } = require('playwright');
const path = require('path');

const PROJECT_FILE = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');

async function runProfilingTest() {
  console.log('='.repeat(60));
  console.log('CINeMA Rendering Performance Profiling');
  console.log('='.repeat(60));
  console.log('');
  
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  try {
    // ============================================
    // PHASE 1: Initial Load
    // ============================================
    console.log('PHASE 1: Initial Load');
    console.log('-'.repeat(40));
    
    await page.goto('http://localhost:9000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Clear localStorage and reset profiling
    await page.evaluate(() => {
      localStorage.clear();
      if (Model && Model._profiling) Model._profiling.reset();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    let phase1Data = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls during initial load: ${phase1Data.totalCalls}`);
    console.log('');
    
    // ============================================
    // PHASE 2: Upload Project
    // ============================================
    console.log('PHASE 2: Upload Project File');
    console.log('-'.repeat(40));
    
    await page.evaluate(() => Model._profiling.reset());
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);
    
    const fileInput = await page.$('input#uploadProject');
    await fileInput.setInputFiles(PROJECT_FILE);
    await page.waitForTimeout(4000);
    
    let phase2Data = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls during upload: ${phase2Data.totalCalls}`);
    
    // ============================================
    // PHASE 3: ROB - Select Average, then Reset
    // ============================================
    console.log('');
    console.log('PHASE 3: ROB - Select Average Rule, then Reset');
    console.log('-'.repeat(40));
    
    // Make sure we're on ROB
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(1000);
    
    await page.evaluate(() => Model._profiling.reset());
    
    // Select "Average RoB" rule from the dropdown (real DOM interaction)
    const robRuleSelectPhase3 = await page.$('#netRob select');
    if (robRuleSelectPhase3) {
      await robRuleSelectPhase3.selectOption({ value: 'meanRule' });
    }
    await page.waitForTimeout(500);
    
    let phase3aData = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls for "Average" selection: ${phase3aData.totalCalls}`);
    
    // Click Reset button (real DOM interaction)
    await page.evaluate(() => Model._profiling.reset());
    const resetButton = await page.$('#netRob button:has-text("Reset")');
    if (resetButton) {
      await resetButton.click();
      await page.waitForTimeout(300);
      
      // Handle the confirmation dialog - click OK
      const okButton = await page.$('.alertify .ajs-ok, .alertify button:has-text("Ok")');
      if (okButton) {
        await okButton.click();
        await page.waitForTimeout(500);
      }
    }
    
    let phase3bData = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls for "Reset": ${phase3bData.totalCalls}`);
    
    // Clean up any remaining dialogs
    await page.evaluate(() => {
      document.querySelectorAll('.alertify, .ajs-modal, .ajs-dimmer, .ajs-message').forEach(el => el.remove());
    });
    await page.waitForTimeout(200);
    
    // ============================================
    // PHASE 4: ROB - Select Maximum, change boxes via real DOM interactions
    // ============================================
    console.log('');
    console.log('PHASE 4: ROB - Select Maximum, change individual boxes (DOM)');
    console.log('-'.repeat(40));
    
    // Verify we're on ROB route
    let currentRoute = await page.evaluate(() => window.Model.getState().router.currentRoute);
    console.log(`  Current route: ${currentRoute}`);
    if (currentRoute !== 'rob') {
      console.log('  WARNING: Not on ROB route, navigating...');
      await page.click('a[href="#rob"]');
      await page.waitForTimeout(500);
    }
    
    await page.evaluate(() => Model._profiling.reset());
    
    // Select "Highest RoB" rule from the dropdown (real DOM interaction)
    const robRuleSelect = await page.$('#netRob select');
    if (robRuleSelect) {
      await robRuleSelect.selectOption({ value: 'maxRule' });
    } else {
      console.log('  WARNING: ROB rule select not found');
    }
    await page.waitForTimeout(500);
    
    let phase4aData = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls for "Maximum" selection: ${phase4aData.totalCalls}`);
    
    // Change individual boxes using the actual select dropdowns in the DOM
    await page.evaluate(() => Model._profiling.reset());
    
    // Find all box select elements in the ROB section
    const robBoxSelects = await page.$$('#netRobSelector .compRobSelector select');
    console.log(`  Found ${robBoxSelects.length} ROB box dropdowns`);
    
    let boxChanges = 0;
    const maxBoxes = Math.min(5, robBoxSelects.length);
    for (let i = 0; i < maxBoxes; i++) {
      try {
        // Get the options for this select
        const options = await robBoxSelects[i].$$('option:not([disabled])');
        if (options.length > 1) {
          // Select a different option (cycle through available options)
          const optionIndex = (boxChanges % (options.length - 1)) + 1; // Skip first non-disabled
          const optionValue = await options[optionIndex].getAttribute('value');
          await robBoxSelects[i].selectOption({ value: optionValue });
          boxChanges++;
          await page.waitForTimeout(300);
        }
      } catch (e) {
        console.log(`  Error changing ROB box ${i}: ${e.message}`);
      }
    }
    
    let phase4bData = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Changed ${boxChanges} boxes`);
    console.log(`  Render calls for box changes: ${phase4bData.totalCalls}`);
    if (boxChanges > 0) {
      console.log(`  Renders per box change: ${(phase4bData.totalCalls / boxChanges).toFixed(1)}`);
      
      // Analyze empty patches
      let viewRenders = phase4bData.calls.filter(c => c.event === 'view:render');
      let emptyPatches = viewRenders.filter(r => r.data.patchCount === 0).length;
      if (viewRenders.length > 0) {
        console.log(`  View renders: ${viewRenders.length}`);
        console.log(`  Empty patches (redundant): ${emptyPatches} (${(emptyPatches/viewRenders.length*100).toFixed(0)}%)`);
      }
    }
    
    // Dismiss any alertify notifications and dialogs
    await page.evaluate(() => {
      document.querySelectorAll('.ajs-message, .alertify').forEach(el => el.remove());
    });
    await page.waitForTimeout(200);
    
    // ============================================
    // PHASE 4b: Indirectness - Select rule, change boxes via real DOM interactions
    // ============================================
    console.log('');
    console.log('PHASE 4b: Indirectness - Select rule, change individual boxes (DOM)');
    console.log('-'.repeat(40));
    
    // Dismiss any remaining dialogs before navigation
    await page.evaluate(() => {
      document.querySelectorAll('.alertify, .ajs-modal, .ajs-dimmer').forEach(el => el.remove());
    });
    await page.waitForTimeout(200);
    
    // Navigate to Indirectness tab by clicking the link
    await page.click('a[href="#indirectness"]');
    await page.waitForTimeout(500);
    
    // Verify we're on Indirectness route
    currentRoute = await page.evaluate(() => window.Model.getState().router.currentRoute);
    console.log(`  Current route: ${currentRoute}`);
    if (currentRoute !== 'indirectness') {
      console.log('  WARNING: Not on Indirectness route!');
    }
    
    await page.evaluate(() => Model._profiling.reset());
    
    // Select "Majority" rule from the dropdown (real DOM interaction)
    const indrRuleSelect = await page.$('#netIndr select');
    if (indrRuleSelect) {
      await indrRuleSelect.selectOption({ value: 'majRule' });
    } else {
      console.log('  WARNING: Indirectness rule select not found');
    }
    await page.waitForTimeout(500);
    
    let phase4cData = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls for "Majority" selection: ${phase4cData.totalCalls}`);
    
    // Change individual Indirectness boxes using actual DOM selects
    await page.evaluate(() => Model._profiling.reset());
    
    // Find all box select elements in the Indirectness section
    const indrBoxSelects = await page.$$('#netIndrSelector li[id^="comp-"] select');
    console.log(`  Found ${indrBoxSelects.length} Indirectness box dropdowns`);
    
    let indrBoxChanges = 0;
    const maxIndrBoxes = Math.min(5, indrBoxSelects.length);
    for (let i = 0; i < maxIndrBoxes; i++) {
      try {
        // Get the options for this select
        const options = await indrBoxSelects[i].$$('option:not([disabled])');
        if (options.length > 1) {
          // Select a different option (cycle through available options)
          const optionIndex = (indrBoxChanges % (options.length - 1)) + 1;
          const optionValue = await options[optionIndex].getAttribute('value');
          await indrBoxSelects[i].selectOption({ value: optionValue });
          indrBoxChanges++;
          await page.waitForTimeout(300);
        }
      } catch (e) {
        console.log(`  Error changing Indirectness box ${i}: ${e.message}`);
      }
    }
    
    let phase4dData = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Changed ${indrBoxChanges} indirectness boxes`);
    console.log(`  Render calls for box changes: ${phase4dData.totalCalls}`);
    if (indrBoxChanges > 0) {
      console.log(`  Renders per box change: ${(phase4dData.totalCalls / indrBoxChanges).toFixed(1)}`);
      
      let viewRenders = phase4dData.calls.filter(c => c.event === 'view:render');
      let emptyPatches = viewRenders.filter(r => r.data.patchCount === 0).length;
      if (viewRenders.length > 0) {
        console.log(`  View renders: ${viewRenders.length}`);
        console.log(`  Empty patches (redundant): ${emptyPatches} (${(emptyPatches/viewRenders.length*100).toFixed(0)}%)`);
      }
    }
    
    // Dismiss any alertify notifications
    await page.evaluate(() => {
      document.querySelectorAll('.ajs-message').forEach(el => el.remove());
    });
    
    // Return to ROB for next phase by clicking the link
    await page.click('a[href="#rob"]');
    await page.waitForTimeout(500)
    
    // ============================================
    // PHASE 5: Proceed to next section
    // ============================================
    console.log('');
    console.log('PHASE 5: Click Proceed');
    console.log('-'.repeat(40));
    
    // Dismiss any alertify notifications first
    await page.evaluate(() => {
      if (window.alertify) {
        window.alertify.dismissAll();
      }
      // Also try clicking away any modals
      document.querySelectorAll('.ajs-modal, .alertify').forEach(el => el.remove());
    });
    await page.waitForTimeout(500);
    
    await page.evaluate(() => Model._profiling.reset());
    
    // Navigate via Actions instead of clicking (more reliable)
    await page.evaluate(() => {
      if (window.Actions.NetIndr && window.Actions.NetIndr.proceed) {
        window.Actions.NetIndr.proceed();
      } else {
        window.Actions.Router.gotoRoute('pubbias');
      }
    });
    await page.waitForTimeout(1000);
    
    let phase5Data = await page.evaluate(() => Model._profiling.getSummary());
    let newRoute = await page.evaluate(() => window.Model.getState().router.currentRoute);
    console.log(`  Navigated to: ${newRoute}`);
    console.log(`  Render calls for Proceed: ${phase5Data.totalCalls}`);
    
    // ============================================
    // PHASE 6: Return to ROB, select Majority
    // ============================================
    console.log('');
    console.log('PHASE 6: Return to ROB, select Majority');
    console.log('-'.repeat(40));
    
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(500);
    
    await page.evaluate(() => Model._profiling.reset());
    
    await page.evaluate(() => {
      if (window.Actions.NetRob && window.Actions.NetRob.selectRule) {
        window.Actions.NetRob.selectRule({ value: 'majRule' });
      }
    });
    await page.waitForTimeout(500);
    
    let phase6Data = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls for "Majority" selection: ${phase6Data.totalCalls}`);
    
    // Analyze all renders
    let allViewRenders = phase6Data.calls.filter(c => c.event === 'view:render');
    let totalEmpty = allViewRenders.filter(r => r.data.patchCount === 0).length;
    if (allViewRenders.length > 0) {
      console.log(`  Empty patches (redundant): ${totalEmpty} (${(totalEmpty/allViewRenders.length*100).toFixed(0)}%)`);
    }
    
    // ============================================
    // PHASE 7: Navigate to Report
    // ============================================
    console.log('');
    console.log('PHASE 7: Navigate to Report');
    console.log('-'.repeat(40));
    
    // Enable report
    await page.evaluate(() => {
      if (window.Model.getState().project) {
        if (!window.Model.getState().project.report) {
          window.Model.getState().project.report = {};
        }
        window.Model.getState().project.report.status = 'ready';
      }
    });
    
    await page.evaluate(() => Model._profiling.reset());
    await page.evaluate(() => window.Actions.Router.gotoRoute('report'));
    await page.waitForTimeout(2000);
    
    let phase7Data = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Render calls for Report: ${phase7Data.totalCalls}`);
    
    let reportRenders = phase7Data.calls.filter(c => c.event === 'router:render' && c.data.route === 'report');
    if (reportRenders.length > 0 && reportRenders[0].data.reportPurescript) {
      console.log(`  PureScript render time: ${reportRenders[0].data.reportPurescript}ms`);
    }
    
    let reportViewRenders = phase7Data.calls.filter(c => c.event === 'view:render');
    if (reportViewRenders.length > 0) {
      let emptyPatches = reportViewRenders.filter(r => r.data.patchCount === 0).length;
      console.log(`  View renders: ${reportViewRenders.length}`);
      console.log(`  Empty patches (redundant): ${emptyPatches} (${(emptyPatches/reportViewRenders.length*100).toFixed(0)}%)`);
    }
    
    // ============================================
    // PHASE 8: Rapid Tab Switching
    // ============================================
    console.log('');
    console.log('PHASE 8: Rapid Tab Switching (5 cycles: ROB -> Report -> Heterogeneity)');
    console.log('-'.repeat(40));
    
    await page.evaluate(() => Model._profiling.reset());
    
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.Actions.Router.gotoRoute('report'));
      await page.waitForTimeout(300);
      await page.evaluate(() => window.Actions.Router.gotoRoute('heterogeneity'));
      await page.waitForTimeout(300);
    }
    
    let phase8Data = await page.evaluate(() => Model._profiling.getSummary());
    console.log(`  Total render calls: ${phase8Data.totalCalls}`);
    console.log(`  Calls per tab switch: ${(phase8Data.totalCalls / 15).toFixed(1)}`);
    
    // Count empty patches
    let switchViewRenders = phase8Data.calls.filter(c => c.event === 'view:render');
    let switchEmpty = switchViewRenders.filter(r => r.data.patchCount === 0).length;
    if (switchViewRenders.length > 0) {
      console.log(`  Empty patches (redundant): ${switchEmpty} (${(switchEmpty/switchViewRenders.length*100).toFixed(0)}%)`);
    }
    
    // ============================================
    // SUMMARY REPORT
    // ============================================
    console.log('');
    console.log('='.repeat(60));
    console.log('SUMMARY - Render Timing Samples');
    console.log('='.repeat(60));
    
    // Get ROB sample
    await page.evaluate(() => window.Actions.Router.gotoRoute('general'));
    await page.waitForTimeout(500);
    await page.evaluate(() => Model._profiling.reset());
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(1000);
    
    let robData = await page.evaluate(() => Model._profiling.getSummary());
    let sampleRobRender = robData.calls.find(c => c.event === 'rob:template');
    let sampleRobViewRender = robData.calls.find(c => c.event === 'view:render');
    let sampleRobRouterRender = robData.calls.find(c => c.event === 'router:render');
    
    // Get Report sample
    await page.evaluate(() => Model._profiling.reset());
    await page.evaluate(() => window.Actions.Router.gotoRoute('report'));
    await page.waitForTimeout(1000);
    
    let reportData = await page.evaluate(() => Model._profiling.getSummary());
    let sampleReportRouterRender = reportData.calls.find(c => c.event === 'router:render' && c.data.route === 'report');
    let sampleReportViewRender = reportData.calls.find(c => c.event === 'view:render' && c.data.route === 'report');
    
    console.log('');
    console.log('ROB Tab Render:');
    if (sampleRobRender) {
      console.log(`  Handlebars:     ${sampleRobRender.data.handlebars}ms`);
      console.log(`  html-to-vdom:   ${sampleRobRender.data.convertHTML}ms`);
      console.log(`  Children:       ${sampleRobRender.data.children}ms`);
    }
    if (sampleRobViewRender) {
      console.log(`  diff:           ${sampleRobViewRender.data.diff}ms`);
      console.log(`  patch:          ${sampleRobViewRender.data.patch}ms`);
      console.log(`  Patch count:    ${sampleRobViewRender.data.patchCount}`);
      console.log(`  TOTAL:          ${sampleRobViewRender.data.totalView}ms`);
    }
    
    console.log('');
    console.log('Report Tab Render:');
    if (sampleReportRouterRender) {
      console.log(`  PureScript:     ${sampleReportRouterRender.data.reportPurescript || 'N/A'}ms`);
      console.log(`  html-to-vdom:   ${sampleReportRouterRender.data.reportConvertHTML || 'N/A'}ms`);
    }
    if (sampleReportViewRender) {
      console.log(`  diff:           ${sampleReportViewRender.data.diff}ms`);
      console.log(`  patch:          ${sampleReportViewRender.data.patch}ms`);
      console.log(`  Patch count:    ${sampleReportViewRender.data.patchCount}`);
      console.log(`  TOTAL:          ${sampleReportViewRender.data.totalView}ms`);
    }
    
    console.log('');
    console.log('='.repeat(60));
    console.log('CONCLUSIONS');
    console.log('='.repeat(60));
    
    // Gather overall stats
    await page.evaluate(() => Model._profiling.reset());
    
    // Do 10 rapid actions
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
      await page.waitForTimeout(100);
      await page.evaluate(() => window.Actions.Router.gotoRoute('report'));
      await page.waitForTimeout(100);
    }
    
    let rapidData = await page.evaluate(() => Model._profiling.getSummary());
    let rapidViewRenders = rapidData.calls.filter(c => c.event === 'view:render');
    let rapidEmpty = rapidViewRenders.filter(r => r.data.patchCount === 0).length;
    
    console.log('');
    console.log(`Rapid switching (10 navigations):`);
    console.log(`  Total render calls: ${rapidData.totalCalls}`);
    console.log(`  View renders: ${rapidViewRenders.length}`);
    console.log(`  Empty patches: ${rapidEmpty} (${rapidViewRenders.length > 0 ? (rapidEmpty/rapidViewRenders.length*100).toFixed(0) : 0}%)`);
    
    if (rapidViewRenders.length > 0) {
      let avgTotal = rapidViewRenders.reduce((s, r) => s + parseFloat(r.data.totalView), 0) / rapidViewRenders.length;
      console.log(`  Avg render time: ${avgTotal.toFixed(2)}ms`);
    }
    
    console.log('');
    
    if (errors.length > 0) {
      console.log('Errors encountered:');
      errors.forEach(e => console.log(`  - ${e}`));
    }
    
  } finally {
    await browser.close();
  }
}

runProfilingTest().catch(console.error);
