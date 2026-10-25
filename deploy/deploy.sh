#!/usr/bin/env bash
# Deploys a release of the public demo: fetches the release's compose files, pulls its images
# (the ones tested in CI) and restarts the stack. Run on the server, as root, by the
# "Deploy demo" workflow through AWS Systems Manager:
#   deploy.sh 1.2.0
set -euo pipefail

VERSION="${1:?usage: deploy.sh <version>}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Not a version: $VERSION" >&2; exit 1; }
RAW="https://raw.githubusercontent.com/djebabToufik/sample_project/v$VERSION"

cd /opt/oee
for file in docker-compose.yaml deploy/docker-compose.demo.yaml deploy/Caddyfile deploy/reset.sh; do
  curl -fsSL "$RAW/$file" -o "$(basename "$file").new"
done
for file in docker-compose.yaml docker-compose.demo.yaml Caddyfile reset.sh; do
  mv "$file.new" "$file"
done
chmod 755 reset.sh

sed -i "s/^OEE_IMAGE_TAG=.*/OEE_IMAGE_TAG=$VERSION/" .env
docker compose pull --quiet
docker compose up -d --remove-orphans --wait --wait-timeout 600
docker image prune --force > /dev/null
echo "Deployed $VERSION"
