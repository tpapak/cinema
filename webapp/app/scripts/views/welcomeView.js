'use strict';

// welcomeView.js — Welcome page view using hyperscript-helpers
//
// Replaces welcome.hbs Handlebars template.
// Pure function: () => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h1 = hh.h1, h4 = hh.h4, p = hh.p, em = hh.em;
var span = hh.span, button = hh.button, a = hh.a, br = hh.br, small = hh.small;
var strong = hh.strong, i = hh.i, hr = hh.hr;

var welcomeView = () => {
  return div('.container-fluid.routed.welc#welcome', [
    div('.content-welcome', [
      div('.welcome-cont.col-xs-offset-1.col-xs-10.col-md-offset-2.col-md-8', [

        h1({ style: { color: '#2c4d6d', fontWeight: '300', fontSize: '50px' } }, [
          'Welcome to ',
          span('.fontcinema', 'CINeMA'),
          '!',
        ]),

        p([
          em([
            span('.fontcinema', 'CINeMA'),
            ' (Confidence in Network Meta-Analysis) is a web application that simplifies the evaluation of confidence in the findings from network meta-analysis.',
          ]),
        ]),

        p([
          'It is based on a methodological framework described in ',
          a({ href: 'https://doi.org/10.1371/journal.pmed.1003082' }, '[1]'),
          ' which considers six domains: ',
          strong('within-study bias'),
          ', ',
          strong('reporting bias'),
          ', ',
          strong('indirectness'),
          ', ',
          strong('imprecision'),
          ', ',
          strong('heterogeneity'),
          ' and ',
          strong('incoherence'),
          '.',
          br(),
          'Key to the ',
          span('.fontcinema', 'CINeMA'),
          ' methodology is the ',
          strong('contribution matrix'),
          ', which shows how much information each study contributes to the results from network meta-analysis.',
        ]),

        br(),
        h4(['How to cite ', span('.fontcinema', 'CINeMA')]),
        p([
          a({ target: '_blank', href: 'https://doi.org/10.1371/journal.pmed.1003082' }, [
            small([
              '[Nikolakopoulou A, Higgins JPT, Papakonstantinou T, Chaimani A, Del Giovane C, Egger M & Salanti G. ',
              h('b', [em('CINeMA: An approach for assessing confidence in the results of a network meta-analysis')]),
              ' PLOS Medicine ',
              h('b', '2020'),
              ' 17 ',
              em('1-19'),
              ']',
            ]),
          ]),
          br(),
          a({ target: '_blank', href: 'https://doi.org/10.1002/cl2.1080' }, [
            small([
              '[Papakonstantinou T, Nikolakopoulou A, Higgins JPT, Egger M & Salanti G. ',
              h('b', [em('CINeMA: Software for semiautomated assessment of the confidence in the results of network meta-analysis')]),
              ' Campbell Systematic Reviews ',
              h('b', '2020'),
              ' 16 ',
              em('e1080'),
              ']',
            ]),
          ]),
        ]),

        p([hr('.thin')]),
        br(), br(),

        p([
          i('.fa.fa-arrow-right', { attributes: { 'aria-hidden': 'true' } }),
          ' To browse your projects or upload a new one go to ',
        ]),
        button('.addprojectbtn2', {
          type: 'button',
          onclick: function() { Actions.Router.gotoRoute('collections'); },
        }, [
          i('.fa.fa-folder-open', { attributes: { 'aria-hidden': 'true' }, style: { paddingRight: '7px' } }),
          ' PROJECTS ',
        ]),
        br(), br(),

        p([hr('.thin')]),
        h4([
          i('.fa.fa-bug', { attributes: { 'aria-hidden': 'true' }, style: { paddingRight: '5px' } }),
          'Feedback & Bug Reports',
        ]),
        p([
          'If you encounter any issues or have suggestions for improving ',
          span('.fontcinema', 'CINeMA'),
          ', please report them on our GitHub repository:',
          br(),
          a({ target: '_blank', href: 'https://github.com/tpapak/cinema/issues' }, [
            i('.fa.fa-github', { attributes: { 'aria-hidden': 'true' }, style: { paddingRight: '5px' } }),
            'github.com/tpapak/cinema/issues',
          ]),
        ]),
        br(), br(),

      ]),
    ]),
  ]);
};

module.exports = welcomeView;
