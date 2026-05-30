// Create + consume a Bayesian .cnm, MetaInsight-style.
//
// 1. Run create-bayesian-cnm.R: fit a gemtc Bayesian NMA on the `smoking`
//    dataset and write a v3 .cnm via the cinemar package.
// 2. Serve the built frontend (webapp/dist) and upload that .cnm.
// 3. Verify CINeMA consumes the BAYESIAN block as primary (the loaded NMA
//    effect matches the posterior estimate, not the frequentist one) and that
//    the evaluation domains render.
//
// Prereqs: gemtc + JAGS installed; `npx gulp build` already run (dist present).

const { chromium } = require('playwright');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');                 // webapp/
const DIST = path.join(ROOT, 'dist');
const RSCRIPT = path.join(__dirname, 'create-bayesian-cnm.R');
const WORK = '/tmp/cnm-bayes-test';
const PORT = process.env.TEST_PORT || 9011;
fs.mkdirSync(WORK, { recursive: true });

const norm = (c) => String(c).split(':').sort().join(':');

function waitForServer(port, tries = 50) {
  return new Promise((resolve, reject) => {
    const tick = (n) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.destroy(); resolve();
      });
      req.on('error', () => {
        if (n <= 0) return reject(new Error('server did not start'));
        setTimeout(() => tick(n - 1), 200);
      });
    };
    tick(tries);
  });
}

(async () => {
  let server, browser;
  try {
    if (!fs.existsSync(path.join(DIST, 'index.html'))) {
      throw new Error('dist not built — run `npx gulp build` first');
    }

    // ── 1. Create the Bayesian .cnm from a gemtc fit ──────────────────────
    const cnmPath = path.join(WORK, 'smoking-bayesian.cnm');
    console.log('Fitting gemtc NMA and writing .cnm (this runs MCMC)…');
    const out = execSync(`Rscript "${RSCRIPT}" "${cnmPath}"`, { encoding: 'utf8' });
    console.log(out.trim().split('\n').slice(-2).join('\n'));
    if (!fs.existsSync(cnmPath)) throw new Error('no .cnm produced');

    const cnm = JSON.parse(fs.readFileSync(cnmPath, 'utf8'));
    const an = cnm.cinema.projects[0].analysis;
    if (an.params.framework !== 'bayesian') throw new Error('file is not bayesian');

    // Expected effects from the file: bayesian (primary) vs frequentist (fallback)
    const bMap = {}, fMap = {};
    an.bayesian.nmaResults.forEach((r) => { bMap[norm(r.comparison)] = r.effect; });
    an.frequentist.nmaResults.forEach((r) => { fMap[norm(r.comparison)] = r.effect; });
    // pick the comparison where bayesian and frequentist differ most
    let probe = null, gap = -1;
    Object.keys(bMap).forEach((c) => {
      if (fMap[c] === undefined) return;
      const d = Math.abs(bMap[c] - fMap[c]);
      if (d > gap) { gap = d; probe = c; }
    });
    console.log(`Probe comparison ${probe}: bayes=${bMap[probe].toFixed(3)} freq=${fMap[probe].toFixed(3)} (Δ=${gap.toFixed(3)})`);

    // ── 2. Serve dist ────────────────────────────────────────────────────
    server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
      { cwd: DIST, stdio: 'ignore' });
    await waitForServer(PORT);

    // ── 3. Load the .cnm in the app ──────────────────────────────────────
    browser = await chromium.launch({ headless: true });
    const page = await (await browser.newContext()).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.Actions.Router.gotoRoute('project'));
    await page.waitForTimeout(400);
    await (await page.$('input#uploadProject')).setInputFiles(cnmPath);
    await page.waitForTimeout(3000);

    const loaded = await page.evaluate(() => {
      const p = window.Model.getState().project;
      const hm = p && p.CM && p.CM.currentCM && p.CM.currentCM.hatmatrix;
      const effByComp = {};
      let tau = null;
      if (hm && hm.NMAresults) hm.NMAresults.forEach((r) => {
        effByComp[r._row] = r['NMA treatment effect'];
      });
      if (hm && hm.NMAheterResults && hm.NMAheterResults[0]) tau = hm.NMAheterResults[0].heterVarNtw;
      return {
        hasFile: !!(p && p.hasFile),
        title: p && p.title,
        nStudies: p && p.studies && p.studies.long ? p.studies.long.length : 0,
        cmStatus: p && p.CM && p.CM.currentCM && p.CM.currentCM.status,
        effByComp, tau,
      };
    });
    console.log('Loaded:', JSON.stringify({ hasFile: loaded.hasFile, title: loaded.title,
      nStudies: loaded.nStudies, cmStatus: loaded.cmStatus, tau: loaded.tau }));

    // app NMA effect for the probe comparison (try both orientations)
    const appEff = loaded.effByComp[probe] !== undefined
      ? loaded.effByComp[probe]
      : (loaded.effByComp[probe.split(':').reverse().join(':')] !== undefined
          ? -loaded.effByComp[probe.split(':').reverse().join(':')] : undefined);

    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const consumesBayesian = appEff !== undefined && near(appEff, bMap[probe]) && !near(appEff, fMap[probe]);
    console.log(`App effect for ${probe}: ${appEff !== undefined ? appEff.toFixed(3) : 'NA'} ` +
                `(bayes=${bMap[probe].toFixed(3)}, freq=${fMap[probe].toFixed(3)}) ` +
                `→ consumes bayesian: ${consumesBayesian}`);

    // tau should reflect the bayesian posterior SD^2
    const bTau2 = an.bayesian.tau ? an.bayesian.tau.mean * an.bayesian.tau.mean : null;
    const tauOk = bTau2 == null || (loaded.tau != null && Math.abs(loaded.tau - bTau2) < 1e-6);

    // ── 4. Domains render ────────────────────────────────────────────────
    await page.evaluate(() => window.Actions.Router.gotoRoute('rob'));
    await page.waitForTimeout(2500);
    const rob = await page.evaluate(() => {
      const c = document.querySelector('#barChartContainer');
      return c ? c.querySelectorAll('canvas').length : 0;
    });
    await page.evaluate(() => window.Actions.Router.gotoRoute('indirectness'));
    await page.waitForTimeout(2500);
    const ind = await page.evaluate(() => {
      const c = document.querySelector('#IndrChartContainer');
      return c ? c.querySelectorAll('canvas').length : 0;
    });
    await page.screenshot({ path: path.join(WORK, 'bayesian-loaded.png'), fullPage: true });
    console.log(`Domains: rob canvases=${rob}, indirectness canvases=${ind}; page errors=${errors.length}`);
    errors.slice(0, 3).forEach((e) => console.log('  -', e));

    const pass = loaded.hasFile && loaded.cmStatus === 'ready' &&
                 consumesBayesian && tauOk && rob >= 1 && ind >= 1 && errors.length === 0;
    console.log(pass ? '\nPASS — Bayesian .cnm created and consumed as primary; domains render.'
                     : '\nFAIL');
    process.exitCode = pass ? 0 : 1;
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
})();
