'use strict';

// netindrView.js — Network indirectness view using hyperscript-helpers
//
// Replaces netindr.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text, statusReady, ruleName, customized, customizedSingular,
//          numberCustomized, rulesselections, boxs }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h4 = hh.h4, ul = hh.ul, li = hh.li, span = hh.span;
var select = hh.select, option = hh.option, button = hh.button;
var label = hh.label, strong = hh.strong, hr = hh.hr, br = hh.br;

// Shared box rendering (same structure as netrob)
// Resolve any nested function properties on box objects (from view.js lazy getters)
var renderBox = (box, text, statusReady) => {
  var judgements = typeof box.judgements === 'function' ? box.judgements() : (box.judgements || []);
  var customized = typeof box.customized === 'function' ? box.customized() : box.customized;
  var rulesItems = (box.rules || []).map(function(rule) {
    var cls = rule.isActive ? '' : '.robLabel';
    return li(cls, [
      rule.name + ':',
      strong('.pull-right', rule.label),
    ]);
  });

  var judgementOptions = judgements.map(function(j) {
    return option({
      value: box.id + '\u03C3\u03B4el' + j.id,
      disabled: j.isDisabled,
      selected: j.isActive,
    }, j.label);
  });

  var evidenceLabel = box.isMixed
    ? (text.mixedtitle || 'Mixed')
    : (text.indirecttitle || 'Indirect');

  return li('.well.compIndrSelector' + (customized ? '.customized' : ''), {
    style: { borderColor: box.color },
    id: 'comp-' + box.id,
  }, [
    ul([
      li([
        strong('Comparison'),
        span('.pull-right', [strong(box.id)]),
      ]),
      li([
        strong(' Evidence: ' + evidenceLabel),
        hr(),
      ]),
    ].concat(rulesItems, [
      hr(),
      li([
        (text.judgementField || 'Judgement') + ' ',
        select('.mr-sm-2.controls-container', {
          onchange: function() { Actions.NetIndr.selectIndividual(this); },
          disabled: !statusReady,
        }, judgementOptions),
      ]),
    ])),
  ]);
};

var netindrView = (data) => {
  var text = data.text || {};
  var statusReady = data.statusReady;
  var rulesselections = data.rulesselections || [];
  // Note: template uses "boxs" (typo in original), not "boxes"
  var boxs = data.boxs || [];

  // Header section
  var headerContent = [];

  if (!statusReady) {
    var ruleOptions = rulesselections.filter(function(r) { return r.isAvailable; }).map(function(r) {
      return option({
        value: r.value,
        disabled: r.isDisabled,
        selected: r.isActive,
      }, r.label);
    });

    headerContent.push(
      h4('.controls-title.mr-sm-2', [
        text.selectionTitle || '',
        span('.info.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('Choosing "Majority" will lead to a level of concern according to the indirectness with the greatest total percentage contribution (the greatest block between green, yellow, and red in each bar). The "Highest" will assign a level of concern determined by the highest indirectness in each bar. Summarizing indirectness assessments using "Average" uses a weighted average score for each relative effect estimate according to the percentage contribution of studies at each bias level. Details can be found in Section 4.3 of the detailed manual.');
          },
        }),
      ])
    );
    headerContent.push(
      select('.mr-sm-2.form-inline.form-control', {
        onchange: function() { Actions.NetIndr.selectRule(this); },
        disabled: statusReady,
      }, ruleOptions)
    );
  }

  if (statusReady) {
    headerContent.push(
      label('.controls-title.mr-sm-2', (text.defaultTitle || '') + ' ' + (data.ruleName || ''))
    );
    if (data.customized) {
      headerContent.push(br());
      var custText = data.customizedSingular
        ? (text.customizedPreSingular || '') + ' ' + data.numberCustomized + ' ' + (text.customizedTitleSingular || '')
        : (text.customizedPrePlural || '') + ' ' + data.numberCustomized + ' ' + (text.customizedTitlePlural || '');
      headerContent.push(label('.controls-title.mr-sm-2', custText));
    }
    headerContent.push(br());
    headerContent.push(
      button('.btn.btn-default', {
        onclick: function() { Actions.NetIndr.resetNetIndr(); },
      }, text.resetButton || 'Reset')
    );
    headerContent.push(
      button('.btn.btn-default.btn-pad', {
        onclick: function() { Actions.NetIndr.proceed(); },
      }, 'Proceed')
    );
  }

  // Boxes section — cap rendering at 200 to avoid browser freeze on large projects
  var MAX_VISIBLE_BOXES = 200;
  var totalBoxes = boxs.length;
  var visibleBoxes = totalBoxes > MAX_VISIBLE_BOXES ? boxs.slice(0, MAX_VISIBLE_BOXES) : boxs;
  var boxItems = visibleBoxes.map(function(box) {
    return renderBox(box, text, statusReady);
  });

  var boxContent = [ul('.list-inline', boxItems)];
  if (totalBoxes > MAX_VISIBLE_BOXES) {
    boxContent.push(
      div('.alert.alert-info', [
        'Showing ' + MAX_VISIBLE_BOXES + ' of ' + totalBoxes + ' comparisons. ',
        'Use the rule selector above to apply a rule to all comparisons at once.',
      ])
    );
  }

  return [
    h('blockquote#netIndr.col-xs-12', [
      div('.form-inline', headerContent),
    ]),
    div('#netIndrSelector.col-xs-12.well.collapse.in', boxContent),
  ];
};

module.exports = netindrView;
