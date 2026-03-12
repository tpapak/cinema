'use strict';

// heterogeneityView.js — Heterogeneity view using hyperscript-helpers
//
// Replaces heterogeneity.hbs Handlebars template.
// Pure function: (data) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, h4 = hh.h4, h5 = hh.h5;
var ul = hh.ul, li = hh.li, span = hh.span, br = hh.br;
var select = hh.select, option = hh.option, button = hh.button, a = hh.a;
var label = hh.label, strong = hh.strong, hr = hh.hr, em = hh.em;
var input = hh.input, sup = hh.sup;

var renderBox = (box, text, rfvReady) => {
  var evidenceLabel = box.isMixed
    ? (text.mixedtitle || 'Mixed')
    : (text.indirecttitle || 'Indirect');

  var bodyItems = [
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
  ];

  // Reference values section (only when rfvReady)
  if (rfvReady) {
    if (box.tauSquare) {
      bodyItems.push(
        li('.align-right', [
          strong('Between-study heterogeneity for each direct comparison'),
        ]),
        li([
          'I', sup('2'), ': ',
          strong('.pull-right', String(box.ISquare || '')),
        ]),
        li([
          'Estimated \u03C4', sup('2'), ': ',
          strong('.pull-right', String(box.tauSquare || '')),
          hr(),
        ])
      );
    }
    bodyItems.push(
      li('.align-right', [
        strong(['Reference Values for \u03C4', sup('2')]),
      ])
    );
    (box.quantiles || []).forEach(function(q) {
      var cls = q.isActive ? '' : '.robLabel';
      bodyItems.push(
        li(cls, [
          h('span', { innerHTML: q.label || '' }), ':',
          strong('.pull-right', String(q.value || '')),
        ])
      );
    });
  }

  // Confidence/Prediction intervals
  bodyItems.push(
    li([
      rfvReady ? hr() : span(),
      strong('95% intervals for NMA estimate'),
    ]),
    li([
      'Confidence interval: ',
      strong('.pull-right', '(' + (box.CIf || '') + ',' + (box.CIs || '') + ')'),
    ]),
    li([
      'Prediction interval: ',
      strong('.pull-right', '(' + (box.PrIf || '') + ',' + (box.PrIs || '') + ')'),
      hr(),
    ]),
    li([
      em({ innerHTML: box.crossestext || '' }),
    ]),
    hr()
  );

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
      select('.mr-sm-2.controls-container', {
        onchange: function() { Actions.Heterogeneity.selectIndividual(this); },
      }, levelOptions),
    ])
  );

  return li('.well.compRobSelector' + (box.customized ? '.customized' : ''), {
    style: { borderColor: box.color },
    id: 'comp-' + box.id,
  }, [ul(bodyItems)]);
};

var heterogeneityView = (data) => {
  var text = data.text || {};
  var treatments = data.treatments || [];
  var rfvParams = data.rfvParams || [];
  var sections = [];

  // Clinical importance input + RFV selector blockquote
  sections.push(
    h('blockquote#refvals.col-xs-12', [
      h3([
        'Heterogeneity',
        span('.info.pull-right.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('The rules for judging heterogeneity are based on the agreement of conclusions based on confidence and prediction intervals in relation to the null effect and the clinically important effect on the opposite direction to the point estimate. Details can be found in Section 4.5 of the detailed manual.');
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
                onclick: function() { Actions.Heterogeneity.setClinImp(); },
              }, 'Set'),
              button('.btn.btn-default' + (!data.clinImpReady ? '.disabled' : ''), {
                onclick: function() { Actions.Heterogeneity.resetClinImp(data.emType); },
              }, 'Reset'),
              span('.info.glyphicon.glyphicon-info-sign', {
                attributes: { 'aria-hidden': 'true' },
                onclick: function() {
                  Actions.alertify().message('The clinically important size of effect is the same as in "Imprecision" and "Incoherence"; if already specified it will automatically appear here. Otherwise, specify it here and it will be copied to the "Imprecision" and "Incoherence" domains. Press "Reset" to reset the clinically important effect size; note that this will affect the "Imprecision" and "Incoherence" domains too. Details can be found in Section 4.5 of the detailed manual.');
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
            'Importance of heterogeneity depends on the variability of effects in relation to a clinically important size of effect'),
        ]),
      ]),
      // Collapsible RFV selector
      button('#referenceValuesTitle.btn.btn-default', {
        attributes: { 'data-toggle': 'collapse', 'data-target': '#rfvSelector' },
      }, 'Between-study variance estimates for each direct comparison along with reference intervals'),
      div('#rfvSelector.form-inline.col-xs-12.collapse', [
        label([
          'Select type of intervention and outcome ',
          span('.comments', 'optional'),
        ]),
        ul('.list-inline', (function() {
          var items = [];
          // Quick-set buttons (only when not rfvReady)
          if (!data.rfvReady) {
            items.push(
              li([button('.pull-right.btn.btn-default', {
                onclick: function() { Actions.Heterogeneity.selectAllInterventionTypes('Pharmacological'); },
              }, 'All Pharmacological')]),
              li([button('.pull-right.btn.btn-default', {
                onclick: function() { Actions.Heterogeneity.selectAllInterventionTypes('Non-pharmacological'); },
              }, 'All Non-pharmacological')]),
              li([button('.pull-right.btn.btn-default', {
                onclick: function() { Actions.Heterogeneity.deselectIntTypes(); },
              }, 'Deselect all')])
            );
          }
          // Treatment intervention type selectors
          items.push(
            ul('.list-inline', treatments.map(function(t) {
              var intTypeOptions = (t.interventionType || []).map(function(it) {
                return option({
                  value: (t.label || '') + '\u03C3\u03B4el' + it.id,
                  disabled: it.isDisabled,
                  selected: it.isActive,
                }, it.label || '');
              });
              return li('.well.compRobSelector' + (t.customized ? '.customized' : ''), {
                id: 'comp-' + ((t.id && t.id.value0) || ''),
              }, [
                ul('.list-inline', [
                  li({ innerHTML: (t.label || '') + ':' }),
                  li([
                    select('.mr-sm-2.form-inline.form-control', {
                      onchange: function() { Actions.Heterogeneity.selectIntervensionType(this); },
                      disabled: data.rfvReady,
                    }, intTypeOptions),
                  ]),
                ]),
              ]);
            }))
          );
          // RFV parameter selectors
          rfvParams.forEach(function(param) {
            // param.isAvailable may be a function (lazy getter) or a boolean
            var isAvail = typeof param.isAvailable === 'function' ? param.isAvailable() : param.isAvailable;
            if (isAvail) {
              // param.selections may be a function (lazy getter) or an array
              var sels = typeof param.selections === 'function' ? param.selections() : (param.selections || []);
              var paramOptions = (sels || [])
                .filter(function(s) {
                  return typeof s.isAvailable === 'function' ? s.isAvailable() : s.isAvailable;
                })
                .map(function(s) {
                  var isActive = typeof s.isActive === 'function' ? s.isActive() : s.isActive;
                  return option({
                    value: s.id,
                    disabled: s.isDisabled,
                    selected: isActive,
                  }, s.label);
                });
              items.push(
                li([
                  label('.controls-title.mr-sm-2', param.label || ''),
                  select('.mr-sm-2.form-inline.form-control', {
                    attributes: { 'data-id': param.id },
                    onchange: function() { Actions.Heterogeneity.selectRFVparam(this); },
                    disabled: data.rfvReady,
                  }, paramOptions),
                ])
              );
            }
          });
          return items;
        })()),
        div('.buttoner.col-xs-12', [
          br(),
          data.clinImpReady
            ? button('.btn.btn-default' + (!data.canFetch ? '.disabled' : ''), {
                onclick: function() { Actions.Heterogeneity.fetchRFV(); },
              }, 'View')
            : span(),
          button('.btn.btn-default' + (!data.rfvReady ? '.disabled' : ''), {
            onclick: function() { Actions.Heterogeneity.resetRFV(); },
          }, 'Reset'),
        ]),
      ]),
    ])
  );

  // Boxes section (when clinImpReady)
  if (data.clinImpReady) {
    var customLabel = [];
    if (data.customized) {
      customLabel.push(br());
      var custText = data.numberCustomized + ' ' + (data.customizedSingular
        ? (text.customizedTitleSingular || '')
        : (text.customizedTitlePlural || ''));
      customLabel.push(label('.controls-title.mr-sm-2', custText));
    }

    var actionButtons = [];
    if (data.heterReady) {
      actionButtons.push(
        button('.btn.btn-default', {
          onclick: function() { Actions.Heterogeneity.resetHeters(); },
        }, text.resetButton || 'Reset')
      );
      actionButtons.push(
        button('.btn.btn-default.btn-pad', {
          onclick: function() { Actions.Heterogeneity.proceed(); },
        }, 'Proceed')
      );
    }

    var boxItems = (data.boxes || []).map(function(box) {
      return renderBox(box, text, data.rfvReady);
    });

    sections.push(
      h('blockquote#heterogeneityBoxes.col-xs-12', [
        div('.form-inline', [
          'The estimated value of between-study variance for the network meta-analysis is ',
          strong(String(data.rfvsTauSquare || '')),
        ].concat(customLabel)),
      ].concat(actionButtons))
    );
    sections.push(
      div('#heterBoxes.col-xs-12.well.collapse.in', [
        ul('.list-inline', boxItems),
      ])
    );
  }

  return div('.container-fluid', sections);
};

module.exports = heterogeneityView;
