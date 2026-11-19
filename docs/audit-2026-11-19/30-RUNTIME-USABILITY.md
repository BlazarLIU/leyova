# 维度 3：真实场景可用性审计

> 原则：**只记录实测结果，不推断**。每项标注验证方式（curl 探针 / 登录态 / tsc / test / 源码阅读）。
> 未验证的项目明确标注「未经浏览器实测」。

---

## 一、质量门禁实测（2026-11-19）

| 检查项 | 命令 | 结果 |
|---|---|---|
| OpenAPI 漂移 | `pnpm -F @leyova/api openapi:check` | ✅ **0 漂移**（runtime=439, generated=439, static=327） |
| 静态守卫 | `pnpm check:guardrails` | ✅ 0 RLS 旁路 / 0 未守卫 GMV 聚合 / 316 处前端调用全匹配（435 后端路由） |
| API 类型检查 | `pnpm -F @leyova/api exec tsc -p tsconfig.test.json --noEmit` | ✅ 0 错误 |
| Web 类型检查 | `pnpm -F @leyova/web exec tsc -b` | ✅ 0 错误 |
| Web 测试 | `pnpm -F @leyova/web test` | ✅ **24/24 通过**（3 套件） |
| API 测试 | `pnpm -F @leyova/api test` | ❌ **143 pass / 17 cancelled** |
| Schema 漂移 | `node database/generate-schema.js --check` | ❌ **不一致**（DB 241 表 vs `01_schema.sql` 238） |
| 服务健康 | `curl /api/v1/health` | ✅ `{"ok":true,"db":"connected","uptimeSec":29912}` |

### 1.1 API 测试为何是红的（Gemini 漏掉的关键项）

```
ℹ tests 160   ℹ suites 15   ℹ pass 143   ℹ fail 0   ℹ cancelled 17
```

`platform-adapters.test.ts` 整个套件中断：
```
error: insert or update on table "users" violates foreign key constraint "users_role_fkey"
detail: Key (role)=(operator) is not present in table "roles".
```

**根因链**：
1. 迁移 `168_custom_roles.sql` 把 `users.role` 的 CHECK 约束换成 `FOREIGN KEY (role) REFERENCES roles(code)`
2. 但 `roles` 表当前只有 **8 行**：`super_admin / ops_director / ops_staff / controller / hrbp / ad_buyer / video_editor / cs_agent`
3. 测试 `createTempUser('operator')` 要建 `operator` 角色的临时账号 → 外键违规 → 套件中止 → 后续 17 个测试全部 cancelled

**注意**：`fail 0` 是因为测试是被 cancelled 不是 failed。**CI 会绿，但测试覆盖实际缺失 17 项。**

### 1.2 Schema 漂移明细

- DB `public` schema：**252 张表**（含 4 张 `_deprecated_*` 表）
- `database/01_schema.sql`：**238 个 CREATE TABLE**
- `generate-schema.js --check` 输出「✗ 01_schema.sql 与数据库当前状态不一致」

**另一个隐患**：迁移 `166-170`（模块热插拔 / 自定义角色 / 模块参数 / HRBP 招聘）**全部未提交 git**（`git status` 显示 `??`）。CI 里 `node database/migrate.js` 会应用**仓库里有的**迁移，所以 CI 全新库缺 `is_enabled`/`is_core` 列、缺自定义角色能力 → **CI 环境与本地环境 schema 不一致**。

---

## 二、六个角色的端点权限矩阵（登录态实测）

用 admin / ctrl_douyin / operator_wang / hr_li / video_lin / cs_qian 六个账号实测关键端点：

| 端点 | admin | ctrl_douyin | operator_wang | hr_li | video_lin | cs_qian |
|---|---|---|---|---|---|---|
| `/overview/sessions` | 200 | **200** | 200 | 200 | 200 | 200 |
| `/anchors` | 200 | **200** | 200 | 200 | 200 | 200 |
| `/sessions/102/slots` | 200 | — | — | — | — | — |
| `/sessions/102/pnl` | 200 | **200（costMasked=true）** | — | 200（costMasked=**false**） | 200（costMasked=true） | 200（costMasked=true） |
| `/system/tasks` | 200 | **403** | — | — | — | — |
| `/ai/pending-approvals` | 200 | **403** | — | — | — | — |
| `/alerts/events` | 200 | **403** | — | — | — | — |
| `/system/alerts` | 200 | **403** | — | — | — | — |
| `/scripts/templates` | 200 | — | **403** ← 真 bug | — | — | — |
| `/assortment/recommend` | 200 | — | — | — | — | — |
| `/metrics` | 200 | — | **403** | — | — | — |
| `/finance/accounting-subjects` | 200 | — | **403** | — | — | — |
| `/ops/goal-tracking` | 200 | **403** | — | — | — | — |
| `/net-roi/overview` | 200 | **403** | — | — | — | — |

### 2.1 中控（ctrl_douyin）在 AI-Ops 分支的真实体验

`AI_OPS_ALLOWED_ROLES` 包含 `controller`，所以**中控能进入 AI 运营系统**。但他进去之后：

| AI-Ops 页面 | 数据来源 | 中控实测 |
|---|---|---|
| 今日作战单 | `/overview/sessions` | ✅ 200（有 session 模块） |
| 货盘排品编辑 | `/sessions/:id/slots` | ✅ 200 |
| 盯盘驾驶舱 | `/alerts/events` + `/ai/pending-approvals` | ❌ **双 403** → 静默失败 → 空列表 |
| 待办审批中心 | `/ai/pending-approvals` | ❌ **403** → 静默失败 → 显示「无待办」 |
| 实时告警流 | `/system/alerts` | ❌ **403** → 静默失败 → 硬编码 3 条假告警 |
| 改进闭环追踪 | `/system/tasks` | ❌ **403** → 静默失败 → 硬编码 3 条假任务 |
| 主播效能排行 | `/anchors` | ⚠️ 200 但 gpm/liveHours/score 是索引数学现推的假数 |
| 单场五段复盘 | `/sessions/:id/full-trace` + `/pnl` | ✅ 200 |
| 财务 P&L | `/sessions/:id/pnl` | ⚠️ 前端 `FINANCE_ALLOWED_ROLES` 含 `controller` → **中控能进财务页**（后端 costMasked=true 有兜底） |

**结论：中控在 AI-Ops 里看到的是一个「半真半假、且假装一切正常」的系统。**

### 2.2 权限模型三处漂移（最严重问题）

`Layout.tsx:77-79`：
```ts
const canAccessFinance = isSuperAdmin || ['super_admin', 'finance', 'controller'].includes(role)
const isOpsUser = isSuperAdmin || ['operator', 'ops_director', 'ops_staff'].includes(role)
const isFinanceUser = isSuperAdmin || ['finance', 'controller'].includes(role)
```

`RequireAiOpsAccess.tsx:17-29`：
```ts
const AI_OPS_ALLOWED_ROLES = ['super_admin','admin','operator','ops_director','ops_staff','finance','controller','hrbp']
const FINANCE_ALLOWED_ROLES = ['super_admin','finance','controller']
```

**DB 实际角色（8 个）**：`super_admin / ops_director / ops_staff / controller / hrbp / ad_buyer / video_editor / cs_agent`

**硬编码里引用但 DB 不存在的角色**：`admin` / `operator` / `finance`

**后果**：

| 问题 | 说明 |
|---|---|
| 中控能进财务页 | `controller` 在 `FINANCE_ALLOWED_ROLES` 里，而中控是直播现场执行，不应看 P&L |
| 真财务进不了财务页 | `finance_chen` 的角色是 `ad_buyer`（不在财务白名单）→ P&L/结算对账页对他 403 |
| 投手/拍剪/客服后端进不了 AI-Ops | `ad_buyer` / `video_editor` / `cs_agent` 不在 `AI_OPS_ALLOWED_ROLES` |
| `isOpsUser` 几乎恒 false | 只有 super_admin 满足（`operator` 不存在，`ops_director`/`ops_staff` 在第一行但被 `isSuperAdmin ||` 短路覆盖逻辑写错） |
| `Sidebar.roleLabels` 与 DB 不符 | 有 `admin/operator/finance/employee/brand_viewer` 标签，缺 `video_editor`/`cs_agent` 标签 → 这两个角色的用户侧栏显示原始角色码 |

---

## 三、fail-closed 误伤的 7 个路径

`module-guard.ts` 的 `MODULE_MAP` 有 72 条前缀映射，但以下已注册路径**未声明**，非管理角色一律 403：

| 路径 | 注册位置 | 建议归属模块 |
|---|---|---|
| `/api/v1/assortment/recommend` | `routes/assortment.ts:28` | `session_products` |
| `/api/v1/assortment/explain/:productId` | `routes/assortment.ts:50` | `session_products` |
| `/api/v1/finance/accounting-subjects` | — | `net_roi` |
| `/api/v1/metrics` | `routes/metrics.ts:20` | `bi` |
| `/api/v1/scripts/templates` | `routes/anchors.ts:272,293` | `ops` |
| `/api/v1/weather/cities` | `routes/weather.ts:8` | **应删除**（前端页面已下线） |
| `/api/v1/weather/recommendation` | `routes/weather.ts:19` | **应删除**（前端页面已下线） |

**实测证据**（`operator_wang` 登录态）：
```
GET /api/v1/scripts/templates  → 403 {"message":"路径 /api/v1/scripts/templates 未在模块映射表中声明，按 fail-closed 拒绝"}
GET /api/v1/metrics            → 403
GET /api/v1/finance/accounting-subjects → 403
```

**注意 `module-guard.ts:201` 的管理角色豁免**：
```ts
if (role === 'admin' || role === 'ops_director' || role === 'super_admin') {
  return { ok: true }
}
```
所以 **admin / ops_director / super_admin 不受影响**，只有 ops_staff / ad_buyer / video_editor / cs_agent / controller 被打。这解释了为什么这个问题一直没被发现——测试和管理员账号都测不到。

**weather 路由是孤儿**：commit `4c97ec2` 声称「彻底清理废弃天气」，但只删了前端页面，`routes/weather.ts` 的两个端点仍在 `app.ts:205` 注册，且未进 MODULE_MAP。

---

## 四、数据缺陷：417 行坏商品名

```
session_plan_products: total=446, corrupted(含 "[object Object]")=417
```

**根因** `database/demo/generate.mjs:381`：
```js
products.push({ id: i, cost, price, safety, cat })   // cat = { code, name }
// ...
`${p.cat}精选-${String.fromCharCode(64 + p.id)}款`   // → "[object Object]精选-A款"
```

**影响面**：
- `GET /sessions/:id/slots` 返回 `"skuTitle":"[object Object]精选-T款"`
- 排品编辑页（`/ops/session-products`、`/ai-ops/session/planning`）
- 货盘结构分析、复盘商品分析

**这是用户在最核心模块里直接可见的数据损坏。**

---

## 五、AI-Ops 硬编码与静默失败清单

### 5.1 100% 硬编码页面（无任何 API 调用）

| 页面 | 硬编码内容 |
|---|---|
| `AiOpsCasesPage.tsx` | 3 条 Decision Case（`useState([...])`） |
| `AiOpsClipsPage.tsx` | 3 条切片队列 |
| `AiOpsCampaignsPage.tsx` | 投放计划 |
| `AiOpsFinanceSettlePage.tsx` | 4 条结算批次（含金额 485200.0 等） |
| `AiOpsAssortmentStructurePage.tsx` | 组件内 `const structure = [...]` 4 个配比卡片 |

### 5.2 「静默失败 + 假数据兜底」（8 处）

`ai-ops-data.ts` 的模式：
```ts
export async function fetchAnchorPerformanceList(): Promise<AnchorPerformanceItem[]> {
  try {
    const res: any = await api.get('/anchors')
    // ... 映射真数据，但 gpm/liveHours/score 是索引数学现推
  } catch { /* 静默失败 */ }
  return [ { id: 1, name: '沈主播', gpm: 2450, ... }, ... ]  // 硬编码兜底
}
```

8 处 `catch { /* 静默失败 */ }` 分别在：`fetchTodayBattleData`、`fetchSessionPlanningSlots`、`fetchSessionReviewReport`、`fetchFinancePnlData`、`fetchPendingApprovals`、`decideApproval`、`fetchAnchorPerformanceList`、`fetchAlertEventsList`、`fetchImprovementTasksList`、`updateImprovementTaskStatus`。

**伪造数字示例**：
- `fetchTodayBattleData`：`targetGmv: 120000`（接口挂掉时）、`predictedGmv = totalGmv * 1.08`
- `fetchAnchorPerformanceList`：`gpm = Math.round(1500 + (10 - (i % 10)) * 120)` —— **用数组索引算指标**
- `fetchSessionReviewReport`：`payGmv = ... || 142000`、归因 share 硬编码 `0.55/0.25/0.15/0.20`
- `fetchFinancePnlData`：成本按比例估算 `38%/18%/10%/6%/5%`

---

## 六、服务进程状态

| 进程 | 状态 | 端口 |
|---|---|---|
| `leyova-api` | ✅ 运行（uptime 29912s） | 8788 |
| `leyova-web`（vite） | ✅ 运行 | 5513 |
| `leyova-mcp` | ✅ 运行 | 9101 |
| **`leyova-worker`** | ❌ **未运行** | — |

**Worker 停摆的影响**（`worker.ts` 的职责）：
- 日汇总聚合（`agg_*` 表）不再刷新
- 七段清洗管道不跑
- 合规巡检（`compliance-patrol`）不跑
- 异常检测（`detect-anomalies`）不跑
- 分区预建维护（`manage-partitions`）不跑
- 冷数据归档不跑
- `system_jobs` 待执行队列无人消费（当前 pending=0，但队列机制空转）

实测 `agg_shop_daily` 和 `fact_trade_daily` 的 `max(biz_date)` 都是 2026-11-18，说明停摆时间不长，但**任何依赖定时任务的功能都已停止**。

---

## 七、孤儿服务与死代码

### 7.1 两套 MCP Server

| 实现 | 位置 | 协议 | 调用方 |
|---|---|---|---|
| 进程内 MCP | `apps/api/src/ai/mcp-server.ts` | 真 MCP Streamable HTTP（`/mcp`，HMAC 签名 + fail-closed 鉴权） |  DeerFlow 等外部 Agent |
| 独立服务 | `apps/mcp-server/` | **自定义 HTTP JSON**（`POST /tools/:name`），21 个工具 | **全仓无任何调用方** |

`apps/mcp-server` 在 `ecosystem.config.cjs:56` 注册为 pm2 进程并实际运行（pid 2283，监听 127.0.0.1:9101），但 `grep -rn '9101'` 在整个仓库（排除 node_modules）只找到它自己和 `env.ts` 的默认值。**是一个完全孤儿的服务。**

另外 UI 文案「已注册 27 个指标工具」（`AiOpsChatPage.tsx:20`）与实际 21 个工具不符。

### 7.2 `ai-ops/` 目录是空壳

README 宣称「已完成 O0 地基」并列出一长串：身份系统、三维权限、多租户隔离、27 指标注册表（宣称值，主系统实际 30）、Decision Case 状态机、事件 outbox、幂等/文件/通知/审计、模块 manifest。

**实际 `ai-ops/src/` 只有 1 个文件：`config.ts`（1394 字节）**。加上 `db/migrations/` 7 个 SQL 和 `db/seeds`。没有任何 `index.ts`、`server.ts`、`http/routes/`、`kernel/`、`identity/`、`metrics/`、`decision/`。

**这是一个 README 超前实现 100 倍的目录**，且从未与 `apps/web` 的 AI-Ops 分支接线（web 的 AI-Ops 全部走主 API 8788）。

### 7.3 真幽灵页面（4 个，Gemini 说 15 个是误判）

| 文件 | 状态 |
|---|---|
| `apps/web/src/pages/anchors/MyPerformancePage.tsx` | 0 引用 |
| `apps/web/src/pages/anchors/MySchedulePage.tsx` | 0 引用 |
| `apps/web/src/pages/anchors/UnifiedScheduleHub.tsx` | 0 引用（被 `ops/schedule/UnifiedScheduleHub` 取代） |
| `apps/web/src/pages/overview/HomePage.tsx` | 0 引用（被 `PlatformAwareHomePage` 取代） |

Gemini 列的其他 11 个「幽灵页面」实际都在被引用：
- `ai/ChatPage` ← `AiOpsChatPage`
- `ai/SelectionPage` + `ai/SelectionHistoryPage` ← `AiOpsSelectionPage`
- `ai/AnalysisWorkbenchPage` ← `AiOpsWorkbenchPage`
- `anchors/LiveScheduleCalendarPage` / `ScheduleManagementPage` / `ScheduleRecommendPage` / `overview/SessionsPage` ← `ops/schedule/UnifiedScheduleHub`
- `overview/CockpitPage` / `bi/BiDashboardPage` / `omnichannel/OmniDashboardPage` ← `bi/UnifiedDashboardHub`

### 7.4 死类型

`apps/web/src/types/index.ts` 的 `Contact`（L45）、`Invoice`（L62）、`PipelineDeal`（L88）——全仓 0 引用。

---

## 八、测试污染数据

生产库 `users` 表有 **25 个测试残留账号**：
```
__t_ad_buyer_1794690868935_8fc40d
__t_ad_buyer_1794690939952_149b92
... （共 25 个 __t_* / __res_* 前缀账号）
```

这些是 `platform-adapters.test.ts` 和 `rbac-and-domains.test.ts` 的 `createTempUser` 创建的，测试中断前未清理。

---

## 九、合规采集器是 MOCK（假数据源）

`apps/api/src/modules/compliance/collector/douyin.ts:15-35`：
```ts
async fetch(url: string, externalId?: string): Promise<RulePage | null> {
  const extId = externalId || 'DY-RULE-DEFAULT'
  const content = `抖音电商直播间治理专项规定：严禁使用绝对化用语，功效宣传须具备国家药监局备案。虚假低价导流诱导拍A发B将被直接扣罚保函保证金并关闭直播间购物车功能。`
  return {
    platformCode: this.platformCode,
    sourceUrl: url,
    externalId: extId,
    title: '抖音电商直播间违规营销与导流行为治理公告',
    ...
    fetchMethod: 'headless',   // ← 声称是无头抓取，实际是硬编码
    fetchedAt: new Date(),
  }
}
```

6 个平台 collector（douyin/kuaishou/taobao/wechat/xiaohongshu）全是这个模式，**不发任何 HTTP 请求**。

所以「平台规则雷达」和「违规事件看板」即使显示数据，也是**写死的示例文本**。`compliance_events` 表现在 0 行只是因为合规巡检 Worker 没跑；跑起来后灌进去的也是假规则。

---

## 十、结论

**能用的**：数据接入链路、场次与复盘闭环、HRBP 人效、排品推荐引擎、平台 OpenAPI 适配（订单/退款拉取）、OpenAPI/守卫/类型检查/web 测试。

**不能用的**：
1. 权限模型（角色名漂移，财务和中控权限错配）
2. 平台差异化（四层机制三层已死）
3. AI-Ops 分支的数据真实性（8 处静默假数据 + 5 个全硬编码页面）
4. 话术库/选品推荐等 7 个端点对非管理角色 403
5. 合规规则雷达（MOCK 采集器）
6. 履约售后（演示数据，非真实数据）
7. 3 个平台洞察页（配置失配空壳）

**未验证项（明确声明）**：所有前端页面的浏览器级渲染、交互、响应式布局——因 Web 服务在远端 `:5513`，本机浏览器可达性未确认，本报告未做浏览器实测。相关结论均来自 API 探针 + 源码静态分析。
