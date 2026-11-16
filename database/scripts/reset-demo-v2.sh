#!/usr/bin/env bash
set -e

PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-55432}"
PGUSER="${PGUSER:-leyova}"
PGDATABASE="${PGDATABASE:-leyova}"

echo "========================================="
echo "Resetting Demo Data V2..."
echo "Host: $PGHOST:$PGPORT | User: $PGUSER | DB: $PGDATABASE"
echo "========================================="

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f database/04_demo_data_v2.sql
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f database/04b_demo_data_v2_facts.sql

# 演示数据仍会生成 jd/pdd 两个已移除平台的样本，重建后立即用迁移 124 清除，
# 保证「重跑演示数据」不会让已下线的平台复活（-1 = 单事务执行）
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -1 -f database/migrations/124_remove_jd_pdd.sql

echo "========================================="
echo "Demo data rebuild complete."
echo "========================================="
