# CINeMA Docker Deployment

Production stack for CINeMA: an nginx-served static frontend and a Flask+R API, orchestrated with Docker Compose.

```
┌─────────────┐   :443/:80    ┌──────────────┐   127.0.0.1:8080   ┌──────────────┐   /api/   ┌──────────────┐
│  host nginx │ ───TLS term──▶│ (compose net) │ ─────────────────▶ │  cinema-web  │ ────────▶ │  cinema-api  │
│  (optional) │               │               │                    │  nginx:80    │           │  flask:8004  │
└─────────────┘               └──────────────┘                    └──────────────┘           └──────────────┘
```

- `cinema-web` — nginx serving the built webapp (`dist/`) and proxying `/api/` to `cinema-api`.
- `cinema-api` — Flask + gunicorn (4 workers) wrapping R (`netmeta`, `meta`, `igraph`) via per-request `Rscript` subprocesses.

## Layout

```
docker/
├── docker-compose.yml     # stack definition
├── cinema-web/
│   └── Dockerfile         # multi-stage: node/gulp build → nginx:alpine
└── nginx/
    └── cinema.conf        # in-container nginx: SPA fallback + /api/ proxy
```

The `cinema-api` image is built from `../backend/Dockerfile` (miniconda + R + gunicorn).

## Prerequisites

- Docker Engine 24+ with the Compose v2 plugin.
- The repository must contain **pre-compiled PureScript output** at `webapp/app/scripts/purescripts/output/`. This is built on the developer machine (the PS compiler has x86/ARM quirks) and committed or shipped before `docker build`.
- A populated `webapp/config.json` (see below) — it is gitignored and must be created on the deploy host.

## Required: `webapp/config.json`

The webapp reads build-time config from `webapp/config.json`. It is **gitignored** and must exist before `docker compose build`, otherwise the `COPY webapp/config.json config.json` step in `cinema-web/Dockerfile` fails.

Minimum production file:

```json
{
  "version": "3.0.1",
  "rserverurl": "",
  "umamiUrl": "https://stats.example.org",
  "umamiWebsiteId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

- `rserverurl: ""` — empty string means the browser calls the same origin at `/api/`, which the container nginx proxies to `cinema-api`. Leave it empty in production.
- `umamiUrl` / `umamiWebsiteId` — optional. Both must be set for the Umami `<script defer src='…/script.js'>` tag to be injected into `dist/index.html` at gulp-build time. Leave them out (or as empty strings) to ship without analytics.
- `version` — baked into asset cache-busting query strings.

The values are consumed by `webapp/gulpfile.js` during the build, so any change requires an image rebuild (see below).

## Quick Start

From the `docker/` directory:

```bash
docker compose build
docker compose up -d
```

The frontend listens on `127.0.0.1:8080`. The backend (`cinema-api`) is only reachable via the compose network — its port is `expose`d, not published.

Check the stack is up:

```bash
docker compose ps
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:8080/api/     # should proxy to cinema-api
```

## TLS / Public Hostname

`cinema-web` binds to `127.0.0.1` only. Terminate TLS with a host-level reverse proxy (nginx / Caddy / Traefik) that forwards to `http://127.0.0.1:8080`. A minimal host nginx block:

```nginx
server {
    listen 443 ssl http2;
    server_name cinema.example.org;

    ssl_certificate     /etc/letsencrypt/live/cinema.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cinema.example.org/privkey.pem;

    client_max_body_size 50M;
    proxy_read_timeout   600s;   # NMA can take minutes on large networks
    proxy_send_timeout   600s;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Common Operations

```bash
# Rebuild just the frontend image (after webapp changes or config.json edits)
docker compose build cinema-web && docker compose up -d cinema-web

# Rebuild with no layer cache (if a build step seems stuck on stale state)
docker compose build --no-cache cinema-web

# Tail logs
docker compose logs -f cinema-web
docker compose logs -f cinema-api

# Exec into a running container
docker compose exec cinema-web sh
docker compose exec cinema-api bash

# Stop / remove the stack
docker compose down
```

## Updating

1. `git pull` on the deploy host.
2. Make sure `webapp/config.json` still has the keys you need (it is not overwritten by git).
3. `docker compose build && docker compose up -d`.

Docker only rebuilds layers whose inputs changed. If you edited `webapp/config.json` or any file under `webapp/`, the `COPY webapp/ .` layer is invalidated and gulp re-runs automatically.

## Troubleshooting

### Umami tag not showing up in the served HTML

Symptom: `view-source:` on the deployed site shows `<!-- analytics:js --><!-- endanalytics -->` with no `<script>` in between.

Cause: gulp only injects the tag when **both** `umamiUrl` and `umamiWebsiteId` are non-empty in `webapp/config.json` at the moment `docker compose build` runs. Editing `config.json` and only running `docker compose up -d` does **not** rebuild the image.

Checklist:

```bash
# 1. Config on the host has both keys
cat webapp/config.json

# 2. Force a rebuild
docker compose build --no-cache cinema-web
docker compose up -d cinema-web

# 3. Verify the built artifact inside the image
docker compose exec cinema-web grep -o "data-website-id" /usr/share/nginx/cinema/index.html
```

If step 3 returns a match but the browser still shows no Umami activity, the problem is browser-side: the Umami server must be reachable from the visitor's browser (not just from the Docker host), and the site's domain must be registered in the Umami admin UI.

### `COPY webapp/config.json config.json` fails during build

`webapp/config.json` does not exist on the host. Create it (see the template above). Do **not** commit it — it is gitignored.

### `/api/` requests return 502

`cinema-api` is not reachable. Usually this means the backend container crashed during startup (R package install, conda env). Check `docker compose logs cinema-api`.

### Backend times out on large networks

NMA can take minutes. Both the in-container nginx (`docker/nginx/cinema.conf`) and gunicorn (`backend/Dockerfile` CMD) are configured with 600 s timeouts. If you front the stack with another reverse proxy, raise its `proxy_read_timeout` to match.

### Stale browser cache after a redeploy

Asset URLs in `dist/index.html` are suffixed with `?<config.version>` (or a random string when `version: "0.0.0"`). Bump `version` in `webapp/config.json` before rebuilding to force clients to fetch new JS/CSS.

## Notes

- The build context for `cinema-web` is the **repo root** (`context: ..` in `docker-compose.yml`); the context for `cinema-api` is `../backend`. The root `.dockerignore` excludes `node_modules/`, `bower_components/`, `dist/`, `.tmp/`, `.git/`, etc. — but **not** `webapp/config.json`, which is intentionally copied in.
- PureScript output (`webapp/app/scripts/purescripts/output/`) is deliberately **not** in `.dockerignore`; it is shipped as-is.
- `cinema-api` pins R packages via `backend/environment.yml`. Rebuilding the image rebuilds the conda env and reinstalls R packages from scratch — expect several minutes.
