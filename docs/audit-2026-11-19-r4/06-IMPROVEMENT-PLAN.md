# 06 · 改进计划（P0–P3）

> 原则：先「不再骗人」，再「数据进来」，再「平台下沉」，最后「AI 自动化」。
> 每条含：证据 → 改法 → 验收 → 是否需决策。
> 本计划不改变审计结论，仅为执行建议。

## P0 · 阻断性（1 周内，不做会持续误导业务）

### P0-1 修复登录失效账号

- 证据：`director_zhou`、`buyer_xu` 登录 **401**（bcrypt 与 `Admin@123456` 不匹配）；`ctrl_wu` 在 `users` 表**不存在**。根因 `database/migrations/119_round2_consolidation_and_differentiation.sql:400-409` 写入另一枚哈希且带 `NOT EXISTS(role=...)` 条件（`controller` 已有 `control_zhao`）。
- 改法：统一密码哈希来源；补齐 `director_zhou`/`buyer_xu`/`ctrl_wu`；README 的账号表与库对齐。
- 验收：13 个账号全部 200；`SELECT count(*) FROM users WHERE username IN (...)` 全为 1。
- 需决策：**否**。

### P0-2 角色字典对齐

- 证据：`Layout.tsx:66-80` 与 `RequireAiOpsAccess.tsx:16-32` 使用 `admin`/`operator`/`finance`，DB `roles` **无这三个**；真实角色 `ad_buyer`/`video_editor`/`cs_agent` 被 AI-Ops 白名单排除。
- 改法：以 DB 8 角色为唯一字典，抽 `src/constants/roles.ts`；删除幽灵角色；给 `ad_buyer`/`video_editor`/`cs_agent` 配置合理入口。
- 验收：登录后各角色菜单与 DB `role_modules` 一致；grep 无 `'operator'`/`'finance'` 字面量。
- 需决策：**是**（是否保留 `finance` 作为独立角色，还是由 `ops_director` 兼任）。

### P0-3 关闭匿名指标端点

- 证据：`GET /api/v1/metrics` **无 Cookie 200**，其余端点 401。
- 改法：纳入全局 auth hook；或仅允许内网/白名单 IP。
- 验收：无 Cookie 访问返回 401；Prometheus 抓取走独立 token。
- 需决策：**否**。

### P0-4 收敛财务与场次 P&L 可见性

- 证据：`ctrl_xhs` 读 `/sessions/1/pnl` 200 且为抖音数据；`video_lin`/`cs_qian`/`ctrl_*` 均可读 GMV/退款/净收入；`finance_chen`（`ad_buyer`）反而 403；`controller` 被前端当财务角色。
- 改法：P&L 增加模块级守卫（仅财务/总监）；`controller` 移除财务白名单；补平台校验（见 P1-2）。
- 验收：`ctrl_*`、`video_editor`、`cs_agent` 读 P&L 得 403；`finance_chen` 在角色修正后可见财务。
- 需决策：**是**（财务角色定义）。

### P0-5 修复「假成功」链路

- 证据：`ai-ops-data.ts:700-702` 失败 `return true`；`AiOpsInboxPage.tsx:43-47` 忽略返回值仍 toast「已即时推送下发生效」；`AiOpsLiveWatchPage.tsx:63-70` catch 后仍「已下发」；`AiOpsActionItemsPage.tsx:22`、`AiOpsScheduleRecommendPage.tsx:65` 同类。
- 改法：所有写操作返回真实结果；失败必须 toast 失败并保留重试；删除「已下发/已闭环」的本地假状态。
- 验收：断网/后端 500 时页面显示失败，不显示成功。
- 需决策：**否**。

### P0-6 停止真实分支内造假

- 证据：`ai-ops-data.ts:576-585` 主播绩效用 `30+(i%5)*8`、`1500+(10-i%10)*120`、`liveHours*gpm*0.32`、`80+(10-i%10)*2`；`:441-500` 财务成本按结算额比例硬造并生成 `SIG-…-SHA256-VERIFIED` 假签名；`AiOpsCockpitPage` 固定 4+2 条 AI 动作/CASE。
- 改法：删除派生公式；缺数据就展示「暂无数据」；删除假签名文案。
- 验收：grep 无 `Math.round(1500 +`、无 `SHA256-VERIFIED`；空数据页面显示空态。
- 需决策：**否**。

### P0-7 修复 3 个直接报错的平台洞察页

- 证据：`PlatformInsightConfig.ts:54`（tmall/promotion-layers 缺 `path`）、`:95`、`:103`（wechat 两条缺 `path`）；`PlatformInsightPage.tsx:15-20` 无兜底直接输出「未找到页面配置」。
- 改法：补 `path` 字段；页面加错误边界与友好提示。
- 验收：10 个洞察路由全部渲染内容；无开发文案外露。
- 需决策：**否**。

### P0-8 修复排品数据损坏

- 证据：`session_plan_products` 446 行中 417 行 `product_name LIKE '%[object Object]%'`；根因 `database/demo/generate.mjs:381` 把对象 `p.cat` 直接模板化。
- 改法：修生成脚本（取 `p.cat.name`）；重跑演示数据或 SQL 修复历史行。
- 验收：`count(*) where product_name like '%[object Object]%'` = 0；排品页/复盘商品分析正常显示。
- 需决策：**否**。

### P0-9 修复 AI 写操作审批空转

- 证据：`ai/tool-registry.ts:101-130` 的 `write_with_approval` 只落 pending 记录、不执行工具；`routes/ai.ts:599-670` 的 `/ai/approve` 批准后再次调用 `executeTool`，又进入同一个 pending 分支 → 死循环。侧证：`ai_action_approvals` 0 行、`ai_tool_logs` 仅 3 行。
- 影响：`create_improvement_task`、`update_task_status`、`generate_selection_plan`、`generate_campaign_plan` 四个写工具**永远无法落库**；前端却提示「已下发」（见 P0-5），构成双重假成功。
- 改法：审批通过时走「真正执行」分支（`executeTool` 需接受 `approved=true` 跳过 pending）；写操作加幂等键与执行结果回写；失败必须回写失败状态。
- 验收：任选一个写工具走完「提案 → 批准 → 落库」全链路，业务表出现新行，`ai_action_approvals` 状态为 `executed`。
- 需决策：**否**。

### P0-10 修复同步链路系统性少算

- 证据：`platform/adapters/base.ts:78-101` 单次调用不循环 `hasMore/nextCursor`（每店每轮最多 50 单）；`:103-110` `fetchTrafficData` 恒返回 `[]`；`ingest/sync-job.ts:277-284` 拉回 0 行也写 `completed` 并推进水位；`:43-47` 水位用 UTC 日期；`:219` 读入 `refreshToken` 后未使用；`:271-275` 逐行 upsert 无事务。
- 影响：日均 >50 单的店铺长期少算 GMV；流量事实表永远为空；被「0 行 completed」跳过的窗口永久丢失；东八区 00:00–08:00 数据错位一天；中途失败留下半批数据。
- 改法：适配器内用 `while (hasMore)` 翻页并设上限保护；补齐流量接口或明确标注「未开通」；0 行不得推进水位；水位统一 `Asia/Shanghai`；整批包事务；token 到期前刷新。
- 验收：单店铺单日 >50 单能全量入仓；`fact_traffic_daily` 有非空行；重跑同一窗口结果幂等；`sync_job` 无「0 行 completed」。
- 需决策：**否**。

### P0-11 手动上传接入质量门禁并禁止清零

- 证据：`routes/ingest-upload.ts:9` import `UnifiedDataPipelineService` 但从未调用；`ingest/manual-mapper.ts:288-352` 缺失列填 0 且 `ON CONFLICT DO UPDATE` 全列覆盖；`ingest-upload.ts:92-107` 的 `data_uploads` INSERT 不含 `shop_id`/`tenant_id`；`:145-151` 失败分支 `.catch()` 吞掉。
- 影响：脏文件绕过 8 道质量门禁直接入仓；只含部分指标的上传会把已有 GMV/订单**更新为 0**；上传记录无法归因到店铺。
- 改法：上传走同一 `UnifiedDataPipelineService`；冲突更新改为「仅更新文件实际包含的列」；补 `shop_id`/`tenant_id`；失败写 `failed` 并保留原因。
- 验收：缺列文件上传后原 GMV 不变；脏文件被门禁拦截并给出原因；`data_uploads` 每行有 `shop_id`。
- 需决策：**否**。

## P1 · 高优（2–4 周）

### P1-1 LLM 与知识库接线

- 证据：`.env` `AI_ENABLED=false`；默认模型 `deepseek-chat` 不在 Ollama（有 `llama3.1:8b`/`glm4:9b`/`deepseek-r1:8b`/`nomic-embed-text`）；`ai_v2_run` 0 次 `engine=llm`；`/kb/status` `configured=false, provider=none`。
- 改法：模型改为本地已有；`AI_ENABLED=true`；接一个真实 KB（或先把 `script_library` 用 `nomic-embed-text` 做本地检索）。
- 验收：`ai_v2_run` 出现 `engine=llm` 且 verdict 有 verified；`/ai/chat` 返回模型生成而非规则模板。
- 需决策：**是**（自建 Ollama vs 接豆包/通义云 API，成本与合规不同）。

### P1-2 平台切换下沉到后端

- 证据：前端从不发送 `x-leyova-platform`；`overview.ts` 无 platform 条件；`ctrl_xhs` 读抖音场次 200；`user_platform_permissions` 真实账号 0 行。
- 改法：API 客户端统一注入平台头；`overview/session/review/finance` 查询加 `platform_code` 条件；补真实用户平台授权表。
- 验收：douyin 与 xiaohongshu 的 `/overview/sessions` 结果集不同（md5 不同）；越权读返回 403。
- 需决策：**是**（一个用户是否允许同时绑定多平台）。

### P1-3 平台能力矩阵真实化

- 证据：`platform_capability_matrix` 198 行、`is_applicable=false` **0 行**、六平台签名相同；API `supportedModules` 用 `cockpit/anchors/ops_goals` 旧名。
- 改法：按基准 §3 填入真实差异（直播/货架/内容形态、指标口径集），允许不适用；统一用 `system_modules.code`。
- 验收：六平台能力签名至少 3 种；`/platforms` 的 `supportedModules` 全部能在 `system_modules` 中找到。
- 需决策：**是**（各平台差异由谁维护）。

### P1-4 补齐 `MODULE_MAP` 缺失前缀并清理死条目

- 证据：55 个顶层前缀中 **8 个未映射（27 个端点）**：`assortment`、`finance`、`orders`、`scripts`、`tmall`、`weather`、`wechat`、`metrics`。`module-guard.ts:197-203` 仅豁免 `super_admin/admin/ops_director`，其余角色全 403。另有 4 条死条目：`customer-service`（实际 `/cs`）、`dict`（实际 `/system/dict`）、`system/compliance`、`system/personnel`。
- 改法：补 8 个前缀映射；删除/改正 4 条死条目；`startsWith('/api/v1/data')` 收窄，避免吞掉 `data-live`/`data-uploaded`；为公共端点加 `public` 标记；CI 增加「新路由必须登记」检查。
- 验收：`operator_wang` 读话术库 200、`finance` 计账科目 200；`node scripts/check-module-map.mjs` 无缺映射。
- 需决策：**否**。

### P1-5 静默吞错治理

- 证据：54/122 页面存在 `catch {}`；`ScriptTemplatesPage.tsx:78` 用 `.catch(() => {})` 回退空列表。
- 改法：统一 `useApiQuery`，失败展示错误态 + 重试；禁止空 catch（加 lint 规则）。
- 验收：lint 拦截空 catch；403 页面显示「无权限」而非空列表。
- 需决策：**否**。

### P1-6 导航合并

- 证据：6 套导航源；`Topbar.tsx:11-51` 90 条标签副本；`GlobalSearch.tsx:12-19` 6 条硬编码；AI-Ops 28 条 `module:0`。
- 改法：manifest 单一源；Topbar/GlobalSearch 从 manifest 派生；AI-Ops 合并进 manifest 并补 module。
- 验收：改 manifest 后三处同步；AI-Ops 条目受模块鉴权。
- 需决策：**否**。

### P1-7 AI-Ops 准入修正

- 证据：`ad_buyer`/`video_editor`/`cs_agent` 被 `Layout.tsx:66-75` 排除，但这些角色恰是最需要 AI 辅助的岗位。
- 改法：按岗位给最小可用集（投放看投放复盘、剪辑看脚本/素材、客服看话术/售后）。
- 验收：三岗位登录后可见对应 AI-Ops 页。
- 需决策：**是**（岗位权限边界）。

### P1-8 `disabledModules` 全链路生效

- 证据：只在 `Sidebar.tsx:240` 隐藏菜单；`RequireAccess` 不读；AI-Ops 不读 → 被禁模块仍可通过 URL 访问。
- 改法：`RequireAccess` 与后端模块守卫都读 `disabledModules`。
- 验收：禁用模块后 URL 访问 403，AI-Ops 菜单同步隐藏。
- 需决策：**否**。

### P1-9 非 401 鉴权失败不再永久转圈

- 证据：`Layout.tsx` 仅 401 跳登录；`RequireAccess.tsx:32-38` `loading || !user` 一律 loading。
- 改法：区分 401/403/5xx/网络错误，分别跳登录/403 页/错误页 + 重试。
- 验收：模拟 500 时显示错误页而非无限 loading。
- 需决策：**否**。

### P1-10 修复改用户重置整角色授权

- 证据：`routes/system-users.ts:118-175` 的 `PUT /system/users/:id` 先 `DELETE FROM role_modules WHERE role_code=$1`，再按本次请求重插 → 修改一个用户会重置该角色**所有人**的模块授权。
- 改法：按 `user_id` 存用户级覆盖，角色级授权只由角色管理接口写入；编辑用户不触碰 `role_modules`。
- 验收：改 A 用户后，同角色 B 用户的模块集合不变。
- 需决策：**否**。

### P1-11 MCP 服务鉴权与工具越权

- 证据：`apps/mcp-server/src/index.ts` 非生产且未配 token 时，仅凭 `X-Leyova-User-Id` 头即可冒充任意用户；`db.ts` 用超级用户连接池执行工具，绕过 RLS。
- 改法：强制 token/会话校验；工具执行走与 API 相同的 `module-guard` 与租户上下文；生产禁用以 header 识别身份。
- 验收：无 token 请求 401；越权店铺查询返回空集。
- 需决策：**否**。

### P1-12 RLS 覆盖与证据链收敛

- 证据：`01_schema.sql` 238 张表仅 **58 张**启用 RLS（策略 108 条），约 180 张无行级隔离；`ai_v2_*` / `ai_eval_*` 策略为 `USING (true)`，任何登录用户可读全部证据链；`shop-guard.ts:1-40` 不校验 tenant/归属；`guard.ts:157` 成本可见性查询失败时 fail-open。
- 改法：按「租户/店铺/品牌」三类维度补齐 RLS；`ai_v2_*` 改为按 `run.user_id` 隔离；`shop-guard` 增加归属校验；fail-open 改 fail-closed。
- 验收：跨租户查询返回 0 行；`ai_v2_run` 只能读自己的 run。
- 需决策：**是**（是否现在引入多租户，影响 RLS 改造范围）。

### P1-13 请求 schema 校验与迁移基线

- 证据：435 个端点中仅 **2 个**有 Fastify schema（`auth/login`、`auth/change-password`），`zod` 全仓 0 引用；`schema_migrations` 仅 56 条、最后为 `155_p1_metric_catalog_unified`，而 156–170 文件存在且 `system_module_parameters` 表已建 → 迁移未登记/手工建表；`generate-schema.js --check` 失败。
- 改法：写操作端点补 schema（body/params/query）；迁移文件与 `schema_migrations` 对齐并提交；CI 增加 `generate-schema --check`。
- 验收：非法 body 返回 400 而非 500；`--check` 在 CI 通过。
- 需决策：**否**。

## P2 · 中优（1–2 月）

| # | 事项 | 证据 | 验收 |
|---|---|---|---|
| P2-1 | 6 个 100% 写死页处置：要么接真实接口，要么标注「示例数据」并隐藏生产菜单 | `AiOpsAssortmentStructure`/`Clips`/`Campaigns`/`Cases`/`FinanceSettle` | 生产菜单无假数据页，或页面顶部有「示例」标识 |
| P2-2 | 清理幽灵页面与死代码 | 4 幽灵页 + 8 review 组件 + 3 barrel + 10 类型 | `tsc` 无未使用告警；文件数下降 |
| P2-3 | 驾驶舱数据补齐 | `/overview/cockpit` `roi=0`、`top_products=[]` | 有数据日返回非空 |
| P2-4 | AI 日报支持任意日期 | `ai.ts:59-72` 忽略 `date` | `?date=2026-10-31` 返回该日数据 |
| P2-5 | 测试数据隔离 | 25 个 `__t_*` 账号、2 个 `__test_oauth_shop` | 生产库 0 测试残留；测试用独立 schema |
| P2-6 | 模块热插拔真实化 | 41 模块全 `is_enabled=true` | 至少可关闭 1 个并验证全链路 |
| P2-7 | 指标字典与平台口径 | 无 `metric_definition` 表；GPM/ROI 单一口径 | 有字典表，按平台可查口径 |

## P3 · 战略性（1 季度以上）

| # | 事项 | 现状 | 说明 |
|---|---|---|---|
| P3-1 | 千川 / 剪映 / ASR / 数字人 接入 | 无任何实现 | 按业务价值排序：千川（投放 ROI）→ ASR（直播切片转写）→ 剪映（批量成片）→ 数字人 |
| P3-2 | 向量知识库 | 无向量库；仅有 Ollama `nomic-embed-text` | 先 Chroma/pgvector 最小可用，再考虑 Milvus |
| P3-3 | 提示词体系 + 使用 SOP | 无 prompt 表；`prompt_version` 硬编码 | 建 prompt registry + 版本 + A/B + 人工修改率 |
| P3-4 | 多 IP 账号矩阵 | 无实现 | 需账号/设备/内容/排班四张表 |
| P3-5 | 多品牌 RLS 隔离 | 有 `brand_viewer`，无 tenant 证据 | 先做品牌级 RLS 再开放多品牌 |

## 依赖关系（建议执行顺序）

```text
P0-2 角色字典 ─┬─> P0-1 登录修复
               ├─> P0-4 财务可见性
               ├─> P1-7 AI-Ops 准入
               └─> P1-4 MODULE_MAP 补齐
P0-10 同步修复 ─┬─> P0-11 上传门禁
                └─> P2-3 驾驶舱数据
P0-9 AI 审批 ───> P0-5 假成功收尾
P1-1 LLM/KB ──> P3-2 向量库 ──> P3-3 提示词体系
P1-2 平台下沉 ─> P1-3 能力矩阵 ─> P3-1 第三方接入
P1-12 RLS ────> P3-5 多品牌隔离
P1-13 schema/迁移基线 ─> P2-6 模块热插拔
P0-6 停止造假 ─> P2-1 假页处置
```

## 需决策清单（共 8 项）

1. 财务角色：独立 `finance` 还是 `ops_director` 兼任？（P0-2 / P0-4）
2. 用户是否允许同时绑定多平台？（P1-2）
3. 平台能力差异由谁维护（产品/运营/研发）？（P1-3）
4. 三岗位（投放/剪辑/客服）的 AI-Ops 权限边界？（P1-7）
5. LLM 用本地 Ollama 还是云 API（豆包/通义）？（P1-1）
6. 6 个写死页：接真实数据还是下架？（P2-1）
7. 数字人/多 IP 是否本季度立项？（P3-1 / P3-4）
8. 多品牌/多租户隔离是否现在就要（决定 RLS 与 `shop-guard` 改造范围）？（P1-12 / P3-5）
