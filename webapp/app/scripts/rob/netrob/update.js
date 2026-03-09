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
      if (typeof deepSeek(model 
        ,'getState().project.CM.currentCM.studycontributions')!=='undefined'){
        isready = true;
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
    selectRule: (rule) => {
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
      let boxes = updaters.createEstimates();
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
