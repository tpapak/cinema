var ComparisonModel = require('../purescripts/output/ComparisonModel');

var htmlEntities = (str) => {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

var uniqId = (ids) => {
    return ids.sort();
};
var sumBy = (list, keys) => {
  let out = 0;
  if (_.isArray(keys)){
    out =  _.reduce(list, (memo, el) => {return memo + el[keys[0]]+el[keys[1]]}, 0);
  }else{
    out = _.reduce(list, (memo, el) => {return memo + el[keys]}, 0);
  }
  return out;
};
var accumulate = (list, key) => {
  return _.reduce(list, (memo, el) => {return memo.concat([el[key]]);},[]);
};

var bindTableResize = (hot,container) => {
  $('#'+container).unbind();
  $('#'+container).on('mouseup touchend'  ,()=>{
    if(typeof hot !== 'undefined'){
      let e = $('#'+container);
      let w = e.width();
      let h = e.height();
      hot.updateSettings({
        width: w,
        height: h
      });
    }
  });
  $('#'+container+' .table-resizer').unbind();
  // $('#'+container+' .table-resizer').on('mouseup',(e)=>{
  //   let t = $(e.target).parent();
  //   t.toggleClass('fullscreen');
  //   $(e.target).parent().find('.table-resizer').toggle();
  // });
};

var focusTo = (id) => {
  jQuery('html,body').animate({
  scrollTop: jQuery('#'+id).offset().top,
  scrollLeft:jQuery('#'+id).offset().left},
  'fast');
};

var clone = (obj) =>{
  var copy;
  // Handle the 3 simple types, and null or undefined
  if (null == obj || 'object' != typeof obj) return obj;
   // Handle Array
  if (obj instanceof Array) {
    copy = [];
    for (var i = 0, len = obj.length; i < len; i++) {
      copy[i] = clone(obj[i]);
    }
    return copy;
  }
    // Handle Date
  if (obj instanceof Date) {
    copy = new Date();
    copy.setTime(obj.getTime());
    return copy;
  }

  if (obj instanceof Object) {
    copy = {};
    for (var attr in obj) {
      if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
    }
    return copy;
  }
  throw new Error('Unable to copy obj! Its type isn\'t supported.');
};

let hatmatrixIdOfComparison = (id) => {
  if (typeof window.Model !== 'undefined'){
    if (typeof window.Model.state !== 'undefined'){
      if (typeof window.Model.state.project !== 'undefined'){
        var project = window.Model.getState().project;
        var rownames = project.CM.currentCM.hatmatrix.rowNames;
        var rid = rownames.find(function(n){
          var t1 = n.split(':')[0].toString();
          var t2 = n.split(':')[1].toString();
          var armA = id.split(':')[0].toString();
          var armB = id.split(':')[1].toString();
          return (armA===t1 && armB===t2) || (armA===t2 && armB===t1)
        });
        return rid;
      }else{
        return id;
      }
    }else{
      return id;
    }
  }else{
    return id;
  }
};

let sortStudies = (rownames, studies) => {
  let fixednames = _.map(rownames, sid => {
    return ComparisonModel.fixComparisonId(sid);
  });
  let sortedIds = ComparisonModel.sortStringComparisonIds(fixednames); 
  let distance = (comp) => {
    return sortedIds.indexOf(comp);
  }
  let sortedStudies = _.zip(fixednames,studies).sort(
    (z1, z2) => {
      return distance(z1[0]) -
             distance(z2[0])
    });
  return sortedStudies;

  // return _.zip(rownames,studies);
}

// let sortComparisonIds = (rownames) => {
//   let fixednames = _.map(rownames, sid => {
//     return ComparisonModel.fixComparisonId(sid);
//   });
//   let sortedIds = ComparisonModel.sortStringComparisonIds(fixednames); 
//   return sortedIds;
// }

// JS-native fast path: avoids PureScript JSON encode/decode round-trips per item
// fixComparisonId normalizes "B:A" → "A:B" (canonical order)
// sortStringComparisonIds sorts by comparing treatments as (t1, t2) pairs
//
// PureScript TreatmentId ordering:
//   IntId < StringId (numeric IDs sort before string IDs)
//   IntId vs IntId: numeric comparison
//   StringId vs StringId: lexicographic comparison
let _isNumeric = (s) => { let n = parseInt(s, 10); return !isNaN(n) && String(n) === s; };
let _compareTreatments = (a, b) => {
  let aNum = _isNumeric(a);
  let bNum = _isNumeric(b);
  if (aNum && bNum) return parseInt(a, 10) - parseInt(b, 10);
  if (aNum && !bNum) return -1; // IntId < StringId
  if (!aNum && bNum) return 1;  // StringId > IntId
  // Both strings — lexicographic
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};
let sortComparisonIds = (rownames) => {
  // Normalize each comparison ID: split on ':', sort the two treatments, rejoin
  // PureScript stringToComparison uses min/max to put smaller treatment first
  let fixednames = rownames.map(sid => {
    let parts = sid.split(':');
    if (parts.length === 2) {
      let cmp = _compareTreatments(parts[0], parts[1]);
      if (cmp > 0) {
        return parts[1] + ':' + parts[0];
      }
      return parts[0] + ':' + parts[1];
    }
    return sid;
  });
  // Sort by (t1, t2) using PureScript comparisonsOrdering
  fixednames.sort((a, b) => {
    let pa = a.split(':');
    let pb = b.split(':');
    let c1 = _compareTreatments(pa[0], pb[0]);
    if (c1 !== 0) return c1;
    return _compareTreatments(pa[1], pb[1]);
  });
  return fixednames;
}

let majrule = (values) => {
  let sbv =  _.sortBy(
      _.sortBy(
        _.groupBy(values),
        vss => {
          return -vss[0];
        }
      ),
      vs => {
        return -vs.length;
      }
    );
  return sbv[0][0];
}

let meanrule = (values) => {
  let out = _.reduce(values, (memo,v) => {
      return memo + v;
  },0) / values.length;
  return  Math.round(out);
}

let maxrule = (values) => {
  return _.reduce(values, (memo,rob) => {
    return memo > rob ? memo : rob;
  },0);
}

// resolveGetters: takes an object whose properties may be functions (lazy getters)
// and returns a plain object with all function properties invoked to produce values.
// Non-function properties are copied as-is.
// This bridges the gap between view.js modules (which return lazy getter objects)
// and hyperscript-helpers views (which expect plain data objects).
var resolveGetters = (obj) => {
  var result = {};
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'function') {
        try {
          result[key] = obj[key]();
        } catch (e) {
          // Getter threw — leave as undefined (some getters depend on state
          // that may not be initialized yet, e.g. imprecision.interventionTypes
          // calls viewers.availableParameters which may not exist).
          result[key] = undefined;
        }
      } else {
        result[key] = obj[key];
      }
    }
  }
  return result;
};

module.exports = {
  meanrule,
  majrule,
  maxrule,
  focusTo: focusTo,
  bindTableResize: bindTableResize,
  uniqId: uniqId,
  sumBy: sumBy,
  accumulate: accumulate,
  htmlEntities: htmlEntities,
  clone: clone,
  sortComparisonIds: sortComparisonIds,
  sortStudies: sortStudies,
  hatmatrixIdOfComparison: hatmatrixIdOfComparison,
  resolveGetters: resolveGetters
}

