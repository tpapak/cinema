# CINeMA Frontend — multi-stage build
# Build context: repo root
# Stage 1: Build static assets (Node + Gulp)
# Stage 2: Serve with nginx
#
# PureScript is pre-compiled (output/ checked into git or built before
# docker build). This avoids architecture issues with the PS compiler
# binary (x86 vs ARM) and speeds up the Docker build.

# ── Stage 1: Build ──────────────────────────────────────────────────
FROM node:24-bookworm AS builder

WORKDIR /build

# Install build tools
RUN npm install -g gulp-cli bower

# Copy dependency manifests first (Docker layer caching)
COPY webapp/package.json webapp/bower.json ./
RUN npm install --legacy-peer-deps && bower install --allow-root

# Copy the webapp source (including pre-compiled PureScript output/)
COPY webapp/ .

# Create production config (config.json is gitignored, so we generate it here)
# rserverurl="" means same-origin /api/ proxy in production
RUN echo '{"version":"3.0.0","ganalID":"UA-XXXXXXXXX-X","rserverurl":""}' > config.json
RUN gulp build

# ── Stage 2: Nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY docker/nginx/cinema.conf /etc/nginx/conf.d/cinema.conf

# Copy built static files
COPY --from=builder /build/dist /usr/share/nginx/cinema

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
