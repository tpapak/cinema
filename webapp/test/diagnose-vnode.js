#!/usr/bin/env node
/**
 * Diagnose VNode version compatibility issue
 * 
 * This test checks if VNodes created by html-to-vdom are recognized
 * by virtual-dom's diff function.
 */

const { chromium } = require('playwright');
const path = require('path');

const PROJECT_FILE = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');

async function main() {
  console.log('🔍 Diagnosing VNode version compatibility...\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture all console messages
  page.on('console', msg => console.log(`  [BROWSER] ${msg.text()}`));
  
  try {
    await page.goto('http://localhost:9000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Clear and reload
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Go to project and upload
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(500);
    
    const fileInput = await page.$('input#uploadProject');
    await fileInput.setInputFiles(PROJECT_FILE);
    await page.waitForTimeout(3000);
    
    // Navigate to rob
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(2000);
    
    // Inject diagnostic code
    console.log('\n📊 Running VNode diagnostics in browser...\n');
    
    const diagnostics = await page.evaluate(() => {
      // Get references to the modules via the bundle
      // We'll inspect the vtree objects
      
      const results = {
        tests: []
      };
      
      // Check if we can access vtree through window or module scope
      // The bundle exposes these through closure, not globally
      
      // Check the current DOM structure
      const containerFluid = document.querySelector('.container-fluid');
      results.containerFluidChildren = containerFluid ? 
        Array.from(containerFluid.children).map(c => ({
          tagName: c.tagName,
          id: c.id,
          className: c.className
        })) : [];
      
      // Check state
      results.currentRoute = window.Model?.getState()?.router?.currentRoute;
      
      // Check if View object is accessible
      results.hasView = typeof window.View !== 'undefined';
      
      // Try to access vtree from View if available
      if (window.View && window.View.vtree) {
        const vtree = window.View.vtree;
        results.vtreeType = vtree.type;
        results.vtreeVersion = vtree.version;
        results.vtreeTagName = vtree.tagName;
        
        if (vtree.children && vtree.children.length > 0) {
          results.vtreeChildrenCount = vtree.children.length;
          
          // Check first child
          const firstChild = vtree.children[0];
          if (firstChild) {
            results.firstChild = {
              type: firstChild.type,
              version: firstChild.version,
              tagName: firstChild.tagName,
              hasCount: 'count' in firstChild,
              constructorName: firstChild.constructor?.name
            };
          }
          
          // Check if there are nested children with html-to-vdom output
          if (vtree.children[1]) {
            const secondChild = vtree.children[1];
            results.secondChild = {
              type: secondChild.type,
              version: secondChild.version,
              tagName: secondChild.tagName,
              constructorName: secondChild.constructor?.name
            };
            
            // Check deep children
            if (secondChild.children && secondChild.children[0]) {
              const deepChild = secondChild.children[0];
              results.deepChild = {
                type: deepChild.type,
                version: deepChild.version,
                tagName: deepChild.tagName,
                constructorName: deepChild.constructor?.name
              };
            }
          }
        }
      }
      
      return results;
    });
    
    console.log('📋 Diagnostic Results:\n');
    console.log('  Current route:', diagnostics.currentRoute);
    console.log('  Container children:', JSON.stringify(diagnostics.containerFluidChildren, null, 2));
    console.log('  Has View object:', diagnostics.hasView);
    
    if (diagnostics.vtreeType) {
      console.log('\n  VTree (root):');
      console.log('    type:', diagnostics.vtreeType);
      console.log('    version:', diagnostics.vtreeVersion);
      console.log('    tagName:', diagnostics.vtreeTagName);
      console.log('    children count:', diagnostics.vtreeChildrenCount);
    }
    
    if (diagnostics.firstChild) {
      console.log('\n  First Child (header):');
      console.log('    type:', diagnostics.firstChild.type);
      console.log('    version:', diagnostics.firstChild.version);
      console.log('    tagName:', diagnostics.firstChild.tagName);
      console.log('    constructor:', diagnostics.firstChild.constructorName);
    }
    
    if (diagnostics.secondChild) {
      console.log('\n  Second Child (content):');
      console.log('    type:', diagnostics.secondChild.type);
      console.log('    version:', diagnostics.secondChild.version);
      console.log('    tagName:', diagnostics.secondChild.tagName);
      console.log('    constructor:', diagnostics.secondChild.constructorName);
    }
    
    if (diagnostics.deepChild) {
      console.log('\n  Deep Child (html-to-vdom output):');
      console.log('    type:', diagnostics.deepChild.type);
      console.log('    version:', diagnostics.deepChild.version);
      console.log('    tagName:', diagnostics.deepChild.tagName);
      console.log('    constructor:', diagnostics.deepChild.constructorName);
    }
    
    console.log('\n\n⏳ Browser will stay open for 30 seconds for manual inspection...');
    console.log('   Open DevTools and check: View.vtree, diff, patch functions');
    await page.waitForTimeout(30000);
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
