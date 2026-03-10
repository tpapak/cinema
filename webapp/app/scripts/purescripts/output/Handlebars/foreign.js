// Handlebars FFI - compile template with data
export const compileImpl = function(templateString, data) {
  if (typeof Handlebars !== 'undefined') {
    var template = Handlebars.compile(templateString);
    return template(data);
  } else {
    console.warn('Handlebars not available, returning empty string');
    return '';
  }
};
