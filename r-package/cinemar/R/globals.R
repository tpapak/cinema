# Column names referenced via non-standard evaluation inside
# meta::pairwise() / netmeta::netmeta() / meta::metagen(). Declared here so
# R CMD check does not flag them as undefined globals.
utils::globalVariables(c(
  "study", "id", "t", "r", "n", "y", "sd",
  "TE", "seTE", "treat1", "treat2", "studlab",
  "effect", "se", "t1", "t2", "rob", "indirectness"
))
