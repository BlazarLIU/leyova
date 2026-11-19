# 维度 1：模块分组业务贴合度审计

> 方法：从「一个真实代运营团队的一周」出发，把每个模块嵌入实际作业流，看每一步能不能落地。
> 对象：**90 个经典导航项**（`route-manifest.ts`，9 大分组）+ **28 个 AI-Ops 导航项**（`ai-ops-navigation.ts`，5 个工作面）。
> 数据基准：2026-11-19 生产库实测行数（非旧报告转引）。

---

## 一、场景设定

| 维度 | 设定 |
|---|---|
| 团队 | 1 运营总监 + 2 操盘运营 + 1 投手 + 12 主播 + 5 中控 + 1 HRBP + 1 客服后端 + 1 拍剪 |
| 平台 | 抖音（主阵地）、淘宝/天猫、视频号、小红书、快手 |
| 节奏 | 每周 20+ 场直播，日更短视频 3-5 条，月投流 40 万 |
| 目标 | 净利导向（不看虚高 GMV），履约不违规，人效持续提升 |

场景主线：`周一 定目标→选品排品→排班` → `周二~周日 开播（预热→直播→排品执行→投放调整）+ 订单履约→售后→客服` → `下周一 复盘→人效评估→问题闭环→调整目标`

---

## 二、九大分组贴合度评级

| 分组 | 项数 | 贴合度 | 数据支撑 | 核心判断 |
|:---|:---:|:---:|:---|:---|
| **session**（场次） | 15 | ⭐⭐⭐⭐⭐ | 充分 | **全场最佳**。排品四因子、复盘七件套、改进闭环全部有数据 |
| **data**（数据） | 5 | ⭐⭐⭐⭐⭐ | 充分 | 上传/清洗/质量链路真实可用，已实测 CSV 端到端 |
| **today**（今日作战） | 12 | ⭐⭐⭐⭐ | 部分 | 驾驶舱扎实；但「问题库」仍 0 数据，「异常中心」仅 12 行 |
| **people**（人与钱） | 8 | ⭐⭐⭐⭐ | 部分 | HRBP 人效是亮点；排班×场次已打通；但「话术库」归组错误 |
| **system**（系统） | 12 | ⭐⭐⭐⭐ | 充分 | 权限/审计/模块热插拔完整；合规风控仍 0 数据 |
| **assortment**（货盘） | 3 | ⭐⭐⭐⭐ | 部分 | 主数据与库存有数据；商品结构分析弱 |
| **traffic**（流量与投放） | 17 | ⭐⭐⭐ | **严重不足** | 项数最多但 12 个平台洞察中 7 个端点返 0 数据；`fact_search_keyword_daily` 0 行 |
| **content**（内容与达人） | 13 | ⭐⭐ | **接近零** | 13 项中 2 项是「正在开发」占位页；达人佣金、会员私域、小红书内容全 0 |
| **fulfillment**（订单履约售后） | 5 | ⭐⭐⭐ | 数据已补 | 演示数据已补齐（运单 420/工单 24/客服 480），但**真实业务数据仍未进来** |

---

## 三、逐组深度调研

### 3.1 today（今日作战）— 驾驶舱扎实，但「待办」仍缺一环

| 模块 | 路由 | 数据实况（2026-11-19 实测） | 判定 |
|---|---|---|---|
| 首页 | `/overview/home` | `fact_trade_daily` 140 行 | ✅ |
| 经营驾驶舱 | `/overview/cockpit` | `fact_trade_daily` + `agg_shop_daily` | ✅ |
| 实时监控 | `/overview/live-monitor` | `session_overview_metrics` 140 | ✅ |
| 数据分析 | `/overview/analytics` | 取数原语已通 | ✅ |
| 全渠道大盘 | `/omnichannel/dashboard` | `fact_trade_daily` 140 | ✅ |
| 店铺经营看板 | `/shop/overview` | `fact_trade_daily`（按店铺） | ✅ |
| 淘系店铺看板 | `/shop/taobao/board` | `fact_trade_daily`（taobao/tmall） | ✅ |
| BI 仪表盘 | `/bi/dashboard` | 取数原语已通 | ✅ |
| 目标达成 | `/ops/goal-tracking` | `goal_tracking` **7 行** | ✅（11-18 已闭环） |
| 改进任务 | `/system/tasks` | 依赖 `issue_library` **0 行** | ⚠️ 半通 |
| 问题库 | `/ops/issue-library` | `issue_library` **0 行** | ❌ 空页面 |
| 异常中心 | `/system/alerts` | `alert_events` **12 行** | ⚠️ 稀薄 |

**场景代入**：周一早上运营打开系统，想看「上周目标完成了吗」——**现在能看了**（7 条目标 + progress 自动推导，11-18 已闭环）；想看「待处理问题」——**仍然空的**。问题库是需要用户持续录入的模块，有 CRUD 和一键转问题，但**没有种子数据、没有引导流程**。

**另外两个真问题（Gemini 漏掉）**：
1. **`/system/tasks` 对非管理角色 403**：该路径未在 `module-guard.ts` 的 `MODULE_MAP` 中声明，fail-closed 拒绝。实测 `operator_wang`（运营专员）打 `/api/v1/scripts/templates` 得 403 是同类问题。
2. **AI-Ops 的「待办审批中心」对中控 403**：`/ai/pending-approvals` 需 `ai` 模块，中控未授权 → `fetchPendingApprovals()` 静默失败返回 `[]`，用户看到「无待办」的假象。

### 3.2 session（场次）— 全场最佳，但有一个数据缺陷

| 模块 | 路由 | 数据实况 | 判定 |
|---|---|---|---|
| 场次管理 | `/overview/sessions` | `live_registrations` 150 | ✅ |
| 场次排品 | `/ops/session-products` | `session_plan_products` 446 | ✅ |
| 智能排品推荐 | `/ops/assortment-recommend` | 四因子全真实 | ✅✅ **核心竞争力** |
| 直播间健康度 | `/ops/room-health` | `room_health` **0 行** | ⚠️ |
| 多直播间总览 | `/system/multi-room` | `multi_room_status` **0 行** | ⚠️ |
| 个人达成 | `/live/attendance` | `personal_achievement` | ✅ |
| 直播登记 | `/live/registration` | `live_registrations` 150 | ✅ |
| 登记数据管理 | `/live/data` | `live_registrations` | ✅ |
| 复盘七件套 | `/review/*` → 跳 `/ai-ops/review/*` | `session_overview_metrics` 140 + 短视频引流 501 | ✅ |

**🔴 新发现的数据缺陷（本轮查出的最直接影响用户体验的 bug）**：

`session_plan_products` 446 行中，**417 行 `product_name` 是 `[object Object]精选-X款`**。

根因在 `database/demo/generate.mjs:381`：
```js
products.push({ id: i, cost, price, safety, cat })   // cat 是 { code, name } 对象
// ...
`${p.cat}精选-${String.fromCharCode(64 + p.id)}款`   // 对象被模板字符串化为 "[object Object]"
```

**影响面**：排品编辑页（`/ops/session-products`、`/ai-ops/session/planning`）、货盘结构分析、复盘商品分析、`/sessions/:id/slots` 接口——**全部读到坏商品名**。用户在系统最核心的模块里看到 `[object Object]精选-T款`。

**修法**：`${p.cat.name}` + 一条清洗 SQL 修 417 行。

### 3.3 assortment（货盘）— 主数据扎实，结构分析弱

| 模块 | 数据实况 | 判定 |
|---|---|---|
| 商品结构分析 | `fact_trade_daily`（商品维度） | ⚠️ 能算但浅 |
| 商品主数据与库存 | `dim_product` 20 / `fact_inventory_stock` 20 | ✅ |
| 商品与渠道结构 | `dim_product_channel_listing` 80 | ✅ |

**缺**：「货盘结构健康度」（引流款/利润款/滞销款占比）这类决策性问题给不出答案。AI-Ops 有 `AiOpsAssortmentStructurePage` 但是**纯硬编码**（4 个写死的配比卡片），不是真数据。

### 3.4 traffic（流量与投放）— 项数最多，数据最空

| 子模块 | 项数 | 数据实况 |
|---|---|---|
| 全域投放与净 ROI | 1 | `fact_ad_spend_daily` 140 ✅ / `ad_plan` 48 ✅（11-18 已补） |
| 搜索词卡位 | 1 | `fact_search_keyword_daily` **0 行** ❌ |
| 万相台投放对账 | 1 | 依赖投流表 ⚠️ |
| **平台流量洞察** | **12** | **7 个端点返 0 数据** ❌ |
| 活动管理 | 1 | `promotions` **0 行** ❌ |
| 竞品观察 | 1 | `competitor_brands` **0 行** ❌ |

**平台洞察实测（2026-11-19，admin 登录态逐个 curl）**：

| 端点 | 结果 |
|---|---|
| `/insights/douyin/three-pools` | ✅ 有数据（直播池 GMV ¥2,049,070） |
| `/insights/xiaohongshu/buyer-profile` | ✅ 有数据（买手 3 / 粉丝 320,073） |
| `/insights/taobao/three-sources` | ❌ 三源总 GMV ¥0 |
| `/tmall/brands` | ❌ brands 0 / sessions 0 |
| `/tmall/promotion-layers` | ❌ layers 0 |
| `/tmall/promo-compare` | ❌ promoGmv 0 |
| `/insights/xiaohongshu/dandelion` | ❌ 达人 0 / GMV ¥0 |
| `/insights/xiaohongshu/traffic-sources` | ❌ 渠道数 0 |
| `/wechat/affiliate` | ❌ scenes [] |
| `/wechat/content` | ❌ total 0 |

**更根本的问题**：这些洞察的数据来源是什么？抖音/淘宝/视频号官方 API 需授权，**20/22 店铺是 `manual_only`**。即使做了页面，数据也进不来。

### 3.5 fulfillment（订单履约售后）— 演示数据已补，真实数据仍未进

11-18 补记已从 `canonical_orders` 向下游派生演示数据，本轮实测确认：

| 表 | 行数 | 内容 |
|---|---:|---|
| `fact_fulfillment_waybill` | 420 | 48h 发货时限；378 已签收 / 39 待发货 / 15 延迟 |
| `canonical_refund_events` | 24 | 约 6% 退款率，仅退款/退货退款/换货三型 |
| `fact_after_sale_tickets` | 24 | 6 类原因归因 + 工单状态机 |
| `fact_cs_session` | 480 | 4 客服 × 2 班次 × 120 日 |

**但**：`fact_settlement_cycles`（结算账期）仍 **0 行**；且这些是演示数据，**真实订单数据仍未从任何平台 API 进来**（除 2 个已授权店铺）。

**防超卖的代码是真的**：`POST /inventory/reservations/reserve` 原子锁库已实现且实测可用。**引擎造好了，缺真实数据喂它。**

### 3.6 content（内容与达人）— 13 项中 2 项占位，其余无数据

| 子模块 | 数据实况 |
|---|---|
| 内容排产与归因 | `fact_content_daily` **0**、`content_schedules` **0** ❌ |
| 达人合作与佣金 | `fact_kol_cooperation` **0** ❌ |
| 会员与私域 | `platform_members_summary` **0** ❌ |
| 内容创作（视频创作/视频数据） | **「正在开发」占位页** ❌ |
| 生成服务配置 | `content_providers` 配置 ✅ |
| 小红书内容 5 件套 | `xhs_note` **0 行** ❌ |
| 视频号内容 3 件 | 无数据 ❌ |

**实测确认的占位页**（全站仅 2 个）：`VideoCreatePage.tsx`、`VideoDataPage.tsx` → 「正在开发 / 即将上线」。

**归组问题**：「会员与私域」（`/ops/members`）放在「内容与达人」组里，业务上属于客户运营/CRM，不属内容运营。

### 3.7 people（人与钱）— HRBP 人效是亮点，话术库归组错误

| 模块 | 数据实况 |
|---|---|
| HRBP 工作台 | 人效 9 接口全 ✅✅（人均 GMV/场均/时长/小时人效/爬坡曲线/风险预警） |
| 主播列表/档案/训练/能力 | `anchors` 12 / `anchor_training_plans` 4 / `anchor_capabilities` 12 ✅ |
| 直播排班/排班设置 | `schedule` 体系 + `session_staff_assignments` 378 ✅（已与场次打通） |
| 话术库 | `script_library` **96 行** ✅ |

**归组问题**：「话术库」（`/ops/script-library`）归属 `people`（人与钱）分组。话术本质是**直播执行工具**，应与场次/提词卡关联，不该放在「人与钱」。

**🔴 真 bug**：话术库页对非管理角色不可用。`/api/v1/scripts/templates` 未在 `MODULE_MAP` 声明 → fail-closed 403。实测 `operator_wang` 得 403。运营专员打不开自己要用的话术库。

### 3.8 data（数据）— 全站最实的一组

| 模块 | 状态 |
|---|---|
| 数据管理 / 上传 / 上传数据管理 | ✅ 实测 CSV 端到端通过 |
| 多平台接入（自定义清洗） | ✅ 双轨（API/文件）路由齐备 |
| 数据质量 | ✅ 七段清洗管道 + 质量门禁 |

### 3.9 system（系统）— 基建完整，合规空转

| 模块 | 状态 |
|---|---|
| 账号管理 / 角色与模块权限 | ✅ 8 角色 × 41 模块（DB 实测；注意不是旧报告说的 15 角色） |
| 模块热插拔 | ✅ 28 核心保护 |
| 平台与渠道管理 | ✅ 8 平台配置（jd/pdd 已停用） |
| 直播间管理 / 系统配置 / 字典 / 任务 / 审计 | ✅ |
| 平台规则雷达 / 违规事件看板 | ❌ `compliance_events` **0 行** |

**🔴 合规采集器是 MOCK**：`apps/api/src/modules/compliance/collector/douyin.ts:15` 的 `fetch()` **不发 HTTP 请求**，直接返回硬编码字符串：
```ts
const content = `抖音电商直播间治理专项规定：严禁使用绝对化用语...`
return { platformCode, sourceUrl: url, ..., fetchMethod: 'headless', ... }
```
6 个平台的 collector 全是这个模式。所以「平台规则雷达」即使有数据，也是**假数据**。

---

## 四、AI-Ops 分支（28 项）业务贴合度

| 工作面 | 项数 | 贴合度 | 判断 |
|---|---:|:---:|:---|
| 工作面 1 · 作战台 | 5 | ⭐⭐⭐ | 作战单用真数据（`/overview/sessions`）；但「待拍板决策」是硬编码数组 |
| 工作面 2 · 场次台与复盘 | 9 | ⭐⭐⭐⭐ | 排品/提词/盯盘/复盘用真数据；但复盘五件套复用经典组件 |
| 工作面 3 · 货与内容 | 5 | ⭐⭐ | 选品用真数据；货盘结构/切片队列/投放协同**全硬编码** |
| 工作面 4 · 财务与人资 | 6 | ⭐⭐ | 人效用真数据；P&L 用真数据但**成本按比例估算**；结算对账**100% 硬编码** |
| 系统与内核治理 | 3 | ⭐⭐ | 指标字典用真数据（`/caliber/metrics`）；Decision Case **100% 硬编码**；知识库复用配置页 |

### 4.1 AI-Ops 硬编码页面清单（实测）

| 页面 | 数据来源 | 判定 |
|---|---|---|
| `AiOpsCasesPage` | `useState([...])` 3 条写死 Decision Case | ❌ 100% 假数据 |
| `AiOpsClipsPage` | `useState([...])` 3 条写死切片队列 | ❌ 100% 假数据 |
| `AiOpsCampaignsPage` | `useState([...])` 写死投放计划 | ❌ 100% 假数据 |
| `AiOpsFinanceSettlePage` | `useState([...])` 4 条写死结算批次 | ❌ 100% 假数据 |
| `AiOpsAssortmentStructurePage` | 组件内 `const structure = [...]` 4 个配比卡片 | ❌ 100% 假数据 |
| `AiOpsCockpitPage` | 真会话数据 + **硬编码「AI 已执行」「待拍板决策」两个数组** | ⚠️ 半真半假 |
| `AiOpsPeoplePage` | `/anchors` 真名字，但 `gpm/liveHours/score` 用索引数学现推 | ⚠️ 真名假数 |
| `AiOpsAlertsPage` | `/system/alerts` 真数据 + 硬编码兜底 3 条 | ⚠️ |
| `AiOpsActionItemsPage` | `/system/tasks` 真数据 + 硬编码兜底 3 条 | ⚠️ |
| `AiOpsPlanningPage` | `/sessions/:id/slots` 真数据 + 硬编码兜底 4 个 SKU | ⚠️ |
| `AiOpsFinancePnlPage` | `/sessions/:id/pnl` 真数据，但成本项按比例估算（38%/18%/10%/6%/5%） | ⚠️ |
| `AiOpsReviewPage` | `/sessions/:id/full-trace` + `/pnl` 真数据，但归因 share 硬编码（0.55/0.25/0.15/0.20） | ⚠️ |
| `AiOpsChatPage` | 复用经典 `ChatPage`（真） | ✅ |
| `AiOpsWorkbenchPage` | 复用经典 `AnalysisWorkbenchPage`（真） | ✅ |
| `AiOpsKnowledgePage` | 复用经典 `ContentCenterConfigPage`（真） | ✅ |
| `AiOpsSelectionPage` | 复用经典 `SelectionPage` + `SelectionHistoryPage`（真） | ✅ |
| `AiOpsMetricsPage` | `/caliber/metrics` 真数据 | ✅ |
| `AiOpsLiveWatchPage` | `/alerts/events` + `/ai/pending-approvals` 真数据 | ✅ |
| `AiOpsScheduleRecommendPage` | 真 API | ✅ |
| `AiOpsPricesPage` | 真 API | ✅ |
| `AiOpsInboxPage` | `/ai/pending-approvals` 真数据 | ✅ |

**「静默失败 + 假数据兜底」模式**：`ai-ops-data.ts` 有 **8 处 `catch { /* 静默失败 */ }`**，每处失败后返回硬编码数组。用户在无权限或接口挂掉时看到假数据，**界面零提示**。

---

## 五、四个断点（把模块放回一周运营时间线）

```
周一 定目标 ──► [目标达成 7 行 ✅] ──────────────► 通
      选品排品 ──► [智能排品 ✅ 但商品名损坏] ────► 断点①：417 行坏数据
      排班 ──────► [排班 ✅ 已与场次打通] ───────► 通
      
周二~周日 开播 ─► [场次/复盘 ✅] ───────────────► 通
      投放调整 ──► [ROI ✅ / 计划 48 行 ✅] ────► 通（11-18 已补）
      订单履约 ──► [运单 420 演示数据 ⚠️] ──────► 断点②：演示数据≠真实数据
      
下周一 复盘 ────► [复盘七件套 ✅] ──────────────► 通
      人效评估 ──► [HRBP 人效 ✅] ───────────────► 通
      问题闭环 ──► [问题库 0 行 ❌] ─────────────► 断点③：与旧报告同源，未修
      
跨全部 ─────────► [合规采集器是 MOCK ❌] ───────► 断点④：规则雷达是假数据
```

| 断点 | 性质 | 能否自己修 |
|---|---|---|
| ① 417 行坏商品名 | **数据生成 bug** | ✅ 能，改 1 行 + 清洗 SQL |
| ② 履约售后是演示数据 | **依赖外部**：需平台 API 授权 | ⚠️ 部分（已授权 2 店铺可先跑通） |
| ③ 问题库 0 行 | **产品设计缺失**：缺初始化引导 | ✅ 能，加向导 + 种子 |
| ④ 合规采集器 MOCK | **实现缺失**：collector 不发 HTTP | ✅ 能，接真实抓取或明确标注「示例数据」 |

---

## 六、结论

**这个团队有能力做出贴合业务的东西**——排品四因子引擎（`assortment-engine.ts`）和 HRBP 人效工作台是全系统最好的两个模块，fail-closed、可解释、角色语义清晰。

**问题是这个能力没有覆盖到其他分组**，而且新做的 AI-Ops 分支大量使用「硬编码兜底」来掩盖数据不可用，这在演示时是加分项，在真实交付时是**信任炸弹**。

**建议的优先级**：先修数据缺陷（417 行坏名 + 问题库种子 + 合规采集器标注），再处理权限模型漂移，最后才是平台差异化和 AI 能力扩建。
