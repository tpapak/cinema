# Deployment Safeguards

The backend runs each analysis in a separate `Rscript` process. Large datasets
or repeated requests can exhaust RAM, so production should enforce limits at
both application and container level.

## Runtime Limits

The API accepts these environment variables:

- `MAX_R_JOBS`: maximum active `/api/runNMA` jobs. Use `1` on small servers.
- `R_QUEUE_LIMIT`: maximum R requests waiting for an active job slot.
- `R_TIMEOUT`: maximum R runtime in seconds before the process is killed.
- `R_MEMORY_LIMIT_MB`: per-R-process address-space limit in MB. Use `0` to
  disable the process limit.

The production Docker Compose defaults are conservative:

- one active R job
- five queued R requests
- 300 second timeout
- 1024 MB per R process
- 1536 MB container memory limit
- 256 process/PID limit

With one active job and five queued requests, the last queued browser request
can wait for several analyses to finish. Internal nginx and gunicorn timeouts
are set to 1800 seconds for that case. Match the external host nginx timeout to
at least 1800 seconds if the queue is enabled.

If analyses fail with memory-limit errors but the server remains healthy,
increase `R_MEMORY_LIMIT_MB` and `mem_limit` together. Keep `mem_limit` below
the host's available RAM so the Linux OOM killer does not kill unrelated
processes.

## Emergency Recovery

On the deployment server:

```bash
cd /path/to/cinema/docker
docker compose logs --tail=100 cinema-api
docker compose restart cinema-api
```

If the host itself is unstable after an OOM event, reboot the server, then
redeploy with the guarded Compose settings.
