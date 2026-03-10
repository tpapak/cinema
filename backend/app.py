"""
CINeMA Backend API Server
Flask + Rscript subprocess architecture.
Uses netmeta >= 3.3 (netcontrib with study = TRUE).

Each R computation runs as an independent Rscript child process:
  - True parallelism: multiple users can run NMA simultaneously
  - Clean cancellation: kill the process with SIGTERM
  - Crash isolation: R crash only affects that one request
  - No rpy2, no thread-safety issues, no conversion bugs

Endpoints:
  POST /api/runNMA           - Full NMA analysis
  POST /api/leaguetable      - Format league table strings
  POST /api/cancel/<job_id>  - Cancel a running job
  GET  /api/health           - Health check
  GET  /api/status           - Server status (active jobs)
"""

import os
import json
import logging
import traceback
import uuid
import subprocess
import threading
import signal

from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger("cinema-api")

app = Flask(__name__)
CORS(app, expose_headers=["X-Job-Id"])

# ── Configuration ─────────────────────────────────────────────────────────────

R_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "R")
CLI_SCRIPT = os.path.join(R_DIR, "run_cli.R")

# Find Rscript: prefer conda env, fall back to PATH
_conda_prefix = os.environ.get("CONDA_PREFIX", "")
_conda_rscript = os.path.join(_conda_prefix, "bin", "Rscript")
RSCRIPT = _conda_rscript if os.path.isfile(_conda_rscript) else "Rscript"

# Maximum concurrent R processes (0 = unlimited)
MAX_CONCURRENT = int(os.environ.get("MAX_R_JOBS", "0"))

# R process timeout in seconds (0 = no timeout)
R_TIMEOUT = int(os.environ.get("R_TIMEOUT", "600"))


# ── Job tracking ─────────────────────────────────────────────────────────────
# Each running R process is tracked by job_id so it can be cancelled.

_active_jobs = {}  # job_id -> {"process": Popen, "cancelled": bool}
_jobs_lock = threading.Lock()


def _register_job(job_id, proc):
    with _jobs_lock:
        _active_jobs[job_id] = {"process": proc, "cancelled": False}


def _cancel_job(job_id):
    """Kill the R process for a job.  Returns True if found and killed."""
    with _jobs_lock:
        job = _active_jobs.get(job_id)
        if job and not job["cancelled"]:
            job["cancelled"] = True
            proc = job["process"]
            if proc and proc.poll() is None:
                # Send SIGTERM to the process group so child R processes die too
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                    logger.info(f"Job [{job_id[:8]}]: killed R process {proc.pid}")
                except (ProcessLookupError, OSError):
                    pass
            return True
    return False


def _cleanup_job(job_id):
    with _jobs_lock:
        _active_jobs.pop(job_id, None)


def _is_cancelled(job_id):
    with _jobs_lock:
        job = _active_jobs.get(job_id)
        return job["cancelled"] if job else False


def _active_count():
    with _jobs_lock:
        return sum(
            1
            for j in _active_jobs.values()
            if not j["cancelled"] and j["process"] and j["process"].poll() is None
        )


# ── R subprocess runner ──────────────────────────────────────────────────────


def run_r(request_obj, job_id=None):
    """
    Run an R computation via Rscript subprocess.

    Args:
        request_obj: dict to serialize as JSON and send to R via stdin
        job_id: optional job_id for tracking/cancellation

    Returns:
        Parsed JSON result from R

    Raises:
        RuntimeError: if R process fails or is cancelled
    """
    input_json = json.dumps(request_obj)

    proc = subprocess.Popen(
        [RSCRIPT, CLI_SCRIPT],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        # Start new process group so we can kill R + children
        preexec_fn=os.setsid,
    )

    if job_id:
        _register_job(job_id, proc)

    try:
        timeout = R_TIMEOUT if R_TIMEOUT > 0 else None
        stdout, stderr = proc.communicate(input=input_json.encode(), timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        proc.wait()
        raise RuntimeError(f"R computation timed out after {R_TIMEOUT}s")

    if job_id and _is_cancelled(job_id):
        raise RuntimeError("cancelled")

    if proc.returncode != 0:
        # Try to parse error JSON from stdout
        try:
            err = json.loads(stdout.decode())
            raise RuntimeError(
                err.get("error", f"R exited with code {proc.returncode}")
            )
        except (json.JSONDecodeError, UnicodeDecodeError):
            stderr_text = stderr.decode(errors="replace").strip()
            raise RuntimeError(
                f"R exited with code {proc.returncode}: {stderr_text[-500:]}"
            )

    # Parse JSON output
    try:
        return json.loads(stdout.decode())
    except json.JSONDecodeError as e:
        raise RuntimeError(f"R returned invalid JSON: {e}")


# ── Endpoints ─────────────────────────────────────────────────────────────────


@app.route("/api/health", methods=["GET"])
def health():
    try:
        result = run_r({"action": "health"})
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/api/status", methods=["GET"])
def status():
    """Return server status: active jobs count."""
    return jsonify(
        {
            "active_jobs": _active_count(),
            "max_concurrent": MAX_CONCURRENT,
        }
    )


@app.route("/api/runNMA", methods=["POST"])
def api_run_nma():
    """
    Full NMA analysis.

    Request:
      { "indata": [...], "type": "long_binary"|"long_continuous"|"iv",
        "model": "fixed"|"random", "sm": "OR"|"RR"|"RD"|"MD"|"SMD" }

    Response headers include X-Job-Id for cancellation.
    """
    job_id = str(uuid.uuid4())

    # Check concurrency limit
    if MAX_CONCURRENT > 0 and _active_count() >= MAX_CONCURRENT:
        return jsonify(
            {
                "error": "server_busy",
                "message": f"Maximum concurrent jobs ({MAX_CONCURRENT}) reached. Try again later.",
                "active_jobs": _active_count(),
            }
        ), 503

    try:
        p = request.get_json(force=True)
        indata = p["indata"]
        rtype = p["type"]
        model = p.get("model", "fixed")
        sm = p["sm"]

        logger.info(
            f"runNMA [{job_id[:8]}]: type={rtype} model={model} sm={sm} rows={len(indata)}"
        )

        result = run_r(
            {
                "action": "runNMA",
                "indata": indata,
                "type": rtype,
                "model": model,
                "sm": sm,
            },
            job_id=job_id,
        )

        logger.info(f"runNMA [{job_id[:8]}]: OK")
        resp = jsonify(result)
        resp.headers["X-Job-Id"] = job_id
        return resp

    except RuntimeError as e:
        if str(e) == "cancelled":
            logger.info(f"runNMA [{job_id[:8]}]: cancelled")
            return jsonify({"error": "cancelled", "job_id": job_id}), 499
        logger.error(f"runNMA [{job_id[:8]}] error: {e}")
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        logger.error(f"runNMA [{job_id[:8]}] error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
    finally:
        _cleanup_job(job_id)


@app.route("/api/cancel/<job_id>", methods=["POST"])
def api_cancel(job_id):
    """Cancel a running NMA job by killing its R process."""
    if _cancel_job(job_id):
        logger.info(f"Job [{job_id[:8]}] cancelled")
        return jsonify({"status": "cancelled", "job_id": job_id})
    return jsonify({"status": "not_found", "job_id": job_id}), 404


@app.route("/api/leaguetable", methods=["POST"])
def api_leaguetable():
    """
    Format league table from raw NMA matrices.

    Request:
      { "forleaguetable": {...}, "model": "fixed"|"random", "sm": "OR"|... }

    Response:  2-D string array.
    """
    try:
        p = request.get_json(force=True)

        logger.info(f"leaguetable: model={p['model']} sm={p['sm']}")

        result = run_r(
            {
                "action": "leaguetable",
                "forleaguetable": p["forleaguetable"],
                "model": p["model"],
                "sm": p["sm"],
            }
        )

        logger.info("leaguetable OK")
        return jsonify(result)

    except Exception as e:
        logger.error(f"leaguetable error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Verify Rscript is available at startup
    logger.info(f"Rscript: {RSCRIPT}")
    logger.info(f"CLI script: {CLI_SCRIPT}")
    try:
        result = run_r({"action": "health"})
        logger.info(f"netmeta {result['netmeta_version']} ready.")
    except Exception as e:
        logger.error(f"R startup check failed: {e}")
        raise SystemExit(1)

    port = int(os.environ.get("PORT", 8004))
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    logger.info(f"Starting CINeMA API on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
