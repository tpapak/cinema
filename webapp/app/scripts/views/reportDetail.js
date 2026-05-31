'use strict';

// reportDetail.js — per-domain detail lines for the Report table.
//
// The report cells show only each domain's judgement label + colour. The
// underlying numbers (rules applied, CIs, prediction intervals, SIDE
// inconsistency, direct contribution, …) live in the live domain state, keyed
// by comparison id. This module reads those boxes and returns the detail lines
// for one domain, which the report cell reveals in place when expanded.

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var div = hh.div, span = hh.span, strong = hh.strong, small = hh.small;

// Read the live state lazily (avoids a load-time circular require with model.js).
var getProject = function() {
  try {
    var M = require('../model').Model;
    if (M && M.getState) return M.getState().project || {};
  } catch (e) { /* fall through to global */ }
  return (window.Model && window.Model.getState().project) || {};
};

// Match a box by comparison id, tolerating ':' vs ',' separators.
var variants = function(id) {
  var s = String(id || '');
  return [s, s.replace(/,/g, ':'), s.replace(/:/g, ',')];
};
var findBox = function(boxes, id, key) {
  if (!boxes || !boxes.length) return null;
  key = key || 'id';
  var vs = variants(id);
  return boxes.find(function(b) {
    var bid = String(b[key] || '');
    return vs.indexOf(bid) !== -1 || vs.indexOf(bid.replace(/,/g, ':')) !== -1;
  }) || null;
};

var path = function(o, ks) { return ks.reduce(function(a, k) { return a && a[k]; }, o); };

// A single labelled line. Missing values render as an em dash.
var line = function(label, value) {
  var v = (value === undefined || value === null || value === '' ||
           String(value) === 'undefined') ? '—' : String(value);
  return div('.rdc-line', [strong(label + ' '), span(v)]);
};

// ---- per-domain detail builders (return an array of lines) --------------

var withinStudy = function(project, row) {
  var lines = [];
  var rules = (row.studyLimitation && row.studyLimitation.rules) || [];
  if (!rules.length) {
    var box = findBox(path(project, ['netRob', 'studyLimitations', 'boxes']), row.id);
    rules = (box && box.rules) || [];
  }
  rules.forEach(function(rl) {
    lines.push(line(rl.name + ':', rl.label + (rl.isActive ? ' (applied)' : '')));
  });
  return lines;
};

var reporting = function(project, row) {
  var box = findBox(path(project, ['pubbias', 'boxes']), row.id) || {};
  var evidence = box.isMixed ? 'mixed' : box.isDirect ? 'direct' : box.isIndirect ? 'indirect' : '—';
  var uploaded = path(project, ['pubbias', 'hasUploaded']);
  return [
    line('Evidence:', evidence),
    line('Source:', (uploaded === 'true' || uploaded === true) ? 'ROB-MEN upload' : 'manual'),
  ];
};

var indirectness = function(project, row) {
  var box = findBox(path(project, ['indirectness', 'directs', 'directBoxes']), row.id, 'niceid')
         || findBox(path(project, ['indirectness', 'directs', 'directBoxes']), row.id);
  if (!box) return [];
  return [
    line('Majority:', box.majindrName),
    line('Average:', box.meanindrName),
    line('Highest:', box.maxindrName),
  ];
};

var clinZone = function(project) {
  var ci = project.clinImp || {};
  if (ci.status !== 'ready') return null;
  return '(' + ci.lowerBound + ', ' + ci.upperBound + ')';
};

var crossesText = function(box) {
  if (box.crossestext) return box.crossestext;
  var c = box.crosses;
  if (Array.isArray(c)) return 'CI crosses ' + c[0] + ', PrI crosses ' + c[1];
  if (c !== undefined) return 'crosses ' + c + ' clinically important line(s)';
  return null;
};

var imprecision = function(project, row) {
  var box = findBox(path(project, ['imprecision', 'boxes']), row.id);
  if (!box) return [];
  var lines = [
    line('NMA effect:', box.nmaEffect),
    line('95% CI:', '(' + box.CIf + ', ' + box.CIs + ')'),
  ];
  var ct = crossesText(box); if (ct) lines.push(line('', ct));
  var z = clinZone(project); if (z) lines.push(line('Clinically important:', z));
  return lines;
};

var heterogeneity = function(project, row) {
  var box = findBox(path(project, ['heterogeneity', 'heters', 'boxes']), row.id);
  if (!box) return [];
  var lines = [
    line('NMA effect:', box.nmaEffect),
    line('95% CI:', '(' + box.CIf + ', ' + box.CIs + ')'),
    line('95% PrI:', '(' + box.PrIf + ', ' + box.PrIs + ')'),
  ];
  if (box.tauSquare !== undefined) lines.push(line('τ²:', box.tauSquare));
  if (box.ISquare !== undefined) lines.push(line('I²:', box.ISquare + '%'));
  return lines;
};

var incoherence = function(project, row) {
  var box = findBox(path(project, ['incoherence', 'boxes']), row.id);
  if (!box) return [];
  if (box.isMixed) {
    var lines = [
      line('Direct:', box.direct + ' (' + box.directL + ', ' + box.directU + ')'),
      line('Indirect:', box.indirect + ' (' + box.indirectL + ', ' + box.indirectU + ')'),
      line('SIDE IF:', box.sideIF + ' (' + box.sideIFLower + ', ' + box.sideIFUpper + ')'),
      line('p-value:', box.pvalue),
    ];
    if (box.dcont !== undefined) lines.push(line('Direct contribution:', box.dcont + '%'));
    return lines;
  }
  var ev = box.isDirect ? 'direct only' : 'indirect only';
  return [
    line('Evidence:', ev),
    line('', 'IF not applicable; judged from the design-by-treatment test.'),
  ];
};

var BUILDERS = {
  studyLimitation: withinStudy,
  pubbias: reporting,
  indirectness: indirectness,
  imprecision: imprecision,
  heterogeneity: heterogeneity,
  incoherence: incoherence,
};

// Detail lines for one domain of one comparison row. Defensive: any failure
// degrades to a placeholder rather than throwing (the report render path
// swallows exceptions and would otherwise blank the whole table).
var domainLines = function(which, row) {
  try {
    var build = BUILDERS[which];
    if (!build) return [];
    return build(getProject(), row);
  } catch (e) {
    if (window.console) console.warn('[reportDetail] failed for', which, row && row.id, e);
    return [small('Details unavailable')];
  }
};

module.exports = { domainLines: domainLines };
