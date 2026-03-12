'use strict';

// conmatrixView.js — Contribution matrix / analysis setup view using hyperscript-helpers
//
// Replaces conmatrix.hbs Handlebars template.
// Pure function: (data) => VTree
// data = View(model) output, with controls, flags, etc.

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, p = hh.p, h3 = hh.h3, h4 = hh.h4, h5 = hh.h5;
var ul = hh.ul, li = hh.li, span = hh.span, br = hh.br;
var select = hh.select, option = hh.option, button = hh.button, a = hh.a;
var label = hh.label, strong = hh.strong, em = hh.em, i = hh.i;
var input = hh.input;

// Render a single control item (radio, select, interventions, interventionRules)
var renderControl = (ctrl, isEmpty) => {
  if (ctrl.type === 'radio') {
    var radioItems = (ctrl.selections || [])
      .filter(function(s) { return s.isAvailable; })
      .map(function(s) {
        return label('.mr-sm-2', { htmlFor: s.value }, [
          s.label,
          input({
            disabled: !isEmpty,
            type: 'radio',
            attributes: { 'data-param': s.tag, 'data-value': s.value },
            name: s.name,
            value: s.value,
            checked: s.isSelected,
          }),
        ]);
      });
    return div('.form-inline.conMatControls', [
      label('.controls-title.mr-sm-2', ctrl.title || ''),
    ].concat(radioItems));
  }

  if (ctrl.type === 'select') {
    var selectOptions = (ctrl.selections || [])
      .filter(function(s) { return s.isAvailable; })
      .map(function(s) {
        return option({
          disabled: !isEmpty,
          attributes: { 'data-param': s.tag, 'data-value': s.value, filter: s.value },
          selected: s.isSelected,
        }, s.label);
      });
    return div('.form-inline.conMatControls', [
      label('.controls-title', ctrl.title || ''),
      select('.controls-container.form-control', {
        attributes: { action: ctrl.action },
        required: true,
      }, selectOptions),
    ]);
  }

  if (ctrl.type === 'interventions') {
    var checkboxItems = (ctrl.selections || []).map(function(s) {
      return label('.checkbox-inline', { htmlFor: s.value }, [
        input({
          type: 'checkbox',
          attributes: { 'data-param': s.tag, 'data-value': s.value },
          value: s.value,
          checked: s.isSelected,
          disabled: !isEmpty,
        }),
        ' ' + s.label,
      ]);
    });
    return div('.form-inline.conMatControls', [
      label(ctrl.title || ''),
    ].concat(checkboxItems, [
      br(),
      a('#checkAllIntvs.intvs.btn.btn-default' + (!isEmpty ? '.disabled' : ''), 'Check All'),
      a('#uncheckAllIntvs.intvs.btn.btn-default' + (!isEmpty ? '.disabled' : ''), 'Uncheck All'),
    ]));
  }

  if (ctrl.type === 'interventionRules') {
    var ruleRadios = (ctrl.selections || [])
      .filter(function(s) { return s.isAvailable; })
      .map(function(s) {
        return [
          label({ htmlFor: s.value }, [
            s.label,
            input({
              disabled: !isEmpty,
              type: 'radio',
              attributes: { 'data-param': s.tag, 'data-value': s.value },
              name: s.name,
              value: s.value,
              checked: s.isSelected,
            }),
          ]),
          br(),
        ];
      });
    return div('.form-inline.conMatControls', [
      label(ctrl.title || ''),
      br(),
    ].concat(_.flatten(ruleRadios)));
  }

  // Unknown control type — skip
  return div();
};

var conmatrixView = (data) => {
  var controls = data.controls || [];
  var isEmpty = data.isEmpty; // true when CM status==='empty' => controls should be enabled

  // First blockquote: analysis parameters (radio + select controls)
  var analysisControls = controls
    .filter(function(c) { return c.type === 'radio' || c.type === 'select'; })
    .map(function(c) { return renderControl(c, isEmpty); });

  // Second blockquote: intervention selection (interventions + interventionRules)
  var interventionControls = controls
    .filter(function(c) { return c.type === 'interventions' || c.type === 'interventionRules'; })
    .map(function(c) { return renderControl(c, isEmpty); });

  var sections = [];

  // Analysis setup blockquote
  sections.push(
    h('blockquote#conMatrixTitleCont.col-xs-12', [
      h3('#contMatTitle', [
        'Define your analysis',
        span('#prinfo.info.pull-right.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('Choose whether to perform a fixed effect or a random effects network meta-analysis and define effect measure type. Details can be found in Section 3.2 of the detailed manual.');
          },
        }),
      ]),
      div('.form-inline.pull-right.col-xs-12', analysisControls),
    ])
  );

  // Intervention selection blockquote
  sections.push(
    h('blockquote#conMatrixTitleCont.col-xs-12', [
      h3('#contMatTitle', [
        'Select intervention comparisons for evaluation',
        span('#prinfo.info.pull-right.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('Select which intervention comparisons are to be evaluated. First select the interventions of interest and then specify whether to evaluate all the comparisons that contain these interventions ("Containing any of the above interventions") or only the comparisons that are formed between the selected interventions ("Between the above interventions"). Details can be found in Section 3.3 of the detailed manual.');
          },
        }),
      ]),
      div('.form-inline.pull-right.col-xs-12', interventionControls),
    ])
  );

  // Comparison list (when listReady)
  if (data.listReady) {
    var allComps = data.selectedComparisons || [];
    var totalComps = data.numSelectedComparisons || 0;
    // Limit rendered badges to avoid freezing with large networks (e.g. 9,591 comparisons)
    var MAX_BADGES = 200;
    var visibleComps = allComps.length > MAX_BADGES ? allComps.slice(0, MAX_BADGES) : allComps;
    var compBadges = visibleComps.map(function(comp) {
      return li([span('.badge', comp)]);
    });
    // var compBadges = (data.selectedComparisons || []).map(function(comp) {
    //   return li([span('.badge', comp)]);
    // });
    var badgeListItems = [];
    badgeListItems.push(ul('.list-inline', compBadges));
    if (allComps.length > MAX_BADGES) {
      badgeListItems.push(
        p({ style: { fontStyle: 'italic', color: '#888' } },
          '... and ' + (allComps.length - MAX_BADGES) + ' more comparisons (not shown)')
      );
    }
    sections.push(
      div('#comparisonList.col-xs-12', [
        h5([
          'You have selected the following ',
          strong(String(totalComps)),
          ' comparisons. Confidence in the results will be graded for:',
        ]),
      ].concat(badgeListItems).concat([
        div('.pull-right', [
          strong([
            i('.glyphicon.glyphicon-exclamation-sign'),
            em(' Analysis is performed including all studies'),
          ]),
        ]),
      ]))
    );
  }

  // Loading / table / buttons area
  var statusContent = [];
  if (data.isLoading) {
    statusContent.push(
      div('#conMatloader.col-md-offset-2.col-md-8.col-xs-12', {
        attributes: { aria: 'downloading contribution matrix', 'aria-hidden': 'false' },
      }, [
        div('.row', [
          div('.col-xs-1', [
            div('#conMatSpinner.loader', { style: { fontSize: '12px' } }),
          ]),
          h4('#loaderTitle.col-xs-11', data.headerTitle || ''),
        ]),
        div('.row.progress', [
          div('#conMatProgressBar.progress-bar.active', {
            attributes: {
              role: 'progressbar',
              'aria-valuenow': String(data.progress || 0),
              'aria-valuemin': '0',
              'aria-valuemax': '100',
            },
            style: { width: (data.progress || 0) + '%' },
          }, (data.progress || 0) + '%'),
        ]),
      ])
    );
  }
  if (data.isCanceling) {
    statusContent.push('Canceling please wait.');
  }
  if (data.tableReady) {
    statusContent.push(div('#cm-table'));
  }
  sections.push(div('.col-xs-12', statusContent));

  // Action buttons
  if (data.canCreateMatrix) {
    sections.push(
      a('#createMatrixButton.btn.btn-default', {
        onclick: function() { Actions.ConMat.createMatrix(); },
        attributes: {
          'data-content': 'All fields should be filled',
          rel: 'popover',
          'data-placement': 'bottom',
          'data-trigger': 'hover',
        },
      }, 'Set up your evaluation')
    );
    sections.push(
      a('#offlineScriptButton.btn.btn-default', {
        onclick: function() { Actions.ConMat.generateOfflineScript(); },
        attributes: {
          'data-content': 'Download an R script for large networks',
          rel: 'popover',
          'data-placement': 'bottom',
          'data-trigger': 'hover',
        },
      }, [
        span('.glyphicon.glyphicon-download-alt'),
        ' Get R script for offline analysis',
      ])
    );
  }
  if (data.isLoading) {
    sections.push(
      a('#cancelCM.btn.btn-default', {
        onclick: function() { Actions.ConMat.cancelMatrix(); },
      }, 'Cancel!')
    );
  }
  if (data.tableReady) {
    sections.push(
      a('.btn.btn-default', {
        onclick: function() { Actions.ConMat.downloadStudyCSV(); },
        id: 'downloadAnchorElem',
      }, ['Download per ', strong('study'), ' contribution matrix'])
    );
    sections.push(
      a('.btn.btn-default', {
        onclick: function() { Actions.ConMat.downloadCSV(); },
      }, ['Download per ', strong('comparison'), ' contribution matrix'])
    );
    sections.push(
      a('#downloadLeaguetable.btn.btn-default', {
        onclick: function() { Actions.ConMat.downloadLeaguetable(); },
      }, 'Download league table')
    );
    if (data.hasleaguetableLM) {
      sections.push(
        a('#downloadLeaguetableH.btn.btn-default', {
          onclick: function() { Actions.ConMat.downloadLeaguetableH(); },
        }, 'Download league table excluding high within-study bias studies')
      );
      if (data.hasleaguetableL) {
        sections.push(
          a('#downloadLeaguetableMH.btn.btn-default', {
            onclick: function() { Actions.ConMat.downloadLeaguetableMH(); },
          }, 'Download league table excluding moderate and high within-study bias studies')
        );
      }
    }
    sections.push(
      button('.pull-right.btn.btn-default.btn-pad', {
        onclick: function() { Actions.ConMat.proceed(); },
      }, 'Proceed')
    );
    sections.push(
      a('#clearCM.btn.pull-right.btn-default', {
        onclick: function() { Actions.ConMat.resetAnalysis(); },
      }, 'Reset your evaluation')
    );
  }

  sections.push(br());
  sections.push(br());

  return sections;
};

module.exports = conmatrixView;
