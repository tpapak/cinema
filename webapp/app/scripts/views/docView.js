'use strict';

// docView.js — Documentation page view using hyperscript-helpers
//
// Replaces doc.hbs Handlebars template.
// Pure function: () => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, p = hh.p, a = hh.a, br = hh.br, em = hh.em;
var strong = hh.strong, h4 = hh.h4, span = hh.span, small = hh.small;

var docView = () => {
  return div('.container-fluid.routed#docPage', [
    div('.doc-cont.col-md-offset-1.col-md-10', [
      br(),
      p([
        strong([
          'The detailed manual of CINeMA is available in the following publication',
          br(),
        ]),
        a({ target: '_blank', href: 'https://doi.org/10.1002/cl2.1080' }, [
          '[Papakonstantinou et al. ',
          h('b', [em('CINeMA: Software for semiautomated assessment of the confidence in the results of network meta-analysis')]),
          ' Campbell Systematic Reviews ',
          h('b', '2020'),
          ' 16 ',
          em('e1080'),
          ']',
        ]),
      ]),
      br(),
      p([
        'CINeMA\'s methodology is described in ',
        a({ target: '_blank', href: 'https://doi.org/10.1371/journal.pmed.1003082' }, [
          '[Nikolakopoulou A, Higgins JPT, Papakonstantinou T, Chaimani A, Del Giovane C, Egger M & Salanti G. ',
          h('b', [em('CINeMA: An approach for assessing confidence in the results of a network meta-analysis')]),
          ' PLOS Medicine ',
          h('b', '2020'),
          ' 17 ',
          em('1-19'),
          ']',
        ]),
      ]),
      p([
        'A demo dataset can be downloaded ',
        a({ href: 'model/Elliott_2007.csv', download: 'diabetes.csv' }, 'here'),
        '. It is a network of six antihypertensive drugs studying the incidence of diabetes by Elliot et.al',
      ]),
      br(),
      a({ target: '_blank', href: 'https://www.ncbi.nlm.nih.gov/pubmed/17240286' },
        'W. J. Elliott and P. M. Meyer. The Lancet, 369(9557):201 \u2013 207, 2007'),
      p([
        h4(),
        'CINeMA uses the ',
        span({ style: { fontFamily: 'monospace' } }, 'netmeta'),
        ' R-package for performing Network meta-analysis of the data.',
        br(),
        ' G. R\u00FCcker, G. Schwarzer, U. Krahn, and J. K\u00F6nig. ',
        span({ style: { fontFamily: 'monospace' } }, 'netmeta'),
        ': ',
        em('Network Meta-Analysis using Frequentist Methods'),
        ', 2017. R package version 0.9-5. ',
        a({ href: 'https://CRAN.R-project.org/package=netmeta', target: '_blank' },
          'https://CRAN.R-project.org/package=netmeta'),
      ]),
      p([
        h4('Source code'),
        'The source code is available in the following github repository ',
        a({ href: 'https://github.com/tpapak/cinema' }, 'CINeMA'),
      ]),
    ]),
  ]);
};

module.exports = docView;
