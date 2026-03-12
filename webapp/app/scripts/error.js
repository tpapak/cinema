var h = require('virtual-dom/h');
// var VNode = require('vtree/vnode');
// var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var errorView = require('./views/errorView.js');

var Error = {
  init: () => {},
  render: (model) => {
    // var tmpl = GRADE.templates.error(model.getState().text);
    // return convertHTML(tmpl);
    return errorView(model.getState().text);
  }
}

module.exports = () => {
  return Error;
}
