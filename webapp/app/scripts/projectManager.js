'use strict';

// projectManager.js — Manages collections and projects in CINeMA v3 format
//
// A "collection" is a v3 .cnm file containing one or more projects.
// An "atomic collection" is a single-project .cnm file (easy to merge).
//
// State stored in: Model.getState().projectManager
//   { collections: [...Collection], activeCollectionId, activeProjectId }
//
// Collection: { id, title, description, author, createdAt, updatedAt, projects: [...V3Project] }

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
// PM module
// =====================================================
var PM = {
  actions: {
    bindControls: () => {
      // File input for uploading .cnm collections
      $(document).on('change', '#pmUploadCollection', {}, (e) => {
        PM.update.uploadCollection(e.target);
      });
    },
  },
  update: {
    updateState: (model) => {
      PM.model = model;
      // Initialize projectManager state if not present
      if (typeof PM.model.getState().projectManager === 'undefined') {
        PM.model.getState().projectManager = {
          collections: [],
          activeCollectionId: null,
          activeProjectId: null,
        };
      }
    },
    getManager: () => {
      return PM.model.getState().projectManager;
    },
    // ==========================================
    // Collection operations
    // ==========================================
    createCollection: (title) => {
      var mgr = PM.update.getManager();
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
      mgr.collections.push(collection);
      mgr.activeCollectionId = collection.id;
      mgr.activeProjectId = null;
      PM.model.saveState();
      Messages.alertify().success('Collection created: ' + collection.title);
      return collection;
    },
    removeCollection: (collectionId) => {
      var mgr = PM.update.getManager();
      Messages.alertify().confirm('Remove Collection?',
        'This will remove the collection and all its projects from the browser. Make sure you have exported it first.',
        () => {
          mgr.collections = _.filter(mgr.collections, (c) => { return c.id !== collectionId; });
          if (mgr.activeCollectionId === collectionId) {
            mgr.activeCollectionId = null;
            mgr.activeProjectId = null;
          }
          PM.model.saveState();
          Messages.alertify().message('Collection removed');
        },
        () => {}
      );
    },
    renameCollection: (collectionId) => {
      var col = PM.view.getCollection(collectionId);
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
    selectCollection: (collectionId) => {
      var mgr = PM.update.getManager();
      mgr.activeCollectionId = collectionId;
      mgr.activeProjectId = null;
      PM.model.saveState();
    },
    uploadCollection: (inputEl) => {
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
          mgr.collections.push(collection);
          mgr.activeCollectionId = collection.id;
          mgr.activeProjectId = null;
          PM.model.saveState();
          Messages.alertify().success('Collection uploaded: ' + collection.title + ' (' + collection.projects.length + ' projects)');
        } else {
          // Try to import as legacy or v2 — wrap in a single-project collection
          Messages.alertify().error('File is not in CINeMA v3 format. Please use the Project uploader for legacy files.');
        }
      }).catch((err) => {
        Messages.alertify().error('Failed to upload collection: ' + err);
      });
    },
    exportCollection: (collectionId) => {
      var col = PM.view.getCollection(collectionId);
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
      var filename = (col.title || 'collection').replace(/[^a-zA-Z0-9_-]/g, '_') + '.cnm';
      download(JSON.stringify(v3, null, 2), filename);
      Messages.alertify().success('Collection exported: ' + filename);
    },
    mergeCollections: (collectionId1, collectionId2) => {
      var col1 = PM.view.getCollection(collectionId1);
      var col2 = PM.view.getCollection(collectionId2);
      if (!col1 || !col2) return;
      var now = timestamp();
      var merged = {
        id: generateId(),
        title: col1.title + ' + ' + col2.title,
        description: 'Merged from: ' + col1.title + ', ' + col2.title,
        author: col1.author || col2.author || '',
        createdAt: now,
        updatedAt: now,
        projects: (col1.projects || []).concat(col2.projects || []),
      };
      var mgr = PM.update.getManager();
      mgr.collections.push(merged);
      mgr.activeCollectionId = merged.id;
      mgr.activeProjectId = null;
      PM.model.saveState();
      Messages.alertify().success('Collections merged into: ' + merged.title);
    },
    // Prompt user to select another collection to merge with
    promptMerge: (collectionId) => {
      var mgr = PM.update.getManager();
      var others = _.filter(mgr.collections, (c) => { return c.id !== collectionId; });
      if (others.length === 0) {
        Messages.alertify().error('No other collections to merge with');
        return;
      }
      // Build a simple selection dialog
      var labels = _.map(others, (c) => { return c.title + ' (' + c.projects.length + ' projects)'; });
      var html = '<select id="pmMergeSelect">';
      _.each(others, (c, i) => {
        html += '<option value="' + c.id + '">' + labels[i] + '</option>';
      });
      html += '</select>';
      Messages.alertify().confirm('Merge Collections', 'Select collection to merge with:<br>' + html,
        () => {
          var selectedId = $('#pmMergeSelect').val();
          if (selectedId) {
            PM.update.mergeCollections(collectionId, selectedId);
          }
        },
        () => {}
      );
    },
    // ==========================================
    // Project operations (within a collection)
    // ==========================================
    createProject: (collectionId) => {
      var col = PM.view.getCollection(collectionId);
      if (!col) return;
      var now = timestamp();
      var project = {
        id: generateId(),
        title: 'New Project',
        description: '',
        outcome: '',
        createdAt: now,
        updatedAt: now,
        hasEvaluation: false,
        dataset: {
          format: 'long',
          type: 'binary',
          studies: [],
        },
        analysis: null,
        evaluation: null,
      };
      col.projects.push(project);
      col.updatedAt = now;
      var mgr = PM.update.getManager();
      mgr.activeProjectId = project.id;
      PM.model.saveState();
      Messages.alertify().success('Project created: ' + project.title);
    },
    removeProject: (collectionId, projectId) => {
      var col = PM.view.getCollection(collectionId);
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
    renameProject: (collectionId, projectId) => {
      var proj = PM.view.getProject(collectionId, projectId);
      if (!proj) return;
      Messages.alertify().prompt('Rename Project', 'Enter new title:', proj.title,
        (evt, value) => {
          proj.title = value.toString();
          proj.updatedAt = timestamp();
          var col = PM.view.getCollection(collectionId);
          if (col) col.updatedAt = timestamp();
          PM.model.saveState();
          Messages.alertify().success('Project renamed');
        },
        () => {}
      );
    },
    splitProject: (collectionId, projectId) => {
      // Extract a project into its own atomic collection
      var proj = PM.view.getProject(collectionId, projectId);
      if (!proj) return;
      var now = timestamp();
      var newCol = {
        id: generateId(),
        title: proj.title || 'Split Project',
        description: 'Split from collection',
        author: '',
        createdAt: now,
        updatedAt: now,
        projects: [_.clone(proj)],
      };
      // Give the cloned project a new id to avoid duplicates
      newCol.projects[0].id = generateId();
      var mgr = PM.update.getManager();
      mgr.collections.push(newCol);
      PM.model.saveState();
      Messages.alertify().success('Project split into new collection: ' + newCol.title);
    },
    exportProject: (collectionId, projectId) => {
      // Export single project as atomic .cnm
      var proj = PM.view.getProject(collectionId, projectId);
      var col = PM.view.getCollection(collectionId);
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
    openProject: (collectionId, projectId) => {
      // Load a v3 project into the CINeMA evaluation workspace
      var col = PM.view.getCollection(collectionId);
      var proj = PM.view.getProject(collectionId, projectId);
      if (!proj || !col) {
        Messages.alertify().error('Project not found');
        return;
      }
      // Check if project has data
      if (!proj.dataset || !proj.dataset.studies || proj.dataset.studies.length === 0) {
        Messages.alertify().error('Project has no study data. Upload data first.');
        return;
      }
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
      PM.model.setState(legacyState);
      // Track which collection/project is active
      var mgr = PM.update.getManager();
      if (!mgr) {
        PM.model.getState().projectManager = {
          collections: [],
          activeCollectionId: collectionId,
          activeProjectId: projectId,
        };
      } else {
        mgr.activeCollectionId = collectionId;
        mgr.activeProjectId = projectId;
      }
      PM.model.getState().router.currentRoute = 'general';
      PM.model.saveState();
      Messages.alertify().success('Project loaded: ' + proj.title);
    },
    // Save current evaluation state back into the active project in its collection
    saveBackToCollection: () => {
      var mgr = PM.update.getManager();
      if (!mgr || !mgr.activeCollectionId || !mgr.activeProjectId) {
        Messages.alertify().error('No active project in a collection');
        return;
      }
      var col = PM.view.getCollection(mgr.activeCollectionId);
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
      if (!mgr) return { collections: [], activeCollectionId: null, activeProjectId: null };
      return mgr;
    },
    getCollection: (collectionId) => {
      var mgr = PM.view.getManager();
      return _.find(mgr.collections, (c) => { return c.id === collectionId; });
    },
    getProject: (collectionId, projectId) => {
      var col = PM.view.getCollection(collectionId);
      if (!col) return null;
      return _.find(col.projects, (p) => { return p.id === projectId; });
    },
    collections: () => {
      return PM.view.getManager().collections || [];
    },
    activeCollectionId: () => {
      return PM.view.getManager().activeCollectionId;
    },
    activeProjectId: () => {
      return PM.view.getManager().activeProjectId;
    },
    activeCollection: () => {
      var id = PM.view.activeCollectionId();
      if (!id) return null;
      return PM.view.getCollection(id);
    },
    hasCollections: () => {
      return PM.view.collections().length > 0;
    },
    hasActiveCollection: () => {
      return PM.view.activeCollectionId() !== null;
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
      var tmpl = GRADE.templates.projectManager({ model: model.state, view: PM.view });
      return h('div#contentProjectManager.row', convertHTML(tmpl));
    }
  },
  children: [],
};

module.exports = () => {
  return PM;
};
