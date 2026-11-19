# 维度 4：冗余/重复功能审计 + 重新分组方案

---

## 一、冗余清单（按类型）

### 1.1 四套导航事实源（只有一套有测试）

| 导航源 | 条目数 | 有 module 权限 | 有平台过滤 | 有测试 |
|---|---|---|:---:|:---:|
| `apps/web/src/data/route-manifest.ts` | 90 | ✅ | ✅（22 条） | ✅ `nav-manifest.test.mjs` |
| `apps/web/src/data/ai-ops-navigation.ts` | 28 | ❌ | ❌ | ❌ |
| `apps/web/src/components/common/GlobalSearch.tsx` | 6（硬编码） | ❌ | ❌ | ❌ |
| `apps/web/src/components/layout/Topbar.tsx` `routeLabels` | 28 条 ai-ops 标题 | ❌ | ❌ | ❌ |

**问题**：
- AI-Ops 导航完全不继承 `route-manifest` 的权限/平台能力，改一套忘另一套
- `Topbar` 的 `routeLabels` 与 `App.tsx` 路由不同步：3 个已注册路由无标题（`/ai-ops`、`/ai-ops/review/anchors`、`/ai-ops/review/closed-loop`）→ 面包屑显示「主页」
- `GlobalSearch` 只有 6 条，其中 3 条指向 AI-Ops，与侧栏导航能力不对等

### 1.2 同一组件多入口挂载

| 组件 | 挂载次数 | 入口 |
|---|---:|---|
| `ops/schedule/UnifiedScheduleHub` | **4** | `/overview/sessions`（场次管理）、`/ops/session-products`（场次排品）、`/anchors/live-schedule`（直播排班）、`/anchors/schedule`（排班设置） |
| `bi/UnifiedDashboardHub` | **3** | `/overview/cockpit`（经营驾驶舱）、`/omnichannel/dashboard`（全渠道大盘）、`/bi/dashboard`（BI 仪表盘） |

**评估**：这是**有意的设计**（同一组件 + 不同 `defaultView`，前端测试专门断言了懒加载目标存在），Gemini 把它当 bug 是误判。**但用户视角的困惑是真实的**——在「今日作战 → 经营与看板」下看到三个入口，点进去发现是同一个页面的不同 Tab。

### 1.3 双系统分支重复挂载

| 功能 | 经典路径 | AI-Ops 路径 | 关系 |
|---|---|---|---|
| AI 聊天 | `/ai/chat` | `/ai-ops/chat` | redirect |
| 选品 | `/ai/selection` | `/ai-ops/assortment/selection` | redirect |
| 分析工作台 | `/ai/workbench` | `/ai-ops/workbench` | redirect |
| 排班推荐 | `/anchors/schedule-recommend` | `/ai-ops/people/schedule-recommend` | redirect |
| 复盘总览 | `/review/overview` | `/ai-ops/review/overview` | redirect |
| 复盘商品分析 | `/review/products` | `/ai-ops/review/products` | redirect |
| 复盘短视频引流 | `/review/short-videos` | `/ai-ops/review/short-videos` | redirect |
| 复盘渠道流量 | `/review/channels` | `/ai-ops/review/channels` | redirect |
| 复盘主播效能 | `/review/anchors` | `/ai-ops/people/performance` | redirect |
| 复盘转化漏斗 | `/review/funnel` | `/ai-ops/review/funnel` | redirect |
| 复盘改进闭环 | `/review/closed-loop` | `/ai-ops/session/actions` | redirect |
| **HRBP 工作台** | `/hrbp/workspace` | `/ai-ops/hrbp/workspace` | **❌ 真重复（双注册，非 redirect）** |

**`route-manifest.ts:95-101` 的 7 条复盘项全是纯 redirect**：经典侧栏显示「复盘总览」等 7 个入口，点进去跳到 AI-Ops。而 AI-Ops 侧渲染的是**同一批经典页面组件**（`ReviewOverviewPage`、`ProductAnalysisPage` 等）。

**这是纯粹的入口浪费**：经典侧栏 7 个菜单项 + AI-Ops 侧 7 个菜单项，实际只有 7 个页面。

### 1.4 两套 MCP Server

| 实现 | 协议 | 工具数 | 调用方 |
|---|---|---:|---|
| `apps/api/src/ai/mcp-server.ts` | 真 MCP Streamable HTTP | — | DeerFlow 等外部 Agent |
| `apps/mcp-server/` | 自定义 HTTP JSON | 21 | **无**（孤儿服务，pm2 里跑着） |

### 1.5 三套 AI 面

1. `apps/api/src/ai/` —— 真身（orchestrator + 语义层 + 29 工具 + critic + 证据血缘）
2. `apps/mcp-server/` —— 孤儿 HTTP 工具服务（21 工具）
3. `ai-ops/` —— 空壳目录（README 宣称 O0 完成，实际只有 `config.ts` + 7 个迁移）

### 1.6 平台判定逻辑四套

| 机制 | 位置 | 状态 |
|---|---|---|
| `platform_capability_matrix` 表 | DB，198 行 | ❌ 全 true，空转 |
| `usePlatform.tsx` `LIVE_ONLY_MODULES` | 18 个模块码 | ❌ 门禁死亡（所有平台 supportsLive=true） |
| `platformRoute.ts` `LIVE_ONLY_ROUTES` | 23 个路由 | ❌ 同上 |
| `platformRoute.ts` `PLATFORM_EXCLUSIVE_ROUTES` | 8 个路由 | ⚠️ 部分工作（漏 10 个 insights） |
| `platform-navigation.ts` `resolvePlatformMode` | 函数 | ❌ 恒返回 'live' |
| `route-manifest.ts` `platforms` 字段 | 22 条 | ✅ **唯一有效** |

**六套机制管同一件事，五套已死。**

### 1.7 天气功能（前端已删，后端仍在）

- commit `4c97ec2` 删了前端天气页面（`CampaignPlanPage.tsx` 等 495 行）
- `apps/api/src/routes/weather.ts` 两个端点仍在 `app.ts:205` 注册
- 且未进 `MODULE_MAP` → 非管理角色 403

### 1.8 真幽灵页面（4 个）

`anchors/MyPerformancePage.tsx`、`anchors/MySchedulePage.tsx`、`anchors/UnifiedScheduleHub.tsx`、`overview/HomePage.tsx` —— 全仓 0 引用。

### 1.9 死类型（3 个）

`types/index.ts` 的 `Contact`、`Invoice`、`PipelineDeal` —— 0 引用。

### 1.10 测试污染数据

25 个 `__t_*` / `__res_*` 账号残留在生产 `users` 表。

---

## 二、按真实场景的重新分组方案

### 2.1 设计原则

1. **主语是「今天这场怎么打」**，不是「这个月账对不对」
2. 一个页面只属于一个分组（唯一归属）
3. 平台专属项按 `platforms` 声明，其余全平台可见
4. **有数据才有页面**：0 数据模块标记 `coming_soon`，不进默认导航
5. 分组数量对齐真实运营工作面，不对齐技术模块

### 2.2 建议的 7 大工作面（从 9 个收敛）

| 新工作面 | 来源 | 包含 | 调整说明 |
|---|---|---|---|
| **① 今日作战台** | `today` 精简 | 首页、经营看板（合并 3 个 Dashboard 入口为 1）、目标达成、问题库、改进任务、异常中心 | **问题库/改进任务留在本组**——它们是「今天要处理的事」，与目标达成同属作战收件箱；移到内容面是错的 |
| **② 场次与复盘** | `session` | 场次管理、场次排品、智能排品推荐、直播间健康度、多直播间总览、人工登记三件套、复盘七件套、**话术库（从 people 移入）**、**改进闭环追踪（从 AI-Ops 工作面 4 移入）** | 全场最佳分组，只进不出 |
| **③ 货盘与选品** | `assortment` | 商品结构分析、商品主数据与库存、商品与渠道结构、货盘结构健康度（新增） | 不变 |
| **④ 流量·投放·营销** | `traffic` | 全域投放与净 ROI、搜索词卡位、万相台投放对账、活动管理、竞品观察、平台流量洞察（**按当前平台动态显示，只显示当前平台那几条**） | 拆分过度膨胀的 17 项 |
| **⑤ 客户·履约·售后** | `fulfillment` + 会员 | 履约 SLA、售后工单、客服响应、退款分析、异常检测、**会员与私域（从 content 移入）** | 合并成一个「交付质量」面 |
| **⑥ 内容·达人·品牌** | `content` − 会员 | 内容排产、达人合作、内容创作三件套、小红书内容、视频号内容 | 移除会员（移入 ⑤） |
| **⑦ 团队·排班·财务** | `people` | 主播四件套、排班两件套、HRBP 工作台、财务 P&L、结算对账 | 增加财务板块 |
| **⑧ 数据中心** | `data` | 数据管理、上传、上传数据管理、多平台接入、数据质量 | 不变（全站最实） |
| **⑨ 系统管理** | `system` | 账号、角色权限、人员、平台、直播间、配置、热插拔、任务、字典、审计、合规 | 不变 |

> 实际是 **9 → 8**（会员与私域从 content 移到履约面，content 更聚焦；问题库/改进任务保留在今日作战台）。如果你希望更激进，可进一步把 ④⑤ 合并为「增长与交付」，做到 7 个。

### 2.3 AI-Ops 分支的重新分组

| 新工作面 | 调整 |
|---|---|
| 工作面 1 · 作战台 | 不变（今日作战单、经营诊断台、AI 助手、待办审批、实时告警） |
| 工作面 2 · 场次台与复盘 | **「改进闭环追踪」从工作面 4 移入此处**（复盘产出物理属） |
| 工作面 3 · 货与内容 | 不变 |
| 工作面 4 · 财务与人资 | 移除「改进闭环追踪」，只留财务 + 人效 |
| 系统与内核治理 | 不变 |

### 2.4 需要加 `module` 和 `platforms` 的 AI-Ops 项

`ai-ops-navigation.ts` 目前 **28 个项一个 module 都没有**，导致：
- 模块热插拔对 AI-Ops 无效（超管关模块后 AI-Ops 仍显示）
- 平台差异化对 AI-Ops 无效

建议给每个 AI-Ops 项补 `module`（映射到现有 41 个模块码）和可选 `platforms`。

---

## 三、去重执行清单

| # | 动作 | 对象 | 风险 |
|---|---|---|---|
| 1 | HRBP 工作台留一个入口 | `/ai-ops/hrbp/workspace` 设 redirect 到 `/hrbp/workspace`（或反之） | 低 |
| 2 | 删 7 条经典复盘 redirect 项 | `route-manifest.ts:95-101` | 低（AI-Ops 侧已有） |
| 3 | 删 4 个幽灵页面文件 | 见 1.8 | 低 |
| 4 | 删 3 个死类型 | `types/index.ts` Contact/Invoice/PipelineDeal | 低 |
| 5 | 删 2 个 weather 路由 + `app.ts:205` 注册 | `routes/weather.ts` | 低 |
| 6 | `apps/mcp-server` 处置：删除或接线 | 孤儿服务 | 中（需确认无外部依赖） |
| 7 | `ai-ops/` 目录处置：删除或立项 | 空壳 | 中（README 已造成误导） |
| 8 | 清理 25 个测试污染账号 | `users` 表 | 中（需先确认无引用） |
| 9 | 合并 Dashboard 3 入口为 1（保留内部 Tab） | `route-manifest.ts:74,77,80` | 中（影响用户习惯） |
| 10 | Schedule Hub 4 入口收敛为 2（场次视角 + 排班视角） | `route-manifest.ts:87,88,155,156` | 中 |
| 11 | AI-Ops 导航纳入统一 manifest（加 `branch` 字段） | `ai-ops-navigation.ts` | 大（架构改动） |
| 12 | 平台判定六套机制收敛为一套 | 见 1.6 | 大（需先定产品策略） |

---

## 四、分组调整的迁移注意

1. **不改任何路由路径**（避免破坏书签和外部链接），只改 `group` / `parent` 归属
2. 「话术库」从 `people` 移到 `session` 时，注意它的 module 是 `ops`（`anyModules: ['ops','anchor']`），module 不用改
3. 「会员与私域」从 `content` 移到 `fulfillment` 时，module 是 `members`，不用改
4. 「改进闭环追踪」在 AI-Ops 从工作面 4 移到工作面 2，只改 `sections` 数组顺序
5. 0 数据模块加 `coming_soon: true` 字段，`buildNavigation` 过滤掉，但保留路由可访问（深度链接不 404）
