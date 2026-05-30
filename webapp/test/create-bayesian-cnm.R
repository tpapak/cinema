#!/usr/bin/env Rscript
# Create a Bayesian CINeMA .cnm from a gemtc NMA, MetaInsight-style.
#
# Fits a Bayesian random-effects NMA (binary, OR) on gemtc's bundled `smoking`
# dataset — the same example MetaInsight ships — then uses the `cinemar` package
# to write a v3 .cnm whose Bayesian block holds the posterior results and whose
# frequentist block (from netmeta) supplies the contribution matrix CINeMA needs.
#
# Usage: Rscript create-bayesian-cnm.R [output.cnm]

suppressMessages({
  library(gemtc)
  library(devtools)
})

args <- commandArgs(trailingOnly = TRUE)
out  <- if (length(args) >= 1) args[1] else "/tmp/smoking-bayesian.cnm"
pkg  <- normalizePath(file.path(dirname(sub("--file=", "",
            grep("--file=", commandArgs(FALSE), value = TRUE)[1])),
            "..", "..", "r-package", "cinemar"), mustWork = FALSE)
if (!dir.exists(pkg)) pkg <- "/Users/tosku/Sync/Documents/cinema/r-package/cinemar"
suppressMessages(devtools::load_all(pkg, quiet = TRUE))

set.seed(42)
data(smoking)
ab <- smoking$data.ab   # study, treatment, responders, sampleSize

# --- MetaInsight-style Bayesian fit --------------------------------------
net   <- mtc.network(ab)
model <- mtc.model(net, likelihood = "binom", link = "logit",
                   linearModel = "random", n.chain = 3)
res   <- mtc.run(model, n.adapt = 2000, n.iter = 8000, thin = 1)
ranks <- rank.probability(res, preferredDirection = 1)

# --- cinemar: long-binary data + rob/indirectness for the structural block
D <- data.frame(
  study = ab$study, id = ab$study, t = ab$treatment,
  r = ab$responders, n = ab$sampleSize,
  rob = 1L, indirectness = 1L, stringsAsFactors = FALSE
)

write_cinema_cnm(
  data     = D,
  type     = "long_binary",
  sm       = "OR",
  model    = "random",
  bayesian = res,        # gemtc mtc.result -> Bayesian block (primary)
  ranks    = ranks,      # -> SUCRA
  title    = "Smoking cessation (Bayesian)",
  file     = out
)

cat("Wrote", out, "\n")
