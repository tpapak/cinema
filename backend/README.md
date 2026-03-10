# CINeMA Backend API

Flask + rpy2 backend replacing OpenCPU. Uses Miniconda for R + Python.
Requires netmeta >= 3.3 (uses `netcontrib(study = TRUE)` for per-study contributions).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/runNMA` | Full NMA: hat matrix, contributions, study contributions, netsplit, heterogeneity, league table data |
| `POST` | `/api/leaguetable` | Format league table strings from runNMA results |
| `GET`  | `/api/health` | Health check (returns netmeta version) |

## Local setup

```bash
./setup.sh          # creates conda env 'cinema-api'
./run.sh            # starts server on port 8004
```

## Docker

```bash
docker compose up --build
```

## API details

### POST /api/runNMA

Runs a full network meta-analysis. Returns everything CINeMA needs in one call:
hat matrix, contribution matrix, per-study contributions, NMA treatment effects,
SIDE (direct/indirect), pairwise heterogeneity, network heterogeneity,
design-by-treatment test, and raw league table matrices.

Request:
```json
{
  "indata": [{"id": "S1", "t": "A", "r": 10, "n": 100}, ...],
  "type": "long_binary",
  "model": "fixed",
  "sm": "OR"
}
```

`type` can be: `"long_binary"`, `"long_continuous"`, or `"iv"`.
`model` can be: `"fixed"` or `"random"`.
`sm` can be: `"OR"`, `"RR"`, `"RD"`, `"MD"`, `"SMD"`.

Response includes: `H`, `contribMatrix`, `studyContributions`, `NMAresults`,
`side`, `NMAheter`, `Pairwise`, `dbt`, `forleaguetable`, `treatnames`, `tau`, etc.

### POST /api/leaguetable

Formats the league table into a 2-D string array with treatment effects and CIs.

Request:
```json
{
  "forleaguetable": { ... forleaguetable object from runNMA response ... },
  "model": "fixed",
  "sm": "OR"
}
```

Response: 2-D array of strings, e.g. `[["A", "0.70 (0.44, 1.10)"], ...]`

### GET /api/health

Returns `{"status": "ok", "netmeta_version": "3.3.1"}`.
