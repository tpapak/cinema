'use strict';

// v3bridge.js — Transforms CINeMA v3 exchange format into legacy internal State
//
// The v3 format (.cnm file) has:
//   { cinema: { version: "3.0.0", projects: [...Project] } }
//   Each Project: { dataset, analysis, evaluation, ... }
//   analysis: { params, contributionMatrix, frequentist, bayesian }
//
// The internal format (what CINeMA's State/Model expects) has:
//   { version, text, defaults, project: { hasFile, type, format,
//     studies: { long, wide, nodes, ... },
//     CM: { currentCM: { hatmatrix, ... } } } }
//
// This module bridges v3 → internal state.
// For multi-project files, the first project is loaded.
// A separate project manager handles project selection.

var ComparisonModel = require('../purescripts/output/ComparisonModel');
var Locales = require('../translations.json');

// =====================================================
// Helpers (shared with v2bridge patterns)
// =====================================================

var uniqId = (ids) => {
  return ids.sort();
};

var accumulate = (list, key) => {
  return _.reduce(list, (memo, el) => { return memo.concat([el[key]]); }, []);
};

var sumBy = (list, key) => {
  return _.reduce(list, (memo, el) => { return memo + el[key]; }, 0);
};

// Helper: majority rule (most frequent value; ties broken by highest)
var majRule = (arr) => {
  if (!arr || arr.length === 0) return -1;
  var counts = _.countBy(arr);
  var maxCount = 0;
  var result = -1;
  _.each(counts, (count, val) => {
    var numVal = parseInt(val);
    if (count > maxCount || (count === maxCount && numVal > result)) {
      maxCount = count;
      result = numVal;
    }
  });
  return result;
};

// Helper: mean rule (rounded average)
var meanRule = (arr) => {
  if (!arr || arr.length === 0) return -1;
  var sum = _.reduce(arr, (memo, v) => { return memo + v; }, 0);
  return Math.round(sum / arr.length);
};

// Helper: max rule
var maxRule = (arr) => {
  if (!arr || arr.length === 0) return -1;
  return _.max(arr);
};

// =====================================================
// Detection: is this a v3 JSON file?
// =====================================================
var isV3Format = (parsed) => {
  return (
    parsed &&
    parsed.cinema &&
    parsed.cinema.version &&
    parsed.cinema.version.startsWith('3.') &&
    Array.isArray(parsed.cinema.projects) &&
    parsed.cinema.projects.length > 0
  );
};

// =====================================================
// Get the list of projects from a v3 file
// =====================================================
var getProjects = (parsed) => {
  if (!isV3Format(parsed)) return [];
  return parsed.cinema.projects;
};

// =====================================================
// Build project.studies from v3 dataset
// =====================================================
var buildStudiesFromV3 = (dataset) => {
  // v3 studyArm: { study, id, treatment, n, rob, indirectness, events?, mean?, sd? }
  // internal long arm: { study, id, t, r/y/sd, n, rob, indirectness }
  var projectType = dataset.type;

  var long = _.map(dataset.studies, (arm) => {
    var row = {
      id: typeof arm.id === 'string' ? arm.id : String(arm.id),
      t: typeof arm.treatment === 'string' ? arm.treatment : String(arm.treatment),
      n: arm.n,
      rob: arm.rob,
      indirectness: arm.indirectness,
    };
    if (typeof arm.study !== 'undefined') {
      row.study = typeof arm.study === 'string' ? arm.study : String(arm.study);
    }
    if (projectType === 'binary') {
      row.r = arm.events || 0;
    } else if (projectType === 'continuous') {
      row.y = arm.mean || 0;
      row.sd = arm.sd || 0;
    }
    return row;
  });

  // Build wide-format from long
  var wide = buildWideFromLong(long, projectType);

  // Always compute nodes from long data to get complete internal fields
  // (low/unclear/high, indrlow/indrunclear/indrhigh, rob arrays, etc.)
  // v3 pre-computed nodes lack these derived fields needed for pie charts
  // if (dataset.nodes && dataset.nodes.length > 0) {
  //   nodes = _.map(dataset.nodes, (n) => {
  //     return {
  //       id: typeof n.id === 'string' ? n.id : String(n.id),
  //       label: n.label || String(n.id),
  //       numStudies: n.numStudies || 0,
  //       sampleSize: n.sampleSize || 0,
  //       rSum: 0,
  //       type: 'node',
  //       studies: [],
  //       rob: [],
  //       indirectness: [],
  //     };
  //   });
  // } else {
  //   nodes = buildNodes(long, projectType);
  // }
  var nodes = buildNodes(long, projectType);

  // Always compute direct comparisons from wide data to get complete fields
  // (rob arrays, majrob/meanrob/maxrob, indirectness rules, sampleSize, etc.)
  // v3 pre-computed edges lack these derived fields needed for edge coloring
  // if (dataset.directComparisons && dataset.directComparisons.length > 0) {
  //   directComparisons = _.map(dataset.directComparisons, (c) => {
  //     return {
  //       type: 'edge',
  //       id: c.id,
  //       t1: typeof c.t1 === 'string' ? c.t1 : String(c.t1),
  //       t2: typeof c.t2 === 'string' ? c.t2 : String(c.t2),
  //       source: typeof c.t1 === 'string' ? c.t1 : String(c.t1),
  //       target: typeof c.t2 === 'string' ? c.t2 : String(c.t2),
  //       numStudies: c.numStudies || 1,
  //       studies: [],
  //       rob: [],
  //       indirectness: [],
  //     };
  //   });
  // } else {
  //   directComparisons = buildDirectComparisons(wide, projectType);
  // }
  var directComparisons = buildDirectComparisons(wide, projectType);

  // Build indirect comparisons
  var indirectComparisons;
  if (dataset.indirectComparisons && dataset.indirectComparisons.length > 0) {
    indirectComparisons = dataset.indirectComparisons;
  } else {
    indirectComparisons = buildIndirectComparisons(nodes, directComparisons);
  }

  // Build rob/indirectness maps
  var robs = _.mapObject(_.groupBy(long, 'id'), (arms) => { return arms[0].rob; });
  var indrs = _.mapObject(_.groupBy(long, 'id'), (arms) => { return arms[0].indirectness; });

  return {
    long: long,
    wide: wide,
    nodes: nodes,
    directComparisons: directComparisons,
    indirectComparisons: indirectComparisons,
    robs: robs,
    indrs: indrs,
  };
};

// Long to Wide conversion (matches Reshaper.longToWide logic)
var buildWideFromLong = (long, projectType) => {
  var byStudy = _.groupBy(long, 'id');
  var wide = [];
  _.each(byStudy, (arms, studyId) => {
    for (var i = 0; i < arms.length; i++) {
      for (var j = i + 1; j < arms.length; j++) {
        var a1 = arms[i];
        var a2 = arms[j];
        var sorted = [a1, a2].sort((x, y) => x.t.localeCompare(y.t));
        var row = {
          id: a1.id,
          t1: sorted[0].t,
          t2: sorted[1].t,
          rob: a1.rob,
          indirectness: a1.indirectness,
        };
        if (typeof a1.study !== 'undefined') {
          row.study = a1.study;
        }
        if (projectType === 'binary') {
          row.r1 = sorted[0].r;
          row.n1 = sorted[0].n;
          row.r2 = sorted[1].r;
          row.n2 = sorted[1].n;
        } else if (projectType === 'continuous') {
          row.y1 = sorted[0].y;
          row.sd1 = sorted[0].sd;
          row.n1 = sorted[0].n;
          row.y2 = sorted[1].y;
          row.sd2 = sorted[1].sd;
          row.n2 = sorted[1].n;
        }
        wide.push(row);
      }
    }
  });
  return wide;
};

// Build treatment nodes
var buildNodes = (long, projectType) => {
  var grouped = _.groupBy(long, (arm) => { return arm.t; });
  return _.map(_.toArray(_.mapObject(grouped, (group, treatmentId) => {
    var vertex = {
      id: group[0].t,
      label: group[0].t,
      numStudies: group.length,
      sampleSize: projectType !== 'iv' ? sumBy(group, 'n') : 0,
      rSum: 0,
      type: 'node',
      studies: accumulate(group, 'id'),
      rob: accumulate(group, 'rob'),
      indirectness: accumulate(group, 'indirectness'),
    };
    vertex.low = _.filter(vertex.rob, (r) => { return r === 1; }).length / vertex.numStudies * 100;
    vertex.unclear = _.filter(vertex.rob, (r) => { return r === 2; }).length / vertex.numStudies * 100;
    vertex.high = _.filter(vertex.rob, (r) => { return r === 3; }).length / vertex.numStudies * 100;
    vertex.indrlow = _.filter(vertex.indirectness, (r) => { return r === 1; }).length / vertex.numStudies * 100;
    vertex.indrunclear = _.filter(vertex.indirectness, (r) => { return r === 2; }).length / vertex.numStudies * 100;
    vertex.indrhigh = _.filter(vertex.indirectness, (r) => { return r === 3; }).length / vertex.numStudies * 100;
    return vertex;
  })), (v) => { return v; });
};

// Build direct comparisons
var buildDirectComparisons = (wide, projectType) => {
  var byPair = _.groupBy(wide, (row) => {
    return uniqId([row.t1, row.t2]).toString();
  });
  var comparisons = _.map(byPair, (rows, pairId) => {
    var comp = {
      type: 'edge',
      id: pairId,
      studies: accumulate(rows, 'id'),
      t1: rows[0].t1,
      t2: rows[0].t2,
      source: rows[0].t1,
      target: rows[0].t2,
      numStudies: rows.length,
      rob: accumulate(rows, 'rob'),
      indirectness: accumulate(rows, 'indirectness'),
    };
    if (projectType === 'binary' || projectType === 'continuous') {
      if (typeof rows[0].n1 !== 'undefined') {
        comp.sampleSize = _.reduce(rows, (memo, r) => {
          return memo + (r.n1 || 0) + (r.n2 || 0);
        }, 0);
      }
    }
    comp.majrob = majRule(comp.rob);
    comp.meanrob = meanRule(comp.rob);
    comp.maxrob = maxRule(comp.rob);
    comp.majindr = majRule(comp.indirectness);
    comp.meanindr = meanRule(comp.indirectness);
    comp.maxindr = maxRule(comp.indirectness);
    comp.directRob = 'nothing';
    return comp;
  });
  try {
    var sortedIds = ComparisonModel.sortStringComparisonIds(_.pluck(comparisons, 'id'));
    comparisons = _.sortBy(comparisons, (c) => { return sortedIds.indexOf(c.id); });
  } catch (e) {
    comparisons = _.sortBy(comparisons, 'id');
  }
  return comparisons;
};

// Build indirect comparisons
var buildIndirectComparisons = (nodes, directComparisons) => {
  var directIds = _.pluck(directComparisons, 'id');
  var treatments = _.pluck(nodes, 'id');
  var indirect = [];
  for (var i = 0; i < treatments.length; i++) {
    for (var j = i + 1; j < treatments.length; j++) {
      var pairId = uniqId([treatments[i], treatments[j]]).toString();
      if (!_.contains(directIds, pairId)) {
        indirect.push(pairId);
      }
    }
  }
  return indirect;
};

// =====================================================
// Transform v3 analysis → legacy currentCM
// =====================================================
var analysisToLegacy = (analysis) => {
  var params = analysis.params;
  var cm = analysis.contributionMatrix;
  var freq = analysis.frequentist;
  // var bayes = analysis.bayesian; // reserved for future use

  var hatmatrix = {};

  // Hat matrix H
  if (cm && cm.hatMatrix) {
    hatmatrix.H = cm.hatMatrix.H;
    hatmatrix.rowNames = cm.hatMatrix.rowNames;
    hatmatrix.colNames = cm.hatMatrix.colNames;
  } else {
    hatmatrix.H = [];
    hatmatrix.rowNames = freq ? _.pluck(freq.nmaResults, 'comparison') : [];
    hatmatrix.colNames = [];
  }

  // NMAresults: transform v3 ComparisonResult[] → legacy R-format rows
  if (freq && freq.nmaResults) {
    hatmatrix.NMAresults = _.map(freq.nmaResults, (cr) => {
      var row = {
        '_row': cr.comparison,
        'NMA treatment effect': cr.effect,
        'se treat effect': cr.se,
        'lower CI': cr.ciLower,
        'upper CI': cr.ciUpper,
        'lower PrI': cr.priLower,
        'upper PrI': cr.priUpper,
        'PropDir': cr.propDirect,
        'PropDirNetmeta': cr.propDirect,
      };
      if (cr.direct) {
        row['Direct'] = cr.direct.effect;
        row['DirectL'] = cr.direct.ciLower;
        row['DirectU'] = cr.direct.ciUpper;
      }
      if (cr.indirect) {
        row['Indirect'] = cr.indirect.effect;
        row['IndirectL'] = cr.indirect.ciLower;
        row['IndirectU'] = cr.indirect.ciUpper;
      }
      if (cr.incoherence) {
        row['SideIF'] = cr.incoherence.effect;
        row['SideIFlower'] = cr.incoherence.ciLower;
        row['SideIFupper'] = cr.incoherence.ciUpper;
        row['SideZ'] = cr.incoherence.z;
        row['SidePvalue'] = cr.incoherence.pvalue;
      }
      return row;
    });
    hatmatrix.rowNamesNMAresults = _.pluck(hatmatrix.NMAresults, '_row');
    hatmatrix.colNamesNMAresults = [
      'Direct', 'DirectL', 'DirectU',
      'Indirect', 'IndirectL', 'IndirectU',
      'SideIF', 'SideIFlower', 'SideIFupper', 'SideZ', 'SidePvalue',
      'PropDir',
      'NMA treatment effect', 'se treat effect',
      'lower CI', 'upper CI',
      'lower PrI', 'upper PrI',
      'PropDirNetmeta'
    ];
  } else {
    hatmatrix.NMAresults = [];
    hatmatrix.rowNamesNMAresults = [];
    hatmatrix.colNamesNMAresults = [];
  }

  // Pairwise heterogeneity
  if (freq && freq.pairwise) {
    hatmatrix.Pairwise = _.map(freq.pairwise, (pr) => {
      return {
        '_row': pr.comparison,
        'tau2': pr.tau2,
        'I2': pr.I2,
        'I2 lower': (pr.I2Lower !== null && pr.I2Lower !== undefined) ? pr.I2Lower : 0,
        'I2 upper': (pr.I2Upper !== null && pr.I2Upper !== undefined) ? pr.I2Upper : 0,
      };
    });
    hatmatrix.rowNamesPairwise = _.pluck(hatmatrix.Pairwise, '_row');
    hatmatrix.colNamesPairwise = ['tau2', 'I2', 'I2 lower', 'I2 upper'];
  } else {
    hatmatrix.Pairwise = [];
    hatmatrix.rowNamesPairwise = [];
    hatmatrix.colNamesPairwise = ['tau2', 'I2', 'I2 lower', 'I2 upper'];
  }

  // Network heterogeneity
  if (freq && freq.networkHeterogeneity) {
    var nh = freq.networkHeterogeneity;
    hatmatrix.NMAheterResults = [{
      'heterVarNtw': nh.tau2,
      'Q overall': nh.Qoverall || 0,
      'Q heterogeneity': nh.Qheterogeneity || 0,
      'Q inconsistency': nh.Qinconsistency || 0,
    }];
  } else {
    hatmatrix.NMAheterResults = [{ 'heterVarNtw': 0, 'Q overall': 0, 'Q heterogeneity': 0, 'Q inconsistency': 0 }];
  }

  // Design-by-treatment test
  if (freq && freq.designByTreatment) {
    var dbt = freq.designByTreatment;
    hatmatrix.dbt = [{
      'Q_dbt': dbt.Q,
      'df': dbt.df,
      'pv_dbt': dbt.pvalue,
    }];
  } else {
    hatmatrix.dbt = [{ 'Q_dbt': 0, 'df': 0, 'pv_dbt': 1 }];
  }
  hatmatrix.colNamesdbt = ['Q_dbt', 'df', 'pv_dbt'];

  // Model, sm, tau — wrapped in single-element arrays (R serialization quirk)
  hatmatrix.model = [params.model];
  hatmatrix.sm = [params.sm];
  hatmatrix.tau = [params.tau || 0];

  // forleaguetable / forstudycontribution — not needed (pre-computed in v3)
  hatmatrix.forleaguetable = {};
  hatmatrix.forstudycontribution = [];

  return hatmatrix;
};

// =====================================================
// Build savedComparisons from studyContributions
// =====================================================
var buildSavedComparisons = (studyContributions, colNames) => {
  var savedComparisons = _.map(_.keys(studyContributions), (compId) => {
    return {
      rowname: compId,
      perstudy: studyContributions[compId],
      comparisons: new Array(colNames.length).fill(0),
    };
  });
  return savedComparisons;
};

// =====================================================
// Split comparisons into direct/indirect
// =====================================================
var splitComparisons = (savedComparisons, directComparisonIds) => {
  var directRows = _.filter(savedComparisons, (sc) => {
    var normalized = uniqId(sc.rowname.replace(':', ',').split(',')).toString();
    return _.contains(directComparisonIds, normalized);
  });
  var indirectRows = _.filter(savedComparisons, (sc) => {
    var normalized = uniqId(sc.rowname.replace(':', ',').split(',')).toString();
    return !_.contains(directComparisonIds, normalized);
  });
  var sortRows = (rows) => {
    try {
      var fixednames = _.map(rows, (r) => { return ComparisonModel.fixComparisonId(r.rowname); });
      var sortedIds = ComparisonModel.sortStringComparisonIds(fixednames);
      return _.sortBy(rows, (r) => {
        return sortedIds.indexOf(ComparisonModel.fixComparisonId(r.rowname));
      });
    } catch (e) {
      return _.sortBy(rows, 'rowname');
    }
  };
  directRows = sortRows(directRows);
  indirectRows = sortRows(indirectRows);
  return {
    directRowNames: _.pluck(directRows, 'rowname'),
    directStudies: _.pluck(directRows, 'comparisons'),
    indirectRowNames: _.pluck(indirectRows, 'rowname'),
    indirectStudies: _.pluck(indirectRows, 'comparisons'),
  };
};

// =====================================================
// Main: transform v3 project → legacy internal State
// =====================================================
var v3ProjectToLegacyState = (v3project, v3meta, currentState) => {
  var dataset = v3project.dataset;
  var analysis = v3project.analysis;
  var evaluation = v3project.evaluation || {};

  // Build project.studies
  var studies = buildStudiesFromV3(dataset);
  var directComparisonIds = _.pluck(studies.directComparisons, 'id');

  // Build hatmatrix from analysis
  var hatmatrix = analysis ? analysisToLegacy(analysis) : {};

  // Build study contributions
  var colNames = hatmatrix.colNames || [];
  var studyContributions = {};
  if (analysis && analysis.contributionMatrix && analysis.contributionMatrix.studyContributions) {
    studyContributions = analysis.contributionMatrix.studyContributions;
  }

  var savedComparisons = buildSavedComparisons(studyContributions, colNames);
  var split = splitComparisons(savedComparisons, directComparisonIds);

  // Re-key study contributions from study name to study ID
  // R/netmeta sanitizes names: replaces hyphens, dots, spaces with underscores.
  // Build both exact and normalized (R-style) lookup maps.
  var studyNameToId = {};
  var normalizedNameToId = {};
  _.each(dataset.studies, (arm) => {
    var studyName = typeof arm.study === 'string' ? arm.study : String(arm.study);
    var studyIdStr = typeof arm.id === 'string' ? arm.id : String(arm.id);
    studyNameToId[studyName] = studyIdStr;
    // R-style normalization: replace hyphens, dots, spaces with underscores
    var normalized = studyName.replace(/[-. ]/g, '_');
    normalizedNameToId[normalized] = studyIdStr;
  });
  var allStudyIdStrings = _.uniq(_.values(studyNameToId));
  // v3 stores contributions as proportions (0-1), internal state uses percentages (0-100)
  var studycontributions = _.mapObject(studyContributions, (studyMap) => {
    var filled = {};
    _.each(allStudyIdStrings, (sid) => {
      filled[sid] = 0;
    });
    // Detect scale: if all values sum to ~1, multiply by 100 to get percentages
    var rawSum = _.reduce(_.values(studyMap), (a, b) => { return a + b; }, 0);
    var scale = (rawSum > 0 && rawSum <= 1.5) ? 100 : 1;
    _.each(studyMap, (value, studyName) => {
      // Try exact match first, then normalized (R-style) match
      var studyId = studyNameToId[studyName] || normalizedNameToId[studyName];
      if (studyId) {
        filled[studyId] = value * scale;
      } else {
        // Key might already be an ID
        filled[studyName] = value * scale;
      }
    });
    return filled;
  });

  // League tables
  var leaguetable = [];
  var leaguetableLM = {};
  var leaguetableL = {};
  if (analysis && analysis.frequentist) {
    leaguetable = analysis.frequentist.leagueTable || [];
    if (analysis.frequentist.sensitivityLeagueTables) {
      leaguetableLM = analysis.frequentist.sensitivityLeagueTables.lowModerateRoB || {};
      leaguetableL = analysis.frequentist.sensitivityLeagueTables.lowRoB || {};
    }
  }

  // Reconstruct league table from NMA results if not stored in v3
  var nmaResultsForLT = hatmatrix.NMAresults || [];
  if ((!leaguetable || leaguetable.length === 0) && nmaResultsForLT.length > 0) {
    var ltTreatments = _.pluck(studies.nodes, 'id');
    var sm = (analysis && analysis.params && analysis.params.sm) || 'OR';
    var isRatio = (sm === 'OR' || sm === 'RR' || sm === 'HR');
    // Build lookup: "A:B" -> NMA row
    var nmaLookup = {};
    nmaResultsForLT.forEach(function(r) { nmaLookup[r._row] = r; });
    // Build n x n string matrix
    var n = ltTreatments.length;
    leaguetable = [];
    for (var i = 0; i < n; i++) {
      var row = [];
      for (var j = 0; j < n; j++) {
        if (i === j) {
          row.push(ltTreatments[i]);
        } else {
          // Try both orderings
          var key1 = ltTreatments[i] + ':' + ltTreatments[j];
          var key2 = ltTreatments[j] + ':' + ltTreatments[i];
          var nmaRow = nmaLookup[key1] || nmaLookup[key2];
          if (nmaRow) {
            var te = nmaRow['NMA treatment effect'];
            var lo = nmaRow['lower CI'];
            var up = nmaRow['upper CI'];
            // If we found key2 (reversed), flip the sign (or invert for ratio)
            if (!nmaLookup[key1] && nmaLookup[key2]) {
              if (isRatio) {
                // On log scale, flip sign then exp
                te = -te; lo = -nmaRow['upper CI']; up = -nmaRow['lower CI'];
              } else {
                te = -te; lo = -nmaRow['upper CI']; up = -nmaRow['lower CI'];
              }
            }
            // Apply exp for ratio measures
            if (isRatio) {
              te = Math.exp(te);
              lo = Math.exp(lo);
              up = Math.exp(up);
            }
            var teStr = te.toFixed(3);
            var loStr = lo.toFixed(3);
            var upStr = up.toFixed(3);
            row.push(teStr + ' (' + loStr + ', ' + upStr + ')');
          } else {
            row.push('');
          }
        }
      }
      leaguetable.push(row);
    }
  }

  // Build currentCM
  var treatments = _.pluck(studies.nodes, 'id');
  var analysisParams = (analysis && analysis.params) || {};
  var currentCM = {
    status: analysis ? 'ready' : 'empty',
    params: {
      MAModel: analysisParams.model || 'random',
      sm: analysisParams.sm || 'OR',
      intvs: treatments,
      rule: 'every',
    },
    hatmatrix: hatmatrix,
    leaguetable: leaguetable,
    leaguetableLM: leaguetableLM,
    leaguetableL: leaguetableL,
    savedComparisons: savedComparisons,
    selectedComparisons: hatmatrix.rowNames || [],
    colNames: colNames,
    directRowNames: split.directRowNames,
    directStudies: split.directStudies,
    indirectRowNames: split.indirectRowNames,
    indirectStudies: split.indirectStudies,
    studycontributions: studycontributions,
    progress: 100,
    currentRow: '',
  };

  // Build full state
  var version = currentState ? currentState.version : '3.0.0';
  var text = currentState ? currentState.text : Locales['EN'];
  var defaults = currentState ? currentState.defaults : {};

  // Ensure defaults levels have labels from text (modules expect .label on defaults)
  if (defaults.robLevels && text.robLevels) {
    _.each(defaults.robLevels, function(r) { r.label = text.robLevels[r.id - 1]; });
  }
  if (defaults.studyLimitationLevels && text.NetRob && text.NetRob.levels) {
    _.each(defaults.studyLimitationLevels, function(r) { r.label = text.NetRob.levels[r.id - 1]; });
  }
  if (defaults.indrLevels && text.indrLevels) {
    _.each(defaults.indrLevels, function(r) { r.label = text.indrLevels[r.id - 1]; });
  }
  if (defaults.netIndrLevels && text.NetIndr && text.NetIndr.levels) {
    _.each(defaults.netIndrLevels, function(r) { r.label = text.NetIndr.levels[r.id - 1]; });
  }
  if (defaults.pubbiasLevels && text.pubbiasLevels) {
    _.each(defaults.pubbiasLevels, function(r) { r.label = text.pubbiasLevels[r.id - 1]; });
  }

  var timestamp = new Date();
  var title = v3project.title || v3meta.title || ('v3_import_' + timestamp.getTime());

  var robLevels = (dataset.robLevels && dataset.robLevels.length > 0) ? dataset.robLevels : [
    { id: 1, label: 'Low', color: '#02c000' },
    { id: 2, label: 'Moderate', color: '#e0df02' },
    { id: 3, label: 'High', color: '#c00000' },
  ];

  var state = {
    version: version,
    text: text,
    defaults: defaults,
    timestamp: timestamp,
    router: {
      currentRoute: 'general',
    },
    wt: 0,
    project: {
      hasFile: true,
      filename: title,
      title: title,
      id: v3project.id || ('v3_' + timestamp.getTime()),
      creationDate: timestamp.getTime(),
      accessDate: timestamp.getTime(),
      type: dataset.type,
      format: dataset.format,
      isRecognized: true,
      isSaved: true,
      studies: studies,
      robLevels: robLevels,
      studyLimitationLevels: [
        { id: 1, label: 'Low risk', color: '#02c000' },
        { id: 2, label: 'Some concerns', color: '#e0df02' },
        { id: 3, label: 'High risk', color: '#c00000' },
      ],
      CM: {
        contributionMatrices: [currentCM],
        currentCM: currentCM,
      },
      // Stub evaluation domain fields required by PureScript State decoder.
      // These are overwritten by their respective JS module updateState() calls,
      // but must exist so PureScript readState (ClinImpUpdate.updateState) can
      // decode the entire State and reach hasConMat / getEffectMeasureType.
      netRob: {
        status: 'empty',
        studyLimitations: {
          customized: 0,
          rule: 'noRule',
          status: 'empty',
          boxes: [],
        },
      },
      clinImp: {
        status: 'not_ready',
        question: 'Define threshold of clinical importance',
        baseValue: -2.0,
        upperBound: -4.0,
        lowerBound: -4.0,
        emtype: (analysisParams.sm || 'OR'),
      },
      heterogeneity: {
        heters: { status: 'empty', boxes: [] },
        referenceValues: { status: 'empty', treatments: [] },
      },
      incoherence: { status: 'empty', boxes: [] },
      indirectness: {
        netindr: { status: 'empty', boxes: [] },
      },
      imprecision: { status: 'empty', boxes: [] },
      pubbias: { status: 'empty', boxes: [] },
      report: {
        status: 'notReady',
        hasChanged: false,
        directRows: [],
        indirectRows: [],
      },
    },
  };

  // Restore evaluation data from v3 if available
  if (evaluation.clinicalImportance) {
    var ci = evaluation.clinicalImportance;
    state.project.clinImp = {
      status: ci.status || 'not_ready',
      question: ci.question || 'Define threshold of clinical importance',
      baseValue: (typeof ci.baseValue === 'number') ? ci.baseValue : -2.0,
      upperBound: (typeof ci.upperBound === 'number') ? ci.upperBound : -4.0,
      lowerBound: (typeof ci.lowerBound === 'number') ? ci.lowerBound : -4.0,
      emtype: ci.emtype || (analysisParams.sm || 'OR'),
    };
  }

  return state;
};

// =====================================================
// Convenience: load first project from v3 file
// =====================================================
var v3ToLegacyState = (parsed, currentState) => {
  var v3meta = {
    title: parsed.cinema.title || '',
    description: parsed.cinema.description || '',
    author: parsed.cinema.author || '',
  };
  var firstProject = parsed.cinema.projects[0];
  return v3ProjectToLegacyState(firstProject, v3meta, currentState);
};

// =====================================================
// EXPORT: Legacy internal state → v3 .cnm format
// =====================================================

// Transform legacy hatmatrix NMAresults → v3 ComparisonResult[]
var legacyNMAToV3 = (nmaResults) => {
  if (!nmaResults || nmaResults.length === 0) return [];
  return _.map(nmaResults, (row) => {
    var result = {
      comparison: row['_row'],
      effect: row['NMA treatment effect'],
      se: row['se treat effect'],
      ciLower: row['lower CI'],
      ciUpper: row['upper CI'],
      priLower: row['lower PrI'],
      priUpper: row['upper PrI'],
      propDirect: row['PropDirNetmeta'] || row['PropDir'] || 0,
    };
    // Direct estimate
    if (typeof row['Direct'] !== 'undefined' && row['Direct'] !== null) {
      result.direct = {
        effect: row['Direct'],
        ciLower: row['DirectL'],
        ciUpper: row['DirectU'],
      };
    }
    // Indirect estimate
    if (typeof row['Indirect'] !== 'undefined' && row['Indirect'] !== null) {
      result.indirect = {
        effect: row['Indirect'],
        ciLower: row['IndirectL'],
        ciUpper: row['IndirectU'],
      };
    }
    // Incoherence (SIDE test) — requires both direct and indirect
    if (typeof row['SideIF'] !== 'undefined' && row['SideIF'] !== null && result.direct && result.indirect) {
      result.incoherence = {
        effect: row['SideIF'],
        ciLower: row['SideIFlower'],
        ciUpper: row['SideIFupper'],
        z: row['SideZ'],
        pvalue: row['SidePvalue'],
      };
    }
    return result;
  });
};

// Transform legacy Pairwise → v3 PairwiseResult[]
var legacyPairwiseToV3 = (pairwise) => {
  if (!pairwise || pairwise.length === 0) return undefined;
  return _.map(pairwise, (row) => {
    var result = {
      comparison: row['_row'],
      tau2: row['tau2'],
      I2: row['I2'],
    };
    if (typeof row['I2 lower'] !== 'undefined') {
      result.I2Lower = row['I2 lower'];
    }
    if (typeof row['I2 upper'] !== 'undefined') {
      result.I2Upper = row['I2 upper'];
    }
    return result;
  });
};

// Transform legacy NMAheterResults → v3 NetworkHeterogeneity
var legacyHeterToV3 = (heterResults) => {
  if (!heterResults || heterResults.length === 0) return undefined;
  var h = heterResults[0];
  return {
    tau2: h['heterVarNtw'] || 0,
    Qoverall: h['Q overall'] || 0,
    Qheterogeneity: h['Q heterogeneity'] || 0,
    Qinconsistency: h['Q inconsistency'] || 0,
  };
};

// Transform legacy dbt → v3 DesignByTreatment
var legacyDbtToV3 = (dbt) => {
  if (!dbt || dbt.length === 0) return undefined;
  var d = dbt[0];
  // Skip if all zeros (placeholder)
  if (d['Q_dbt'] === 0 && d['df'] === 0 && d['pv_dbt'] === 1) return undefined;
  return {
    Q: d['Q_dbt'],
    df: d['df'],
    pvalue: d['pv_dbt'],
  };
};

// Build v3 studyArm[] from internal studies.long
var legacyStudiesToV3 = (long, projectType) => {
  return _.map(long, (arm) => {
    var row = {
      study: arm.study || arm.id,
      id: arm.id,
      treatment: arm.t,
      n: arm.n,
      rob: arm.rob,
      indirectness: arm.indirectness,
    };
    if (projectType === 'binary') {
      row.events = arm.r || 0;
    } else if (projectType === 'continuous') {
      row.mean = arm.y || 0;
      row.sd = arm.sd || 0;
    }
    return row;
  });
};

// Build v3 nodes[] from internal studies.nodes
var legacyNodesToV3 = (nodes) => {
  if (!nodes || nodes.length === 0) return undefined;
  return _.map(nodes, (n) => {
    return {
      id: n.id,
      label: n.label || n.id,
      numStudies: n.numStudies || 0,
      sampleSize: n.sampleSize || 0,
    };
  });
};

// Build v3 directComparisons[] from internal
var legacyDirectCompsToV3 = (directComparisons) => {
  if (!directComparisons || directComparisons.length === 0) return undefined;
  return _.map(directComparisons, (c) => {
    return {
      id: c.id,
      t1: c.t1,
      t2: c.t2,
      numStudies: c.numStudies || 1,
    };
  });
};

// Build v3 evaluation from internal project domains
var legacyEvaluationToV3 = (project) => {
  var evaluation = {};
  var hasAnything = false;

  // Study limitations (project.netRob.studyLimitations)
  if (project.netRob && project.netRob.studyLimitations &&
      project.netRob.studyLimitations.status === 'ready') {
    evaluation.studyLimitations = {
      status: 'ready',
      boxes: _.map(project.netRob.studyLimitations.boxes || [], (box) => {
        var b = {
          id: box.id,
          judgement: box.judgement,
        };
        if (box.label) b.label = box.label;
        if (box.color) b.color = box.color;
        return b;
      }),
    };
    hasAnything = true;
  }

  // Heterogeneity (project.heterogeneity.heters)
  if (project.heterogeneity && project.heterogeneity.heters &&
      project.heterogeneity.heters.status === 'ready') {
    evaluation.heterogeneity = {
      status: 'ready',
      boxes: _.map(project.heterogeneity.heters.boxes || [], (box) => {
        var b = {
          id: box.id,
          judgement: box.judgement,
        };
        if (box.label) b.label = box.label;
        if (box.color) b.color = box.color;
        if (typeof box.ruleLevel !== 'undefined') b.ruleLevel = box.ruleLevel;
        if (typeof box.customized !== 'undefined') b.customized = box.customized;
        if (box.levels) b.levels = box.levels;
        return b;
      }),
    };
    hasAnything = true;
  }

  // Incoherence (project.incoherence)
  if (project.incoherence && project.incoherence.status === 'ready') {
    evaluation.incoherence = {
      status: 'ready',
      boxes: _.map(project.incoherence.boxes || [], (box) => {
        var b = {
          id: box.id,
          judgement: box.judgement,
        };
        if (box.label) b.label = box.label;
        if (box.color) b.color = box.color;
        if (typeof box.ruleJudgement !== 'undefined') b.ruleJudgement = box.ruleJudgement;
        if (typeof box.customized !== 'undefined') b.customized = box.customized;
        if (box.levels) b.levels = box.levels;
        return b;
      }),
    };
    hasAnything = true;
  }

  // Imprecision (project.imprecision)
  if (project.imprecision && project.imprecision.status === 'ready') {
    evaluation.imprecision = {
      status: 'ready',
      boxes: _.map(project.imprecision.boxes || [], (box) => {
        var b = {
          id: box.id,
          judgement: box.judgement,
        };
        if (box.label) b.label = box.label;
        if (box.color) b.color = box.color;
        if (typeof box.ruleLevel !== 'undefined') b.ruleLevel = box.ruleLevel;
        if (typeof box.customized !== 'undefined') b.customized = box.customized;
        if (box.levels) b.levels = box.levels;
        return b;
      }),
    };
    hasAnything = true;
  }

  // Indirectness (project.indirectness.netindr)
  var netindr = project.indirectness && project.indirectness.netindr;
  if (netindr && (netindr.status === 'ready' || netindr.status === 'noRule')) {
    evaluation.indirectness = {
      status: netindr.status,
      boxes: _.map(netindr.boxes || [], (box) => {
        var b = {
          id: box.id,
          judgement: box.judgement,
        };
        if (box.label) b.label = box.label;
        if (box.color) b.color = box.color;
        if (typeof box.ruleLevel !== 'undefined') b.ruleLevel = box.ruleLevel;
        if (typeof box.customized !== 'undefined') b.customized = box.customized;
        if (box.levels) b.levels = box.levels;
        return b;
      }),
    };
    hasAnything = true;
  }

  // Reporting bias (project.pubbias)
  if (project.pubbias && project.pubbias.status === 'ready') {
    evaluation.reportingBias = {
      status: 'ready',
      boxes: _.map(project.pubbias.boxes || [], (box) => {
        var b = {
          id: box.id,
          judgement: box.judgement,
        };
        if (box.label) b.label = box.label;
        if (box.color) b.color = box.color;
        if (typeof box.ruleLevel !== 'undefined') b.ruleLevel = box.ruleLevel;
        if (typeof box.customized !== 'undefined') b.customized = box.customized;
        if (box.levels) b.levels = box.levels;
        return b;
      }),
    };
    hasAnything = true;
  }

  // Clinical importance (project.clinImp)
  if (project.clinImp && (project.clinImp.status === 'ready' || project.clinImp.status === 'not_set')) {
    evaluation.clinicalImportance = {
      status: project.clinImp.status,
    };
    if (typeof project.clinImp.question !== 'undefined') {
      evaluation.clinicalImportance.question = project.clinImp.question;
    }
    if (typeof project.clinImp.baseValue !== 'undefined') {
      evaluation.clinicalImportance.baseValue = project.clinImp.baseValue;
    }
    if (typeof project.clinImp.upperBound !== 'undefined') {
      evaluation.clinicalImportance.upperBound = project.clinImp.upperBound;
    }
    if (typeof project.clinImp.lowerBound !== 'undefined') {
      evaluation.clinicalImportance.lowerBound = project.clinImp.lowerBound;
    }
    if (typeof project.clinImp.emtype !== 'undefined') {
      evaluation.clinicalImportance.emtype = project.clinImp.emtype;
    }
    hasAnything = true;
  }

  // Report (project.report)
  if (project.report && project.report.status === 'ready') {
    evaluation.report = {
      status: project.report.status,
      hasChanged: project.report.hasChanged || false,
      directRows: project.report.directRows || [],
      indirectRows: project.report.indirectRows || [],
    };
    hasAnything = true;
  }

  return hasAnything ? evaluation : null;
};

// =====================================================
// Main export: internal State → v3 .cnm JSON object
// =====================================================
var legacyStateToV3 = (state) => {
  var project = state.project;
  if (!project || !project.hasFile) {
    return null;
  }

  var timestamp = new Date().toISOString();

  // Build dataset
  var dataset = {
    format: project.format || 'long',
    type: project.type || 'binary',
    studies: legacyStudiesToV3(project.studies.long, project.type),
  };

  var v3nodes = legacyNodesToV3(project.studies.nodes);
  if (v3nodes) dataset.nodes = v3nodes;

  var v3directs = legacyDirectCompsToV3(project.studies.directComparisons);
  if (v3directs) dataset.directComparisons = v3directs;

  if (project.studies.indirectComparisons && project.studies.indirectComparisons.length > 0) {
    dataset.indirectComparisons = project.studies.indirectComparisons;
  }

  // Build analysis (if contribution matrix / NMA results exist)
  var v3analysis = null;
  var cm = project.CM && project.CM.currentCM;
  if (cm && cm.hatmatrix && cm.hatmatrix.NMAresults && cm.hatmatrix.NMAresults.length > 0) {
    var hm = cm.hatmatrix;

    // Analysis params
    var params = {
      model: (hm.model && hm.model[0]) || (cm.params && cm.params.MAModel) || 'random',
      sm: (hm.sm && hm.sm[0]) || (cm.params && cm.params.sm) || 'OR',
    };
    if (hm.tau && hm.tau[0]) {
      params.tau = hm.tau[0];
    }

    // Contribution matrix
    // Internal state uses percentages (0-100), v3 stores proportions (0-1)
    var rawStudyContrs = cm.studycontributions || {};
    var v3StudyContributions = _.mapObject(rawStudyContrs, (studyMap) => {
      // Detect scale: if values sum to ~100, divide by 100 to get proportions
      var rawSum = _.reduce(_.values(studyMap), (a, b) => { return a + b; }, 0);
      var scale = (rawSum > 1.5) ? 0.01 : 1;
      return _.mapObject(studyMap, (val) => { return val * scale; });
    });
    var contributionMatrix = {
      hatMatrix: {
        H: hm.H || [],
        rowNames: hm.rowNames || [],
        colNames: hm.colNames || [],
      },
      studyContributions: v3StudyContributions,
    };

    // Frequentist results
    var frequentist = {
      nmaResults: legacyNMAToV3(hm.NMAresults),
    };

    var v3pairwise = legacyPairwiseToV3(hm.Pairwise);
    if (v3pairwise) frequentist.pairwise = v3pairwise;

    var v3heter = legacyHeterToV3(hm.NMAheterResults);
    if (v3heter) frequentist.networkHeterogeneity = v3heter;

    var v3dbt = legacyDbtToV3(hm.dbt);
    if (v3dbt) frequentist.designByTreatment = v3dbt;

    if (cm.leaguetable && ((Array.isArray(cm.leaguetable) && cm.leaguetable.length > 0) ||
        (!Array.isArray(cm.leaguetable) && Object.keys(cm.leaguetable).length > 0))) {
      frequentist.leagueTable = cm.leaguetable;
    }

    if ((cm.leaguetableLM && Object.keys(cm.leaguetableLM).length > 0) ||
        (cm.leaguetableL && Object.keys(cm.leaguetableL).length > 0)) {
      frequentist.sensitivityLeagueTables = {};
      if (cm.leaguetableLM && Object.keys(cm.leaguetableLM).length > 0) {
        frequentist.sensitivityLeagueTables.lowModerateRoB = cm.leaguetableLM;
      }
      if (cm.leaguetableL && Object.keys(cm.leaguetableL).length > 0) {
        frequentist.sensitivityLeagueTables.lowRoB = cm.leaguetableL;
      }
    }

    v3analysis = {
      params: params,
      contributionMatrix: contributionMatrix,
      frequentist: frequentist,
      bayesian: null,
    };
  }

  // Build evaluation
  var v3evaluation = legacyEvaluationToV3(project);
  var hasEval = v3evaluation !== null;

  // Build v3 project
  var v3project = {
    id: project.id || ('cinema_' + Date.now()),
    title: project.title || project.filename || 'Untitled',
    outcome: '',
    createdAt: project.creationDate ? new Date(project.creationDate).toISOString() : timestamp,
    updatedAt: timestamp,
    hasEvaluation: hasEval,
    dataset: dataset,
  };

  if (v3analysis) v3project.analysis = v3analysis;
  if (v3evaluation) v3project.evaluation = v3evaluation;

  // Build v3 .cnm envelope
  var v3 = {
    cinema: {
      version: '3.0.0',
      title: project.title || 'CINeMA Export',
      createdAt: timestamp,
      updatedAt: timestamp,
      projects: [v3project],
    },
  };

  return v3;
};

module.exports = {
  isV3Format: isV3Format,
  getProjects: getProjects,
  v3ToLegacyState: v3ToLegacyState,
  v3ProjectToLegacyState: v3ProjectToLegacyState,
  legacyStateToV3: legacyStateToV3,
  // Exported for testing
  buildStudiesFromV3: buildStudiesFromV3,
  analysisToLegacy: analysisToLegacy,
  buildSavedComparisons: buildSavedComparisons,
  splitComparisons: splitComparisons,
  legacyNMAToV3: legacyNMAToV3,
  legacyEvaluationToV3: legacyEvaluationToV3,
};
