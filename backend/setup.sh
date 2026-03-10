#!/usr/bin/env bash
# Setup the cinema-api conda environment locally (without Docker).
# Requires: conda or miniconda installed.
set -euo pipefail

cd "$(dirname "$0")"

echo "Creating conda environment 'cinema-api' ..."
# Remove existing env if present, then create fresh
conda env remove -n cinema-api -y 2>/dev/null || true
conda env create -f environment.yml

echo ""
echo "Done. Activate with:"
echo "  conda activate cinema-api"
echo ""
echo "Then run:"
echo "  python app.py"
