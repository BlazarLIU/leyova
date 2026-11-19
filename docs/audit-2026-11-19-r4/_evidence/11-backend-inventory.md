# 证据 11 · 后端与数据层盘点（静态 + 关键实测）

> 采集时间：2026-11-19
> 方式：`apps/api` / `apps/mcp-server` / `ai-ops` / `database` 静态阅读；关键结论用只读 SQL 复核。
> 说明：本文件为 `03-RUNTIME-USABILITY.md` 与 `06-IMPROVEMENT-PLAN.md` 的后端证据底稿。

## 1. 路由与模块映射

| 项 | 值 |
|---|---|
| `app.ts` 注册的路由插件 | **76** |
| 实际端点 | **435**（其中 `platform-dedicated.ts`、`resources.ts` 为 0 端点） |
| 运行时 OpenAPI operations（另一口径） | 442 |
| `MODULE_MAP` 条目 | 72 |
| 路由顶层前缀 | 55，已映射 47，**缺映射 8** |

### 缺映射导致 fail-closed 的 8 个前缀（共 27 个端点）

`/api/v1/assortment`、`/api/v1/finance`、`/api/v1/orders`、`/api/v1/scripts`、`/api/v1/tmall`、`/api/v1/weather`、`/api/v1/wechat`、`/api/v1/metrics`。

`module-guard.ts:197-203` 仅豁免 `super_admin/admin/ops_director`，其余角色全部 403。
**最反直觉：`finance` 角色（若存在）无法访问 `/api/v1/finance` 总账。**

### `MODULE_MAP` 死条目（指向不存在的路由）

`/api/v1/customer-service`（实际是 `/api/v1/cs`）、`/api/v1/dict`（实际 `/api/v1/system/dict`）、`/api/v1/system/compliance`、`/api/v1/system/personnel`。

### 前缀匹配过宽

`startsWith('/api/v1/data')` 会吞掉 `/api/v1/data-live`、`/api/v1/data-uploaded`，使二者继承 `data` 模块授权（`module-guard.ts:222-237`）。

## 2. 同步链路缺陷（P0）

| 缺陷 | 位置 | 后果 |
|---|---|---|
| 单页拉取，不循环 `hasMore/nextCursor` | `platform/adapters/base.ts:78-101` | 每店铺每次最多 50 条订单 → 日均 >50 单长期少算 |
| `fetchTrafficData` 恒返回 `[]` | `base.ts:103-110` | `fact_traffic_daily` 永远空 |
| 0 行也写 `completed` | `ingest/sync-job.ts:277-284` | 水位推进，跳过的窗口永久丢失 |
| 水位用 UTC 日期 | `sync-job.ts:43-47` | 东八区 00:00–08:00 错位一天 |
| `refreshToken` 读入未使用 | `sync-job.ts:219` | token 过期无自动刷新 |
| 逐行 upsert 无事务 | `sync-job.ts:271-275` | 中途失败留下半批数据 |

## 3. 手动上传链路（P0）

- `routes/ingest-upload.ts:9` import `UnifiedDataPipelineService` 但**从未调用** → 绕过 8 道质量门禁。
- `ingest/manual-mapper.ts:288-352`：缺失列填 0 + `ON CONFLICT DO UPDATE` 全列覆盖 → **部分指标上传会把已有 GMV/订单清零**。
- `data_uploads` INSERT 不含 `shop_id`/`tenant_id`（`ingest-upload.ts:92-107`）→ 无法归因。
- 失败分支 `.catch()` 吞掉（`:145-151`）→ 状态可能永久 `processing`。

## 4. AI 写操作审批空转（P0）

- `ai/tool-registry.ts:101-130`：`write_with_approval` 只创建 pending 记录，不执行。
- `routes/ai.ts:599-670`：`/ai/approve` 再次调用 `executeTool`，又进入 pending 分支。
- 结果：`create_improvement_task`、`update_task_status`、`generate_selection_plan`、`generate_campaign_plan` **永远无法落库**。
- 侧证：`ai_tool_logs` 仅 3 行；`ai_action_approvals` 0 行。

## 5. 权限与隔离

| 项 | 值 |
|---|---|
| `database/01_schema.sql` 表 | 238 |
| 启用 RLS 的表 | **58** |
| RLS 策略 | 108 |
| 无行级隔离的表 | ~180 |
| 运行时 `roles` | **8**（`super_admin/ops_director/ops_staff/controller/hrbp/ad_buyer/video_editor/cs_agent`） |
| `schema_migrations` | 56 条，最后为 `155_p1_metric_catalog_unified` |
| 156–170 迁移 | **0 条已登记**；`system_module_parameters` 表却存在 → 存在手工建表/漂移 |
| 有 Fastify schema 的端点 | **2**（`auth/login`、`auth/change-password`）；`zod` 0 引用 |

### 关键权限缺陷

1. `PUT /system/users/:id`（`system-users.ts:118-175`）先 `DELETE FROM role_modules WHERE role_code=$1` 再按本次请求重插 → **改一个用户会重置该角色所有人的模块授权**。
2. `mcp-server/src/index.ts`：非生产且未配 token 时，仅凭 `X-Leyova-User-Id` 头即可冒充任意用户；`db.ts` 用超级用户池执行工具，绕过 RLS。
3. `ai_v2_*` / `ai_eval_*` 的 RLS 策略为 `USING (true)`，任何登录用户可读全部证据链。
4. `shop-guard.ts:1-40` 只校验 shop 存在与平台匹配，不校验 tenant/用户归属。
5. `guard.ts:157` 成本可见性查询失败时按角色放行（fail-open）。

### 角色删除是有意的

`database/migrations/131_remove_finance_and_permissions.sql`、`144_cost_visibility_and_finance_removal.sql` 明确移除了 `finance` 角色。
→ 前端 `Layout.tsx` / `RequireAiOpsAccess.tsx` 中的 `'finance'` 白名单**确定是死代码**，不是「迁移漂移」。

## 6. 平台能力

- 6 个 `getCapabilities()` **完全同构**：`supportsLive/supportsShelf/supportsContent/supportsAds/supportsAutoSync/supportsManualUpload` 全 `true`。
- `supportedModules` 使用 `cockpit/live_monitor/shop_overview/data_manage` 等旧码，与 `MODULE_MAP` 的 `overview/bi/sessions/review` 不同源，全仓无比对逻辑。
- `platform_capability_matrix` 唯一读取点 `access-resolver.ts:133`，只用于收窄 `access.modules` 给前端菜单，**不影响后端鉴权与数据查询**。
- 矩阵中 `live*` 对 taobao/tmall/wechat 置 false，与适配器 `supportsLive=true` 矛盾。
- `routes/platform-dedicated.ts` 为空壳（未被注册）；真正的 insights 路由（`insights-*.ts`）是**真 SQL 查询**，非 mock → 3 个坏洞察页是**前端配置问题**。

## 7. worker 与定时任务

| 项 | 事实 |
|---|---|
| `leyova-worker` | 未注册到 pm2 |
| API 内嵌 cron | 在跑（01:30 日聚合、04:00 分区、05:00 同步） |
| `ecosystem.config.cjs` 的 `DISABLE_CRON=true` | 与真实进程不符 |
| AI 日报（01:15）与异常巡检（每小时） | `cron/index.ts:141-145` **已注释** → 死代码 |
| 未知 `job_type` | `worker.ts:129-138` 直接标 `completed` → 静默丢任务 |
| 轮询吞吐 | 每 5s 一条 → 上限 12 条/分钟 |

## 8. 数据层

| 项 | 值 |
|---|---|
| `roles` 运行时 | 8 行（已删除 finance 等） |
| 仅 demo 写、无业务写入口的孤儿表 | 9 张：`anchor_capabilities`、`anchor_profiles`、`anchor_training_plans`、`anchor_training_records`、`competitor_price_data`、`compliance_activity_reminder`、`fact_content_daily`、`multi_room_status`、`room_health` |
| `_deprecated_*` 对象 | 9 个 |
| `ai_config` | 0 行 → KB/记忆库全部降级 |

## 9. 其他确认

- `ai-ops/` 位于**仓库根**（`/home/leyova/ai-ops`），`src/` 只有 `config.ts`，无被引用 → 骨架工程。
- `apps/ai-ops` 不存在（此前 dsh 的表述需按此修正）。
- 合规采集器 5 个全部**不发 HTTP**，返回硬编码文案，却标 `fetchMethod: 'headless' / 'html_direct'`。
- `campaign-plan-service.ts:123-190` 的「AI 话术」为固定模板，仅货盘两项与真实数据相关。
- `ai/register-default-tools.ts:78-108` 的 `get_anchor_profile` 引用不存在的列（`anchor_profiles.anchor_id`、`p.description`），调用即 SQL 报错。

## 10. 与前端盘点的交叉验证

| 交叉点 | 结论 |
|---|---|
| 3 个洞察页报错 | 后端 SQL 正常 → 前端 `PlatformInsightConfig` 缺 `path` |
| 主播绩效造假 | 后端 `/review/anchors` 真实 → 前端 `ai-ops-data.ts` 派生造假 |
| 财务页假签名 | 后端 `/finance/*` 被 MODULE_MAP 挡住 → 前端静默兜底 + 伪造签名 |
| 审批假成功 | 前端提示成功 + 后端审批空转 → 双重假成功 |
| 平台切换无效 | 前端不发平台头 + 后端矩阵仅用于菜单 |
