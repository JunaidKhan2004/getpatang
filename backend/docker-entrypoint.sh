#!/bin/sh
# Applies pending database migrations, then starts the API (or runs the given command).
#   docker compose run --rm api seed     create roles, permissions, categories and the first Super Admin
set -e

if [ "$1" = "seed" ]; then
  exec node dist/seed.mjs
fi

npx prisma migrate deploy --schema prisma/postgres/schema.prisma
exec "$@"
