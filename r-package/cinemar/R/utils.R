# Internal helpers shared across the package.

# ISO-8601 timestamp in the shape CINeMA writes (millisecond + Z).
.cnm_timestamp <- function() {
  format(Sys.time(), "%Y-%m-%dT%H:%M:%S.000Z", tz = "UTC")
}

# Normalise a comparison id "B:A" -> "A:B" (alphabetical, the CINeMA convention).
.normalize_comp <- function(cid) {
  vapply(cid, function(x) {
    parts <- strsplit(x, ":", fixed = TRUE)[[1]]
    paste(sort(parts), collapse = ":")
  }, character(1), USE.NAMES = FALSE)
}

# Convert a numeric matrix to a list-of-rows (each row a plain numeric vector),
# so jsonlite serialises it as a 2D array.
.mat_to_lol <- function(m) {
  lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ]))
}

# Coerce a value to a finite number or NULL (so it serialises to JSON null).
.num_or_null <- function(x) {
  if (length(x) == 0) return(NULL)
  x <- x[1]
  if (is.na(x) || is.null(x)) return(NULL)
  as.numeric(x)
}

# Sanitise a title for use as a file name.
.safe_filename <- function(title) {
  gsub("[^a-zA-Z0-9_-]", "_", title)
}

# Stop with a clear message if a required package is unavailable.
.need <- function(pkg) {
  if (!requireNamespace(pkg, quietly = TRUE)) {
    stop(sprintf("Package '%s' is required for this function. Install it first.", pkg),
         call. = FALSE)
  }
}
