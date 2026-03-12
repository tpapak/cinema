'use strict';

// headerView.js — Header/navigation view using hyperscript-helpers
//
// Replaces header.hbs Handlebars template.
// Pure function: (model, routerView, banner) => VTree

var hh = require('hyperscript-helpers')(require('virtual-dom/h'));
var h = require('virtual-dom/h');
var div = hh.div, h2 = hh.h2, nav = hh.nav, ul = hh.ul, li = hh.li, ol = hh.ol;
var span = hh.span, a = hh.a, img = hh.img, i = hh.i;
var b = hh.b;

// Build a menu item from a route object
// Route objects have: { route, label, info, isAvailable, isActive }
// label/info/isAvailable/isActive are functions (lazy getters from Router.view)
var menuItem = (rt) => {
  var active = typeof rt.isActive === 'function' ? rt.isActive() : rt.isActive;
  var available = typeof rt.isAvailable === 'function' ? rt.isAvailable() : rt.isAvailable;
  var lbl = typeof rt.label === 'function' ? rt.label() : rt.label;
  var classes = (active ? '.active' : '') + (!available ? '.disabled' : '');

  return li(classes, [
    a({
      onclick: function() { Actions.Router.gotoRoute(rt.route); },
      attributes: { action: rt.route },
      className: 'routes navbar-right ' + rt.route,
      href: '#' + rt.route,
      innerHTML: lbl,
    }),
  ]);
};

var headerView = (model, routerView, banner) => {
  // Main menu items
  var mainMenuRoutes = typeof routerView.mainMenu === 'function' ? routerView.mainMenu() : [];
  var mainMenuItems = mainMenuRoutes.map(menuItem);

  // Eval menu items
  var evalMenuRoutes = typeof routerView.evalMenu === 'function' ? routerView.evalMenu() : [];
  var evalMenuItems = evalMenuRoutes.map(menuItem);

  var titleText = typeof routerView.title === 'function' ? routerView.title() : (routerView.title || '--');

  var sections = [];

  // Navbar
  sections.push(
    nav('.navbar.navbar-default', [
      div('.mainMenu-container', [
        // Logo
        div('.cinema-logo', [
          a({
            onclick: function() { Actions.Router.gotoRoute('welcome'); },
            href: '#welcome',
          }, [
            img('.cinema-logo', { src: 'images/logo.svg' }),
          ]),
        ]),
        // Main menu
        div('.docmenu', [
          ul('.nav.navbar-nav.mainMenu', mainMenuItems),
        ]),
      ]),
      // Eval menu
      div('.list_container', [
        ol('.hidden-sm-down.nav.navbar-nav.evaluation-menu', evalMenuItems),
      ]),
    ])
  );

  // Project banner (only when a project is active)
  if (banner && banner.hasProject) {
    var bannerContent = [
      i('.fa.fa-file-text-o', { attributes: { 'aria-hidden': 'true' } }),
      span('.project-banner-title', ' ' + banner.projectTitle),
    ];
    if (banner.format) {
      bannerContent.push(
        span('.project-banner-meta', banner.type + ' \u00B7 ' + banner.format)
      );
    }
    // unsaved indicator removed — auto-saves to collection on every persist
    if (banner.fromCollection) {
      bannerContent.push(
        span('.project-banner-collection', [
          i('.fa.fa-folder-open-o', { attributes: { 'aria-hidden': 'true' } }),
          ' ' + banner.collectionTitle,
        ])
      );
    }
    sections.push(
      div('.project-banner', [
        div('.project-banner-inner', bannerContent),
      ])
    );
  }

  // Print-only header
  sections.push(
    div('.visible-print', [
      h2([
        'Confidence In Network Meta Analysis - CINeMA 2.0.0 - Project: ',
        b(titleText),
      ]),
    ])
  );

  return sections;
};

module.exports = headerView;
