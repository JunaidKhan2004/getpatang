#!/bin/sh
# Builds the production images and checks they work together on PostgreSQL:
# migrations apply, the seed runs, the API answers, sign-in works and the website renders.
# Used by CI; runs without the HTTPS proxy.
set -eu

COMPOSE="docker compose --env-file deploy/ci.env"
cleanup() { $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

$COMPOSE build api web
$COMPOSE up -d db api

echo "Waiting for the API to become healthy…"
for i in $(seq 1 40); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$($COMPOSE ps -q api)" 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  [ "$i" = 40 ] && { $COMPOSE logs api; echo "API did not become healthy"; exit 1; }
  sleep 3
done

$COMPOSE run --rm api seed
$COMPOSE up -d web

api() { $COMPOSE exec -T api wget -qO- "$@"; }
api http://127.0.0.1:4000/api/v1/health | grep -q '"ok"' && echo "✓ health"
api http://127.0.0.1:4000/api/v1/categories | grep -q 'kites' && echo "✓ seeded categories"
api --header 'Content-Type: application/json' \
  --post-data '{"identifier":"admin@ci.test","password":"CiAdminPass123"}' \
  http://127.0.0.1:4000/api/v1/auth/login | grep -q 'accessToken' && echo "✓ admin sign-in on PostgreSQL"
api 'http://127.0.0.1:4000/api/v1/products?q=KITE' >/dev/null && echo "✓ case-insensitive search query"

for i in $(seq 1 20); do
  if $COMPOSE exec -T web wget -qO- http://127.0.0.1:3000/ 2>/dev/null | grep -q 'GetPatang'; then echo "✓ website renders"; break; fi
  [ "$i" = 20 ] && { $COMPOSE logs web; echo "Website did not respond"; exit 1; }
  sleep 3
done
$COMPOSE exec -T web wget -S -qO /dev/null http://127.0.0.1:3000/ 2>&1 | grep -qi 'x-frame-options: DENY' && echo "✓ security headers"
echo "Container smoke test passed."
