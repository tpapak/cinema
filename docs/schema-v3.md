# CINeMA Exchange Schema v3

A `.cnm` file is a self-contained JSON document for sharing CINeMA projects.

```
{ cinema: { version, title, author, projects[ ] } }
```

## Structure

```
cinema                              Root envelope
  |
  +-- projects[ ]                   One or more self-contained projects
       |
       +-- dataset                  The uploaded study data (one CSV)
       |     format: long | wide | iv
       |     type: binary | continuous
       |     studies: studyArm[ ]   Arm-level rows (study, id, treatment, n, rob, indirectness, events|mean+sd)
       |     nodes[ ]               Treatment nodes (computed)
       |     directComparisons[ ]   Observed edges (computed)
       |     indirectComparisons[ ] Unobserved pairs (computed)
       |
       +-- analysis                 NMA results (null if not yet run)
       |     |
       |     +-- params             model (fixed|random), sm (OR|RR|RD|MD|SMD), framework, tau
       |     |
       |     +-- contributionMatrix Always frequentist (netmeta)
       |     |     hatMatrix        H matrix + row/col names (comparison IDs)
       |     |     studyContributions  { "A:B": { "study1": 0.15, ... }, ... }
       |     |
       |     +-- frequentist        Always present
       |     |     nmaResults[ ]    Per-comparison: effect, se, CI, PrI, propDirect, direct/indirect/incoherence
       |     |     pairwise[ ]      Per-direct-comparison: tau2, I2
       |     |     networkHeterogeneity  tau2, Q statistics
       |     |     designByTreatment    Q, df, p-value
       |     |     leagueTable      n x n string matrix
       |     |     sensitivityLeagueTables  lowRoB, lowModerateRoB
       |     |
       |     +-- bayesian           null unless framework=bayesian (from gemtc)
       |           nmaResults[ ]    Posterior: effect, 95% CrI, PrI
       |           tau              Posterior: mean, 95% CrI
       |           nodesplit[ ]     direct, indirect, p-value
       |           sucra[ ]         SUCRA rankings
       |           dic              Dbar, pD, DIC
       |           leagueTable      Posterior medians + 95% CrI
       |
       +-- evaluation               CINeMA domain assessments (null if not evaluated)
             studyLimitations       Within-study bias boxes + aggregation rules
             heterogeneity          Heterogeneity boxes + reference values
             incoherence            Incoherence boxes (uses ruleJudgement, not ruleLevel)
             imprecision            Imprecision boxes
             indirectness           Indirectness boxes
             reportingBias          Reporting bias boxes
             clinicalImportance     Thresholds: baseValue, upperBound, lowerBound
             report                 Final confidence report: directRows, indirectRows
```

## Key Types

| Type | Description |
|------|-------------|
| `treatmentId` | String or integer (`"ACE"` or `1`) |
| `comparisonId` | Alphabetically sorted pair: `"ACE:ARB"` |
| `studyArm` | One arm of one study with outcome data + rob + indirectness |
| `comparisonResult` | NMA estimate with optional netsplit (direct/indirect/SIDE test) |
| `domainBox` | Per-comparison judgement: `{ id, judgement, ruleLevel, levels[], customized }` |
| `reportRow` | All six domain judgements + overall confidence for one comparison |

## File Extensions

| Extension | Contents |
|-----------|----------|
| `.cnm` | Single project (1 element in `projects[]`) |
| `.cdb` | Collection of projects (multiple elements in `projects[]`) |

## Compatibility

| Source | Version | Handled by |
|--------|---------|------------|
| CINeMA v3 (cinema.med.auth.gr) | `cinema.version = "3.0.0"` | Native format |
| MetaInsight export | `project.analyses[]` present | `v2bridge.js` |
| Old CINeMA (cinema.ispm.unibe.ch) | `version: "1.x"` or `"2.x"` | `oldCnmBridge.js` -> v3 -> import |

## Preference Rule (Bayesian)

When `params.framework = "bayesian"`, CINeMA reads effect estimates, prediction intervals,
tau, nodesplit, and league table from the **bayesian** block. The **frequentist** block
provides the contribution matrix, propDirect, design-by-treatment test, and sensitivity
league tables (quantities the Bayesian model cannot compute).

---

*Full JSON Schema: `schemata/cinema_schema_v3.json`*
*Diagram: `schemata/cinema_schema_v3.svg`*
