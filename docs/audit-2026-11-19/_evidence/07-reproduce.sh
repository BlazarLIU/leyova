#!/usr/bin/env bash
# Leyova 审计证据复现脚本（2026-11-19）
# 用法：在 /home/leyova 下执行 bash docs/audit-2026-11-19/_evidence/07-reproduce.sh
# 全部为只读操作。

set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo /home/leyova)"

echo "===== 1. 质量门禁 ====="
pnpm -F @leyova/api openapi:check 2>&1 | tail -3
pnpm check:guardrails 2>&1 | tail -1
node database/generate-schema.js --check 2>&1 | tail -2

echo "===== 2. 表行数 ====="
PGPASSWORD=$(grep DB_PASSWORD apps/api/.env | cut -d= -f2) psql -h 127.0.0.1 -p 55432 -U "$(grep DB_USER apps/api/.env | cut -d= -f2)" -d "$(grep DB_NAME apps/api/.env | cut -d= -f2)" -tAc "
select 'fact_fulfillment_waybill', count(*) from fact_fulfillment_waybill union all
select 'fact_cs_session', count(*) from fact_cs_session union all
select 'fact_after_sale_tickets', count(*) from fact_after_sale_tickets union all
select 'canonical_refund_events', count(*) from canonical_refund_events union all
select 'session_plan_products', count(*) from session_plan_products union all
select 'session_plan_products_corrupted', count(*) from session_plan_products where product_name like '%[object Object]%' union all
select 'goal_tracking', count(*) from goal_tracking union all
select 'issue_library', count(*) from issue_library union all
select 'promotions', count(*) from promotions union all
select 'competitor_brands', count(*) from competitor_brands union all
select 'compliance_events', count(*) from compliance_events union all
select 'fact_kol_cooperation', count(*) from fact_kol_cooperation union all
select 'xhs_note', count(*) from xhs_note union all
select 'fact_search_keyword_daily', count(*) from fact_search_keyword_daily union all
select 'fact_settlement_cycles', count(*) from fact_settlement_cycles union all
select 'room_health', count(*) from room_health union all
select 'multi_room_status', count(*) from multi_room_status union all
select 'test_pollution_users', count(*) from users where username like '\_\_t\_%' or username like '\_\_res\_%'"

echo "===== 3. 角色与平台能力 ====="
PGPASSWORD=$(grep DB_PASSWORD apps/api/.env | cut -d= -f2) psql -h 127.0.0.1 -p 55432 -U "$(grep DB_USER apps/api/.env | cut -d= -f2)" -d "$(grep DB_NAME apps/api/.env | cut -d= -f2)" -tAc "
select 'roles', string_agg(code, ', ' order by id) from roles"
PGPASSWORD=$(grep DB_PASSWORD apps/api/.env | cut -d= -f2) psql -h 127.0.0.1 -p 55432 -U "$(grep DB_USER apps/api/.env | cut -d= -f2)" -d "$(grep DB_NAME apps/api/.env | cut -d= -f2)" -tAc "
select 'matrix_total=' || count(*) || ' applicable=' || count(*) filter (where is_applicable) from platform_capability_matrix"
PGPASSWORD=$(grep DB_PASSWORD apps/api/.env | cut -d= -f2) psql -h 127.0.0.1 -p 55432 -U "$(grep DB_USER apps/api/.env | cut -d= -f2)" -d "$(grep DB_NAME apps/api/.env | cut -d= -f2)" -tAc "
select 'ai_config_rows=' || count(*) from ai_config"

echo "===== 4. 进程 ====="
ps aux | grep -E '[a]pps/(api|web|mcp-server)' | awk '{print $2, $12, $13}'
echo -n "worker running: "; ps aux | grep -c '[w]orker.ts'

echo "===== 5. 登录态探针（需先启动 API）====="
curl -s -c /tmp/_audit_ck.txt -X POST http://127.0.0.1:8788/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@123456"}' -o /dev/null -w 'admin login: %{http_code}\n'

for u in ctrl_douyin operator_wang hr_li video_lin cs_qian; do
  curl -s -c /tmp/_audit_$u.txt -X POST http://127.0.0.1:8788/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$u\",\"password\":\"Admin@123456\"}" -o /dev/null -w "$u login: %{http_code}\n"
done

echo "--- 中控对 AI-Ops 数据端点的访问 ---"
for e in /overview/sessions /anchors /system/tasks /ai/pending-approvals '/alerts/events?status=pending'; do
  printf 'ctrl_douyin %-38s -> %s\n' "$e" \
    "$(curl -s -b /tmp/_audit_ctrl_douyin.txt -o /dev/null -w '%{http_code}' "http://127.0.0.1:8788/api/v1$e")"
done

echo "--- 运营专员对漏配路径的访问 ---"
for e in /scripts/templates /metrics /finance/accounting-subjects; do
  printf 'operator_wang %-38s -> %s\n' "$e" \
    "$(curl -s -b /tmp/_audit_operator_wang.txt -o /dev/null -w '%{http_code}' "http://127.0.0.1:8788/api/v1$e")"
done

echo "--- 平台洞察端点数据实况（admin）---"
for e in /insights/douyin/three-pools /insights/taobao/three-sources /tmall/brands \
         /tmall/promotion-layers /insights/xiaohongshu/buyer-profile \
         /insights/xiaohongshu/dandelion /insights/xiaohongshu/traffic-sources \
         /wechat/affiliate /wechat/content; do
  printf '%-42s -> %s\n' "$e" \
    "$(curl -s -b /tmp/_audit_ck.txt "http://127.0.0.1:8788/api/v1$e?from=2026-08-01&to=2026-11-18" | head -c 120)"
done

echo "===== 6. 静态核对 ====="
echo -n "ai-ops-data.ts 静默失败处数: "; grep -c '静默失败' apps/web/src/services/ai-ops-data.ts
echo -n "module-guard MODULE_MAP 前缀数: "; grep -c "prefix: '/api/v1" apps/api/src/lib/module-guard.ts
echo -n "route-manifest 带 platforms 声明的条目: "; grep -c 'platforms: \[' apps/web/src/data/route-manifest.ts
echo -n "route-manifest 总条目: "; grep -c "href: '/" apps/web/src/data/route-manifest.ts
echo -n "ai-ops-navigation 总条目: "; grep -c "href: '/ai-ops" apps/web/src/data/ai-ops-navigation.ts
echo -n "ai-ops-navigation 带 module 字段的条目: "; grep -c 'module:' apps/web/src/data/ai-ops-navigation.ts
echo -n "多 Agent 框架依赖命中: "; grep -rc "langgraph\|crewai\|dify\|coze" apps/api/package.json package.json 2>/dev/null | awk -F: '{s+=$2} END{print s}'
echo -n "向量库依赖命中: "; grep -rc "milvus\|chroma\|pgvector" apps/api/package.json package.json 2>/dev/null | awk -F: '{s+=$2} END{print s}'

echo "===== 7. 坏商品名样例 ====="
PGPASSWORD=$(grep DB_PASSWORD apps/api/.env | cut -d= -f2) psql -h 127.0.0.1 -p 55432 -U "$(grep DB_USER apps/api/.env | cut -d= -f2)" -d "$(grep DB_NAME apps/api/.env | cut -d= -f2)" -tAc "
select distinct product_name from session_plan_products where product_name like '%[object Object]%' limit 5"
curl -s -b /tmp/_audit_ck.txt "http://127.0.0.1:8788/api/v1/sessions/102/slots" | head -c 200

echo
echo "===== 完成 ====="
