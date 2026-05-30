#' Assemble a v3 .cnm object from a frequentist block and optional Bayesian block
#'
#' Low-level assembler. Most users want [cinema_cnm()] or [write_cinema_cnm()].
#'
#' @param freq A frequentist block from [cnm_frequentist_block()].
#' @param bayesian Optional Bayesian block from [cnm_bayesian_block()] /
#'   [cnm_bayesian_gemtc()]. When supplied, `params.framework` becomes
#'   `"bayesian"`.
#' @param title Project title.
#' @param outcome Optional outcome label.
#'
#' @return A nested list matching cinema_schema_v3.json, ready for [write_cnm()].
#' @export
build_cnm <- function(freq, bayesian = NULL, title = "project", outcome = "") {
  framework <- if (is.null(bayesian)) "frequentist" else "bayesian"
  ts <- .cnm_timestamp()

  list(cinema = list(
    version = "3.0.0",
    title = title,
    createdAt = ts,
    updatedAt = ts,
    projects = list(list(
      id = paste0("cinema_r_", as.integer(Sys.time())),
      title = title,
      outcome = outcome,
      createdAt = ts,
      updatedAt = ts,
      hasEvaluation = FALSE,
      dataset = list(
        format = freq$dataset_format,
        type = freq$dataset_type,
        studies = freq$studies
      ),
      analysis = list(
        params = list(model = freq$model, sm = freq$sm, framework = framework),
        contributionMatrix = freq$contributionMatrix,
        frequentist = freq$frequentist,
        bayesian = bayesian
      ),
      evaluation = NULL
    ))
  ))
}

#' Build a CINeMA v3 .cnm object from NMA data
#'
#' One-call entry point. Runs \pkg{netmeta} for the structural block CINeMA
#' needs, and — when a Bayesian fit is supplied — attaches the Bayesian
#' posterior results as the primary estimates.
#'
#' @param data NMA data frame (see [cnm_frequentist_block()] for the expected
#'   columns per `type`).
#' @param type One of `"long_binary"`, `"long_continuous"`, `"iv"`.
#' @param sm Effect measure, e.g. `"OR"`, `"MD"`.
#' @param model `"random"` (default) or `"fixed"`.
#' @param bayesian Optional Bayesian results. Accepts a `gemtc` `mtc.result`
#'   (extracted via [cnm_bayesian_gemtc()]), a data frame of comparisons
#'   (passed to [cnm_bayesian_block()]), or an already-built Bayesian block list.
#' @param title Project title.
#' @param outcome Optional outcome label.
#' @param dataset_type For `type = "iv"`: `"binary"` or `"continuous"`.
#' @param ... Passed to [cnm_bayesian_gemtc()] when `bayesian` is a gemtc result
#'   (e.g. `nodesplit`, `ranks`, `flip`).
#'
#' @return A nested list matching cinema_schema_v3.json.
#' @export
cinema_cnm <- function(data, type, sm, model = "random", bayesian = NULL,
                       title = "project", outcome = "",
                       dataset_type = "continuous", ...) {
  freq <- cnm_frequentist_block(data, type = type, sm = sm, model = model,
                                dataset_type = dataset_type)
  bblock <- .coerce_bayesian(bayesian, ...)
  build_cnm(freq, bayesian = bblock, title = title, outcome = outcome)
}

#' Write a CINeMA v3 .cnm file from NMA data
#'
#' Convenience wrapper around [cinema_cnm()] that serialises the result to disk.
#'
#' @inheritParams cinema_cnm
#' @param file Output path. Defaults to a sanitised `title` with extension
#'   `.cnm`.
#' @return The output path, invisibly.
#' @export
write_cinema_cnm <- function(data, type, sm, model = "random", bayesian = NULL,
                             title = "project", outcome = "",
                             dataset_type = "continuous",
                             file = NULL, ...) {
  cnm <- cinema_cnm(data, type = type, sm = sm, model = model, bayesian = bayesian,
                    title = title, outcome = outcome, dataset_type = dataset_type, ...)
  if (is.null(file)) file <- paste0(.safe_filename(title), ".cnm")
  write_cnm(cnm, file)
}

#' Serialise a .cnm object to a file
#'
#' @param cnm A list from [build_cnm()] / [cinema_cnm()].
#' @param file Output path.
#' @return The output path, invisibly.
#' @export
write_cnm <- function(cnm, file) {
  json <- jsonlite::toJSON(cnm, auto_unbox = TRUE, null = "null", na = "null",
                           force = TRUE, pretty = TRUE)
  writeLines(json, file)
  invisible(file)
}

# Turn whatever the user passed as `bayesian` into a schema-shaped block (or NULL).
.coerce_bayesian <- function(bayesian, ...) {
  if (is.null(bayesian)) return(NULL)
  if (inherits(bayesian, "mtc.result")) return(cnm_bayesian_gemtc(bayesian, ...))
  if (is.data.frame(bayesian)) return(cnm_bayesian_block(bayesian))
  if (is.list(bayesian) && !is.null(bayesian$nmaResults)) return(bayesian) # already built
  stop("`bayesian` must be a gemtc mtc.result, a comparisons data frame, or a ",
       "Bayesian block list (from cnm_bayesian_block).", call. = FALSE)
}
