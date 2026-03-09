# CINeMA Schema Migration: Old to New

## Motivation

The old schema nests everything under `project.CM.contributionMatrices.hatmatrix`,
which is structurally misleading. The contribution matrix is a *derived product* of
the hat matrix, not its parent. The hat matrix itself is one component of the full
NMA analysis results.

The new schema uses `project.analyses[]` -- an array of complete, self-contained
analysis results. This supports:
- Multiple analyses per project (frequentist/Bayesian, fixed/random, subsets)
- Clear hierarchy: analysis > {hatMatrix, nmaResults, studyContributions, ...}
- All fields needed for CINeMA to operate without the R backend

## Path Mapping: Old to New

### Top-level restructure

| Old Path | New Path | Notes |
|----------|----------|-------|
| `project.CM` | `project.analyses[]` | Object -> Array of analysis objects |
| `project.CM.contributionMatrices` | `project.analyses[i]` | Single object -> array element |
| `project.CM.contributionMatrices.hatmatrix` | `project.analyses[i].hatMatrix` | Renamed, no longer parent of everything |
| `project.CM.contributionMatrices.studycontributions` | `project.analyses[i].studyContributions` | Sibling of hatMatrix, not nested under it |

### Analysis parameters (NEW -- was split across hatmatrix fields)

| Old Path | New Path | Notes |
|----------|----------|-------|
| `...hatmatrix.model` | `...analyses[i].params.model` | Moved to dedicated params object |
| `...hatmatrix.sm` | `...analyses[i].params.sm` | Moved to dedicated params object |
| (not in schema) | `...analyses[i].params.tau` | NEW: heterogeneity parameter |
| (not in schema) | `...analyses[i].params.framework` | NEW: "frequentist" or "bayesian" |
| (not in schema) | `...analyses[i].params.label` | NEW: human-readable label |

### Hat matrix

| Old Path | New Path | Notes |
|----------|----------|-------|
| `...hatmatrix.H` | `...analyses[i].hatMatrix.H` | 2D numeric matrix, unchanged |
| `...hatmatrix.colNames` | `...analyses[i].hatMatrix.colNames` | Direct comparison column names |
| `...hatmatrix.rowNames` | `...analyses[i].hatMatrix.rowNames` | All comparison row names |
| `...hatmatrix.rowNamesNMAresults` | REMOVED | Redundant -- same as nmaResults[]._row |
| `...hatmatrix.colNamesNMAresults` | REMOVED | Redundant -- field names are in the schema |

### NMA results (per-comparison)

| Old Path | New Path | Notes |
|----------|----------|-------|
| `...hatmatrix.NMAresults` | `...analyses[i].nmaResults` | Promoted to sibling of hatMatrix |
| `...NMAresults[]._row` | `...nmaResults[].comparison` | Renamed for clarity |
| `...NMAresults[]."NMA treatment effect"` | `...nmaResults[].effect` | Shortened |
| `...NMAresults[]."se treat effect"` | `...nmaResults[].se` | Shortened |
| `...NMAresults[]."lower CI"` | `...nmaResults[].ciLower` | camelCase, no spaces |
| `...NMAresults[]."upper CI"` | `...nmaResults[].ciUpper` | camelCase, no spaces |
| `...NMAresults[]."lower PrI"` | `...nmaResults[].priLower` | camelCase, no spaces |
| `...NMAresults[]."upper PrI"` | `...nmaResults[].priUpper` | camelCase, no spaces |
| `...NMAresults[].PropDir` | `...nmaResults[].propDirect` | Clearer name |
| `...NMAresults[].PropDirNetmeta` | REMOVED | Redundant with propDirect |
| `...NMAresults[].Direct` | `...nmaResults[].direct.effect` | Grouped into sub-object |
| `...NMAresults[].DirectL` | `...nmaResults[].direct.ciLower` | Grouped into sub-object |
| `...NMAresults[].DirectU` | `...nmaResults[].direct.ciUpper` | Grouped into sub-object |
| `...NMAresults[].Indirect` | `...nmaResults[].indirect.effect` | Grouped into sub-object |
| `...NMAresults[].IndirectL` | `...nmaResults[].indirect.ciLower` | Grouped into sub-object |
| `...NMAresults[].IndirectU` | `...nmaResults[].indirect.ciUpper` | Grouped into sub-object |
| `...NMAresults[].SideIF` | `...nmaResults[].incoherence.effect` | SIDE test grouped |
| `...NMAresults[].SideIFlower` | `...nmaResults[].incoherence.ciLower` | SIDE test grouped |
| `...NMAresults[].SideIFupper` | `...nmaResults[].incoherence.ciUpper` | SIDE test grouped |
| `...NMAresults[].SideZ` | `...nmaResults[].incoherence.z` | SIDE test grouped |
| `...NMAresults[].SidePvalue` | `...nmaResults[].incoherence.pvalue` | SIDE test grouped |

### New fields (not in old schema, needed by CINeMA domains)

| New Path | Type | Used by | Notes |
|----------|------|---------|-------|
| `...analyses[i].pairwise` | array | Heterogeneity | Per-direct-comparison: tau2, I2 |
| `...analyses[i].pairwise[].comparison` | string | | "A:B" |
| `...analyses[i].pairwise[].tau2` | number | | Between-study variance |
| `...analyses[i].pairwise[].I2` | number | | I-squared statistic |
| `...analyses[i].networkHeterogeneity` | object | Heterogeneity | Network-level stats |
| `...analyses[i].networkHeterogeneity.tau2` | number | | Network tau-squared |
| `...analyses[i].networkHeterogeneity.Qoverall` | number | | Overall Q statistic |
| `...analyses[i].networkHeterogeneity.Qheterogeneity` | number | | Q for heterogeneity |
| `...analyses[i].networkHeterogeneity.Qinconsistency` | number | | Q for inconsistency |
| `...analyses[i].designByTreatment` | object | Incoherence | Design-by-treatment test |
| `...analyses[i].designByTreatment.Q` | number | | Q statistic |
| `...analyses[i].designByTreatment.df` | number | | Degrees of freedom |
| `...analyses[i].designByTreatment.pvalue` | number | | p-value |
| `...analyses[i].leagueTable` | array[] | Display | Formatted league table |
| `...analyses[i].sensitivityLeagueTables` | object | Display | Sensitivity analyses |
| `...analyses[i].sensitivityLeagueTables.lowRoB` | array[] | | RoB=1 only |
| `...analyses[i].sensitivityLeagueTables.lowModerateRoB` | array[] | | RoB=1,2 |

### Study contributions

| Old Path | New Path | Notes |
|----------|----------|-------|
| `...studycontributions` | `...analyses[i].studyContributions` | Same structure, camelCase |
| `...studycontributions["A:B"]` | `...studyContributions["A:B"]` | Comparison key unchanged |
| `...studycontributions["A:B"]["1"]` | `...studyContributions["A:B"]["1"]` or `...["ALLHAT"]` | Keys are study identifiers (name or numeric-as-string) |

### Studies (input data -- minimal changes)

| Old Path | New Path | Notes |
|----------|----------|-------|
| `project.studies.long` | `project.studies` | Simplified: the array IS the studies |
| `project.format` | `project.format` | Unchanged |
| `project.type` | `project.type` | Unchanged |
| `...long[].study` | `...studies[].study` | Now `stringOrInteger` (was string only) |
| `...long[].id` | `...studies[].id` | Now `stringOrInteger` (was integer only) |
| `...long[].t` | `...studies[].treatment` | Renamed; now `stringOrInteger` (was string only) |
| `...long[].r` | `...studies[].events` | Renamed for clarity |
| `...long[].n` | `...studies[].n` | Unchanged |
| `...long[].mean` | `...studies[].mean` | Unchanged |
| `...long[].sd` | `...studies[].sd` | Unchanged |
| `...long[].rob` | `...studies[].rob` | Unchanged (1-3) |
| `...long[].indirectness` | `...studies[].indirectness` | Unchanged (1-3) |

## String-or-Integer IDs (`stringOrInteger`)

Mirrors the PureScript `TreatmentId` type:

```purescript
data TreatmentId = StringId String | IntId Int
```

In JSON, a `stringOrInteger` value can appear as either:
- A string: `"ACE"`, `"Placebo"`, `"1"`
- An integer: `1`, `42`

This applies to `study`, `id`, and `treatment` fields in `studyArm`.
Consumers should normalise by converting integers to strings for comparison.

## Comparison ID Format

Unchanged: `"TreatmentA:TreatmentB"` where treatments are alphabetically sorted.
Pattern: `^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$`
Examples: `"ACE:BBlocker"`, `"1:2"`, `"DrugA:3"`

## Handling Multiple Analyses (Tom's Question)

The `project.analyses[]` array naturally supports multiple analyses in one file:

```json
{
  "project": {
    "studies": [...],
    "format": "long",
    "type": "binary",
    "analyses": [
      {
        "params": { "model": "fixed", "sm": "OR", "framework": "frequentist", "label": "Frequentist Fixed OR" },
        "hatMatrix": { ... },
        "nmaResults": [ ... ],
        ...
      },
      {
        "params": { "model": "random", "sm": "OR", "framework": "frequentist", "label": "Frequentist Random OR" },
        "hatMatrix": { ... },
        "nmaResults": [ ... ],
        ...
      },
      {
        "params": { "model": "random", "sm": "OR", "framework": "bayesian", "label": "Bayesian Random OR" },
        "hatMatrix": { ... },
        "nmaResults": [ ... ],
        ...
      }
    ]
  }
}
```

CINeMA selects the "active" analysis by matching on `params`. The cache key
is the tuple `(model, sm, tau, framework)`.
