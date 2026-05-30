# Build a small inverse-variance network from netmeta's Senn2013 dataset.
iv_data <- function() {
  skip_if_not_installed("netmeta")
  data("Senn2013", package = "netmeta", envir = environment())
  d <- get("Senn2013", envir = environment())
  data.frame(
    id  = d$studlab,
    t1  = d$treat1,
    t2  = d$treat2,
    effect = d$TE,
    se  = d$seTE,
    rob = 1L,
    indirectness = 1L,
    stringsAsFactors = FALSE
  )
}

test_that("frequentist block has the structural pieces CINeMA needs", {
  fb <- cnm_frequentist_block(iv_data(), type = "iv", sm = "MD", model = "random")

  expect_true(length(fb$treatnames) >= 3)
  expect_equal(fb$dataset_format, "iv")

  cm <- fb$contributionMatrix
  expect_true(length(cm$hatMatrix$H) >= 1)
  expect_true(length(cm$hatMatrix$rowNames) >= 1)
  expect_true(length(cm$hatMatrix$colNames) >= 1)
  expect_type(cm$studyContributions, "list")

  fq <- fb$frequentist
  expect_true(length(fq$nmaResults) >= 1)
  one <- fq$nmaResults[[1]]
  for (k in c("comparison", "effect", "se", "ciLower", "ciUpper",
              "priLower", "priUpper", "propDirect")) {
    expect_true(k %in% names(one), info = k)
  }
  # comparison ids are alphabetically normalised "A:B"
  expect_match(one$comparison, "^[^:]+:[^:]+$")
  expect_true(!is.null(fq$networkHeterogeneity$tau2))
  expect_true(!is.null(fq$designByTreatment$pvalue))
  expect_true(length(fq$leagueTable) == length(fb$treatnames))
})

test_that("frequentist-only cnm assembles and round-trips through JSON", {
  cnm <- cinema_cnm(iv_data(), type = "iv", sm = "MD", title = "senn-test")
  expect_equal(cnm$cinema$version, "3.0.0")
  proj <- cnm$cinema$projects[[1]]
  expect_equal(proj$analysis$params$framework, "frequentist")
  expect_null(proj$analysis$bayesian)

  tmp <- tempfile(fileext = ".cnm")
  write_cnm(cnm, tmp)
  back <- jsonlite::fromJSON(tmp, simplifyVector = FALSE)
  expect_equal(back$cinema$version, "3.0.0")
  expect_equal(back$cinema$projects[[1]]$analysis$params$framework, "frequentist")
})

test_that("generic Bayesian block flips framework and is primary", {
  fb <- cnm_frequentist_block(iv_data(), type = "iv", sm = "MD")
  comps <- do.call(rbind, lapply(fb$frequentist$nmaResults, function(r) {
    data.frame(comparison = r$comparison, effect = r$effect,
               ciLower = r$ciLower, ciUpper = r$ciUpper,
               priLower = r$priLower, priUpper = r$priUpper,
               stringsAsFactors = FALSE)
  }))
  bblock <- cnm_bayesian_block(
    comps,
    tau = list(mean = 0.12, ciLower = 0.01, ciUpper = 0.4),
    dic = list(Dbar = 40, pD = 12, DIC = 52, dataPoints = 50)
  )
  expect_true(length(bblock$nmaResults) == nrow(comps))
  expect_equal(bblock$tau$mean, 0.12)
  expect_equal(bblock$dic$dataPoints, 50L)

  cnm <- build_cnm(fb, bayesian = bblock, title = "senn-bayes")
  proj <- cnm$cinema$projects[[1]]
  expect_equal(proj$analysis$params$framework, "bayesian")
  expect_false(is.null(proj$analysis$bayesian))
  # frequentist block is still present (contribution matrix etc.)
  expect_false(is.null(proj$analysis$frequentist$nmaResults))
  expect_false(is.null(proj$analysis$contributionMatrix$hatMatrix))
})

test_that("SUCRA is computed correctly from rank probabilities", {
  # 3 treatments; A best, C worst.
  ranks <- matrix(c(0.8, 0.2, 0.0,
                    0.2, 0.6, 0.2,
                    0.0, 0.2, 0.8),
                  nrow = 3, byrow = TRUE,
                  dimnames = list(c("A", "B", "C"), c("1", "2", "3")))
  s <- cinemar:::.sucra_from_ranks(ranks)
  # SUCRA_A = (cum1 + cum2)/2 = (0.8 + 1.0)/2 = 0.9 -> 90
  expect_equal(s$sucra[s$treatment == "A"], 90)
  expect_equal(s$sucra[s$treatment == "B"], 50)
  expect_equal(s$sucra[s$treatment == "C"], 10)
})
