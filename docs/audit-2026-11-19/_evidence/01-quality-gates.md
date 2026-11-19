# 质量门禁实测（2026-11-19）

执行位置：`/home/leyova`

## openapi:check
```
$ pnpm -F @leyova/api openapi:check
runtime=439  generated=439  static=327
仅运行时有(文档缺): 0
仅文档有(代码无): 0
静态扫描多出(onRoute 未收集): 0
[OK] OpenAPI 与代码完全一致
```
判定：✅ 通过

## check:guardrails
```
$ pnpm check:guardrails
CI Guardrail checks passed: 0 RLS-bypass routes, 0 unguarded fact_trade_daily GMV aggregations, 316 frontend API calls matched (435 backend routes).
```
判定：✅ 通过

## tsc（api + web）
```
$ pnpm -F @leyova/api exec tsc -p tsconfig.test.json --noEmit   → exit 0
$ pnpm -F @leyova/web exec tsc -b                                → exit 0
```
判定：✅ 通过

## api test
```
$ pnpm -F @leyova/api test
ℹ tests 160
ℹ suites 15
ℹ pass 143
ℹ fail 0
ℹ cancelled 17
```
失败根因（非断言失败，是套件被取消）：
```
error: insert or update on table "users" violates foreign key constraint "users_role_fkey"
detail: Key (role)=(operator) is not present in table "roles".
```
出处：`apps/api/test/platform-adapters.test.ts:190` `createTempUser('operator')`
根因链：迁移 168 把 `users.role` 的 CHECK 枚举换成 → `roles(code)` 外键，但 `roles` 表只有 8 个角色，不含 `operator`。
判定：⚠️ **143 pass / 17 cancelled**（不是全绿）

## web test
```
$ pnpm -F @leyova/web test
ℹ tests 24  ℹ pass 24  ℹ fail 0
```
判定：✅ 通过

## schema drift
```
$ node database/generate-schema.js --check
✗ 01_schema.sql 与数据库当前状态不一致，需要重新生成
  table 241（DB）/ 238（01_schema.sql）
```
额外：DB 有 4 张 `01_schema.sql` 里没有的表：`_deprecated_v_schedule_by_role`、`_deprecated_anchor_rankings`、`_deprecated_session_product_details`、`_deprecated_session_product_skus`
判定：❌ 漂移

## 进程状态
```
API   :8788  ✅ 运行中（pid 189686）
Web   :5513  ✅ 运行中（pid 189699，title: leyova - 全渠道电商数字化运营中枢）
MCP   :9101  ✅ 运行中（pid 2283）
PG    :55432 ✅ 运行中
Worker      ❌ 未运行（ps aux | grep worker.ts → 0）
```
Worker 停摆影响：`cron/` 下 7 个任务全停——`aggregate-facts`（agg_* 刷新）、`aggregate-stats`、`compliance-patrol`（合规巡检）、`detect-anomalies`（异常检测）、`manage-partitions`（分区预建）、`archive-old-data`（冷数据归档）。
