'use strict';

// projectManagerView.js — Project Manager page view using hyperscript-helpers
//
// Replaces projectManager.hbs Handlebars template.
// Pure function: (model, viewData) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h2 = hh.h2, h4 = hh.h4, p = hh.p, em = hh.em;
var span = hh.span, button = hh.button, input = hh.input, label = hh.label;
var table = hh.table, thead = hh.thead, tbody = hh.tbody, tr = hh.tr, th = hh.th, td = hh.td;
var strong = hh.strong, small = hh.small, br = hh.br, i = hh.i, hr = hh.hr;

// =====================================================
// Sub-views
// =====================================================

// Top toolbar — visible when no collection is loaded
var emptyToolbar = () => {
  return div('.pm-toolbar', [
    button('.btn.btn-primary.btn-sm', {
      onclick: function() { Actions.ProjectManager.newCollection(); },
    }, [
      i('.fa.fa-plus', { attributes: { 'aria-hidden': 'true' } }),
      ' New Collection',
    ]),
    span('.pm-upload-wrap', [
      label('.btn.btn-default.btn-sm', { htmlFor: 'pmUploadCollection' }, [
        i('.fa.fa-upload', { attributes: { 'aria-hidden': 'true' } }),
        ' Upload Collection (.cdb)',
      ]),
      input('#pmUploadCollection', {
        type: 'file', accept: '.cdb,.CDB,.json,.JSON',
        style: { display: 'none' },
      }),
    ]),
  ]);
};

var emptyMessage = () => {
  return div('.pm-empty', [
    p([
      'No collection loaded. Create a new one or upload a ',
      em('.cdb'),
      ' collection.',
    ]),
  ]);
};

// Collection header with title and action buttons
var collectionHeader = (col) => {
  return div('.panel-heading.pm-collection-header', [
    h4('.panel-title.pm-collection-title', [
      i('.fa.fa-folder-open', { attributes: { 'aria-hidden': 'true' } }),
      ' ',
      col.title,
      ' ',
      span('.badge', String(col.projects ? col.projects.length : 0) + ' projects'),
    ]),
    div('.pm-collection-actions', [
      button('.btn.btn-xs.btn-default', {
        onclick: function() { Actions.ProjectManager.renameCollection(); },
        title: 'Rename collection',
      }, [i('.fa.fa-pencil', { attributes: { 'aria-hidden': 'true' } })]),
      button('.btn.btn-xs.btn-default', {
        onclick: function() { Actions.ProjectManager.exportCollection(); },
        title: 'Export as .cdb',
      }, [i('.fa.fa-download', { attributes: { 'aria-hidden': 'true' } })]),
      button('.btn.btn-xs.btn-danger', {
        onclick: function() { Actions.ProjectManager.clearCollection(); },
        title: 'Remove collection',
      }, [i('.fa.fa-trash', { attributes: { 'aria-hidden': 'true' } })]),
    ]),
  ]);
};

// Project toolbar inside collection panel
var projectToolbar = () => {
  return div('.pm-project-toolbar', [
    span('.pm-upload-wrap', [
      label('.btn.btn-default.btn-sm', { htmlFor: 'pmUploadProject' }, [
        i('.fa.fa-upload', { attributes: { 'aria-hidden': 'true' } }),
        ' Upload Project (.cnm)',
      ]),
      input('#pmUploadProject', {
        type: 'file', accept: '.cnm,.CNM,.json,.JSON',
        style: { display: 'none' },
      }),
    ]),
    span('.pm-upload-wrap', [
      label('.btn.btn-default.btn-sm', { htmlFor: 'pmUploadCSV' }, [
        i('.fa.fa-upload', { attributes: { 'aria-hidden': 'true' } }),
        ' Upload Dataset (.csv)',
      ]),
      input('#pmUploadCSV', {
        type: 'file', accept: '.csv,.CSV',
        style: { display: 'none' },
      }),
    ]),
  ]);
};

var emptyProjects = () => {
  return p('.text-muted.pm-empty-projects', [
    'No projects in this collection. Create one, upload a ',
    em('.cnm'),
    ' project, or upload a ',
    em('.csv'),
    ' dataset.',
  ]);
};

// Single project row in the table
var projectRow = (proj) => {
  var classes = '.pm-project-row' + (proj.isActive ? '.pm-project-active' : '');
  return tr(classes, [
    // Title column
    td([
      strong(proj.title || ''),
      proj.isActive
        ? span('.label.label-primary.pm-active-badge', 'active')
        : span(),
      proj.description
        ? div([br(), small('.text-muted', proj.description)])
        : span(),
    ]),
    // Outcome column
    td([
      proj.outcome
        ? span(proj.outcome)
        : em('.text-muted', '--'),
      button('.btn.btn-xs.btn-link', {
        onclick: function() { Actions.ProjectManager.editOutcome(proj.id); },
        title: 'Edit outcome',
      }, [i('.fa.fa-pencil', { attributes: { 'aria-hidden': 'true' } })]),
    ]),
    // Studies column
    td([
      proj.hasStudies
        ? span(String(proj.studyCount) + ' arms')
        : span('--'),
    ]),
    // Analyzed column
    td([
      proj.isAnalyzed
        ? i('.fa.fa-check.text-success', { attributes: { 'aria-hidden': 'true' } })
        : i('.fa.fa-minus.text-muted', { attributes: { 'aria-hidden': 'true' } }),
    ]),
    // Evaluated column
    td([
      proj.hasEvaluation
        ? i('.fa.fa-check.text-success', { attributes: { 'aria-hidden': 'true' } })
        : i('.fa.fa-minus.text-muted', { attributes: { 'aria-hidden': 'true' } }),
    ]),
    // Actions column
    td('.pm-project-actions', [
      button('.btn.btn-xs.btn-primary', {
        onclick: function() { Actions.ProjectManager.openProject(proj.id); },
        title: 'Open in CINeMA',
      }, [
        i('.fa.fa-folder-open', { attributes: { 'aria-hidden': 'true' } }),
        ' Open',
      ]),
      button('.btn.btn-xs.btn-default', {
        onclick: function() { Actions.ProjectManager.renameProject(proj.id); },
        title: 'Rename',
      }, [i('.fa.fa-pencil', { attributes: { 'aria-hidden': 'true' } })]),
      button('.btn.btn-xs.btn-default', {
        onclick: function() { Actions.ProjectManager.exportProject(proj.id); },
        title: 'Export as .cnm',
      }, [i('.fa.fa-download', { attributes: { 'aria-hidden': 'true' } })]),
      button('.btn.btn-xs.btn-danger', {
        onclick: function() { Actions.ProjectManager.removeProject(proj.id); },
        title: 'Remove',
      }, [i('.fa.fa-trash', { attributes: { 'aria-hidden': 'true' } })]),
    ]),
  ]);
};

// Projects table
var projectsTable = (projectsView) => {
  return table('.table.table-hover.pm-project-table', [
    thead([
      tr([
        th('Title'),
        th('Outcome'),
        th('Studies'),
        th('Analyzed'),
        th('Evaluated'),
        th('Actions'),
      ]),
    ]),
    tbody(projectsView.map(projectRow)),
  ]);
};

// Active collection panel
var collectionPanel = (view) => {
  var col = view.collection;
  var hasProjects = view.projectsView && view.projectsView.length > 0;

  var bodyContent = [];
  if (col.description) {
    bodyContent.push(p('.text-muted', col.description));
  }
  bodyContent.push(projectToolbar());
  if (!hasProjects) {
    bodyContent.push(emptyProjects());
  }
  if (hasProjects) {
    bodyContent.push(projectsTable(view.projectsView));
  }

  return div('.pm-collections', [
    div('.pm-collection.panel.panel-primary', [
      collectionHeader(col),
      div('.panel-body', bodyContent),
    ]),
  ]);
};

// =====================================================
// Main project manager view
// =====================================================
var projectManagerView = (model, viewData) => {
  var sections = [];

  sections.push(h2('Projects'));
  sections.push(p('.comments', [
    'Manage your projects. A collection (',
    em('.cdb'),
    ') contains one or more CINeMA projects. A project (',
    em('.cnm'),
    ') is a single-project file.',
  ]));

  if (!viewData.hasCollection) {
    sections.push(emptyToolbar());
    sections.push(emptyMessage());
  }

  if (viewData.hasCollection) {
    sections.push(collectionPanel(viewData));
  }

  sections.push(hr());
  sections.push(
    button('.btn.btn-danger.btn-sm', {
      onclick: function() { Actions.Project.resetApp(); },
    }, [
      i('.fa.fa-exclamation-triangle', { attributes: { 'aria-hidden': 'true' } }),
      ' Reset CINeMA',
    ])
  );

  return div('.container-fluid.routed#project-manager', [
    div('.col-xs-12.col-md-offset-1.col-md-10', sections),
  ]);
};

module.exports = projectManagerView;
