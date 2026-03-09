var h = require('virtual-dom/h');
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var createElement = require('virtual-dom/create-element');
var Router = require('./router.js').Router;
// var Messages = require('./messages.js').Messages;


var View = {
  //first render
  init: (model) => {
    View.vtree = h('div.container-fluid');
    View.rootNode = createElement(View.vtree);
    document.body.appendChild(View.rootNode);
  },
  render: (model) => {
    return new Promise((resolve, reject) => {
       Router.render(model).then( ptree => {
         // Flatten ptree to handle routes that return arrays of VNodes
         let flatPtree = _.flatten(ptree);
         
         // Build new vtree
         let nvtree = h('div.container-fluid', flatPtree);
         
         // Diff and patch
         var patches = diff(View.vtree, nvtree);
         patch(View.rootNode, patches);
         
         View.vtree = nvtree;
         Router.afterRender(model);
         resolve();
      });
    });
  },
};

module.exports = {
  View : View
}
