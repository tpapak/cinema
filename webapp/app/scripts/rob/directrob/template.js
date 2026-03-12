var View = require('./view.js')();
var h = require('virtual-dom/h');
// var VNode = require('vtree/vnode');
// var VText = require('vtree/vtext');
// var convertHTML = require('html-to-vdom')({
//      VNode: VNode,
//      VText: VText
// });
var directrobView = require('../../views/directrobView.js');

var resolveGetters = require('../../lib/mixins.js').resolveGetters;

var Template = (model,children) => {
    // Hyperscript-helpers view (replaces Handlebars)
    var data = _.extend(resolveGetters(View(model)), { text: model.getState().text.directRob });
    var viewNode = directrobView(data);
    
    // Children rendering
    let tmplchildren = _.map(children, c => {return c.render(model);});
    
    let result = [h('div#directSelectionWrapper.col-xs-12', [viewNode])].concat(_.flatten(tmplchildren));
    
    return result;
}

module.exports = () => {
  return Template;
}
