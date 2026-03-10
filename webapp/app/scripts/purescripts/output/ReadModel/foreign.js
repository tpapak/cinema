export const readModel = function () {
  if (typeof window.Model !== 'undefined'){
    if (typeof window.Model.state !== 'undefined'){
      return   window.Model.getState();
    }
  }
};
