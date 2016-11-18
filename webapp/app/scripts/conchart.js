var Messages = require('./messages.js').Messages;
var uniqId = require('./mixins.js').uniqId;


var CC = {
  bindActions: () => {
  },
  updateChart: (m) => {
    if(m.project.hasSelectedRob && !_.isEmpty(m.project.currentCM)){
      m.project.chartReady = true;
    }else{
      m.project.chartReady = false;
    }
    var tmpl = GRADE.templates.conchart(m.project);
    $('#conChart').html(tmpl);
      if(m.project.chartReady){
        $(document).ready( () => {
          CC.createMatrix(m);
        });
      }
  },
  createMatrix: (m) => {
    let pers = m.project.currentCM.matrix.percentageContr;
    let colNames = m.project.currentCM.matrix.colNames;
    let rowNames = m.project.currentCM.matrix.rowNames;
    let comps = m.project.model.directComparisons;
    let cc = _.map(colNames, cn =>{
      let dc = _.find(comps, c => {
        let cid = uniqId([c.t1.toString(),c.t2.toString()]);
        let cnid = uniqId(cn.split(':'));
        return _.isEqual(cid,cnid);
      });
      return {id:cn, rob:dc.selectedrob};
    });
    let cm = _.object(rowNames,_.map(pers,per=>{
      let a = _.zip(_.map(cc,cdc=>{return {comp:cdc.id,rob:cdc.rob};}),
      _.map(per,p=>{return {cont:p};}));
      a = _.map(a, aa =>{
        return _.extend(aa[0],aa[1]);
      });
      return a;
    }));
    let dts = _.map(cm, r => {
      return _.sortBy(r, c => {
        return c.rob;
      });
    });
    let dtsps = _.map(dts[0], (r,i) => {
      return _.map(dts,c=>{return c[i].cont});
    });
    let dtsts = _.map(dts[0], (c,i) => {
      let dt = {};
      switch(c.rob){
        case "1":
          dt.backgroundColor= m.lowrobcolor;
        break;
        case "2":
          dt.backgroundColor= m.unclearrobcolor;
        break;
        case "3":
          dt.backgroundColor= m.highrobcolor;
        break;
      }
      dt.label = c.comp;
      dt.data=dtsps[i];
      console.log(dtsps[0].length);
      dt.borderColor = _.reduce(dt.data, (memo, d)=> {
        return memo.concat("rgba(255,254,253,0.9)");
      },[]);
      dt.borderWidth = 1;
      return dt;
    });
    CC.barChart = new Chart($("#barChart"), {
      type: 'horizontalBar',
      data: {
        labels: rowNames,
        datasets: dtsts
      },
      options: {
        scales: {
          xAxes: [{
            stacked: true,
            ticks: {
                 min: 0,
                 max: 100
             }
          }],
          yAxes: [{
            stacked: true
          }]
        }
      }
    })
  },
  removeChart: () => {
  },
}

module.exports = () => {
  return CC;
}
