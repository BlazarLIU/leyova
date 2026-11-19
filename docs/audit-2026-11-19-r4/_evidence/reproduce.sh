#!/usr/bin/env bash
# Leyova R4 审计 · 一键只读复现脚本
# 用法：cd /home/leyova && bash docs/audit-2026-11-19-r4/_evidence/reproduce.sh
# 约束：只读。仅 GET / SELECT。不会写库、不会 build、不会重启进程。

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 1
OUT="docs/audit-2026-11-19-r4/_evidence/_live"
mkdir -p "$OUT"

echo "== 1. 服务健康 =="
curl -s -m 5 http://127.0.0.1:8788/api/v1/health | tee "$OUT/health.json"; echo
curl -s -o /dev/null -w 'web=%{http_code}\n' -m 5 http://127.0.0.1:5513/

echo "== 2. 质量门禁（只读项） =="
pnpm -F @leyova/api run openapi:check 2>&1 | tail -20
pnpm check:guardrails 2>&1 | tail -10
pnpm -F @leyova/api exec tsc --noEmit -p tsconfig.json 2>&1 | tail -10

echo "== 3. schema 漂移 =="
node database/generate-schema.js --check 2>&1 | tail -10

echo "== 4. 静态计数 =="
find apps/web/src/pages -name '*.tsx' | wc -l
grep -c 'href:' apps/web/src/data/route-manifest.ts
grep -c 'platforms:' apps/web/src/data/route-manifest.ts
grep -c 'module:' apps/web/src/data/ai-ops-navigation.ts
ls apps/api/src/routes/*.ts | wc -l

echo "== 5. 数据库只读（需 psql 与 DATABASE_URL） =="
if [ -n "${DATABASE_URL:-}" ]; then
  psql "$DATABASE_URL" -Atc "select count(*) from pg_stat_user_tables where schemaname='public';"
  psql "$DATABASE_URL" -Atc "select count(*) from pg_stat_user_tables where n_live_tup=0;"
  psql "$DATABASE_URL" -Atc "select code,name from roles order by id;"
  psql "$DATABASE_URL" -Atc "select count(*) filter (where is_applicable=false), count(*) from platform_capability_matrix;"
  psql "$DATABASE_URL" -Atc "select count(*) from session_plan_products where product_name like '%[object Object]%';"
  psql "$DATABASE_URL" -Atc "select count(*) from users where username like '\_\_%';"
else
  echo "DATABASE_URL 未设置，跳过（可从 apps/api/.env 读取后重跑）"
fi

echo "== 6. 匿名端点探测 =="
curl -s -o /dev/null -w '/metrics=%{http_code}\n' -m 5 http://127.0.0.1:8788/api/v1/metrics
curl -s -o /dev/null -w '/overview/cockpit=%{http_code}\n' -m 5 http://127.0.0.1:8788/api/v1/overview/cockpit

echo "== 7. 进程 =="
pm2 list 2>/dev/null | grep -E 'leyova|name' || true

echo "完成。输出目录：$OUT"
