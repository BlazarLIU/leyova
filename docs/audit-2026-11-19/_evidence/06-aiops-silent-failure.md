# AI-Ops 分支硬编码与静默失败清单（2026-11-19）

## 1. ai-ops-data.ts 的 8 处静默失败
`apps/web/src/services/ai-ops-data.ts` 共 704 行，12 个 try / 12 个 catch，其中 8 个 catch 注释为 `/* 静默失败 */`，
失败后返回硬编码兜底数据：

| 函数 | 调用的真接口 | 失败后的兜底 |
|---|---|---|
| `fetchTodayBattleData()` | `/overview/sessions` | 3 场写死会议（早场晨播/晚间黄金场/深夜秒杀）+ `targetGmv` 兜底 250000 + `predictedGmv = ×1.08` |
| `fetchSessionPlanningSlots()` | `/sessions/:id/slots` | 4 个写死 SKU（SKU-8012/8033/9104/9208）含价格/毛利率/库存/话术 |
| `fetchSessionReviewReport()` | `/sessions/:id/full-trace` + `/sessions/:id/pnl` | `payGmv` 兜底 142000；退款率兜底 0.14；五段归因 share 写死 0.55/0.25/-0.15/0.20/0.15；3 条行动项写死 |
| `fetchFinancePnlData()` | `/sessions/:id/pnl` | `pay` 兜底 142000；商品成本率 38%、平台费 5%、投放 18%、佣金 10%、仓配 6%、售后退货 2.1% **全部按固定比例现算** |
| `fetchAnchorPerformanceList()` | `/anchors` | ⚠️ **接口成功也造假**：`gpm = 1500 + (10 - (i % 10)) * 120`、`liveHours = 30 + (i % 5) * 8`、`score = min(98, 80 + ...)`、`netProfitContribution = liveHours * gpm * 0.32` —— 用索引数学现推，与真实经营数据无关 |
| `fetchAlertEventsList()` | `/system/alerts` | 3 条写死告警（47h 揽收临界 / 转化率偏离 -32% / 资质审核未通过） |
| `fetchImprovementTasksList()` | `/system/tasks` | 3 条写死改进任务 |
| `fetchPendingApprovals()` | `/ai/pending-approvals` | 返回 `[]`（相对无害，但用户看到「无待办」的假象） |

**共同特征**：失败后界面无任何「数据不可用 / 加载失败」提示，用户看到的是完整、漂亮、但编造的看板。

## 2. 4 个 100% 硬编码页面（无任何 API 调用）
| 页面 | 行数 | 硬编码内容 |
|---|---:|---|
| `AiOpsFinanceSettlePage.tsx` | 133 | 4 条结算批次（SETTLE-202611-001~004），含平台金额/系统金额/差异/锁定状态 |
| `AiOpsCasesPage.tsx` | 49 | 3 条 Decision Case（CASE-202611-01~03），含风险等级 R2/R3、状态、结果 |
| `AiOpsClipsPage.tsx` | 60 | 3 条切片（CLIP-01~03），含来源场次/时间段/钩子/CTR/授权状态 |
| `AiOpsCampaignsPage.tsx` | 61 | 投放协同与熔断数据 |
| `AiOpsAssortmentStructurePage.tsx` | 44 | 货盘结构四类占比（主推 45%/引流 25%/清库 18%/测新 12%）+ 各自 GMV 占比与建议 |

判定方式：`grep -L "api\." apps/web/src/pages/ai-ops/*.tsx` + `grep -c 'useState(\[' ` 交叉确认。

## 3. 11 个「薄包装」页面（套经典页面 + 彩色页头）
以下 AI-Ops 页面只是 import 经典页面组件并加一个深色页头，无自身数据逻辑：
`AiOpsChatPage`(→ai/ChatPage)、`AiOpsWorkbenchPage`(→ai/AnalysisWorkbenchPage)、
`AiOpsKnowledgePage`(→content/ContentCenterConfigPage)、`AiOpsSelectionPage`(→ai/SelectionPage+SelectionHistoryPage)、
`AiOpsPeoplePage`、`AiOpsPricesPage`、`AiOpsScheduleRecommendPage`、`AiOpsLiveWatchPage`、
`AiOpsMetricsPage`、`AiOpsInboxPage`、`AiOpsReviewPage`

## 4. AI-Ops 导航无 module 维度
`apps/web/src/data/ai-ops-navigation.ts` 的 `AiOpsNavItem` 接口只有 `label/icon/href/onlyFinance`，
**没有 `module` 字段**；`buildAiOpsNavigation(isFinanceUser, _isHrbpUser, isSuperAdmin)` 只按角色过滤。
→ 28 个菜单项对任何通过角色门的用户全量展示，不受模块授权与 `disabledModules`（模块热插拔）约束。

## 5. AI-Ops 路由守卫（App.tsx:138-179）
22 条 `/ai-ops/*` 路由统一用 `<RequireAiOpsAccess>`（2 条财务额外加 `requireFinance`），
**不用 `RequireAccess`**，所以不过 module 检查。

## 6. 三处洞察页配置失配
`apps/web/src/pages/insights/PlatformInsightConfig.ts` 的 `findInsightConfig()` 用 `path ?? endpoint` 建索引、
失配时用 `pathname.startsWith(...)` 兜底。实测 10 个导航路径中 3 个匹配不到：
| 导航 href | 配置里的 key | 结果 |
|---|---|---|
| /insights/tmall/promotion-layers | endpoint `/tmall/promotion-layers` | **NO MATCH** → 渲染「未找到页面配置」 |
| /insights/wechat/affiliate | endpoint `/wechat/affiliate` | **NO MATCH** |
| /insights/wechat/content | endpoint `/wechat/content` | **NO MATCH** |
其余 7 个恰好 endpoint 与 path 一致所以能匹配上。
注意：vite dev server 对任何路径都回 200（SPA fallback），**HTTP 状态码发现不了这个 bug**，只有打开页面才看到空壳。
