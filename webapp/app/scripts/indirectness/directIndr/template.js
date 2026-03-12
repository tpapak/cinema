var View = require('./view.js')();
var h = require('virtual-dom/h');
// var VNode = require('vtree/vnode');
// var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var indirectnessView = require('../../views/indirectnessView.js');

var resolveGetters = require('../../lib/mixins.js').resolveGetters;

var Template = (model,children) => {
    var data = _.extend(resolveGetters(View(model)), { text: model.getState().text.directIndr });
    var viewNode = indirectnessView(data);
    let tmplchildren = _.map(children, c => {return c.render(model);});
  let content = [h('div#directSelectionWrapper.col-xs-12', [viewNode])].concat(_.flatten(tmplchildren));
  return h('div.row.container-fluid',content);
}

module.exports = () => {
  return Template;
}
