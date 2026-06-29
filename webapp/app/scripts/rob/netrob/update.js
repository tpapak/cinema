var deepSeek = require('safe-access');
var clone = require('../../lib/mixins.js').clone;
var uniqId = require('../../lib/mixins.js').uniqId;
var sortStudies = require('../../lib/mixins.js').sortStudies;
var Messages = require('../../messages.js').Messages;
var Report = require('../../purescripts/output/Report');
Report.view = require('../../purescripts/output/Report.View');
Report.update = require('../../purescripts/output/Report.Update');


var children = [
  Report
  ];

var Update = (model) => {
  //update functions will only change state in that node of the model DAG
  let modelPosition = 'project.netRob.studyLimitations';
  let updaters = {
    getState: () => {
      return deepSeek(model,'getState().project.netRob.studyLimitations');
    },
    cmReady: () => {
      let isready = false;
      if (deepSeek(model,'getState().project.CM.currentCM.status')==='ready'){
        isready = true;
        // console.log('contribution matrix ready');
      }
      return isready;
    },
    drobReady: () => {
      let isready = false;
      // if (typeof deepSeek(model 
      //   ,'getState().project.CM.currentCM.studycontributions')!=='undefined'){
      //   isready = true;
      // }
      // Check studycontributions non-empty OR directRowNames available (large projects with stripped contributions)
      var _stcs = deepSeek(model,'getState().project.CM.currentCM.studycontributions');
      if (typeof _stcs !== 'undefined' && _stcs != null && Object.keys(_stcs).length > 0) {
        isready = true;
      } else {
        // For large projects where contributions were stripped, check directRowNames
        var _drn = deepSeek(model,'getState().project.CM.currentCM.directRowNames');
        if (_drn && _drn.length > 0) {
          isready = true;
        }
      }
      return isready;
    },
    updateState: (model) => {
      let mdl = model.getState();
      if (updaters.drobReady()){
        if (deepSeek(updaters,'getState().status') === 'ready'){
        }else{
          updaters.setState(updaters.completeModel());
        }
      }else{
        updaters.setState(updaters.skeletonModel());
      }
      _.map(children, c => {
        c.update.updateState(mdl)(mdl);
      });
    },
    setState: (newState) => {
      if(deepSeek(model,'getState().project.netRob')){
	model.getState().project.netRob.studyLimitations = newState;
	updaters.saveState();
      }else{
      }
    },
    getRule: () => {
      return deepSeek(model.getState(), modelPosition+'.rule');
    },
    selectIndividual: (value) => {
      let [tid,tv] = value.value.split('σδel');
      let boxes = updaters.getState().boxes;
      let tbc = _.find(boxes, m => {
        return m.id === tid;
      });
      let rulevalue = deepSeek(_.find(tbc.rules, r => {return r.id === updaters.getRule()}),'value');
      // console.log('tid tv',tid,tv,'rule',rulevalue);
      if(parseInt(tv) !== rulevalue){
        if((tbc.judgement === 'nothing')||(tbc.judgement === rulevalue)){
          updaters.getState().customized += 1;
        }      
      }else{
        updaters.getState().customized -= 1;
      }
      tbc.judgement = parseInt(tv);
      // Set status to ready directly (no need for intermediate 'selecting' state with separate save)
      updaters.getState().status = 'ready';
      updaters.saveState();
      Messages.alertify().success(model.getState().text.NetRob.LimitationsSet);
    },
    saveState: () => {
      model.saveState();
      let mdl = model.getState();
      // console.log('saving study limitations and Report');
      _.map(children, c => {
        // console.log("report module", mdl);
        c.update.updateState(mdl)(mdl);
      });
    },
    hasContributions: () => {
      var _stcs = deepSeek(model,'getState().project.CM.currentCM.studycontributions');
      return (typeof _stcs !== 'undefined' && _stcs != null && Object.keys(_stcs).length > 0);
    },
    // Unweighted estimates for large projects where studycontributions were stripped.
    // Uses project.studies.directComparisons (which have .studies and .rob arrays)
    // and project.studies.robs for indirect comparisons.
    createEstimatesWithoutContributions: () => {
      let cm = model.getState().project.CM.currentCM;
      let project = deepSeek(model,'getState().project');
      let textRules = deepSeek(model, 'getState().text.NetRob.rules') || {};
      let sll = project.studyLimitationLevels || [];
      let safeLabel = (idx) => {
        let entry = sll[idx];
        return entry ? (entry.label || '') : '';
      };
      // Build lookup: comparison id -> direct comparison object
      let dcLookup = {};
      _.each(project.studies.directComparisons, (dc) => {
        dcLookup[dc.id] = dc;
      });
      // Unweighted rule functions (operate on arrays of rob values)
      let majRuleUnweighted = (robArr) => {
        let counts = _.countBy(robArr);
        let best = _.reduce(_.pairs(counts), (memo, pair) => {
          return parseInt(pair[1]) > memo[1] ? [parseInt(pair[0]), parseInt(pair[1])] : memo;
        }, [0, 0]);
        return best[0];
      };
      let meanRuleUnweighted = (robArr) => {
        if (robArr.length === 0) return 0;
        let sum = _.reduce(robArr, (memo, r) => { return memo + r; }, 0);
        return Math.round(sum / robArr.length);
      };
      let maxRuleUnweighted = (robArr) => {
        return _.reduce(robArr, (memo, r) => { return r > memo ? r : memo; }, 0);
      };
      let makeRulesUnweighted = (rownames, isDirect) => {
        return _.map(sortStudies(rownames, new Array(rownames.length).fill([])), (d) => {
          let compId = d[0];
          let robArr = [];
          if (isDirect) {
            // For direct comparisons, find the dc object and use its rob array
            let dc = dcLookup[compId] || dcLookup[uniqId(compId.split(':'))];
            if (dc) {
              robArr = _.map(dc.rob, (r) => parseInt(r) || 0);
            }
          } else {
            // For indirect comparisons, no direct study data — use studies that
            // contribute to the network estimate. Without the contribution matrix
            // we can't know which studies contribute, so we use all studies' robs
            // and apply maxRule only (safest conservative approach).
            // Actually, for indirect comparisons the contribution matrix IS needed
            // to identify contributing studies. Without it, set robArr to all
            // unique robs from the network as a conservative fallback.
            robArr = [];
          }
          let majVal = majRuleUnweighted(robArr);
          let meanVal = meanRuleUnweighted(robArr);
          let maxVal = maxRuleUnweighted(robArr);
          // For indirect comparisons without contributions, rules are unavailable
          let rulesAvailable = robArr.length > 0;
          return {
            id: compId,
            judgement: 'nothing',
            color: '',
            contributions: {},
            _unweighted: true,
            rules: [{
                id: 'majRule',
                name: textRules.majRule || 'Majority RoB',
                label: rulesAvailable ? safeLabel(majVal - 1) : 'N/A',
                value: rulesAvailable ? majVal : 0,
                isActive: false
              },
              {
                id: 'meanRule',
                name: textRules.meanRule || 'Average RoB',
                label: rulesAvailable ? safeLabel(meanVal - 1) : 'N/A',
                value: rulesAvailable ? meanVal : 0,
                isActive: false
              },
              {
                id: 'maxRule',
                name: textRules.maxRule || 'Highest RoB',
                label: rulesAvailable ? safeLabel(maxVal - 1) : 'N/A',
                value: rulesAvailable ? maxVal : 0,
                isActive: false
            }],
          };
        });
      };
      let mixed = makeRulesUnweighted(cm.directRowNames, true);
      _.map(mixed, m => { m.isMixed = true; });
      let indirect = makeRulesUnweighted(cm.indirectRowNames, false);
      _.map(indirect, i => { i.isMixed = false; });
      return _.union(mixed, indirect);
    },
    createEstimates: () => {
      let cm = model.getState().project.CM.currentCM;
      let directRobs = _.object(_.map(model.getState().project.studies.directComparisons,
        dc => {
          let colname = _.find(cm.colNames,cname => {
            let cid = uniqId([dc.t1.toString(),dc.t2.toString()]);
            let cnid = uniqId(cname.split(':'));
            return _.isEqual(cid,cnid);
          });
          return [colname,dc.directRob];
      }));
      let groupContributions = (contributions) => {
        let res =  _.groupBy(_.toArray(contributions),'rob');
        res = _.map(res, r => {
          return {
            rob: r[0].rob,
            percentage: _.reduce(_.pluck(r,'amount'), function(memo, num){ return memo + num; }, 0),
          };
        });
        return res;
      };
      let majRule = (contributions) => {
        let res = groupContributions(contributions);
        res = _.reduce(res, (memo, r) => {
          let per = r.percentage;
          if(per > memo[1]){
            return [r.rob,r.percentage];
          }else{
            return memo;
          }
        },[0,0]);
        return {rob:res[0],percentage:res[1]};
      };
      let meanRule = (contributions) => {
        let res = groupContributions(contributions);
        res = _.reduce(res, (memo,r) => {
          return memo + (r.rob * r.percentage / 100);
        },0);
        // console.log(res,Math.round(res),'res');
        return Math.round(res);
      };
      let maxRule = (contributions) => {
        let res = groupContributions(contributions);
        res = _.reduce(res, (memo, r) => {
          if (r.rob > memo){
            return r.rob;
          }else{
            // fix: was missing return statement
            return memo;
          }
        },0);
        return res;
      };
      let makeRules = (rownames,colnames,studies) => {
        let project =  deepSeek(model,'getState().project');
        let textRules = deepSeek(model, 'getState().text.NetRob.rules') || {};
        return _.map(sortStudies(rownames,studies), d => {
        let stcs = deepSeek(project,'CM.currentCM.studycontributions');
        let key = _.find(_.keys(stcs), k => {
              let aresame = (
                ( (k.split(':')[0]===d[0].split(':')[0]) &&
                (k.split(':')[1]===d[0].split(':')[1])) || 
                ( (k.split(':')[1]===d[0].split(':')[0]) &&
                (k.split(':')[0]===d[0].split(':')[1]))
              );
              return aresame});
          let contributions = stcs[key];
          contributions = _.mapObject(contributions, (amount,id) => {
            return {
              rob: project.studies.robs[id],
              amount
            }
          });
          let majVal = majRule(contributions);
          let meanVal = meanRule(contributions);
          let maxVal = maxRule(contributions);
          let sll = project.studyLimitationLevels || [];
          let safeLabel = (idx) => {
            let entry = sll[idx];
            return entry ? (entry.label || '') : '';
          };
          return {
            id: d[0],
            judgement: 'nothing',
            color: '',
            contributions,
            rules: [{ 
                id: 'majRule',
                name: textRules.majRule || 'Majority RoB', 
                label: safeLabel(majVal.rob - 1),
                value: majVal.rob,
                isActive : false
              },
              { id: 'meanRule',
                name: textRules.meanRule || 'Average RoB', 
                label: safeLabel(meanVal - 1),
                value: meanVal,
                isActive : false
              },
              { id: 'maxRule',
                name: textRules.maxRule || 'Highest RoB', 
                label: safeLabel(maxVal - 1),
                value: maxVal,
                isActive : false
            }],
          }
        })
      };
      let mixed = makeRules(cm.directRowNames,cm.colNames,cm.directStudies);
      _.map(mixed, m => { m.isMixed = true } );
      let indirect = makeRules(cm.indirectRowNames,cm.colNames,cm.indirectStudies);
      _.map(indirect, i => { i.isMixed = false } );
      return _.union(mixed,indirect);
    },
    completeModel: () => {
      let boxes = updaters.hasContributions()
        ? updaters.createEstimates()
        : updaters.createEstimatesWithoutContributions();
      // console.log('boxes',boxes);
      return { 
        status: 'noRule',// noRule, editing, ready
        rule: 'noRule', // noRule, majRule, meanRule, maxRule
        customized: 0,
        boxes,
      }
    },
    skeletonModel: () => {
      return { 
        status: 'not-ready',// noRule, editing, ready
        rule: 'noRule', // noRule, majRule, meanRule, maxRule
        customized: 0,
        boxes: [],
      }
    },
    selectRule: (rule) => {
      let nrstate = updaters.getState();
      nrstate.rule = rule.value;
      nrstate.status = 'ready';
      let boxes = updaters.getState().boxes; 
      _.map(boxes, m => {
        m.judgement = _.find(m.rules,mr =>{return mr.id===rule.value}).value;
      });
      updaters.saveState();
      Messages.alertify().success(model.getState().text.NetRob.LimitationsSet);
    },
    resetNetRob: () => {
      updaters.setState(updaters.completeModel());
    },
  }
  return updaters;
};


module.exports = () => {
  return Update;
}
