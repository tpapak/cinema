var h = require('virtual-dom/h');
var VNode = require('vtree/vnode');
var VText = require('vtree/vtext');
var convertHTML = require('html-to-vdom')({
     VNode: VNode,
     VText: VText
});

var Error = {
  init: () => {},
  render: (model) => {
    var tmpl = GRADE.templates.error(model.getState().text);
    return convertHTML(tmpl);
  }
}

module.exports = () => {
  return Error;
}
