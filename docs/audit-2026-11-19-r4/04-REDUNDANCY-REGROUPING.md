# 04 · 冗余盘点与重新分组

## 一、冗余清单（可直接执行）

### 1. 导航事实源 6 套并行 —— 最大结构冗余

| # | 事实源 | 条目 | 问题 | 处置 |
|---|---|---:|---|---|
| 1 | `src/data/route-manifest.ts` | 90 | 注释自称 131/88，实际 90；`navEntryFor`/`navEntries` 0 调用 | 保留为唯一源，修正注释 |
| 2 | `src/data/ai-ops-navigation.ts` | 28 | `module:` **0 条**，无法做模块鉴权 | 合并进 manifest，补 module |
| 3 | `src/data/platform-navigation.ts` | 派生 | `platformModeLabel` 0 调用 | 保留构建函数，删死导出 |
| 4 | `src/components/common/GlobalSearch.tsx` | 6（硬编码） | `window.location.href` 整页跳转；`/ai/chat?q=` 参数丢失 | 改为读 manifest |
| 5 | `src/components/layout/Topbar.tsx` | 90 + 32 标签副本 | 与 manifest 无 import 关系，改 manifest 不传导 | 从 manifest 派生 |
| 6 | `src/routes/classic-routes.tsx` | 90 | 纯消费，正常 | 保留 |

### 2. 同组件多入口

| 组件 | 入口数 | 处置建议 |
|---|---:|---|
| `UnifiedDashboardHub` | 4（`/overview/cockpit`、`/omnichannel/dashboard`、`/bi/dashboard` + standalone） | 保留 1 个主入口，其余 301 到主入口 |
| `UnifiedScheduleHub` | 4（`/overview/sessions`、`/ops/session-products`、`/anchors/live-schedule`、`/anchors/schedule`） | 收敛为「单场作战室」1 个 + 排班 1 个 |
| `PlatformInsightPage` | 10 | 保留参数化 1 条路由 `/insights/:platform/:topic` |
| `HrbpWorkspacePage` | 2（`/hrbp/workspace`、`/ai-ops/hrbp/workspace`） | 保留经典 1 个 |
| `ContentCenterConfigPage` | 2 | 保留 1 个 |
| `ReviewOverviewPage` / `NetRoiPage` / `ShopOverviewPage` | 各 2 | 去重 |

### 3. 双份权限白名单

| 位置 | 内容 |
|---|---|
| `Layout.tsx:66-80` | AI-Ops 8 角色、财务 3 角色、运营 3 角色、HRBP 1 角色 |
| `RequireAiOpsAccess.tsx:16-32` | 同一份 AI-Ops 8 角色 + 财务 3 角色 |
| 处置 | 抽成 `src/constants/roles.ts` 单一定义 |

### 4. Redirect 冗余（20 条）

- App 13 条 + manifest 7 条。
- `/ai/selection` 与 `/ai/selection/history` 指向同一页，**历史入口名义存在实际丢失**。
- `/anchors/schedule-recommend` 与 `/anchors/schedule-recommend/standalone` 重复。
- `/review/*` 7 条全部 redirect 到 `/ai-ops/review/*`，但真实 `AnchorPerformancePage` 被绕开指向假数据页。

### 5. 幽灵与死代码

| 项 | 数量 | 处置 |
|---|---:|---|
| 幽灵页面（无路由无引用） | 4（`MyPerformancePage`、`MySchedulePage`、`anchors/UnifiedScheduleHub`、`system/AccountsSection`） | 删除 |
| 0 引用 review 组件 | 8 | 删除或接入 |
| 0 引用 barrel | 3（`pages/ai-ops/index.ts` 等） | 删除 |
| 0 引用类型 | 10 | 删除 |
| `SettlementPrintModal` / `ProtectedRoute`（0 字节） | 2 | 删除 |
| AI-Ops 有路由无菜单 | 2（`/ai-ops/review/anchors`、`/ai-ops/review/closed-loop`） | 补菜单或删路由 |

### 6. 功能重复（业务动作层）

| 重复功能 | 位置 A | 位置 B | 处置 |
|---|---|---|---|
| 直播复盘总览 | `/ai-ops/review/overview` | `/review/overview`（redirect） | 保留 A |
| 主播绩效 | `/ai-ops/people/performance`（假） | `/ai-ops/review/anchors`（真） | **保留真实页，删除假页入口** |
| 排品 | `/ai-ops/session/planning` | `/ops/session-products` | 合并到单场作战室同一 Tab |
| 场次列表 | `/overview/sessions` | `/bi/dashboard` 内嵌 | 保留前者 |
| 告警 | `/system/alert-center` | `/ai-ops/alerts` | 保留一个，另一个只读引用 |
| 任务/改进项 | `/system/tasks` | `/ai-ops/session/actions` | 统一到任务中心 |

### 7. 后端与骨架层死代码

| 项 | 证据 | 处置 |
|---|---|---|
| `MODULE_MAP` 4 条死条目 | `customer-service`（实际 `/cs`）、`dict`（实际 `/system/dict`）、`system/compliance`、`system/personnel` | 删除或改正，否则授权表里存在「永远命不中」的模块 |
| `MODULE_MAP` 缺 8 前缀 | 27 个端点落入 fail-closed | 补齐（P1-4） |
| `routes/platform-dedicated.ts` | 空壳，未注册，0 端点 | 删除 |
| `routes/resources.ts` | 0 端点 | 删除 |
| 仓库根 `ai-ops/` | README 宣称地基/身份/27 指标/Decision Case，实际 `src/` 只有 `config.ts` | 要么落地，要么删除，避免「看起来有第二套系统」 |
| `apps/ai-ops` | **不存在**（dsh 报告已过期） | 无需处理 |
| 合规采集器 5 个 | 不发 HTTP，返回硬编码文案却标 `fetchMethod: 'headless'` | 删除或改真实抓取 |

## 二、按真实业务重新分组（目标结构）

> 原则：以「一场直播」为轴，前后动作连续；平台差异放到「口径与能力」层，不再靠隐藏菜单。

### 组 1 · 今日作战（每天上班 5 分钟看完）

| 页面 | 来源 | 状态 |
|---|---|---|
| 作战驾驶舱 | 新（替换 AiOpsCockpit 假数据） | 需重写数据层 |
| 目标进度 | `ops/GoalTracking` | 保留 |
| 异常与告警 | `system/AlertCenter` + `alert_events` | 合并 |
| 待我审批 | `AiOpsInbox` | 修假金额 |
| 我的任务 | `system/ImprovementTasks` | 修假成功 |

### 组 2 · 单场作战室（核心，一条链）

| Tab | 页面 | 状态 |
|---|---|---|
| 排品 | 排品表（修 93.5% 损坏数据） | 需修数据 |
| 排期排班 | `UnifiedScheduleHub` | 合并 4 入口 |
| 提词 | `AiOpsPrompter` | 保留 |
| 盯盘 | `AiOpsLiveWatch`（去「已下发」假文案） | 修文案 |
| 结算 | 场次 P&L（去假成本/假签名） | 重写 |
| 复盘 | `AiOpsReview` + 7 个 review 页 | 保留 |

### 组 3 · 货盘与商品

选品（`SelectionPage`）、货盘结构（重写）、价格（`AiOpsPrices`）、库存（`InventoryCenter`）、渠道商品（`ShopProducts`）、商品中心（`product_center`）。

### 组 4 · 流量与投放

流量看板、投放复盘（需千川）、短视频数据（`VideoData`）、素材归因（缺表）、平台洞察（10 条收敛为 1 条参数化）。

### 组 5 · 履约与售后

履约 SLA、售后（`AfterSales`）、客服（`CustomerService`）、退款分析（`RefundAnalysis`）、订单（`canonical_orders`）。

### 组 6 · 内容与达人

短视频/笔记（`XhsNoteBoard`、`DouyinShortVideoFunnel`）、达人合作（`KolCooperation`）、切片（重写）、内容排期（`ContentSchedule`）、素材库（`script_library` 修权限）。

### 组 7 · 人与钱

主播（真实 `AnchorPerformancePage`）、排班（`ScheduleManagement`）、HRBP 工作台、财务 P&L（重写）、结算（重写）、薪酬（待建）。

### 组 8 · 数据与口径

数据管理/质量/上传/接入向导（保留 4 页）、指标字典（`/caliber/metrics`）、平台能力矩阵（重做，允许 `is_applicable=false`）。

### 组 9 · 系统治理

用户、角色、模块、平台、字典、审计、任务、告警配置。**41 个模块全启用 → 需要真实热插拔**。

## 三、重组后的「删除/合并」账单

| 动作 | 数量 |
|---|---:|
| 删除幽灵页面 | 4 |
| 删除死组件/死导出 | 25+ |
| 合并同组件多入口 | 6 组 → 6 个入口 |
| 合并双导航 | 2 → 1 |
| 删除/改造假数据页入口 | 6（结构/切片/活动/案例/结算 5 页下架或标注示例；people 假页改为指向真实 `AnchorPerformancePage`） |
| 收敛平台洞察路由 | 10 → 1 |

预期效果：菜单从 90 + 28 收敛到约 **70 条**，且每条都能回答「它属于哪一场直播的哪个动作」。
