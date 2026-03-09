#!/usr/bin/env node
/**
 * Test that all tabs render correctly after uploading a .cnm project file
 */

const { chromium } = require('playwright');
const path = require('path');

const PROJECT_FILE = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');
const PORT = process.env.TEST_PORT || 9000;

const TABS_TO_TEST = [
  { route: 'general', expectedContent: 'contentGeneral' },
  { route: 'rob', expectedContent: 'directSelectionWrapper' },  // This is the actual ID in the old version
  { route: 'imprecision', expectedContent: 'refvals' },  // This is the actual ID in the old version
  { route: 'heterogeneity', expectedContent: null }, // Check it renders something
  { route: 'incoherence', expectedContent: null },
  { route: 'indirectness', expectedContent: null },
  { route: 'pubbias', expectedContent: null },  // Check it renders something
];

async function runTest() {
  console.log('🧪 Testing all tabs after uploading diabetes_basic.cnm\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  let passed = 0;
  let failed = 0;
  
  try {
    // Load app
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Go to project page
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);
    
    // Upload .cnm file
    const fileInput = await page.$('input#uploadProject');
    await fileInput.setInputFiles(PROJECT_FILE);
    await page.waitForTimeout(2000);
    
    // Check state after upload
    const afterUpload = await page.evaluate(() => ({
      hasFile: window.Model?.getState()?.project?.hasFile,
      currentRoute: window.Model?.getState()?.router?.currentRoute,
      cmStatus: window.Model?.getState()?.project?.CM?.currentCM?.status,
      version: window.Model?.getState()?.version
    }));
    console.log('State after upload:', JSON.stringify(afterUpload));
    console.log('✓ Project uploaded\n');
    
    // Test each tab
    for (const tab of TABS_TO_TEST) {
      // Reset to project first to ensure clean navigation
      await page.evaluate(() => {
        window.Model.getState().router.currentRoute = 'project';
      });
      
      // Navigate to the tab
      await page.evaluate((route) => {
        window.Actions.Router.gotoRoute(route);
      }, tab.route);
      await page.waitForTimeout(1000);
      
      // Check if content rendered
      const result = await page.evaluate((expectedContent) => {
        const mainContent = document.querySelector('.container-fluid')?.children[1];
        return {
          mainContentId: mainContent?.id || 'none',
          mainContentExists: !!mainContent,
          hasContent: mainContent?.innerHTML?.length > 100
        };
      }, tab.expectedContent);
      
      const success = tab.expectedContent 
        ? result.mainContentId === tab.expectedContent
        : result.hasContent;
      
      if (success) {
        console.log(`✓ ${tab.route}: ${result.mainContentId}`);
        passed++;
      } else {
        console.log(`✗ ${tab.route}: expected ${tab.expectedContent || 'content'}, got ${result.mainContentId}`);
        failed++;
      }
    }
    
    console.log(`\n${'='.repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('✅ All tabs render correctly!');
    } else {
      console.log('❌ Some tabs failed to render');
    }
    
    // Keep browser open for inspection
    console.log('\nWaiting 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error(`\n❌ Test error: ${error.message}`);
    await page.waitForTimeout(30000);
  } finally {
    await browser.close();
  }
}

runTest();
