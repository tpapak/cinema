# cinemar — Bayesian NMA → CINeMA, the MetaInsight path

`cinemar` is an R package (in `r-package/cinemar/`) that writes CINeMA v3 `.cnm`
files from network meta-analysis results, including **Bayesian** analyses fitted
with [gemtc](https://cran.r-project.org/package=gemtc) — the engine MetaInsight
uses. It is offered for download on the CINeMA welcome page
(`downloads/cinemar_<version>.tar.gz`).

This completes **Deliverable 2**: appraising results from advanced Bayesian
models (complex NMA, network meta-regression) imported from MetaInsight.

## What the package produces

A v3 `.cnm` has, per project, a `dataset`, an `analysis` and an optional
`evaluation`. The `analysis` separates:

| block | source | role |
|-------|--------|------|
| `contributionMatrix` | always **netmeta** | hat matrix + per-study contributions (within-study bias, indirectness) |
| `frequentist` | always **netmeta** | prop-direct, design-by-treatment test, pairwise/network heterogeneity, netsplit, league table, prediction intervals |
| `bayesian` | **gemtc** (when supplied) | posterior effects, credible/predictive intervals, nodesplit, tau, SUCRA, DIC, league table |

When `params.framework == "bayesian"`, CINeMA reads the **bayesian** block as
primary and falls back to **frequentist** for the quantities a Bayesian model
cannot produce. A Bayesian model alone cannot yield a contribution matrix or a
design-by-treatment test, which is why `cinemar` always runs netmeta too.

## How CINeMA consumes it

Consumption is entirely client-side (no backend call): `webapp/app/scripts/lib/v3bridge.js`
parses the file. The preference rule lives in `applyBayesianPreference()` there:
when the file is Bayesian it overlays `analysis.frequentist` with the Bayesian
effects, credible/predictive intervals, nodesplit and tau before the rest of the
bridge runs, so the league table, imprecision and incoherence domains all use
the posterior estimates while the contribution-matrix domains stay frequentist.

## Public API

| function | purpose |
|----------|---------|
| `write_cinema_cnm()` | one call: data (+ optional Bayesian fit) → `.cnm` on disk |
| `cinema_cnm()` | same, returns the list instead of writing |
| `cnm_frequentist_block()` | netmeta structural + frequentist block |
| `cnm_bayesian_gemtc()` | extract the Bayesian block from a gemtc `mtc.result` |
| `cnm_bayesian_block()` | build the Bayesian block from your own summary tables |
| `build_cnm()` / `write_cnm()` | assemble / serialise a `.cnm` |

## Example (MetaInsight smoking dataset)

See `webapp/test/create-bayesian-cnm.R` for a runnable script and the package
vignette (`vignette("cinemar")`) for the full walk-through.

```r
library(gemtc); library(cinemar)
data(smoking); ab <- smoking$data.ab

res   <- mtc.run(mtc.model(mtc.network(ab), likelihood = "binom",
                           link = "logit", linearModel = "random"))
ranks <- rank.probability(res, preferredDirection = 1)

D <- data.frame(study = ab$study, id = ab$study, t = ab$treatment,
                r = ab$responders, n = ab$sampleSize, rob = 1L, indirectness = 1L)

write_cinema_cnm(D, type = "long_binary", sm = "OR", model = "random",
                 bayesian = res, ranks = ranks,
                 title = "Smoking (Bayesian)", file = "smoking_bayesian.cnm")
```

## Tests

* `r-package/cinemar/tests/testthat/test-cnm.R` — frequentist block, JSON
  round-trip, framework switch, SUCRA maths (no JAGS needed).
* `r-package/cinemar/tests/testthat/test-gemtc.R` — real gemtc fit: Bayesian
  block extraction, **orientation agreement with the frequentist block**, and a
  bayesian-framework file (skipped if gemtc/JAGS absent).
* `webapp/test/test-bayesian-cnm.js` — end-to-end: create a Bayesian `.cnm` from
  a gemtc fit, serve `dist`, upload it, and assert CINeMA uses the **Bayesian**
  effect (not the frequentist one) and that the domains render.

## Comparison convention

A comparison id `"A:B"` (alphabetical) reports the effect of **A relative to B**.
gemtc's `d.A.B` (B relative to A) is negated to match; verified by the
orientation test on the smoking network.
