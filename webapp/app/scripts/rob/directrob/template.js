var View = require('./view.js')();
var h = require('virtual-dom/h');
var VNode = require('vtree/vnode');
var VText = require('vtree/vtext');
var convertHTML = require('html-to-vdom')({
     VNode: VNode,
     VText: VText
});

var Template = (model,children) => {
    // Handlebars template
    var tmpl = GRADE.templates.directrob(
      _.extend(View(model),{text:model.getState().text.directRob})
    );
    
    // html-to-vdom conversion
    let converted = convertHTML(tmpl);
    
    // Children rendering
    let tmplchildren = _.map(children, c => {return c.render(model);});
    
    let result = [h('div#directSelectionWrapper.col-xs-12', converted)].concat(_.flatten(tmplchildren));
    
    return result;
}

module.exports = () => {
  return Template;
}
