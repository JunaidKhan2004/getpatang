#!/bin/sh
# Daily backup of the database and uploaded files. Run from the project folder on the server, e.g. cron:
#   30 2 * * * cd /opt/kite-platform && ./deploy/backup.sh >> /var/log/kite-backup.log 2>&1
# Copy the backups folder off the server too (another machine or cloud storage).
set -eu

KEEP_DAYS="${KEEP_DAYS:-14}"
DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
COMPOSE="docker compose --env-file .env.production"
mkdir -p "$DIR"

# Database: custom-format dump (restore with pg_restore).
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$DIR/db-$STAMP.dump"

# Uploaded files (product photos, documents, receipts).
docker run --rm -v kite-platform_uploads:/data:ro -v "$(cd "$DIR" && pwd)":/backup alpine \
  tar -czf "/backup/uploads-$STAMP.tar.gz" -C /data .

find "$DIR" -name 'db-*.dump' -mtime +"$KEEP_DAYS" -delete
find "$DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Iseconds) backup done: $DIR/db-$STAMP.dump, $DIR/uploads-$STAMP.tar.gz"
