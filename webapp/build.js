#!/usr/bin/env node
/**
 * Build script using esbuild - replaces gulp/browserify for JavaScript bundling.
 * 
 * Usage:
 *   node build.js              # Build JavaScript only
 *   node build.js --watch      # Watch mode for development
 *   node build.js --dev        # Development build (no minification)
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev') || isWatch;

// Ensure output directory exists
if (!fs.existsSync('./.tmp/scripts')) {
  fs.mkdirSync('./.tmp/scripts', { recursive: true });
}

// Read version from package.json (single source of truth)
const pkg = require('./package.json');

// Load config
let config = {
  ganalID: 'UA-XXXXXXXXX-X',
  // rserverurl: 'http://localhost:8004/ocpu/library/contribution/R'
  rserverurl: 'localhost:8004'
};

if (fs.existsSync('./config.json')) {
  config = { ...config, ...require('./config.json') };
}

// Generate config.js content (version always from package.json)
const configContent = `module.exports = { config: ${JSON.stringify({
  version: pkg.version,
  rserverurl: config.rserverurl
})} };`;

// Write config.js
fs.writeFileSync('./app/scripts/config.js', configContent);
console.log('✓ Generated app/scripts/config.js');

// esbuild configuration
const buildOptions = {
  entryPoints: ['./app/scripts/main.js'],
  bundle: true,
  outfile: './app/scripts/bundle.js',  // Output directly to app/scripts for dev server
  format: 'iife',
  platform: 'browser',
  target: ['es2015'],
  sourcemap: true,
  minify: !isDev,
  
  // esbuild natively understands ES modules from PureScript
  resolveExtensions: ['.js', '.json'],
  
  // Define globals
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"'
  },
  
  // Suppress duplicate key warnings (pre-existing code issues)
  logOverride: {
    'duplicate-object-key': 'silent'
  },
  
  logLevel: 'info',
};

async function build() {
  console.log(`\n📦 Building JavaScript bundle (${isDev ? 'development' : 'production'})...\n`);
  
  try {
    const startTime = Date.now();
    
    if (isWatch) {
      // Watch mode
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('\n👀 Watching for changes... (Ctrl+C to stop)\n');
    } else {
      // Single build
      const result = await esbuild.build(buildOptions);
      const elapsed = Date.now() - startTime;
      
      // Get file size
      const stats = fs.statSync('./app/scripts/bundle.js');
      const sizeKB = (stats.size / 1024).toFixed(1);
      
      console.log(`\n✓ Build complete in ${elapsed}ms`);
      console.log(`  Output: app/scripts/bundle.js (${sizeKB} KB)\n`);
      
      if (result.errors.length > 0) {
        console.error('Errors:', result.errors);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

build();
