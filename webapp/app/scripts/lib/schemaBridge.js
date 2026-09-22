'use strict';

// schemaBridge.js — Detects and transforms an externally-produced export
// (currently: MetaInsight's actual CINeMA-export JSON) into a CINeMA v3
// exchange envelope, while staying safe against CINeMA's own native/legacy
// save shape (see the `parsed.version` guard in isMetaInsightFormat below).
//
// This is a *different* shape from what the old (unused) v2bridge.js expected.
// MetaInsight's real export (R/export_cinema_f.R in CRSU-Apps/MetaInsight) has:
//   {
//     project: {
//       CM: { contributionMatrices: [ { hatmatrix: {...}, studycontributions: {...} } ] },
//       format: "long", type: "binary" | "continuous",
//       studies: { long: [ {study, id, t, n, rob, indirectness, r | mean+sd}, ... ] }
//     }
//   }
// `hatmatrix.NMAresults[]` uses space-separated legacy column names
// ("NMA treatment effect", "lower CI", ...) — this module translates those
// into the v3 schema's camelCase comparisonResult shape.
//
// contributionMatrices is a one-element array in current production output,
// but some historical exports carry it as a bare object — both are accepted.

var isMetaInsightFormat = (parsed) => {
  return !!(
    parsed && parsed.project &&
    // CINeMA's own saves (any version) always carry a top-level `version`
    // field; MetaInsight's export never does. Without this guard, a real
    // CINeMA project save that has reached the analysis stage structurally
    // matches the checks below too (it shares the same CM/studies.long
    // shape) and would be wrongly routed through this bridge, discarding
    // its saved evaluation state.
    typeof parsed.version === 'undefined' &&
    parsed.project.CM && parsed.project.CM.contributionMatrices &&
    parsed.project.studies && Array.isArray(parsed.project.studies.long) &&
    typeof parsed.project.format === 'string' &&
    typeof parsed.project.type === 'string'
  );
};

var getContributionMatrix = (cm) => {
  return Array.isArray(cm) ? cm[0] : cm;
};

var buildDataset = (parsed) => {
  var project = parsed.project;
  var studies = project.studies.long.map((arm) => {
    var row = {
      study: typeof arm.study !== 'undefined' ? String(arm.study) : String(arm.id),
      id: arm.id,
      treatment: arm.t,
      n: arm.n,
      rob: arm.rob,
      indirectness: arm.indirectness,
    };
    if (project.type === 'binary') {
      row.events = arm.r || 0;
    } else if (project.type === 'continuous') {
      row.mean = arm.y || arm.mean || 0;
      row.sd = arm.sd || 0;
    }
    return row;
  });
  return {
    format: project.format || 'long',
    type: project.type || 'binary',
    studies: studies,
  };
};

// One MetaInsight NMAresults[] row (space-keyed legacy columns) -> a v3
// comparisonResult. Direct/indirect/incoherence sub-objects are only present
// when MetaInsight included them (it drops NA fields before export).
var buildNmaResult = (row) => {
  var result = {
    comparison: row._row,
    effect: row['NMA treatment effect'],
    se: row['se treat effect'],
    ciLower: row['lower CI'],
    ciUpper: row['upper CI'],
    priLower: row['lower PrI'],
    priUpper: row['upper PrI'],
    propDirect: row.PropDir,
  };
  if (typeof row.Direct !== 'undefined') {
    result.direct = { effect: row.Direct, ciLower: row.DirectL, ciUpper: row.DirectU };
  }
  if (typeof row.Indirect !== 'undefined') {
    result.indirect = { effect: row.Indirect, ciLower: row.IndirectL, ciUpper: row.IndirectU };
  }
  if (typeof row.SideIF !== 'undefined') {
    result.incoherence = {
      effect: row.SideIF,
      ciLower: row.SideIFlower,
      ciUpper: row.SideIFupper,
      z: row.SideZ,
      pvalue: row.SidePvalue,
    };
  }
  return result;
};

var buildAnalysis = (parsed) => {
  var cm = getContributionMatrix(parsed.project.CM.contributionMatrices);
  var hm = cm.hatmatrix || {};
  var nmaResults = (hm.NMAresults || []).map(buildNmaResult);
  return {
    params: {
      model: hm.model || 'random',
      sm: hm.sm,
      // MetaInsight's schema has no separate Bayesian block — when a Bayesian
      // fit was used, its numbers are written into these same frequentist-
      // shaped columns, so there is no way to tell from the file alone.
      framework: 'frequentist',
    },
    contributionMatrix: {
      hatMatrix: {
        H: hm.H || [],
        rowNames: hm.rowNames || [],
        colNames: hm.colNames || [],
      },
      studyContributions: cm.studycontributions || {},
    },
    frequentist: { nmaResults: nmaResults },
    bayesian: null,
  };
};

var metaInsightToV3 = (parsed) => {
  var ts = new Date().toISOString();
  return {
    cinema: {
      version: '3.0.0',
      title: 'Imported from MetaInsight',
      createdAt: ts,
      updatedAt: ts,
      projects: [{
        id: 'metainsight_' + Date.now(),
        title: 'Imported from MetaInsight',
        outcome: '',
        createdAt: ts,
        updatedAt: ts,
        hasEvaluation: false,
        dataset: buildDataset(parsed),
        analysis: buildAnalysis(parsed),
        evaluation: null,
      }],
    },
  };
};

module.exports = {
  isMetaInsightFormat: isMetaInsightFormat,
  metaInsightToV3: metaInsightToV3,
};
