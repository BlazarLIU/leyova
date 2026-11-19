# 09 · 本轮新发现

> 收录前两份报告（Gemini / dsh）**未系统覆盖**的问题。每条含：现象、证据、影响、根因、建议。
> 严重度：S0 立即修 / S1 本周修 / S2 计划修。

## 一、安全与权限

### NF-01 `/api/v1/metrics` 匿名可读（S0）

- 现象：无 Cookie 访问返回 200 + Prometheus 指标文本。
- 证据：`_evidence/03-api-authz-matrix.md` §4「无 Cookie 基线」。
- 影响：若服务暴露公网，内部表名、接口耗时、业务计数全部泄露。
- 根因：metrics 路由在全局 auth hook 之外注册。
- 建议：纳入 auth hook，或仅内网 + token。

### NF-02 中控跨平台读取（S0）

- 现象：`ctrl_xhs` 读 `GET /api/v1/sessions/1/pnl` 返回 200，body `platformCode=douyin`、`roomName=抖音主直播间`；`ctrl_xhs` 与 `ctrl_douyin` 响应完全一致。
- 证据：`_evidence/03-api-authz-matrix.md` §5-B2；`_evidence/05-platform-probes.md` §2。
- 影响：跨平台越权；客户验收时会立刻暴露「平台隔离不存在」。
- 根因：`sessions.ts` P&L 仅做认证 + RLS，无平台维度；`overview.ts` 无 platform 条件。
- 建议：见改进计划 P1-2。

### NF-03 真实用户平台授权为 0（S0）

- 现象：`user_platform_permissions` 138 行全部属于 23 个 `__t_ad_buyer_*` 测试账号；真实账号 0 行。
- 证据：`_evidence/02-db-rowcounts.md` §8。
- 影响：`resolvePlatforms` 因无显式授权而返回「全部启用平台」→ 所有真实用户默认拥有全部平台可见性。
- 根因：`access-resolver.ts` 的兜底策略（无授权 = 全平台）。
- 建议：改为「无授权 = 无平台」，并在用户创建流程中强制分配。

### NF-04 非 admin 无法访问关键公共接口（S0）

- 现象：55 个路由顶层前缀中 **8 个未进 `MODULE_MAP`，合计 27 个端点**：`assortment`、`finance`、`orders`、`scripts`、`tmall`、`weather`、`wechat`、`metrics`。`module-guard.ts:197-203` 仅豁免 `super_admin/admin/ops_director`，`ops_staff/ad_buyer/video_editor/cs_agent/controller` 全部 403。
- 已实测 403：`/api/v1/scripts/templates`、`/api/v1/finance/accounting-subjects`、`/api/v1/metrics`、`/api/v1/weather/cities`。
- 反直觉后果：**财务角色访问不了 `/api/v1/finance` 总账**；话术库对运营专员不可用，且错误被前端 `.catch(() => {})` 吞掉（只看到空列表）。
- 另有 4 条死条目指向不存在的路由：`/api/v1/customer-service`（实际 `/cs`）、`/api/v1/dict`（实际 `/system/dict`）、`/api/v1/system/compliance`、`/api/v1/system/personnel`。
- 前缀匹配过宽：`startsWith('/api/v1/data')` 会吞掉 `/api/v1/data-live`、`/api/v1/data-uploaded`，使二者继承 `data` 模块授权（`module-guard.ts:222-237`）。
- 证据：`_evidence/11-backend-inventory.md` §1。
- 建议：补 8 个前缀映射 + 清理死条目 + CI 校验（P1-4）。

### NF-05 登录失效账号与文档不一致（S0）

- 现象：`director_zhou`、`buyer_xu` 登录 401；`ctrl_wu` 不存在。
- 证据：`_evidence/03-api-authz-matrix.md` §1。
- 影响：验收/演示时按文档登录失败。
- 根因：`database/migrations/119_...sql:400-409` 写入不同哈希 + `NOT EXISTS` 条件导致 `ctrl_wu` 未插入。
- 建议：修迁移，统一密码源。

## 二、AI 可信度

### NF-06 LLM 双重失效（S0）

- 现象：`.env` `AI_ENABLED=false`；默认模型 `deepseek-chat` 在本地 Ollama 不存在；日志 `[llm] provider call failed (404): model 'deepseek-chat' not found`。
- 补充：Ollama 实际已有 `llama3.1:8b`、`glm4:9b`、`deepseek-r1:8b`、`nomic-embed-text`。
- 证据：`_evidence/06-process-and-logs.md`；端口探测。
- 影响：所有「AI 生成」实际走规则模板；对外宣称的生成能力不存在。
- 建议：改模型名 + 开开关（P1-1）。

### NF-07 LLM 从未成功执行过（S0）

- 现象：`ai_v2_run` 3648 条，`engine=rule` 占 100%，`engine=llm` 为 0；verdict 3499 verified / 149 rejected。
- 证据：DB 实测。
- 影响：「AI 可追溯」是真的，但可追溯的是规则结果，不是模型结果。
- 建议：先跑通 1 条 LLM 链路，再谈多 Agent。

### NF-08 财务页伪造数字签名（S0）

- 现象：`ai-ops-data.ts:500` 生成 `SIG-…-SHA256-VERIFIED`；成本比例按结算额硬造（38%/5%/18%/10%/6%/2.1%）。
- 证据：`_evidence/07-static-checks.md`；代码复核。
- 影响：财务/老板误以为有审计签名，可能据此结算。
- 建议：删除假签名与假成本；无数据显式空态。

### NF-09 审批/下发/闭环三处假成功（S0）

- 现象：`updateImprovementTaskStatus` 失败 `return true`；`AiOpsInboxPage` 忽略返回值 toast「已即时推送下发生效」；`AiOpsLiveWatchPage` catch 后 toast「已实时调度下发」。
- 证据：`_evidence/07-static-checks.md`。
- 影响：现场以为动作已执行，实际无任何后端变更。
- 建议：返回真实结果 + 失败提示（P0-5）。

### NF-10 AI 日报忽略日期参数（S1）

- 现象：`/api/v1/ai/daily-report?date=2026-10-31` 与不传参返回相同的「今天」数据。
- 证据：`ai.ts:59-72` 只查当天；实测两次返回均 `date=2026-11-19`。
- 影响：无法回看历史；配合「数据止于 11-18」→ 日报永远为空。
- 建议：读取 `date` 并校验。

## 三、结构与数据

### NF-11 导航事实源 6 套并行（S1）

- 现象：manifest 90 / ai-ops-navigation 28 / platform-navigation 派生 / GlobalSearch 6 条硬编码 / Topbar 90+32 标签副本 / classic-routes 消费。
- 证据：前端全量盘点（`Topbar.tsx:11-51` 无 import manifest）。
- 影响：改一处不会传导，标签与入口长期漂移（如 `/ai-ops/review/anchors` 有路由无菜单）。
- 建议：manifest 单一源（P1-6）。

### NF-12 5 个 AI-Ops 页面 100% 写死（S1）

- 现象：货盘结构 5 组 27 子类、切片 6 条、活动 4+4、案例 5 条、结算 3 批，全部 `useState` 常量。
- 证据：各页面源码（`AiOpsAssortmentStructurePage.tsx:2-7` 等）。
- 影响：演示可信，生产不可用。
- 建议：标注「示例」或接真实数据（P2-1）。

### NF-13 排品数据 93.5% 损坏（S1）

- 现象：446 行中 417 行 `product_name` 为 `[object Object]精选-X款`。
- 证据：`_evidence/02-db-rowcounts.md` §8；根因 `generate.mjs:381`。
- 影响：排品、货盘结构、复盘商品分析、`/sessions/:id/slots` 全链路坏。
- 建议：修脚本 + 修历史数据（P0-8）。

### NF-14 AI-Ops 有路由无菜单（S1）

- 现象：`/ai-ops/review/anchors`、`/ai-ops/review/closed-loop` 已在 `App.tsx:154-155` 注册，但 28 条菜单里没有；用户只能手输 URL。
- 证据：前端全量盘点 C.1/C.3。
- 影响：真实可用的复盘页被藏起来，反而 `manifest:100` 把「主播效能」redirect 到假数据页。
- 建议：补菜单并修正 redirect 目标。

### NF-15 4 个幽灵页面（S2）

- 现象：`MyPerformancePage`、`MySchedulePage`、`anchors/UnifiedScheduleHub`、`system/AccountsSection` 全仓无引用。
- 证据：前端全量盘点 B 节。
- 影响：维护成本与误读风险。
- 建议：删除。

### NF-16 知识库服务已部署但停止（S2）

- 现象：pm2 有 `anythingllm-server`（stopped）、`anythingllm-collector`（stopped）；`/kb/status` `provider=none, degraded=true`。
- 影响：RAG 其实「差一步启动 + 配置」，不是「完全没做」。
- 建议：先评估 AnythingLLM 是否满足，再决定是否自建 pgvector。

## 四、后端与链路（本轮新增，前两份报告均未覆盖）

### NF-17 同步链路系统性少算（S0）

- 现象：`platform/adapters/base.ts:78-101` 单次调用不循环 `hasMore/nextCursor`，每店铺每轮最多 50 条订单；`:103-110` `fetchTrafficData` 恒返回 `[]`；`ingest/sync-job.ts:277-284` 拉回 0 行也写 `completed` 并推进水位；`:43-47` 水位用 UTC 日期；`:219` 读入 `refreshToken` 后未使用；`:271-275` 逐行 upsert 无事务。
- 影响：日均 >50 单的店铺长期少算 GMV；`fact_traffic_daily` 永远为空；被「0 行 completed」跳过的窗口**永久丢失**；东八区 00:00–08:00 数据错位一天。
- 证据：`_evidence/11-backend-inventory.md` §2；`_evidence/06-process-and-logs.md`（`total=22 completed=0`）。
- 建议：翻页、补流量、0 行不推水位、统一时区、整批事务（P0-10）。

### NF-18 手动上传绕过质量门禁且可把已有数据清零（S0）

- 现象：`routes/ingest-upload.ts:9` import `UnifiedDataPipelineService` 但从未调用；`ingest/manual-mapper.ts:288-352` 缺失列填 0 + `ON CONFLICT DO UPDATE` 全列覆盖；`data_uploads` INSERT 不含 `shop_id`/`tenant_id`；失败分支 `.catch()` 吞掉。
- 影响：脏文件绕过 8 道门禁直接入仓；只含部分指标的上传会把已有 GMV/订单**更新为 0**；上传记录无法归因。
- 证据：`_evidence/11-backend-inventory.md` §3。
- 建议：走同一管线、按实际列更新、补归属、失败显式落状态（P0-11）。

### NF-19 AI 写操作审批空转（S0）

- 现象：`ai/tool-registry.ts:101-130` 的 `write_with_approval` 只创建 pending 记录、不执行；`routes/ai.ts:599-670` 的 `/ai/approve` 批准后再次调用 `executeTool`，又进入 pending 分支。
- 影响：`create_improvement_task`、`update_task_status`、`generate_selection_plan`、`generate_campaign_plan` 永远不落库；侧证 `ai_action_approvals` 0 行、`ai_tool_logs` 仅 3 行。与前端「假成功」叠加成双重假成功。
- 证据：`_evidence/11-backend-inventory.md` §4。
- 建议：批准走真执行分支 + 幂等 + 结果回写（P0-9）。

### NF-20 改一个用户会重置整角色授权（S1）

- 现象：`routes/system-users.ts:118-175` 的 `PUT /system/users/:id` 先 `DELETE FROM role_modules WHERE role_code=$1`，再按本次请求重插。
- 影响：编辑用户 A 的模块，会让同角色的用户 B、C 的模块授权一起被改。
- 证据：`_evidence/11-backend-inventory.md` §5。
- 建议：用户级覆盖与角色级授权分离（P1-10）。

### NF-21 MCP 服务可冒充任意用户（S0）

- 现象：`apps/mcp-server/src/index.ts` 非生产且未配 token 时，仅凭 `X-Leyova-User-Id` 头即可冒充任意用户；`db.ts` 用超级用户池执行工具，绕过 RLS。
- 影响：本机/内网任何进程可读写全部租户数据；21 个工具全仓无 API 侧调用方，却常驻 pm2。
- 证据：`_evidence/11-backend-inventory.md` §5；`_evidence/06-process-and-logs.md`。
- 建议：强制 token + 复用 API 鉴权（P1-11）。

### NF-22 RLS 仅覆盖 58/238 张表（S0）

- 现象：`01_schema.sql` 238 张表仅 **58 张**启用 RLS（策略 108 条），约 180 张无行级隔离；`ai_v2_*`/`ai_eval_*` 策略为 `USING (true)`，任何登录用户可读全部证据链；`shop-guard.ts:1-40` 不校验 tenant/归属；`guard.ts:157` 成本可见性查询失败按角色放行（fail-open）。
- 影响：「多品牌/多租户隔离」在数据层不成立；AI 证据链可被任意登录用户读取。
- 证据：`_evidence/11-backend-inventory.md` §5。
- 建议：按租户/店铺/品牌补 RLS，`ai_v2_*` 按 `user_id` 收敛，fail-open 改 fail-closed（P1-12）。

### NF-23 仅 2/435 个端点有请求 schema（S1）

- 现象：只有 `auth/login`、`auth/change-password` 声明了 Fastify schema；`zod` 全仓 0 引用。
- 影响：非法/畸形 body 直接进业务逻辑，错误以 500 暴露；参数类型不受控。
- 证据：`_evidence/11-backend-inventory.md` §5。
- 建议：写操作端点补 schema，CI 增加覆盖率门禁（P1-13）。

### NF-24 迁移基线漂移（S1）

- 现象：`schema_migrations` 仅 56 条，最后为 `155_p1_metric_catalog_unified`；仓库有 156–170 迁移文件但 0 条登记，而 `system_module_parameters` 表已存在 → 手工建表/迁移未登记。
- 影响：CI 全新库与本地库 schema 不一致；新环境功能缺失或报错。
- 证据：`_evidence/11-backend-inventory.md` §5；`generate-schema.js --check` 失败。
- 建议：迁移与登记表对齐、补提交、CI 跑 `--check`（P1-13）。

### NF-25 9 张孤儿表与 9 个 `_deprecated_*` 对象（S2）

- 现象：`anchor_capabilities`、`anchor_profiles`、`anchor_training_plans`、`anchor_training_records`、`competitor_price_data`、`compliance_activity_reminder`、`fact_content_daily`、`multi_room_status`、`room_health` 仅 demo 写入、无业务写入口。
- 影响：表在但业务链未闭环（主播能力/培训、竞品价格、内容日表、多直播间、直播间健康度）；其中 `room_health`/`multi_room_status` 正是「多 IP 并行」的目标表。
- 证据：`_evidence/11-backend-inventory.md` §8。
- 建议：要么补写入口，要么标注为预留并在 UI 隐藏（P2）。

### NF-26 `get_anchor_profile` 工具一调用就 SQL 报错（S1）

- 现象：`ai/register-default-tools.ts:78-108` 引用不存在的列（`anchor_profiles.anchor_id`、`p.description`）。
- 影响：29 个 AI 工具中存在不可用工具；主播画像链路断裂。
- 证据：`_evidence/11-backend-inventory.md` §9。
- 建议：按真实 schema 重写 SQL，并加工具级冒烟测试。

## 五、新发现汇总表

| 编号 | 类别 | 严重度 | 一句话 |
|---|---|---|---|
| NF-01 | 安全 | S0 | `/metrics` 匿名可读 |
| NF-02 | 权限 | S0 | 中控跨平台读 P&L |
| NF-03 | 权限 | S0 | 真实用户平台授权 0 行 |
| NF-04 | 权限 | S0 | `MODULE_MAP` 缺 8 前缀 / 27 端点，另有 4 条死条目 |
| NF-05 | 权限 | S0 | 3 个账号登录失效 |
| NF-06 | AI | S0 | LLM 关闭 + 模型不存在 |
| NF-07 | AI | S0 | LLM 历史执行 0 次 |
| NF-08 | AI | S0 | 财务页假签名 + 假成本 |
| NF-09 | AI | S0 | 审批/下发/闭环假成功 |
| NF-10 | AI | S1 | 日报忽略日期 |
| NF-11 | 结构 | S1 | 导航 6 套并行 |
| NF-12 | 结构 | S1 | 6 页 100% 写死 |
| NF-13 | 数据 | S1 | 排品 93.5% 损坏 |
| NF-14 | 结构 | S1 | 2 个真实复盘页无菜单 |
| NF-15 | 结构 | S2 | 4 个幽灵页 |
| NF-16 | AI | S2 | 知识库服务已部署但停止 |
| NF-17 | 链路 | S0 | 同步单页拉取 + 流量恒空 + 0 行也 completed |
| NF-18 | 链路 | S0 | 手动上传绕过门禁，可把 GMV 清零 |
| NF-19 | AI | S0 | AI 写操作审批空转，永不落库 |
| NF-20 | 权限 | S1 | 改一个用户重置整角色授权 |
| NF-21 | 安全 | S0 | MCP 仅凭 header 可冒充任意用户 |
| NF-22 | 安全 | S0 | RLS 仅 58/238 表，`ai_v2_*` 全开放 |
| NF-23 | 质量 | S1 | 仅 2/435 端点有 schema 校验 |
| NF-24 | 质量 | S1 | 迁移 156–170 未登记，schema 漂移 |
| NF-25 | 数据 | S2 | 9 张孤儿表 + 9 个 deprecated 对象 |
| NF-26 | AI | S1 | `get_anchor_profile` 一调用即 SQL 报错 |
