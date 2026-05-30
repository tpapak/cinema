# cinemar

Create CINeMA `.cnm` files (v3 exchange format) from frequentist **and Bayesian**
network meta-analysis, then upload them straight into
[CINeMA](https://cinema.med.auth.gr).

The frequentist *structural* block (hat / contribution matrix, prop-direct,
design-by-treatment test, netsplit, heterogeneity, league table) is always
computed with **netmeta** — CINeMA needs it for the within-study bias,
indirectness and incoherence domains, and a Bayesian model cannot produce it.
When you supply a Bayesian fit (a **gemtc** result, as MetaInsight produces),
its posterior effects, credible/predictive intervals, nodesplit, SUCRA, DIC and
tau are written to the Bayesian block and become CINeMA's primary results.

## Install

```r
install.packages("path/to/cinemar_0.1.0.tar.gz", repos = NULL, type = "source")
# dependencies: netmeta (>= 3.3), meta, jsonlite ; gemtc only for the gemtc helper
```

## Frequentist export

```r
library(cinemar)

# long binary: columns study, id, t, r, n, rob, indirectness
write_cinema_cnm(mydata, type = "long_binary", sm = "OR",
                 title = "My outcome", file = "my_outcome.cnm")
```

## Bayesian export from MetaInsight / gemtc

```r
# `result` is a gemtc mtc.result (e.g. from MetaInsight's Bayesian NMA)
write_cinema_cnm(
  data    = mydata,            # same study data, plus rob + indirectness
  type    = "long_binary",
  sm      = "OR",
  model   = "random",
  bayesian = result,           # gemtc mtc.result
  nodesplit = ns,              # optional gemtc::mtc.nodesplit result
  ranks    = rp,               # optional gemtc::rank.probability matrix
  title    = "My outcome (Bayesian)",
  file     = "my_outcome_bayes.cnm"
)
```

Prefer to pass your own posterior summaries (recommended for MetaInsight, which
already has them)? Build the block directly:

```r
comps <- data.frame(comparison = c("A:B", "A:C", "B:C"),
                    effect = ..., ciLower = ..., ciUpper = ...,
                    priLower = ..., priUpper = ...)
bblock <- cnm_bayesian_block(comps,
                             tau = list(mean = ., ciLower = ., ciUpper = .),
                             dic = list(Dbar = ., pD = ., DIC = ., dataPoints = .))
freq <- cnm_frequentist_block(mydata, type = "long_binary", sm = "OR")
write_cnm(build_cnm(freq, bayesian = bblock, title = "My outcome"), "out.cnm")
```

## Comparison convention

A comparison id `"A:B"` (alphabetical) reports the effect of **A relative to B**,
matching CINeMA's frequentist league table. The gemtc helper negates gemtc's
`d.A.B` basic parameters to match; pass `flip = TRUE` if a sanity check against
the frequentist league table shows it transposed for your gemtc version.
