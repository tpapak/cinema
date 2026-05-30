#' Build the frequentist structural block for a .cnm file
#'
#' Runs \pkg{netmeta} on the supplied data and assembles every quantity CINeMA
#' needs that a Bayesian model cannot provide: the hat (contribution) matrix and
#' per-study contributions, prop-direct, the design-by-treatment inconsistency
#' test, pairwise and network heterogeneity, the netsplit (SIDE) decomposition,
#' prediction intervals and the league table.
#'
#' This mirrors the offline R script CINeMA generates from its UI, so the output
#' is byte-compatible with what CINeMA expects in `analysis.frequentist`,
#' `analysis.contributionMatrix` and `dataset.studies`.
#'
#' @param data A data frame in long or inverse-variance form.
#'   For `type = "long_binary"`: columns `study, id, t, r, n, rob, indirectness`.
#'   For `type = "long_continuous"`: columns `study, id, t, y, sd, n, rob, indirectness`.
#'   For `type = "iv"`: columns `id, t1, t2, effect, se, rob, indirectness`.
#' @param type One of `"long_binary"`, `"long_continuous"`, `"iv"`.
#' @param sm Effect measure, e.g. `"OR"`, `"RR"`, `"RD"`, `"MD"`, `"SMD"`.
#' @param model `"random"` (default) or `"fixed"` — selects which netmeta
#'   estimates populate the structural block.
#' @param dataset_type For `type = "iv"` only: the CINeMA dataset type,
#'   `"binary"` or `"continuous"` (default `"continuous"`).
#'
#' @return A list with elements `studies`, `contributionMatrix`, `frequentist`,
#'   `treatnames`, `dataset_format`, `dataset_type`, `model`, `sm`.
#' @export
cnm_frequentist_block <- function(data, type, sm, model = "random",
                                  dataset_type = "continuous") {
  .need("netmeta")
  .need("meta")
  type <- match.arg(type, c("long_binary", "long_continuous", "iv"))
  model <- match.arg(model, c("random", "fixed"))

  D <- data

  # 1. Pairwise contrasts + netmeta ----------------------------------------
  Dpairs <- NULL
  if (type == "long_binary") {
    Dpairs <- meta::pairwise(treat = t, event = r, n = n,
                             data = D, studlab = id, sm = sm,
                             allstudies = TRUE)
    nma <- netmeta::netmeta(TE, seTE, treat1, treat2, studlab,
                            data = Dpairs, sm = sm,
                            common = TRUE, random = TRUE)
  } else if (type == "long_continuous") {
    Dpairs <- meta::pairwise(treat = t, mean = y, sd = sd, n = n,
                             data = D, studlab = id, sm = sm)
    nma <- netmeta::netmeta(TE, seTE, treat1, treat2, studlab,
                            data = Dpairs, sm = sm,
                            common = TRUE, random = TRUE,
                            tol.multiarm = 0.05)
  } else {
    nma <- netmeta::netmeta(effect, se, t1, t2, id,
                            data = D, sm = sm,
                            common = TRUE, random = TRUE,
                            tol.multiarm = 0.05)
  }

  # 2. Hat / contribution matrix -------------------------------------------
  nc <- netmeta::netcontrib(nma, method = "shortestpath", study = TRUE)
  contribMatrix <- if (model == "fixed") nc$common else nc$random
  studyContribs <- if (model == "fixed") nc$study.common else nc$study.random
  if (is.null(studyContribs)) {
    studyContribs <- data.frame(comparison = character(), study = character(),
                                contribution = numeric(), stringsAsFactors = FALSE)
  }

  # 3. Design-by-treatment test --------------------------------------------
  dd <- netmeta::decomp.design(nma)
  if (!is.null(dd$Q.decomp)) {
    dbt <- as.data.frame(dd$Q.decomp)
  } else if (!is.null(dd$Q.inc.random)) {
    dbt <- as.data.frame(dd$Q.inc.random)
  } else {
    dbt <- data.frame(Q = 0, df = 0, pval = 1)
  }

  # 4. Netsplit (SIDE) ------------------------------------------------------
  ss <- netmeta::netsplit(nma)
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
    Direct      = pick("direct",  "TE"),
    DirectL     = pick("direct",  "lower"),
    DirectU     = pick("direct",  "upper"),
    Indirect    = pick("indirect","TE"),
    IndirectL   = pick("indirect","lower"),
    IndirectU   = pick("indirect","upper"),
    SideIF      = pick("compare", "TE"),
    SideIFlower = pick("compare", "lower"),
    SideIFupper = pick("compare", "upper"),
    SideZ       = pick("compare", "z"),
    SidePvalue  = pick("compare", "p"),
    PropDir     = pickProp(),
    stringsAsFactors = FALSE
  )
  side$comp_norm <- .normalize_comp(side$comparison)

  # 5. NMA effects + CIs + prediction intervals ----------------------------
  pickmat <- function(stem) {
    if (model == "fixed") {
      m <- nma[[paste0(stem, ".common")]]
      if (is.null(m)) m <- nma[[paste0(stem, ".fixed")]]
      m
    } else {
      nma[[paste0(stem, ".random")]]
    }
  }
  TE_mat    <- pickmat("TE")
  seTE_mat  <- pickmat("seTE")
  lower_mat <- pickmat("lower")
  upper_mat <- pickmat("upper")

  treatnames <- rownames(TE_mat)
  if (is.null(treatnames)) treatnames <- nma$trts
  n_treats <- length(treatnames)

  TE.nma   <- -TE_mat[lower.tri(TE_mat)]
  seTE.nma <- seTE_mat[lower.tri(seTE_mat)]
  LCI.nma  <- -upper_mat[lower.tri(upper_mat)]
  UCI.nma  <- -lower_mat[lower.tri(lower_mat)]
  PrL.nma  <- -nma$upper.predict[lower.tri(nma$upper.predict)]
  PrU.nma  <- -nma$lower.predict[lower.tri(nma$lower.predict)]

  comp_ids <- character(0)
  for (j in seq_len(n_treats)) {
    for (i in seq_len(n_treats)) {
      if (i > j) comp_ids <- c(comp_ids, paste0(treatnames[j], ":", treatnames[i]))
    }
  }

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
      propDirect = if (nrow(sr) > 0 && !is.na(sr$PropDir[1])) sr$PropDir[1] else 0
    )
    if (nrow(sr) > 0 && !is.na(sr$Direct[1])) {
      res$direct <- list(effect = sr$Direct[1], ciLower = sr$DirectL[1], ciUpper = sr$DirectU[1])
    }
    if (nrow(sr) > 0 && !is.na(sr$Indirect[1])) {
      res$indirect <- list(effect = sr$Indirect[1], ciLower = sr$IndirectL[1], ciUpper = sr$IndirectU[1])
    }
    if (nrow(sr) > 0 && !is.na(sr$SideIF[1]) && !is.null(res$direct) && !is.null(res$indirect)) {
      res$incoherence <- list(effect = sr$SideIF[1], ciLower = sr$SideIFlower[1],
                              ciUpper = sr$SideIFupper[1], z = sr$SideZ[1], pvalue = sr$SidePvalue[1])
    }
    res
  })

  # 6. Pairwise heterogeneity ----------------------------------------------
  pw <- tryCatch({
    if (type == "iv") {
      comp <- paste(D$t1, D$t2, sep = ":")
      meta::metagen(D$effect, D$se, sm = sm,
                    common = (model == "fixed"), random = (model == "random"),
                    subgroup = comp)
    } else {
      comp <- paste(Dpairs$treat1, Dpairs$treat2, sep = ":")
      meta::metagen(Dpairs$TE, Dpairs$seTE, sm = sm,
                    common = (model == "fixed"), random = (model == "random"),
                    subgroup = comp)
    }
  }, error = function(e) NULL)

  pw_results <- if (is.null(pw)) list() else lapply(seq_along(pw$subgroup.levels), function(i) {
    list(comparison = .normalize_comp(pw$subgroup.levels[i]),
         tau2 = pw$tau.w[i]^2, I2 = pw$I2.w[i],
         I2Lower = pw$lower.I2.w[i], I2Upper = pw$upper.I2.w[i])
  })

  # 7. Study contributions: comparison -> {study: proportion} --------------
  sc_list <- list()
  for (comp in unique(studyContribs$comparison)) {
    rows <- studyContribs[studyContribs$comparison == comp, ]
    sc_entry <- list()
    for (r in seq_len(nrow(rows))) {
      sc_entry[[as.character(rows$study[r])]] <- rows$contribution[r]
    }
    sc_list[[.normalize_comp(comp)]] <- sc_entry
  }

  # 8. League table ---------------------------------------------------------
  nl <- .frequentist_league(nma, model, sm, treatnames, n_treats)

  # 9. Dataset studies ------------------------------------------------------
  studies <- .dataset_studies(D, type)
  dataset_format <- if (type == "iv") "iv" else "long"
  dtype <- if (type == "long_binary") "binary"
           else if (type == "long_continuous") "continuous"
           else dataset_type

  list(
    studies = studies,
    dataset_format = dataset_format,
    dataset_type = dtype,
    model = model,
    sm = sm,
    treatnames = treatnames,
    contributionMatrix = list(
      hatMatrix = list(
        H = .mat_to_lol(contribMatrix),
        rowNames = rownames(contribMatrix),
        colNames = colnames(contribMatrix)
      ),
      studyContributions = sc_list
    ),
    frequentist = list(
      nmaResults = nma_results,
      pairwise = pw_results,
      networkHeterogeneity = list(
        tau2 = nma$tau^2, Qoverall = nma$Q,
        Qheterogeneity = nma$Q.heterogeneity, Qinconsistency = nma$Q.inconsistency
      ),
      designByTreatment = list(Q = dbt$Q[1], df = dbt$df[1], pvalue = dbt$pval[1]),
      leagueTable = nl
    )
  )
}

# League table as a list-of-rows of strings (diagonal = treatment names).
.frequentist_league <- function(nma, model, sm, treatnames, n_treats) {
  formatCI_safe <- function(lower, upper) {
    paste0("(", format(lower), ", ", format(upper), ")")
  }

  pickmat <- function(stem) {
    if (model == "fixed") {
      m <- nma[[paste0(stem, ".common")]]
      if (is.null(m)) m <- nma[[paste0(stem, ".fixed")]]
      m
    } else nma[[paste0(stem, ".random")]]
  }
  TE_lt  <- pickmat("TE")
  low_lt <- pickmat("lower")
  up_lt  <- pickmat("upper")

  if (sm %in% c("OR", "RR", "HR")) {
    TE_x <- exp(TE_lt); lower_x <- exp(low_lt); upper_x <- exp(up_lt)
  } else {
    TE_x <- TE_lt; lower_x <- low_lt; upper_x <- up_lt
  }
  TE_x <- format(round(TE_x, 3)); lower_x <- round(lower_x, 3); upper_x <- round(upper_x, 3)
  nl <- paste(TE_x, formatCI_safe(lower_x, upper_x))
  nl <- matrix(nl, nrow = n_treats, ncol = n_treats)
  diag(nl) <- treatnames
  lapply(seq_len(nrow(nl)), function(i) as.list(nl[i, ]))
}

# Per-arm / per-contrast study objects for dataset.studies.
.dataset_studies <- function(D, type) {
  lapply(seq_len(nrow(D)), function(i) {
    row <- as.list(D[i, ])
    if (type == "long_binary") {
      list(study = row$study, id = row$id, treatment = row$t,
           n = row$n, events = row$r, rob = row$rob, indirectness = row$indirectness)
    } else if (type == "long_continuous") {
      list(study = row$study, id = row$id, treatment = row$t,
           n = row$n, mean = row$y, sd = row$sd, rob = row$rob, indirectness = row$indirectness)
    } else {
      list(id = row$id, t1 = row$t1, t2 = row$t2,
           effect = row$effect, se = row$se, rob = row$rob, indirectness = row$indirectness)
    }
  })
}
