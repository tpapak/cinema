#!/usr/bin/env node
/**
 * Debug virtual-dom rendering differences between old and new version
 */

const { chromium } = require('playwright');
const path = require('path');

const PROJECT_FILE_V2 = path.join(__dirname, '../../project-manager/diabetes_basicv2.cnm');
const PROJECT_FILE_V3 = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');

async function debugVersion(port, projectFile, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${label} - Port ${port}`);
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console
  page.on('console', msg => {
    if (msg.text().includes('[DEBUG]')) {
      console.log(`  ${msg.text()}`);
    }
  });
  
  try {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Clear and reload
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Go to project
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);
    
    // Upload project
    const fileInput = await page.$('input#uploadProject');
    await fileInput.setInputFiles(projectFile);
    await page.waitForTimeout(3000);
    
    console.log('\n📤 After upload:');
    const afterUpload = await page.evaluate(() => ({
      stateRoute: window.Model?.getState()?.router?.currentRoute,
      domContent: document.querySelector('.container-fluid')?.children[1]?.id
    }));
    console.log(`  State route: ${afterUpload.stateRoute}`);
    console.log(`  DOM content: ${afterUpload.domContent}`);
    
    // Now manually navigate to general then to rob
    console.log('\n🔀 Navigate to general:');
    await page.evaluate(() => window.Actions.Router.gotoRoute('general'));
    await page.waitForTimeout(1000);
    
    const afterGeneral = await page.evaluate(() => ({
      stateRoute: window.Model?.getState()?.router?.currentRoute,
      domContent: document.querySelector('.container-fluid')?.children[1]?.id
    }));
    console.log(`  State route: ${afterGeneral.stateRoute}`);
    console.log(`  DOM content: ${afterGeneral.domContent}`);
    
    console.log('\n🔀 Navigate to rob:');
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(1000);
    
    const afterRob = await page.evaluate(() => ({
      stateRoute: window.Model?.getState()?.router?.currentRoute,
      domContent: document.querySelector('.container-fluid')?.children[1]?.id
    }));
    console.log(`  State route: ${afterRob.stateRoute}`);
    console.log(`  DOM content: ${afterRob.domContent}`);
    
    // Check what the ROB render returns
    console.log('\n🔍 Checking ROB child module:');
    const robCheck = await page.evaluate(() => {
      // Find the ROB route child
      const state = window.Model?.getState();
      return {
        hasDirectRob: !!state?.project?.DirectRob,
        directRobStatus: state?.project?.DirectRob?.status,
        hasNetRob: !!state?.project?.netRob,
        netRobStatus: state?.project?.netRob?.status,
      };
    });
    console.log(`  DirectRob exists: ${robCheck.hasDirectRob}, status: ${robCheck.directRobStatus}`);
    console.log(`  netRob exists: ${robCheck.hasNetRob}, status: ${robCheck.netRobStatus}`);
    
    console.log('\nWaiting 20 seconds for inspection...');
    await page.waitForTimeout(20000);
    
  } finally {
    await browser.close();
  }
}

async function main() {
  // Test old version
  await debugVersion(83, PROJECT_FILE_V2, 'OLD VERSION (v2)');
  
  // Test new version
  await debugVersion(9000, PROJECT_FILE_V3, 'NEW VERSION (v3)');
}

main();
