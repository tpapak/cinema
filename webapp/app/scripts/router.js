var deepSeek = require('safe-access');
var h = require('virtual-dom/h');
// var VNode = require('vtree/vnode');     // REMOVED: was only needed for html-to-vdom (Handlebars)
// var VText = require('vtree/vtext');     // REMOVED: was only needed for html-to-vdom (Handlebars)
var md5 = require('../../bower_components/js-md5/js/md5.min.js');
// var convertHTML = require('html-to-vdom')({  // REMOVED: no longer converting Handlebars HTML
//      VNode: VNode,
//      VText: VText
// });
var Messages = require('./messages.js').Messages;
var headerView = require('./views/headerView.js');
var footerView = require('./views/footerView.js');
var reportView = require('./views/reportView.js');
var Welcome = require('./welcome.js')();
var ProjectManager = require('./projectManager.js')();
var Project = require('./project.js')();
var Doc = require('./doc.js')();
var Error = require('./error.js')();
var General = require('./general.js')();
var RoB = require('./rob/directrob/directrob.js')();
var ConChart = require('./rob/conchart/conchart.js')();
var Heterogeneity = require('./inconsistency/heterogeneity/heterogeneity.js')();
var Incoherence = require('./inconsistency/incoherence/incoherence.js')();
var Imprecision = require('./imprecision/imprecision.js')();
var Indirectness = require('./indirectness/directIndr/directIndr.js')();
var Pubbias = require('./pubbias/pubbias.js')();
var ReportViewPS = require('./purescripts/output/Report.View');
var ReportUpdate = require('./purescripts/output/Report.Update');
var ModelPS = require('./purescripts/output/Model');

// Report wrapper — adapts PureScript Report.View to the standard module interface.
// PureScript computes the view data; JS reportView.js renders VNodes.
// Replaces the old flow: PureScript Handlebars HTML string -> convertHTML -> VNodes.
var ReportModule = {
  view: {
    register: function(model) {
      ReportModule.model = model;
    },
  },
  render: function(model) {
    var state = model.getState();
    // console.log('[Report] raw state keys:', Object.keys(state));
    // console.log('[Report] state.project exists:', !!state.project);
    // console.log('[Report] report status:', state.project && state.project.report && state.project.report.status);
    // Decode raw JS state to PureScript State type
    // readState returns Either String State; .value0 holds the value for both Left/Right
    var decoded = ModelPS.readState(state);
    // console.log('[Report] decoded:', decoded);
    // console.log('[Report] decoded constructor:', decoded && decoded.constructor && decoded.constructor.name);
    // console.log('[Report] decoded.value0 type:', typeof (decoded && decoded.value0));
    // console.log('[Report] decoded.value0:', decoded && decoded.value0);
    // In compiled PureScript, Right constructor has .value0 = the State value
    // and isRight checks via either(const false)(const true)
    try {
      if (decoded && decoded.value0 && typeof decoded.value0 === 'object' && decoded.value0.project) {
        // console.log('[Report] Calling viewData...');
        var data = ReportViewPS.viewData(decoded.value0);
        // console.log('[Report] viewData isReady:', data.isReady, 'hasDirects:', data.hasDirects, 'hasIndirects:', data.hasIndirects);
        // console.log('[Report] directRows count:', (data.directRows || []).length);
        // if (data.directRows && data.directRows[0]) {
        //   var r0 = data.directRows[0];
        //   console.log('[Report] row[0] armA:', r0.armA, 'armB:', r0.armB);
        //   console.log('[Report] row[0] studyLimitation:', JSON.stringify(r0.studyLimitation));
        //   console.log('[Report] row[0] pubbias:', JSON.stringify(r0.pubbias));
        //   console.log('[Report] row[0] imprecision:', JSON.stringify(r0.imprecision));
        //   console.log('[Report] row[0] heterogeneity:', JSON.stringify(r0.heterogeneity));
        //   console.log('[Report] row[0] incoherence:', JSON.stringify(r0.incoherence));
        //   console.log('[Report] row[0] indirectness:', JSON.stringify(r0.indirectness));
        //   console.log('[Report] row[0] judgement keys:', r0.judgement ? Object.keys(r0.judgement) : 'none');
        // }
        return reportView(data);
      } else {
        // console.log('[Report] Decode check failed — decoded.value0.project missing');
      }
    } catch(e) {
      // console.log('Report render error:', e);
      // console.log('Report render error stack:', e.stack);
    }
    // Decode error or exception — show "Report not ready"
    return reportView({ isReady: false });
  },
};

var Router = {
  view: {
    checkAvailability: (route) => {
      if(_.contains(Router.view.menuRoutes, route)){
        return true;
      }else{
        let conmatStatus = deepSeek(Router,'model.getState().project.CM.currentCM.status');
        let directRobStatus = deepSeek(Router,'model.getState().project.DirectRob.status');
        let reportStatus = deepSeek(Router,'model.getState().project.report.status');
        let imprecisionStatus = deepSeek(Router,'model.getState().project.imprecision.status');
        switch(route) {
          case 'project':
            // Project page — always available (shows upload form or project details)
            return true;
            break;
          case 'general':
            if(Router.model.getState().project && typeof Router.model.getState().project.studies !== 'undefined'){
              return true;
            }else{
              return false;
            }
            break;
          case 'rob':
            return (conmatStatus==='ready');
            break;
          case 'pubbias':
            return (conmatStatus==='ready');
            break;
          case 'indirectness':
            return (conmatStatus==='ready');
            break;
          case 'imprecision':
            return (conmatStatus==='ready');
            break;
          case 'heterogeneity':
            return (conmatStatus==='ready');
            break;
          case 'incoherence':
            return (conmatStatus==='ready');
            break;
          case 'report':
            return (reportStatus==='ready');
            break;
        }
        return false;
      }
    },
    // menuRoutes: ['welcome', 'collections', 'project', 'doc'],
    menuRoutes: ['welcome', 'collections', 'doc'],
    evalRoutes: ['general', 'rob', 'pubbias', 'indirectness', 'imprecision', 'heterogeneity', 'incoherence', 'report'],
    dependencies: {
      project: [],
      general: ['projectName'],
      rob: ['currentCM','directRobs'],
      about: []
    },
    mainMenu: () => {
      return Router.view.routes(Router.view.menuRoutes);
    },
    evalMenu: () => {
      return Router.view.routes(Router.view.evalRoutes);
    },
    routes: (rtnames) => {
      let outRoutes = _.map(rtnames, rt => {
        return {
          route: rt,
          label: () => {return Router.model.getState().text.routes[rt].label},
          info: () => {return Router.model.getState().text.routes[rt].info},
          isAvailable: () => {return Router.view.checkAvailability(rt)},
          isActive: () => {return rt===Router.view.currentRoute()},
        }
     });
      return outRoutes;
    },
    currentRoute : () =>{
      return Router.model.getState().router.currentRoute;
    },
    isReady: () => {
      let isReady = false;
      if (! _.isUndefined(deepSeek(Router,'model.getState().router.currentRoute'))){
        isReady = true;
      }
      return isReady;
    },
    title: () => {
      let projectTitle = deepSeek(Router,'model.getState().project.title');
      if (_.isUndefined(projectTitle)){
        projectTitle='--'
      }
      return(projectTitle);
    },
    currentRoute: () => {
      let currentRoute = deepSeek(Router,'model.getState().router.currentRoute');
      if (_.isUndefined(currentRoute)){
        currentRoute='--'
      }
      return(currentRoute);
    },
  },
  update: {
    updateState: (model) => {
      if (_.isUndefined(deepSeek(model,'getState().router'))){
          model.getState().router = {
          currentRoute: 'welcome'
        }
        model.saveState();
      }else{
        //console.log('found cached route', Router.view.currentRoute());
      }
    },
    gotoRoute: (route) => {
      //console.log('routing to ', route);
      window.scrollTo(0,0);
      if((Router.view.currentRoute()!==route)){
        if(Router.view.checkAvailability(route)){
        Router.model.getState().router.currentRoute = route;
        Router.model.saveState();
        }else{
          Router.update.gotoRoute('welcome');
        }
      }
    },
  },
  actions: {
    bindNavControls: () => {
      $(document).on('click','a.routes', {} ,
        e=>{
          var route = $(e.currentTarget).attr('action');
          // console.log(e,'going to route',route);
          // Router.update.gotoRoute(route);
      });
    },
  },
  render:(model) => {
    return new Promise((resolve,reject) => {
      if (Router.view.isReady()){
        let currentRoute = Router.view.currentRoute();
        
        // Pre-compute banner data for the active project
        var bannerData = { hasProject: false };
        var projectTitle = deepSeek(Router,'model.getState().project.title');
        if (!_.isUndefined(projectTitle) && projectTitle) {
          bannerData.hasProject = true;
          bannerData.projectTitle = projectTitle;
          // Check if project is from a collection
          var pmState = deepSeek(Router,'model.getState().projectManager');
          if (pmState && pmState.activeProjectId && pmState.collection) {
            bannerData.collectionTitle = pmState.collection.title;
            bannerData.fromCollection = true;
            // Check for unsaved changes
            if (pmState.lastSavedHash) {
              var currentProjectHash = md5(JSON.stringify(Router.model.getState().project || {}));
              bannerData.hasUnsavedChanges = currentProjectHash !== pmState.lastSavedHash;
            }
          }
          // Include format/type info if available
          var projectFormat = deepSeek(Router,'model.getState().project.format');
          var projectType = deepSeek(Router,'model.getState().project.type');
          if (projectFormat) bannerData.format = projectFormat;
          if (projectType) bannerData.type = projectType;
        }
        
        // Header — hyperscript-helpers view (replaces header.hbs)
        var hnode = headerView(model, Router.view, bannerData);
        
        // Footer — hyperscript-helpers view (replaces footer.hbs)
        var fnode = footerView(model);
        
        let cnode = {};
        let child = _.find(Router.renderChildren, c => {
          return c.route === currentRoute;
        });
        
        if(typeof child === 'undefined'){
          cnode = Error.render(model);
        }else{
          if(currentRoute !=='rob'){
             ConChart.destroyRender(model);
          }
          if(currentRoute !=='indirectness'){
             Indirectness.destroyRender(model);
          }
          
          // Report now uses hyperscript-helpers like all other routes
          // (no more Handlebars HTML string -> convertHTML)
          cnode = child.module.render(model);
        }

        let ptree = [
                     h('div#header.row',hnode),
                     cnode,
                     h('nav.row.footerContainer',[fnode])
                   ];
        
        resolve(ptree);
        }else{
        reject('not ready');
      }
    });
  },
  afterRender: (model) => {
    let child = _.find(Router.renderChildren, c => {
      return c.route === Router.view.currentRoute();
    });
    if( typeof child !== 'undefined'){
      if(child.route === 'general'){
        General.afterRender();
      }else{
        if(child.route === 'rob'){
          RoB.afterRender(model);
        }
        if(child.route === 'indirectness'){
          Indirectness.afterRender(model);
        }
      }
    }
  },
  register:(model) => {
    Router.model = model;
    Router.model.Actions.Router = Router.update;
    Router.actions.bindNavControls();
    _.map(Router.renderChildren, c => {
      c.module.view.register(model);
      if ( c.route === 'report' ){
        Router.model.Actions.Report = ReportUpdate;
      }
    });
  },
  renderChildren: [
    { route: 'welcome',
      module: Welcome
    },
    { route: 'doc',
      module: Doc
    },
    { route: 'collections',
      module: ProjectManager
    },
    { route: 'project',
      module: Project
    },
    { route: 'general',
      module: General
    },
    { route: 'rob',
      module: RoB
    },
    { route: 'imprecision',
      module: Imprecision,
    },
    { route: 'indirectness',
      module: Indirectness,
    },
    { route: 'pubbias',
      module: Pubbias,
    },
    { route: 'heterogeneity',
      module: Heterogeneity,
    },
    { route: 'incoherence',
      module: Incoherence,
    },
    { route: 'report',
      module: ReportModule,
    },
  ],
}

module.exports = {
  Router: Router
};
