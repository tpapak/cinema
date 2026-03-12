'use strict';

// indirectnessView.js — Direct indirectness view using hyperscript-helpers
//
// Replaces indirectness.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text, statusReady, hasData, totalStudies, totalLevels: [{amount, color, name}] }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, ul = hh.ul, li = hh.li;
var span = hh.span, strong = hh.strong;

var indirectnessView = (data) => {
  var text = data.text || {};
  // totalLevels may be an object (from _.mapObject) or array — normalize to array
  var rawLevels = data.totalLevels || {};
  var totalLevels = Array.isArray(rawLevels) ? rawLevels : _.values(rawLevels);

  var levelItems = totalLevels.map(function(level) {
    return li([
      strong(String(level.amount)),
      ' :',
      span({ style: { color: level.color } }, ' ' + level.name),
    ]);
  });

  var titleText = data.statusReady
    ? 'Indirectness for direct evidence is evaluated'
    : (text.title || '');

  var studyContent = data.hasData
    ? div([
        strong(String(data.totalStudies || 0)),
        ' total studies',
        ul('.list-inline', levelItems),
      ])
    : div();

  return h('blockquote#directIndrSelectCont.col-xs-12', [
    h3(titleText),
    div('.form-inline', [studyContent]),
  ]);
};

module.exports = indirectnessView;
