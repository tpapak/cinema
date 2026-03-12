'use strict';

// imprecisionView.js — Imprecision view using hyperscript-helpers
//
// Replaces imprecision.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text, smtitle, clinImp, clinImpReady, clinImpLow, clinImpHigh,
//          emType, customized, customizedSingular, numberCustomized,
//          imprecisionReady, boxes }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, ul = hh.ul, li = hh.li, span = hh.span;
var select = hh.select, option = hh.option, button = hh.button;
var label = hh.label, strong = hh.strong, hr = hh.hr, em = hh.em;
var input = hh.input;

var renderBox = (box, text) => {
  var evidenceLabel = box.isMixed
    ? (text.mixedtitle || 'Mixed')
    : (text.indirecttitle || 'Indirect');

  var levelOptions = (box.levels || []).map(function(level) {
    return option({
      value: box.id + '\u03C3\u03B4el' + level.id,
      disabled: level.isDisabled,
      selected: level.isActive,
    }, level.label);
  });

  return li('.well.compRobSelector' + (box.customized ? '.customized' : ''), {
    style: { borderColor: box.color },
    id: 'comp-' + box.id,
  }, [
    ul([
      li([
        strong('Comparison'),
        span('.pull-right', [strong(box.id)]),
      ]),
      li([
        strong('Evidence: ' + evidenceLabel),
        hr(),
      ]),
      li([
        'NMA estimate: ',
        strong('.pull-right', String(box.nmaEffect || '')),
      ]),
      li([
        '95% Confidence interval: ',
        strong('.pull-right', '(' + (box.CIf || '') + ',' + (box.CIs || '') + ')'),
      ]),
      li([
        // crossestext may contain HTML — use innerHTML
        em({ innerHTML: box.crossestext || '' }),
      ]),
      hr(),
      li([
        (text.judgementField || 'Judgement'),
        select('.mr-sm-2.controls-container', {
          onchange: function() { Actions.Imprecision.selectIndividual(this); },
        }, levelOptions),
      ]),
    ]),
  ]);
};

var imprecisionView = (data) => {
  var text = data.text || {};
  var sections = [];

  // Clinical importance input
  sections.push(
    h('blockquote#refvals.col-xs-12', [
      h3([
        'Imprecision',
        span('#prinfo.info.pull-right.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('The rules for judging imprecision are based on whether the confidence interval includes the line of no effect and the clinically important values. If the confidence interval crosses the line of no effect and extends to values that favor the opposite intervention to that favored by the point estimate, "Major concerns" is assigned. If only the null effect is included in the confidence intervals (and potentially also the clinically important value that favors the same intervention as the point estimate), "Some concerns" is assigned. Finally, "No concerns" is assigned to confidence intervals that only include the clinically important value that favors the same intervention as the point estimate. If the confidence interval lies entirely between the two clinically important values, "No concerns" is assigned. Details can be found in Section 4.4 of the detailed manual.');
          },
        }),
      ]),
      ul('.col-xs-12.imprecisionList', [
        li([
          ul('.list-inline', [
            li([
              label('.controls-title.mr-sm-2',
                'Define clinically important size of effect: ' + (data.smtitle || '')),
            ]),
            li([
              input('#clinImpInput.mr-sm-2.form-inline.form-control', {
                name: 'clinImp',
                value: String(data.clinImp || ''),
                disabled: data.clinImpReady,
              }),
            ]),
            li([
              button('.btn.btn-default' + (data.clinImpReady ? '.disabled' : ''), {
                onclick: function() { Actions.Imprecision.setClinImp(); },
              }, 'Set'),
              button('.btn.btn-default' + (!data.clinImpReady ? '.disabled' : ''), {
                onclick: function() { Actions.Imprecision.resetClinImp(data.emType); },
              }, 'Reset'),
            ]),
            li([
              span('#prinfo.info.glyphicon.glyphicon-info-sign', {
                attributes: { 'aria-hidden': 'true' },
                onclick: function() {
                  Actions.alertify().message('The clinically important size of effect is the same as in "Heterogeneity" and "Incoherence"; if already specified it will automatically appear here. Otherwise, specify it here and it will be copied to the "Heterogeneity" and "Incoherence" domains. Press "Reset" to reset the clinically important effect size; note that this will affect the "Heterogeneity" and "Incoherence" domains too. Details can be found in Section 4.4 of the detailed manual.');
                },
              }),
            ]),
          ]),
        ]),
        li('.comments', [
          'Relative effect estimates below ',
          strong(String(data.clinImpLow || '')),
          ' and above ',
          strong(String(data.clinImpHigh || '')),
          ' are considered clinically important.',
        ]),
      ]),
    ])
  );

  // Boxes section (only when clinImpReady)
  if (data.clinImpReady) {
    var customLabel = [];
    if (data.customized) {
      var custText = data.numberCustomized + ' ' + (data.customizedSingular
        ? (text.customizedTitleSingular || '')
        : (text.customizedTitlePlural || ''));
      customLabel.push(label('.controls-title.mr-sm-2', custText));
    }

    var actionButtons = [];
    if (data.imprecisionReady) {
      actionButtons.push(
        button('.btn.btn-default', {
          onclick: function() { Actions.Imprecision.resetBoxes(); },
        }, text.resetButton || 'Reset')
      );
      actionButtons.push(
        button('.btn.btn-default.btn-pad', {
          onclick: function() { Actions.Imprecision.proceed(); },
        }, 'Proceed')
      );
    }

    var boxItems = (data.boxes || []).map(function(box) {
      return renderBox(box, text);
    });

    sections.push(
      div('.container-fluid', [
        h('blockquote#imprecisionBoxes.col-xs-12', [
          div('.form-inline', customLabel),
        ].concat(actionButtons)),
        div('#ImprecisionBoxes.col-xs-12.well.collapse.in', [
          ul('.list-inline', boxItems),
        ]),
      ])
    );
  }

  return sections;
};

module.exports = imprecisionView;
