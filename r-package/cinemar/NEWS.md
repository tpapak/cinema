# cinemar 0.1.0

* Initial release.
* `write_cinema_cnm()` / `cinema_cnm()` — build CINeMA v3 `.cnm` files from NMA data.
* `cnm_frequentist_block()` — netmeta structural block (hat matrix, contributions,
  design-by-treatment, netsplit, heterogeneity, league table).
* `cnm_bayesian_block()` — backend-agnostic Bayesian block constructor.
* `cnm_bayesian_gemtc()` — extract the Bayesian block from a gemtc fit
  (effects, tau, nodesplit, SUCRA, DIC), for MetaInsight interoperability.
