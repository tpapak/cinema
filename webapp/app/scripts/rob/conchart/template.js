var h = require('virtual-dom/h');
var View = require('./view.js')();
// var VNode = require('vtree/vnode');
// var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var conchartView = require('../../views/conchartView.js');

var Template = (model,children) => {
  // let view = View(model);
  //   var tmpl = GRADE.templates.conchart(
  //    _.extend(View(model),{ text:model.getState().text.ConChart})
  //   );
  // return h('div#conChartContainer.col-md-offset-2.col-md-8.col-xs-12',convertHTML(tmpl));
  var data = _.extend(View(model), { text: model.getState().text.ConChart });
  return h('div#conChartContainer.col-md-offset-2.col-md-8.col-xs-12', conchartView(data));
}

module.exports = () => {
  return Template;
}
