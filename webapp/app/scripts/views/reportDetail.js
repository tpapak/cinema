'use strict';

// reportDetail.js — expanded per-comparison detail for the Report table.
//
// The report rows carry only each domain's judgement label + colour. The
// underlying numbers (rules applied, CIs, prediction intervals, SIDE
// inconsistency, direct contribution, …) live in the live domain state, keyed
// by comparison id. This module reads those boxes and renders a collapsible
// detail row holding one card per domain — the same payload each domain page
// shows for that comparison.

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var div = hh.div, span = hh.span, strong = hh.strong, small = hh.small;
var tr = hh.tr, td = hh.td;

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
    return vs.indexOf(bid) !== -1 ||
           vs.indexOf(bid.replace(/,/g, ':')) !== -1;
  }) || null;
};

var path = function(o, ks) { return ks.reduce(function(a, k) { return a && a[k]; }, o); };

// A single labelled line inside a card. Missing values render as an em dash.
var line = function(label, value) {
  var v = (value === undefined || value === null || value === '' ||
           String(value) === 'undefined') ? '—' : String(value);
  return div('.rdc-line', [strong(label + ' '), span(v)]);
};

// A domain card: coloured header + body lines.
var card = function(name, color, lines) {
  return div('.report-domain-card', [
    div('.rdc-head', { style: { background: color || '#eee' } }, [name]),
    div('.rdc-body', lines.length ? lines : [small('—')]),
  ]);
};

// ---- per-domain detail builders ----------------------------------------

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
  return card('Within-study bias', row.studyLimitation && row.studyLimitation.color, lines);
};

var reporting = function(project, row) {
  var box = findBox(path(project, ['pubbias', 'boxes']), row.id) || {};
  var evidence = box.isMixed ? 'mixed' : box.isDirect ? 'direct' : box.isIndirect ? 'indirect' : '—';
  var uploaded = path(project, ['pubbias', 'hasUploaded']);
  var lines = [
    line('Evidence:', evidence),
    line('Source:', (uploaded === 'true' || uploaded === true) ? 'ROB-MEN upload' : 'manual'),
  ];
  return card('Reporting bias', row.pubbias && row.pubbias.color, lines);
};

var indirectness = function(project, row) {
  var box = findBox(path(project, ['indirectness', 'directs', 'directBoxes']), row.id, 'niceid')
         || findBox(path(project, ['indirectness', 'directs', 'directBoxes']), row.id);
  var lines = [];
  if (box) {
    lines.push(line('Majority:', box.majindrName));
    lines.push(line('Average:', box.meanindrName));
    lines.push(line('Highest:', box.maxindrName));
  }
  return card('Indirectness', row.indirectness && row.indirectness.color, lines);
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
  var lines = [];
  if (box) {
    lines.push(line('NMA effect:', box.nmaEffect));
    lines.push(line('95% CI:', '(' + box.CIf + ', ' + box.CIs + ')'));
    var ct = crossesText(box); if (ct) lines.push(line('', ct));
    var z = clinZone(project); if (z) lines.push(line('Clinically important:', z));
  }
  return card('Imprecision', row.imprecision && row.imprecision.color, lines);
};

var heterogeneity = function(project, row) {
  var box = findBox(path(project, ['heterogeneity', 'heters', 'boxes']), row.id);
  var lines = [];
  if (box) {
    lines.push(line('NMA effect:', box.nmaEffect));
    lines.push(line('95% CI:', '(' + box.CIf + ', ' + box.CIs + ')'));
    lines.push(line('95% PrI:', '(' + box.PrIf + ', ' + box.PrIs + ')'));
    if (box.tauSquare !== undefined) lines.push(line('τ²:', box.tauSquare));
    if (box.ISquare !== undefined) lines.push(line('I²:', box.ISquare + '%'));
  }
  return card('Heterogeneity', row.heterogeneity && row.heterogeneity.color, lines);
};

var incoherence = function(project, row) {
  var box = findBox(path(project, ['incoherence', 'boxes']), row.id);
  var lines = [];
  if (box) {
    if (box.isMixed) {
      lines.push(line('Direct:', box.direct + ' (' + box.directL + ', ' + box.directU + ')'));
      lines.push(line('Indirect:', box.indirect + ' (' + box.indirectL + ', ' + box.indirectU + ')'));
      lines.push(line('SIDE IF:', box.sideIF + ' (' + box.sideIFLower + ', ' + box.sideIFUpper + ')'));
      lines.push(line('p-value:', box.pvalue));
      if (box.dcont !== undefined) lines.push(line('Direct contribution:', box.dcont + '%'));
    } else {
      var ev = box.isDirect ? 'direct only' : 'indirect only';
      lines.push(line('Evidence:', ev));
      lines.push(line('', 'Inconsistency factor not applicable; judged from the design-by-treatment test.'));
    }
  }
  return card('Incoherence', row.incoherence && row.incoherence.color, lines);
};

// The collapsible detail row inserted under a comparison row.
var detailRow = function(row, colspan) {
  var cards;
  try {
    var project = getProject();
    cards = [
      withinStudy(project, row),
      reporting(project, row),
      indirectness(project, row),
      imprecision(project, row),
      heterogeneity(project, row),
      incoherence(project, row),
    ];
  } catch (e) {
    if (window.console) console.warn('[reportDetail] failed to build detail for', row && row.id, e);
    cards = [div('.report-domain-card', [small('Details unavailable')])];
  }
  return tr('.report-detail-row', [
    td({ attributes: { colspan: String(colspan) } }, [
      div('#rdetail-' + cssId(row && row.id) + '.report-detail.collapse', [
        div('.report-domain-cards', cards),
      ]),
    ]),
  ]);
};

// data-target needs a CSS-safe id (no ':' or ',').
var cssId = function(id) { return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_'); };

module.exports = { detailRow: detailRow, cssId: cssId };
