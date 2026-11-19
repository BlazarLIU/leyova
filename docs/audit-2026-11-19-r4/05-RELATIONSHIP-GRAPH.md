# 05 · 功能关系图谱

> 说明：本图描述「业务动作 → 模块 → 数据表 → 接口 → 页面」的真实依赖，不按菜单画。
> 数据层事实见 `_evidence/02-db-rowcounts.md`，接口事实见 `_evidence/03-api-authz-matrix.md`。

## 一、总图：以「场次」为枢纽

```mermaid
graph TD
  subgraph 计划层
    A1[目标/预算<br/>goal_tracking]
    A2[选品<br/>fact_selection_recommendation]
    A3[排品<br/>session_plan_products]
    A4[排期排班<br/>session_staff_assignments]
    A5[投流计划<br/>ad_plan / campaign_plan]
    A6[预热素材<br/>script_library]
  end

  S((场次<br/>live_sessions<br/>session_id))

  subgraph 执行层
    B1[开播登记<br/>live_registrations]
    B2[盯盘指标<br/>session_anchor_metrics]
    B3[场次概览<br/>session_overview_metrics]
    B4[投放花费<br/>fact_ad_spend_daily]
    B5[订单<br/>canonical_orders_y*]
    B6[售后/退款<br/>canonical_refund_events]
  end

  subgraph 结果层
    C1[履约<br/>fact_fulfillment_waybill]
    C2[客服<br/>fact_cs_session]
    C3[总账<br/>fact_gl_voucher / fact_gl_entry]
    C4[复盘<br/>review/*]
    C5[AI 分析<br/>ai_v2_run/claim/evidence]
  end

  A1 --> S
  A2 --> S
  A3 --> S
  A4 --> S
  A5 --> S
  A6 --> S
  S --> B1
  S --> B2
  S --> B3
  S --> B4
  S --> B5
  S --> B6
  B5 --> C1
  B5 --> C2
  B3 --> C4
  B4 --> C4
  B6 --> C4
  C1 --> C3
  C4 --> C5
```

**结论**：数据模型是健康的——所有业务动作都能挂到 `session_id`。问题在 UI 层被两套导航切断（见第三节）。

## 二、模块 × 数据表 × 接口 对应表

| 业务模块 | 主表 | 关键接口 | 页面 | 状态 |
|---|---|---|---|---|
| 今日作战 | `overview_daily_stats`、`alert_events`、`goal_tracking` | `/overview/*`、`/system/alerts`、`/system/tasks` | `AiOpsCockpit`、`PlatformAwareHomePage` | 数据空/假 |
| 场次 | `live_sessions`、`live_registrations` | `/overview/sessions`、`/sessions/:id`、`/sessions/:id/pnl` | 场次列表、`AiOpsReview` | 可用（无平台过滤） |
| 排品 | `session_plan_products`（446，417 损坏） | `/sessions/:id/slots` | `AiOpsPlanning`、`SessionProductsPage` | 数据损坏 |
| 排班 | `session_staff_assignments`、`staff_day_status` | `/hrbp/attendance`、`/schedule/*` | `ScheduleManagement`、`HrbpWorkspace` | 可用 |
| 主播 | `anchors`、`session_anchor_metrics` | `/anchors`、`/review/anchors` | `AnchorList`、`AnchorProfile`、`AnchorPerformance` | 真实页可用；`AiOpsPeople` 造假 |
| 投流 | `fact_ad_spend_daily`、`ad_plan`、`campaign_plan` | `/net-roi/overview` | `NetRoiPage`、`AiOpsCampaigns` | 花费真/活动假 |
| 订单 | `canonical_orders_y2026*` | `/orders/*` | 订单相关 | 演示数据 |
| 履约 | `fact_fulfillment_waybill` | `/fulfillment/*` | `FulfillmentSla` | 演示数据 |
| 售后 | `canonical_refund_events`、`fact_cs_session` | `/after-sales/*`、`/customer-service/*` | `AfterSales`、`CustomerService`、`RefundAnalysis` | 演示数据 |
| 财务 | `fact_gl_voucher`（60，仅 11-16）、`fact_gl_entry`（114） | `/finance/*` | `AiOpsFinancePnl`、`AiOpsFinanceSettle` | 假成本/假签名 |
| 内容 | `script_library`（96）、`content_*`（多张 0 行） | `/scripts/templates`（403）、`/content/*` | 话术库、`VideoData`、`AiOpsClips` | 权限/空 |
| 达人 | `dim_kol`（0）、`fact_kol_cooperation`（0） | `/kol/*` | `KolCooperation` | 空 |
| 数据治理 | `raw_*`/`clean_*`/`canonical_*` 月分区 | `/data/*` | `DataManagement` 等 5 页 | 结构完整、几乎无数据 |
| AI | `ai_v2_*`（5 万+）、`ai_eval_run`（3420） | `/ai/*`、`/calibration` | `ChatPage`、`AnalysisWorkbench`、`AiOpsMetrics` | 最强项 |
| 系统 | `users`、`roles`、`system_modules`、`audit_logs` | `/system/*`、`/auth/*` | 用户/角色/模块/审计 | 角色名不一致 |

## 三、断点图谱（哪里断了）

```mermaid
graph LR
  P1[前端菜单] -.x 不发平台.-> API[后端 /api/v1]
  API -.x 不按平台过滤.-> DB[(PG)]
  UI1[AI-Ops 假页面] -. 硬编码 .-> X[无数据源]
  UI2[真实页面] --> API2[真实接口] --> DB2[真实表]

  ROLES[代码角色: admin/operator/finance] -. 不存在 .-> DBROLES[(roles 8 个)]
  DBROLES -. 真实角色 ad_buyer/video_editor/cs_agent .-> GATE[AI-Ops 白名单排除]
```

具体断点：

1. **平台维度**：`菜单 platforms` → ✅；`请求头` → ❌；`SQL where` → ❌。
2. **角色维度**：`Layout/RequireAiOpsAccess 白名单`（含 `admin`/`operator`/`finance`）→ DB `roles` 无这三个 → 白名单有一半是空转；`ad_buyer`/`video_editor`/`cs_agent` 被排除。
3. **数据维度**：`ai-ops-data.ts` 在真实分支内仍用下标公式 → 数据真、指标假。
4. **反馈维度**：`catch {}` + `return true` → 用户永远看到「成功」。

## 四、关联强度（改一个会牵动谁）

| 改动点 | 直接影响 | 间接受影响 |
|---|---|---|
| `route-manifest.ts` | 经典侧栏、classic-routes、Topbar 面包屑（副本需同步） | 搜索、权限提示 |
| `system_modules` / `roles` | `/auth/me` 的 `access.modules` | 全部 `RequireAccess` 页面、侧栏 `canSee` |
| `platform_capability_matrix` | `/platforms` capabilities | 侧栏 `isModuleSupported`、`platformRoute` 提示 |
| `ai-ops-data.ts` | AI-Ops 12 个页面 | 驾驶舱、审批、任务、绩效、财务 |
| `session_plan_products` 修复 | 排品、货盘、复盘商品分析 | `/sessions/:id/slots`、`/review/products` |
| `roles` 增删 | 登录后首页、AI-Ops 准入 | 财务专区、HRBP 专区 |

## 五、结论

- **模型层不需要大改**：`session_id` 枢纽是对的。
- **UI 层需要「二合一」**：把经典与 AI-Ops 两条导航合并为一条以场次为主轴的导航。
- **权限层需要「对齐」**：先统一角色字典，再谈模块热插拔。
- **平台层需要「下沉」**：平台差异必须落到 SQL 与指标口径，而不是菜单过滤。
