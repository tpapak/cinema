# cinema_nma.R
# CINeMA NMA backend – netmeta >= 3.3
#
# Replaces the old `contribution` R package entirely.
# Everything comes from netmeta's public API:
#
#   netmeta()        – NMA
#   netsplit()        – direct / indirect decomposition (SIDE)
#   decomp.design()  – design-by-treatment inconsistency test
#   hatmatrix()       – hat matrix (public since netmeta 2.0)
#   netcontrib()      – per-comparison AND per-study contributions
#                       (study = TRUE, available since netmeta 3.3)
#
# Entry points called from Flask:
#   runNMA(indata, type, model, sm)
#   formatLeagueTable(forleaguetable, model, sm)

library(netmeta)
library(meta)


# ─────────────────────────────────────────────────────────────────────
# runNMA
# ─────────────────────────────────────────────────────────────────────

runNMA <- function(indata, type, model = "fixed", sm) {

  D <- indata

  # 1. Pairwise contrasts + netmeta ────────────────────────────────

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

  # 2. Hat matrix ──────────────────────────────────────────────────

  hm <- hatmatrix(nma, method = "Davies", type = "long")
  if (model == "fixed") {
    H <- hm$common
  } else {
    H <- hm$random
  }

  # 3. Contribution matrix + study contributions (netcontrib) ──────
  #    study = TRUE gives study.common / study.random data frames

  nc <- netcontrib(nma, method = "shortestpath", study = TRUE)
  emptyStudyContrib <- data.frame(
    comparison = character(), study = character(), contribution = numeric(),
    stringsAsFactors = FALSE
  )
  if (model == "fixed") {
    contribMatrix       <- nc$common
    studyContributions  <- if (is.null(nc$study.common)) emptyStudyContrib else nc$study.common
  } else {
    contribMatrix       <- nc$random
    studyContributions  <- if (is.null(nc$study.random)) emptyStudyContrib else nc$study.random
  }

  # 4. Design-by-treatment test ────────────────────────────────────

  dd <- decomp.design(nma)
  if (!is.null(dd$Q.decomp)) {
    dbt <- as.data.frame(dd$Q.decomp)
  } else if (!is.null(dd$Q.inc.random)) {
    dbt <- as.data.frame(dd$Q.inc.random)
  } else {
    dbt <- data.frame(Q = 0, df = 0, pval = 1)
  }

  # 5. Netsplit (SIDE) ─────────────────────────────────────────────

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

  # 6. NMA treatment effects + CIs + prediction intervals ─────────

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

  TE.nma   <- -TE_mat[lower.tri(TE_mat)]
  seTE.nma <- seTE_mat[lower.tri(seTE_mat)]
  LCI.nma  <- -upper_mat[lower.tri(upper_mat)]
  UCI.nma  <- -lower_mat[lower.tri(lower_mat)]
  PrL.nma  <- -nma$upper.predict[lower.tri(nma$upper.predict)]
  PrU.nma  <- -nma$lower.predict[lower.tri(nma$lower.predict)]

  treatnames <- rownames(TE_mat)
  if (is.null(treatnames)) treatnames <- nma$trts

  NMAresults <- data.frame(
    TE       = c(TE.nma),
    seTE     = c(seTE.nma),
    lowerCI  = c(LCI.nma),
    upperCI  = c(UCI.nma),
    lowerPrI = c(PrL.nma),
    upperPrI = c(PrU.nma),
    PropDir  = c(propD)
  )

  # 7. Pairwise heterogeneity ─────────────────────────────────────

  pw <- tryCatch({
    if (type == "iv") {
      comp <- paste(D$t1, D$t2, sep = ":")
      metagen(D$effect, D$se, sm = sm,
              common = (model == "fixed"),
              random = (model == "random"),
              subgroup = comp)
    } else {
      comp <- paste(Dpairs$treat1, Dpairs$treat2, sep = ":")
      metagen(Dpairs$TE, Dpairs$seTE, sm = sm,
              common = (model == "fixed"),
              random = (model == "random"),
              subgroup = comp)
    }
  }, error = function(e) {
    message("Pairwise heterogeneity estimation failed: ", conditionMessage(e))
    NULL
  })

  if (is.null(pw)) {
    Pairwise <- data.frame(
      comparison = character(), tau2 = numeric(),
      I2 = numeric(), I2lower = numeric(), I2upper = numeric(),
      stringsAsFactors = FALSE
    )
  } else {
    Pairwise <- data.frame(
      comparison = pw$subgroup.levels,
      tau2       = c(pw$tau.w^2),
      I2         = c(pw$I2.w),
      I2lower    = c(pw$lower.I2.w),
      I2upper    = c(pw$upper.I2.w),
      stringsAsFactors = FALSE
    )
  }

  # 8. Network heterogeneity ──────────────────────────────────────

  NMAheter <- list(
    tau2           = nma$tau^2,
    Qoverall       = nma$Q,
    Qheterogeneity = nma$Q.heterogeneity,
    Qinconsistency = nma$Q.inconsistency
  )

  # 9. League-table data (raw matrices for both models) ────────────

  TE_common    <- if (!is.null(nma$TE.common))    nma$TE.common    else nma$TE.fixed
  lower_common <- if (!is.null(nma$lower.common)) nma$lower.common else nma$lower.fixed
  upper_common <- if (!is.null(nma$upper.common)) nma$upper.common else nma$upper.fixed

  forleaguetable <- list(
    TE.fixed     = TE_common,
    lower.fixed  = lower_common,
    upper.fixed  = upper_common,
    TE.random    = nma$TE.random,
    lower.random = nma$lower.random,
    upper.random = nma$upper.random,
    treatnames   = treatnames
  )

  # ── Return ─────────────────────────────────────────────────────

  return(list(
    # Hat matrix
    colNames = colnames(H),
    rowNames = rownames(H),
    H        = H,
    # Contribution matrices from netcontrib
    contribMatrix      = contribMatrix,       # per-comparison (%)
    studyContributions = studyContributions,   # per-study (data.frame)
    # NMA results
    NMAresults = NMAresults,
    side       = side,
    # Heterogeneity
    NMAheter = NMAheter,
    Pairwise = Pairwise,
    # Inconsistency
    dbt = dbt,
    # League table
    forleaguetable = forleaguetable,
    # Meta
    model      = model,
    sm         = sm,
    tau        = nma$tau,
    treatnames = treatnames
  ))
}


# ─────────────────────────────────────────────────────────────────────
# formatLeagueTable
# ─────────────────────────────────────────────────────────────────────

formatLeagueTable <- function(forleaguetable, model, sm) {

  x <- forleaguetable

  formatCI_safe <- function(lower, upper) {
    tryCatch(
      meta:::formatCI(lower, upper),
      error = function(e) {
        paste0("(", format(lower), ", ", format(upper), ")")
      }
    )
  }

  tryCatch(meta:::cilayout(bracket = "(", separator = ", "),
           error = function(e) NULL)

  treatnames <- x$treatnames

  if (model == "fixed") {
    TE_raw  <- x$TE.fixed
    low_raw <- x$lower.fixed
    up_raw  <- x$upper.fixed
  } else {
    TE_raw  <- x$TE.random
    low_raw <- x$lower.random
    up_raw  <- x$upper.random
  }

  if (sm %in% c("OR", "RR", "HR")) {
    TE_x    <- exp(TE_raw)
    lower_x <- exp(low_raw)
    upper_x <- exp(up_raw)
  } else {
    TE_x    <- TE_raw
    lower_x <- low_raw
    upper_x <- up_raw
  }

  TE_x    <- format(round(TE_x, 3))
  lower_x <- round(lower_x, 3)
  upper_x <- round(upper_x, 3)

  nl <- paste(TE_x, formatCI_safe(lower_x, upper_x))
  nl <- matrix(nl, nrow = nrow(TE_raw), ncol = ncol(TE_raw))
  diag(nl) <- treatnames

  return(nl)
}
