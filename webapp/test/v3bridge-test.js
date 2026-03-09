'use strict';

// v3bridge-test.js — Tests for the v3 exchange format bridge
//
// Run with: node test/v3bridge-test.js
// Must be run from webapp/ directory

const fs = require('fs');
const path = require('path');

// Load underscore globally (v3bridge.js expects it as global _)
global._ = require('../bower_components/underscore/underscore.js');

// Mock/load the ComparisonModel PureScript module
try {
  var ComparisonModel = require('../app/scripts/purescripts/output/ComparisonModel');
} catch (e) {
  console.log('WARNING: PureScript ComparisonModel not available, using mock');
  var ComparisonModel = {
    fixComparisonId: (id) => id,
    sortStringComparisonIds: (ids) => ids.sort(),
    orderIds: (ids) => ids.sort(),
  };
}

// Patch require so v3bridge can find its dependencies
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
const V3Bridge = require('../app/scripts/lib/v3bridge.js');

// Load the v3 sample file
const v3json = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../project-manager/diabetes_v3.cnm'), 'utf8'
));

// Test utilities
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log('  + ' + message);
  } else {
    failed++;
    console.log('  FAIL: ' + message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
    console.log('  + ' + message);
  } else {
    failed++;
    console.log('  FAIL: ' + message + ' (expected ' + expected + ', got ' + actual + ')');
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) < tolerance) {
    passed++;
    console.log('  + ' + message);
  } else {
    failed++;
    console.log('  FAIL: ' + message + ' (expected ~' + expected + ', got ' + actual + ')');
  }
}

// =========================================================
// Test: v3 format detection
// =========================================================
console.log('\n=== v3 Format Detection ===');

assert(V3Bridge.isV3Format(v3json), 'diabetes_v3.cnm is detected as v3');
assert(!V3Bridge.isV3Format({}), 'empty object is not v3');
assert(!V3Bridge.isV3Format({ cinema: {} }), 'cinema without version is not v3');
assert(!V3Bridge.isV3Format({ cinema: { version: '2.0.0', projects: [] } }), 'v2 version is not v3');
assert(!V3Bridge.isV3Format({ cinema: { version: '3.0.0', projects: [] } }), 'empty projects is not v3');
assert(V3Bridge.isV3Format({ cinema: { version: '3.0.0', projects: [{}] } }), 'v3 with one empty project is v3');
assert(V3Bridge.isV3Format({ cinema: { version: '3.1.0', projects: [{}] } }), 'v3.1 is detected as v3');

// =========================================================
// Test: getProjects
// =========================================================
console.log('\n=== getProjects ===');

const projects = V3Bridge.getProjects(v3json);
assertEqual(projects.length, 1, 'diabetes_v3.cnm has 1 project');
assertEqual(projects[0].title, 'Diabetes - Frequentist Fixed-Effect RD', 'project title correct');

// =========================================================
// Test: v3 → legacy state transformation
// =========================================================
console.log('\n=== v3 → Legacy State ===');

const mockCurrentState = {
  version: '3.0.0',
  text: { NetRob: { levels: ['low', 'moderate', 'high'] }, robLevels: ['low', 'moderate', 'high'] },
  defaults: {},
};

const legacyState = V3Bridge.v3ToLegacyState(v3json, mockCurrentState);

assert(legacyState !== null, 'legacyState produced');
assertEqual(legacyState.version, '3.0.0', 'version preserved');
assert(legacyState.project !== undefined, 'project exists');
assert(legacyState.project.hasFile === true, 'project.hasFile is true');
assertEqual(legacyState.project.type, 'binary', 'type is binary');
assertEqual(legacyState.project.format, 'long', 'format is long');
assert(legacyState.project.isRecognized === true, 'isRecognized is true');
assert(legacyState.project.isSaved === true, 'isSaved is true');

// Studies
console.log('\n=== Studies ===');
const studies = legacyState.project.studies;
assert(studies !== undefined, 'studies exists');
assertEqual(studies.long.length, 48, '48 study arms in long format');
assertEqual(studies.nodes.length, 6, '6 treatment nodes');
assertEqual(studies.directComparisons.length, 14, '14 direct comparisons');
assertEqual(studies.indirectComparisons.length, 1, '1 indirect comparison');
// Indirect comparisons from v3 are stored with colon separator (ACE:ARB)
// but buildIndirectComparisons computes them with comma (ACE,ARB from uniqId)
// The actual value depends on whether v3 pre-computed list was used
assert(studies.indirectComparisons[0] === 'ACE:ARB' || studies.indirectComparisons[0] === 'ACE,ARB',
  'indirect comparison is ACE:ARB or ACE,ARB (got ' + studies.indirectComparisons[0] + ')');

// Check first study arm
const firstArm = studies.long[0];
assertEqual(firstArm.id, '1', 'first arm id is "1" (string)');
assertEqual(firstArm.t, 'ACE', 'first arm treatment is ACE');
assertEqual(firstArm.n, 410, 'first arm n is 410');
assertEqual(firstArm.rob, 1, 'first arm rob is 1');
assertEqual(firstArm.r, 45, 'first arm events (r) is 45');

// Check robs map
const robs = studies.robs;
assert(typeof robs['1'] === 'number', 'robs has study "1"');
assertEqual(robs['1'], 1, 'study 1 rob is 1');

// CM / hatmatrix
console.log('\n=== Contribution Matrix / Analysis ===');
const cm = legacyState.project.CM;
assert(cm !== undefined, 'CM exists');
assert(cm.currentCM !== undefined, 'currentCM exists');
assertEqual(cm.currentCM.status, 'ready', 'CM status is ready');

const hatmatrix = cm.currentCM.hatmatrix;
assert(hatmatrix !== undefined, 'hatmatrix exists');
assertEqual(hatmatrix.model[0], 'fixed', 'model is fixed');
assertEqual(hatmatrix.sm[0], 'RD', 'sm is RD');
assertEqual(hatmatrix.NMAresults.length, 15, '15 NMA results');
assertEqual(hatmatrix.rowNames.length, 15, '15 hat matrix rows');
assertEqual(hatmatrix.colNames.length, 14, '14 hat matrix columns');

// Check NMA result structure
const aceARB = hatmatrix.NMAresults.find(r => r['_row'] === 'ACE:ARB');
assert(aceARB !== undefined, 'ACE:ARB result exists');
assertClose(aceARB['NMA treatment effect'], 0.0086, 0.001, 'ACE:ARB effect ~ 0.0086');
assertEqual(aceARB['PropDirNetmeta'], 0, 'ACE:ARB propDirect is 0');

const aceBB = hatmatrix.NMAresults.find(r => r['_row'] === 'ACE:BBlocker');
assert(aceBB !== undefined, 'ACE:BBlocker result exists');
assert(aceBB['Direct'] !== undefined, 'ACE:BBlocker has direct estimate');
assert(aceBB['Indirect'] !== undefined, 'ACE:BBlocker has indirect estimate');

// Heterogeneity and dbt
assert(hatmatrix.NMAheterResults.length === 1, 'NMAheterResults has one entry');
assert(hatmatrix.dbt.length === 1, 'dbt has one entry');

// Pairwise (may be empty if v3 source had no pairwise data)
assert(Array.isArray(hatmatrix.Pairwise), 'Pairwise is an array');
if (hatmatrix.Pairwise.length > 0) {
  const firstPairwise = hatmatrix.Pairwise[0];
  assert(firstPairwise['_row'] !== undefined, 'Pairwise row name present');
  assert(typeof firstPairwise['tau2'] === 'number', 'Pairwise tau2 is a number');
  assert(typeof firstPairwise['I2'] === 'number', 'Pairwise I2 is a number');
} else {
  console.log('  (i) No pairwise data in sample file (expected for this dataset)');
}

// =========================================================
// Test: Round-trip (v3 → legacy → v3)
// =========================================================
console.log('\n=== Round-trip: v3 -> legacy -> v3 ===');

const reExported = V3Bridge.legacyStateToV3(legacyState);
assert(reExported !== null, 're-exported v3 produced');
assert(reExported.cinema !== undefined, 'cinema wrapper exists');
assertEqual(reExported.cinema.version, '3.0.0', 'version is 3.0.0');
assertEqual(reExported.cinema.projects.length, 1, '1 project');

const reProject = reExported.cinema.projects[0];
assert(reProject.dataset !== undefined, 'dataset exists');
assertEqual(reProject.dataset.studies.length, 48, '48 study arms preserved');
assertEqual(reProject.dataset.type, 'binary', 'type preserved');
assertEqual(reProject.dataset.format, 'long', 'format preserved');

// Verify analysis round-tripped
assert(reProject.analysis !== undefined, 'analysis exists');
assertEqual(reProject.analysis.params.model, 'fixed', 'model preserved');
assertEqual(reProject.analysis.params.sm, 'RD', 'sm preserved');
assertEqual(reProject.analysis.frequentist.nmaResults.length, 15, '15 NMA results preserved');

// Check a specific NMA result survived round-trip
const reAceARB = reProject.analysis.frequentist.nmaResults.find(r => r.comparison === 'ACE:ARB');
assert(reAceARB !== undefined, 'ACE:ARB survives round-trip');
assertClose(reAceARB.effect, 0.0086, 0.001, 'ACE:ARB effect preserved');
assertEqual(reAceARB.propDirect, 0, 'ACE:ARB propDirect preserved');

// Check hat matrix preserved
const reHat = reProject.analysis.contributionMatrix.hatMatrix;
assertEqual(reHat.rowNames.length, 15, 'hat matrix rowNames preserved');
assertEqual(reHat.colNames.length, 14, 'hat matrix colNames preserved');

// Check study arm data integrity
const reFirstArm = reProject.dataset.studies[0];
assertEqual(reFirstArm.treatment, 'ACE', 'first arm treatment preserved');
assertEqual(reFirstArm.n, 410, 'first arm n preserved');
assertEqual(reFirstArm.events, 45, 'first arm events preserved');
assertEqual(reFirstArm.rob, 1, 'first arm rob preserved');

// =========================================================
// Test: Export with evaluation (mock)
// =========================================================
console.log('\n=== Export with evaluation domains ===');

// Add mock evaluation data to legacy state
legacyState.project.netRob = {
  status: 'ready',
  studyLimitations: {
    status: 'ready',
    customized: 0,
    rule: 'majRule',
    boxes: [
      { id: 'ACE:BBlocker', judgement: 1, label: 'low', color: '#02c000' },
      { id: 'ACE:CCB', judgement: 2, label: 'moderate', color: '#e0df02' },
    ],
  },
};

legacyState.project.heterogeneity = {
  heters: {
    status: 'ready',
    boxes: [
      { id: 'ACE:BBlocker', judgement: 1, ruleLevel: 1, customized: false },
    ],
  },
};

legacyState.project.incoherence = {
  status: 'ready',
  boxes: [
    { id: 'ACE:BBlocker', judgement: 2, ruleJudgement: 2, customized: false },
  ],
};

legacyState.project.imprecision = {
  status: 'ready',
  boxes: [
    { id: 'ACE:BBlocker', judgement: 1, ruleLevel: 1, customized: false },
  ],
};

legacyState.project.indirectness = {
  netindr: {
    status: 'ready',
    boxes: [
      { id: 'ACE:BBlocker', judgement: 1, ruleLevel: 1, customized: false },
    ],
  },
};

legacyState.project.pubbias = {
  status: 'ready',
  boxes: [
    { id: 'ACE:BBlocker', judgement: 2, ruleLevel: -1, customized: false },
  ],
};

legacyState.project.clinImp = {
  status: 'ready',
  question: 'Is the effect clinically important?',
  baseValue: 0.05,
  upperBound: 0.05,
  lowerBound: -0.05,
  emtype: 'RD',
};

const withEval = V3Bridge.legacyStateToV3(legacyState);
const evalProject = withEval.cinema.projects[0];

assert(evalProject.evaluation !== null, 'evaluation exported');
assert(evalProject.hasEvaluation === true, 'hasEvaluation is true');
assert(evalProject.evaluation.studyLimitations !== undefined, 'studyLimitations exported');
assertEqual(evalProject.evaluation.studyLimitations.boxes.length, 2, '2 study limitation boxes');
assert(evalProject.evaluation.heterogeneity !== undefined, 'heterogeneity exported');
assert(evalProject.evaluation.incoherence !== undefined, 'incoherence exported');
assert(evalProject.evaluation.imprecision !== undefined, 'imprecision exported');
assert(evalProject.evaluation.indirectness !== undefined, 'indirectness exported');
assert(evalProject.evaluation.reportingBias !== undefined, 'reportingBias exported');
assert(evalProject.evaluation.clinicalImportance !== undefined, 'clinicalImportance exported');
assertEqual(evalProject.evaluation.clinicalImportance.baseValue, 0.05, 'clinImp baseValue preserved');

// =========================================================
// Summary
// =========================================================
console.log('\n' + '='.repeat(50));
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed === 0) {
  console.log('V3 bridge test PASSED');
} else {
  console.log('V3 bridge test FAILED');
  process.exit(1);
}
