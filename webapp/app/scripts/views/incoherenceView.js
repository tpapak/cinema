'use strict';

// incoherenceView.js — Incoherence view using hyperscript-helpers
//
// Replaces incoherence.hbs Handlebars template.
// Pure function: (data) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, h4 = hh.h4, ul = hh.ul, li = hh.li, span = hh.span;
var select = hh.select, option = hh.option, button = hh.button;
var label = hh.label, strong = hh.strong, hr = hh.hr, em = hh.em;
var input = hh.input;

var renderBox = (box, text) => {
  var evidenceLabel = '';
  if (box.isMixed) evidenceLabel = text.mixedtitle || 'Mixed';
  if (box.isDirect) evidenceLabel = text.directtitle || 'Direct';
  if (box.isIndirect) evidenceLabel = text.indirecttitle || 'Indirect';

  var measureSuffix = text.measureSuffix || '';

  var bodyItems = [
    li({ style: { clear: 'both' } }, [
      strong('Comparison'),
      span('.pull-right', [strong(box.id)]),
    ]),
    li({ style: { clear: 'both' } }, [
      strong('Evidence: ' + evidenceLabel),
      hr(),
    ]),
  ];

  // Mixed evidence — show NMA, direct, indirect, and SIDE
  if (box.isMixed) {
    bodyItems.push(
      li({ style: { clear: 'both' } }, [
        (text.nma || 'NMA') + ' ' + measureSuffix + ': ',
        strong('.pull-right', box.nma + '(' + box.nmaL + ',' + box.nmaU + ')'),
      ]),
      li({ style: { clear: 'both' } }, [
        (text.direct || 'Direct') + ' ' + measureSuffix + ': ',
        strong('.pull-right', box.direct + '(' + box.directL + ',' + box.directU + ')'),
      ]),
      li({ style: { clear: 'both' } }, [
        (text.indirect || 'Indirect') + ' ' + measureSuffix + ': ',
        strong('.pull-right', box.indirect + '(' + box.indirectL + ',' + box.indirectU + ')'),
      ]),
      hr(),
      li([
        ul([
          li([strong(text.IFLabel || 'Inconsistency factor')]),
          li([
            (text.boxSideTitle || 'SIDE') + ': ',
            strong('.pull-right',
              box.sideIF + '(' + box.sideIFLower + ',' + box.sideIFUpper + ')'),
          ]),
          li({ style: { clear: 'both' } }, [
            (text.pvalueLabel || 'p-value') + ': ',
            strong('.pull-right', String(box.pvalue || '')),
          ]),
        ]),
        hr(),
      ])
    );
  }

  // Direct-only evidence
  if (box.isDirect) {
    bodyItems.push(
      li([
        ul([
          li({ style: { clear: 'both' } }, [
            (text.direct || 'Direct') + ' ' + measureSuffix + ': ',
            strong('.pull-right', box.direct + '(' + box.directL + ',' + box.directU + ')'),
          ]),
          li([
            strong((text.IFLabel || 'Inconsistency factor') + ': '),
            'Not applicable',
            hr(),
          ]),
        ]),
      ])
    );
  }

  // Indirect-only evidence
  if (box.isIndirect) {
    bodyItems.push(
      li([
        ul([
          li({ style: { clear: 'both' } }, [
            (text.indirect || 'Indirect') + ' ' + measureSuffix + ': ',
            strong('.pull-right', box.indirect + '(' + box.indirectL + ',' + box.indirectU + ')'),
          ]),
          li([
            strong((text.IFLabel || 'Inconsistency factor') + ': '),
            'Not applicable',
            hr(),
          ]),
        ]),
      ])
    );
  }

  // Judgement selector
  var levelOptions = (box.levels || []).map(function(level) {
    return option({
      value: box.id + '\u03C3\u03B4el' + level.id,
      disabled: level.isDisabled,
      selected: level.isActive,
    }, level.label);
  });

  bodyItems.push(
    li([
      (text.judgementField || 'Judgement'),
      select('.mr-sm-2.pull-right.controls-container', {
        onchange: function() { Actions.Incoherence.selectIndividual(this); },
      }, levelOptions),
    ])
  );

  return li('.well.compRobSelector.incoherencebox' + (box.customized ? '.customized' : ''), {
    style: { borderColor: box.color },
    id: 'comp-' + box.id,
  }, [ul(bodyItems)]);
};

var incoherenceView = (data) => {
  var text = data.text || {};
  // Propagate measureSuffix into text for convenience in renderBox
  text.measureSuffix = data.measureSuffix || '';
  text.boxSideTitle = data.boxSideTitle || '';
  var sections = [];

  // Clinical importance input
  sections.push(
    h('blockquote#refvals.col-xs-12', [
      h3([
        'Incoherence',
        span('.info.pull-right.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('The rules for judging incoherence are based on the agreement of conclusions of direct and indirect estimates with the range of clinically important effects, the design by treatment interaction test and the Separating Indirect and Direct Evidence (SIDE) approach. Details can be found in Section 4.6 of the detailed manual.');
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
                onclick: function() { Actions.Incoherence.setClinImp(); },
              }, 'Set'),
              button('.btn.btn-default' + (!data.clinImpReady ? '.disabled' : ''), {
                onclick: function() { Actions.Incoherence.resetClinImp(data.emType); },
              }, 'Reset'),
            ]),
            li([
              span('.info.glyphicon.glyphicon-info-sign', {
                attributes: { 'aria-hidden': 'true' },
                onclick: function() {
                  Actions.alertify().message('The clinically important size of effect is the same as in "Imprecision" and "Heterogeneity"; if already specified it will automatically appear here. Otherwise, specify it here and it will be copied to the "Imprecision" and "Heterogeneity" domains. Press "Reset" to reset the clinically important effect size; note that this will affect the "Imprecision" and "Heterogeneity" domains too. Details can be found in Section 4.6 of the detailed manual.');
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
        li([
          span('.comments',
            'Importance of Incoherence depends on the variability of direct and indirect effects in relation to a clinically important size of effect'),
        ]),
      ]),
    ])
  );

  // Conditional sections when clinImpReady
  if (data.clinImpReady) {
    // Global test
    sections.push(
      h('blockquote#refvals.col-xs-12', [
        h4('Global test based on a random-effects design-by-treatment interaction model'),
        strong([
          ul('.list-inline.font-weight-bold', [
            li('.font-weight-bold', [
              (text.QstatisticLabel || 'Q-statistic') + ': ' + (data.rfvsq || ''),
            ]),
            li('.font-weight-bold', [
              '(' + (data.rfvsdf || '') + ' ' + (text.df || 'df') + '),',
            ]),
            li('.font-weight-bold', [
              (text.pvalueLabel || 'p-value') + ': ' + (data.rfvsp || ''),
            ]),
          ]),
        ]),
      ])
    );

    // Boxes
    var customLabel = [];
    if (data.customized) {
      var custText = data.numberCustomized + ' ' + (data.customizedSingular
        ? (text.customizedTitleSingular || '')
        : (text.customizedTitlePlural || ''));
      customLabel.push(label('.controls-title', custText));
    }

    var boxItems = (data.boxes || []).map(function(box) {
      return renderBox(box, text);
    });

    sections.push(
      div('#IncoherenceBoxes.col-xs-12.well.collapse.in', [
        h('blockquote', [
          h4((text.boxesTitle || '') + ': ' + (text.boxesSubTitle || '')),
        ].concat(customLabel, [
          button('.btn.btn-default', {
            onclick: function() { Actions.Incoherence.resetIncoherence(); },
          }, text.resetButton || 'Reset'),
          button('.btn.btn-default.btn-pad', {
            onclick: function() { Actions.Incoherence.proceed(); },
          }, 'Proceed'),
        ])),
        ul('.list-inline', boxItems),
      ])
    );
  }

  return div('.container-fluid', sections);
};

module.exports = incoherenceView;
