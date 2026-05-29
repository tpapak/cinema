var Model = require('./model.js').Model;

// Version is hardcoded in the model (Model.VERSION) as the app/compat source of
// truth, rather than read from the build-injected config.
Model.init(Model.VERSION);
window.Actions = Model.Actions;
//Need it for passing the model to purescript actions
window.Model = {};
window.Model.state = Model.getState();
window.Model.getState = Model.getState;

window.Model.saveState = Model.saveState;
window.Model.persistToLocalStorage = Model.persistToLocalStorage;

// Expose setState and loadSavedProject for testing
window.Model.setState = Model.setState;
window.Model.loadSavedProject = Model.loadSavedProject;
window.Model.checkSavedProject = Model.checkSavedProject;

module.export = () => {
  return Model;
}
