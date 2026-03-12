'use strict';

// pubbiasView.js — Publication bias view using hyperscript-helpers
//
// Replaces pubBias.hbs Handlebars template.
// Pure function: (data) => VTree
// data = { text, pubbiasReady, hasUploaded, boxes }

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h3 = hh.h3, ul = hh.ul, li = hh.li, span = hh.span;
var select = hh.select, option = hh.option, button = hh.button;
var strong = hh.strong, hr = hh.hr, a = hh.a, input = hh.input, br = hh.br;

var renderBox = (box, text, hasUploaded) => {
  var evidenceLabel = '';
  if (box.isMixed) evidenceLabel = text.mixedtitle || 'Mixed';
  if (box.isDirect) evidenceLabel = text.directtitle || 'Direct';
  if (box.isIndirect) evidenceLabel = text.indirecttitle || 'Indirect';

  var judgementContent;
  if (hasUploaded) {
    judgementContent = div('.well', [
      strong((box.judgementlabel && box.judgementlabel.label) || ''),
    ]);
  } else {
    var levelOptions = (box.levels || []).map(function(level) {
      return option({
        value: box.id + '\u03C3\u03B4el' + level.id,
        disabled: level.isDisabled,
        selected: level.isActive,
      }, level.label);
    });
    judgementContent = select('.mr-sm-2.controls-container', {
      onchange: function() { Actions.Pubbias.selectIndividual(this); },
    }, levelOptions);
  }

  return li('.well.compRobSelector' + (box.customized ? '.customized' : ''), {
    style: { borderColor: box.color },
    id: 'comp-' + box.id,
  }, [
    ul([
      li([
        strong('Comparison'),
        span('.pull-right', [strong(box.id)]),
      ]),
      li([
        strong('Evidence: ' + evidenceLabel),
        hr(),
      ]),
      li([
        (text.judgementField || 'Judgement'),
        judgementContent,
      ]),
    ]),
  ]);
};

var pubbiasView = (data) => {
  var text = data.text || {};
  var pubbiasReady = data.pubbiasReady;
  var hasUploaded = data.hasUploaded;
  var boxes = data.boxes || [];

  var sections = [];

  // Header blockquote
  var headerContent = [h3(text.selectionTitle || '')];

  if (pubbiasReady) {
    headerContent.push(div([
      br(),
      button('.btn.btn-default', {
        onclick: function() { Actions.Pubbias.reset(); },
      }, text.resetButton || 'Reset'),
      button('.btn.btn-default.btn-pad', {
        onclick: function() { Actions.Pubbias.proceed(); },
      }, 'Proceed'),
    ]));
  } else {
    headerContent.push(div([
      button('.pull-left.btn-pad.btn.btn-default', {
        onclick: function() { Actions.Pubbias.allLow(); },
      }, text.allLow || 'All low'),
      button('.pull-left.btn-pad.btn.btn-default', {
        onclick: function() { Actions.Pubbias.allSome(); },
      }, text.allSome || 'All some'),
      button('.pull-left.btn-pad.btn.btn-default', {
        onclick: function() { Actions.Pubbias.allHigh(); },
      }, text.allHigh || 'All high'),
      div('.well.col-xs-3.project-uploader', [
        'Upload table ',
        a({ target: '_blank', href: 'https://cinema.ispm.unibe.ch/rob-men' }, 'ROB-MEN'),
        span('.info.glyphicon.glyphicon-info-sign', {
          attributes: { 'aria-hidden': 'true' },
          onclick: function() {
            Actions.alertify().message('You can assess reporting bias with the <b>ROB-MEN</b> framework. Just click the link and follow the instructions');
          },
        }),
        input('#table2Uploader', {
          type: 'file', name: 'file', accept: '.csv,.CSV',
          onchange: function() { Actions.Pubbias.uploadTable2(this); },
        }),
      ]),
    ]));
  }

  sections.push(h('blockquote#pubbiasBoxes.col-xs-12', headerContent));

  // Boxes section (only when ready)
  if (pubbiasReady) {
    var boxItems = boxes.map(function(box) {
      return renderBox(box, text, hasUploaded);
    });

    var boxContent = [];
    if (hasUploaded) {
      boxContent.push(h3('Judgements imported from ROB-MEN'));
    }
    boxContent.push(ul('.list-inline', boxItems));

    sections.push(
      div('#PubbiasBoxes.col-xs-12.well.collapse.in', boxContent)
    );
  }

  return div('.container-fluid', sections);
};

module.exports = pubbiasView;
