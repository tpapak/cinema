'use strict';

// v2bridge.js — Transforms CINeMA v2 exchange format into legacy v1 State
//
// The v2 format (from MetaInsight or other NMA tools) has:
//   { project: { format, type, studies: [...StudyArm], analyses: [...Analysis] } }
//
// The v1 format (what CINeMA's internal State/Model expects) has:
//   { version, text, defaults, project: { hasFile, type, format, studies: { long, wide, nodes, ... }, CM: { currentCM: { hatmatrix, ... } } } }
//
// This module bridges the two.

var ComparisonModel = require('../purescripts/output/ComparisonModel');
var Locales = require('../translations.json');

var uniqId = (ids) => {
  return ids.sort();
};

var accumulate = (list, key) => {
  return _.reduce(list, (memo, el) => { return memo.concat([el[key]]); }, []);
};

var sumBy = (list, key) => {
  return _.reduce(list, (memo, el) => { return memo + el[key]; }, 0);
};

// =====================================================
// Detection: is this a v2 JSON file?
// =====================================================
var isV2Format = (parsed) => {
  return (
    parsed &&
    parsed.project &&
    Array.isArray(parsed.project.analyses) &&
    Array.isArray(parsed.project.studies) &&
    typeof parsed.project.format === 'string' &&
    typeof parsed.project.type === 'string'
  );
};

// =====================================================
// Build project.studies from v2 StudyArm[] data
// =====================================================
var buildStudiesFromV2 = (v2studies, projectType) => {
  // v2 StudyArm: { study, id, treatment, n, rob, indirectness, events?, mean?, sd? }
  // v1 long arm: { study, id, t, r/y/sd, n, rob, indirectness }

  // Build long-format arms
  let long = _.map(v2studies, (arm) => {
    let row = {
      id: arm.id,
      t: typeof arm.treatment === 'string' ? arm.treatment : String(arm.treatment),
      n: arm.n,
      rob: arm.rob,
      indirectness: arm.indirectness,
    };
    // Include study name if present
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

  // Build wide-format comparisons from long data
  let wide = buildWideFromLong(long, projectType);

  // Build nodes (treatment vertices)
  let nodes = buildNodes(long, projectType);

  // Build direct comparisons (observed edges)
  let directComparisons = buildDirectComparisons(wide, projectType);

  // Build indirect comparisons (unobserved edges)
  let indirectComparisons = buildIndirectComparisons(nodes, directComparisons);

  // Build rob/indirectness maps keyed by study id
  let robs = _.mapObject(_.groupBy(long, 'id'), (arms) => { return arms[0].rob; });
  let indrs = _.mapObject(_.groupBy(long, 'id'), (arms) => { return arms[0].indirectness; });

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
  let byStudy = _.groupBy(long, 'id');
  let wide = [];
  _.each(byStudy, (arms, studyId) => {
    // Generate all pairwise combinations within this study
    for (let i = 0; i < arms.length; i++) {
      for (let j = i + 1; j < arms.length; j++) {
        let a1 = arms[i];
        let a2 = arms[j];
        // Sort alphabetically by treatment
        let sorted = [a1, a2].sort((x, y) => x.t.localeCompare(y.t));
        let row = {
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

// Build treatment nodes (matches model.js makeNodes)
var buildNodes = (long, projectType) => {
  let grouped = _.groupBy(long, (arm) => { return arm.t; });
  return _.map(_.toArray(_.mapObject(grouped, (group, treatmentId) => {
    let vertex = {
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

// Build direct comparisons (matches project.js makeDirectComparisons)
var buildDirectComparisons = (wide, projectType) => {
  let byPair = _.groupBy(wide, (row) => {
    return uniqId([row.t1, row.t2]).toString();
  });
  let comparisons = _.map(byPair, (rows, pairId) => {
    let comp = {
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
    // Rob/indirectness summary rules
    comp.majrob = majRule(comp.rob);
    comp.meanrob = meanRule(comp.rob);
    comp.maxrob = maxRule(comp.rob);
    comp.majindr = majRule(comp.indirectness);
    comp.meanindr = meanRule(comp.indirectness);
    comp.maxindr = maxRule(comp.indirectness);
    comp.directRob = 'nothing';
    return comp;
  });
  // Sort by PureScript canonical ordering
  try {
    let sortedIds = ComparisonModel.sortStringComparisonIds(_.pluck(comparisons, 'id'));
    comparisons = _.sortBy(comparisons, (c) => { return sortedIds.indexOf(c.id); });
  } catch (e) {
    // If PureScript sort fails, fall back to alphabetical
    comparisons = _.sortBy(comparisons, 'id');
  }
  return comparisons;
};

// Build indirect comparisons (all possible pairs NOT in directComparisons)
var buildIndirectComparisons = (nodes, directComparisons) => {
  let directIds = _.pluck(directComparisons, 'id');
  let treatments = _.pluck(nodes, 'id');
  let indirect = [];
  for (let i = 0; i < treatments.length; i++) {
    for (let j = i + 1; j < treatments.length; j++) {
      let pairId = uniqId([treatments[i], treatments[j]]).toString();
      if (!_.contains(directIds, pairId)) {
        indirect.push(pairId);
      }
    }
  }
  return indirect;
};

// Helper: majority rule (most frequent value; ties broken by highest)
var majRule = (arr) => {
  if (!arr || arr.length === 0) return -1;
  let counts = _.countBy(arr);
  let maxCount = 0;
  let result = -1;
  _.each(counts, (count, val) => {
    let numVal = parseInt(val);
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
  let sum = _.reduce(arr, (memo, v) => { return memo + v; }, 0);
  return Math.round(sum / arr.length);
};

// Helper: max rule
var maxRule = (arr) => {
  if (!arr || arr.length === 0) return -1;
  return _.max(arr);
};

// =====================================================
// Transform v2 Analysis → legacy currentCM.hatmatrix
// =====================================================
var analysisToHatmatrix = (analysis) => {
  let hatmatrix = {};

  // Hat matrix H
  if (analysis.hatMatrix) {
    hatmatrix.H = analysis.hatMatrix.H;
    hatmatrix.rowNames = analysis.hatMatrix.rowNames;
    hatmatrix.colNames = analysis.hatMatrix.colNames;
  } else {
    // If no hat matrix provided, use empty arrays
    hatmatrix.H = [];
    hatmatrix.rowNames = _.pluck(analysis.nmaResults, 'comparison');
    hatmatrix.colNames = [];
  }

  // Pairwise separator helper: legacy uses " : " (space-colon-space)
  let pairwiseSep = (compId) => { return compId.replace(':', ' : '); };

  // NMAresults: transform ComparisonResult[] → legacy format
  hatmatrix.NMAresults = _.map(analysis.nmaResults, (cr) => {
    let row = {
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
    // Direct estimate (only present for mixed/direct-only comparisons)
    if (cr.direct) {
      row['Direct'] = cr.direct.effect;
      row['DirectL'] = cr.direct.ciLower;
      row['DirectU'] = cr.direct.ciUpper;
    }
    // Indirect estimate (only present for mixed/indirect-only comparisons)
    if (cr.indirect) {
      row['Indirect'] = cr.indirect.effect;
      row['IndirectL'] = cr.indirect.ciLower;
      row['IndirectU'] = cr.indirect.ciUpper;
    }
    // SIDE (incoherence) test (only present for mixed comparisons)
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

  // Pairwise: transform PairwiseResult[] → legacy format
  if (analysis.pairwise) {
    hatmatrix.Pairwise = _.map(analysis.pairwise, (pr) => {
      return {
        '_row': pairwiseSep(pr.comparison),
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

  // NMAheterResults: wrap in single-element array (R serialization quirk)
  if (analysis.networkHeterogeneity) {
    let nh = analysis.networkHeterogeneity;
    hatmatrix.NMAheterResults = [{
      'heterVarNtw': nh.tau2,
      'Q overall': nh.Qoverall || 0,
      'Q heterogeneity': nh.Qheterogeneity || 0,
      'Q inconsistency': nh.Qinconsistency || 0,
    }];
  } else {
    hatmatrix.NMAheterResults = [{ 'heterVarNtw': 0, 'Q overall': 0, 'Q heterogeneity': 0, 'Q inconsistency': 0 }];
  }

  // dbt (design-by-treatment test): wrap in single-element array
  if (analysis.designByTreatment) {
    let dbt = analysis.designByTreatment;
    hatmatrix.dbt = [{
      'Q_dbt': dbt.Q,
      'df': dbt.df,
      'pv_dbt': dbt.pvalue,
    }];
  } else {
    hatmatrix.dbt = [{ 'Q_dbt': 0, 'df': 0, 'pv_dbt': 1 }];
  }
  hatmatrix.colNamesdbt = ['Q_dbt', 'df', 'pv_dbt'];

  // model and sm: wrap in single-element arrays (R serialization quirk)
  hatmatrix.model = [analysis.params.model];
  hatmatrix.sm = [analysis.params.sm];

  // tau: wrap in single-element array
  hatmatrix.tau = [analysis.params.tau || 0];

  // forleaguetable: not directly available from v2, set empty
  // (league table is pre-computed in v2 so this is not needed for domain logic)
  hatmatrix.forleaguetable = {};

  // forstudycontribution: not needed (study contributions are pre-computed in v2)
  hatmatrix.forstudycontribution = [];

  return hatmatrix;
};

// =====================================================
// Build savedComparisons and directStudies/indirectStudies
// from v2 studyContributions
// =====================================================
var buildSavedComparisons = (studyContributions, colNames) => {
  // studyContributions: { "ACE:ARB": { "AASK": 0.44, ... }, ... }
  // savedComparisons[].perstudy = studyContributions[compId]
  // savedComparisons[].comparisons = [] (per-comparison contributions not in v2)
  let savedComparisons = _.map(_.keys(studyContributions), (compId) => {
    return {
      rowname: compId,
      perstudy: studyContributions[compId],
      comparisons: new Array(colNames.length).fill(0), // placeholder
    };
  });
  return savedComparisons;
};

// =====================================================
// Split comparisons into direct/indirect based on NMAresults
// =====================================================
var splitComparisons = (savedComparisons, directComparisonIds) => {
  let directRows = _.filter(savedComparisons, (sc) => {
    let normalized = uniqId(sc.rowname.replace(':', ',').split(',')).toString();
    return _.contains(directComparisonIds, normalized);
  });
  let indirectRows = _.filter(savedComparisons, (sc) => {
    let normalized = uniqId(sc.rowname.replace(':', ',').split(',')).toString();
    return !_.contains(directComparisonIds, normalized);
  });
  // Sort using PureScript canonical ordering
  let sortRows = (rows) => {
    try {
      let fixednames = _.map(rows, (r) => { return ComparisonModel.fixComparisonId(r.rowname); });
      let sortedIds = ComparisonModel.sortStringComparisonIds(fixednames);
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
// Main transformation: v2 JSON → v1 State
// =====================================================
var v2ToLegacyState = (parsed, currentState) => {
  let v2project = parsed.project;
  let analysis = v2project.analyses[0]; // Use first analysis

  // Build project.studies structure
  let studies = buildStudiesFromV2(v2project.studies, v2project.type);
  let directComparisonIds = _.pluck(studies.directComparisons, 'id');

  // Build hatmatrix
  let hatmatrix = analysisToHatmatrix(analysis);

  // Build saved comparisons from studyContributions
  let colNames = hatmatrix.colNames;
  let savedComparisons = buildSavedComparisons(analysis.studyContributions, colNames);

  // Split into direct/indirect
  let split = splitComparisons(savedComparisons, directComparisonIds);

  // Build studycontributions map
  // v2 keys studyContributions by study NAME ("AASK"), but v1 code expects
  // study ID ("1") matching project.studies.robs keys. Re-key accordingly.
  // Also fill missing study entries with 0 (the chart renderer expects every
  // study to have an entry for every comparison, even if contribution is 0).
  let studyNameToId = {};
  _.each(v2project.studies, (arm) => {
    studyNameToId[arm.study] = String(arm.id);
  });
  let allStudyIdStrings = _.uniq(_.values(studyNameToId));
  let studycontributions = _.mapObject(analysis.studyContributions, (studyMap) => {
    let filled = {};
    // First, fill all study ids with 0
    _.each(allStudyIdStrings, (sid) => {
      filled[sid] = 0;
    });
    // Then fill with actual values, re-keying from name to id
    _.each(studyMap, (value, studyName) => {
      let studyId = studyNameToId[studyName];
      if (studyId) {
        filled[studyId] = value;
      }
    });
    return filled;
  });

  // Build currentCM
  let treatments = _.pluck(studies.nodes, 'id');
  let currentCM = {
    status: 'ready',
    params: {
      MAModel: analysis.params.model,
      sm: analysis.params.sm,
      intvs: treatments,
      rule: 'every',
    },
    hatmatrix: hatmatrix,
    leaguetable: analysis.leagueTable || [],
    leaguetableLM: (analysis.sensitivityLeagueTables && analysis.sensitivityLeagueTables.lowModerateRoB) || {},
    leaguetableL: (analysis.sensitivityLeagueTables && analysis.sensitivityLeagueTables.lowRoB) || {},
    savedComparisons: savedComparisons,
    selectedComparisons: hatmatrix.rowNames,
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
  let version = currentState ? currentState.version : '3.0.0';
  let text = currentState ? currentState.text : Locales['EN'];
  let defaults = currentState ? currentState.defaults : {};

  let timestamp = new Date();
  let title = 'v2_import_' + timestamp.getTime();

  let state = {
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
      id: 'v2_' + timestamp.getTime(),
      creationDate: timestamp.getTime(),
      accessDate: timestamp.getTime(),
      type: v2project.type,
      format: v2project.format,
      isRecognized: true,
      isSaved: true,
      studies: studies,
      robLevels: [
        { id: 1, label: 'Low', color: '#02c000' },
        { id: 2, label: 'Moderate', color: '#e0df02' },
        { id: 3, label: 'High', color: '#c00000' },
      ],
      studyLimitationLevels: [
        { id: 1, label: 'Low risk', color: '#02c000' },
        { id: 2, label: 'Some concerns', color: '#e0df02' },
        { id: 3, label: 'High risk', color: '#c00000' },
      ],
      CM: {
        contributionMatrices: [currentCM],
        currentCM: currentCM,
      },
    },
  };

  return state;
};

module.exports = {
  isV2Format: isV2Format,
  v2ToLegacyState: v2ToLegacyState,
  // Exported for testing
  buildStudiesFromV2: buildStudiesFromV2,
  analysisToHatmatrix: analysisToHatmatrix,
  buildSavedComparisons: buildSavedComparisons,
  splitComparisons: splitComparisons,
};
