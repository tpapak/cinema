FROM continuumio/miniconda3:latest

WORKDIR /app

# Copy environment definition and create conda env
COPY environment.yml .
RUN conda env create -f environment.yml && conda clean -afy

# Activate env by default
SHELL ["conda", "run", "-n", "cinema-api", "/bin/bash", "-c"]

# Copy application code
COPY R/ R/
COPY app.py .

# Verify R packages load (jsonlite needed for JSON CLI interface)
RUN Rscript -e 'library(netmeta); library(meta); library(igraph); library(jsonlite); cat("netmeta", as.character(packageVersion("netmeta")), "\n")'

EXPOSE 8004

# Old rpy2 approach (removed):
# ENV R_HOME=/opt/conda/envs/cinema-api/lib/R
# With subprocess architecture, app.py finds Rscript via CONDA_PREFIX
# which conda-run sets automatically.

# Use gunicorn with multiple workers for production.
# Each request spawns its own Rscript subprocess, so workers handle
# concurrency at the Python level while R processes run in parallel.
CMD ["conda", "run", "--no-capture-output", "-n", "cinema-api", \
     "gunicorn", "--bind", "0.0.0.0:8004", "--timeout", "600", "--workers", "4", "app:app"]
