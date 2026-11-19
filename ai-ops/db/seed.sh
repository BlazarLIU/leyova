#!/usr/bin/env bash
# 种子：岗位 / 指标 / 模块 / 最小演示数据（固定，可重复执行）
set -euo pipefail

DB_URL="${DATABASE_URL:-postgresql://leyova@127.0.0.1:55432/leyova_ai_ops}"
DIR="$(cd "$(dirname "$0")" && pwd)"

for f in "$DIR"/seeds/*.sql; do
  echo "→ seed $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "✓ seeds done"
