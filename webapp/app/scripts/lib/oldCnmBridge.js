'use strict';

// oldCnmBridge.js — Converts old CINeMA .cnm files (v1.x / v2.x state dumps
// from cinema.ispm.unibe.ch) into v3 exchange format.
//
// Old .cnm files are raw serializations of the internal Model.state:
//   { version: "2.0.0", text, defaults, timestamp, router, wt, project: {...} }
//
// We reuse v3bridge.legacyStateToV3() since the old state shape IS the legacy
// internal state that function was designed to export.

var V3Bridge = require('./v3bridge.js');

// =====================================================
// Detection: is this an old CINeMA state dump?
// =====================================================
var isOldCnmFormat = (parsed) => {
  return (
    parsed &&
    typeof parsed.version === 'string' &&
    (parsed.version.startsWith('1.') || parsed.version.startsWith('2.')) &&
    parsed.project &&
    parsed.project.hasFile === true &&
    parsed.project.studies &&
    typeof parsed.project.type === 'string'
  );
};

// =====================================================
// Convert old CINeMA state dump → v3 .cnm format
// =====================================================
var oldCnmToV3 = (parsed) => {
  // The old .cnm IS a legacy state object — legacyStateToV3 knows how to
  // extract dataset, analysis, and evaluation from it.
  var v3 = V3Bridge.legacyStateToV3(parsed);

  if (!v3) {
    // legacyStateToV3 returns null if project is missing required fields.
    // Fall back to a minimal v3 envelope with just the dataset.
    console.warn('oldCnmBridge: legacyStateToV3 returned null, building minimal v3');
    var project = parsed.project;
    v3 = {
      cinema: {
        version: '3.0.0',
        title: project.title || project.filename || 'Imported from old CINeMA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        projects: [{
          id: project.id || ('old_cnm_' + Date.now()),
          title: project.title || project.filename || 'Untitled',
          outcome: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          hasEvaluation: false,
          dataset: {
            format: project.format || 'long',
            type: project.type || 'binary',
            studies: project.studies && project.studies.long ? project.studies.long.map(function(arm) {
              var row = {
                study: arm.study || String(arm.id),
                id: arm.id,
                treatment: arm.t,
                n: arm.n,
                rob: arm.rob,
                indirectness: arm.indirectness,
              };
              if (project.type === 'binary') {
                row.events = arm.r || 0;
              } else if (project.type === 'continuous') {
                row.mean = arm.y || 0;
                row.sd = arm.sd || 0;
              }
              return row;
            }) : [],
          },
        }],
      },
    };
  }

  return v3;
};

module.exports = {
  isOldCnmFormat: isOldCnmFormat,
  oldCnmToV3: oldCnmToV3,
};
