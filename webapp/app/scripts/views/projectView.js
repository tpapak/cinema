'use strict';

// projectView.js — Project page view using hyperscript-helpers
//
// Replaces project.hbs Handlebars template.
// Pure function: (model, view) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, h4 = hh.h4, ul = hh.ul, li = hh.li;
var span = hh.span, button = hh.button, input = hh.input, select = hh.select;
var option = hh.option, a = hh.a, small = hh.small, br = hh.br, em = hh.em;

// =====================================================
// Sub-views
// =====================================================

var uploaderSection = (model) => {
  return div([
    // Dataset uploader
    h3('Dataset uploader'),
    div('.well.col-xs-12.project-uploader', [
      span('.prtitle', { innerHTML: model.text.uploadDataset }),
      span('.pull-left.glyphicon.glyphicon-cloud-upload', { attributes: { 'aria-hidden': 'true' } }),
      span('#prinfo.info.pull-right.glyphicon.glyphicon-info-sign', {
        attributes: { 'aria-hidden': 'true' },
        onclick: function() {
          Actions.alertify().message(
            'Upload a .csv file with the study outcome data. The dataset should also include the data on the study\u2010level risk of bias (RoB) and judgments on indirectness. Study\u2010level RoB and indirectness can take either {1, 2, 3}, {l, m, h} or {L, M, H} values for low, moderate, and high RoB and indirectness respectively. The outcome can be binary or continuous and the format of the data can be either long or wide. Details can be found in Section 2 of the detailed manual'
          );
        },
      }),
      div('.form-group', [
        input('#files', {
          type: 'file', name: 'file', accept: '.csv,.CSV',
          onchange: function() { Actions.Project.fetchProject(this); },
        }),
      ]),
      div('.col-xs-12.col-md-offset-2.col-md-8', [
        'A demo dataset* can be downloaded ',
        a({ href: 'model/Elliott_2007.csv', download: 'diabetes.csv' }, 'here'),
        '. It is a network of six antihypertensive drugs by Elliot et.al',
        br(),
        small('*Indirectness data are fictional'),
        br(),
        a({ href: 'https://www.ncbi.nlm.nih.gov/pubmed/17240286' },
          'W. J. Elliott and P. M. Meyer. Incident diabetes in clinical trials of antihypertensive drugs: a network meta-analysis. The Lancet, 369(9557):201 \u2013 207, 2007'),
      ]),
    ]),

    // Project uploader
    h3('Project uploader'),
    div('.well.col-xs-12.project-uploader', [
      span('.prtitle', { innerHTML: model.text.uploadProject }),
      span('.pull-left.glyphicon.glyphicon-cloud-upload', { attributes: { 'aria-hidden': 'true' } }),
      div('.form-group', [
        input('#uploadProject', {
          // No `accept`: iOS/macOS file pickers grey out custom extensions
          // (.cnm) even when listed, so we leave the filter off.
          type: 'file', name: 'uploadProject',
          onchange: function() { Actions.Project.readProject(this); },
        }),
        div('.col-xs-12.col-md-offset-2.col-md-8', [
          'You can upload here previously saved project (',
          em('.cnm'),
          ' files) or exported analysis (',
          em('.json'),
          ') from ',
          a({ href: 'https://crsu-metainsight.le.ac.uk/MetaInsight/' }, 'MetaInsight'),
        ]),
      ]),
    ]),

    // Reset button
    button('.btn.btn-default', {
      onclick: function() { Actions.Project.resetApp(); },
    }, ['Reset ', span('.logo', 'CINeMA')]),
  ]);
};

var projectDetails = (view) => {
  return div([
    h3('Project details'),
    ul([
      li('.list-group-item', [
        ul('.list-inline', [
          li([h4(view.projectTitle)]),
          li('.pull-right', [
            button('.btn.btn-default', {
              onclick: function() { Actions.Project.changeName(); },
            }, 'Rename'),
          ]),
        ]),
      ]),
      li('.list-group-item', [
        'Filename ',
        span('.badge', view.filename + '.csv'),
      ]),
      li('.list-group-item', [
        'Created ',
        span('.badge', view.creationDate),
      ]),
    ]),
    span('.comments', [
      'look at the ',
      a({ href: '#doc', onclick: function() { Actions.Router.gotoRoute('doc'); } },
        'documentation page '),
      'for the definition of each field',
    ]),
  ]);
};

var formatTypeDisplay = (view) => {
  return div([
    h3('File format and outcome type'),
    ul([
      li('.list-group-item', ['Format ', span('.badge', view.format)]),
      li('.list-group-item', ['Outcome ', span('.badge', view.type)]),
    ]),
    !view.canProceed
      ? button('.pull-right.btn.btn-default', {
          onclick: function() { Actions.Project.editFormatType(); },
        }, 'Reset')
      : div(),
  ]);
};

var formatTypeSelector = (view) => {
  var formatOptions = [
    option({ value: 'nothing', disabled: true, selected: !view.hasSelectedFormat }, '--'),
  ].concat((view.rawFormats || []).map(function(f) {
    return option({ value: f, selected: f === view.selectedFormat }, f);
  }));

  var typeOptions = [
    option({ value: 'nothing', disabled: true, selected: !view.hasSelectedType }, '--'),
  ].concat((view.rawTypes || []).map(function(t) {
    return option({ value: t, selected: t === view.selectedType }, t);
  }));

  return div([
    h3('File format and Outcome type'),
    ul([
      !view.format
        ? li([
            'Format ',
            select({
              onchange: function() { Actions.Project.selectFormat(this); },
            }, formatOptions),
            ul([
              li('long: Single treatment per row'),
              li('wide: Single comparison per row'),
              li('iv: Inverse variance (Single comparison per row)'),
            ]),
          ])
        : div(),
      !view.type
        ? li([
            'Outcome ',
            select({
              onchange: function() { Actions.Project.selectType(this); },
            }, typeOptions),
          ])
        : div(),
    ]),
    view.hasSelectedFormatType
      ? button('.pull-right.btn.btn-default', {
          onclick: function() { Actions.Project.saveFormatType(); },
        }, 'Save')
      : div(),
  ]);
};

var columnMapping = (view) => {
  // resolveView() has already called requiredFields()/optionalFields(), so
  // these are values, not functions. projectFields() returns {} (not an array)
  // when settings aren't set yet, and `{} || []` is truthy so a bare .map()
  // throws. Guard with Array.isArray.
  var requiredList = (Array.isArray(view.requiredFields) ? view.requiredFields : []).map(function(field) {
    var colOptions = (field.availableColumns || []).map(function(col) {
      return option({
        value: col.name,
        selected: col.isSelected,
        disabled: col.isDisabled,
      }, col.name);
    });
    return li([
      ul('.list-inline', [
        li(field.name + '*'),
        li([
          select({
            onchange: function() { Actions.Project.selectColumn(this, field.name); },
          }, colOptions),
        ]),
        li('.comments.pull-right', { innerHTML: field.description.short }),
      ]),
    ]);
  });

  var optionalList = (Array.isArray(view.optionalFields) ? view.optionalFields : []).map(function(field) {
    var colOptions = (field.availableColumns || []).map(function(col) {
      return option({
        value: col.name,
        selected: col.isSelected,
        disabled: col.isDisabled,
      }, col.name);
    });
    return li([
      ul('.list-inline', [
        li(field.name),
        li([
          select({
            onchange: function() { Actions.Project.selectColumn(this, field.name); },
          }, colOptions),
        ]),
      ]),
    ]);
  });

  return div([
    h3('Associate columns to fields'),
    ul('#required-columns.imprecisionList.col-md-6',
      requiredList
        .concat([li([span('.comments', '(* required)')])])
        .concat(optionalList)
    ),
  ]);
};

var summarySection = (view) => {
  return div([
    h3('Summary'),
    ul('#project-summary.list-group', [
      li('.list-group-item', [span('.badge', String(view.numStudies)), ' Studies']),
      li('.list-group-item', [span('.badge', String(view.interventions)), ' Interventions']),
      li('.list-group-item', [span('.badge', String(view.comparisons)), ' Comparisons']),
    ]),
    view.isSaved
      ? button('.pull-right.btn.btn-default', {
          onclick: function() { Actions.Project.proceed(); },
        }, 'Proceed')
      : button('Save'),
  ]);
};

// =====================================================
// Resolve view functions to plain values.
// PR.view has methods like filename: () => '...'.
// Handlebars called them implicitly; we call them explicitly.
// =====================================================
var resolveView = (view) => {
  var resolved = {};
  Object.keys(view).forEach(function(key) {
    try {
      resolved[key] = typeof view[key] === 'function' ? view[key]() : view[key];
    } catch (e) {
      resolved[key] = undefined;
    }
  });
  return resolved;
};

// =====================================================
// Main project view
// =====================================================
var projectView = (model, rawView) => {
  var view = resolveView(rawView);
  var content;

  if (!view.hasFile) {
    // No file loaded — show uploaders
    content = uploaderSection(model);
  } else {
    // File loaded
    var sections = [projectDetails(view)];

    if (view.hasFormatType) {
      sections.push(formatTypeDisplay(view));
    } else {
      sections.push(formatTypeSelector(view));
    }

    if (!view.canProceed) {
      if (view.hasFormatType) {
        sections.push(columnMapping(view));
      }
      if (view.allRequiredSelected) {
        sections.push(
          button('.pull-right.btn.btn-default', {
            onclick: function() { Actions.Project.checkFile(); },
          }, 'Check file')
        );
      }
    }

    if (view.canProceed) {
      sections.push(summarySection(view));
    }

    content = div(sections);
  }

  return div('.container-fluid.routed#project', [
    div('.projects-container.col-xs-12.col-md-offset-2.col-md-8', [content]),
  ]);
};

module.exports = projectView;
