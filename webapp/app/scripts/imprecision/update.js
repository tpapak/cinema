var deepSeek = require('safe-access');
var clone = require('../lib/mixins.js').clone;
var uniqId = require('../lib/mixins.js').uniqId;
var sortStudies = require('../lib/mixins.js').sortStudies;
var Messages = require('../messages.js').Messages;
var Report = require('../purescripts/output/Report');
Report.view = require('../purescripts/output/Report.View');
Report.update = require('../purescripts/output/Report.Update');
var Rules = require('../purescripts/output/Imprecision.Rules');
var ClinImp = require('../purescripts/output/ClinImp');
ClinImp.update = require('../purescripts/output/ClinImp.Update');
var ComparisonModel = require('../purescripts/output/ComparisonModel');

var children = [
  Report
  ];

var Update = (model) => {
  let modelPosition = 'project.imprecision';
  let ImprecisionLevels = [
    { id: 1,
      color: '#02c000'
    },
    { id: 2,
      color: '#e0df02'
    },
    { id: 3,
      color: '#c00000'
  }];
  let updaters = {
    getState: () => {
      return deepSeek(model.getState(),modelPosition);
    },
    cmReady: () => {
      let isready = false;
      if (deepSeek(model, 'getState().project.CM.currentCM.status')==='ready'){
        isready = true;
      }
      return isready;
    },
    clinImpReady: () => {
      let isready = false;
      if (deepSeek(model, 'getState().project.clinImp.status')==='ready'){
        isready = true;
      }
      return isready;
    },
    setClinImp: () => {
        let mdl = model.getState();
        let clinImp = Number(document.getElementById('clinImpInput').value);
        ClinImp.showValid(model.getState().project.clinImp)(clinImp)();
        let isValid = ClinImp.isValid(model.getState().project.clinImp)(clinImp);
        // PS 0.15 Argonaut encodes Tuple as JSON array [value0, value1]
        if(! isValid[1]){
          Messages.alertify().error('Error in setting Clinically Important value: '+isValid[0]);
        }else{
          ClinImp.update.set(model.getState().project.clinImp)(Number(clinImp))();
        }
    },
    imprecisionReady: () => {
      return (deepSeek(model,'getState().project.imprecision.status')==='ready');
    },
    updateState: (model) => {
      let mdl = model.getState();
      // console.log('[imprecision updateState] cmReady:', updaters.cmReady(), 'clinImpReady:', updaters.clinImpReady());
      if (updaters.cmReady() && updaters.clinImpReady()) {
        // Always (re)generate boxes when CM and ClinImp are ready.
        // Previously the empty if-block here skipped regeneration when
        // imprecision was already "ready", so changing CIV never updated
        // the boxes. Now we always call skeletonModel() which recalculates
        // crossing rules based on the current CIV bounds.
        // if (updaters.imprecisionReady()){
        // }else{
        //   updaters.setState(updaters.skeletonModel());
        // }
        updaters.setState(updaters.skeletonModel());
      }else{
        model.getState().project.imprecision = {};
        updaters.setState(updaters.emptyModel());
      }
      _.map(children, c => {
        c.update.updateState(mdl)(mdl);
      });
    },
    setState: (newState) => {
      model.getState().project.imprecision = newState;
      updaters.saveState();
    },
    saveState: () => {
      model.saveState();
      let mdl = model.getState();
      _.map(children, c => { c.update.updateState(mdl)(mdl);});
    },
    createEstimators: () => {
      let cm = model.getState().project.CM.currentCM;
      let pairWiseValues = model.getState().project.CM.currentCM.hatmatrix.Pairwise;
      let pairWiseNames = model.getState().project.CM.currentCM.hatmatrix.rowNamesPairwise;
      let pairWises = _.zip(pairWiseNames,pairWiseValues);
      let NMAs = model.getState().project.CM.currentCM.hatmatrix.NMAresults;
      // console.log('[imprecision createEstimators] cm.directRowNames:', cm.directRowNames);
      // console.log('[imprecision createEstimators] cm.indirectRowNames:', cm.indirectRowNames);
      // console.log('[imprecision createEstimators] NMAs._row:', _.pluck(NMAs, '_row'));
      // console.log('[imprecision createEstimators] pairWiseNames:', pairWiseNames);
      // console.log('[imprecision createEstimators] clinImp:', JSON.stringify(model.getState().project.clinImp));
      //let NMANames =  model.getState().project.CM.currentCM.hatmatrix.rowNamesNMAresults;
      //let NMAs = _.zip(NMANames,NMAValues);
      let makeBoxes = (studies) => {
        let res = _.map(studies, s => {
          let pairRow = _.find(pairWises, pw => {
            // Use PureScript's isTheSameComparison for proper Comparison normalization
            return Rules.isTheSameComparison(s[0])(pw[0]);
          });
          let nmaRow = _.find(NMAs, nma => {
            return Rules.isTheSameComparison(nma['_row'])(s[0]);
          });
          if (!nmaRow) {
            console.warn('Imprecision: no NMA row found for comparison', s[0]);
            return null;
          }
          let sm = model.getState().project.CM.currentCM.params.sm;
          let useExps =  ((sm === 'OR') || (sm === 'RR'));
          let CIf = useExps ? Math.exp(nmaRow['lower CI']) : nmaRow['lower CI'];
          let nmaEffect = useExps ? Math.exp(nmaRow['NMA treatment effect']) : nmaRow['NMA treatment effect'];
          let CIs = useExps ? Math.exp(nmaRow['upper CI']) : nmaRow['upper CI'];
          let contents = {}
            // console.log("BOX id",s[0]);
            contents =  {
                id: nmaRow['_row'],
                CIf: CIf.toFixed(3),
                nmaEffect: nmaEffect.toFixed(3),
                CIs: CIs.toFixed(3)
            }
          if(_.isUndefined(pairRow)){
            _.extend(contents,{
                isMixed: false,
            })
          }else{
            _.extend(contents,{
                isMixed: true,
            })
          }
          // Use the local ImprecisionLevels constant directly instead of reading
          // from state, because createEstimators() runs inside skeletonModel()
          // BEFORE setState() writes the levels to project.imprecision.
          contents.levels = ImprecisionLevels;
          let clinImp = deepSeek(model,'getState().project.clinImp');
          let zlb = clinImp.lowerBound;
          let zub = clinImp.upperBound;
          let nulleffect = 0;
          if (useExps) {
            nulleffect = 1;
          }else{
            nulleffect = 0;
          }
          let crossParams = [ contents.CIf 
                            , contents.CIs
                            , zlb
                            , zub 
                            , nmaEffect
                            , nulleffect
                            ].map(
                              n => {return Number(n)
                              });
          contents.ruleLevel = updaters.getRuleLevel(...crossParams);
          contents.crosses = updaters.getNumberOfCrosses(...crossParams);
          contents.judgement = contents.ruleLevel;
          return contents;
        });
        return res;
      };
      let mixed = _.compact(makeBoxes(
        sortStudies(cm.directRowNames,cm.directStudies)));
      let indirect = _.compact(makeBoxes(sortStudies(cm.indirectRowNames,cm.indirectStudies)));
       //console.log("BOXES Names naoume",mixed,indirect);
      return _.union(mixed,indirect);
    },
    getRuleLevel: (CIf,CIs,lowerBound,upperBound,effect,nulleffect) => {
      let ciCrosses = Rules.numberOfCrosses(CIf)(effect)(CIs)(lowerBound)(nulleffect)(upperBound);
      let result = parseInt(ciCrosses) + 1;
      return result;
    },
    getNumberOfCrosses: (CIf,CIs,lowerBound,upperBound,effect,nulleffect) => {
      let ciCrosses = Rules.numberOfCrosses(CIf)(effect)(CIs)(lowerBound)(nulleffect)(upperBound);
      let result = parseInt(ciCrosses);
      return result;
    },
    resetBoxes: () => {
      updaters.setState(updaters.skeletonModel());
    },
    getOutcomeType: () => {
      let mdl = model.getState();
      let mt = deepSeek(mdl,'project.type');
      let result = 'nothing';
      if (typeof mt === 'undefined'){
        result = 'nothing';
      }else{
        switch(mt) {
          case 'binary':
              result = 'binary';
              break;
          case 'continuous':
              result = 'continuous';
              break;
        }
      }
      return result;
    },
    emptyModel: () => {
      let boxes = [];
      return {
        status: 'not-ready',
        boxes,
        levels: ImprecisionLevels
      }
    },
    skeletonModel: () => {
      let boxes = [];
      if(updaters.clinImpReady()){
        boxes = updaters.createEstimators();
      }else{
        boxes = [];
      }
      return {
        status: 'ready',
        boxes,
        levels: ImprecisionLevels

      }
    },
    resetClinImp: (emtype) => {
      let [title,msg,successmsg] = model.getState().text.ClinImp.reset;
      return new Promise (function(resolve,reject) {
        Messages.alertify().confirm
          ( title
          , msg
          , function () {
            ClinImp.update.reSet(emtype)();
            Messages.alertify().message(successmsg);
            resolve(true);
        }, function () {reject(false);});
        }).then(function(res){
      }).catch(function(reason){
      })
    },
    selectIndividual: (value) => {
      let [tid,tv] = value.value.split('σδel');
      let boxes = updaters.getState().boxes;
      let tbc = _.find(boxes, m => {
        return Rules.isTheSameComparison(m.id)(tid);
      });
      let rulevalue = tbc.ruleLevel;
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
