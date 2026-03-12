var h = require('virtual-dom/h');
var VNode = require('vtree/vnode');
var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var welcomeView = require('./views/welcomeView.js');

var Welcome = {
  view: {
    register: (model) => {
      Welcome.model = model;
    },
  },
  init: () => {},
  render: (model) => {
    // var tmpl = GRADE.templates.welcome(model.state.text);
    // return h('div#contentWelcome.row',convertHTML(tmpl));
    return h('div#contentWelcome.row', [welcomeView()]);
  }
}

module.exports = () => {
  return Welcome;
}
