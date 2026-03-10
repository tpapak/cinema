# CINeMA Frontend — multi-stage build
# Stage 1: Build static assets (Node + PureScript + Gulp)
# Stage 2: Serve with nginx

# ── Stage 1: Build ──────────────────────────────────────────────────
FROM node:24-bookworm AS builder

WORKDIR /build

# Install PureScript compiler and spago
RUN npm install -g purescript@0.15.15 spago@0.21.0 gulp-cli bower

# Copy dependency manifests first (Docker layer caching)
COPY package.json bower.json ./
RUN npm install && bower install --allow-root

# Copy PureScript manifests and build PS
COPY app/scripts/purescripts/spago.yaml app/scripts/purescripts/spago.lock app/scripts/purescripts/
COPY app/scripts/purescripts/src/ app/scripts/purescripts/src/
COPY app/scripts/purescripts/test/ app/scripts/purescripts/test/
RUN cd app/scripts/purescripts && spago build

# Copy the rest of the webapp source
COPY . .

# Build production bundle: config → handlebars → browserify → useref → minify
# Set rserverurl to empty string for same-origin /api/ proxy in production
RUN node -e "var c=require('./config.json'); c.rserverurl=''; require('fs').writeFileSync('config.json', JSON.stringify(c,null,2));"
RUN gulp build

# ── Stage 2: Nginx ──────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/cinema.conf

# Copy built static files
COPY --from=builder /build/dist /usr/share/nginx/cinema

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
