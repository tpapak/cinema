#!/usr/bin/env Rscript
# run_cli.R
# JSON CLI wrapper for cinema_nma.R
#
# Reads a JSON request from stdin, calls runNMA or formatLeagueTable,
# writes JSON result to stdout.
#
# Usage:
#   echo '{"action":"runNMA","indata":[...],"type":"long_binary","model":"fixed","sm":"OR"}' | Rscript run_cli.R
#   echo '{"action":"leaguetable","forleaguetable":{...},"model":"fixed","sm":"OR"}' | Rscript run_cli.R
#   echo '{"action":"health"}' | Rscript run_cli.R

library(jsonlite)

# Source the main NMA functions (relative to this script's location)
args <- commandArgs(trailingOnly = FALSE)
script_path <- sub("--file=", "", args[grep("--file=", args)])
script_dir <- dirname(script_path)
source(file.path(script_dir, "cinema_nma.R"))

# ── Read JSON request from stdin ─────────────────────────────────────

input_text <- paste(readLines(con = "stdin", warn = FALSE), collapse = "\n")
req <- fromJSON(input_text, simplifyVector = TRUE, simplifyDataFrame = TRUE)

action <- req$action

# ── Dispatch ─────────────────────────────────────────────────────────

tryCatch({

  if (action == "health") {
    result <- list(
      status = "ok",
      netmeta_version = as.character(packageVersion("netmeta"))
    )

  } else if (action == "runNMA") {
    indata <- as.data.frame(req$indata, stringsAsFactors = FALSE)
    result <- runNMA(
      indata = indata,
      type   = req$type,
      model  = req$model,
      sm     = req$sm
    )

    # Convert matrices to serialisable lists
    # (jsonlite handles data.frames and named lists natively)
    convert_matrix <- function(m) {
      if (is.matrix(m)) {
        list(
          data     = unname(lapply(seq_len(nrow(m)), function(i) as.list(m[i, ]))),
          rowNames = rownames(m),
          colNames = colnames(m)
        )
      } else {
        m
      }
    }

    result$H               <- convert_matrix(result$H)
    result$contribMatrix    <- convert_matrix(result$contribMatrix)

    # forleaguetable contains raw matrices — convert each
    flt <- result$forleaguetable
    for (nm in names(flt)) {
      if (is.matrix(flt[[nm]])) {
        flt[[nm]] <- convert_matrix(flt[[nm]])
      }
    }
    result$forleaguetable <- flt

    # studyContributions is a data.frame — jsonlite handles it
    # NMAresults, side, Pairwise, dbt — also data.frames or lists

  } else if (action == "leaguetable") {
    # Reconstruct R matrices from JSON
    treatnames <- req$forleaguetable$treatnames
    n <- length(treatnames)

    to_mat <- function(obj) {
      if (is.list(obj) && !is.null(obj$data)) {
        obj <- obj$data
      }
      # obj should be a list of rows (each row is a list/vector)
      m <- matrix(0, nrow = n, ncol = n)
      for (i in seq_len(n)) {
        for (j in seq_len(n)) {
          m[i, j] <- as.numeric(obj[[i]][[j]])
        }
      }
      m
    }

    flt_r <- list(
      TE.fixed     = to_mat(req$forleaguetable$TE.fixed),
      lower.fixed  = to_mat(req$forleaguetable$lower.fixed),
      upper.fixed  = to_mat(req$forleaguetable$upper.fixed),
      TE.random    = to_mat(req$forleaguetable$TE.random),
      lower.random = to_mat(req$forleaguetable$lower.random),
      upper.random = to_mat(req$forleaguetable$upper.random),
      treatnames   = treatnames
    )

    lt <- formatLeagueTable(flt_r, model = req$model, sm = req$sm)

    # lt is a character matrix — convert to list of lists
    result <- unname(lapply(seq_len(nrow(lt)), function(i) as.list(lt[i, ])))

  } else {
    stop(paste0("Unknown action: ", action))
  }

  # ── Write JSON result to stdout ──────────────────────────────────
  cat(toJSON(result, auto_unbox = TRUE, null = "null", na = "null", force = TRUE))

}, error = function(e) {
  err <- list(error = conditionMessage(e), traceback = paste(capture.output(traceback()), collapse = "\n"))
  cat(toJSON(err, auto_unbox = TRUE))
  quit(status = 1)
})
