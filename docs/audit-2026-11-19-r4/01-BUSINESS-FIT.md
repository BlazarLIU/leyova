# 01 · 业务贴合度

> 判断标准不取系统菜单，取 `_evidence/10-business-baseline.md` 中代运营真实作业链（T-7 → T+2）。
> 结论口径：✅ 贴合 / 🟡 形似神不似 / ❌ 缺位。

## 一、13 条必备能力逐条对照

| # | 业务必备能力 | 系统现状 | 判定 | 证据 |
|---|---|---|---|---|
| 1 | 多平台授权与 token 生命周期 | 代码完整：7 平台 OAuth 换 token、refresh、webhook 验签、订单/售后拉取均为真实签名 + `fetch` | 🟡 代码达标，**运行未通且会少算** | `platform-adapters.ts:181-270`；但 `base.ts:78-101` 不翻页（每店最多 50 单/次）、`base.ts:103-110` 流量恒 `[]`、`sync-job.ts:277-284` 0 行也标 completed |
| 2 | 指标字典与口径层 | 有 `/caliber/metrics` 与 metrics 路由，`ai-ops/governance/metrics` 为真实接口页 | 🟡 字典存在，但业务口径（净成交/GPM/UV 价值）未在库中体现为字段定义 | 无 `metric_definition` 类表；`GPM` 在代码里只是除法 |
| 3 | 场次主键数据模型 | `live_sessions` 150 行、`session_plan_products` 446、`session_anchor_metrics` 140、`session_overview_metrics` 140、`fact_ad_spend_daily` 140，关联完整 | ✅ 模型正确 | `_evidence/02-db-rowcounts.md` |
| 4 | 排品/排期/排班协同 | 排品表 + 排期表 + 排班表都有；但排品商品名 **93.5% 损坏** | 🟡 结构在、数据废 | `session_plan_products` 446 行中 417 行 `[object Object]`；根因 `database/demo/generate.mjs:381` |
| 5 | 分钟级盯盘告警 | 有 `AiOpsLiveWatch` + `/alerts/events`；`alert_events` 24 行；但失败时仍提示「已下发」 | ❌ 不可信 | `AiOpsLiveWatchPage.tsx:63-70` catch 后照样 toast `已实时调度下发` |
| 6 | 投放—素材—成交归因 | 有 `fact_ad_spend_daily` 140 行、`ad_plan` 48、`campaign_plan` 48；有「投放 ROI」页；但**千川 API 无实现**，流量事实表恒空，素材维度无表 | 🟡 只有花费，没有流量与素材级归因 | 无 qianchuan/oceanengine 实现；`fetchTrafficData` 恒 `[]`；`content_assets` 0 行 |
| 7 | 订单—售后—履约闭环 | `canonical_orders_y202610` 216 行、`fact_fulfillment_waybill` 420、`fact_cs_session` 480；有售后/履约/客服页 | 🟡 有数据、有页面，但全为演示数据，且同步每店最多 50 单 | `_evidence/02-db-rowcounts.md`；`sync-job.ts` 单页缺陷 |
| 8 | 复盘 + 行动项闭环 | 7 个 review 页真实接 `/review/*`；行动项页真实接 `/system/tasks` 但失败回落 3 条假任务 | 🟡 复盘真、行动项假成功 | `ai-ops-data.ts:643-702` |
| 9 | 素材/脚本资产库 | `script_library` 96 行；有 `/ops/script-library` 菜单；但 `/api/v1/scripts/templates` 未进 `MODULE_MAP` → 非 admin 全 403 | 🟡 有资产、无权限 | `_evidence/03-api-authz-matrix.md` §3 |
| 10 | 合规审核留痕（3 年） | 有 compliance 模块、`compliance_rule_change/snapshot` 各 63 行；但 `compliance_events` 0 行，无「AI 生成标识」字段 | 🟡 规则雷达有，留痕与 AI 标识缺 | `_evidence/02-db-rowcounts.md` |
| 11 | 多品牌权限隔离 | 有 `brand_viewer` 角色与品牌门户，但无 tenant/brand 维度 RLS 证据；`user_platform_permissions` 真实账号 0 行 | ❌ 未落地 | `_evidence/05-platform-probes.md` §2 |
| 12 | 单场 P&L | `AiOpsFinancePnl` 有页面，但成本比例为比例硬造、生成假签名 `SIG-…-SHA256-VERIFIED` | ❌ 不可用于结算 | `ai-ops-data.ts:441-500` |
| 13 | AI 产出可追溯 + 人工复核 | `ai_v2_run` 3648 / `ai_v2_claim` 19983 / `ai_v2_evidence` 42531 / `ai_v2_step` 5244；有 verdict（3499 verified / 149 rejected） | ✅ 本系统最强项 | `_evidence/02-db-rowcounts.md`；DB 实测 |

**统计**：✅ 2 条、🟡 8 条、❌ 3 条。真正的短板集中在「运行态数据」与「资金/合规」两类。

## 二、9 大工作面贴合度

| 工作面 | 对应页面/模块 | 业务真实动作 | 判定 | 主要问题 |
|---|---|---|---|---|
| 今日作战 | `AiOpsCockpitPage`、`PlatformAwareHomePage`、`Cockpit` | 早上看目标进度、异常、待办 | ❌ 假 | AI 动作/案例固定 4+2 条（`ai-ops-data.ts:91-137`），ID 写死 `CASE-20261116-01/02` |
| 场次执行 | 场次列表、排品、提词、盯盘、场次复盘 | 一场直播的完整执行 | 🟡 割裂 | 经典 `/overview/sessions` 与 AI-Ops `/ai-ops/session/*` 两套；排品数据 93.5% 损坏 |
| 货盘/商品 | 选品、结构、价格、库存、渠道商品 | 选品→定价→上架 | 🟡 | 选品/价格真；「货盘结构」页 100% 写死 5 组 27 子类（`AiOpsAssortmentStructurePage.tsx:2-7`） |
| 流量/投放 | 流量看板、投放复盘、素材 | 投流计划→素材→成交 | 🟡 | 只有花费数据，无素材级归因；千川无接入 |
| 履约/售后 | 履约 SLA、售后、客服、退款分析 | 发货→超时→退款→差评 | 🟡 | 数据演示级；退款分析接真实接口 |
| 内容/达人 | 短视频、笔记、达人合作、切片 | 预热素材→达人带货 | 🟡 | 切片页 6 条写死（`AiOpsClipsPage.tsx:5-9`）；活动页 4 条写死；`dim_kol` 0 行 |
| 人与钱 | 主播/排班/HRBP、财务 P&L/结算 | 排班→工时→分润/结算 | ❌ | 主播绩效用下标公式造假；结算批次写死；财务页假签名 |
| 数据资产 | 数据管理、质量、上传、接入向导 | 拉数→清洗→入仓 | 🟡 | 结构完整（raw/clean/canonical 分层 + 月分区），但 `cleaning_runs=1`，手动上传几乎未用 |
| 系统治理 | 用户/角色/模块/平台/字典/审计/任务 | 配权限、看审计 | 🟡 | 41 模块全启用（热插拔不存在）；角色名与 DB 不符；`system_jobs` 147 条全 completed |

## 三、8 条伪需求识别（系统里是否被过度设计）

| 伪需求 | 系统是否实现 | 建议 |
|---|---|---|
| 流量池等级/层级预测 | 未实现（`/insights/douyin/three-pools` 为知识页，非预测模型） | 保持不实现，避免误导 |
| 场中全自动调控（自动改价/库存/上下架） | 未实现；但「盯盘」页文案暗示可下发 | 删除「已下发」类文案 |
| 六平台一键开播/改价/发券 | 未实现 | 不做；改为「跳转平台后台」 |
| AI 全自动主播/选品/投放 | 部分以「AI 建议」呈现，但实为规则/写死 | 明确标注「建议，需人工确认」 |
| 跨平台统一 KPI 排行榜 | 有跨平台排行榜倾向（`agg_platform_monthly`） | 慎做：口径不同不可直接排名 |
| 直播间 3D 数字孪生 | 未实现 | 不做 |
| 自建平台级 BI 替代罗盘/生意参谋 | 有 BI 模块，但数据不全 | 定位为「跨平台汇总」，不替代官方 |
| AI 实时违禁词 100% 拦截 | 有关键词/规则雷达 | 降级为「提示 + 人工复核」 |

系统整体 **没有严重跑偏去实现伪需求**，这是加分项；但**文案上过度承诺**（「不可变财务凭证」「实时调度下发」「AI 已采纳执行」）会制造伪能力印象，必须整改。

## 四、业务视角的三个结构性错位

1. **「场次」在 UI 层不连续**：真实业务里排品、盯盘、结算、复盘是同一场次的四个前后相连动作；系统把它们分散在 `/overview/sessions`、`/ai-ops/session/planning`、`/ai-ops/session/live-watch`、`/ai-ops/session/review`、`/ai-ops/finance/pnl` 五个页面，且没有统一的「场次作战室」入口承接。
2. **「钱」的边界错**：财务角色在 DB 不存在（`finance` 不在 `roles`），真实财务用户 `finance_chen` 是 `ad_buyer`，看不到财务；而 `controller`（现场中控）被前端当作财务角色放行。业务上中控绝不应看成本与结算。
3. **「平台差异」只做了展示，没做口径**：淘宝/天猫/小红书/视频号/快手/抖音的指标口径不同（见基准 §2），系统用一个 `gpm`、一个 `roi` 打天下，且平台矩阵 198 行 0 项不适用——等于宣称「六个平台完全一样」，与业务事实相反。

## 五、结论

- **贴合的是骨架**：场次主键、数据分层、角色矩阵、复盘五维，这些都踩在业务要点上。
- **不贴合的是运行态**：真实授权、分钟级数据、资金口径、合规留痕、平台差异口径。
- 因此整改优先级应是「**先让真实数据进来、再让口径分平台、最后再谈 AI 自动化**」，而不是继续加页面。
