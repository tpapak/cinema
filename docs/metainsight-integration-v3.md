# CINeMA v3 Schema: Integration Guide for MetaInsight Developers

**Version**: 3.0.0
**Date**: March 2026
**Schema file**: `schemata/cinema_schema_v3.json`
**Sample file**: `project-manager/diabetes_v3.cnm`

## Overview

CINeMA v3 defines a canonical exchange format for `.cnm` files. A `.cnm` file is a JSON document containing one or more NMA projects. MetaInsight can export analyses (frequentist, Bayesian, or both) as v3 `.cnm` files, which CINeMA can directly import for confidence evaluation.

### Key design decisions

1. **One project = one dataset + one analysis + one evaluation** (flat, simple)
2. **A `.cnm` file is a collection** of projects under a `cinema` root container
3. **Frequentist results are always required** (needed for contribution matrix)
4. **Bayesian results are optional** — when present and `framework="bayesian"`, CINeMA reads effects/intervals from the Bayesian block
5. **The contribution matrix is always frequentist** (hat matrix from `netmeta::hatmatrix()`)

## File structure

```json
{
  "cinema": {
    "version": "3.0.0",
    "title": "My Systematic Review",
    "description": "optional",
    "author": "optional",
    "createdAt": "2026-03-09T12:00:00Z",
    "updatedAt": "2026-03-09T12:00:00Z",
    "projects": [
      { ... project 1 ... },
      { ... project 2 ... }
    ]
  }
}
```

Only `version` (must be `"3.0.0"`) and `projects` (at least 1) are required at the collection level. All other fields are optional metadata.

### Multi-project exports

MetaInsight can export up to 4 projects in a single file:

- Frequentist, all studies
- Frequentist, subset
- Bayesian, all studies
- Bayesian, subset

Each is a self-contained project with its own dataset and analysis results.

## Project structure

```json
{
  "id": "unique-id",
  "title": "Frequentist Fixed-Effect RD",
  "description": "optional",
  "outcome": "mortality",
  "hasEvaluation": false,
  "dataset": { ... },
  "analysis": { ... },
  "evaluation": null
}
```

Only `dataset` is required. `analysis` and `evaluation` are optional (null or omitted when not available).

## Dataset

The dataset contains study-level arm data in long format.

```json
{
  "format": "long",
  "type": "binary",
  "studies": [
    {
      "study": "AASK",
      "id": 1,
      "treatment": "ACE",
      "n": 410,
      "rob": 1,
      "indirectness": 1,
      "events": 45
    },
    {
      "study": "AASK",
      "id": 1,
      "treatment": "BBlocker",
      "n": 405,
      "rob": 1,
      "indirectness": 1,
      "events": 70
    }
  ],
  "nodes": [ ... ],
  "directComparisons": [ ... ],
  "indirectComparisons": [ "ACE:ARB" ]
}
```

### Study arm fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `study` | string or int | yes | Study name (e.g. "AASK") |
| `id` | string or int | yes | Numeric study identifier (arms of the same study share the same id) |
| `treatment` | string or int | yes | Treatment name (e.g. "ACE") |
| `n` | integer >= 1 | yes | Sample size |
| `rob` | integer 1-3 | yes | Risk of bias: 1=Low, 2=Moderate, 3=High |
| `indirectness` | integer 1-3 | yes | Indirectness: 1=Low, 2=Moderate, 3=High |
| `events` | integer >= 0 | binary only | Number of events |
| `mean` | number | continuous only | Mean outcome |
| `sd` | number > 0 | continuous only | Standard deviation |

### rob and indirectness

MetaInsight must provide per-arm `rob` and `indirectness` judgements as integers 1-3. If your app does not collect indirectness, set all values to `1` (Low).

If your app does not collect RoB at the study level, set all values to `1` (Low). CINeMA allows users to override these during evaluation.

### Nodes (optional, recommended)

```json
{
  "id": "ACE",
  "label": "ACE",
  "numStudies": 8,
  "sampleSize": 23351
}
```

### Direct comparisons (optional, recommended)

```json
{
  "id": "ACE:BBlocker",
  "t1": "ACE",
  "t2": "BBlocker",
  "numStudies": 3
}
```

Comparison IDs use format `TreatA:TreatB` with treatments sorted alphabetically.

## Analysis

The analysis block contains NMA results. It has three required sections and one optional:

```json
{
  "params": { ... },
  "contributionMatrix": { ... },
  "frequentist": { ... },
  "bayesian": null
}
```

### params (required)

```json
{
  "model": "fixed",
  "sm": "RD",
  "framework": "frequentist",
  "tau": 0.0
}
```

| Field | Values | Required | Description |
|-------|--------|----------|-------------|
| `model` | `"fixed"`, `"random"` | yes | Model type |
| `sm` | `"OR"`, `"RR"`, `"RD"`, `"MD"`, `"SMD"` | yes | Summary measure |
| `framework` | `"frequentist"`, `"bayesian"` | no | Which framework's results CINeMA should prefer. Default: `"frequentist"` |
| `tau` | number | no | Between-study heterogeneity (tau, not tau-squared) |
| `label` | string | no | Human-readable label for the analysis |

### contributionMatrix (required)

This must always be computed from the **frequentist** model using `netmeta::hatmatrix()` and `netmeta::netcontrib()`.

```json
{
  "hatMatrix": {
    "H": [[0.1176, 0.1061, ...], [0.3376, 0.1068, ...], ...],
    "rowNames": ["ACE:ARB", "ACE:BBlocker", ...],
    "colNames": ["ACE:BBlocker,1", "ACE:CCB,2", ...]
  },
  "studyContributions": {
    "ACE:ARB": {"AASK": 23.53, "ALLHAT": 10.61, ...},
    "ACE:BBlocker": {"AASK": 33.76, "ALLHAT": 10.68, ...}
  }
}
```

- `H`: 2D array, each row is one network comparison, each column is one direct comparison. Rows correspond to `rowNames`, columns to `colNames`.
- `studyContributions`: for each network comparison (key), a map of study name to percentage contribution (0-100).

### R code to compute contribution matrix

```r
library(netmeta)

# After running netmeta:
net <- netmeta(TE, seTE, treat1, treat2, studlab, ...)

# Hat matrix
H <- hatmatrix(net)

# Study contributions (percentage)
nc <- netcontrib(net)
```

### frequentist (required)

Contains the NMA results from the frequentist model. Even when `framework="bayesian"`, this block is required because CINeMA needs the contribution matrix, propDirect, design-by-treatment test, and sensitivity league tables.

```json
{
  "nmaResults": [
    {
      "comparison": "ACE:ARB",
      "effect": 0.0086,
      "se": 0.0094,
      "ciLower": -0.0098,
      "ciUpper": 0.0271,
      "priLower": -0.0098,
      "priUpper": 0.0271,
      "propDirect": 0.0,
      "direct": null,
      "indirect": {
        "effect": 0.0086,
        "ciLower": -0.0098,
        "ciUpper": 0.0271
      },
      "incoherence": null
    },
    {
      "comparison": "ACE:BBlocker",
      "effect": -0.0199,
      "se": 0.0058,
      "ciLower": -0.0313,
      "ciUpper": -0.0085,
      "priLower": -0.0313,
      "priUpper": -0.0085,
      "propDirect": 0.5585,
      "direct": {
        "effect": -0.0254,
        "ciLower": -0.0407,
        "ciUpper": -0.0101
      },
      "indirect": {
        "effect": -0.0129,
        "ciLower": -0.0304,
        "ciUpper": 0.0045
      },
      "incoherence": {
        "effect": -0.0125,
        "ciLower": -0.0348,
        "ciUpper": 0.0099,
        "z": -1.0984,
        "pvalue": 0.2720
      }
    }
  ],
  "pairwise": [
    {
      "comparison": "ACE : BBlocker",
      "tau2": 0.0001,
      "I2": 58.78,
      "I2Lower": 0.0,
      "I2Upper": 87.6
    }
  ],
  "networkHeterogeneity": {
    "tau2": 0.0,
    "Qoverall": 45.2,
    "Qheterogeneity": 30.1,
    "Qinconsistency": 15.1
  },
  "designByTreatment": {
    "Q": 15.1,
    "df": 5,
    "pvalue": 0.01
  },
  "leagueTable": { ... },
  "sensitivityLeagueTables": {
    "lowModerateRoB": { ... },
    "lowRoB": { ... }
  }
}
```

#### nmaResults fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `comparison` | string | yes | `"TreatA:TreatB"` format |
| `effect` | number | yes | NMA treatment effect (log scale for OR/RR) |
| `se` | number | yes | Standard error |
| `ciLower` | number | yes | Lower 95% CI |
| `ciUpper` | number | yes | Upper 95% CI |
| `priLower` | number | yes | Lower 95% prediction interval |
| `priUpper` | number | yes | Upper 95% prediction interval |
| `propDirect` | number | yes | Proportion of direct evidence (0-1) |
| `direct` | object or null | no | Direct estimate: `{effect, ciLower, ciUpper}` |
| `indirect` | object or null | no | Indirect estimate: `{effect, ciLower, ciUpper}` |
| `incoherence` | object or null | no | SIDE test: `{effect, ciLower, ciUpper, z, pvalue}`. Only when both direct and indirect exist |

#### R code to compute nmaResults

```r
library(netmeta)

net <- netmeta(TE, seTE, treat1, treat2, studlab, sm = "RD", ...)

# NMA results
nma_results <- data.frame(
  comparison = paste(net$treat1, net$treat2, sep = ":"),
  effect = net$TE.nma,
  se = net$seTE.nma,
  ciLower = net$lower.nma,
  ciUpper = net$upper.nma,
  priLower = net$lower.predict,
  priUpper = net$upper.predict
)

# Netsplit for direct/indirect/incoherence
ns <- netsplit(net)

# Proportion direct
nc <- netcontrib(net)
# propDirect = diagonal of percentage matrix or from netsplit
```

### bayesian (optional)

When MetaInsight runs a Bayesian analysis (via `gemtc`), include the results here. Set `params.framework` to `"bayesian"` so CINeMA reads effects from this block.

```json
{
  "nmaResults": [
    {
      "comparison": "ACE:ARB",
      "effect": 0.0091,
      "ciLower": -0.012,
      "ciUpper": 0.031,
      "se": 0.011
    }
  ],
  "tau": {
    "mean": 0.015,
    "ciLower": 0.002,
    "ciUpper": 0.045
  },
  "nodesplit": [
    {
      "comparison": "ACE:BBlocker",
      "direct": { "effect": -0.025, "ciLower": -0.041, "ciUpper": -0.010 },
      "indirect": { "effect": -0.013, "ciLower": -0.030, "ciUpper": 0.005 },
      "pvalue": 0.28
    }
  ],
  "sucra": [
    { "treatment": "ACE", "sucra": 0.82 },
    { "treatment": "ARB", "sucra": 0.75 }
  ],
  "dic": {
    "Dbar": 120.5,
    "pD": 15.2,
    "DIC": 135.7,
    "dataPoints": 48
  },
  "leagueTable": { ... }
}
```

#### R code (gemtc) for Bayesian results

```r
library(gemtc)

model <- mtc.model(network, type = "consistency", ...)
results <- mtc.run(model, ...)

# Posterior summaries
summary(results)  # effect, CrI

# SUCRA
sucra <- sucra(results)

# Nodesplit
ns <- mtc.nodesplit(network, ...)

# DIC
dic <- summary(results)$DIC
```

## Preference rule

When `params.framework = "bayesian"`:

| Quantity | Read from |
|----------|-----------|
| NMA effects (point estimate, CrI) | `bayesian.nmaResults` |
| Prediction intervals | `bayesian.nmaResults` (if present), else `frequentist.nmaResults` |
| Tau | `bayesian.tau` |
| Nodesplit / incoherence | `bayesian.nodesplit` |
| SUCRA / rankings | `bayesian.sucra` |
| League table | `bayesian.leagueTable` (if present), else `frequentist.leagueTable` |
| **Hat matrix** | **Always `contributionMatrix.hatMatrix`** (frequentist) |
| **Study contributions** | **Always `contributionMatrix.studyContributions`** (frequentist) |
| **propDirect** | **Always `frequentist.nmaResults[].propDirect`** |
| **Design-by-treatment** | **Always `frequentist.designByTreatment`** |
| **Sensitivity league tables** | **Always `frequentist.sensitivityLeagueTables`** |

## Validation

The JSON schema is at `schemata/cinema_schema_v3.json`. You can validate your export in Python:

```python
import json
import jsonschema

with open("schemata/cinema_schema_v3.json") as f:
    schema = json.load(f)

with open("my_export.cnm") as f:
    data = json.load(f)

jsonschema.validate(data, schema)
print("Valid!")
```

Or in R:

```r
library(jsonvalidate)

schema <- json_validate("my_export.cnm", "schemata/cinema_schema_v3.json")
```

## Complete minimal example

The smallest valid v3 file (frequentist only, no evaluation):

```json
{
  "cinema": {
    "version": "3.0.0",
    "projects": [
      {
        "dataset": {
          "format": "long",
          "type": "binary",
          "studies": [
            {"study": "S1", "id": 1, "treatment": "A", "n": 100, "rob": 1, "indirectness": 1, "events": 10},
            {"study": "S1", "id": 1, "treatment": "B", "n": 100, "rob": 1, "indirectness": 1, "events": 20},
            {"study": "S2", "id": 2, "treatment": "A", "n": 100, "rob": 1, "indirectness": 1, "events": 15},
            {"study": "S2", "id": 2, "treatment": "C", "n": 100, "rob": 1, "indirectness": 1, "events": 25},
            {"study": "S3", "id": 3, "treatment": "B", "n": 100, "rob": 1, "indirectness": 1, "events": 18},
            {"study": "S3", "id": 3, "treatment": "C", "n": 100, "rob": 1, "indirectness": 1, "events": 22}
          ]
        },
        "analysis": {
          "params": {"model": "random", "sm": "OR"},
          "contributionMatrix": {
            "hatMatrix": {"H": [], "rowNames": [], "colNames": []},
            "studyContributions": {}
          },
          "frequentist": {
            "nmaResults": [
              {"comparison": "A:B", "effect": -0.69, "se": 0.35, "ciLower": -1.38, "ciUpper": -0.01, "priLower": -1.38, "priUpper": -0.01, "propDirect": 1.0},
              {"comparison": "A:C", "effect": -0.51, "se": 0.33, "ciLower": -1.16, "ciUpper": 0.13, "priLower": -1.16, "priUpper": 0.13, "propDirect": 1.0},
              {"comparison": "B:C", "effect": 0.18, "se": 0.34, "ciLower": -0.48, "ciUpper": 0.84, "priLower": -0.48, "priUpper": 0.84, "propDirect": 1.0}
            ]
          }
        }
      }
    ]
  }
}
```

## Checklist for MetaInsight export

- [ ] File has `cinema.version` set to `"3.0.0"`
- [ ] At least one project in `cinema.projects`
- [ ] Each project has a `dataset` with `format`, `type`, and `studies` (min 2 arms)
- [ ] Each study arm has `study`, `id`, `treatment`, `n`, `rob`, `indirectness`
- [ ] Binary studies have `events`; continuous studies have `mean` and `sd`
- [ ] `analysis.params` has `model` and `sm`
- [ ] `analysis.contributionMatrix` has `hatMatrix` and `studyContributions`
- [ ] `analysis.frequentist.nmaResults` has at least one comparison result
- [ ] Each comparison result has all required fields (comparison, effect, se, ciLower, ciUpper, priLower, priUpper, propDirect)
- [ ] Comparison IDs use `TreatA:TreatB` format with alphabetical sort
- [ ] If Bayesian: `params.framework` is `"bayesian"` and `bayesian` block is populated
- [ ] File validates against `cinema_schema_v3.json`

## Migration from v1 export

MetaInsight's current `cinema_export.R` produces v1 format. The main changes for v3:

1. **Wrap in `cinema` container** instead of flat project
2. **Study data as arm-level array** (not the R-format columns)
3. **NMA results use camelCase** (`ciLower` not `lower CI`)
4. **Hat matrix in structured format** (2D array + row/colNames)
5. **Study contributions as nested map** (comparison -> study -> percentage)
6. **Add `rob` and `indirectness`** per study arm (integers 1-3)

## Contact

For questions about the schema, contact the CINeMA team at ISPM Bern.
