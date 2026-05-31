'use strict';

// reportView.js — Report view using hyperscript-helpers
//
// Replaces TemplateReport.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { project, isReady, directRows, indirectRows, hasDirects, hasIndirects }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var reportDetail = require('./reportDetail');
var div = hh.div, h3 = hh.h3, h4 = hh.h4, span = hh.span;
var table = hh.table, thead = hh.thead, tbody = hh.tbody, tr = hh.tr, th = hh.th, td = hh.td;
var button = hh.button, select = hh.select, option = hh.option, input = hh.input;

var infoText = 'Judgments for the six domains across all evaluated treatment effects are reported. A thick grey left border line appears for judgments whose automatically generated judgments have been manually modified. The default summary judgment is "High" confidence; downgrading by one, two, or three levels will lead to a confidence rating of "Moderate," "Low," or "Very low" respectively. Use the "Confidence rating" dropdown menu to manually assign an overall level of confidence to each relative effect. For each comparison, tick the relevant domains to indicate the reasons for downgrade; these domains will automatically appear under the column \'Reason for downgrade\'. Details can be found in Section 5 of the detailed manual.';

// Render a domain cell (study limitation, pubbias, indirectness, imprecision,
// heterogeneity, incoherence). Each cell holds a coloured summary (label +
// optional reason checkbox) and, hidden until expanded, the domain detail.
// Clicking the cell expands it in place (the Expand-all button toggles them
// all via a class on the table).
// Map a judgement colour to a stable class so the colour can be re-asserted in
// print (Bootstrap's print reset forces `background: transparent !important`,
// which clobbers the inline colour).
var colourClass = function(c) {
  switch ((c || '').toLowerCase()) {
    case '#02c000': return '.jc-low';
    case '#e0df02': return '.jc-some';
    case '#c00000': return '.jc-high';
    default: return '';
  }
};

var domainCell = function(which, domain, reason, row) {
  var color = domain.color || '';
  var summaryChildren = [domain.label || ''];
  if (reason && reason.allowed) {
    summaryChildren.push(
      input({
        type: 'checkbox',
        name: 'interest',
        value: reason.rowId + '\u03C3\u03B4\u03B5l' + reason.id,
        checked: reason.selected,
        // Don't let ticking the reason toggle the cell's expansion.
        onclick: function(ev) {
          if (ev && ev.stopPropagation) ev.stopPropagation();
          Actions.Report.updateReportReason(this)();
        },
      })
    );
  }
  var selector = 'td.domain-cell' + (domain.customized ? '.customized-report' : '');
  return h(selector, {
    onclick: function() { this.classList.toggle('expanded'); },
  }, [
    div('.rdc-summary' + colourClass(color), { style: { backgroundColor: color } }, summaryChildren),
    div('.rdc-detail', reportDetail.domainLines(which, row)),
  ]);
};

// Render the confidence rating dropdown
var ratingCell = function(judgement, rowId) {
  var levelOptions = (judgement.levels || []).map(function(level) {
    var lv = level.id !== undefined ? level : level;
    // Unwrap ReportLevel newtype if needed
    var lvData = lv;
    return option({
      style: { background: lvData.color },
      value: lvData.id + '\u03C3\u03B4\u03B5l' + rowId,
      selected: lvData.selected,
    }, lvData.label || '');
  });
  // Unwrap selected level
  var selectedData = judgement.selected || {};
  return td([
    select({
      onchange: function() { Actions.Report.updateReportJudgement(this)(); },
      style: {
        border: 'solid ' + (selectedData.color || ''),
        borderRadius: '5px',
        background: 'white',
      },
    }, levelOptions),
  ]);
};

// Render the reasons-for-downgrade cell
var reasonsCell = function(reasons) {
  var parts = ['| '];
  (reasons || []).forEach(function(r) {
    var rData = r;
    if (rData.selected) {
      parts.push(rData.label + ' | ');
    }
  });
  return td(parts);
};

// Render a single report row
var reportRow = function(row, showStudyCount) {
  var r = row;
  var j = r.judgement || {};
  var jData = j;
  var reasons = jData.reasons || [];

  // Build reason objects with rowId attached
  var makeReason = function(index) {
    var reason = reasons[index];
    if (!reason) return null;
    var rData = reason;
    return {
      id: rData.id,
      allowed: rData.allowed,
      selected: rData.selected,
      rowId: r.id,
    };
  };

  return tr([
    th({ attributes: { scope: 'row' } }, [r.armA + ' vs ' + r.armB]),
    td(showStudyCount ? String(r.numberOfStudies) : '--'),
    domainCell('studyLimitation', r.studyLimitation || {}, makeReason(0), r),
    domainCell('pubbias', r.pubbias || {}, makeReason(1), r),
    domainCell('indirectness', r.indirectness || {}, makeReason(2), r),
    domainCell('imprecision', r.imprecision || {}, makeReason(3), r),
    domainCell('heterogeneity', r.heterogeneity || {}, makeReason(4), r),
    domainCell('incoherence', r.incoherence || {}, makeReason(5), r),
    ratingCell(jData, r.id),
    reasonsCell(reasons),
  ]);
};

var reportView = function(data) {
  if (!data || !data.isReady) {
    return div('.container-fluid.routed#report', [
      div('.col-xs-12', [
        h3('Report not ready'),
      ]),
    ]);
  }

  var projectTitle = '';
  if (data.project) {
    // Unwrap Project newtype if needed
    var pData = data.project;
    projectTitle = pData.title || '';
  }

  var bodyRows = [];

  // Mixed (direct) evidence rows
  if (data.hasDirects) {
    bodyRows.push(
      tr([td({ attributes: { colspan: '9' } }, [h4('Mixed evidence')])])
    );
    (data.directRows || []).forEach(function(row) {
      // Unwrap ReportRow newtype if needed
      var rowData = row;
      bodyRows.push(reportRow(rowData, true));
    });
  }

  // Indirect evidence rows
  if (data.hasIndirects) {
    bodyRows.push(
      tr([td({ attributes: { colspan: '9' } }, [h4('Indirect evidence')])])
    );
    (data.indirectRows || []).forEach(function(row) {
      var rowData = row;
      bodyRows.push(reportRow(rowData, false));
    });
  }

  return div('.container-fluid.routed#report', [
    div('.col-xs-12', [
      h3([
        projectTitle,
        span('.pull-right.info.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() { Actions.alertify().message(infoText); },
        }),
      ]),
      button('.pull-right.btn.btn-default.btn-pad', {
        onclick: function() { Actions.Report.resetAll(); },
      }, 'Reset'),
      button('.pull-right.btn.btn-default.btn-pad', {
        onclick: function() { Actions.Report.download(); },
      }, 'Download Report'),
      button('.pull-right.btn.btn-default.btn-pad', {
        // Print to PDF: reveal every domain detail, then open the browser
        // print dialog (Save as PDF on desktop, Share → PDF on iOS). Print CSS
        // also forces details visible, so the PDF is the full expanded report.
        onclick: function() {
          var $t = window.$ && window.$('.report-table');
          if ($t) $t.addClass('all-expanded');
          if (window.print) window.print();
        },
      }, 'Export PDF'),
      button('.pull-right.btn.btn-default.btn-pad', {
        onclick: function() {
          var $ = window.$;
          if (!$) return;
          var $t = $('.report-table');
          // Collapse if anything is open (table-level OR individual cells),
          // otherwise expand everything.
          var anyOpen = $t.hasClass('all-expanded') ||
                        $('td.domain-cell.expanded').length > 0;
          if (anyOpen) {
            $t.removeClass('all-expanded');
            $('td.domain-cell.expanded').removeClass('expanded');
          } else {
            $t.addClass('all-expanded');
          }
        },
      }, 'Expand / collapse all'),
      table('.table.report-table', [
        thead('.thead-inverse', [
          tr([
            th('Comparison'),
            th('Number of Studies'),
            th('Within-study bias'),
            th('Reporting bias'),
            th('Indirectness'),
            th('Imprecision'),
            th('Heterogeneity'),
            th('Incoherence'),
            th('Confidence rating'),
            th('Reason(s) for downgrading'),
          ]),
        ]),
        tbody(bodyRows),
      ]),
      h('br'),
      h('br'),
    ]),
  ]);
};

module.exports = reportView;
