'use strict';

// v2bridge-test.js — Tests for the v2 exchange format bridge
//
// Run with: node test/v2bridge-test.js
// Must be run from webapp/ directory

const fs = require('fs');
const path = require('path');

// Load underscore globally (v2bridge.js expects it as global _)
global._ = require('../bower_components/underscore/underscore.js');

// Mock the ComparisonModel PureScript module
// The bridge uses: ComparisonModel.fixComparisonId, ComparisonModel.sortStringComparisonIds
try {
  // Try loading the real PureScript output
  var ComparisonModel = require('../app/scripts/purescripts/output/ComparisonModel');
} catch (e) {
  // Fall back to mock if PureScript not built
  console.log('WARNING: PureScript ComparisonModel not available, using mock');
  var ComparisonModel = {
    fixComparisonId: (id) => id,
    sortStringComparisonIds: (ids) => ids.sort(),
  };
}
// Patch require so v2bridge can find its dependencies
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === '../purescripts/output/ComparisonModel') {
    return originalResolveFilename.call(this, path.resolve(__dirname, '../app/scripts/purescripts/output/ComparisonModel'), parent, isMain, options);
  }
  if (request === '../translations.json') {
    return originalResolveFilename.call(this, path.resolve(__dirname, '../app/scripts/translations.json'), parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

// Load the bridge module
const V2Bridge = require('../app/scripts/lib/v2bridge.js');

// Load the v2 export file
const v2json = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../schemata/metainsight/export_v2.json'), 'utf8'
));

// Test utilities
let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log('  ✓ ' + message);
  } else {
    failed++;
    console.log('  ✗ FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log('  ✓ ' + message);
  } else {
    failed++;
    console.log('  ✗ FAIL: ' + message + ' (expected ' + expected + ', got ' + actual + ')');
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) < tolerance) {
    passed++;
    console.log('  ✓ ' + message);
  } else {
    failed++;
    console.log('  ✗ FAIL: ' + message + ' (expected ~' + expected + ', got ' + actual + ')');
  }
}

// ============================================
// Tests
// ============================================

console.log('\nv2 Format Detection');
console.log('---');
assert(V2Bridge.isV2Format(v2json), 'detects v2 format in export_v2.json');
assert(!V2Bridge.isV2Format({}), 'rejects empty object');
assert(!V2Bridge.isV2Format({ project: {} }), 'rejects project without analyses');
assert(!V2Bridge.isV2Format({ project: { analyses: [] } }), 'rejects project without studies');
assert(!V2Bridge.isV2Format({ version: '3.0.0' }), 'rejects v1 state (no project.analyses)');

console.log('\nStudies Construction');
console.log('---');
let studies = V2Bridge.buildStudiesFromV2(v2json.project.studies, v2json.project.type);
assertEqual(studies.long.length, 48, 'long has 48 arms (22 studies, some multi-arm)');
assertEqual(studies.nodes.length, 6, 'network has 6 treatment nodes');
assertEqual(studies.directComparisons.length, 14, '14 direct comparisons');
assertEqual(studies.indirectComparisons.length, 1, '1 indirect comparison');
assert(studies.indirectComparisons[0] === 'ACE,ARB', 'indirect comparison is ACE,ARB');
assertEqual(Object.keys(studies.robs).length, 22, 'robs has 22 studies');
assertEqual(studies.robs['1'], 1, 'Study 1 (AASK) has rob=1 (Low)');
assertEqual(studies.robs['6'], 2, 'Study 6 (CAPPP) has rob=2 (Moderate)');
assertEqual(studies.robs['11'], 3, 'Study 11 (HAPPHY) has rob=3 (High)');

console.log('\nLong Format Arms');
console.log('---');
let aask_arms = studies.long.filter(a => a.id === 1);
assertEqual(aask_arms.length, 3, 'AASK has 3 arms (multi-arm study)');
assert(aask_arms.some(a => a.t === 'ACE'), 'AASK has ACE arm');
assert(aask_arms.some(a => a.t === 'BBlocker'), 'AASK has BBlocker arm');
assert(aask_arms.some(a => a.t === 'CCB'), 'AASK has CCB arm');
let ace_arm = aask_arms.find(a => a.t === 'ACE');
assertEqual(ace_arm.n, 410, 'ACE arm sample size is 410');
assertEqual(ace_arm.r, 45, 'ACE arm events is 45');

console.log('\nWide Format Comparisons');
console.log('---');
let aask_wide = studies.wide.filter(w => w.id === 1);
assertEqual(aask_wide.length, 3, 'AASK has 3 pairwise comparisons (C(3,2))');

console.log('\nNodes');
console.log('---');
let aceNode = studies.nodes.find(n => n.id === 'ACE');
assert(aceNode, 'ACE node exists');
assertEqual(aceNode.numStudies, 8, 'ACE appears in 8 studies');
assertEqual(aceNode.type, 'node', 'node type is "node"');

console.log('\nDirect Comparisons');
console.log('---');
let aceBBlocker = studies.directComparisons.find(c => c.id === 'ACE,BBlocker');
assert(aceBBlocker, 'ACE,BBlocker direct comparison exists');
assertEqual(aceBBlocker.numStudies, 3, 'ACE:BBlocker has 3 studies');
assertEqual(aceBBlocker.type, 'edge', 'type is "edge"');

console.log('\nHatmatrix Transformation');
console.log('---');
let analysis = v2json.project.analyses[0];
let hatmatrix = V2Bridge.analysisToHatmatrix(analysis);
assertEqual(hatmatrix.rowNames.length, 15, 'hatmatrix has 15 row names');
assertEqual(hatmatrix.colNames.length, 14, 'hatmatrix has 14 column names');
assertEqual(hatmatrix.H.length, 15, 'H matrix has 15 rows');
assertEqual(hatmatrix.H[0].length, 14, 'H matrix has 14 columns');
assertEqual(hatmatrix.NMAresults.length, 15, '15 NMA results');
assert(hatmatrix.model[0] === 'fixed', 'model is ["fixed"]');
assert(hatmatrix.sm[0] === 'RD', 'sm is ["RD"]');

console.log('\nNMAresults Mapping');
console.log('---');
let aceBB = hatmatrix.NMAresults.find(r => r['_row'] === 'ACE:BBlocker');
assert(aceBB, 'ACE:BBlocker NMA result exists');
assertClose(aceBB['NMA treatment effect'], -0.0189, 0.001, 'NMA treatment effect is -0.0189');
assertClose(aceBB['lower CI'], -0.0237, 0.001, 'lower CI is -0.0237');
assertClose(aceBB['upper CI'], -0.0141, 0.001, 'upper CI is -0.0141');
assertClose(aceBB['Direct'], -0.0073, 0.001, 'Direct estimate present');
assertClose(aceBB['Indirect'], -0.026, 0.001, 'Indirect estimate present');
assertClose(aceBB['SideIF'], 0.0187, 0.001, 'SideIF (incoherence effect) present');
assertClose(aceBB['SideZ'], 3.714, 0.01, 'SideZ present');
assertClose(aceBB['SidePvalue'], 0.0002, 0.001, 'SidePvalue present');
assertClose(aceBB['PropDir'], 0.3821, 0.001, 'PropDir present');

// Indirect-only comparison
let aceARB = hatmatrix.NMAresults.find(r => r['_row'] === 'ACE:ARB');
assert(aceARB, 'ACE:ARB NMA result exists');
assert(aceARB['Direct'] === undefined, 'ACE:ARB has no Direct estimate (indirect-only)');
assert(aceARB['SideIF'] === undefined, 'ACE:ARB has no SideIF (indirect-only)');
assertClose(aceARB['Indirect'], 0.0086, 0.001, 'ACE:ARB Indirect estimate present');
assertEqual(aceARB['PropDir'], 0, 'ACE:ARB PropDir is 0');

console.log('\nPairwise Mapping');
console.log('---');
assert(Array.isArray(hatmatrix.Pairwise), 'Pairwise is an array');
// export_v2.json doesn't have pairwise data (optional), so array is empty
assertEqual(hatmatrix.Pairwise.length, 0, 'Pairwise is empty when not in v2 source (optional field)');
assert(Array.isArray(hatmatrix.rowNamesPairwise), 'rowNamesPairwise is an array');

console.log('\nNMAheterResults');
console.log('---');
assert(Array.isArray(hatmatrix.NMAheterResults), 'NMAheterResults is array');
assertEqual(hatmatrix.NMAheterResults.length, 1, 'NMAheterResults has 1 element');
assert(typeof hatmatrix.NMAheterResults[0]['heterVarNtw'] === 'number', 'heterVarNtw is number');

console.log('\nDesign-by-Treatment');
console.log('---');
assert(Array.isArray(hatmatrix.dbt), 'dbt is array');
assertEqual(hatmatrix.dbt.length, 1, 'dbt has 1 element');
assert(typeof hatmatrix.dbt[0]['Q_dbt'] === 'number', 'Q_dbt is number');
assert(typeof hatmatrix.dbt[0]['df'] === 'number', 'df is number');
assert(typeof hatmatrix.dbt[0]['pv_dbt'] === 'number', 'pv_dbt is number');

console.log('\nFull State Transformation');
console.log('---');
let mockCurrentState = {
  version: '3.0.0',
  text: { robLevels: ['Low', 'Moderate', 'High'], NetRob: { rules: {} } },
  defaults: {},
};
let state = V2Bridge.v2ToLegacyState(v2json, mockCurrentState);
assertEqual(state.version, '3.0.0', 'state version matches current');
assert(state.project, 'state has project');
assert(state.project.hasFile, 'project.hasFile is true');
assertEqual(state.project.type, 'binary', 'project type is binary');
assertEqual(state.project.format, 'long', 'project format is long');
assert(state.project.studies, 'project has studies');
assert(state.project.CM, 'project has CM');
assert(state.project.CM.currentCM, 'CM has currentCM');
assertEqual(state.project.CM.currentCM.status, 'ready', 'currentCM status is ready');

let cm = state.project.CM.currentCM;
assertEqual(cm.params.MAModel, 'fixed', 'CM params.MAModel is fixed');
assertEqual(cm.params.sm, 'RD', 'CM params.sm is RD');
assertEqual(cm.params.intvs.length, 6, 'CM params.intvs has 6 treatments');
assertEqual(cm.params.rule, 'every', 'CM params.rule is every');

console.log('\nCurrentCM Structure');
console.log('---');
assert(cm.hatmatrix, 'currentCM has hatmatrix');
assert(cm.studycontributions, 'currentCM has studycontributions');
assertEqual(Object.keys(cm.studycontributions).length, 15, 'studycontributions has 15 comparisons');
assert(cm.directRowNames, 'currentCM has directRowNames');
assert(cm.indirectRowNames, 'currentCM has indirectRowNames');
assertEqual(cm.directRowNames.length, 14, '14 direct row names');
assertEqual(cm.indirectRowNames.length, 1, '1 indirect row name');

// Study contributions structure check
let aceArbContrs = cm.studycontributions['ACE:ARB'];
assert(aceArbContrs, 'studycontributions has ACE:ARB');
// studycontributions are re-keyed by study ID (not name). AASK is study id "1"
assert(typeof aceArbContrs['1'] === 'number', 'Study 1 (AASK) contribution is a number');
assertClose(aceArbContrs['1'], 0.4418, 0.01, 'Study 1 (AASK) contribution to ACE:ARB is ~0.44');
// All 22 studies should have entries (missing ones filled with 0)
assertEqual(Object.keys(aceArbContrs).length, 22, 'ACE:ARB has entries for all 22 studies');

console.log('\nsavedComparisons');
console.log('---');
assertEqual(cm.savedComparisons.length, 15, '15 saved comparisons');
let sc = cm.savedComparisons.find(s => s.rowname === 'ACE:BBlocker');
assert(sc, 'savedComparisons has ACE:BBlocker');
assert(sc.perstudy, 'savedComparison has perstudy');
assert(typeof sc.perstudy['AASK'] === 'number', 'perstudy AASK is a number');

console.log('\nLeague Tables');
console.log('---');
assert(Array.isArray(cm.leaguetable) || typeof cm.leaguetable === 'object', 'leaguetable exists');

console.log('\n=====================================');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('=====================================');

if (failed > 0) {
  process.exit(1);
}
