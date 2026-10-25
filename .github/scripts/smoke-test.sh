#!/usr/bin/env bash
# Checks a running stack end to end through nginx: the React app, the API, and a login
# (session cookie and CSRF token, with the database behind it).
#
#   .github/scripts/smoke-test.sh [base-url]     (default http://localhost)
#
# Logs in with SMOKE_USERNAME / SMOKE_PASSWORD when set (e.g. the public demo account),
# otherwise with OEE_SUPERUSER_USERNAME / OEE_SUPERUSER_PASSWORD from .env.
set -euo pipefail

BASE_URL="${1:-http://localhost}"

# .env is read by Docker, not by a shell (values may contain spaces or "&"): only pick what is needed.
env_value() { [ -f .env ] && grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | tr -d '\r'; }
USERNAME="${SMOKE_USERNAME:-$(env_value OEE_SUPERUSER_USERNAME)}"
PASSWORD="${SMOKE_PASSWORD:-$(env_value OEE_SUPERUSER_PASSWORD)}"

jar="$(mktemp)"
trap 'rm -f "$jar"' EXIT

check() {
  local expected="$1" label="$2"
  shift 2
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  if [ "$code" != "$expected" ]; then
    echo "FAIL  $label: expected HTTP $expected, got $code" >&2
    exit 1
  fi
  echo "ok    $label ($code)"
}

check 200 "React app" "$BASE_URL/"
check 200 "Public settings API" "$BASE_URL/api/auth/settings/"
# Logged out: 401, and the response sets the csrftoken cookie for the login.
check 401 "Session while logged out" -c "$jar" "$BASE_URL/api/auth/session/"

csrf="$(awk '$6 == "csrftoken" { print $7 }' "$jar")"
check 200 "Login" -b "$jar" -c "$jar" \
  -H "X-CSRFToken: $csrf" -H "Origin: $BASE_URL" -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
  "$BASE_URL/api/auth/login/"
check 200 "Session while logged in" -b "$jar" "$BASE_URL/api/auth/session/"
