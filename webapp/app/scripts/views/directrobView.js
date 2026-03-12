'use strict';

// directrobView.js — Direct risk of bias view using hyperscript-helpers
//
// Replaces directrob.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text, totalStudies, totalLevels: [{amount, color, name}] }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, ul = hh.ul, li = hh.li;
var span = hh.span, strong = hh.strong;

var directrobView = (data) => {
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

  return h('blockquote#directRobSelectCont.col-xs-12', [
    h3('#directRobTitle.directTitle', {
      attributes: { 'data-parent': '#directSelectionWrapper', 'data-target': '#robSelector' },
    }, text.title || ''),
    div('.form-inline', [
      div([
        strong(String(data.totalStudies || 0)),
        ' total studies',
        ul('.list-inline', levelItems),
      ]),
    ]),
  ]);
};

module.exports = directrobView;
