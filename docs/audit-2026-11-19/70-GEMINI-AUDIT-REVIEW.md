# Gemini 版审计校订报告

> 校订对象：`/home/odlive/.gemini/antigravity/brain/173535d2-5bd1-4a61-902e-0b8fe79482c3/full-system-audit-plan.md`
> 原文档：459 行 / 23 条 BUG / 6 大维度，声称审计「前端 125 页面 / 后端 77 路由文件 / 217 API 源文件 / 170+ 迁移」
> 校订方式：**逐条实测**（源码阅读 + curl 探针 + 六登录态 + 跑测试 + 查库），非文本比对。
> 校订日期：2026-11-19

---

## 〇、总体裁定

| 裁定 | 条数 | 占比 |
|---|---:|---:|
| ✅ 成立 | 8 | 34.8% |
| ⚠️ 部分成立（数据已变/根因判断错/影响夸大） | 7 | 30.4% |
| ❌ 误报（技术判断错误或已不适用） | 8 | 34.8% |

**最重要的结论：Gemini 漏掉了 10 个更硬的问题，其中包括 4 个会直接导致用户看到错误数据或功能不可用的问题。**

原因：它的「执行验证计划」只写了编译检查（`pnpm build`、`check:guardrails`），**没有跑测试、没有查数据库、没有登录态探针**。所以它所有的「0 数据」结论都是从旧报告转引的，没有一条是自己实测的。

---

## 一、逐条裁定

### ✅ 成立（8 条）

#### BUG-005 「订单履约售后」分组 5 项全部 0 数据 — 核心卖点空转
- **Gemini 说**：`fact_fulfillment_waybill`/`fact_after_sale_tickets`/`fact_cs_session`/`canonical_refund_events`/`fact_settlement_cycles` 全部 0 行
- **我的实测**：前四个**已被 11-18 补记修复**（运单 420 / 工单 24 / 客服 480 / 退款 24），但 `fact_settlement_cycles` **确实仍 0 行**
- **裁定**：✅ 成立，但 Gemini 读的是旧报告，没复查库
- **补充**：这些是**演示数据**，真实业务数据仍未从平台 API 进来（20/22 店铺 manual_only）。「核心卖点空转」的判断方向是对的，只是原因不同——不是「没做」，是「做了演示数据但没接真实数据」

#### BUG-007 直播专属路由缺 `platforms` 声明
- **Gemini 说**：`/overview/cockpit`、`/overview/live-monitor`、`/ops/room-health`、`/system/multi-room`、`/live/*`、`/review/*` 未声明 platforms
- **我的实测**：**完全属实**。我逐行核对了 `route-manifest.ts`，90 条中只有 22 条带 `platforms`
- **裁定**：✅ 成立（这是 Gemini 版最有价值的一条）

#### BUG-008 `PLATFORM_EXCLUSIVE_ROUTES` 缺少 insight 路由
- **我的实测**：`platformRoute.ts:41-50` 确实只有 8 个 `/shop/*`，10 个 `/insights/*` 全部遗漏
- **裁定**：✅ 成立

#### BUG-013 HRBP 工作台被两套路由系统同时注册
- **我的实测**：`route-manifest.ts:157`（`/hrbp/workspace`）+ `App.tsx:171`（`/ai-ops/hrbp/workspace`）双注册同一 `HrbpWorkspacePage` 组件，非 redirect
- **裁定**：✅ 成立（**全系统唯一的真重复注册**）

#### BUG-015 AI-Ops 的 7 个复盘路由与经典系统用同一组件但权限守卫不同
- **我的实测**：`/review/*` 经 `redirect` 到 `/ai-ops/review/*`，后者由 `RequireAiOpsAccess` 守卫；`AI_OPS_ALLOWED_ROLES` 不含 `ad_buyer/video_editor/cs_agent`
- **裁定**：✅ 成立，且比 Gemini 说的更严重——这三个角色点「复盘总览」会看到 403 拦截页

#### BUG-020 AI-Ops 导航系统与 route-manifest 完全割裂
- **我的实测**：确认两套独立数据源；且 `ai-ops-navigation.ts` **28 项零 module 字段**
- **裁定**：✅ 成立

#### BUG-021 AI-Ops 权限模型与经典系统不统一（`disabledModules` 无效）
- **我的实测**：`buildAiOpsNavigation` 只按 `onlyFinance` 过滤，完全不看 `allowedModules`/`disabledModules`
- **裁定**：✅ 成立。超管在「模块热插拔」页关掉某模块后，AI-Ops 分支仍显示

#### BUG-022 「改进闭环追踪」被归入「财务与人资工作台」
- **我的实测**：`ai-ops-navigation.ts:103` 确实在「工作面 4 · 财务与人资工作台」下
- **裁定**：✅ 成立（业务上改进闭环是复盘产出，应属工作面 2）

---

### ⚠️ 部分成立（7 条）

#### BUG-001 「今日作战」4 个模块 0 数据
- **Gemini 说**：目标达成/问题库/改进任务/异常中心 4 个都 0 数据或仅 2 行
- **我的实测（2026-11-19）**：`goal_tracking` **7 行**、`ad_plan` 48、`script_library` 96、`alert_events` **12 行**。11-18 补记二/三已实现目标 CRUD + 种子 + progress 自动推导、问题库 CRUD + 一键转问题
- **仍 0 的**：`issue_library`（问题库）
- **裁定**：⚠️ 部分成立。Gemini 读的是 11-18 报告正文，没看补记，也没查库

#### BUG-002 「内容与达人」混入「会员与私域」
- **我的实测**：`route-manifest.ts:137` 确实把 `/ops/members`（module `members`）放在 `content` 组
- **裁定**：⚠️ 成立（归组确实不合理），但这是分类精度问题，不是功能缺陷

#### BUG-003 「话术库」被放在「人与钱」分组
- **我的实测**：`route-manifest.ts:150` 确实归 `people` 组
- **裁定**：⚠️ 成立（同上，分类精度问题）
- **但我发现的更严重问题**：话术库页面对非管理角色 **403 不可用**（`/api/v1/scripts/templates` 未进 `MODULE_MAP`），这比归组错误重要得多

#### BUG-004 「流量与投放」17 项过度膨胀
- **我的实测**：确认 17 项，12 个平台洞察中 **7 个端点实测返 0 数据**（我逐个 curl 过）
- **裁定**：⚠️ 成立，且我用实测数据加强了它的结论

#### BUG-006 `LIVE_ONLY_ROUTES` 与 `LIVE_ONLY_MODULES` 冗余不一致
- **我的实测**：确认两套独立维护（23 个路由 vs 18 个模块码）
- **裁定**：⚠️ 成立，但 Gemini 找错了根因。真正的问题是**上游 `platform_capability_matrix` 198 行 `is_applicable` 全 true**（迁移 133 放的），所以这两套判断即使统一了也依然空转

#### BUG-010 淘宝/天猫缺少 `supportsLive` 判定精度
- **Gemini 说**：「如果后端 capabilities 未正确返回 `supportsLive: true`，会导致淘系直播模块被隐藏」
- **我的实测**：`GET /api/v1/platforms` 返回 **taobao/tmall/xiaohongshu 的 `supportsLive` 都是 `true`**
- **裁定**：❌→⚠️ **论断反了**。问题不是「未正确返回 true」，是「**所有 6 个平台的 capabilities 完全同构，全部返回 true**」，导致平台差异化判定整体失效

#### BUG-012 约 15 个「幽灵页面」
- **Gemini 说**：15 个 `.tsx` 有文件无路由引用
- **我的实测**：15 个里 **11 个仍被引用**：
  - `ai/ChatPage` ← `AiOpsChatPage`
  - `ai/SelectionPage` + `ai/SelectionHistoryPage` ← `AiOpsSelectionPage`
  - `ai/AnalysisWorkbenchPage` ← `AiOpsWorkbenchPage`
  - `anchors/LiveScheduleCalendarPage` / `ScheduleManagementPage` / `ScheduleRecommendPage` / `overview/SessionsPage` ← `ops/schedule/UnifiedScheduleHub`
  - `overview/CockpitPage` / `bi/BiDashboardPage` / `omnichannel/OmniDashboardPage` ← `bi/UnifiedDashboardHub`
- **真幽灵只有 4 个**：`anchors/MyPerformancePage`、`anchors/MySchedulePage`、`anchors/UnifiedScheduleHub`、`overview/HomePage`
- **裁定**：⚠️ 大部分误判

#### BUG-018 AI-Ops 与经典系统大量功能重叠
- **我的实测**：HRBP 已单列为 BUG-013；其余 redirect 项确认存在；但「旧路径文件仍存在增加死代码量」不成立（文件被 Hub 复用）
- **裁定**：⚠️ 部分成立

#### BUG-023 `onlyHrbp` 字段定义了但完全未使用
- **我的实测**：`ai-ops-navigation.ts:49` 定义 `onlyHrbp?: boolean`，`buildAiOpsNavigation(isFinanceUser, _isHrbpUser, isSuperAdmin)` 第二个参数确实未使用（参数名带下划线）
- **裁定**：⚠️ 成立，但影响极小（HRBP 本身已能通过角色进 AI-Ops）

---

### ❌ 误报（8 条）

#### BUG-009 `PlatformInsightPage` 使用 `window.location.pathname`
- **Gemini 说**：「SPA 路由切换时可能拿到过时路径；SSR 场景下取空字符串」
- **我的分析**：`window.location.pathname` 在浏览器里**始终等于当前路由**（React Router 用 History API 更新地址栏），不存在「过时」。SSR 场景本系统不存在（Vite SPA，无服务端渲染）
- **裁定**：❌ 误报。属代码风格偏好，非 bug

#### BUG-011 `CLASSIC_ROUTES` 在 `<Route path="*">` 之后渲染 — 404 吞路由
- **Gemini 说**：「某些 classic 路由可能未正确注册」
- **我的实测与分析**：
  1. React Router v6 的路由匹配**按 specificity 排序，与 JSX 书写顺序无关**。`path="*"` 权重最低，任何具体路径都优先于它
  2. 我用脚本数了 manifest 90 条：7 条无 `component` 的**全部是 `redirect` 条目**（`classic-routes.tsx` 对它们返回 `<Navigate>`），**不存在返回 `null` 的条目**
- **裁定**：❌ 误报。功能上不吞路由。仅「把 `*` 放在最后更符合直觉」的风格建议可保留

#### BUG-014 `RequireAccess` fail-closed 可能误拦无权限声明路由
- **Gemini 说**：「如果某条 `CLASSIC_ROUTES` 忘了声明 module，非超管用户会被 403」
- **我的实测**：脚本核对了全部 90 条 manifest，**每条都有 `module` 或 `anyModules`**（`no-component AND no-redirect: （无）`）
- **裁定**：❌ 误报（当前无此问题）。但作为防御性断言加进测试是有价值的

#### BUG-016 `UnifiedDashboardHub` 3 个入口本质相同组件
- **Gemini 说**：「用户困惑，建议合并为一个入口」
- **我的分析**：这是**有意的设计**——同一组件 + 不同 `defaultView` props，前端测试 `frontend-integrity.test.mjs` 专门断言了这三个入口的懒加载目标存在
- **裁定**：❌ 作为 bug 误报。但「用户视角困惑」的体验问题真实存在，属 P2 优化项

#### BUG-017 `UnifiedScheduleHub` 4 个入口分散在两个工作面
- 同上，有意设计（不同 `defaultView`），有测试断言
- **裁定**：❌ 作为 bug 误报；体验优化属 P2

#### BUG-019 `types/index.ts` 含通用 CRM 类型
- **Gemini 说**：「`Contact`/`Invoice`/`PipelineDeal` 与电商运营中枢无关」
- **我的实测**：确认这 3 个 interface **全仓 0 引用**，是死类型
- **裁定**：⚠️→❌ **性质误判**：这是 3 个死 interface（约 45 行），不是「通用 CRM 模块」。删掉即可，不值得单列 BUG

---

## 二、Gemini 漏掉的 10 个真问题

按严重度排序。这些问题 Gemini 一条都没提。

### 遗漏 1（最严重）角色模型三处漂移

`Layout.tsx:77-79` 和 `RequireAiOpsAccess.tsx:17-29` 硬编码 `admin`/`operator`/`finance` —— **这三个角色在 DB 中不存在**（实际 8 个：`super_admin/ops_director/ops_staff/controller/hrbp/ad_buyer/video_editor/cs_agent`）。

后果：
- 中控（`controller`）能进财务 P&L / 结算对账页
- 真财务 `finance_chen`（角色 `ad_buyer`）**被挡在财务页外**
- `ad_buyer`/`video_editor`/`cs_agent` **完全进不了 AI-Ops**
- `Sidebar.roleLabels` 缺 `video_editor`/`cs_agent` → 侧栏显示原始角色码

**实测证据**：`psql` 查 `roles` 表只有 8 行；`users` 表 `finance_chen` 的 role 是 `ad_buyer`。

### 遗漏 2 演示数据 bug 污染生产库

`session_plan_products` 446 行中 **417 行商品名是 `[object Object]精选-X款`**。根因 `database/demo/generate.mjs:381` 把对象 `p.cat` 直接模板字符串化。

用户在**排品编辑、货盘结构、复盘商品分析**这些最核心的模块里看到坏数据。

### 遗漏 3 module-guard fail-closed 误伤 7 个路径

`/api/v1/scripts/templates`、`/api/v1/assortment/recommend`、`/api/v1/assortment/explain/:productId`、`/api/v1/metrics`、`/api/v1/finance/accounting-subjects`、`/api/v1/weather/cities`、`/api/v1/weather/recommendation` 未进 `MODULE_MAP`。

`module-guard.ts:201` 只豁免 `admin/ops_director/super_admin`，所以 **ops_staff/ad_buyer/video_editor/cs_agent/controller 全部 403**。

实测 `operator_wang` 打 `/api/v1/scripts/templates` → 403「路径未在模块映射表中声明」。**话术库页对运营专员直接不可用。**

### 遗漏 4 AI-Ops 静默展示假数据

`ai-ops-data.ts` **8 处 `catch { /* 静默失败 */ }`** + 硬编码兜底；5 个页面 100% `useState` 写死；`fetchAnchorPerformanceList` 用 `gpm = 1500 + (10 - (i%10))*120` **索引数学伪造指标**。

中控（`ctrl_douyin`）进 AI-Ops 后，`/system/tasks`、`/ai/pending-approvals`、`/alerts/events` 三个端点 403 → 静默失败 → 看到硬编码假数据。

### 遗漏 5 平台差异化整体失效

Gemini 在 BUG-006/007/010 里碰到了边缘，但没看到全貌：
- `platform_capability_matrix` 198 行 `is_applicable` **全 true**
- 6 个适配器 capabilities **完全同构**
- 实测 `/auth/me` 的 `modulesByPlatform` **六平台逐字节相同**
- `resolvePlatformMode()` 恒返回 `'live'`

**净效果：切平台只改变 22/90 个导航项。**

### 遗漏 6 三个平台洞察页配置失配

`/insights/tmall/promotion-layers`、`/insights/wechat/affiliate`、`/insights/wechat/content` 在 `INSIGHT_PAGE_CONFIG` 匹配不到 → 渲染「未找到页面配置」空壳。

前端测试没抓到（只校验路由存在，不校验 insight 配置覆盖），Vite SPA fallback 让 curl 探测也返回 200。

### 遗漏 7 后端测试实际是红的

`pnpm -F @leyova/api test` → **143 pass / 17 cancelled**（`platform-adapters` 套件因 `users_role_fkey` 外键失败整体中断）。`fail 0` 是因为 cancelled 不算 fail。

Gemini 的验证计划只写「编译检查」，没跑测试。

### 遗漏 8 schema 漂移 + 迁移未提交

`generate-schema.js --check` 失败（DB 252 表 vs `01_schema.sql` 238，4 张 `_deprecated_*` 表只在库里）。

迁移 `166-170`（模块热插拔/自定义角色/模块参数/HRBP 招聘）**全部未提交 git** → CI 全新库 schema 与本地不一致。

### 遗漏 9 Worker 进程未运行

`ps aux` 无 `worker.ts`。聚合刷新、七段清洗、合规巡检、异常检测、分区维护、`system_jobs` 消费**全停**。

### 遗漏 10 两个孤儿/空壳组件

- `apps/mcp-server/`：21 工具，监听 9101，**全仓无任何调用方**，却在 pm2 里跑着
- `ai-ops/`：README 宣称「O0 地基已完成」并列出身份系统/三维权限/27 指标（宣称）/Decision Case/outbox 等，**实际 `src/` 只有 1 个 `config.ts`（1394 字节）**

另外合规采集器是 MOCK（`collector/douyin.ts:15` 的 `fetch()` 不发 HTTP，返回硬编码字符串却标 `fetchMethod: 'headless'`）——「平台规则雷达」即使有数据也是假的。

---

## 三、对 Gemini 版验证计划的评估

它写的自动化验证：
```bash
pnpm -F @leyova/web build       # 编译
pnpm run check:guardrails       # 静态守卫
pnpm -F @leyova/api build       # 编译
```

**缺的三个关键动作**：
1. `pnpm -F @leyova/api test` —— 会立刻发现 17 个 cancelled
2. `node database/generate-schema.js --check` —— 会立刻发现 schema 漂移
3. 登录态 curl 探针 —— 会发现 7 个 403 路径和 AI-Ops 假数据

它写的手动验证清单（切平台看侧栏、主播点复盘看 403 等）方向是对的，但**从文档内容看没有真正执行过**——如果执行过，不可能还把 `goal_tracking` 说成 0 行。

---

## 四、结论

**Gemini 版的价值**：作为「代码静态审查」是合格的，找出了 8 个真问题（特别是 BUG-007 平台声明缺失和 BUG-013/015/020/021/022 的 AI-Ops 结构性问题），关系图谱画得也不错。

**Gemini 版的致命缺陷**：**没有运行态验证**。它所有的数据结论都是二手转引，导致 1/3 的条目误报、1/3 的条目数据已过期，且漏掉 10 个更硬的问题。

**建议**：把 Gemini 版当作「静态审查线索源」，不要当作审计结论。以本目录的 `10`/`20`/`30` 三份实测报告为准。
