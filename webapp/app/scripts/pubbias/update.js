var deepSeek = require('safe-access');
var clone = require('../lib/mixins.js').clone;
var uniqId = require('../lib/mixins.js').uniqId;
var sortStudies = require('../lib/mixins.js').sortStudies;
var Messages = require('../messages.js').Messages;
var Report = require('../purescripts/output/Report');
var Rules = require('../purescripts/output/Imprecision.Rules');
Report.view = require('../purescripts/output/Report.View');
Report.update = require('../purescripts/output/Report.Update');
var ComparisonModel = require('../purescripts/output/ComparisonModel');

var children = [
  Report
  ];

var Update = (model) => {
  let modelPosition = 'project.pubbias';
  let PubbiasLevels = model.getState().defaults.pubbiasLevels;
  let updaters = {
    getState: () => {
      return deepSeek(model.getState(),modelPosition);
    },
    cmReady: () => {
      let isready = false;
      if (deepSeek(model,'getState().project.CM.currentCM.status')==='ready'){
        isready = true;
      }
      return isready;
    },
    pubbiasReady: () => {
      return (deepSeek(model,'getState().project.pubbias.status')==='ready');
    },
    allDetected: () => {
      _.map(updaters.getState().boxes,b=>{
        b.judgement = 2;
      });
      updaters.getState().status = 'ready';
      updaters.saveState();
    },
    allUndetected: () => {
      updaters.getState().status = 'ready';
      updaters.saveState();
    },
    updateState: (model) => {
      let mdl = model.getState();
      if (updaters.cmReady()) {
        if (updaters.pubbiasReady()){
        }else{
          updaters.setState(updaters.skeletonModel());
        }
      }else{
        model.getState().project.pubbias = {};
        updaters.setState(updaters.skeletonModel());
      }
      _.map(children, c => {
        c.update.updateState(mdl)(mdl);
      });
    },
    setState: (newState) => {
      model.getState().project.pubbias = newState;
      updaters.saveState();
    },
    saveState: () => {
      model.saveState();
      let mdl = model.getState();
      _.map(children, c => { c.update.updateState(mdl)(mdl);});
    },
    createEstimators: () => {
      let cm = model.getState().project.CM.currentCM;
      let NMAs = model.getState().project.CM.currentCM.hatmatrix.NMAresults;
      let makeBoxes = (studies) => {
        let res = _.map(studies, s => {
          let nmaRow = _.find(NMAs, nma => {
            return _.isEqual(uniqId(nma["_row"].split(':')),uniqId(s[0].split(':')));
          });
          let contents = {}
            contents =  {
                id: nmaRow["_row"],
            }
          if(_.isUndefined(nmaRow["Direct"])){
            if(_.isUndefined(nmaRow["Indirect"])){
              console.log("ERRROORRR indirect direct in Incohrence");
            }else{
              _.extend(contents,{
                  isMixed: false,
                  isDirect: false,
                  isIndirect: true,
              })
            }
          }else{
            if(_.isUndefined(nmaRow["Indirect"])){
              _.extend(contents,{
                  isMixed: false,
                  isDirect: true,
                  isIndirect: false,
              })
            }else{
              _.extend(contents,{
                  isMixed: true,
                  isDirect: false,
                  isIndirect: false,
              })
            }
          }
          contents.levels = deepSeek(model,'getState().project.pubbias.levels');
          contents.judgement = 1;
          return contents;
        });
        return res;
      };
      let mixed = makeBoxes(
        sortStudies(cm.directRowNames,cm.directStudies));
      let indirect = makeBoxes(sortStudies(cm.indirectRowNames,cm.indirectStudies));
      return _.union(mixed,indirect);
    },
    resetBoxes: () => {
      updaters.setState(updaters.skeletonModel());
    },
    skeletonModel: () => {
      let boxes = updaters.createEstimators();
      return { 
        status: 'not-ready',
        boxes,
        levels: PubbiasLevels
      }
    },
    selectIndividual: (value) => {
      let [tid,tv] = value.value.split('σδel');
      let boxes = updaters.getState().boxes;
      let tbc = _.find(boxes, m => {
        return Rules.isTheSameComparison(m.id)(tid);
      });
      tbc.judgement = parseInt(tv);
      updaters.getState().status = 'selecting';
      updaters.saveState();
      updaters.getState().status = 'ready';
      updaters.saveState();
    },
  }
  return updaters;
};


module.exports = () => {
  return Update;
}
