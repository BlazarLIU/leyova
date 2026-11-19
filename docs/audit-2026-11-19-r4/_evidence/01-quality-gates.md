# 证据 01 · 质量门禁实测

> 采集时间：2026-11-19 14:30–14:40 CST（06:30–06:40 UTC）
> 采集方式：在 `/home/leyova` 下逐条执行，只读（不 build、不写库）
> 环境噪声：本机所有命令均输出 `libselinux.so.1: no version information available`（Trae 运行环境注入），不影响退出码。

| # | 命令 | exit | 关键输出 | 结论 |
|---|---|---|---|---|
| 1 | `pnpm -F @leyova/api run openapi:check` | **0** | `runtime=439 generated=439 static=327`；`仅运行时有(文档缺): 0`；`仅文档有(代码无): 0`；`静态扫描多出: 0`；`[OK] OpenAPI 与代码完全一致` | 通过 |
| 2 | `pnpm check:guardrails` | **0** | `0 RLS-bypass routes, 0 unguarded fact_trade_daily GMV aggregations, 316 frontend API calls matched (435 backend routes)` | 通过 |
| 3 | `pnpm -F @leyova/api exec tsc --noEmit -p tsconfig.json` | **0** | 无 TS 诊断输出 | 通过 |
| 4 | `node database/generate-schema.js --check` | **1** | `合计 2125 条语句 / 9947 行`；`✗ 01_schema.sql 与数据库当前状态不一致，需要重新生成` | **失败：schema 快照已漂移** |
| 5 | `pnpm -F @leyova/api test` | 未运行 | 按只读约束跳过（会向生产库 INSERT `__t_*` 用户） | 见下 |

## 关于后端测试为何跳过

读测试源码确认以下套件会写生产库：

- `apps/api/test/selection-and-compliance.test.ts:28`
- `apps/api/test/rbac-and-domains.test.ts:40`
- `apps/api/test/platform-adapters.test.ts:34`（另在 `:195` 插入 `__test_oauth_shop` 店铺）
- `apps/api/test/resource-layer.test.ts:33`

均 `INSERT INTO users` 建 `__t_*` 临时账号，正常路径在 `finally` 删除；异常退出即残留。

**实证残留**：生产库现存 **25 个 `__t_*` 账号** + **2 条 `__test_oauth_shop` 店铺**（dim_shop id 50/56，authStatus=authorized）。

> 结论：CI 绿灯不代表本地绿。`generate-schema.js --check` 已红；测试套件对生产库有写入副作用，不能在生产实例上跑。
