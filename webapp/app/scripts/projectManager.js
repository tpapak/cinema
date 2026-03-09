'use strict';

// projectManager.js — Manages one collection at a time in CINeMA v3 format
//
// A "collection" (.cdb) contains one or more CINeMA projects.
// A "project" (.cnm) is a single-project file (same v3 schema, always 1 project).
//
// State stored in: Model.getState().projectManager
//   { collection: Collection | null, activeProjectId: string | null }
//
// Collection: { id, title, description, author, createdAt, updatedAt, projects: [...V3Project] }

// --- Old multi-collection header (replaced by single-collection model) ---
// A "collection" is a v3 .cnm file containing one or more projects.
// An "atomic collection" is a single-project .cnm file (easy to merge).
// State: { collections: [...Collection], activeCollectionId, activeProjectId }

var h = require('virtual-dom/h');
var VNode = require('vtree/vnode');
var VText = require('vtree/vtext');
var convertHTML = require('html-to-vdom')({
  VNode: VNode,
  VText: VText
});
var Messages = require('./messages.js').Messages;
var FR = require('./lib/readFile.js').FR;
var V3Bridge = require('./lib/v3bridge.js');
var download = require('downloadjs');
var md5 = require('../../bower_components/js-md5/js/md5.min.js');

// =====================================================
// Helpers
// =====================================================
var generateId = () => {
  return md5(Date.now() + Math.random());
};

var timestamp = () => {
  return new Date().toISOString();
};

// =====================================================
// PM module — single collection at a time
// =====================================================
var PM = {
  actions: {
    bindControls: () => {
      // File input for uploading .cdb/.cnm collections
      $(document).on('change', '#pmUploadCollection', {}, (e) => {
        PM.update.uploadCollection(e.target);
      });
      // File input for uploading .csv dataset into active collection
      $(document).on('change', '#pmUploadCSV', {}, (e) => {
        PM.update.uploadCSV(e.target);
      });
      // File input for uploading .cnm project into active collection
      $(document).on('change', '#pmUploadProject', {}, (e) => {
        PM.update.uploadProject(e.target);
      });
    },
  },
  update: {
    updateState: (model) => {
      PM.model = model;
      // Initialize projectManager state if not present
      // Guard: getState() may return undefined during early init
      var state = PM.model.getState();
      if (state && typeof state.projectManager === 'undefined') {
        state.projectManager = {
          collection: null,
          activeProjectId: null,
        };
      }
    },
    getManager: () => {
      var state = PM.model.getState();
      if (!state) return { collection: null, activeProjectId: null };
      if (!state.projectManager) {
        state.projectManager = {
          collection: null,
          activeProjectId: null,
        };
      }
      return state.projectManager;
    },
    // ==========================================
    // Collection operations (one at a time)
    // ==========================================
    newCollection: (title) => {
      var doCreate = () => {
        var now = timestamp();
        var collection = {
          id: generateId(),
          title: title || 'New Collection',
          description: '',
          author: '',
          createdAt: now,
          updatedAt: now,
          projects: [],
        };
        var mgr = PM.update.getManager();
        mgr.collection = collection;
        mgr.activeProjectId = null;
        PM.model.saveState();
        Messages.alertify().success('Collection created: ' + collection.title);
        return collection;
      };
      // If there's already a collection, prompt before replacing
      var mgr = PM.update.getManager();
      if (mgr.collection && mgr.collection.projects && mgr.collection.projects.length > 0) {
        Messages.alertify().confirm('Replace Collection?',
          'You have an active collection ("' + mgr.collection.title + '"). Export it first? This will replace it.',
          () => { doCreate(); },
          () => {}
        );
      } else {
        if (!title) {
          Messages.alertify().prompt('New Collection', 'Enter collection title:', 'New Collection',
            (evt, value) => {
              title = value.toString();
              doCreate();
            },
            () => {}
          );
        } else {
          doCreate();
        }
      }
    },
    clearCollection: () => {
      var mgr = PM.update.getManager();
      if (!mgr.collection) return;
      Messages.alertify().confirm('Clear Collection?',
        'This will remove the current collection and all its projects from the browser. Make sure you have exported it first.',
        () => {
          mgr.collection = null;
          mgr.activeProjectId = null;
          PM.model.saveState();
          Messages.alertify().message('Collection cleared');
        },
        () => {}
      );
    },
    renameCollection: () => {
      var col = PM.view.getCollection();
      if (!col) return;
      Messages.alertify().prompt('Rename Collection', 'Enter new title:', col.title,
        (evt, value) => {
          col.title = value.toString();
          col.updatedAt = timestamp();
          PM.model.saveState();
          Messages.alertify().success('Collection renamed');
        },
        () => {}
      );
    },
    uploadCollection: (inputEl) => {
      var doUpload = () => {
        FR.handleFileSelect(inputEl).then((statestring) => {
          var parsed = JSON.parse(statestring);
          if (V3Bridge.isV3Format(parsed)) {
            var cinema = parsed.cinema;
            var now = timestamp();
            var collection = {
              id: generateId(),
              title: cinema.title || 'Imported Collection',
              description: cinema.description || '',
              author: cinema.author || '',
              createdAt: cinema.createdAt || now,
              updatedAt: now,
              projects: cinema.projects || [],
            };
            // Ensure each project has an id
            _.each(collection.projects, (p) => {
              if (!p.id) p.id = generateId();
            });
            var mgr = PM.update.getManager();
            mgr.collection = collection;
            mgr.activeProjectId = null;
            PM.model.saveState();
            Messages.alertify().success('Collection loaded: ' + collection.title + ' (' + collection.projects.length + ' projects)');
          } else {
            Messages.alertify().error('File is not in CINeMA v3 format. Use "Upload Project (.cnm)" for single projects or "Upload Dataset (.csv)" for raw data.');
          }
        }).catch((err) => {
          Messages.alertify().error('Failed to load collection: ' + err);
        });
      };
      // Prompt if replacing an existing collection
      var mgr = PM.update.getManager();
      if (mgr.collection && mgr.collection.projects && mgr.collection.projects.length > 0) {
        Messages.alertify().confirm('Replace Collection?',
          'You have an active collection ("' + mgr.collection.title + '"). Export it first? This will replace it.',
          () => { doUpload(); },
          () => {}
        );
      } else {
        doUpload();
      }
    },
    uploadProject: (inputEl) => {
      // Upload a single .cnm project file into the active collection
      FR.handleFileSelect(inputEl).then((statestring) => {
        var parsed = JSON.parse(statestring);
        if (V3Bridge.isV3Format(parsed) && parsed.cinema.projects && parsed.cinema.projects.length > 0) {
          var mgr = PM.update.getManager();
          // Auto-create a collection if none exists
          if (!mgr.collection) {
            mgr.collection = {
              id: generateId(),
              title: parsed.cinema.title || 'Imported Projects',
              description: '',
              author: parsed.cinema.author || '',
              createdAt: timestamp(),
              updatedAt: timestamp(),
              projects: [],
            };
          }
          // Add all projects from the .cnm file
          _.each(parsed.cinema.projects, (p) => {
            if (!p.id) p.id = generateId();
            mgr.collection.projects.push(p);
          });
          mgr.collection.updatedAt = timestamp();
          PM.model.saveState();
          Messages.alertify().success('Project(s) added: ' + parsed.cinema.projects.length + ' project(s)');
        } else {
          Messages.alertify().error('File is not a valid CINeMA project (.cnm).');
        }
      }).catch((err) => {
        Messages.alertify().error('Failed to upload project: ' + err);
      });
    },
    uploadCSV: (inputEl) => {
      // Upload a CSV dataset — read file, create project in legacy state,
      // then navigate to the configuration page for column mapping.
      // Uses the same chain as project.js fetchProject:
      //   getJSON → createProject → recognizeFile → initProject → [makeStudies]
      // but avoids fetchProject's hardcoded $('#files').val() for the filename.
      if (!inputEl.files || !inputEl.files[0]) return;
      var mgr = PM.update.getManager();
      // Auto-create a collection if none exists
      if (!mgr.collection) {
        mgr.collection = {
          id: generateId(),
          title: 'New Collection',
          description: '',
          author: '',
          createdAt: timestamp(),
          updatedAt: timestamp(),
          projects: [],
        };
        Messages.alertify().success('Collection created: New Collection');
      }
      // Extract filename (strip path and extension)
      var rawName = inputEl.files[0].name || 'dataset';
      var filename = rawName.replace(/\.[^/.]+$/, '');
      // Call existing Actions.Project methods (exposed from project.js PR.update)
      var ProjectActions = PM.model.Actions.Project;
      if (typeof ProjectActions === 'undefined') {
        Messages.alertify().error('CSV upload not available — Project module not loaded');
        return;
      }
      FR.handleFileSelect(inputEl)
        .then(FR.convertCSVtoJSON)
        .then((data) => {
          // Step 1: createProject — sets up project shell in state.project
          ProjectActions.createProject(filename);
          return data;
        })
        .then((data) => {
          // Step 2: recognizeFile — checks column names, detects format/type
          return ProjectActions.recognizeFile(data);
        })
        .then((answer) => {
          // Step 3: initProject — stores raw data on project
          ProjectActions.initProject(answer);
          // Step 4: if format+type were auto-detected, build studies immediately
          var hasFormat = typeof answer.format !== 'undefined';
          var hasType = typeof answer.type !== 'undefined';
          if (hasFormat && hasType) {
            var prj = PM.model.getState().project;
            prj.isRecognized = true;
            ProjectActions.makeStudies(answer);
          }
          // Navigate to the Configuration page for column mapping / review
          PM.model.Actions.Router.gotoRoute('project');
        })
        .catch((err) => {
          Messages.alertify().error('CSV upload error: ' + err);
        });
      // Reset the input so the same file can be re-uploaded
      inputEl.value = '';
    },
    exportCollection: () => {
      var col = PM.view.getCollection();
      if (!col) return;
      var v3 = {
        cinema: {
          version: '3.0.0',
          title: col.title,
          description: col.description,
          author: col.author,
          createdAt: col.createdAt,
          updatedAt: timestamp(),
          projects: col.projects,
        },
      };
      var filename = (col.title || 'collection').replace(/[^a-zA-Z0-9_-]/g, '_') + '.cdb';
      download(JSON.stringify(v3, null, 2), filename);
      Messages.alertify().success('Collection exported: ' + filename);
    },
    // ==========================================
    // Project operations (within the collection)
    // ==========================================
    // createProject removed from UI — empty projects are useless without data.
    // Use uploadProject (.cnm) or uploadCSV (.csv) instead.
    // createProject: () => {
    //   var col = PM.view.getCollection();
    //   if (!col) {
    //     Messages.alertify().error('Create a collection first');
    //     return;
    //   }
    //   var now = timestamp();
    //   var project = {
    //     id: generateId(),
    //     title: 'New Project',
    //     description: '',
    //     outcome: '',
    //     createdAt: now,
    //     updatedAt: now,
    //     hasEvaluation: false,
    //     dataset: {
    //       format: 'long',
    //       type: 'binary',
    //       studies: [],
    //     },
    //     analysis: null,
    //     evaluation: null,
    //   };
    //   col.projects.push(project);
    //   col.updatedAt = now;
    //   var mgr = PM.update.getManager();
    //   mgr.activeProjectId = project.id;
    //   PM.model.saveState();
    //   Messages.alertify().success('Project created: ' + project.title);
    // },
    removeProject: (projectId) => {
      var col = PM.view.getCollection();
      if (!col) return;
      Messages.alertify().confirm('Remove Project?',
        'This will remove the project from this collection.',
        () => {
          col.projects = _.filter(col.projects, (p) => { return p.id !== projectId; });
          col.updatedAt = timestamp();
          var mgr = PM.update.getManager();
          if (mgr.activeProjectId === projectId) {
            mgr.activeProjectId = null;
          }
          PM.model.saveState();
          Messages.alertify().message('Project removed');
        },
        () => {}
      );
    },
    renameProject: (projectId) => {
      var proj = PM.view.getProject(projectId);
      if (!proj) return;
      Messages.alertify().prompt('Rename Project', 'Enter new title:', proj.title,
        (evt, value) => {
          proj.title = value.toString();
          proj.updatedAt = timestamp();
          var col = PM.view.getCollection();
          if (col) col.updatedAt = timestamp();
          PM.model.saveState();
          Messages.alertify().success('Project renamed');
        },
        () => {}
      );
    },
    exportProject: (projectId) => {
      // Export single project as .cnm
      var proj = PM.view.getProject(projectId);
      var col = PM.view.getCollection();
      if (!proj) return;
      var v3 = {
        cinema: {
          version: '3.0.0',
          title: proj.title || 'Exported Project',
          author: col ? col.author : '',
          createdAt: proj.createdAt || timestamp(),
          updatedAt: timestamp(),
          projects: [proj],
        },
      };
      var filename = (proj.title || 'project').replace(/[^a-zA-Z0-9_-]/g, '_') + '.cnm';
      download(JSON.stringify(v3, null, 2), filename);
      Messages.alertify().success('Project exported: ' + filename);
    },
    openProject: (projectId) => {
      // Load a v3 project into the CINeMA evaluation workspace
      var col = PM.view.getCollection();
      var proj = PM.view.getProject(projectId);
      if (!proj || !col) {
        Messages.alertify().error('Project not found');
        return;
      }
      // Check if project has data
      if (!proj.dataset || !proj.dataset.studies || proj.dataset.studies.length === 0) {
        Messages.alertify().error('Project has no study data. Upload data first.');
        return;
      }
      // Preserve projectManager state across setState (which replaces entire state)
      var currentMgr = PM.update.getManager();
      var savedMgr = {
        collection: currentMgr.collection,
        activeProjectId: projectId,
      };
      // Build v3 wrapper for the bridge
      var v3wrapper = {
        cinema: {
          version: '3.0.0',
          title: col.title,
          description: col.description,
          author: col.author,
          projects: [proj],
        },
      };
      var legacyState = V3Bridge.v3ToLegacyState(v3wrapper, PM.model.getState());
      // Compute hash of the project state at load time for unsaved detection
      savedMgr.lastSavedHash = md5(JSON.stringify(legacyState.project || {}));
      // Inject projectManager into the new state before setState
      legacyState.projectManager = savedMgr;
      legacyState.router = { currentRoute: 'general' };
      PM.model.setState(legacyState);
      Messages.alertify().success('Project loaded: ' + proj.title);
    },
    // Save current evaluation state back into the active project
    saveBackToCollection: () => {
      var mgr = PM.update.getManager();
      if (!mgr || !mgr.collection || !mgr.activeProjectId) {
        Messages.alertify().error('No active project in a collection');
        return;
      }
      var col = mgr.collection;
      var projIdx = _.findIndex(col.projects, (p) => { return p.id === mgr.activeProjectId; });
      if (projIdx === -1) {
        Messages.alertify().error('Active project not found in collection');
        return;
      }
      // Export current state to v3 and extract the project
      var v3 = V3Bridge.legacyStateToV3(PM.model.getState());
      if (v3 && v3.cinema && v3.cinema.projects && v3.cinema.projects.length > 0) {
        var exportedProject = v3.cinema.projects[0];
        // Preserve the original project id
        exportedProject.id = mgr.activeProjectId;
        col.projects[projIdx] = exportedProject;
        col.updatedAt = timestamp();
        // Update saved hash to current state
        mgr.lastSavedHash = md5(JSON.stringify(PM.model.getState().project || {}));
        PM.model.saveState();
        Messages.alertify().success('Progress saved to collection');
      } else {
        Messages.alertify().error('Failed to export current state');
      }
    },
  },
  view: {
    register: (model) => {
      model.Actions.ProjectManager = PM.update;
      PM.model = model;
      PM.update.updateState(model);
      _.mapObject(PM.actions, (f) => { f(); });
    },
    getManager: () => {
      var mgr = PM.model.getState().projectManager;
      if (!mgr) return { collection: null, activeProjectId: null };
      return mgr;
    },
    getCollection: () => {
      var mgr = PM.view.getManager();
      return mgr.collection || null;
    },
    getProject: (projectId) => {
      var col = PM.view.getCollection();
      if (!col) return null;
      return _.find(col.projects, (p) => { return p.id === projectId; });
    },
    collection: () => {
      return PM.view.getCollection();
    },
    activeProjectId: () => {
      return PM.view.getManager().activeProjectId;
    },
    hasCollection: () => {
      return PM.view.getCollection() !== null;
    },
    hasActiveProject: () => {
      return PM.view.activeProjectId() !== null;
    },
    isReady: () => {
      return typeof PM.model !== 'undefined' && typeof PM.model.getState !== 'undefined';
    },
  },
  render: (model) => {
    if (PM.view.isReady()) {
      // Pre-compute view data for Handlebars (functions aren't auto-called reliably)
      var col = PM.view.collection();
      var activeId = PM.view.activeProjectId();
      // Enrich each project with computed display flags
      var projectsView = [];
      if (col && col.projects) {
        projectsView = _.map(col.projects, (p) => {
          var hasStudies = p.dataset && p.dataset.studies && p.dataset.studies.length > 0;
          var hasAnalysis = !!(p.analysis && p.analysis.model);
          var hasEval = !!(p.hasEvaluation || (p.evaluation && p.evaluation.domains));
          return {
            id: p.id,
            title: p.title,
            description: p.description,
            outcome: p.outcome,
            dataset: p.dataset,
            hasEvaluation: hasEval,
            isActive: p.id === activeId,
            isAnalyzed: hasAnalysis,
            hasStudies: hasStudies,
            studyCount: hasStudies ? p.dataset.studies.length : 0,
          };
        });
      }
      // Detect unsaved changes: compare current project hash to saved hash
      var mgr = PM.update.getManager();
      var hasUnsavedChanges = false;
      if (activeId && mgr.lastSavedHash && model.state && model.state.project) {
        var currentHash = md5(JSON.stringify(model.state.project));
        hasUnsavedChanges = currentHash !== mgr.lastSavedHash;
      }
      var viewData = {
        hasCollection: PM.view.hasCollection(),
        collection: col,
        hasActiveProject: PM.view.hasActiveProject(),
        activeProjectId: activeId,
        projectsView: projectsView,
        hasUnsavedChanges: hasUnsavedChanges,
      };
      var tmpl = GRADE.templates.projectManager({ model: model.state, view: viewData });
      return h('div#contentProjectManager.row', convertHTML(tmpl));
    }
  },
  children: [],
};

// --- Old multi-collection code (kept for reference) ---
// createCollection, removeCollection, selectCollection, mergeCollections,
// promptMerge, splitProject were all array-based operations on
// mgr.collections[]. Replaced by single mgr.collection model above.

module.exports = () => {
  return PM;
};
