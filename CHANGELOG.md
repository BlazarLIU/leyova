# Changelog

All notable changes to **Leyova** are documented in this file.

## [2026-11-12 — Round 2 Overlap & Redundancy Consolidation]

### Added & Consolidated
- **全路由 PostgreSQL RLS 全覆盖 & 服务签名统一**：
  - 将全部 37 个业务路由文件统一迁入 `withRlsContext` / `withRlsPool`（仅登录/登出与健康检查 `auth.ts`、`health.ts` 保留直连 `getPool`）；修复 `bi.ts` 使用不存在列名 `sp.display_name` 为 `sp.platform_name`，使 `/api/v1/bi/roi` 与 `/api/v1/bi/refund` 对接真实 `fact_ad_spend_daily`、`ad_tool_dict`、`v_fact_trade_default` 与 `fact_after_sale_tickets` 稳定返回真实指标。
  - `platform/*`、`ai/*`、`services/anchor-ranking.ts`、`ingest/{sync-job,manual-mapper,douyin-bridge}.ts`、`cron/aggregate-facts.ts`、`lib/{audit,partitions}.ts` 统一接收可选 `DbExecutor = Pool | PoolClient`（兼容传透 RLS 事务连接与 Savepoint）。
- **数据库结构收敛与去重 (`database/migrations/119_round2_consolidation_and_differentiation.sql`)**：
  - 收敛 `ad_tool_dict`（新增 `impression_window_hours` / `supported_windows` 与真实种子数据）与 `pricing_rules`；移除重叠表 `promotion_rules`、`sync_jobs`、`sync_logs`、`ad_campaigns` 并对齐权限模块 (`audit_logs` 独立权限模块、10 角色 / 41 模块)。
  - 保留 `live_registrations`（人工考勤/业绩录入闭环）与 `live_sessions` 职责边界，保留 `/api/v1/bi/roi` 与 `/api/v1/net-roi/overview` 并提供归因窗口 (`byAttributionWindow`) 与经营模式 (`byBusinessMode`) 拆分维度。
- **前端路由收口、动态店铺 Hook、角色模块权限矩阵与 CI 门禁**：
  - 清理死代码 `ContentConfigPage.tsx` 与 `data/navigation.ts`；将 `/content/config` 重定向至 `/content/center-config`，移除重复 `/ops/sessions` 路由及重复 `/shop/products` 导航项；统一 `Topbar.tsx`、`platform-navigation.ts`、`App.tsx` 与 `audit_logs` 模块权限及「合规风控」命名。
  - 新增 `apps/web/src/hooks/useShops.ts` 从 `/api/v1/platforms` 动态获取活跃店铺并移除 `AfterSalesPage` / `FulfillmentSlaPage` / `KolCooperationPage` 中的硬编码 `mapShop`。
  - 在 `AccountsSection.tsx` 补齐全部模块中文映射并新增「角色模块权限矩阵」配置卡片对接 `PUT /api/v1/system/roles/modules`；`UsersPage.tsx` 补全全部 10 个角色选项与标签。
  - 新增 `scripts/check-guardrails.mjs`（`pnpm check:guardrails`）并接入 `.github/workflows/ci.yml`，静态阻断业务路由新增 `getPool()` 绕过 RLS 及未带口径过滤的 `fact_trade_daily` `SUM(gmv)` 查询；扩展 `rbac-and-domains.test.ts` 至 59 项全通过。

---

## [2026-11-12 — Release Hardening, Real OpenAPI/OAuth & CI]

### Added
- **开放平台真实 HTTP/OAuth 传输与加密凭据绑定**:
  - `apps/api/src/modules/data-governance/adapters/base-adapter.ts` & `platform-adapters.ts`：实现 7 大电商平台（抖音/快手/淘宝/天猫/京东/拼多多/小红书）真实 `fetch()`（含超时控制、429/5xx 退避重试、TOP MD5 / 抖店 v2 HMAC-SHA256 / 快手 / 京东 / 拼多多 / 小红书 Ark 签名）的 OAuth 换码、Token 刷新、订单与退款拉取，彻底移除硬编码伪造 Token 与 `sampleOrders`。
  - `apps/api/src/platform/adapters/base.ts` 及四类适配器与 `apps/api/src/ingest/sync-job.ts` 收敛统一，接入 `decryptCredential` 解密持久化店铺凭证并保持 `manual_only` / 占位凭证 fail-closed。
  - `apps/api/src/routes/platforms.ts` & `openapi.ts`：新增管理员专属 `GET /api/v1/platforms/:code/oauth/url`、`POST /api/v1/platforms/:code/oauth/callback` 与 `POST /api/v1/platforms/:code/shops/:shopId/credentials`（AES-256-GCM 密文落库 + 脱敏返回 + 审计记录），并在 `GET /api/v1/platforms` 返回脱敏凭证状态。
  - `apps/web/src/pages/system/PlatformManagementPage.tsx`：新增店铺「配置 OAuth / 凭证」双标签弹窗与「立即同步」触发入口，完成管理员闭环。
  - `apps/api/src/config/env.ts` & `security.ts`：在 `NODE_ENV=production` 下强制校验强随机 `API_ENCRYPTION_KEY`（>= 32 字符，禁止默认密钥）。
  - 新增 `apps/api/test/platform-adapters.test.ts`（本地 `node:http` 测试服务覆盖 7 平台 OAuth、拉数、错误透传、fail-closed、脱敏响应及 `runSyncJob` 端到端闭环）。
- **前端路由按需懒加载、Vite 分包与生产静态托管**: `apps/web/src/App.tsx` 93 个页面路由统一改造为 `React.lazy` + `<Suspense>`；`apps/web/vite.config.ts` 配置 `manualChunks` 与 `preview` 代理，并通过 `ecosystem.config.cjs` 切换 `leyova-web` 以 `vite preview` 托管 `dist/` 生产静态资源（主入口 `120.52 kB`）。
- **CI 流水线**: 新增 `.github/workflows/ci.yml`，在全新 PostgreSQL 16 服务上自动执行空库初始化 + 迁移幂等校验、全工作区构建、测试类型检查与全量自动化测试。

### Changed & Fixed
- **空库冷启动引导修复 (`database/migrate.js`)**: 修复 `01_schema.sql` 设置 `search_path=''` 导致同一会话后续执行 `02_seed.sql` 报 `relation "roles" does not exist` 的问题，并在全新空库上验证 `01~03` + 19 个增量迁移（`100~118`）一次性通过。
- **MCP 严格 HMAC 验签与告警通道清理**: 本地运行态与 `.env.example` 默认启用 `LEYOVA_MCP_REQUIRE_SIG=true`，补充 `/mcp` 正向 HMAC 放行回归用例；清空 `alert_rules` id=6 占位示例 Webhook。

---

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
