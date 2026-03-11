var Config = require('../config.js').config;
var RoB = require('../rob/directrob/directrob.js')();
var Imprecision = require('../imprecision/imprecision.js')();
var Indirectness = require('../indirectness/directIndr/directIndr.js')();
var uniqId = require('../lib/mixins.js').uniqId;
var deepSeek = require('safe-access');
var Messages = require('../messages.js').Messages;
var clone = require('../lib/mixins.js').clone;
var sortComparisonIds = require('../lib/mixins.js').sortComparisonIds;
const json2csv = require('json2csv');
var download = require('downloadjs');
var Heterogeneity = require('../inconsistency/heterogeneity/heterogeneity.js')();
var Incoherence = require('../inconsistency/incoherence/incoherence.js')();
var Pubbias = require('../pubbias/pubbias.js')();
var ClinicalImportance = require('../purescripts/output/ClinImp');
ClinicalImportance.update = require('../purescripts/output/ClinImp.Update');

// ── Backend API helpers ─────────────────────────────────────────────────────
// The backend base URL comes from config.
// In dev: "localhost:8004" → "http://localhost:8004" (direct to Flask)
// In production: "" or "/" → same-origin (nginx proxies /api/ to Flask)
var _apiBase = (function() {
  var url = Config.rserverurl || '';
  // Empty or "/" means same-origin (production behind nginx)
  if (!url || url === '/') { return ''; }
  if (url.indexOf('://') === -1) { url = 'http://' + url; }
  // Strip any trailing OpenCPU path leftover from old config
  url = url.replace(/\/ocpu\/.*$/, '');
  return url.replace(/\/+$/, '');
})();

// Active AbortController + backend job ID for cancellation
var _abortController = null;
var _activeJobId = null;

// POST JSON to the backend, returns parsed JSON.
// Accepts an AbortSignal for cancellation.
var _postAPI = (endpoint, body, signal) => {
  return fetch(_apiBase + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal
  }).then(resp => {
    // Capture job ID from response header (for cancellation)
    var jobId = resp.headers.get('X-Job-Id');
    if (jobId) { _activeJobId = jobId; }
    if (!resp.ok) {
      return resp.json().then(err => {
        throw new Error(err.error || ('HTTP ' + resp.status));
      });
    }
    return resp.json();
  });
};

// Normalize a comparison ID to alphabetical order (A:B where A < B).
// R functions (netsplit, lower.tri, netcontrib) use inconsistent ordering;
// this ensures a single canonical format everywhere.
var _normalizeCompId = (cid) => {
  var parts = cid.split(':');
  if (parts.length !== 2) { return cid; }
  parts.sort();
  return parts[0] + ':' + parts[1];
};

// Generate lower-triangle comparison IDs from treatment names
// (same ordering as R's lower.tri: column-major, but normalized to A:B)
// var _lowerTriIds = (treatnames) => {
//   var ids = [];
//   for (var j = 0; j < treatnames.length; j++) {
//     for (var i = j + 1; i < treatnames.length; i++) {
//       ids.push(treatnames[i] + ':' + treatnames[j]);
//     }
//   }
//   return ids;
// };

// Adapt the new backend response to the legacy hatmatrix shape
// that downstream evaluation domains expect.
var _adaptResponse = (resp) => {
  var treatnames = resp.treatnames;
  if (typeof treatnames === 'string') { treatnames = [treatnames]; }

  // ── NMAresults: array of row objects with legacy field names ──
  var nmaResults = resp.NMAresults || [];
  // NMAresults from new backend is [{TE, seTE, lowerCI, upperCI, lowerPrI, upperPrI, PropDir, _row}, ...]
  // side is [{comparison, Direct, DirectL, DirectU, Indirect, IndirectL, IndirectU, SideIF, SideIFlower, SideIFupper, SideZ, SidePvalue, PropDir}, ...]
  var sideRows = resp.side || [];
  // Normalize side comparison keys for lookup (netsplit uses reversed B:A)
  var sideLookup = {};
  sideRows.forEach(function(sr) { sideLookup[_normalizeCompId(sr.comparison)] = sr; });

  var legacyNMA = nmaResults.map(function(r, idx) {
    // Use the backend's _row field (already alphabetical A:B from cinema_nma.R)
    var compId = r._row ? _normalizeCompId(r._row) : '';
    var sr = sideLookup[compId] || {};
    return {
      '_row': compId,
      'NMA treatment effect': r.TE,
      'se treat effect': r.seTE,
      'lower CI': r.lowerCI,
      'upper CI': r.upperCI,
      'lower PrI': r.lowerPrI,
      'upper PrI': r.upperPrI,
      'PropDirNetmeta': r.PropDir,
      'Direct': sr.Direct,
      'DirectL': sr.DirectL,
      'DirectU': sr.DirectU,
      'Indirect': sr.Indirect,
      'IndirectL': sr.IndirectL,
      'IndirectU': sr.IndirectU,
      'SideIF': sr.SideIF,
      'SideIFlower': sr.SideIFlower,
      'SideIFupper': sr.SideIFupper,
      'SideZ': sr.SideZ,
      'SidePvalue': sr.SidePvalue,
      'PropDir': sr.PropDir
    };
  });

  // ── Pairwise: array of row objects with _row field ──
  var pairwise = (resp.Pairwise || []).map(function(pw) {
    return {
      '_row': _normalizeCompId(pw.comparison),
      'tau2': pw.tau2,
      'I2': pw.I2,
      'I2lower': pw.I2lower,
      'I2upper': pw.I2upper
    };
  });

  // ── NMAheterResults: legacy format is [[heterVarNtw, tau2, Qoverall, Qheter, Qincons]] ──
  var nh = resp.NMAheter || {};
  var nmaHeter = [{
    'heterVarNtw': typeof nh.tau2 === 'number' ? Math.sqrt(nh.tau2) : 0,
    'tau2': nh.tau2 || 0,
    'Q overall': nh.Qoverall || 0,
    'Q heterogeneity': nh.Qheterogeneity || 0,
    'Q inconsistency': nh.Qinconsistency || 0
  }];

  // ── dbt: legacy format is [[Q_dbt, df, pv_dbt]] ──
  var dbtRaw = resp.dbt || [];
  var legacyDbt;
  if (Array.isArray(dbtRaw) && dbtRaw.length > 0) {
    // dbtRaw is [{Q, df, pval}] from the new backend
    var d0 = dbtRaw[0];
    legacyDbt = [[d0.Q || 0, d0.df || 0, d0.pval || 1]];
  } else if (typeof dbtRaw === 'object' && !Array.isArray(dbtRaw)) {
    legacyDbt = [[dbtRaw.Q || 0, dbtRaw.df || 0, dbtRaw.pval || 1]];
  } else {
    legacyDbt = [[0, 0, 1]];
  }

  // ── Hat matrix H ──
  var hData = resp.H || {};
  var H = hData.data || hData || [];

  // ── contribMatrix: the per-comparison contribution matrix ──
  // New backend returns it as a matrix {data, rowNames, colNames}
  // R netcontrib() returns proportions (0–1); legacy code expects percentages (0–100).
  var contribMat = resp.contribMatrix || {};
  var contribData = (contribMat.data || []).map(function(row) {
    return _.mapObject(row, function(v) { return (typeof v === 'number') ? v * 100 : v; });
  });
  // Normalize comparison IDs in contribRowNames to alphabetical A:B,
  // matching hatmatrix.rowNames (also normalized below).
  var contribRowNames = (contribMat.rowNames || resp.rowNames || []).map(_normalizeCompId);
  var contribColNames = contribMat.colNames || resp.colNames || [];

  // ── studyContributions: per-study contributions ──
  // New backend returns [{comparison, study, contribution, ...}, ...]
  // (columns from the netcontrib study data frame)
  // R netcontrib() returns proportions (0–1); scale to percentages (0–100).
  var studyContribs = (resp.studyContributions || []).map(function(sc) {
    return _.extend({}, sc, {
      contribution: (typeof sc.contribution === 'number') ? sc.contribution * 100 : sc.contribution
    });
  });

  // ── forleaguetable ──
  var flt = resp.forleaguetable || {};

  // Normalize hat matrix row/col names to alphabetical A:B so they
  // match contribRowNames, NMAresults._row, and directComparison IDs.
  var hatRowNames = (resp.rowNames || contribRowNames).map(_normalizeCompId);
  var hatColNames = (resp.colNames || contribColNames);

  // Build the legacy hatmatrix object
  return {
    hatmatrix: {
      H: H,
      rowNames: hatRowNames,
      colNames: hatColNames,
      NMAresults: legacyNMA,
      rowNamesNMAresults: _.pluck(legacyNMA, '_row'),
      colNamesNMAresults: ['NMA treatment effect', 'se treat effect',
        'lower CI', 'upper CI', 'lower PrI', 'upper PrI', 'PropDirNetmeta',
        'Direct', 'DirectL', 'DirectU', 'Indirect', 'IndirectL', 'IndirectU',
        'SideIF', 'SideIFlower', 'SideIFupper', 'SideZ', 'SidePvalue', 'PropDir'],
      Pairwise: pairwise,
      rowNamesPairwise: _.pluck(pairwise, '_row'),
      NMAheterResults: nmaHeter,
      dbt: legacyDbt,
      forleaguetable: flt,
      // forstudycontribution not needed — we have studyContributions directly
      model: resp.model,
      sm: resp.sm,
      tau: resp.tau
    },
    // Extracted contribution data for building savedComparisons
    contribMatrix: contribData,
    contribRowNames: contribRowNames,
    contribColNames: contribColNames,
    studyContributions: studyContribs,
    treatnames: treatnames
  };
};

var Update = (model) => {
  let project = deepSeek(model,'getState().project');
  let cm = deepSeek(model,'getState().project.CM');
  let cmc = deepSeek(cm,'currentCM');
  let params = deepSeek(cmc,'params');
  let updaters = {
    setState: (incm) => {
      model.getState().project.CM = incm;
      updaters.saveState();
    },
    setCurrentCM: (k,v) => {
      updaters.getCM()[k]=v;
      updaters.saveState();
    },
    getCM: () => {
      return model.getState().project.CM.currentCM;
    },
    cancelMatrix: () => {
      // console.log('canceling matrix');
      updaters.setCurrentCM('status','canceling');
      // Abort the in-flight fetch request
      if (_abortController) {
        _abortController.abort();
        _abortController = null;
      }
      // Cancel the backend job if we have a job ID
      if (_activeJobId) {
        fetch(_apiBase + '/api/cancel/' + _activeJobId, { method: 'POST' })
          .catch(function() {});
        _activeJobId = null;
      }
      updaters.saveState();
    },
    resetAnalysis: () => {
        updaters.setCurrentCM('status','empty');
        let params = updaters.getCM().params;
        project.CM.currentCM = updaters.emptyCM();
        updaters.setCurrentCM('params',params);
        updaters.saveState();
      // console.log('resetting CONTRIBUTION MATRIXXXXXXXXXXXXXX');
    },
    createMatrix: () => {
      // console.log('creating matrix');
      updaters.setCurrentCM('status','loading');
      updaters.fetchContributionMatrix(cmc).then(ncm => {
        // console.log('matrix loaded ok!!!!!');
        updaters.setCurrentCM('status','ready');
        updaters.updateContributionCache();
        Messages.alertify().success('Ready to proceed!');
      })
      .catch(err => {
        updaters.updateContributionCache();
        let msg = _.isUndefined(err)?'':' '+err;
        Messages.alertify().error(model.getState().text.CM.downloadError + msg);
        updaters.resetAnalysis();
      });
    },
    emptyCM: () => {
      return  {
            hatmatrix:[],
            savedComparisons: [],
            params: {
              MAModel: 'random',
              sm: 'OR',
              intvs: [],
              rule: 'every',
              tau: 0
            },
            allComparisonIds: updaters.computeComparisonIds(),
            status: 'empty', //empty, loading, canceling, ready
            progress: 0,
            currentRow: 'Contribution Matrix',
            colNames: [],
            directRowNames: [],
            indirectRowNames: [],
            selectedComparisons: [],
          };
      // updaters.saveState();
    },
    selectParams: (params) => {
      updaters.setCurrentCM('params',params);
      updaters.saveState();
    },
    compareCM: (cm1, cm2) =>{
      if ((cm1.params.MAModel === cm2.params.MAModel)&&(cm1.params.sm===cm2.params.sm)&&(cm1.params.tau===cm2.params.tau)){
        return true;
        // console.log(cm1,"and",cm2,"are the same");
      }else{
        return false;
      }
    },
    findConMatInCache: (ncm) => {
      let cms = model.getState().project.CM.contributionMatrices;
      let foundCM = _.find(cms, c => {
          return updaters.compareCM(c,ncm);
      });
      // console.log('trying to find ',ncm, 'in ',cms);
      if (_.isUndefined(foundCM)){
        // console.log("found nothing");
        return {};
      }else{
        // console.log("found", foundCM);
        return foundCM;
      }
    },
    computeComparisonIds: () => {
      let directs = deepSeek(model.getState(),'.project.studies.directComparisons');
      let sorted = [];
      if(typeof directs !== 'undefined') {
        let rows = _.union(_.pluck(directs,'id'),
          model.getState().project.studies.indirectComparisons);
        sorted = sortComparisonIds(
          _.map(rows, r => {
            return r.replace(',',':');
          })
        )
      }
      return sorted;
    },
    checkAllIntvs: () => {
      let project = model.getState().project;
      let intvs = _.map(project.studies.nodes, pn => {
        return pn.id;
      });
      model.getState().project.CM.currentCM.params.intvs = intvs;
      updaters.saveState();
    },
    uncheckAllIntvs: () => {
      model.getState().project.CM.currentCM.params.intvs = [];
      updaters.saveState();
    },
    saveState: () => {
      model.saveState();
      updaters.updateChildren(model);
      // console.log("the CM now after saving",model.getState().project.CM);
    },
    updateChildren: (model) => {
      let mdl = model.getState();
      RoB.update.updateState(model);
      Pubbias.update.updateState(model);
      Indirectness.update.updateState(model);
      ClinicalImportance.update.updateState(mdl)(mdl);
    },
    fetchContributionMatrix: (ncm) => {
      // let rserver = Config.rserverurl;
      return new Promise((resolve, reject) => {
        // ocpu.seturl(rserver);
        let cms = model.getState().project.CM.contributionMatrices;
        // var result = {};
        // let ncmparams = params;
        let cm = ncm;
        // console.log('CCCCCCCCTRRRRRRREEEEAAAAATTTIIIIIINNGGGGGGGG MMMMMAAATTTTTRIXXXXX');
        //check if the matrix is in the model;
        let foundCM = updaters.findConMatInCache(cm);
        if(_.isEmpty(foundCM) === false){
          // console.log('found cm',params);
          foundCM.params = params;
          foundCM.status = 'loading';
          model.getState().project.CM.currentCM = clone(foundCM);
          cm = model.getState().project.CM.currentCM;
          updaters.saveState();
        }else{
          // console.log("did'nt find cm",clone(cm)," in cms",cms);
        }
        let rtype = '';
        switch(project.type){
          case 'binary':
          rtype = 'long_binary';
          break;
          case 'continuous':
          rtype = 'long_continuous';
          break;
        }
        if(project.format === 'iv'){
          rtype = 'iv';
        }
        if(_.isEmpty(cm.hatmatrix)){
          let formatData = (tp,studies,exclude) =>{
            let out = {};
            if(tp === 'iv'){
                out = studies.wide;
            }else{
              out = studies.long;
            }
            if(exclude === 'H'){
              out = _.filter(out, 
                //function(s){return(s.rob===1 | s.rob===2)})
                function(s){return(s.rob===1 | s.rob===2)})
            }
            if(exclude === 'MH'){
              out = _.filter(out, 
                function(s){return(s.rob===1)})
            }
              return out;
          }
          // Set up cancellation
          _abortController = new AbortController();
          var signal = _abortController.signal;

          // ── Primary NMA call (all studies) ──
          _postAPI('/api/runNMA', {
            indata: formatData(rtype, project.studies, 'none'),
            type: rtype,
            model: cm.params.MAModel,
            sm: cm.params.sm
          }, signal).then(function(resp) {
            var adapted = _adaptResponse(resp);
            cm.hatmatrix = adapted.hatmatrix;
            // Fetch the league table
            return _postAPI('/api/leaguetable', {
              forleaguetable: adapted.hatmatrix.forleaguetable,
              model: adapted.hatmatrix.model,
              sm: adapted.hatmatrix.sm
            }, signal).then(function(leaguetable) {
              cm.leaguetable = leaguetable;
              updaters.saveState();
              // Extract contribution rows from the adapted response
              return updaters.fetchRows(cm, adapted);
            });
          }).then(function(res) {
            resolve(res);
          }).catch(function(err) {
            if (err && err.name === 'AbortError') {
              reject('Computation canceled');
            } else {
              var errMsg = (err && err.message) ? err.message : String(err);
              console.log('failed hatmatrix', errMsg);
              reject('R returned an error: ' + errMsg);
            }
          });

          // ── Sensitivity analysis: exclude High RoB ──
          _postAPI('/api/runNMA', {
            indata: formatData(rtype, project.studies, 'H'),
            type: rtype,
            model: cm.params.MAModel,
            sm: cm.params.sm
          }).then(function(resp) {
            var adapted = _adaptResponse(resp);
            return _postAPI('/api/leaguetable', {
              forleaguetable: adapted.hatmatrix.forleaguetable,
              model: adapted.hatmatrix.model,
              sm: adapted.hatmatrix.sm
            });
          }).then(function(leaguetable) {
            cm.leaguetableLM = leaguetable;
            updaters.saveState();
          }).catch(function(err) {
            var errMsg = (err && err.message) ? err.message : String(err);
            var msg = 'sensitivity analysis not possible for Low and Medium risk within study bias studies. ';
            msg = msg + 'R returned an error: ' + errMsg;
            Messages.alertify().alert(msg);
            cm.leaguetableLM = {};
          });

          // ── Sensitivity analysis: exclude Medium+High RoB ──
          _postAPI('/api/runNMA', {
            indata: formatData(rtype, project.studies, 'MH'),
            type: rtype,
            model: cm.params.MAModel,
            sm: cm.params.sm
          }).then(function(resp) {
            var adapted = _adaptResponse(resp);
            return _postAPI('/api/leaguetable', {
              forleaguetable: adapted.hatmatrix.forleaguetable,
              model: adapted.hatmatrix.model,
              sm: adapted.hatmatrix.sm
            });
          }).then(function(leaguetable) {
            cm.leaguetableL = leaguetable;
            updaters.saveState();
          }).catch(function(err) {
            var errMsg = (err && err.message) ? err.message : String(err);
            var msg = 'sensitivity analysis not possible for Low risk within study bias studies. ';
            msg = msg + 'R returned an error: ' + errMsg;
            Messages.alertify().alert(msg);
            cm.leaguetableL = {};
          });
        }else{
            console.log('found hatmatrix', cm.hatmatrix);
            updaters.fetchRows(cm, null).then(res => {
              resolve(res);
            }).catch(err => {reject(err)});
       }
      })
    },
    filterRows : (rows,intvs,rule) =>{
      let res = [];
      switch(rule){
        case 'every':
          res = _.filter(rows, r =>{
            let [t1,t2] = r.split(':');
            return (_.contains(intvs,t1)||_.contains(intvs,t2));
          });
          break;
        case 'between':
          res = _.filter(rows, r =>{
            let [t1,t2] = r.split(':');
            return (_.contains(intvs,t1)&&_.contains(intvs,t2));
          });
          break;
      }
      return res;
    },
    // Old fetchRows used sequential ocpu.call('getStudyContribution', ...) per comparison.
    // New version extracts all contributions from the adapted backend response in one shot.
    fetchRows : (cmc, adapted) => {
      let hatmatrix = cmc.hatmatrix;
      let params = cmc.params;
      return new Promise((rslv, rjc) => {
        if (updaters.getCM().status === 'canceling') {
          rjc('Computation canceled');
          return;
        }
        let comparisons = updaters.filterRows(hatmatrix.rowNames, params.intvs, params.rule);
        updaters.getCM().selectedComparisons = comparisons;
        updaters.saveState();

        // If adapted is null, we came from cache (hatmatrix already populated).
        // In that case, savedComparisons should already exist.
        if (adapted) {
          // Build savedComparisons from the adapted contribution data.
          // contribMatrix is the per-comparison contribution matrix (2D array).
          // contribRowNames are the comparison IDs (rows).
          // contribColNames are the study/design column names.
          var contribData = adapted.contribMatrix || [];
          var contribRowNames = adapted.contribRowNames || [];
          var contribColNames = adapted.contribColNames || [];
          var studyContribs = adapted.studyContributions || [];

          // Build study name → ID lookup so studycontributions keys match
          // project.studies.robs keys (which are study IDs like "1", "2", ...).
          // The backend returns study *names* (e.g. "AASK") from R's netcontrib,
          // but robs/indrs are keyed by study *ID* from the CSV id column.
          var studyNameToIdMap = {};
          var longData = project.studies && project.studies.long;
          if (longData) {
            longData.forEach(function(arm) {
              var studyName = arm.study || arm.id;
              var studyId = typeof arm.id === 'string' ? arm.id : String(arm.id);
              if (studyName) {
                studyNameToIdMap[studyName] = studyId;
                // Also add R-normalized version (hyphens/dots/spaces → underscore)
                var normalized = String(studyName).replace(/[-. ]/g, '_');
                studyNameToIdMap[normalized] = studyId;
              }
            });
          }

          // Build a lookup: comparison -> [{study, contribution}, ...]
          // Translate study names to study IDs to match robs/indrs keys.
          // Normalize comparison IDs to alphabetical A:B to match contribRowNames.
          var studyContribLookup = {};
          studyContribs.forEach(function(sc) {
            var comp = _normalizeCompId(sc.comparison);
            if (!studyContribLookup[comp]) { studyContribLookup[comp] = []; }
            // Map study name to ID; fall back to raw name if no mapping found
            var studyKey = studyNameToIdMap[sc.study] || sc.study;
            studyContribLookup[comp].push({
              study: studyKey,
              contribution: sc.contribution
            });
          });

          // Set colNames from the contribution matrix column names.
          // Translate study names to IDs for consistency with robs/indrs.
          var cm = updaters.getCM();
          if (contribColNames.length > 0) {
            cm.colNames = contribColNames.map(function(name) {
              return studyNameToIdMap[name] || name;
            });
          }

          // Build savedComparisons for each comparison row in the contribution matrix
          contribRowNames.forEach(function(rowName, idx) {
            // Check if already saved
            var alreadySaved = _.find(cm.savedComparisons, function(sc) {
              return sc.rowname === rowName;
            });
            if (!alreadySaved) {
              // Per-comparison contributions (the row of the contribution matrix)
              var compContributions = contribData[idx] || [];
              // Per-study contributions for this comparison
              var studyRows = studyContribLookup[rowName] || [];
              var perStudy = updaters.sumStudyContrs(studyRows);
              cm.savedComparisons.push({
                rowname: rowName,
                perstudy: perStudy,
                comparisons: compContributions
              });
            }
          });
          updaters.setCurrentCM('progress', 100);
          updaters.saveState();
        }

        try {
          var result = updaters.formatMatrix(updaters.getCM());
          rslv(result);
        } catch(err) {
          console.warn('caught error in formatMatrix', err);
          rjc(err);
        }
      });
    },
    updateContributionCache: () => {
      let cms = model.getState().project.CM.contributionMatrices;
      let connma = clone(updaters.getCM());
      let ncms = [];
      if (_.isEmpty(cms) === false){
        model.getState().project.CM.contributionMatrices = 
        _.reject(cms, cm => {return updaters.compareCM(cm,connma);});
      }
      model.getState().project.CM.contributionMatrices.push(connma);
      updaters.saveState();
    },
    makeCurrentCM: (incm) =>{
      model.getState().project.CM.currentCM = clone(incm);
      updaters.saveState();
    },
    formatMatrix(ncm){
      let cm = ncm;
      let directs = project.studies.directComparisons;
      let indirects = project.studies.indirectComparisons;
      let cw = cm.colNames.length;
      let rows = _.filter(cm.savedComparisons, sr => {
        return _.contains(cm.selectedComparisons, sr.rowname)
      });
      // Normalize directComparison IDs to sorted comma-separated for matching
      let directIds = _.map(directs, d => { return uniqId(d.id.replace(/:/g,',').split(',')).toString(); });
      let directRows = _.sortBy(
        _.filter(rows, r=>{
          let rConverted = uniqId(r.rowname.replace(/:/g,',').split(',')).toString();
          return _.contains(directIds, rConverted);
        }),
        'rowname'
      );
      // Normalize indirect IDs the same way for matching
      let indirectIds = _.map(indirects, d => { return uniqId(d.replace(/:/g,',').split(',')).toString(); });
      let indirectRows = _.sortBy (
        _.filter(rows, r=>{
          let rConverted = uniqId(r.rowname.replace(/:/g,',').split(',')).toString();
          return _.contains(indirectIds, rConverted);
        }),
        'rowname'
      );
      cm.directRowNames = _.map(directRows,row=>{return row.rowname});
      cm.directStudies = _.map(directRows,row=>{return row.comparisons});
      cm.indirectRowNames = _.map(indirectRows,row=>{return row.rowname});
      cm.indirectStudies = _.map(indirectRows,row=>{return row.comparisons});
      cm.studycontributions = _.reduce(rows, 
        (m,row) => { 
          m[row.rowname] = row.perstudy; 
          return m},{});
      // console.log('[formatMatrix] selectedComparisons:', cm.selectedComparisons.length, 'directRows:', directRows.length, 'indirectRows:', indirectRows.length);
      if(cm.selectedComparisons.length !== (directRows.length+indirectRows.length)){
        // console.log('formatMatrix mismatch debug:');
        // console.log('  selectedComparisons:', cm.selectedComparisons);
        // console.log('  savedComparisons rownames:', _.pluck(cm.savedComparisons, 'rowname'));
        // console.log('  directComparison IDs:', directIds);
        // console.log('  indirectComparison IDs:', indirectIds);
        // console.log('  matched rows:', _.pluck(rows, 'rowname'));
        // console.log('  directRows:', _.pluck(directRows, 'rowname'));
        // console.log('  indirectRows:', _.pluck(indirectRows, 'rowname'));
        // let unmatched = _.filter(rows, r => {
        //   let rConverted = uniqId(r.rowname.replace(/:/g,',').split(',')).toString();
        //   return !_.contains(directIds, rConverted) && !_.contains(indirectIds, rConverted);
        // });
        // console.log('  UNMATCHED rows:', _.pluck(unmatched, 'rowname'));
        throw 'unable to match comparison names';
      }
     return cm;
    },
    showTable: () => {
      if (model.getState().router.currentRoute === 'general'){
        return new Promise((resolve,reject) => {
          let params = updaters.getCM().params;
          let cm = updaters.getCM();
          let cont = document.getElementById('cm-table');
          let cw = cm.colNames.length;
          //Filter rows
          let numDirects = cm.directStudies.length;
          let numIndirects = cm.indirectStudies.length;
          let studies = [];
          let rowNames = [];
          let mergeCells = [];
          mergeCells = mergeCells.concat({row: 0, col: 0, rowspan: 1, colspan: cw});
          if (numDirects !== 0){
            studies = 
            studies.concat([Array(cw).fill()])
              .concat(cm.directStudies);
            rowNames = rowNames.concat(['Mixed <br> estimates'])
              .concat(cm.directRowNames);
          }
          if(numIndirects!==0){
            studies = studies
              .concat([Array(cw).fill()])
              .concat(cm.indirectStudies);
            rowNames = rowNames
              .concat(['Indirect <br> estimates'])
              .concat(cm.indirectRowNames);
            mergeCells = numDirects===0?mergeCells:mergeCells.concat({row: numDirects+1, col: 0, rowspan: 1, colspan: cw});
          }
          let cols = cm.colNames;
          var setBackground = (percentage) => {
            return `
              linear-gradient(
              to right,
              rgba(238,238,238,0.83) `+percentage+`%,
              white `+percentage+`%
            )`;
          };
          function makeBars(instance, td, row, col, prop, value, cellProperties) { Handsontable.renderers.TextRenderer.apply(this, arguments);
            td.style.background = setBackground(value);
          };
          let lastRow = rowNames.length;
          var rendered = false;
          //show only 1 decimal in matrix
          let hotStudies = studies.map( r => {
            return r.map( c => {
              let out = '';
              if (isNaN(c) || c===100){
                out = c;
              }else{
                if(c<0.1){
                  if(c<0.05){
                    out = 0.0;
                  }else{
                    out = 0.1;
                  }
                }else{
                  if(c<1){
                    out = c.toPrecision(1);
                  }else{
                    if(c<10){
                      out = c.toPrecision(2);
                    }else{
                      out = c.toPrecision(3);
                    }
                  }
                }
              }
              return out;
            })
          });
          var hot = new Handsontable(cont, {
            data: hotStudies,
            renderAllRows:true,
            renderAllColumns:true,
            rowHeights: 23,
            columnWidth: 200,
            rowHeaders: rowNames,
            colHeaders: true,
            colHeaders: cols,
            mergeCells: mergeCells,
            manualColumnResize: true,
            strechH: 'all',
            rendered: false,
            width: $('#cm-table-container').width(),
            height: $('#cm-table-container').height(),
            afterRender: () => {
              if(rendered===false){
                rendered=true;
                // $(`.ht_master tr:nth-child('+numDirects+') > td`).style('horizontal-align','middle');
              }
            },
          });
          hot.updateSettings({
            cells: function (row, col, prop) {
              var cellProperties = {};
              cellProperties.renderer = makeBars;
              cellProperties.readOnly = true;
              // if(row===lastRow-1){
                // cellProperties.className = 'htMiddle h5';
              // }
              return cellProperties;
            }
          });
          resolve(hot);
        });
      }
    },
    hideTable: () => {
      $('#cm-table').empty()
    },
    makeDownloader: (res) => {
      return new Promise((resolve,reject) => {
        let cm = res;
        let cw = cm.colNames.length;
        cm.sortedStudies = [];
        if(res.directStudies.length !== 0){
          cm.sortedStudies = 
          cm.sortedStudies.concat([Array(cw).fill()])
          .concat(res.directStudies);
        }
        if(res.indirectStudies.length !== 0){
          cm.sortedStudies = 
          cm.sortedStudies.concat([Array(cw).fill()])
          .concat(res.indirectStudies);
        }
        // .concat(cm.impD);
        cm.sortedRowNames = [];
        if(res.directStudies.length !== 0){
          cm.sortedRowNames =
            cm.sortedRowNames.concat(['Mixed estimates'])
          .concat(cm.directRowNames);
        }
        if(res.indirectStudies.length !== 0){
          cm.sortedRowNames =
          cm.sortedRowNames
          .concat(['Indirect estimates'])
          .concat(cm.indirectRowNames);
        }
        // .concat(['','Entire network']);
        let studies = cm.sortedStudies;
        let cols = cm.colNames;
        let rows = cm.sortedRowNames;
        let fcols = [params.MAModel+' '+params.sm].concat(cols);
        let fstudies = _.map(_.zip(rows, studies), r=>{
          return [r[0]].concat(r[1]);
        });
        fstudies = _.map(fstudies,st=>{return _.object(fcols,st);});
        let csvTable = json2csv.parse(fstudies, {fields: fcols});
        let csvContent = 'data:text/csv;charset=utf-8,'+csvTable;
        var encodedUri = encodeURI(csvContent);
        let cmfilename = (project.title+'_'+cm.params.MAModel+'_'+cm.params.sm+'_perComparisonContribution').replace(/\,/g,'_')+'.csv';
        resolve([encodedUri,cmfilename]);
      });
    },
    makeStudyDownloader: (res) => {
      return new Promise((resolve,reject) => {
        let cm = res;
        let scs = cm.studycontributions;
        let colnames = _.keys(_.values(scs)[0]);
        let cw  = colnames.length;
        cm.sortedStudies = [];
        if(res.directStudies.length !== 0){
          cm.sortedStudies = 
          cm.sortedStudies.concat([Array(cw).fill()])
          .concat(res.directStudies);
        }
        if(res.indirectStudies.length !== 0){
          cm.sortedStudies = 
          cm.sortedStudies.concat([Array(cw).fill()])
          .concat(res.indirectStudies);
        }
        cm.sortedRowNames = [];
        if(res.directStudies.length !== 0){
          cm.sortedRowNames =
            cm.sortedRowNames.concat(['Mixed estimates'])
          .concat(cm.directRowNames);
        }
        if(res.indirectStudies.length !== 0){
          cm.sortedRowNames =
          cm.sortedRowNames
          .concat(['Indirect estimates'])
          .concat(cm.indirectRowNames);
        }
        let studies = _.map(cm.sortedRowNames,
          r => {
            let row = scs[r];
            let res = Array(cw).fill('--');
            if (typeof row !== 'undefined'){
              res = _.values(row);
            }
            return res;
          })
        let cols = colnames;
        let rows = cm.sortedRowNames;
        let fcols = [params.MAModel+' '+params.sm].concat(cols);
        let fstudies = _.map(_.zip(rows, studies), r=>{
          return [r[0]].concat(r[1]);
        });
        fstudies = _.map(fstudies,st=>{return _.object(fcols,st);});
        let csvTable = json2csv.parse(fstudies, {fields: fcols});
        let csvContent = 'data:text/csv;charset=utf-8,'+csvTable;
        var encodedUri = encodeURI(csvContent);
        let cmfilename = (project.title+'_'+cm.params.MAModel+'_'+cm.params.sm+'_perStudyContribution').replace(/\,/g,'_')+'.csv';
        resolve([encodedUri,cmfilename]);
      });
    },
    makeLeagueTableDownloader: (res) => {
      return new Promise((resolve,reject) => {
        let cm = res;
        let league = cm.leaguetable;
        let csvTable = json2csv.parse(league, {header: false});
        let csvContent = 'data:text/csv;charset=utf-8,'+csvTable;
        var encodedUri = encodeURI(csvContent);
        let cmfilename = (project.title+'_'+cm.params.MAModel+'_'+cm.params.sm+'_leaguetable').replace(/\,/g,'_')+'.csv';
        resolve([encodedUri,cmfilename]);
      });
    },
    downloadStudyCSV: () => {
      updaters.makeStudyDownloader(updaters.getCM()).then( zfile => {
        let [blob,filename] = zfile;
        download(blob,filename);
      });
    },
    downloadCSV: () => {
      updaters.makeDownloader(updaters.getCM()).then( zfile => {
        let [blob,filename] = zfile;
        download(blob,filename);
      });
    },
    downloadLeaguetable: () => {
      updaters.makeLeagueTableDownloader(updaters.getCM()).then( zfile => {
        let [blob,filename] = zfile;
        download(blob,filename);
      });
    },
    downloadLeaguetableMH: () => {
      return new Promise((resolve,reject) => {
          let cm = updaters.getCM();
          let league = cm.leaguetableL;
          let csvTable = json2csv.parse(league, {header: false});
          let csvContent = 'data:text/csv;charset=utf-8,'+csvTable;
          var encodedUri = encodeURI(csvContent);
          let filename = (project.title+'_'+cm.params.MAModel+'_'+cm.params.sm+'_leaguetableLowBias').replace(/\,/g,'_')+'.csv';
          download(encodedUri,filename);
      });
    },
    downloadLeaguetableH: () => {
      return new Promise((resolve,reject) => {
          let cm = updaters.getCM();
          let league = cm.leaguetableLM;
          let csvTable = json2csv.parse(league, {header: false});
          let csvContent = 'data:text/csv;charset=utf-8,'+csvTable;
          var encodedUri = encodeURI(csvContent);
          let filename = (project.title+'_'+cm.params.MAModel+'_'+cm.params.sm+'_leaguetableLowMediumBias').replace(/\,/g,'_')+'.csv';
          download(encodedUri,filename);
      });
    },
    // Generate a self-contained R script that runs the NMA offline
    // and produces a .cnm file the user can upload back into CINeMA.
    generateOfflineScript: () => {
      var cm = updaters.getCM();
      var p = model.getState().project;
      var studies = p.studies.long;
      var title = p.title || 'project';
      var rtype = '';
      switch(p.type){
        case 'binary': rtype = 'long_binary'; break;
        case 'continuous': rtype = 'long_continuous'; break;
      }
      if(p.format === 'iv'){ rtype = 'iv'; }
      var maModel = cm.params.MAModel || 'random';
      var sm = cm.params.sm || 'OR';

      // Serialise the study data as an R data.frame constructor
      var rData = '';
      if (rtype === 'long_binary') {
        var cols = { study:[], id:[], t:[], r:[], n:[], rob:[], indirectness:[] };
        studies.forEach(function(s) {
          cols.study.push('"' + ('' + (s.study || s.t || '')).replace(/"/g, '\\"') + '"');
          cols.id.push(s.id);
          cols.t.push('"' + ('' + (s.t || s.treatment || '')).replace(/"/g, '\\"') + '"');
          cols.r.push(s.r != null ? s.r : (s.events != null ? s.events : 0));
          cols.n.push(s.n);
          cols.rob.push(s.rob != null ? s.rob : 1);
          cols.indirectness.push(s.indirectness != null ? s.indirectness : 1);
        });
        rData = 'D <- data.frame(\n' +
          '  study = c(' + cols.study.join(', ') + '),\n' +
          '  id    = c(' + cols.id.join(', ') + '),\n' +
          '  t     = c(' + cols.t.join(', ') + '),\n' +
          '  r     = c(' + cols.r.join(', ') + '),\n' +
          '  n     = c(' + cols.n.join(', ') + '),\n' +
          '  rob   = c(' + cols.rob.join(', ') + '),\n' +
          '  indirectness = c(' + cols.indirectness.join(', ') + '),\n' +
          '  stringsAsFactors = FALSE\n)\n';
      } else if (rtype === 'long_continuous') {
        var cols = { study:[], id:[], t:[], y:[], sd:[], n:[], rob:[], indirectness:[] };
        studies.forEach(function(s) {
          cols.study.push('"' + ('' + (s.study || '')).replace(/"/g, '\\"') + '"');
          cols.id.push(s.id);
          cols.t.push('"' + ('' + (s.t || s.treatment || '')).replace(/"/g, '\\"') + '"');
          cols.y.push(s.y != null ? s.y : (s.mean != null ? s.mean : 0));
          cols.sd.push(s.sd != null ? s.sd : 0);
          cols.n.push(s.n);
          cols.rob.push(s.rob != null ? s.rob : 1);
          cols.indirectness.push(s.indirectness != null ? s.indirectness : 1);
        });
        rData = 'D <- data.frame(\n' +
          '  study = c(' + cols.study.join(', ') + '),\n' +
          '  id    = c(' + cols.id.join(', ') + '),\n' +
          '  t     = c(' + cols.t.join(', ') + '),\n' +
          '  y     = c(' + cols.y.join(', ') + '),\n' +
          '  sd    = c(' + cols.sd.join(', ') + '),\n' +
          '  n     = c(' + cols.n.join(', ') + '),\n' +
          '  rob   = c(' + cols.rob.join(', ') + '),\n' +
          '  indirectness = c(' + cols.indirectness.join(', ') + '),\n' +
          '  stringsAsFactors = FALSE\n)\n';
      } else {
        // iv format
        var cols = { id:[], t1:[], t2:[], effect:[], se:[], rob:[], indirectness:[] };
        var wideData = p.studies.wide || studies;
        wideData.forEach(function(s) {
          // IV study IDs are strings (e.g. "RN335 en", "RN2529/RN6203") — must be quoted
          var idStr = ('' + (s.id || '')).replace(/"/g, '\\"');
          cols.id.push('"' + idStr + '"');
          cols.t1.push('"' + ('' + (s.t1 || '')).replace(/"/g, '\\"') + '"');
          cols.t2.push('"' + ('' + (s.t2 || '')).replace(/"/g, '\\"') + '"');
          cols.effect.push(s.effect != null ? s.effect : 0);
          cols.se.push(s.se != null ? s.se : 0);
          cols.rob.push(s.rob != null ? s.rob : 1);
          cols.indirectness.push(s.indirectness != null ? s.indirectness : 1);
        });
        rData = 'D <- data.frame(\n' +
          '  id     = c(' + cols.id.join(', ') + '),\n' +
          '  t1     = c(' + cols.t1.join(', ') + '),\n' +
          '  t2     = c(' + cols.t2.join(', ') + '),\n' +
          '  effect = c(' + cols.effect.join(', ') + '),\n' +
          '  se     = c(' + cols.se.join(', ') + '),\n' +
          '  rob    = c(' + cols.rob.join(', ') + '),\n' +
          '  indirectness = c(' + cols.indirectness.join(', ') + '),\n' +
          '  stringsAsFactors = FALSE\n)\n';
      }

      // Build the R script
      var script = [
        '#!/usr/bin/env Rscript',
        '# CINeMA Offline NMA Script',
        '# Generated by CINeMA ' + new Date().toISOString(),
        '#',
        '# This script runs the network meta-analysis locally and produces',
        '# a .cnm file you can upload back into CINeMA.',
        '#',
        '# Requirements: R with packages netmeta (>= 3.3), meta, jsonlite',
        '#   install.packages(c("netmeta", "meta", "jsonlite"))',
        '#',
        '# Usage: Rscript ' + title.replace(/[^a-zA-Z0-9_-]/g, '_') + '_cinema_nma.R',
        '',
        'library(netmeta)',
        'library(meta)',
        'library(jsonlite)',
        '',
        'cat("Running CINeMA NMA analysis...\\n")',
        'cat("  Model: ' + maModel + '\\n")',
        'cat("  Effect measure: ' + sm + '\\n")',
        '',
        '# ── Study data ─────────────────────────────────────────────────────',
        '',
        rData,
        'type  <- "' + rtype + '"',
        'model <- "' + maModel + '"',
        'sm    <- "' + sm + '"',
        '',
        '# ── Run NMA ──────────────────────────────────────────────────────',
        '',
        'cat("Running pairwise + netmeta...\\n")',
        '',
        'if (type == "long_binary") {',
        '  Dpairs <- pairwise(treat = t, event = r, n = n,',
        '                     data = D, studlab = id, sm = sm,',
        '                     allstudies = TRUE)',
        '  nma <- netmeta(TE, seTE, treat1, treat2, studlab,',
        '                 data = Dpairs, sm = sm,',
        '                 common = TRUE, random = TRUE)',
        '}',
        '',
        'if (type == "long_continuous") {',
        '  Dpairs <- pairwise(treat = t, mean = y, sd = sd, n = n,',
        '                     data = D, studlab = id, sm = sm)',
        '  nma <- netmeta(TE, seTE, treat1, treat2, studlab,',
        '                 data = Dpairs, sm = sm,',
        '                 common = TRUE, random = TRUE,',
        '                 tol.multiarm = 0.05)',
        '}',
        '',
        'if (type == "iv") {',
        '  nma <- netmeta(effect, se, t1, t2, id,',
        '                 data = D, sm = sm,',
        '                 common = TRUE, random = TRUE,',
        '                 tol.multiarm = 0.05)',
        '}',
        '',
        '# ── Hat matrix ─────────────────────────────────────────────────────',
        '',
        'cat("Computing hat matrix...\\n")',
        'hm <- hatmatrix(nma, method = "Davies", type = "long")',
        'H <- if (model == "fixed") hm$common else hm$random',
        '',
        '# ── Contribution matrix + study contributions ──────────────────────',
        '',
        'cat("Computing contribution matrix (this may take a while for large networks)...\\n")',
        'nc <- netcontrib(nma, method = "shortestpath", study = TRUE)',
        'contribMatrix <- if (model == "fixed") nc$common else nc$random',
        'studyContribs <- if (model == "fixed") nc$study.common else nc$study.random',
        '',
        '# ── Design-by-treatment test ───────────────────────────────────────',
        '',
        'cat("Computing design-by-treatment test...\\n")',
        'dd <- decomp.design(nma)',
        'if (!is.null(dd$Q.decomp)) {',
        '  dbt <- as.data.frame(dd$Q.decomp)',
        '} else if (!is.null(dd$Q.inc.random)) {',
        '  dbt <- as.data.frame(dd$Q.inc.random)',
        '} else {',
        '  dbt <- data.frame(Q = 0, df = 0, pval = 1)',
        '}',
        '',
        '# ── Netsplit (SIDE) ────────────────────────────────────────────────',
        '',
        'cat("Computing netsplit (SIDE test)...\\n")',
        'ss <- netsplit(nma)',
        '',
        'pick <- function(field, subfield) {',
        '  path_new <- paste0(field, ".common")',
        '  path_old <- paste0(field, ".fixed")',
        '  obj <- if (model == "fixed") {',
        '    if (!is.null(ss[[path_new]])) ss[[path_new]] else ss[[path_old]]',
        '  } else {',
        '    ss[[paste0(field, ".random")]]',
        '  }',
        '  if (is.null(obj)) return(rep(NA, length(ss$comparison)))',
        '  obj[[subfield]]',
        '}',
        '',
        'pickProp <- function() {',
        '  if (model == "fixed") {',
        '    if (!is.null(ss$prop.common)) ss$prop.common else ss$prop.fixed',
        '  } else {',
        '    ss$prop.random',
        '  }',
        '}',
        '',
        'side <- data.frame(',
        '  comparison  = ss$comparison,',
        '  Direct      = c(pick("direct",  "TE")),',
        '  DirectL     = c(pick("direct",  "lower")),',
        '  DirectU     = c(pick("direct",  "upper")),',
        '  Indirect    = c(pick("indirect","TE")),',
        '  IndirectL   = c(pick("indirect","lower")),',
        '  IndirectU   = c(pick("indirect","upper")),',
        '  SideIF      = c(pick("compare", "TE")),',
        '  SideIFlower = c(pick("compare", "lower")),',
        '  SideIFupper = c(pick("compare", "upper")),',
        '  SideZ       = c(pick("compare", "z")),',
        '  SidePvalue  = c(pick("compare", "p")),',
        '  PropDir     = c(pickProp()),',
        '  stringsAsFactors = FALSE',
        ')',
        '',
        '# ── NMA treatment effects ──────────────────────────────────────────',
        '',
        'TE_mat <- if (model == "fixed") {',
        '  if (!is.null(nma$TE.common)) nma$TE.common else nma$TE.fixed',
        '} else { nma$TE.random }',
        '',
        'seTE_mat <- if (model == "fixed") {',
        '  if (!is.null(nma$seTE.common)) nma$seTE.common else nma$seTE.fixed',
        '} else { nma$seTE.random }',
        '',
        'lower_mat <- if (model == "fixed") {',
        '  if (!is.null(nma$lower.common)) nma$lower.common else nma$lower.fixed',
        '} else { nma$lower.random }',
        '',
        'upper_mat <- if (model == "fixed") {',
        '  if (!is.null(nma$upper.common)) nma$upper.common else nma$upper.fixed',
        '} else { nma$upper.random }',
        '',
        'propD <- if (model == "fixed") {',
        '  if (!is.null(nma$prop.direct.common)) nma$prop.direct.common',
        '  else nma$prop.direct.fixed',
        '} else { nma$prop.direct.random }',
        '',
        'treatnames <- rownames(TE_mat)',
        'if (is.null(treatnames)) treatnames <- nma$trts',
        'n_treats <- length(treatnames)',
        '',
        'TE.nma   <- -TE_mat[lower.tri(TE_mat)]',
        'seTE.nma <- seTE_mat[lower.tri(seTE_mat)]',
        'LCI.nma  <- -upper_mat[lower.tri(upper_mat)]',
        'UCI.nma  <- -lower_mat[lower.tri(lower_mat)]',
        'PrL.nma  <- -nma$upper.predict[lower.tri(nma$upper.predict)]',
        'PrU.nma  <- -nma$lower.predict[lower.tri(nma$lower.predict)]',
        '',
        '# Build comparison IDs (lower-triangle, column-major)',
        'comp_ids <- character(0)',
        'for (j in seq_len(n_treats)) {',
        '  for (i in seq_len(n_treats)) {',
        '    if (i > j) comp_ids <- c(comp_ids, paste0(treatnames[j], ":", treatnames[i]))',
        '  }',
        '}',
        '',
        '# ── Pairwise heterogeneity ─────────────────────────────────────────',
        '',
        'cat("Computing pairwise heterogeneity...\\n")',
        'if (type == "iv") {',
        '  comp <- paste(D$t1, D$t2, sep = ":")',
        '  pw <- metagen(D$effect, D$se, sm = sm,',
        '                common = (model == "fixed"),',
        '                random = (model == "random"),',
        '                subgroup = comp)',
        '} else {',
        '  comp <- paste(Dpairs$treat1, Dpairs$treat2, sep = ":")',
        '  pw <- metagen(Dpairs$TE, Dpairs$seTE, sm = sm,',
        '                common = (model == "fixed"),',
        '                random = (model == "random"),',
        '                subgroup = comp)',
        '}',
        '',
        '# ── League table ───────────────────────────────────────────────────',
        '',
        'cat("Formatting league table...\\n")',
        '',
        'formatCI_safe <- function(lower, upper) {',
        '  tryCatch(',
        '    meta:::formatCI(lower, upper),',
        '    error = function(e) paste0("(", format(lower), ", ", format(upper), ")")',
        '  )',
        '}',
        'tryCatch(meta:::cilayout(bracket = "(", separator = ", "),',
        '         error = function(e) NULL)',
        '',
        'TE_common    <- if (!is.null(nma$TE.common))    nma$TE.common    else nma$TE.fixed',
        'lower_common <- if (!is.null(nma$lower.common)) nma$lower.common else nma$lower.fixed',
        'upper_common <- if (!is.null(nma$upper.common)) nma$upper.common else nma$upper.fixed',
        '',
        'if (model == "fixed") {',
        '  TE_lt  <- TE_common; low_lt <- lower_common; up_lt <- upper_common',
        '} else {',
        '  TE_lt  <- nma$TE.random; low_lt <- nma$lower.random; up_lt <- nma$upper.random',
        '}',
        '',
        'if (sm %in% c("OR", "RR", "HR")) {',
        '  TE_x <- exp(TE_lt); lower_x <- exp(low_lt); upper_x <- exp(up_lt)',
        '} else {',
        '  TE_x <- TE_lt; lower_x <- low_lt; upper_x <- up_lt',
        '}',
        '',
        'TE_x    <- format(round(TE_x, 3))',
        'lower_x <- round(lower_x, 3)',
        'upper_x <- round(upper_x, 3)',
        'nl <- paste(TE_x, formatCI_safe(lower_x, upper_x))',
        'nl <- matrix(nl, nrow = n_treats, ncol = n_treats)',
        'diag(nl) <- treatnames',
        '',
        '# ── Build .cnm JSON ────────────────────────────────────────────────',
        '',
        'cat("Building .cnm project file...\\n")',
        '',
        '# Convert contribution matrix to list-of-lists',
        'mat_to_lol <- function(m) {',
        '  lapply(seq_len(nrow(m)), function(i) as.numeric(m[i,]))',
        '}',
        '',
        '# Normalize comparison ID to alphabetical order (A:B where A < B)',
        'normalize_comp <- function(cid) {',
        '  parts <- strsplit(cid, ":")[[1]]',
        '  paste(sort(parts), collapse = ":")',
        '}',
        '',
        '# Build study contribution lookup: comparison -> {study: proportion}',
        '# Normalize comparison keys to alphabetical order (A:B where A < B)',
        'sc_list <- list()',
        'for (comp in unique(studyContribs$comparison)) {',
        '  rows <- studyContribs[studyContribs$comparison == comp, ]',
        '  sc_entry <- list()',
        '  for (r in seq_len(nrow(rows))) {',
        '    sc_entry[[as.character(rows$study[r])]] <- rows$contribution[r]',
        '  }',
        '  norm_comp <- normalize_comp(comp)',
        '  sc_list[[norm_comp]] <- sc_entry',
        '}',
        '',
        '# Normalize side comparisons to match comp_ids',
        'side$comp_norm <- sapply(side$comparison, normalize_comp)',
        '',
        '# Build NMA results for v3',
        'nma_results <- lapply(seq_along(comp_ids), function(idx) {',
        '  cid <- comp_ids[idx]',
        '  sr <- side[side$comp_norm == cid, ]',
        '  res <- list(',
        '    comparison = cid,',
        '    effect     = TE.nma[idx],',
        '    se         = seTE.nma[idx],',
        '    ciLower    = LCI.nma[idx],',
        '    ciUpper    = UCI.nma[idx],',
        '    priLower   = PrL.nma[idx],',
        '    priUpper   = PrU.nma[idx],',
        '    propDirect = if (nrow(sr) > 0) sr$PropDir[1] else 0',
        '  )',
        '  if (nrow(sr) > 0 && !is.na(sr$Direct[1])) {',
        '    res$direct <- list(effect=sr$Direct[1], ciLower=sr$DirectL[1], ciUpper=sr$DirectU[1])',
        '  }',
        '  if (nrow(sr) > 0 && !is.na(sr$Indirect[1])) {',
        '    res$indirect <- list(effect=sr$Indirect[1], ciLower=sr$IndirectL[1], ciUpper=sr$IndirectU[1])',
        '  }',
        '  if (nrow(sr) > 0 && !is.na(sr$SideIF[1]) && !is.null(res$direct) && !is.null(res$indirect)) {',
        '    res$incoherence <- list(',
        '      effect=sr$SideIF[1], ciLower=sr$SideIFlower[1], ciUpper=sr$SideIFupper[1],',
        '      z=sr$SideZ[1], pvalue=sr$SidePvalue[1]',
        '    )',
        '  }',
        '  res',
        '})',
        '',
        '# Build v3 dataset from D',
        'v3_studies <- lapply(seq_len(nrow(D)), function(i) {',
        '  row <- as.list(D[i, ])',
        '  if (type == "long_binary") {',
        '    list(study=row$study, id=row$id, treatment=row$t,',
        '         n=row$n, events=row$r, rob=row$rob, indirectness=row$indirectness)',
        '  } else if (type == "long_continuous") {',
        '    list(study=row$study, id=row$id, treatment=row$t,',
        '         n=row$n, mean=row$y, sd=row$sd, rob=row$rob, indirectness=row$indirectness)',
        '  } else {',
        '    list(id=row$id, t1=row$t1, t2=row$t2,',
        '         effect=row$effect, se=row$se, rob=row$rob, indirectness=row$indirectness)',
        '  }',
        '})',
        '',
        '# Build pairwise results for v3',
        'pw_results <- lapply(seq_along(pw$subgroup.levels), function(i) {',
        '  list(',
        '    comparison = normalize_comp(pw$subgroup.levels[i]),',
        '    tau2 = pw$tau.w[i]^2,',
        '    I2 = pw$I2.w[i],',
        '    I2Lower = pw$lower.I2.w[i],',
        '    I2Upper = pw$upper.I2.w[i]',
        '  )',
        '})',
        '',
        '# League table as list of lists',
        'lt_lol <- lapply(seq_len(nrow(nl)), function(i) as.list(nl[i,]))',
        '',
        '# Assemble the .cnm',
        'timestamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S.000Z")',
        '',
        'cnm <- list(cinema = list(',
        '  version = "3.0.0",',
        '  title = "' + title.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",',
        '  createdAt = timestamp,',
        '  updatedAt = timestamp,',
        '  projects = list(list(',
        '    id = paste0("cinema_offline_", as.integer(Sys.time())),',
        '    title = "' + title.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '",',
        '    outcome = "",',
        '    createdAt = timestamp,',
        '    updatedAt = timestamp,',
        '    hasEvaluation = FALSE,',
        '    dataset = list(',
        '      format = "' + (p.format || 'long') + '",',
        '      type = "' + (p.type || 'binary') + '",',
        '      studies = v3_studies',
        '    ),',
        '    analysis = list(',
        '      params = list(model = model, sm = sm, framework = "frequentist"),',
        '      contributionMatrix = list(',
        '        hatMatrix = list(',
        '          H = mat_to_lol(contribMatrix),',
        '          rowNames = rownames(contribMatrix),',
        '          colNames = colnames(contribMatrix)',
        '        ),',
        '        studyContributions = sc_list',
        '      ),',
        '      frequentist = list(',
        '        nmaResults = nma_results,',
        '        pairwise = pw_results,',
        '        networkHeterogeneity = list(',
        '          tau2 = nma$tau^2,',
        '          Qoverall = nma$Q,',
        '          Qheterogeneity = nma$Q.heterogeneity,',
        '          Qinconsistency = nma$Q.inconsistency',
        '        ),',
        '        designByTreatment = list(',
        '          Q = dbt$Q[1], df = dbt$df[1], pvalue = dbt$pval[1]',
        '        ),',
        '        leagueTable = lt_lol',
        '      ),',
        '      bayesian = NULL',
        '    ),',
        '    evaluation = NULL',
        '  ))',
        '))',
        '',
        'outfile <- "' + title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.cnm"',
        'cat("Writing", outfile, "...\\n")',
        'writeLines(toJSON(cnm, auto_unbox = TRUE, null = "null", na = "null",',
        '                  force = TRUE, pretty = TRUE), outfile)',
        'cat("Done! Upload", outfile, "into CINeMA.\\n")',
      ].join('\n');

      var filename = title.replace(/[^a-zA-Z0-9_-]/g, '_') + '_cinema_nma.R';
      var blob = new Blob([script], { type: 'text/plain' });
      download(blob, filename, 'text/plain');
    },
    sumStudyContrs: (contrs) => {
      let scs = _.groupBy(contrs, 'study');
      let result = _.mapObject(scs, 
        (st,k) => {
          let contr = 
            _.reduce(st, function(memo, num)
              { return memo + num.contribution; }, 0); 
          return contr
        });
      return result;
    },
  }
  return updaters;
};

//have to updatechildren manually!
//var children = [
  //RoB,
  //Indirectness,
  ////ClinicalImportance,
  //Pubbias
  //];

module.exports = () => {
  return Update;
}
