# Create + validate a Bayesian block from a real gemtc fit (MetaInsight-style):
# binary outcome, OR, random effects, on gemtc's bundled `smoking` dataset.
# Skipped unless gemtc (and JAGS) are available.

fit_smoking <- function() {
  skip_if_not_installed("gemtc")
  suppressMessages(library(gemtc))
  data("smoking", package = "gemtc", envir = environment())
  ab <- get("smoking", envir = environment())$data.ab
  net <- mtc.network(ab)
  model <- mtc.model(net, likelihood = "binom", link = "logit",
                     linearModel = "random", n.chain = 2)
  res <- mtc.run(model, n.adapt = 500, n.iter = 1500, thin = 1)
  list(res = res, ab = ab,
       ranks = rank.probability(res, preferredDirection = 1))
}

test_that("cnm_bayesian_gemtc extracts a complete Bayesian block", {
  f <- fit_smoking()
  bb <- cnm_bayesian_gemtc(f$res, ranks = f$ranks)

  # 4 treatments -> 6 comparisons
  expect_equal(length(bb$nmaResults), 6)
  for (r in bb$nmaResults) {
    expect_true(all(c("comparison", "effect", "ciLower", "ciUpper") %in% names(r)))
    expect_true(r$ciLower <= r$effect && r$effect <= r$ciUpper)
    expect_match(r$comparison, "^[^:]+:[^:]+$")
  }
  expect_true(bb$tau$mean > 0)
  expect_true(bb$tau$ciLower <= bb$tau$ciUpper)
  expect_equal(bb$dic$dataPoints, 50L)
  expect_true(bb$dic$DIC > 0)
  expect_equal(length(bb$sucra), 4)
  for (s in bb$sucra) {
    expect_true(s$sucra >= 0 && s$sucra <= 100)
    expect_equal(length(s$rankProbabilities), 4)
  }
})

test_that("Bayesian and frequentist effects share orientation (no flip needed)", {
  f <- fit_smoking()
  bb <- cnm_bayesian_gemtc(f$res)
  fb <- cnm_frequentist_block(
    data.frame(study = f$ab$study, id = f$ab$study, t = f$ab$treatment,
               r = f$ab$responders, n = f$ab$sampleSize,
               rob = 1L, indirectness = 1L, stringsAsFactors = FALSE),
    type = "long_binary", sm = "OR", model = "random")

  freq <- setNames(vapply(fb$frequentist$nmaResults, `[[`, numeric(1), "effect"),
                   vapply(fb$frequentist$nmaResults, `[[`, character(1), "comparison"))
  bayes <- setNames(vapply(bb$nmaResults, `[[`, numeric(1), "effect"),
                    vapply(bb$nmaResults, `[[`, character(1), "comparison"))
  common <- intersect(names(freq), names(bayes))
  expect_gt(length(common), 0)
  # Same comparison convention => same sign for every comparison.
  expect_true(all(sign(freq[common]) == sign(bayes[common])))
})

test_that("write_cinema_cnm with a gemtc fit produces a bayesian-framework file", {
  f <- fit_smoking()
  D <- data.frame(study = f$ab$study, id = f$ab$study, t = f$ab$treatment,
                  r = f$ab$responders, n = f$ab$sampleSize,
                  rob = 1L, indirectness = 1L, stringsAsFactors = FALSE)
  tmp <- tempfile(fileext = ".cnm")
  write_cinema_cnm(D, type = "long_binary", sm = "OR", model = "random",
                   bayesian = f$res, ranks = f$ranks,
                   title = "Smoking (Bayesian)", file = tmp)

  back <- jsonlite::fromJSON(tmp, simplifyVector = FALSE)
  a <- back$cinema$projects[[1]]$analysis
  expect_equal(a$params$framework, "bayesian")
  expect_false(is.null(a$bayesian$nmaResults))         # Bayesian primary results
  expect_false(is.null(a$frequentist$nmaResults))      # frequentist fallback present
  expect_false(is.null(a$contributionMatrix$hatMatrix)) # structural block present
})
