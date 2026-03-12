'use strict';

// netplotView.js — Network plot view using hyperscript-helpers
//
// Replaces netplot.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text (= NP.model.state), view (= NP.view with controls) }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, span = hh.span, a = hh.a;
var label = hh.label, select = hh.select, option = hh.option;

var netplotView = (data) => {
  var view = data.view || {};
  var controls = (typeof view.controls === 'function') ? view.controls() : (view.controls || []);

  var controlElements = controls.map(function(ctrl) {
    var selections = ctrl.selections || [];
    var options = selections.filter(function(s) { return s.isAvailable; }).map(function(s) {
      return option({
        attributes: { filter: s.value },
        selected: s.isActive,
      }, s.label);
    });
    return [
      label('.np-control.controls-title.mr-sm-2', ctrl.title || ''),
      select('.mr-sm-2.controls-container.netplotControl.form-control', {
        attributes: { 'data-option': ctrl.tag, action: ctrl.action },
      }, options),
    ];
  });

  return div('#NetPlot.collapse.in', [
    h('blockquote#netplotControls.col-xs-12', [
      div('.pull-right.col-xs-12', [
        h3([
          'Network Plot',
          span('#prinfo.info.pull-right.glyphicon.glyphicon-info-sign', {
            attributes: { 'aria-hidden': 'true' },
            onclick: function() {
              Actions.alertify().message('Nodes and edges can be weighted according to the sample size or the number of studies and colored according to risk of bias or indirectness. The outcome data appear next to the network plot. By clicking on a specific edge or node, the respective outcome data corresponding to that edge or node appear on the data table. Details can be found in Section 3.1 of the detailed manual.');
            },
          }),
        ]),
        div('.form-inline', [].concat(
          _.flatten(controlElements),
          [
            a('#np-save.pull-right.cold-sm-12.mr-sm-2.btn.btn-default.np-control', 'Save Plot'),
            a('.pull-right.cold-sm-12.mr-sm-2.np-redraw.btn.btn-default.np-control', {
              attributes: { action: 'np-redraw' },
            }, 'Redraw'),
          ]
        )),
      ]),
    ]),
    div('#cy.col-sm-12.col-md-6'),
    div('#np-table-container.col-sm-12.col-md-6.table-container.well', [
      span('.btn-full-screen.table-resizer.pull-right.glyphicon.glyphicon-fullscreen', {
        attributes: { aria: 'fullscreen table', 'aria-hidden': 'true' },
      }),
      span('.btn-minimize.table-resizer.pull-right.glyphicon.glyphicon-resize-small', {
        style: { display: 'none' },
        attributes: { aria: 'minimize table', 'aria-hidden': 'true' },
      }),
      div('#np-table.table'),
    ]),
  ]);
};

module.exports = netplotView;
