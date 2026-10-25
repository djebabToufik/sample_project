#!/usr/bin/env bash
# Nightly reset of the public demo (systemd timer oee-reset.timer): deletes the database and
# uploads, and starts again with fresh demo data. Caddy's certificates are kept (see
# docker-compose.demo.yaml).
set -euo pipefail

cd /opt/oee
docker compose down --volumes --timeout 30
docker compose up -d --wait --wait-timeout 900
