'use strict';

// errorView.js — Error page view using hyperscript-helpers
//
// Replaces error.hbs Handlebars template.
// Pure function: (text) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var div = hh.div;

var errorView = (text) => {
  return div('.container-fluid.routed#error', [
    div('.error-cont.error.col-md-offset-1.col-md-10', [
      // errorPage content was triple-stash {{{errorPage}}} — rendered as innerHTML
      // In practice this div is empty; error messages are shown via alertify
    ]),
  ]);
};

module.exports = errorView;
