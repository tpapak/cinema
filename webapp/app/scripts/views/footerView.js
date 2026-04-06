'use strict';

// footerView.js — Footer view using hyperscript-helpers
//
// Replaces footer.hbs Handlebars template.
// Pure function: (model) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, ul = hh.ul, li = hh.li, span = hh.span;
var a = hh.a, img = hh.img, button = hh.button;

var footerView = (model) => {
  var version = (model && model.state && model.state.version) ? model.state.version : '';

  return div('#myFooter.hidden-print', [
    div('.footer-container', [
      div([
        // ISPM Bern
        div('.col-sm-3', [
          ul([
            li([
              a({ target: '_blank', href: 'https://www.ispm.unibe.ch' }, [
                img('.bern', { src: 'images/bern.png' }),
              ]),
              span('#bern', 'Institute of Social and Preventive Medicine (ISPM)'),
            ]),
          ]),
        ]),
        // Campbell
        div('.col-sm-2', [
          ul([
            li([
              a({ target: '_blank', href: 'https://www.campbellcollaboration.org' }, [
                img('.campbell_logo', { src: 'images/campbell_logo_wide.png' }),
              ]),
            ]),
          ]),
        ]),
        // Cochrane
        div('.col-sm-2', [
          ul([
            li([
              a({ target: '_blank', href: 'http://www.cochrane.org' }, [
                img('.cochrane_logo', { src: 'images/cochrane_logo.png' }),
              ]),
            ]),
          ]),
        ]),
        // AUTH
        div('.col-sm-2', [
          ul([
            li([
              a({ target: '_blank', href: 'https://www.auth.gr/en/' }, [
                img('.auth_logo', { src: 'images/auth_logo.png' }),
              ]),
            ]),
          ]),
        ]),
        // License / disclaimer
        div('.col-sm-3.info', [
          div('.disclaimertext', [
            'CINeMA is distributed, in the hope that it will be useful but without any warranty, under the ',
            a('.license', { href: 'LICENSE' }, [
              img({ src: 'images/agplv3.png' }),
            ]),
            ' license. By using ',
            span('.fontcinema', 'CINeMA'),
            ' you accept the following ',
            a({ href: 'DISCLAIMER' }, 'DISCLAIMER'),
          ]),
        ]),
      ]),
    ]),
    // Second bar
    div('.second-bar', [
      div('.footer-container2', [
        div('.col-sm-3', [
          button({ style: { color: 'black' }, onclick: function() { window.print(); } }, 'print page'),
          span('#prinfo.info.glyphicon.glyphicon-info-sign', {
            attributes: { 'aria-hidden': 'true' },
            onclick: function() {
              Actions.alertify().message('A printer friendly page is rendered which you can also save as .pdf from your browser\'s printing menu');
            },
          }),
        ]),
        div('.col-sm-6', [
          div([
            img('.footer_logo', { src: 'images/footerlogo.svg' }),
            ' Confidence In Network Meta Analysis - ',
            span('.fontcinema', 'CINeMA'),
            ' ' + version,
          ]),
        ]),
        div('.col-sm-3', [
          a({ target: '_blank', href: 'https://github.com/tpapak/cinema/issues',
              style: { color: '#999', fontSize: '12px' } }, [
            'Report issues ',
            span('.fa.fa-github', { attributes: { 'aria-hidden': 'true' } }),
          ]),
        ]),
      ]),
    ]),
  ]);
};

module.exports = footerView;
