var View = require('./view.js')();
var h = require('virtual-dom/h');
// var VNode = require('vtree/vnode');
// var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var netrobView = require('../../views/netrobView.js');

var resolveGetters = require('../../lib/mixins.js').resolveGetters;

var Template = (model,children) => {
    // var tmpl = GRADE.templates.netrob(
    //   _.extend(View(model),{text:model.getState().text.NetRob})
    // );
    // return h('div#directRob.col-xs-12',convertHTML(tmpl));
    var data = _.extend(resolveGetters(View(model)), { text: model.getState().text.NetRob });
    return h('div#directRob.col-xs-12', netrobView(data));
}

module.exports = () => {
  return Template;
}
