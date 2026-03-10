#!/usr/bin/env Rscript
# CINeMA Offline NMA Script
# Test version - generated to test offline R script functionality
#
# Requirements: R with packages netmeta (>= 3.3), meta, jsonlite

library(netmeta)
library(meta)
library(jsonlite)

cat("Running CINeMA NMA analysis...\n")
cat("  Model: fixed\n")
cat("  Effect measure: RD\n")

# ── Study data ─────────────────────────────────────────────────────

D <- data.frame(
  study = c("AASK", "AASK", "AASK", "ALLHAT", "ALLHAT", "ALLHAT", "ALPINE", "ALPINE", "ANBP2", "ANBP2", "Agabiti", "Agabiti", "Agabiti", "CAPPP", "CAPPP", "COLM", "COLM", "COPE", "COPE", "COPE", "EWPHE", "EWPHE", "HYVET", "HYVET", "INVEST", "INVEST", "JMIC_B", "JMIC_B", "Kostis", "Kostis", "LIFE", "LIFE", "MIDAS", "MIDAS", "MRC", "MRC", "MRC", "PROGRESS", "PROGRESS", "SCOPE", "SCOPE", "SHEP", "SHEP", "STOP2", "STOP2", "STOP2", "VALUE", "VALUE"),
  id    = c(1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 7, 7, 8, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 20, 21, 21),
  t     = c("ACE", "BBlocker", "CCB", "ACE", "CCB", "Diuretic", "ACE", "CCB", "ACE", "Diuretic", "ACE", "CCB", "Diuretic", "ACE", "BBlocker", "ARB", "CCB", "ARB", "BBlocker", "CCB", "Diuretic", "Placebo", "ACE", "Placebo", "ACE", "CCB", "ACE", "CCB", "ACE", "Placebo", "ARB", "BBlocker", "ACE", "CCB", "BBlocker", "Diuretic", "Placebo", "ACE", "Placebo", "ARB", "Placebo", "Diuretic", "Placebo", "ACE", "CCB", "Diuretic", "ARB", "CCB"),
  r     = c(45, 70, 32, 119, 136, 143, 3, 7, 25, 34, 56, 84, 55, 150, 161, 5, 8, 13, 10, 7, 28, 39, 25, 48, 57, 55, 3, 3, 19, 29, 23, 36, 4, 6, 60, 69, 116, 28, 48, 22, 34, 36, 54, 13, 29, 21, 139, 137),
  n     = c(410, 405, 202, 4096, 4008, 5971, 81, 82, 3044, 3039, 722, 1126, 786, 5492, 5230, 2568, 2573, 2045, 2030, 2006, 416, 424, 1933, 2009, 11267, 11309, 828, 822, 315, 332, 4605, 4588, 441, 442, 4403, 4396, 8654, 3051, 3054, 2477, 2460, 2365, 2371, 2205, 2196, 2213, 7649, 7596),
  rob   = c(1, 1, 1, 1, 1, 1, 3, 3, 2, 2, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2),
  indirectness = c(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
  stringsAsFactors = FALSE
)

type  <- "long_binary"
model <- "fixed"
sm    <- "RD"

# ── Run NMA ──────────────────────────────────────────────────────

cat("Running pairwise + netmeta...\n")

if (type == "long_binary") {
  Dpairs <- pairwise(treat = t, event = r, n = n,
                     data = D, studlab = id, sm = sm,
                     allstudies = TRUE)
  nma <- netmeta(TE, seTE, treat1, treat2, studlab,
                 data = Dpairs, sm = sm,
                 common = TRUE, random = TRUE)
}

if (type == "long_continuous") {
  Dpairs <- pairwise(treat = t, mean = y, sd = sd, n = n,
                     data = D, studlab = id, sm = sm)
  nma <- netmeta(TE, seTE, treat1, treat2, studlab,
                 data = Dpairs, sm = sm,
                 common = TRUE, random = TRUE,
                 tol.multiarm = 0.05)
}

if (type == "iv") {
  nma <- netmeta(effect, se, t1, t2, id,
                 data = D, sm = sm,
                 common = TRUE, random = TRUE,
                 tol.multiarm = 0.05)
}

# ── Hat matrix ─────────────────────────────────────────────────────

cat("Computing hat matrix...\n")
hm <- hatmatrix(nma, method = "Davies", type = "long")
H <- if (model == "fixed") hm$common else hm$random

# ── Contribution matrix + study contributions ──────────────────────

cat("Computing contribution matrix (this may take a while for large networks)...\n")
nc <- netcontrib(nma, method = "shortestpath", study = TRUE)
contribMatrix <- if (model == "fixed") nc$common else nc$random
studyContribs <- if (model == "fixed") nc$study.common else nc$study.random

# ── Design-by-treatment test ───────────────────────────────────────

cat("Computing design-by-treatment test...\n")
dd <- decomp.design(nma)
if (!is.null(dd$Q.decomp)) {
  dbt <- as.data.frame(dd$Q.decomp)
} else if (!is.null(dd$Q.inc.random)) {
  dbt <- as.data.frame(dd$Q.inc.random)
} else {
  dbt <- data.frame(Q = 0, df = 0, pval = 1)
}

# ── Netsplit (SIDE) ────────────────────────────────────────────────

cat("Computing netsplit (SIDE test)...\n")
ss <- netsplit(nma)

pick <- function(field, subfield) {
  path_new <- paste0(field, ".common")
  path_old <- paste0(field, ".fixed")
  obj <- if (model == "fixed") {
    if (!is.null(ss[[path_new]])) ss[[path_new]] else ss[[path_old]]
  } else {
    ss[[paste0(field, ".random")]]
  }
  if (is.null(obj)) return(rep(NA, length(ss$comparison)))
  obj[[subfield]]
}

pickProp <- function() {
  if (model == "fixed") {
    if (!is.null(ss$prop.common)) ss$prop.common else ss$prop.fixed
  } else {
    ss$prop.random
  }
}

side <- data.frame(
  comparison  = ss$comparison,
  Direct      = c(pick("direct",  "TE")),
  DirectL     = c(pick("direct",  "lower")),
  DirectU     = c(pick("direct",  "upper")),
  Indirect    = c(pick("indirect","TE")),
  IndirectL   = c(pick("indirect","lower")),
  IndirectU   = c(pick("indirect","upper")),
  SideIF      = c(pick("compare", "TE")),
  SideIFlower = c(pick("compare", "lower")),
  SideIFupper = c(pick("compare", "upper")),
  SideZ       = c(pick("compare", "z")),
  SidePvalue  = c(pick("compare", "p")),
  PropDir     = c(pickProp()),
  stringsAsFactors = FALSE
)

# ── NMA treatment effects ──────────────────────────────────────────

TE_mat <- if (model == "fixed") {
  if (!is.null(nma$TE.common)) nma$TE.common else nma$TE.fixed
} else { nma$TE.random }

seTE_mat <- if (model == "fixed") {
  if (!is.null(nma$seTE.common)) nma$seTE.common else nma$seTE.fixed
} else { nma$seTE.random }

lower_mat <- if (model == "fixed") {
  if (!is.null(nma$lower.common)) nma$lower.common else nma$lower.fixed
} else { nma$lower.random }

upper_mat <- if (model == "fixed") {
  if (!is.null(nma$upper.common)) nma$upper.common else nma$upper.fixed
} else { nma$upper.random }

propD <- if (model == "fixed") {
  if (!is.null(nma$prop.direct.common)) nma$prop.direct.common
  else nma$prop.direct.fixed
} else { nma$prop.direct.random }

treatnames <- rownames(TE_mat)
if (is.null(treatnames)) treatnames <- nma$trts
n_treats <- length(treatnames)

TE.nma   <- -TE_mat[lower.tri(TE_mat)]
seTE.nma <- seTE_mat[lower.tri(seTE_mat)]
LCI.nma  <- -upper_mat[lower.tri(upper_mat)]
UCI.nma  <- -lower_mat[lower.tri(lower_mat)]
PrL.nma  <- -nma$upper.predict[lower.tri(nma$upper.predict)]
PrU.nma  <- -nma$lower.predict[lower.tri(nma$lower.predict)]

# Build comparison IDs (lower-triangle, column-major)
comp_ids <- character(0)
for (j in seq_len(n_treats)) {
  for (i in seq_len(n_treats)) {
    if (i > j) comp_ids <- c(comp_ids, paste0(treatnames[j], ":", treatnames[i]))
  }
}

# ── Pairwise heterogeneity ─────────────────────────────────────────

cat("Computing pairwise heterogeneity...\n")
if (type == "iv") {
  comp <- paste(D$t1, D$t2, sep = ":")
  pw <- metagen(D$effect, D$se, sm = sm,
                common = (model == "fixed"),
                random = (model == "random"),
                subgroup = comp)
} else {
  comp <- paste(Dpairs$treat1, Dpairs$treat2, sep = ":")
  pw <- metagen(Dpairs$TE, Dpairs$seTE, sm = sm,
                common = (model == "fixed"),
                random = (model == "random"),
                subgroup = comp)
}

# ── League table ───────────────────────────────────────────────────

cat("Formatting league table...\n")

formatCI_safe <- function(lower, upper) {
  tryCatch(
    meta:::formatCI(lower, upper),
    error = function(e) paste0("(", format(lower), ", ", format(upper), ")")
  )
}
tryCatch(meta:::cilayout(bracket = "(", separator = ", "),
         error = function(e) NULL)

TE_common    <- if (!is.null(nma$TE.common))    nma$TE.common    else nma$TE.fixed
lower_common <- if (!is.null(nma$lower.common)) nma$lower.common else nma$lower.fixed
upper_common <- if (!is.null(nma$upper.common)) nma$upper.common else nma$upper.fixed

if (model == "fixed") {
  TE_lt  <- TE_common; low_lt <- lower_common; up_lt <- upper_common
} else {
  TE_lt  <- nma$TE.random; low_lt <- nma$lower.random; up_lt <- nma$upper.random
}

if (sm %in% c("OR", "RR", "HR")) {
  TE_x <- exp(TE_lt); lower_x <- exp(low_lt); upper_x <- exp(up_lt)
} else {
  TE_x <- TE_lt; lower_x <- low_lt; upper_x <- up_lt
}

TE_x    <- format(round(TE_x, 3))
lower_x <- round(lower_x, 3)
upper_x <- round(upper_x, 3)
nl <- paste(TE_x, formatCI_safe(lower_x, upper_x))
nl <- matrix(nl, nrow = n_treats, ncol = n_treats)
diag(nl) <- treatnames

# ── Build .cnm JSON ────────────────────────────────────────────────

cat("Building .cnm project file...\n")

# Convert contribution matrix to list-of-lists
mat_to_lol <- function(m) {
  lapply(seq_len(nrow(m)), function(i) as.numeric(m[i,]))
}

# Normalize comparison ID to alphabetical order (A:B where A < B)
normalize_comp <- function(cid) {
  parts <- strsplit(cid, ":")[[1]]
  paste(sort(parts), collapse = ":")
}

# Build study contribution lookup: comparison -> {study: proportion}
# Normalize comparison keys to alphabetical order (A:B where A < B)
sc_list <- list()
for (comp in unique(studyContribs$comparison)) {
  rows <- studyContribs[studyContribs$comparison == comp, ]
  sc_entry <- list()
  for (r in seq_len(nrow(rows))) {
    sc_entry[[as.character(rows$study[r])]] <- rows$contribution[r]
  }
  norm_comp <- normalize_comp(comp)
  sc_list[[norm_comp]] <- sc_entry
}

# Normalize side comparisons to match comp_ids
side$comp_norm <- sapply(side$comparison, normalize_comp)

# Build NMA results for v3
nma_results <- lapply(seq_along(comp_ids), function(idx) {
  cid <- comp_ids[idx]
  sr <- side[side$comp_norm == cid, ]
  res <- list(
    comparison = cid,
    effect     = TE.nma[idx],
    se         = seTE.nma[idx],
    ciLower    = LCI.nma[idx],
    ciUpper    = UCI.nma[idx],
    priLower   = PrL.nma[idx],
    priUpper   = PrU.nma[idx],
    propDirect = if (nrow(sr) > 0) sr$PropDir[1] else 0
  )
  if (nrow(sr) > 0 && !is.na(sr$Direct[1])) {
    res$direct <- list(effect=sr$Direct[1], ciLower=sr$DirectL[1], ciUpper=sr$DirectU[1])
  }
  if (nrow(sr) > 0 && !is.na(sr$Indirect[1])) {
    res$indirect <- list(effect=sr$Indirect[1], ciLower=sr$IndirectL[1], ciUpper=sr$IndirectU[1])
  }
  if (nrow(sr) > 0 && !is.na(sr$SideIF[1]) && !is.null(res$direct) && !is.null(res$indirect)) {
    res$incoherence <- list(
      effect=sr$SideIF[1], ciLower=sr$SideIFlower[1], ciUpper=sr$SideIFupper[1],
      z=sr$SideZ[1], pvalue=sr$SidePvalue[1]
    )
  }
  res
})

# Build v3 dataset from D
v3_studies <- lapply(seq_len(nrow(D)), function(i) {
  row <- as.list(D[i, ])
  if (type == "long_binary") {
    list(study=row$study, id=row$id, treatment=row$t,
         n=row$n, events=row$r, rob=row$rob, indirectness=row$indirectness)
  } else if (type == "long_continuous") {
    list(study=row$study, id=row$id, treatment=row$t,
         n=row$n, mean=row$y, sd=row$sd, rob=row$rob, indirectness=row$indirectness)
  } else {
    list(id=row$id, t1=row$t1, t2=row$t2,
         effect=row$effect, se=row$se, rob=row$rob, indirectness=row$indirectness)
  }
})

# Build pairwise results for v3
pw_results <- lapply(seq_along(pw$subgroup.levels), function(i) {
  list(
    comparison = normalize_comp(pw$subgroup.levels[i]),
    tau2 = pw$tau.w[i]^2,
    I2 = pw$I2.w[i],
    I2Lower = pw$lower.I2.w[i],
    I2Upper = pw$upper.I2.w[i]
  )
})

# League table as list of lists
lt_lol <- lapply(seq_len(nrow(nl)), function(i) as.list(nl[i,]))

# Assemble the .cnm
timestamp <- format(Sys.time(), "%Y-%m-%dT%H:%M:%S.000Z")

cnm <- list(cinema = list(
  version = "3.0.0",
  title = "Elliott_2007",
  createdAt = timestamp,
  updatedAt = timestamp,
  projects = list(list(
    id = paste0("cinema_offline_", as.integer(Sys.time())),
    title = "Elliott_2007",
    outcome = "",
    createdAt = timestamp,
    updatedAt = timestamp,
    hasEvaluation = FALSE,
    dataset = list(
      format = "long",
      type = "binary",
      studies = v3_studies
    ),
    analysis = list(
      params = list(model = model, sm = sm, framework = "frequentist"),
      contributionMatrix = list(
        hatMatrix = list(
          H = mat_to_lol(contribMatrix),
          rowNames = rownames(contribMatrix),
          colNames = colnames(contribMatrix)
        ),
        studyContributions = sc_list
      ),
      frequentist = list(
        nmaResults = nma_results,
        pairwise = pw_results,
        networkHeterogeneity = list(
          tau2 = nma$tau^2,
          Qoverall = nma$Q,
          Qheterogeneity = nma$Q.heterogeneity,
          Qinconsistency = nma$Q.inconsistency
        ),
        designByTreatment = list(
          Q = dbt$Q[1], df = dbt$df[1], pvalue = dbt$pval[1]
        ),
        leagueTable = lt_lol
      ),
      bayesian = NULL
    ),
    evaluation = NULL
  ))
))

outfile <- "Elliott_2007_offline.cnm"
cat("Writing", outfile, "...\n")
writeLines(toJSON(cnm, auto_unbox = TRUE, null = "null", na = "null",
                  force = TRUE, pretty = TRUE), outfile)
cat("Done! Upload", outfile, "into CINeMA.\n")
