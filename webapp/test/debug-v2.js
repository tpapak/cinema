#!/usr/bin/env node
/**
 * Debug script: upload v2 file and capture full error stacks
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const V2_FILE = path.join(__dirname, '../../schemata/metainsight/export_v2.json');

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const fp = path.join(distDir, url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    const ct = {
      '.html': 'text/html', '.js': 'application/javascript',
      '.css': 'text/css', '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': ct[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

(async () => {
  await new Promise(r => server.listen(9998, r));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture FULL error stacks
  page.on('pageerror', error => {
    console.log('\n=== PAGE ERROR ===');
    console.log(error.message);
    if (error.stack) console.log(error.stack);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE_ERROR:', msg.text().substring(0, 300));
    }
    if (msg.type() === 'log' && msg.text().includes('v2')) {
      console.log('LOG:', msg.text());
    }
  });

  // Load app
  await page.goto('http://localhost:9998/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  // Go to project page
  await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
  await page.waitForTimeout(500);

  // Upload v2 file
  console.log('Uploading v2 file...');
  const fi = await page.$('input#uploadProject');
  await fi.setInputFiles(V2_FILE);
  await page.waitForTimeout(4000);

  // Check state
  const state = await page.evaluate(() => {
    try {
      const s = window.Model.getState();
      return {
        hasProject: !!s.project,
        hasFile: s.project?.hasFile,
        cmStatus: s.project?.CM?.currentCM?.status,
        hasNetplot: !!s.project?.studies?.nodes?.[0]?.width,
        routerRoute: s.router?.currentRoute,
        hasRobLevels: !!s.project?.robLevels,
        hasStudyLimLevels: !!s.project?.studyLimitationLevels,
        robLevelsLength: s.project?.robLevels?.length,
        robLevels0: JSON.stringify(s.project?.robLevels?.[0]),
        studyLimLevels0: JSON.stringify(s.project?.studyLimitationLevels?.[0]),
        hasText: !!s.text,
        textKeys: s.text ? Object.keys(s.text).slice(0, 10) : [],
        hasDefaults: !!s.defaults,
        defaultKeys: s.defaults ? Object.keys(s.defaults) : [],
      };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('\nState after upload:', JSON.stringify(state, null, 2));

  // Navigate to general
  console.log('\n--- Navigating to general ---');
  await page.evaluate(() => window.Actions.Router.gotoRoute('general'));
  await page.waitForTimeout(2000);

  // Check what the page looks like — dump all children of container-fluid
  const generalHTML = await page.evaluate(() => {
    const c = document.querySelector('.container-fluid');
    if (!c) return 'NO CONTAINER FOUND';
    let info = 'children: ' + c.children.length + '\n';
    for (let i = 0; i < c.children.length; i++) {
      const ch = c.children[i];
      info += '  [' + i + '] tag=' + ch.tagName + ' id=' + ch.id + ' class=' + ch.className + ' html_len=' + ch.innerHTML.length + '\n';
    }
    // Also check for the .routed element
    const routed = c.querySelector('.routed');
    info += '\n.routed element: ' + (routed ? 'id=' + routed.id + ' html_len=' + routed.innerHTML.length : 'NOT FOUND');
    // Check the SVG (network plot)
    const svg = c.querySelector('svg');
    info += '\nSVG element: ' + (svg ? 'found, children=' + svg.children.length : 'NOT FOUND');
    // Check model state for what the router thinks
    info += '\nrouter.currentRoute: ' + window.Model?.getState()?.router?.currentRoute;
    return info;
  });
  console.log('\nGeneral page info:\n' + generalHTML);

  // Navigate to rob
  console.log('\n--- Navigating to rob ---');
  await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
  await page.waitForTimeout(2000);

  const robInfo = await page.evaluate(() => {
    const c = document.querySelector('.container-fluid');
    if (!c) return 'NO CONTAINER';
    let info = 'children: ' + c.children.length + '\n';
    for (let i = 0; i < c.children.length; i++) {
      const ch = c.children[i];
      info += '  [' + i + '] tag=' + ch.tagName + ' id=' + ch.id + ' class=' + ch.className + ' html_len=' + ch.innerHTML.length + '\n';
    }
    const routed = c.querySelector('.routed');
    info += '.routed: ' + (routed ? 'id=' + routed.id + ' len=' + routed.innerHTML.length : 'NOT FOUND') + '\n';
    // Check for #contentStudyLimitations, #netRob, etc
    info += '#contentStudyLimitations: ' + !!c.querySelector('#contentStudyLimitations') + '\n';
    info += '#netRob: ' + !!c.querySelector('#netRob') + '\n';
    info += 'router.currentRoute: ' + window.Model?.getState()?.router?.currentRoute + '\n';
    // Check project.netRob
    const nr = window.Model?.getState()?.project?.netRob;
    info += 'project.netRob: ' + (nr ? JSON.stringify(nr).substring(0, 200) : 'undefined') + '\n';
    return info;
  });
  console.log('ROB page info:\n' + robInfo);

  await browser.close();
  server.close();
})();
