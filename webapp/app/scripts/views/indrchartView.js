'use strict';

// indrchartView.js — Indirectness chart view using hyperscript-helpers
//
// Replaces indrchart.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text: { title, subtitle, saveButton } }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, h4 = hh.h4, span = hh.span, button = hh.button;

var indrchartView = (data) => {
  var text = data.text || {};
  return [
    h('blockquote#IndrChartTitleCont.col-xs-12', [
      h3('#IndrChartTitle', [
        text.title || '',
        span('.info.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('Each bar corresponds to an estimate of relative effect. Each bar also represents a reordering of a column of the per\u2010study contribution matrix, where studies with low, moderate, and high indirectness have been grouped together and colored accordingly. Each study is represented by a colored area with white borders and is proportional to its contribution. Details can be found in Section 4.3 of the detailed manual.');
          },
        }),
      ]),
      h4('#IndrChartTitle.comments', text.subtitle || ''),
      div('.form-inline', [
        button('.pull-right.btn.btn-default', {
          onclick: function() { Actions.IndrChart.save(); },
        }, text.saveButton || ''),
      ]),
    ]),
    div('#IndrChartContainer'),
  ];
};

module.exports = indrchartView;
