# 03 · 运行时可用性

> 判定口径：A = 真实接口 + 数据可读 + 无编造；B = 接口存在但空/降级/静默；C = 固定假数据或空壳；D = 直接报错。
> 数据来源：`_evidence/03-api-authz-matrix.md`、`04-write-path-probes.md`、`07-static-checks.md` + 前端全量盘点。

## 一、规模与总体分布

| 项 | 数 |
|---|---:|
| 页面 `.tsx` | 122 |
| 其中幽灵页面（无路由/无引用） | 4 |
| 实际可达页面 | 118 |
| 经典路由（manifest 生成） | 90 |
| AI-Ops 路由（App 注册） | 30（菜单只列 28） |
| 后端路由文件 | 76 |
| 实际端点（静态统计） | **435**（`platform-dedicated.ts`、`resources.ts` 为 0 端点） |
| 运行时 OpenAPI operations（另一口径，含参数化展开） | 442 |
| 存在静默 `catch {}` 的页面 | **54（44%）** |

### 页面分级（按证据强度）

| 等级 | 页面数（估） | 典型例子 |
|---|---:|---|
| A 真实可用 | ~45 | 登录、AI 对话、分析台、选品、渠道/漏斗/商品复盘、HRBP 工作台、货盘价格、口径指标、用户/角色/模块/审计 |
| B 半可用 | ~40 | 驾驶舱、场次列表、排期、话术库、告警、任务、笔记板、多平台看板 |
| C 空壳/造假 | 11 | 5 页 100% 写死（货盘结构/切片/活动/案例/结算）；5 页真实数据+派生造假（cockpit/review/people/finance-pnl/inbox）；1 页空态硬编码（people 空列表仍显示 34.8/6.82/1780）；另 4 个幽灵页 |
| D 直接报错 | 3 | `/insights/tmall/promotion-layers`、`/insights/wechat/affiliate`、`/insights/wechat/content` |

> C 级 11 = 5 页完全假 + 5 页半假 + 1 页空态硬编码；D 级 3 页为「未找到页面配置」。
> 说明：不是每页都做了浏览器点检；A/B 的划分依据是「接口是否注册 + 是否有真实数据 + 是否静默兜底」，已在台账中标注。

## 二、AI-Ops 30 条路由的真实数据来源（本轮最关键的可用性证据）

| 路由 | 页面 | 数据来源 | 等级 |
|---|---|---|---|
| cockpit | AiOpsCockpit | `/overview/sessions` + **固定 4 条 AI 动作 + 2 条 CASE（ID 写死 20261116）** | C（半假） |
| workbench | AnalysisWorkbench | 真实 `/analysis/*` | A |
| chat | ChatPage | 真实 `/ai/chat/stream` | A |
| inbox | AiOpsInbox | 真实 pending-approvals；**影响金额写死 ¥85,000/¥32,000** | B |
| alerts | AiOpsAlerts | `/system/alerts`，失败回落 3 条假告警 | B/C |
| session/planning | AiOpsPlanning | slots 接口，失败回落 4 个假 SKU | B/C |
| session/prompter | AiOpsPrompter | 同 planning + 本地定时器模拟播放 | B/C |
| session/live-watch | AiOpsLiveWatch | `/alerts/events`；失败静默后仍提示「已下发」 | B（误导） |
| session/review | AiOpsReview | full-trace/pnl；派生数合成 | C（半假） |
| review/overview\|products\|short-videos\|channels\|funnel\|anchors\|closed-loop | 7 个 Review 页 | 真实 `/review/*` | A |
| assortment/selection | AiOpsSelection | 真实 `/selection/*` | A |
| assortment/structure | AiOpsAssortmentStructure | **100% useState 写死 5 组 / 27 子类** | C |
| assortment/prices | AiOpsPrices | 真实 `/inventory/channel-listings` | A |
| content/clips | AiOpsClips | **100% 写死 6 条脚本** | C |
| media/campaigns | AiOpsCampaigns | **100% 写死 4 活动 + 4 竞品** | C |
| finance/pnl | AiOpsFinancePnl | pnl 接口 + **虚构成本比例 + 假签名 `SIG-…-SHA256-VERIFIED`** | C（半假） |
| finance/settle | AiOpsFinanceSettle | **100% 写死 3 批结算** | C |
| hrbp/workspace | HrbpWorkspace | 真实 `/hrbp/*` | A |
| people/performance | AiOpsPeople | `/anchors` + **下标推算 gpm/时长/净利/评分** | C（半假） |
| session/actions | AiOpsActionItems | `/system/tasks` + 3 条假任务；更新失败仍报「已闭环」 | C（半假） |
| people/schedule-recommend | ScheduleRecommend | 真实 `/schedule/recommendations`；失败仍提示「已重新运算」 | B |
| governance/metrics | AiOpsMetrics | 真实 `/caliber/metrics` | A |
| governance/cases | AiOpsCases | **100% 写死 5 案例** | C |
| governance/knowledge | → ContentCenterConfig | 真实 `/content/providers`、`/kb/config` | A |

**统计：完全假 5 / 半假 5 / 真实但降级 6 / 真实可信 14。**

### 最隐蔽的造假：真实数据分支内仍用下标公式

`services/ai-ops-data.ts:576-585`：

```ts
liveHours: 30 + (i % 5) * 8,
gpm: Math.round(1500 + (10 - (i % 10)) * 120),
netProfitContribution: liveHours * gpm * 0.32,
score: 80 + (10 - (i % 10)) * 2,
```

即使 `/anchors` 返回真实主播，这四个核心指标仍然是**数组下标算出来的**。这比「catch 兜底」更危险：用户看到的是真实姓名 + 假 KPI。

### 「假成功」链路

| 位置 | 行为 |
|---|---|
| `ai-ops-data.ts:700-702` | 更新任务状态失败 → `return true` |
| `AiOpsInboxPage.tsx:43-47` | 忽略返回值，直接 toast「已即时推送下发生效」 |
| `AiOpsLiveWatchPage.tsx:63-70` | catch 后仍 toast「实时调度已下发」 |
| `AiOpsActionItemsPage.tsx:22` | 失败仍标记「已闭环」 |
| `AiOpsScheduleRecommendPage.tsx:65` | 失败仍提示「已重新运算」 |
| `AiOpsCockpitPage` | 「已采纳·动作已入库执行」只改本地 state |

这是审计中**业务风险最高**的一类问题：审批、下发、闭环三条链路都是「前端自嗨」。

## 三、后端接口层可用性

### 1. 鉴权矩阵要点（详见 `_evidence/03-api-authz-matrix.md`）

| 现象 | 结论 |
|---|---|
| **`/api/v1/metrics` 匿名 200** | Prometheus 指标无需登录即可读取，若暴露公网即信息泄露 |
| `director_zhou` / `buyer_xu` 登录 **401** | 哈希与 README 不符；`ctrl_wu` 根本不存在 |
| `finance_chen`（`ad_buyer`）无财务权限 | 真实财务角色不存在（DB 无 `finance`） |
| `controller` 可读成本与结算 | 与「中控」职责冲突 |
| `video_lin` / `cs_qian` / `ctrl_*` 可读场次 P&L | 仅 `costMasked=true`，GMV/退款/净收入仍可见 |
| 实测 4 个端点未进 `MODULE_MAP` → 非 admin 全 403 | `scripts/templates`、`finance/accounting-subjects`、`metrics`、`weather/cities` |
| `MODULE_MAP` 实际缺口更大 | 55 个前缀中 **8 个未映射，共 27 个端点**（`assortment/finance/orders/scripts/tmall/weather/wechat/metrics`）；另有 4 条死条目 |
| 改一个用户会重置整角色授权 | `system-users.ts:118-175` 先按 `role_code` 全删再重插 |

### 2. 写路径探针（只发必然非法载荷，不落库）

| 端点 | 结果 |
|---|---|
| 无效登录、非法 id、缺字段写 | 抽样端点返回 4xx，**未产生脏数据** |
| 系统级校验覆盖 | **仅 2/435 端点有 Fastify schema**（`auth/login`、`auth/change-password`），`zod` 全仓 0 引用；抽样通过不等于覆盖 |
| 结论 | 抽样写路径未崩溃，但校验是「业务代码偶然挡住」，不是系统性约束 |

### 3. 后端 P0（前端看不见，但决定数据真假）

| # | 问题 | 证据 | 对页面的影响 |
|---|---|---|---|
| 1 | 同步单页拉取（每店每轮 ≤50 单）、`fetchTrafficData` 恒 `[]`、0 行也 `completed`、水位用 UTC | `platform/adapters/base.ts:78-110`；`ingest/sync-job.ts:43-47,238-284` | 所有 GMV/订单页长期少算；流量来源恒空；驾驶舱 `roi=0` 无法修好 |
| 2 | AI 写操作审批空转：`write_with_approval` 只建 pending，`/ai/approve` 再进 pending | `ai/tool-registry.ts:101-130`；`routes/ai.ts:599-670` | 「AI 生成排品/活动/任务」永不落库（`ai_action_approvals` 0 行） |
| 3 | 手动上传绕过 8 道质量门禁；缺列填 0 + 全列覆盖 | `routes/ingest-upload.ts:9,148-169`；`ingest/manual-mapper.ts:288-352` | 部分指标上传把已有 GMV/订单清零 |
| 4 | RLS 仅 58/238 张表；`ai_v2_*` 为 `USING (true)` | `_evidence/11-backend-inventory.md` §5 | 跨租户可读；AI 证据链全员可读 |
| 5 | MCP 非生产仅凭 `X-Leyova-User-Id` 冒充用户，且用超管池绕过 RLS | `apps/mcp-server/src/index.ts`、`db.ts` | 本机任意进程可读写全库 |
| 6 | 迁移只登记到 155，156–170 文件存在但未登记；`generate-schema --check` 失败 | `schema_migrations`；`_evidence/11-backend-inventory.md` §5 | 新环境与本地 schema 不一致 |
| 7 | worker 未注册；API 内嵌 cron 在跑；AI 日报与异常巡检 cron 被注释 | `ecosystem.config.cjs`、`cron/index.ts:141-145` | 「定时任务在跑」是错觉的一半 |

### 4. 数据可用性断点

| 断点 | 证据 |
|---|---|
| 驾驶舱空壳 | `/overview/cockpit` 200 但 `roi=0`、`traffic_sources=[]`、`top_products=[]` |
| 今日 AI 日报恒空 | `ai.ts:59-72` 忽略 `date` 参数，只查当天；数据止于 2026-11-18 |
| 排品商品名损坏 | 446 行中 417 行 `[object Object]` |
| 聚合表只有 1 天 | `agg_shop_daily` 3 行（仅 2026-11-18） |
| 问题库空 | `issue_library` 0 行，但菜单有入口 |
| 结算周期空 | `fact_settlement_cycles` 0 行，但财务结算页有写死数据 |

## 四、LLM / AI 运行态

| 检查 | 结果 |
|---|---|
| `.env` `AI_ENABLED` | `false` |
| 默认模型 | `deepseek-chat`（Ollama 中不存在） |
| 日志 | `[llm] provider call failed (404): model 'deepseek-chat' not found` |
| `ai_v2_run` | 3648 次，**全部 `engine=rule`，0 次 `engine=llm`** |
| `ai_v2_run.verdict` | 3499 verified / 149 rejected（4.1% 拒绝） |
| `ai_eval_run` | 3420 次评测，含 batch |
| Ollama 现状 | `127.0.0.1:11434` 有 `llama3.1:8b`、`glm4:9b`、`deepseek-r1:8b`、`nomic-embed-text` |
| 知识库 | `/kb/status` → `configured=false, provider=none, degraded=true` |
| 结论 | **AI 问答可用（规则模式）；AI 生成不可用；知识库未接；嵌入模型可用但未接线** |

## 五、可见性问题清单（按用户撞墙顺序）

1. 点「话术库」→ 页面空列表，实际是 403 被 `.catch(() => {})` 吞掉。
2. 点「天猫五层抵扣 / 视频号带货 / 视频号内容」→ 直接看到「未找到页面配置」。
3. 点「主播效能」→ 被 redirect 到 `AiOpsPeople`（下标造假页），而非真实 `AnchorPerformancePage`。
4. 点「货盘结构 / 切片 / 活动 / 案例 / 财务结算」→ 全是写死内容，无「示例」标识。
5. 财务用户登录 → 看不到财务（角色不在白名单）；中控登录 → 能看到财务。
6. 点「AI 审批通过」→ 提示成功，实际没调用成功。
7. 非 401 的鉴权失败（500/网络）→ 全站永久转圈。
8. 上传一份只含「退款」列的表 → 已有 GMV/订单被写成 0（后端全列覆盖，前端无提示）。
9. 点「AI 采纳并生成」→ UI 显示已入库，实际 `ai_action_approvals` 永远 0 行。

## 六、结论

- 后端「接口存在率」高（435 端点 / OpenAPI 442 operations），「数据真实性」低（123 张 0 行、22 店铺 0 同步、流量事实表恒空）。
- 前端「页面数量」高（122），「可信页面比例」低（约 1/3）。
- 最需要优先修的是：**同步少算、上传清零、审批空转**（后端三 P0），叠加**假成功提示、真实分支内造假、静默吞错、3 个崩溃页**（前端五类）。前者决定数据真假，后者决定用户是否被误导。
