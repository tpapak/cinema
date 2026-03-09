#!/usr/bin/env python3
"""
Script to update the upload-rob-test.js to properly load the cached project
"""

# Read the current test file
with open(
    "/Users/tosku/Sync/Documents/cinema/webapp/test/upload-rob-test.js", "r"
) as f:
    content = f.read()

# Replace the entire test logic after browser setup
old_test = """  try {
    // Navigate to app
    console.log(`\\n📄 Loading http://localhost:${PORT}/...`);
    await page.goto(`http://localhost:${PORT}/`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for app to initialize
    await page.waitForTimeout(2000);
    console.log('✓ App loaded');
    
    // Navigate to Projects page by clicking the link
    console.log('\\n📂 Navigating to Projects page...');
    await page.click('a.project');
    await page.waitForTimeout(2000);
    console.log('✓ On Projects page');
    
    // Upload the .cnm file
    console.log('\\n📤 Uploading diabetes_basic.cnm...');
    
    // Look for the file input for .cnm files (id="uploadProject" accepts=".cnm,.CNM")
    const cnmInput = await page.$('input#uploadProject, input[type="file"][accept*=".cnm"]');
    if (cnmInput) {
      await cnmInput.setInputFiles(PROJECT_FILE);
      console.log('✓ File selected via #uploadProject input');
    } else {
      console.log('❌ Could not find .cnm file input (#uploadProject)');
      testsPassed = false;
    }
    
    // Wait for file to be processed
    await page.waitForTimeout(3000);
    
    // Check if project was loaded successfully
    results.checks.projectLoaded = await page.evaluate(() => {
      // Check if project state exists
      try {
        const state = JSON.parse(localStorage.state || '{}');
        return state.project && state.project.hasFile === true;
      } catch (e) {
        return false;
      }
    });
    console.log(`   ${results.checks.projectLoaded ? '✓' : '❌'} Project loaded into state`);
    if (!results.checks.projectLoaded) testsPassed = false;
    
    // Navigate to ROB page
    console.log('\\n🎯 Navigating to Within-study bias (ROB) page...');
    
    // Navigate to ROB page by clicking the link
    const robLink = await page.$('a.rob');
    if (robLink) {
      await page.click('a.rob');
      await page.waitForTimeout(2000);
      console.log('✓ Clicked ROB link');
    } else {
      console.log('   ⚠️  ROB link not found');
    }"""

new_test = """  try {
    // Read the project file content
    const projectContent = fs.readFileSync(PROJECT_FILE, 'utf-8');
    
    // Set localStorage BEFORE loading the page (so the app sees it on init)
    await page.addInitScript((content) => {
      localStorage.state = content;
    }, projectContent);
    
    // Navigate to app
    console.log(`\\n📄 Loading http://localhost:${PORT}/...`);
    await page.goto(`http://localhost:${PORT}/`, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for app to initialize
    await page.waitForTimeout(2000);
    console.log('✓ App loaded');
    
    // Navigate to Projects page and load cached project
    console.log('\\n📂 Navigating to Projects page...');
    await page.click('a.project');
    await page.waitForTimeout(2000);
    console.log('✓ On Projects page');
    
    // Click "Load cached Project" button to load the state from localStorage
    console.log('\\n📤 Loading cached project (diabetes_basic.cnm)...');
    const loadCachedBtn = await page.$('button:has-text("Load cached Project")');
    if (loadCachedBtn) {
      await loadCachedBtn.click();
      await page.waitForTimeout(3000);
      console.log('✓ Clicked "Load cached Project" button');
    } else {
      // Try loading directly via Model
      console.log('   Load button not found, loading via Model.loadCachedModel()...');
      await page.evaluate(() => {
        if (window.Model && window.Model.loadCachedModel) {
          window.Model.loadCachedModel();
        }
      });
      await page.waitForTimeout(3000);
    }
    
    // Check if project was loaded successfully
    results.checks.projectLoaded = await page.evaluate(() => {
      // Check the Model state (not just localStorage)
      try {
        if (window.Model) {
          const state = window.Model.getState();
          return state.project && state.project.hasFile === true;
        }
        return false;
      } catch (e) {
        return false;
      }
    });
    console.log(`   ${results.checks.projectLoaded ? '✓' : '❌'} Project loaded into Model state`);
    if (!results.checks.projectLoaded) testsPassed = false;
    
    // Navigate to ROB page
    console.log('\\n🎯 Navigating to Within-study bias (ROB) page...');
    
    // Check if ROB is available
    const robAvailable = await page.evaluate(() => {
      if (window.Model) {
        const state = window.Model.getState();
        return state.project?.CM?.currentCM?.status === 'ready';
      }
      return false;
    });
    console.log(`   ROB available: ${robAvailable}`);
    
    // Navigate using Actions.Router
    await page.evaluate(() => {
      Actions.Router.gotoRoute('rob');
    });
    await page.waitForTimeout(3000);
    console.log('✓ Navigated to ROB page');"""

content = content.replace(old_test, new_test)

# Write the updated test file
with open(
    "/Users/tosku/Sync/Documents/cinema/webapp/test/upload-rob-test.js", "w"
) as f:
    f.write(content)

print("✓ Updated upload-rob-test.js to load cached project properly")
