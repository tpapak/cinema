var h = require('virtual-dom/h');
var View = require('./view.js')();
var VNode = require('vtree/vnode');
var VText = require('vtree/vtext');
var convertHTML = require('html-to-vdom')({
     VNode: VNode,
     VText: VText
});

      //in case you still use handlebars
var Template = (model,children) => {
  var tmpl = GRADE.templates.imprecision(_.extend(View(model),{text:model.getState().text.Imprecision}));
  return convertHTML(tmpl);
}

module.exports = () => {
  return Template;
}
