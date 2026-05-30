# Convention (must match the frequentist block produced by netmeta):
# a comparison id "A:B" (A < B alphabetically) reports the effect of A
# relative to B, on the linear/log scale of the chosen effect measure.
# CINeMA reads the Bayesian block as primary when params.framework == "bayesian",
# so its orientation must agree with the frequentist league table.

#' Build the Bayesian block of a .cnm file from extracted tables
#'
#' Backend-agnostic constructor. Supply posterior summaries already in CINeMA's
#' comparison convention (`"A:B"` = effect of A relative to B). This is the
#' recommended integration point for MetaInsight, which already holds its
#' relative-effect table, tau, nodesplit, ranking and DIC.
#'
#' @param comparisons A data frame, one row per comparison, with columns
#'   `comparison` (`"A:B"`), `effect`, `ciLower`, `ciUpper`, and optionally
#'   `se`, `priLower`, `priUpper`.
#' @param tau Optional named numeric / list with `mean`, `ciLower`, `ciUpper`
#'   (posterior between-study SD).
#' @param nodesplit Optional data frame with columns `comparison`,
#'   `directEffect`, `directLower`, `directUpper`, `indirectEffect`,
#'   `indirectLower`, `indirectUpper`, `pvalue`.
#' @param sucra Optional data frame with columns `treatment`, `sucra` (0-100)
#'   and optionally a list-column `rankProbabilities`.
#' @param dic Optional list/named numeric with `Dbar`, `pD`, `DIC`, `dataPoints`.
#' @param leagueTable Optional list-of-rows (strings) Bayesian league table.
#'
#' @return A list shaped as the schema `bayesianResults` object.
#' @export
cnm_bayesian_block <- function(comparisons, tau = NULL, nodesplit = NULL,
                               sucra = NULL, dic = NULL, leagueTable = NULL) {
  stopifnot(is.data.frame(comparisons))
  req <- c("comparison", "effect", "ciLower", "ciUpper")
  miss <- setdiff(req, names(comparisons))
  if (length(miss)) stop("comparisons is missing columns: ", paste(miss, collapse = ", "),
                         call. = FALSE)

  nmaResults <- lapply(seq_len(nrow(comparisons)), function(i) {
    row <- comparisons[i, ]
    res <- list(
      comparison = .normalize_comp(as.character(row$comparison)),
      effect  = as.numeric(row$effect),
      ciLower = as.numeric(row$ciLower),
      ciUpper = as.numeric(row$ciUpper)
    )
    res$se       <- .num_or_null(row[["se"]])
    res$priLower <- .num_or_null(row[["priLower"]])
    res$priUpper <- .num_or_null(row[["priUpper"]])
    res[!vapply(res, is.null, logical(1))]
  })

  out <- list(nmaResults = nmaResults)

  if (!is.null(tau)) {
    out$tau <- list(mean = .num_or_null(tau[["mean"]]),
                    ciLower = .num_or_null(tau[["ciLower"]]),
                    ciUpper = .num_or_null(tau[["ciUpper"]]))
  }

  if (!is.null(nodesplit) && is.data.frame(nodesplit) && nrow(nodesplit) > 0) {
    out$nodesplit <- lapply(seq_len(nrow(nodesplit)), function(i) {
      r <- nodesplit[i, ]
      list(
        comparison = .normalize_comp(as.character(r$comparison)),
        direct   = list(effect = as.numeric(r$directEffect),
                        ciLower = as.numeric(r$directLower),
                        ciUpper = as.numeric(r$directUpper)),
        indirect = list(effect = as.numeric(r$indirectEffect),
                        ciLower = as.numeric(r$indirectLower),
                        ciUpper = as.numeric(r$indirectUpper)),
        pvalue   = as.numeric(r$pvalue)
      )
    })
  }

  if (!is.null(sucra) && is.data.frame(sucra) && nrow(sucra) > 0) {
    out$sucra <- lapply(seq_len(nrow(sucra)), function(i) {
      r <- sucra[i, ]
      entry <- list(treatment = as.character(r$treatment), sucra = as.numeric(r$sucra))
      rp <- r[["rankProbabilities"]]
      if (!is.null(rp)) {
        if (is.list(rp)) rp <- rp[[1]]
        entry$rankProbabilities <- as.numeric(rp)
      }
      entry
    })
  }

  if (!is.null(dic)) {
    out$dic <- list(Dbar = .num_or_null(dic[["Dbar"]]), pD = .num_or_null(dic[["pD"]]),
                    DIC = .num_or_null(dic[["DIC"]]),
                    dataPoints = as.integer(dic[["dataPoints"]]))
  }

  if (!is.null(leagueTable)) out$leagueTable <- leagueTable

  out
}

#' Extract a Bayesian block directly from gemtc objects
#'
#' Convenience wrapper that pulls posterior summaries out of a fitted
#' \pkg{gemtc} model (`gemtc::mtc.run` result) and optional nodesplit / ranking
#' objects, then hands them to [cnm_bayesian_block()].
#'
#' Orientation: gemtc's basic parameters `d.A.B` are the effect of B relative to
#' A. CINeMA reports `"A:B"` as A relative to B, so effects are negated to match
#' (set `flip = TRUE` if a sanity check against the frequentist league table
#' shows the table transposed for your gemtc version).
#'
#' @param result A `mtc.result` from `gemtc::mtc.run()`.
#' @param nodesplit Optional `mtc.nodesplit` result from `gemtc::mtc.nodesplit()`.
#' @param ranks Optional rank-probability matrix from
#'   `gemtc::rank.probability(result)` (treatments x ranks).
#' @param data_points Optional integer number of data points for DIC; inferred
#'   from the network when omitted.
#' @param flip Logical; invert the effect orientation (default `FALSE`).
#'
#' @return A list shaped as the schema `bayesianResults` object.
#' @export
cnm_bayesian_gemtc <- function(result, nodesplit = NULL, ranks = NULL,
                               data_points = NULL, flip = FALSE) {
  .need("gemtc")
  s <- summary(result)

  # --- relative effects ---------------------------------------------------
  tbl <- gemtc::relative.effect.table(result)
  trts <- dimnames(tbl)[[1]]
  qn <- dimnames(tbl)[[3]]
  q_lo <- .match_q(qn, c("2.5%", "2.5", "lower"))
  q_md <- .match_q(qn, c("50%", "50", "median", "mean"))
  q_hi <- .match_q(qn, c("97.5%", "97.5", "upper"))

  rows <- list()
  for (a in seq_along(trts)) {
    for (b in seq_along(trts)) {
      if (b <= a) next
      A <- trts[a]; B <- trts[b]
      # tbl[A, B, ] = effect of B relative to A; we want A relative to B.
      sgn <- if (flip) 1 else -1
      e  <- sgn * tbl[A, B, q_md]
      lo <- sgn * tbl[A, B, if (sgn < 0) q_hi else q_lo]
      hi <- sgn * tbl[A, B, if (sgn < 0) q_lo else q_hi]
      rows[[length(rows) + 1L]] <- data.frame(
        comparison = paste(sort(c(A, B)), collapse = ":"),
        effect = e, ciLower = lo, ciUpper = hi, stringsAsFactors = FALSE)
    }
  }
  comparisons <- do.call(rbind, rows)

  # --- tau (sd.d) ---------------------------------------------------------
  tau <- tryCatch({
    stat <- s$summaries$statistics
    quant <- s$summaries$quantiles
    rn <- grep("^sd\\.d", rownames(stat), value = TRUE)
    if (length(rn)) {
      list(mean = stat[rn[1], "Mean"],
           ciLower = quant[rn[1], "2.5%"], ciUpper = quant[rn[1], "97.5%"])
    } else NULL
  }, error = function(e) NULL)

  # --- DIC ----------------------------------------------------------------
  dic <- tryCatch({
    d <- s$DIC
    getn <- function(nms) { i <- which(names(d) %in% nms); if (length(i)) unname(d[i[1]]) else NA }
    dp <- data_points
    if (is.null(dp)) dp <- tryCatch(nrow(result$model$network$data.ab), error = function(e) NA)
    list(Dbar = getn(c("Dbar", "D.bar")), pD = getn("pD"),
         DIC = getn("DIC"), dataPoints = dp)
  }, error = function(e) NULL)

  # --- SUCRA from rank probabilities --------------------------------------
  sucra <- NULL
  if (!is.null(ranks)) sucra <- .sucra_from_ranks(ranks)

  # --- nodesplit ----------------------------------------------------------
  ns <- if (is.null(nodesplit)) NULL else .gemtc_nodesplit(nodesplit, flip)

  cnm_bayesian_block(comparisons, tau = tau, nodesplit = ns, sucra = sucra, dic = dic)
}

# Pick the first matching quantile dimname (case-insensitive).
.match_q <- function(have, want) {
  idx <- which(tolower(have) %in% tolower(want))
  if (length(idx)) return(have[idx[1]])
  stop("Could not find a quantile dimension matching ", paste(want, collapse = "/"),
       " in gemtc relative.effect.table (have: ", paste(have, collapse = ", "), ").",
       call. = FALSE)
}

# SUCRA (%) and rank probabilities from a treatment x rank probability matrix.
.sucra_from_ranks <- function(ranks) {
  ranks <- as.matrix(ranks)
  K <- ncol(ranks)
  trts <- rownames(ranks)
  out <- lapply(seq_len(nrow(ranks)), function(i) {
    p <- ranks[i, ]
    cum <- cumsum(p)
    sucra <- if (K > 1) sum(cum[1:(K - 1)]) / (K - 1) * 100 else 100
    data.frame(treatment = trts[i], sucra = sucra,
               rankProbabilities = I(list(as.numeric(p))), stringsAsFactors = FALSE)
  })
  do.call(rbind, out)
}

# Convert a gemtc nodesplit result to the generic nodesplit data frame.
.gemtc_nodesplit <- function(nodesplit, flip) {
  sm <- tryCatch(summary(nodesplit), error = function(e) NULL)
  if (is.null(sm)) return(NULL)
  df <- tryCatch(as.data.frame(sm), error = function(e) NULL)
  if (is.null(df) || !nrow(df)) return(NULL)
  # gemtc summary columns vary; locate by fuzzy name.
  pick <- function(pat) { i <- grep(pat, names(df), ignore.case = TRUE); if (length(i)) df[[i[1]]] else NA }
  comp <- pick("compar|name")
  data.frame(
    comparison = as.character(comp),
    directEffect = pick("^dir.*(med|eff|mean)|direct$"),
    directLower  = pick("dir.*(2\\.5|low)"),
    directUpper  = pick("dir.*(97\\.5|upp)"),
    indirectEffect = pick("^ind.*(med|eff|mean)|indirect$"),
    indirectLower  = pick("ind.*(2\\.5|low)"),
    indirectUpper  = pick("ind.*(97\\.5|upp)"),
    pvalue = pick("p.?val"),
    stringsAsFactors = FALSE
  )
}
