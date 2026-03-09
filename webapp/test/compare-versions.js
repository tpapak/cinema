#!/usr/bin/env node
/**
 * Compare old version (port 83) vs new version (port 9000) after uploading project
 */

const { chromium } = require('playwright');
const path = require('path');

const PROJECT_FILE_V2 = path.join(__dirname, '../../project-manager/diabetes_basicv2.cnm');
const PROJECT_FILE_V3 = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');

async function testVersion(port, projectFile, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${label} on port ${port}`);
  console.log(`Project file: ${path.basename(projectFile)}`);
  console.log('='.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = {};
  
  try {
    // Load app
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Clear localStorage first
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    // Go to project page
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);
    
    // Upload .cnm file
    const fileInput = await page.$('input#uploadProject');
    if (!fileInput) {
      console.log('ERROR: File input not found');
      return null;
    }
    await fileInput.setInputFiles(projectFile);
    await page.waitForTimeout(3000);
    
    // Get localStorage
    results.localStorage = await page.evaluate(() => {
      const data = localStorage.getItem('GRADEmodel');
      if (!data) return null;
      try {
        const parsed = JSON.parse(data);
        return {
          version: parsed.version,
          hasProject: !!parsed.project,
          hasFile: parsed.project?.hasFile,
          currentRoute: parsed.router?.currentRoute,
          cmStatus: parsed.project?.CM?.currentCM?.status,
          directRobStatus: parsed.project?.DirectRob?.status,
          netRobStatus: parsed.project?.netRob?.status,
          hasStudies: !!parsed.project?.studies,
          studiesCount: parsed.project?.studies?.directComparisons?.length
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    // Get current state
    results.state = await page.evaluate(() => {
      const state = window.Model?.getState();
      if (!state) return null;
      return {
        version: state.version,
        hasProject: !!state.project,
        hasFile: state.project?.hasFile,
        currentRoute: state.router?.currentRoute,
        cmStatus: state.project?.CM?.currentCM?.status,
        directRobStatus: state.project?.DirectRob?.status,
        netRobStatus: state.project?.netRob?.status,
        hasStudies: !!state.project?.studies,
        studiesCount: state.project?.studies?.directComparisons?.length
      };
    });
    
    // Get DOM state
    results.dom = await page.evaluate(() => {
      const container = document.querySelector('.container-fluid');
      const mainContent = container?.children[1];
      return {
        mainContentId: mainContent?.id || 'none',
        mainContentClass: mainContent?.className || 'none',
        hasHeader: !!document.querySelector('#header'),
        hasFooter: !!document.querySelector('.footerContainer'),
        // Check for specific content elements
        hasDirectSelectionWrapper: !!document.querySelector('#directSelectionWrapper'),
        hasContentStudyLimitations: !!document.querySelector('#contentStudyLimitations'),
        hasNetRob: !!document.querySelector('#netRob'),
        hasContentGeneral: !!document.querySelector('#contentGeneral'),
        hasContentProject: !!document.querySelector('#contentProject')
      };
    });
    
    console.log('\n📦 localStorage after upload:');
    console.log(JSON.stringify(results.localStorage, null, 2));
    
    console.log('\n🧠 Model state:');
    console.log(JSON.stringify(results.state, null, 2));
    
    console.log('\n🖼️  DOM state:');
    console.log(JSON.stringify(results.dom, null, 2));
    
    // Now test navigation to each route
    console.log('\n🔀 Testing navigation:');
    const routes = ['general', 'rob', 'imprecision', 'heterogeneity', 'incoherence', 'indirectness', 'pubbias'];
    results.navigation = {};
    
    for (const route of routes) {
      await page.evaluate((r) => window.Actions.Router.gotoRoute(r), route);
      await page.waitForTimeout(500);
      
      const navResult = await page.evaluate(() => {
        const container = document.querySelector('.container-fluid');
        const mainContent = container?.children[1];
        return {
          mainContentId: mainContent?.id || 'none',
          stateRoute: window.Model?.getState()?.router?.currentRoute
        };
      });
      
      results.navigation[route] = navResult;
      const match = navResult.stateRoute === route ? '✓' : '✗';
      console.log(`  ${match} ${route}: state=${navResult.stateRoute}, dom=${navResult.mainContentId}`);
    }
    
    return results;
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('🔬 Comparing old version (v2) vs new version (v3)\n');
  
  // Test old version with v2 project file
  const oldResults = await testVersion(83, PROJECT_FILE_V2, 'OLD VERSION (v2.0.0)');
  
  // Test new version with v3 project file  
  const newResults = await testVersion(9000, PROJECT_FILE_V3, 'NEW VERSION (v3.0.0)');
  
  // Compare results
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(60));
  
  if (oldResults && newResults) {
    console.log('\nLocalStorage comparison:');
    console.log('  Old hasFile:', oldResults.localStorage?.hasFile);
    console.log('  New hasFile:', newResults.localStorage?.hasFile);
    console.log('  Old cmStatus:', oldResults.localStorage?.cmStatus);
    console.log('  New cmStatus:', newResults.localStorage?.cmStatus);
    console.log('  Old currentRoute:', oldResults.localStorage?.currentRoute);
    console.log('  New currentRoute:', newResults.localStorage?.currentRoute);
    
    console.log('\nNavigation comparison:');
    const routes = ['general', 'rob', 'imprecision', 'heterogeneity', 'incoherence', 'indirectness', 'pubbias'];
    for (const route of routes) {
      const oldNav = oldResults.navigation?.[route];
      const newNav = newResults.navigation?.[route];
      const oldOk = oldNav?.stateRoute === route;
      const newOk = newNav?.stateRoute === route;
      const domMatch = oldNav?.mainContentId === newNav?.mainContentId;
      console.log(`  ${route}:`);
      console.log(`    Old: state=${oldNav?.stateRoute}, dom=${oldNav?.mainContentId} ${oldOk ? '✓' : '✗'}`);
      console.log(`    New: state=${newNav?.stateRoute}, dom=${newNav?.mainContentId} ${newOk ? '✓' : '✗'}`);
      console.log(`    DOM match: ${domMatch ? '✓' : '✗ DIFFERENT'}`);
    }
  }
}

main();
