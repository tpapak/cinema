## CINeMA front-end

## Description
Source files for building the webapp.
CINeMA is a single page web application written in JavaScript and PureScript.

## Requirements

- Node.js v24+ (see `.nvmrc`)
- npm

## Quick Start

### Installation

```bash
git clone https://github.com/tpapak/cinema.git
cd cinema/webapp

# Install dependencies
npm install --legacy-peer-deps
bower install

# Install PureScript dependencies (handled by spago)
cd app/scripts/purescripts
# spago will auto-download dependencies on first build
cd ../../..
```

### Development

Build and run the development server:

```bash
# Build everything (PureScript + JavaScript)
./build.sh

# Or build components separately:
npm run purs:build      # Build PureScript only
npm run build:js        # Build JavaScript bundle only
npm run build:js:watch  # Watch mode (rebuilds on file changes)

# Start development server
npx http-server app -p 9000 -c-1
```

Then open http://localhost:9000 in your browser.

For PureScript development with auto-rebuild:
```bash
# Terminal 1: Watch PureScript files
cd app/scripts/purescripts
spago build --watch

# Terminal 2: Watch JavaScript bundle
npm run build:js:watch

# Terminal 3: Serve the app
npx http-server app -p 9000 -c-1
```

### Production Build

```bash
# Full production build (minified)
./build.sh

# The bundle is output to app/scripts/bundle.js
```

For deployment, the production build outputs to `app/scripts/bundle.js`. 
You can also use the gulp-based build for full production assets:

```bash
gulp build
```

This builds all assets (HTML, CSS, JS, images) to the `dist/` folder.

## Build System

The project uses two build systems:

### esbuild (Recommended for Development)
- **Fast**: Builds in ~60ms
- **ES Module Support**: Natively handles PureScript ES module output
- **Watch Mode**: Instant rebuilds during development

```bash
node build.js           # Production build (minified)
node build.js --dev     # Development build (no minification)
node build.js --watch   # Watch mode
```

### Gulp (Legacy, for Full Production Builds)
- Handles SCSS compilation, HTML processing, image optimization
- Required for complete production builds to `dist/`

```bash
gulp build              # Full production build
gulp serve              # Development server with live reload
```

## Project Structure

```
webapp/
├── app/
│   ├── scripts/
│   │   ├── purescripts/     # PureScript source code
│   │   │   ├── src/         # PureScript modules
│   │   │   ├── output/      # Compiled PureScript (ES modules)
│   │   │   └── spago.yaml   # PureScript dependencies
│   │   ├── main.js          # JavaScript entry point
│   │   └── bundle.js        # Built JavaScript bundle
│   ├── styles/              # SCSS stylesheets
│   ├── templates/           # Handlebars templates
│   └── images/              # Static images
├── build.js                 # esbuild configuration
├── build.sh                 # Combined build script
├── gulpfile.js              # Gulp configuration
└── package.json
```

## Docker

### Development
```bash
docker run -ti -p 80:80 tosku/cinema-web-dev bash
```

### Production
```bash
docker run -d -p 80:80 tosku/cinema-web-dev
```

### R Server Backend
CINeMA requires an R server backend. Unless you provide `webapp/config.json`, 
R calculations will be queried at `localhost:8004`:

```bash
docker run -d -p 8004:8004 tosku/cinema-rserver
```

## Configuration

Create `config.json` in the webapp directory to customize settings:

```json
{
  "version": "2.0.0",
  "rserverurl": "http://localhost:8004/ocpu/library/contribution/R",
  "ganalID": "UA-XXXXXXXXX-X"
}
```

## PureScript

The project uses PureScript 0.15+ with spago for package management.

### Building PureScript
```bash
cd app/scripts/purescripts
spago build
```

### Key PureScript Modules
- `ComparisonModel` - Treatment comparison data structures
- `Model` - Application state management
- `Report.*` - Report generation and updates
- `ClinImp.*` - Clinical importance calculations

### PureScript Dependencies
Managed via `spago.yaml`. Key packages:
- `argonaut` - JSON encoding/decoding
- `profunctor-lenses` - Optics/lenses
- `effect` - Effect system

## Troubleshooting

### Build Errors
If you encounter build errors after pulling updates:
```bash
# Clean and rebuild
rm -rf node_modules bower_components
rm -rf app/scripts/purescripts/output
rm -rf app/scripts/purescripts/.spago

npm install --legacy-peer-deps
bower install
./build.sh
```

### PureScript Errors
```bash
cd app/scripts/purescripts
rm -rf output .spago
spago build
```

### Node Version Issues
Use nvm to ensure correct Node version:
```bash
nvm use  # Uses version from .nvmrc
```

## License

CINeMA is licensed under the [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) license.
