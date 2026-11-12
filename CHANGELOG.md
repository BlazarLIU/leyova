# Changelog

All notable changes to **Leyova** are documented in this file.

## [2026-11-12] — 全面审计整改闭环、架构加固与回归测试

### Added
- **抖音专属分析模块** (`apps/api/src/routes/douyin.ts`): 新增 `/api/v1/douyin/shop/:id/{metrics,channels,anchors}` 端点，纳入统一跨平台店铺守卫 (`assertShopPlatform`) 与 `canAccessAdSpend` 脱敏控制。
- **Fastify 可注入应用工厂与全量集成测试**:
  - 拆分 `apps/api/src/app.ts` (`buildApp`) 与薄入口 `src/index.ts`；
  - 新增 `apps/api/tsconfig.test.json` 及 `apps/api/test/rbac-and-domains.test.ts`（覆盖健康/就绪探针、防爆破 429 锁定、4 种角色二维越权矩阵、大促 5 层试算脱敏、跨平台店铺越权 400、MCP fail-closed 鉴权与语义层隔离）。
- **新增共享与运维能力**:
  - `apps/api/src/lib/mcp-auth.ts`: 共享等时比对 `timingSafeTokenEqual` 与 `signMcpUserId` / `verifyMcpUserSig` HMAC 工具；
  - `docs/data-dictionary/README.md`、`docs/operations.md`、`CHANGELOG.md` 完整运维及数据字典文档，同步更新 `apps/api/src/openapi.ts`、`README.md`、`docs/architecture.md`、`database/README.md`。

### Changed & Fixed
- **鉴权与防爆破缺陷修复**:
  - 修复 `apps/api/src/routes/auth.ts` 连续失败计数器在 `lockedUntil === 0` 时被错误归零的漏洞，使 5 次错密锁定稳定触发 `429`；
  - 修复 `apps/api/src/routes/search-keywords.ts` 引用不存在列名 `dp.title` 导致的 SQL 500 错误，修正为 `dp.product_name AS product_title`。
- **BI 与平台端点收口**: 为 `/api/v1/bi/{dashboard,roi,refund,anomalies}` 与 `/api/v1/ops/goal-tracking` 补充 `requireAuth`、平台权限校验及 `canAccessAdSpend` / `brand_viewer_permissions.can_view_cost` 门禁；重写 `/bi/roi` 与 `/bi/refund` 对接真实事实/售后表并绑定 `fact_trade_daily.upload_id` → `data_uploads` 血缘。
- **AI 语义层 & MCP 安全加固**:
  - 语义层 (`semantic-layer.ts`、`platform-metrics.ts`、`orchestrator.ts`) 与 AI 工具集按角色封堵未授权投流/毛利查询；修复 `platform-metrics.ts` SQL 参数缺失 `$` 漏洞；
  - 前后端与独立 `mcp-server` 移除弱默认秘钥与默认管理员回退 (`LEYOVA_MCP_DEFAULT_USER_ID=1`)，改为 DB 实时校验用户角色、HMAC-SHA256 签名验证及等时 Bearer 检查；
  - 去除 `AttendancePage.tsx` 假数据回退兜底，改用真实 loading/错误重试视图。
- **分区、Cron、日志与备份加固**: `manage-partitions.ts` 扩展至全部 7 张分区表并自动兜底 `DEFAULT` 分区；`cron/index.ts` 全量接入 `system_jobs` 运行状态记录；`cleanup-logs.ts` 对齐 PM2 真实日志路径并采用 `copyFileSync + truncateSync`；`backup.ts` 接入输出校验与 `--retain=N` 保留清理。

---

## Earlier Milestones (`main`)

- **`f750e89`** — `feat(security)`: 落库二维权限矩阵、PostgreSQL RLS (`leyova_app` 与 29 张物理行级策略表)、统一审计日志与前端路由守卫。
- **`4fc1ab3`** — `feat(business-chains)`: 补齐商品主数据与库存、48h 履约 SLA、售后退货工单、达人佣金台账、客服绩效及迁移 `116`/`118` 业务闭环。
- **`136b016`** — `fix(caliber)`: 全链路对齐 `platform_caliber_config` 默认口径 (`amount_type`)，修复多平台数据统计口径漂移。
- **`a8e219e` / `6b8624b` / `fdbb755`** — 修复数据治理发布闸门与反向冲正回滚、告警规则评测闭环、垂直越权与前端侧栏 fail-closed 拦截。
