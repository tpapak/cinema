# PureScript Cinema Web Application

This directory contains the PureScript codebase for the Cinema web application, which is used for clinical data processing and reporting.

## Requirements

- PureScript 0.15.15+
- Spago 0.93+ (package manager)

## Quick Start

```bash
# Build the project (dependencies are auto-installed)
spago build

# Watch mode for development
spago build --watch
```

## Project Structure

```
src/
├── ClinicalImportance/    # Clinical importance assessments
│   ├── ClinImp.purs
│   ├── ClinImpModel.purs
│   ├── ClinImpUpdate.purs
│   └── ClinImpView.purs
├── Imprecision/           # Imprecision calculations
│   ├── ImprecisionModel.purs
│   └── Rules.purs
├── Inconsistency/         # Inconsistency/heterogeneity handling
│   └── Heterogeneity/
│       └── Nodes.purs
├── Report/                # Report generation
│   ├── Model.purs
│   ├── ReportUpdate.purs
│   └── ReportView.purs
├── ComparisonModel.purs   # Treatment comparisons
├── Model.purs             # Core application state
├── EffectMeasure.purs     # Effect measure calculations
├── IndirectnessModel.purs # Indirectness assessments
├── InconsistencyModel.purs
├── PubbiasModel.purs
├── StudyLimitationsModel.purs
├── SaveModel.purs         # State persistence (FFI)
├── ReadModel.purs         # State reading (FFI)
└── Main.purs              # Entry point
```

## Build Commands

```bash
# Install dependencies (usually automatic)
spago install

# Build the project
spago build

# Build with watch mode
spago build --watch

# Run tests
spago test

# Generate documentation
spago docs
```

## FFI (Foreign Function Interface)

PureScript code interfaces with JavaScript through FFI modules (`.js` files alongside `.purs` files):

- `SaveModel.js` - Saves application state to JavaScript
- `ReadModel.js` - Reads state from JavaScript  
- `UpdateClinImpChildren.js` - Updates UI components
- `Report/*.js` - Report-related JavaScript interop

FFI files use ES module syntax (`export const ...`).

## Key Modules

### ComparisonModel
Defines treatment comparison data structures:
- `TreatmentId` - String or Int treatment identifiers
- `Comparison` - Treatment pair with metadata
- `Node` - Network node with intervention type

### Model
Core application state:
- `State` - Full application state
- `Project` - Project data including studies and comparisons

### Report
Report generation and updates:
- `ReportUpdate` - Updates report judgements
- `ReportView` - Report rendering helpers

## Dependencies

Key PureScript packages (see `spago.yaml`):
- `argonaut` / `argonaut-codecs` - JSON encoding/decoding
- `profunctor-lenses` - Functional optics
- `effect` - Effect system for side effects
- `arrays`, `maybe`, `either` - Core data types

## Integration with JavaScript

The compiled PureScript (in `output/`) is bundled with the main JavaScript 
application using esbuild. The output uses ES modules which esbuild handles natively.

Example JavaScript usage:
```javascript
var ComparisonModel = require('./purescripts/output/ComparisonModel');
var comparison = ComparisonModel.stringToComparison(':')('A:B');
```

## Code Style

- Use camelCase for function names
- Follow PureScript naming conventions
- Use row types and newtypes for type safety
- Prefer pattern matching over guards
- Handle errors with Either types
- Use lenses for record access/modification

## Troubleshooting

### Build Errors
```bash
# Clean and rebuild
rm -rf output .spago
spago build
```

### Missing Dependencies
```bash
spago install
```

### Type Errors
Check that JSON structures match expected types. Use `decodeJson` with 
explicit type annotations when needed.
