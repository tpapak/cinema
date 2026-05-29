var Locales = require('./translations.json');
var View = require('./view.js').View;
var clone = require('./lib/mixins.js').clone;
var accumulate = require('./lib/mixins.js').accumulate;
var sumBy = require('./lib/mixins.js').sumBy;
var Router = require('./router.js').Router;
var Project = require('./project.js')();
var Messages = require('./messages.js');
var download = require('downloadjs');
const json2csv = require('json2csv');

var Model = {
  // Hardcoded source of truth for the app/compat version. Kept in step with
  // webapp/package.json (gulp uses that one only for asset cache-busting).
  // Used to gate which saved projects can be loaded — see checkSavedProject.
  VERSION: '3.0.1',
  Actions:
  { alertify: Messages.Messages.alertify
  , download: download
  , json2csv: json2csv
  },
  defaults: {
    robLevels: [
      { id: 1,
        color: '#02c000'
      },
      { id: 2,
        color: '#e0df02'
      },
      { id: 3,
        color: '#c00000'
    }],
    studyLimitationLevels: [
      { id: 1,
        color: '#02c000'
      },
      { id: 2,
        color: '#e0df02'
      },
      { id: 3,
        color: '#c00000'
      }],
    indrLevels: [
      { id: 1,
        color: '#02c000'
      },
      { id: 2,
        color: '#e0df02'
      },
      { id: 3,
        color: '#c00000'
    }],
    netIndrLevels: [
      { id: 1,
        color: '#02c000'
      },
      { id: 2,
        color: '#e0df02'
      },
      { id: 3,
        color: '#c00000'
    }],
    pubbiasLevels: [
      { id: 1,
        color: '#02c000'
      },
      { id: 2,
        color: '#e0df02'
      },
      { id: 3,
        color: '#c00000'
    }],
    locale: 'EN',
  },
  setState: (state) => {
    Model.state = state;
    _.map(Model.children, c => {
      c.update.updateState(Model);
    });
    Model.saveState();
  },
  persistToLocalStorage: () => {
    // Auto-save active project back to collection before persisting
    if (typeof Model.Actions !== 'undefined' &&
        typeof Model.Actions.ProjectManager !== 'undefined' &&
        typeof Model.Actions.ProjectManager.addCurrentProjectToCollection === 'function') {
      Model.Actions.ProjectManager.addCurrentProjectToCollection();
    }
    // Serialize first, then clear+write.  If serialization or setItem
    // fails (e.g. QuotaExceededError), the old cached state is preserved.
    try {
      var serialized = JSON.stringify(Model.getState());
      localStorage.clear();
      localStorage.setItem('state', serialized);
      console.log('saved to localstorage');
    } catch (e) {
        //data wasn't successfully saved due to quota exceed so throw an error
        console.log('Quota exceeded!',e);
    }
  },
  _renderPending: false,
  saveState: () => {
    // Lazy: defer render to next microtask so all synchronous state
    // mutations complete before a single render fires.
    if (!Model._renderPending) {
      Model._renderPending = true;
      Promise.resolve().then(() => {
        Model._renderPending = false;
        let wt = document.documentElement.scrollTop || document.body.scrollTop;
        Model.state.wt = wt;
        View.render(Model).then(
          out =>{
            window.scrollTo(0,Model.state.wt);
            }
        ).catch(err =>{
          $('#errormsg').text(err);
        });
      });
    }
  },
  factorySettings: () => {
    let v = Model.getState().version;
    Model.setState(Model.skeletonModel(v));
  },
  getState: () => {
    return Model.state;
  },
  makeNodes: (type, model) => {
    var grouped = _.groupBy(model, tr => {return tr.t});
    var verticeFromGroup = (group) =>{
      var vertex = {id:'', name:'', numStudies:0, sampleSize:0, rSum:0};
      vertex.type='node';
      vertex.id = group[0].t;
      vertex.name = group[0].tn;
      vertex.label = _.isEmpty(group[0]['tn'])?group[0]['t']:group[0]['tn'];
      vertex.studies = accumulate(group,'id');
      vertex.numStudies = group.length;
      if(type!=='iv'){
        vertex.sampleSize = sumBy(group,'n');
      }
      //vertex.rSum = _.reduce(group, function (memo, row){ return memo + row.r},0);
      vertex.rob = accumulate(group,'rob');
      vertex.low = _.filter(vertex.rob, r => {return r===1}).length/vertex.numStudies*100;
      vertex.unclear = _.filter(vertex.rob, r => {return r===2}).length/vertex.numStudies*100;
      vertex.high = _.filter(vertex.rob, r => {return r===3}).length/vertex.numStudies*100;
      vertex.indirectness = accumulate(group,'indirectness');
      vertex.indrlow = _.filter(vertex.indirectness, r => {return r===1}).length/vertex.numStudies*100;
      vertex.indrunclear = _.filter(vertex.indirectness, r => {return r===2}).length/vertex.numStudies*100;
      vertex.indrhigh = _.filter(vertex.indirectness, r => {return r===3}).length/vertex.numStudies*100;
      return vertex;
    };
    let res = _.map(_.toArray(grouped), (grp) => verticeFromGroup(grp));
    return res;
  },
  selectRobs: (sels) => {
    let prj = Model.getState().project;
    _.map(prj.model.directComparisons, c => {
      c.selectedrob = sels[c.id];
    });
    prj.hasSelectedRob = true;
    Model.saveState();
    // View.updateSelections();
  },
  unselectRobs: () => {
    let prj = Model.getState().project;
    _.map(prj.model.directComparisons, c => {
      c.selectedrob = '';
    });
    prj.hasSelectedRob = false;
    Model.saveState();
    // View.updateSelections();
  },
  loadCachedModel: () => {
    let savedModel = JSON.parse(localStorage.state);
    Model.setState(Model.sanitizeLoadedProject(savedModel));
  },
  versionsAreCompatible: (v1,v2) => {
    return v1.split('.').slice(0,2).toString() === v2.split('.').slice(0,2).toString();
  },
  // Parse "3.0.1" -> [3, 0, 1]; missing/garbage parts become 0 so an old file
  // with a partial or absent version still compares sanely instead of throwing.
  parseVersion: (v) => {
    return String(v || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  },
  // True only when `v` is strictly newer (major, then minor) than this build.
  // Older or equal files are accepted and sanitized on load (backward compat);
  // a newer file may use schema this build can't understand, so it's refused.
  isNewerThanCurrent: (v) => {
    let [fMajor, fMinor] = Model.parseVersion(v);
    let [cMajor, cMinor] = Model.parseVersion(Model.VERSION);
    if (fMajor !== cMajor) return fMajor > cMajor;
    return fMinor > cMinor;
  },
  // Bring a project loaded from a .cnm file or localStorage up to the current
  // schema so older files keep opening. UI translations and defaults live in
  // the running bundle, not in the saved file — an older dump can carry a stale
  // `text`/`defaults` that overwrites the active ones and crashes rendering.
  // Reset those from the current bundle and stamp the current version.
  sanitizeLoadedProject: (state) => {
    let locale = (state.defaults && Locales[state.defaults.locale])
      ? state.defaults.locale
      : Model.defaults.locale;
    state.text = Locales[locale];
    // Backfill any defaults added since the file was saved (additive only;
    // values present in the saved file win).
    state.defaults = _.defaults({}, state.defaults || {}, Model.defaults);
    state.version = Model.VERSION;
    return state;
  },
  checkSavedProject: (state) => {
    return new Promise((resolve,reject) => {
      let cinv = Model.VERSION;
      if (!state || typeof state !== 'object') {
        reject('Unfortunately cannot upload, the file is not a valid CINeMA project.');
        return;
      }
      if (Model.isNewerThanCurrent(state.version)) {
        reject('Unfortunately cannot upload, the file\'s version ('+state.version+') was created by a newer CINeMA than this one (v:'+cinv+'). Please update CINeMA.');
        return;
      }
      // Older or same version: accepted, then sanitized in loadSavedProject.
      resolve(state);
    })
  },
  loadSavedProject: (state) => {
    Model.setState(Model.sanitizeLoadedProject(state));
  },
  initializeModel: (version) => {
    Model.setState(Model.skeletonModel(version));
  },
  clearCachedModel: () => {
    localStorage.clear();
  },
  cachedModel: () =>{
    let out = 'Maybe state';
    if (typeof localStorage.state === 'undefined'){
      out = 'Nothing'
    }else{
      out = JSON.parse(localStorage.state);
    }
    return out;
  },
  // checkCachedModel: (version) => {
  //   let savedModel = Model.cachedModel();
  //   if (savedModel === 'Nothing'){
  //     Model.clearCachedModel();
  //   }else{
  //     if ((typeof savedModel.version !== 'undefined') && Model.versionsAreCompatible(version,savedModel.version)){
  //       // comply with EU cookie law
  //       if(Model.hasExpired(savedModel.timestamp)){
  //         Model.clearCachedModel();
  //       }else{
  //         console.log('cachedStorage ok');
  //       }
  //     }else{
  //       Model.clearCachedModel();
  //     }
  //   }
  // },
  init: (version) => {
    version = version || Model.VERSION;
    Router.register(Model);
    View.init(Model);
    // Auto-restore from localStorage if valid cached state exists. Older caches
    // are restored and sanitized (backward compat); only a cache from a newer
    // CINeMA, or an expired one, is discarded.
    let savedModel = Model.cachedModel();
    if (savedModel !== 'Nothing' &&
        typeof savedModel.version !== 'undefined' &&
        !Model.isNewerThanCurrent(savedModel.version) &&
        !Model.hasExpired(savedModel.timestamp)) {
      console.log('Restoring cached state from localStorage');
      Model.setState(Model.sanitizeLoadedProject(savedModel));
    } else {
      if (savedModel !== 'Nothing') {
        // Incompatible or expired — clear stale cache
        Model.clearCachedModel();
      }
      Model.initializeModel(version);
    }
  },
  hasExpired: (date) => {
    let current = new Date();
    let modelDate = Date(date);
    //one year expiration period  is set for cached projects
    let timeDiff = Math.abs(Date.parse(date) - current.getTime())/ 1000 / 60 / 60 / 24 / 365;
    let res = false;
    if (timeDiff > 1) {
      res = true;
    }
    return res;
  },
  skeletonModel: (version) => {
    let timestamp = new Date()
    return {
      version: version,
      text: Locales[Model.defaults.locale],
      defaults: Model.defaults,
      timestamp
    }
  },
  children: [
    Router,
    Project,
  ],
};

module.exports = {
  Model: Model,
};
