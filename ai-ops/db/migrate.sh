#!/usr/bin/env bash
# 迁移执行器：按文件名顺序、只跑未应用的、记录 schema_migrations
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://leyova@127.0.0.1:55432/leyova_ai_ops}"
DIR="$(cd "$(dirname "$0")" && pwd)"

psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());"

applied=0
for f in "$DIR"/migrations/*.sql; do
  name="$(basename "$f")"
  done_flag="$(psql "$DB_URL" -Atc "SELECT 1 FROM schema_migrations WHERE filename = '$name'")"
  if [ "$done_flag" != "1" ]; then
    echo "→ applying $name"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (filename) VALUES ('$name');"
    applied=$((applied + 1))
  fi
done

echo "✓ migrations done ($applied applied, $(ls "$DIR"/migrations/*.sql | wc -l) total)"
