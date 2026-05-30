// generated on 2016-10-10 using generator-webapp 2.2.0
const gulp = require('gulp');
const gulpLoadPlugins = require('gulp-load-plugins');
const browserSync = require('browser-sync');
const del = require('del');
const wiredep = require('wiredep').stream;
// const runSequence = require('run-sequence'); // Removed: use gulp.series/parallel instead
const assign = require('lodash.assign');
const browserify = require('browserify');
const watchify = require('watchify');
const gutil = require('gulp-util');
const babelify = require('babelify');
const buffer = require('vinyl-buffer');
const source = require('vinyl-source-stream');
const dockerPath = '../RServer/toRoot/installContribution/contribution/inst/';
const $ = gulpLoadPlugins();
const reload = browserSync.reload;
const transform = require('gulp-transform');
const ext_replace = require('gulp-ext-replace');
const replace = require('gulp-replace');
const randomstring = require('randomstring');
const fs = require('fs');
const template = require('gulp-template');
const rename = require('gulp-rename');

function string_src(filename, string) {
  var src = require('stream').Readable({ objectMode: true })
  src._read = function () {
    this.push(new gutil.File({
      cwd: "",
      base: "",
      path: filename,
      contents: new Buffer(string)
    }))
    this.push(null)
  }
  return src
}

// Read version from package.json (single source of truth)
const pkg = require('./package.json');

var config = {};
if(fs.existsSync("config.json")){
  config = require('./config.json');
}else{
  config = {
    umamiUrl: "",
    umamiWebsiteId: "",
    // rserverurl: "http://localhost:8004/ocpu/library/contribution/R"
    rserverurl: "localhost:8004"
  }
}
conf = { config: {
         version: pkg.version,  // Always use version from package.json
         rserverurl: config.rserverurl
       }};

gulp.task('config', function() {
  return string_src("config.js", "module.exports="+JSON.stringify(conf))
    .pipe(gulp.dest('app/scripts/'));
});

// REMOVED: hbsTojs task — Handlebars templates replaced by hyperscript-helpers views
// gulp.task('hbsTojs', () => {
//   let modulify = c => {
//     let pre = '"use strict";exports.template=';
//     let contents = JSON.stringify(c);
//     return pre + contents;
//   };
//   return gulp.src('app/scripts/**/*.hbs')
//     .pipe(transform( contents => modulify(contents),{encoding: 'utf8'}))
//     .pipe(ext_replace('.js'))
//     .pipe(gulp.dest('app/scripts/'));
// });

// REMOVED: templates task — Handlebars templates replaced by hyperscript-helpers views
// gulp.task('templates', () => {
//   return gulp.src('app/templates/**/*.hbs')
//     .pipe($.handlebars())
//     .pipe($.defineModule('plain'))
//     .pipe($.declare({
//       namespace: 'GRADE.templates'
//     }))
//     .pipe(gulp.dest('.tmp/templates'));
// });

// No-op stubs so gulp.series references don't break
gulp.task('hbsTojs', (done) => { done(); });
gulp.task('templates', (done) => { done(); });

// gulp-sass v6+ requires explicit sass compiler
const sass = require('sass');
const gulpSass = require('gulp-sass')(sass);

gulp.task('styles', () => {
  return gulp.src('app/styles/*.scss')
    .pipe($.plumber())
    .pipe($.sourcemaps.init())
    .pipe(gulpSass.sync({
      loadPaths: ['.', './bower_components']
    }).on('error', gulpSass.logError))
    .pipe($.autoprefixer({overrideBrowserslist: ['> 1%', 'last 2 versions', 'Firefox ESR']}))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('.tmp/styles'))
    .pipe(reload({stream: true}));
});

// Using esbuild for bundling (handles ES modules from PureScript)
const esbuild = require('esbuild');

gulp.task('scripts', function() {
  return esbuild.build({
    entryPoints: ['app/scripts/main.js'],
    bundle: true,
    outfile: '.tmp/scripts/bundle.js',
    format: 'iife',
    platform: 'browser',
    target: ['es2015'],
    sourcemap: true,
    minify: false,
    logLevel: 'warning',
  }).catch(() => process.exit(1));
});

// Watch mode for scripts using esbuild
let esbuildContext = null;

async function watchbundle() {
  if (!esbuildContext) {
    esbuildContext = await esbuild.context({
      entryPoints: ['app/scripts/main.js'],
      bundle: true,
      outfile: '.tmp/scripts/bundle.js',
      format: 'iife',
      platform: 'browser',
      target: ['es2015'],
      sourcemap: true,
      minify: false,
      logLevel: 'info',
    });
  }
  await esbuildContext.rebuild();
  reload();
}

gulp.task('watchscripts', watchbundle);

function lint(files, options) {
  return gulp.src(files)
    .pipe(reload({stream: true, once: true}))
    .pipe($.eslint(options))
    .pipe($.eslint.format())
    .pipe($.if(!browserSync.active, $.eslint.failAfterError()));
}

gulp.task('lint', () => {
  return lint('app/scripts/**/*.js', {
    fix: true
  })
    .pipe(gulp.dest('app/scripts'));
});
gulp.task('lint:test', () => {
  return lint('test/spec/**/*.js', {
    fix: true,
    env: {
      mocha: true
    }
  })
    .pipe(gulp.dest('test/spec'));
});

gulp.task('html', gulp.series('config', 'styles', 'scripts', 'templates', 'hbsTojs', () => {
  var inject = require('gulp-inject-string');
  var postfix = config.version==='0.0.0'?randomstring.generate():config.version;
  var analytics = (config.umamiUrl && config.umamiWebsiteId)
    ? `<script defer src='${config.umamiUrl}/script.js' data-website-id='${config.umamiWebsiteId}'></script>`
    : '';

  return gulp.src('app/*.html')
    .pipe($.useref({searchPath: ['.tmp', 'app', '.']}))
    // Note: JS minification handled by esbuild in scripts task
    // .pipe($.if('*.js', $.uglify()))
    .pipe($.if('*.css', $.cssnano({safe: true, autoprefixer: false})))
    .pipe($.if('*.html', $.htmlmin({collapseWhitespace: true})))
    .pipe($.if('index.html', replace("main.js","main.js?"+postfix)))
    .pipe($.if('index.html', replace("plugins.js","plugins.js?"+postfix)))
    .pipe($.if('index.html', replace("vendor.js","vendor.js?"+postfix)))
    .pipe($.if('index.html', replace("vendor.css","vendor.css?"+postfix)))
    .pipe($.if('index.html', replace("main.css","main.css?"+postfix)))
    .pipe($.if('index.html', inject.after('<!-- analytics:js -->', analytics)))
    .pipe(gulp.dest('dist'));
}));

gulp.task('model', () => {
  return gulp.src('app/model/**/*')
    .pipe(gulp.dest('dist/model'));
});

gulp.task('images', () => {
  // Note: gulp-imagemin requires ESM and doesn't work with gulp-load-plugins
  // Just copy images without optimization for now
  return gulp.src('app/images/**/*')
    .pipe(gulp.dest('dist/images'));
});

gulp.task('fonts', () => {
  return gulp.src(require('main-bower-files')('**/*.{eot,svg,ttf,woff,woff2}', function (err) {})
    .concat('app/fonts/**/*'))
    .pipe(gulp.dest('.tmp/fonts'))
    .pipe(gulp.dest('dist/fonts'));
});

gulp.task('extras',() => {
  return gulp.src([
    'app/*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'));
});

gulp.task('downloads', () => {
  return gulp.src('app/downloads/**/*')
    .pipe(gulp.dest('dist/downloads'));
});

// inject bower components
const merge = require('merge-stream');

gulp.task('wiredep', () => {
  const scssStream = gulp.src('app/styles/*.scss')
    .pipe(wiredep({
      ignorePath: /^(\.\.\/)+/
    }))
    .pipe(gulp.dest('app/styles'));

  const htmlStream = gulp.src('app/*.html')
    .pipe(wiredep({
      exclude: ['bootstrap-sass'],
      ignorePath: /^(\.\.\/)*\.\./
    }))
    .pipe(gulp.dest('app'));

  return merge(scssStream, htmlStream);
});

gulp.task('clean', del.bind(null, ['.tmp', 'dist']));

// Serve task - Gulp 4 compatible
// Proxy middleware for /api/ requests to Flask backend in dev
var httpProxyMiddleware;
try {
  httpProxyMiddleware = require('http-proxy-middleware');
} catch(e) {
  // http-proxy-middleware is optional; only needed for dev proxy
  httpProxyMiddleware = null;
}

function startBrowserSync(done) {
  var serverConfig = {
    baseDir: ['.tmp', 'app'],
    routes: {
      '/bower_components': 'bower_components'
    }
  };

  // In dev, proxy /api/ requests to Flask backend on port 8004
  var middleware = [];
  if (httpProxyMiddleware) {
    var createProxy = httpProxyMiddleware.createProxyMiddleware;
    middleware.push(createProxy({
      pathFilter: '/api',
      target: 'http://localhost:8004',
      changeOrigin: true
    }));
  }

  browserSync({
    notify: false,
    port: 9000,
    browser: "chromium-browser",
    server: serverConfig,
    middleware: middleware
  });

  gulp.watch([
    'app/*.html',
    'app/images/**/*',
    '.tmp/templates/**/*.js',
    '.tmp/templates/**/*.json',
    '.tmp/fonts/**/*'
  ]).on('change', reload);

  gulp.watch('app/styles/**/*.scss', gulp.series('styles'));
  gulp.watch('app/templates/**/*.hbs', gulp.series('templates'));
  gulp.watch('app/scripts/**/*.hbs', gulp.series('hbsTojs'));
  gulp.watch('app/scripts/**/*.js', gulp.series('watchscripts'));
  gulp.watch('app/scripts/purescripts/output/**/*.js', gulp.series('watchscripts'));
  gulp.watch('app/fonts/**/*', gulp.series('fonts'));
  gulp.watch('bower.json', gulp.series('wiredep', 'fonts'));
  done();
}

gulp.task('serve', gulp.series(
  'clean',
  'wiredep',
  'config',  // config must run BEFORE watchscripts (which bundles it)
  gulp.parallel('styles', 'templates', 'hbsTojs', 'fonts'),  // templates load before scripts
  'watchscripts',  // bundle AFTER templates and config are ready
  startBrowserSync
));

gulp.task('serve:dist', () => {
  browserSync({
    notify: false,
    port: 9001,
    server: {
      baseDir: ['dist']
    }
  });
});

gulp.task('serve:test', gulp.series('templates', 'scripts', function serveTest() {
  browserSync({
    notify: false,
    port: 9000,
    ui: false,
    server: {
      baseDir: 'test',
      routes: {
        '/scripts': '.tmp/scripts',
        '/bower_components': 'bower_components'
      }
    }
  });

  gulp.watch('app/templates/**/*.hbs', gulp.series('templates'));
  gulp.watch('app/scripts/**/*.js', gulp.series('scripts'));
  gulp.watch(['test/spec/**/*.js', 'test/index.html']).on('change', reload);
  gulp.watch('test/spec/**/*.js', gulp.series('lint:test'));
}));

gulp.task('generate-service-worker', gulp.series('html', 'images', 'fonts', function generateServiceWorker(callback) {
  var path = require('path');
  var swPrecache = require('sw-precache');
  var rootDir = 'dist';

  swPrecache.write(path.join(rootDir, 'sw.js'), {
    staticFileGlobs: [rootDir + '/**/*.{js,html,css,png,jpg,gif,eot,svg,ttf,woff,woff2}'],
    stripPrefix: rootDir
  }, callback);
}));

gulp.task('buildWithServiceWorker', gulp.series('lint', 'generate-service-worker', 'extras', () => {
  return gulp.src('dist/**/*').pipe($.size({title: 'build', gzip: true}));
}));

gulp.task('build', gulp.series('html', 'model', 'images', 'fonts', 'extras', 'downloads', (done) => {
  console.log('Build complete! Output in dist/');
  done();
}));

gulp.task('buildToDocker', gulp.series('build', () => {
  console.log("deleting "+dockerPath+"www");
  return del(dockerPath+"/www/**/*",{force:true}).then(
    () => {
      console.log("copying dist to "+dockerPath+"www");
      gulp.src('./dist/**/*')
        .pipe(gulp.dest(dockerPath+"/www"));
    }
  );
}));

gulp.task('default', gulp.series('clean', 'wiredep', 'build'));
