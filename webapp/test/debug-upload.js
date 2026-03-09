const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROJECT_FILE = path.join(__dirname, '../../project-manager/diabetes_basic.cnm');
const PORT = 9000;

async function runTest() {
  console.log('Starting debug test...\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') {
      console.log(`[CONSOLE ERROR] ${text}`);
    } else if (msg.type() === 'warning') {
      console.log(`[CONSOLE WARN] ${text}`);
    } else if (text.includes('Router.render') || text.includes('currentRoute') || text.includes('rendering child')) {
      console.log(`[CONSOLE] ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  try {
    // Navigate to app
    console.log('1. Loading app...');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Check initial version
    const appVersion = await page.evaluate(() => {
      try {
        return window.Model.getState().version;
      } catch (e) { return 'error: ' + e.message; }
    });
    console.log(`   App version: ${appVersion}`);
    
    // Go to projects page
    console.log('\n2. Going to Projects page...');
    // Try multiple selectors for project link
    const projectLink = await page.$('a[action="project"], a.project, a[href*="project"]');
    if (projectLink) {
      await projectLink.click();
    } else {
      // Try using Actions directly
      await page.evaluate(() => {
        if (window.Actions && window.Actions.Router) {
          window.Actions.Router.gotoRoute('project');
        }
      });
    }
    await page.waitForTimeout(1000);
    
    // Upload the .cnm file
    console.log('\n3. Uploading diabetes_basic.cnm...');
    const fileInput = await page.$('input#uploadProject, input[type="file"][accept=".cnm,.CNM"]');
    if (fileInput) {
      await fileInput.setInputFiles(PROJECT_FILE);
      console.log('   File input found and file set');
    } else {
      console.log('   ERROR: No .cnm file input found');
      // Debug - show what inputs are on page
      const inputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="file"]')).map(i => ({
          id: i.id,
          accept: i.accept,
          name: i.name
        }));
      });
      console.log('   Available file inputs:', JSON.stringify(inputs));
    }
    
    await page.waitForTimeout(3000);
    
    // Force a re-render by calling saveState
    console.log('\n3b. Forcing re-render...');
    await page.evaluate(() => {
      window.Model.saveState();
    });
    await page.waitForTimeout(2000);
    
    // Check state after upload
    console.log('\n4. Checking state after upload...');
    const stateCheck = await page.evaluate(() => {
      try {
        const state = window.Model.getState();
        return {
          hasProject: !!state.project,
          hasFile: state.project?.hasFile,
          projectVersion: state.version,
          cmStatus: state.project?.CM?.currentCM?.status,
          directRobStatus: state.project?.DirectRob?.status,
          hasStudies: !!state.project?.studies,
          currentRoute: state.router?.currentRoute
        };
      } catch (e) { return { error: e.message }; }
    });
    console.log('   State:', JSON.stringify(stateCheck, null, 2));
    
    // Check route availability
    console.log('\n5. Checking route availability...');
    const routeAvail = await page.evaluate(() => {
      const routes = ['general', 'rob', 'imprecision', 'heterogeneity', 'incoherence', 'indirectness', 'pubbias', 'report'];
      const result = {};
      routes.forEach(route => {
        try {
          // Try to access Router through window
          if (window.Actions && window.Actions.Router) {
            // Check if we can navigate
            const state = window.Model.getState();
            const conmatStatus = state.project?.CM?.currentCM?.status;
            result[route] = {
              conmatStatus,
              wouldBeAvailable: conmatStatus === 'ready'
            };
          }
        } catch (e) {
          result[route] = { error: e.message };
        }
      });
      return result;
    });
    console.log('   Route availability:', JSON.stringify(routeAvail, null, 2));
    
    // Try to navigate to ROB
    console.log('\n6. Trying to navigate to ROB...');
    const robLink = await page.$('a[action="rob"]');
    if (robLink) {
      const isDisabled = await robLink.evaluate(el => el.classList.contains('disabled'));
      console.log(`   ROB link found, disabled: ${isDisabled}`);
      
      if (!isDisabled) {
        await robLink.click();
        await page.waitForTimeout(2000);
        
        const afterNav = await page.evaluate(() => ({
          currentRoute: window.Model.getState().router?.currentRoute,
          robContainer: !!document.querySelector('#contentStudyLimitations, #netRob')
        }));
        console.log('   After nav:', JSON.stringify(afterNav));
      }
    } else {
      console.log('   ROB link not found');
    }
    
    // List all nav links
    console.log('\n7. All nav links:');
    const navLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[action]');
      return Array.from(links).map(l => ({
        action: l.getAttribute('action'),
        disabled: l.classList.contains('disabled') || l.parentElement?.classList.contains('disabled'),
        text: l.textContent.trim().substring(0, 30)
      }));
    });
    console.log('   ' + JSON.stringify(navLinks, null, 2));
    
    // Check eval menu specifically
    console.log('\n7b. Eval menu HTML (first link):');
    const evalMenuHTML = await page.evaluate(() => {
      const firstLink = document.querySelector('.evaluation-menu a');
      if (!firstLink) return 'NOT FOUND';
      return {
        outerHTML: firstLink.outerHTML,
        hasAction: firstLink.hasAttribute('action'),
        action: firstLink.getAttribute('action'),
        onclick: firstLink.getAttribute('onclick'),
        className: firstLink.className
      };
    });
    console.log('   ' + JSON.stringify(evalMenuHTML, null, 2));
    
    // Check if ROB content is rendered
    console.log('\n7c. Current page content check:');
    const pageContent = await page.evaluate(() => {
      return {
        hasStudyLimitations: !!document.querySelector('#contentStudyLimitations'),
        hasNetRob: !!document.querySelector('#netRob'),
        hasCompRobSelector: !!document.querySelector('.compRobSelector'),
        currentRouteElement: document.querySelector('.routed')?.id || 'none',
        bodyClasses: document.body.className,
        mainContent: document.querySelector('.container-fluid')?.children[1]?.id || 'none'
      };
    });
    console.log('   ' + JSON.stringify(pageContent, null, 2));
    
    // Try manually navigating to ROB 
    console.log('\n8. Manually navigating to ROB via Actions.Router...');
    await page.evaluate(() => {
      window.Actions.Router.gotoRoute('rob');
    });
    await page.waitForTimeout(2000);
    
    const afterManualNav = await page.evaluate(() => ({
      currentRoute: window.Model.getState().router?.currentRoute,
      hasStudyLimitations: !!document.querySelector('#contentStudyLimitations'),
      mainContent: document.querySelector('.container-fluid')?.children[1]?.id || 'none'
    }));
    console.log('   After manual nav:', JSON.stringify(afterManualNav, null, 2));
    
    // Check states of ROB-related modules  
    console.log('\n8b. Checking ROB module states...');
    const robStates = await page.evaluate(() => {
      const state = window.Model.getState();
      return {
        netRobExists: !!state.project?.netRob,
        netRobStatus: state.project?.netRob?.status,
        directRobExists: !!state.project?.DirectRob,
        directRobStatus: state.project?.DirectRob?.status,
        studiesExist: !!state.project?.studies,
        directComparisonsCount: state.project?.studies?.directComparisons?.length,
        cmStatus: state.project?.CM?.currentCM?.status,
        // Check if all required data for ROB is present
        robLevelsExist: !!state.project?.robLevels,
        robLevelsCount: state.project?.robLevels?.length
      };
    });
    console.log('   ROB states:', JSON.stringify(robStates, null, 2));
    
    // Try clicking on Configuration link which should work
    console.log('\n8c. Testing: Click on Configuration link...');
    const configLink = await page.$('a.general, a[onclick*="general"]');
    if (configLink) {
      await configLink.click();
      await page.waitForTimeout(2000);
      const afterConfig = await page.evaluate(() => ({
        currentRoute: window.Model.getState().router?.currentRoute,
        mainContent: document.querySelector('.container-fluid')?.children[1]?.id || 'none'
      }));
      console.log('   After clicking Configuration:', JSON.stringify(afterConfig, null, 2));
      
      // Now try to navigate to ROB - first set route to something else then ROB
      console.log('\n8d. Testing: Navigate to ROB from Configuration...');
      
      // Check the current route in state
      const beforeRobClick = await page.evaluate(() => window.Model.getState().router?.currentRoute);
      console.log('   Route in state before clicking ROB:', beforeRobClick);
      
      // Force route to 'general' in state so clicking ROB will work
      await page.evaluate(() => {
        window.Model.getState().router.currentRoute = 'general';
      });
      
      const robLink = await page.$('a.rob, a[onclick*="rob"]');
      if (robLink) {
        await robLink.click();
        await page.waitForTimeout(2000);
        
        // Try calling the ROB render directly to see what happens
        const robRenderTest = await page.evaluate(() => {
          try {
            // The ROB module should be registered and accessible
            // Let's check what happens when we try to render via different routes
            
            // Force state to project, then call saveState
            window.Model.getState().router.currentRoute = 'project';
            window.Model.saveState();
            
            return { 
              step1: 'Set route to project',
              route1: window.Model.getState().router?.currentRoute,
              content1: document.querySelector('.container-fluid')?.children[1]?.id
            };
          } catch (e) {
            return { error: e.message, stack: e.stack };
          }
        });
        console.log('   ROB render test step 1:', JSON.stringify(robRenderTest, null, 2));
        
        await page.waitForTimeout(1000);
        
        // Now try to go to ROB
        const robRenderTest2 = await page.evaluate(() => {
          try {
            window.Model.getState().router.currentRoute = 'rob';
            window.Model.saveState();
            
            return { 
              step2: 'Set route to rob',
              route2: window.Model.getState().router?.currentRoute,
              content2: document.querySelector('.container-fluid')?.children[1]?.id
            };
          } catch (e) {
            return { error: e.message, stack: e.stack };
          }
        });
        console.log('   ROB render test step 2:', JSON.stringify(robRenderTest2, null, 2));
        
        // Wait longer for async render
        await page.waitForTimeout(2000);
        
        // Check content after waiting
        const afterDelay = await page.evaluate(() => ({
          route: window.Model.getState().router?.currentRoute,
          content: document.querySelector('.container-fluid')?.children[1]?.id,
          hasStudyLimitations: !!document.querySelector('#contentStudyLimitations')
        }));
        console.log('   After 2s delay:', JSON.stringify(afterDelay, null, 2));
        
        await page.waitForTimeout(1000);
        
        const afterRob = await page.evaluate(() => ({
          currentRoute: window.Model.getState().router?.currentRoute,
          mainContent: document.querySelector('.container-fluid')?.children[1]?.id || 'none',
          hasStudyLimitations: !!document.querySelector('#contentStudyLimitations'),
          hasNetRob: !!document.querySelector('#netRob'),
          hasDirectRobSelectCont: !!document.querySelector('#directRobSelectCont'),
          gradeTemplatesExist: typeof GRADE !== 'undefined' && typeof GRADE.templates !== 'undefined',
          directrobTemplateExist: typeof GRADE !== 'undefined' && typeof GRADE.templates?.directrob === 'function'
        }));
        console.log('   After clicking ROB (with fix):', JSON.stringify(afterRob, null, 2));
      } else {
        console.log('   ROB link not found');
      }
    } else {
      console.log('   Configuration link not found');
    }
    await page.waitForTimeout(1000);
    
    const afterSaveState = await page.evaluate(() => ({
      currentRoute: window.Model.getState().router?.currentRoute,
      hasStudyLimitations: !!document.querySelector('#contentStudyLimitations'),
      mainContent: document.querySelector('.container-fluid')?.children[1]?.id || 'none',
      containerChildren: Array.from(document.querySelector('.container-fluid')?.children || []).map(c => c.id || c.className)
    }));
    console.log('   After saveState:', JSON.stringify(afterSaveState, null, 2));
    
    // Keep browser open for inspection
    console.log('\n9. Waiting 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.log(`\nERROR: ${error.message}`);
    // Keep browser open on error too
    console.log('Waiting 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
  } finally {
    await browser.close();
  }
}

runTest();
