var h = require('virtual-dom/h');
var View = require('./view.js')();
// var VNode = require('vtree/vnode');
// var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var imprecisionView = require('../views/imprecisionView.js');

      //in case you still use handlebars
var resolveGetters = require('../lib/mixins.js').resolveGetters;

      //in case you still use handlebars
var Template = (model,children) => {
  // var tmpl = GRADE.templates.imprecision(_.extend(View(model),{text:model.getState().text.Imprecision}));
  // return convertHTML(tmpl);
  var data = _.extend(resolveGetters(View(model)), { text: model.getState().text.Imprecision });
  return imprecisionView(data);
}

module.exports = () => {
  return Template;
}
