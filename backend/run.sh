#!/usr/bin/env bash
# Run the cinema-api server locally.
# Requires: conda environment 'cinema-api' already created (see setup.sh).
#
# Architecture: Flask + Rscript subprocesses.
# app.py finds the conda Rscript via $CONDA_PREFIX which conda-run sets
# automatically.  No rpy2, no R_HOME needed.
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8004}"

# Old rpy2 approach (removed):
# CONDA_PREFIX="$(conda info --envs | grep cinema-api | awk '{print $NF}')"
# export R_HOME="${CONDA_PREFIX}/lib/R"

echo "Starting CINeMA API on port ${PORT} ..."
conda run --no-capture-output -n cinema-api python app.py
