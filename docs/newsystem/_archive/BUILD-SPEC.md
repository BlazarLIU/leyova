# 新系统 BUILD SPEC（v3，全新仓库 · 从零构建）

> 日期：2026-11-16 ｜ 状态：**本文档是新系统的唯一构建依据**，取代 `00~60` 全部方案文件（那些保留作审计与调研留痕）。
> 配套架构文档：**`ARCHITECTURE.md`**（五层数据流 + Artifact 中心抽象 + 模块内核 + 事件一致性 + 开源机制落位矩阵）。
> 前提：**不修改旧系统任何一行代码**。旧仓只作为「反面教材清单」（见 §12），不迁移表、不迁移页面、不共享代码。
> 交付形态：先自用、架构预留 SaaS；当前无真实数据，先用可复现的演示数据验收，后续接平台 API/手工导入/第三方。

---

## 0. 它是什么、不是什么

### 0.1 一句话

**一套「AI 运营操作系统」：它观察经营、诊断问题、产出可执行物、等运营审批、执行、再测量效果。**

不是"带 AI 聊天框的 ERP"，也不是"报表中台"。

### 0.2 六条反 ERP 判据（每条都可当场检验）

| # | 判据 | 通过标准 | ERP 的样子 |
|---|---|---|---|
| 1 | **主语测试** | 功能的主语是**动作**（排品/开播/复盘/调预算/上架/回评） | 主语是**单据**（采购单/凭证/工单/调拨单） |
| 2 | **产出测试** | 每个功能产出**可执行物**（能入库、能审批、能被下一环节消费） | 产出一张报表或一条记录 |
| 3 | **闭环测试** | 每个动作都有"下一场/下一周期自动验证效果" | 做完就结束，效果靠人记 |
| 4 | **对象测试** | 数据围绕 **人·货·场·钱·客** | 围绕会计科目、库存台账、BOM |
| 5 | **模块测试** | **只买一个模块也能用起来** | 必须全模块一起上 |
| 6 | **关 AI 测试** | 关掉 AI，系统价值应**大幅下降**（因为核心是判断与产出） | 关掉 AI 毫无影响——说明 AI 是装饰 |

> 第 6 条最狠：**如果关掉 AI 系统还一样好用，那它就是 ERP。** 新系统的每一屏都应该有"AI 给的草案/建议/归因"，且人可以直接采纳或改。

### 0.3 核心循环（系统的骨架）

```
Observe  →  Diagnose  →  Propose  →  Approve  →  Apply  →  Measure  →  Learn
 取数        找差异       出草案       人审        落对象      看效果       进评测
   │            │            │            │            │            │           │
 metric       归因         artifact     approval     action      result      eval_case
```

七个环节缺一不可；**任何新功能必须能嵌入这条循环的某一环**，否则不做。

---

## 1. 用户与场景（按"一个岗位的一天"设计）

| 岗位 | 一天里真正做的事 | 系统给他的第一屏 | 系统替他做的判断 |
|---|---|---|---|
| 运营/操盘手 | 定货盘、排品、盯场、复盘 | 今日待办（3 场直播 + 2 个待审草案） | 排品草案、场次差距、复盘归因 |
| 主播 | 对流程、记机制、开场钩子、逼单 | 本场提词卡（品序/机制/话术版本） | 口播与后台一致性检查 |
| 中控 | 上下架、改价、发券、挂福袋 | 时点指令列表（几点做什么） | 漏执行/错价提醒 |
| 场控 | 控评、氛围、报时 | 评论区风险 + 节奏提醒 | 违禁词/负面情绪识别 |
| 投手 | 建计划、测素材、加预算、砍劣质 | 计划健康度 + 今日调整单 | 异常熔断、预算建议 |
| 选品 | 对货、核价、核资质、出提案 | 候选池 + 风险标记 | 毛利/退款/资质风险 |
| 切片 | 选高光、剪辑、分发、追投 | 待剪清单（含授权状态） | 高光选段、重复度检测 |
| 客服 | 售前答疑、售后处理 | 待处理会话（按 SLA 排序） | 五类结构化问答自动回 |
| 老板 | 看利润、看人效、定目标 | 利润与目标差距 | 归因到"哪一场/哪个品/哪个人" |

**设计约束**：小团队一人多岗是常态 → 用户可绑多个岗位，不做"一岗一账号"；每个写动作都有审计与回滚。

---

## 2. 领域模型（对象图）

```
Tenant ── LegalEntity ── Store ── Channel(market) ── Listing
   │
   ├─ User ── Role(岗位) ── Scope(数据范围)
   │
   ├─ Catalog:  Product ── SKU ── Qualification / CostCard
   │                 └── PriceList(market) ── PriceListItem
   │                 └── Inventory(location, stocked/reserved/available)
   │
   ├─ Run:      LiveRun ── RunSlot ── Cue / ScriptVersion
   │                 └── RunSlotResult
   │
   ├─ Trade:    Order ── OrderLine ── OrderEvent
   │                 ├── Fulfillment ── PlatformClock
   │                 └── RefundCase ── AfterSaleTicket
   │
   ├─ Money:    AdCampaign ── AdSpend
   │                 ├── SettlementBatch ── SettlementLine ── CashReceipt / FxRate
   │                 └── PnlSnapshot (sku / run / store / market)
   │
   ├─ Customer: Conversation / Ticket / Review / ExperienceScore
   │
   ├─ Artifact: AiArtifact ── AiAction（AI 的产出与执行，一等公民）
   │
   └─ Governance: MetricDefinition / SourceRegistry / DataMaturity / ModuleLink
```

**三条建模铁律**：

1. **金额三口径分列**：`amount_order` / `amount_paid` / `amount_settle`，绝不合并成一个 `gmv`；每个金额带 `currency`。
2. **价格属于市场，不属于 SKU**：`price_list(market, currency, tax_included)` + `price_list_item`；渠道差异用 `channel_listing`。
3. **模块间不建外键**：跨模块关系只走 `module_link`；模块卸载只删自己的 schema。

---

## 3. 模块体系（内核 + 可插拔模块）

### 3.1 内核（必须安装，不单独收费，**不含任何业务流程**）

| 内核域 | 表 | 职责 |
|---|---|---|
| identity | tenant / legal_entity / user / role / user_role / staff_assignment | 三维权限（岗位 × 数据范围 × 对象状态） |
| object | product / sku（最小字段） | 只放"跨模块都要用"的身份字段；合规/成本/库存字段由模块扩展 |
| metric | metric_definition / source_registry / data_maturity | 口径版本化 |
| ai | ai_agent / ai_run / ai_step / ai_evidence / ai_claim / ai_artifact / ai_action | 只做运行时，不含业务 prompt |
| event | domain_event / outbox | 领域事件 + 幂等 |
| link | module_link | 跨模块关系的唯一载体 |
| module | module_manifest / entitlement / plan_module / subscription / feature_flag / usage_meter | 安装/授权/灰度/计量 |

**内核目标：约 20 张表。** 内核里不允许出现"排品表""结算表"这类业务表。

### 3.2 业务模块（每个 = 独立 schema + manifest + 可单独授权）

| 模块 | 默认 | 表 | 一句话边界 | 计量口径 |
|---|---|---|---|---|
| `connect` 数据接入 | ✅ | 5 | API / Excel / 第三方 → staging → 业务表 | 按导入行数 |
| `live_planning` 货盘与排品 | ✅ | 6 | 卖什么、什么价、什么角色、讲多久 | 按 SKU 数 |
| `live_run` 场次编排 | ✅ | 5 | 几点做什么、谁按了什么 | 按场次 |
| `live_review` 复盘归因 | ✅ | 5 | 差在哪一段、下次改什么 | 按场次（含 AI） |
| `media` 投放协同 | ⬜ | 5 | 钱花得值不值 | 按消耗额阶梯 |
| `content` 内容与切片 | ⬜ | 5 | 素材能合法用吗、哪条值得追投 | 按成片数 |
| `crossborder_listing` 跨境上架与合规 | ⬜ | 5 | 这个 SKU 能不能卖到这个国家 | 按 SKU×市场 |
| `crossborder_fulfill` 跨境履约 | ⬜ | 5 | 货在哪、什么时候到 | 按订单 |
| `crossborder_settle` 跨境结算与利润 | ⬜ | 5 | 钱什么时候到、到底赚多少 | 按结算单 |
| `inventory` 库存与备货 | ⬜ | 4 | 缺货/滞销/预留 | 按 SKU |
| `creator` 达人合作与结算 | ⬜ | 4 | 这个达人这场赚没赚 | 按结算单 |
| `service` 客服与体验 | ⬜ | 4 | 用户为什么不满、怎么不再发生 | 按会话数 |

**默认安装 = 内核 + connect + 直播三件套**（4 个模块）。其余默认关闭；客户买了再开，不需要重新部署。

### 3.3 模块契约（manifest）

```ts
export default defineModule({
  id: 'live_planning', name: '货盘与排品', version: '1.0.0',
  dependsOn: ['kernel.object', 'kernel.metric'],
  schema: 'mod_planning',
  apiPrefix: '/api/v1/planning',
  permissions: ['planning.read', 'planning.write', 'planning.publish'],
  nav: [{ section: '直播', label: '货盘与排品', href: '/planning', order: 10 }],
  aiAgents: ['planning_agent'],
  jobs: ['planning_baseline_refresh'],
  entitlements: { metric: 'sku_count', included: 5000 },
  minKernel: '>=1.0.0',
})
```

**CI 强制**：模块只能 import 内核或对方 `public.ts`；SQL 只能落在自己 schema；无 manifest 不允许合并。

### 3.4 三层开关 + 四口拦截

- **L1 安装**（部署清单）→ **L2 授权**（entitlement，按模块收费的载体）→ **L3 灰度/急停**（feature flag）。
- 拦截四口：**导航**（服务端只返回已授权菜单）、**API**（403 `MODULE_NOT_LICENSED`）、**worker**（未授权任务跳过并记 skipped）、**AI 工具**（未授权模块的指标与动作对 LLM 不可见）。
- 关闭 = 数据只读可导出 + 停止计量；卸载 = 保留 90 天可再装；彻底删除 = 二次确认 + 导出留档。

### 3.5 授权与计费

```
plan → plan_module（含哪些模块、价格、计量口径）
subscription（tenant, plan, period）
entitlement（tenant, module, source=plan|trial|manual|license, status, valid_from/to, limits）
usage_meter（tenant, module, metric, period, qty）
```

- 三种卖法共用一套 entitlement：**SaaS 订阅 / 私有化 license（JWT + 机器指纹，离线校验）/ 30 天试用**。
- **license 只决定"能不能用"，不决定"代码在不在"**——所以升降级不需要重新部署。
- 每模块**只允许一个计量口径**，避免"卖了却算不清账"。

---

## 4. 数据模型（新库，不继承旧库任何表）

### 4.1 内核表（20）

`tenant` `legal_entity` `user` `role` `user_role` `staff_assignment` `product` `sku`
`metric_definition` `metric_dimension` `source_registry` `data_maturity`
`ai_agent` `ai_run` `ai_step` `ai_evidence` `ai_claim` `ai_artifact` `ai_action`
`domain_event` `module_link` `module_manifest` `entitlement` `plan_module` `subscription` `feature_flag` `usage_meter`

### 4.2 模块表（每个模块 4~6 张，独立 schema）

**`connect`**：`connector` `sync_job` `staging_record` `column_mapping` `data_quality_issue`
**`live_planning`**：`channel_listing` `price_list` `price_list_item` `run_plan` `run_plan_slot` `qualification`（*注：`qualification` 若跨境也用，放 `crossborder_listing` 并在两处用 link 关联*）
**`live_run`**：`live_run` `run_slot` `cue` `script_version` `run_checklist`
**`live_review`**：`run_report` `funnel_snapshot` `slot_result` `action_item` `refund_attribution`
**`media`**：`ad_campaign` `ad_spend` `ad_action` `creative` `budget_guard`
**`content`**：`content_authorization` `content_clip` `publish_record` `matrix_account` `clip_metric`
**`crossborder_listing`**：`market_rule` `compliance_file` `listing_draft` `listing_publication` `market_sku`
**`crossborder_fulfill`**：`inbound_shipment` `stock_location` `stock_level` `reservation` `platform_clock`
**`crossborder_settle`**：`settlement_batch` `settlement_line` `cash_receipt` `fx_rate` `pnl_snapshot`
**`inventory`**：`stock_item` `stock_move` `stock_alert` `stock_count`
**`creator`**：`creator` `cooperation` `sample` `commission_settlement`
**`service`**：`conversation` `ticket` `review` `experience_score`

### 4.3 分区与容量（对应 3 年 1.2 亿行）

| 表族 | 分区方式 | 保留 |
|---|---|---|
| `order` / `order_line` / `settlement_line` | 月 RANGE | 全部（热 3 个月） |
| `domain_event` / 行为事件 | 月 RANGE | 原始 90 天，聚合永久 |
| `ai_evidence` / `ai_step` | 月 RANGE | 1 年后归档为对象存储 |
| `metric_snapshot`（分钟级） | 月 RANGE | 1 分钟后只留 5 分钟粒度 |
| 其余 | 不分区 | — |

- 分区由脚本自动建未来 3 个月、删 13 个月前（**禁止手工建月表**，旧系统 70 张手工分区表就是这么烂掉的）。
- 汇总层四张：`agg_trade_day` / `agg_run_summary` / `agg_sku_day` / `agg_pnl_period`；看板只读汇总。
- 索引策略：时间列 BRIN，业务键 `(tenant_id, business_key)` B-Tree；禁止低基数列单列索引。
- 演进触发器：汇总后 P95 仍 >1.5s 且单次扫 >2,000 万行 → 才引入 ClickHouse；读 QPS >1,500 → 只读副本；库 >500GB → 按域拆库。

### 4.4 数据接入（三种来源、一个入口、同一幂等）

```
connector(api|file|third_party) → staging_record（原样 + 文件指纹）
   → normalize（字段映射/单位/币种/时区）→ gate（必填/口径/重复/连续性）
   → 业务表 + data_quality_issue
```

幂等键 `(source, business_key, version)`；第三方数据只进分析域，**不得进结算/合规判定**。

---

## 5. AI 运行时（Artifact-first）

### 5.1 生命周期

```
ai_run(created) → ai_step × N → ai_claim（带 evidence）→ critic 校验
   → ai_artifact(draft) → 人审（approve/reject/edit）→ ai_action(applied)
   → 业务对象变更 → 下场/下周期 result 回写 → eval_case
```

- **审批状态必须在数据库里**（`ai_action.approval_status`），进程重启不丢。
- **回滚**：`ai_action.rollback_of`，7 天内可撤销；所有动作走领域服务，不直接写库。
- **LLM 只有 7 个工具**：`list_metrics` `describe_metric` `run_metric` `get_object` `list_objects` `create_draft` `apply_action`（+ `check_compliance` / `search_knowledge` 按模块授权）。**永不发裸 SQL。**

### 5.2 五个 Agent 的 I/O 契约

| Agent | 输入 | 输出 artifact | 硬闸门（不通过即拒绝出稿） | 验收 |
|---|---|---|---|---|
| `planning_agent` | SKU 近 30/90 天 支付/结算 GMV、退款率、毛利、库存与在途 | `run_plan_draft`（排品表 6 组字段 + 每品理由 + evidence 引用） | 资质过期、毛利为负、库存 < 安全线、价格低于成本 | 采纳率 ≥60%；坑产 MAPE ≤35% |
| `review_agent` | 单场全量指标（带成熟度）、流量结构、货盘、主播分段、退款 | `run_report` + `action_item` | 归因分解之和 ≠ GMV 差额（±1%）则拒绝；禁"下次努力"类结论 | 认可率 ≥70%；行动项执行率 ≥50% |
| `media_agent` | 计划级消耗/转化/GMV、素材标签、结算 GMV、退款 T+15 | `ad_action`（预算/关停/换素材） | 三种 ROI 必须分列；结算未成熟禁"加预算"；单次 ≤±30% | 采纳率 ≥50%；7 日结算 ROI 不劣于对照 |
| `content_agent` | 场次录像索引、授权记录、历史高转化段 | `clip_list` + `script_version` | 无授权直接拒绝入队；违禁词零漏检 | 成片可用率 ≥40%；采纳率 ≥50% |
| `listing_agent` | SKU 主数据 + 合规档案 + 目标市场 + 竞品（可选） | `listing_draft`（多语言，每条带合规依据） | GPSR/EPR/CPC 缺失即拦；AI 图像标注；TikTok 真人画面占比规则 | 人工改写率 ≤40%；合规拦截召回 100% |

### 5.3 Artifact 示例（排品草案，这是"可执行物"的形态）

```json
{
  "type": "run_plan_draft",
  "module": "live_planning",
  "object": { "room_id": 3, "run_date": "2026-12-01" },
  "caliber": { "gmv": "gmv_pay@v1", "maturity": "T+15" },
  "slots": [
    { "seq": 1, "sku": "SKU-1023", "role": "引流", "minutes": 6, "price": 39.9,
      "mechanism": "限时秒杀", "reason": "近30天转化4.2%、退款8%、毛利18%、库存1200",
      "evidence": ["ev_1042", "ev_1043"] }
  ],
  "checks": [
    { "rule": "qualification_valid", "pass": true },
    { "rule": "margin_positive", "pass": true },
    { "rule": "stock_above_safety", "pass": true }
  ],
  "confidence": 0.72
}
```

**注意**：这不是"一段建议"，它有 schema、有证据引用、能一键落 `run_plan_slot`、能被下一场结果回写。

### 5.4 编排引擎（待 spike 决定，不阻塞数据模型）

- 候选：**Mastra**（核心 Apache-2.0，`ee/` 需商业授权）vs **LangGraph JS**（MIT）vs **自研**（Vercel AI SDK + `ai_run` 状态机）。
- 无论选谁，**`ai_run/ai_step/artifact/action` 四张表是唯一状态真值源**，框架只能当执行器。
- spike 六条判据：kill 后恢复、状态可用 SQL 查、回放 10 次一致、0 新增容器、单步 P95<150ms、升级小版本 ≤0.5 人天。
- **在 spike 结论出来前，Phase 0/1 按自研实施**（编排逻辑只有线性 6 步 + 一次审批）。

### 5.5 评估与可观测

- **五个指标**：数字准确性、证据充分性、执行成功率、审批正确性、业务结果（采纳率/ROI/坑产误差）。
- 黄金集：每类 Agent ≥30 例（含"故意埋雷"的 10 个 SKU、3 个异常场次），每次 prompt/模型变更全量回归。
- Langfuse 自托管（MIT 核心，避开 `ee/`）：trace 四层 session→run→step→tool，运营能看懂"AI 判了什么、依据哪条数据"。

---

## 6. 指标与口径治理（第一优先级）

- 22 个指标全部注册：三种 GMV、退款率、品质退货率、AOV、UV 价值、GPM、停留、CTR、场次转化率、坑产、连带率、消耗、三种 ROI、体验分（版本化）、发货/揽收时效、有效直播时长、主播提成基数；跨境追加到岸成本、CM3、汇损、罚金率、库存周转。
- 每条带：公式、单位、**口径版本**、生效日期、来源 URL、允许维度、**成熟度要求**（如结算 ROI 必须 T+15）。
- 硬规则：**任何报表/API/AI 结论必须带 `caliber_version`；未注册指标不得出现在 UI。**
- 口径冲突登记：例如体验分同时存在 5 分制/90 天与百分制/30 天两套文档 → 登记两个版本，UI 标注，不写死。

---

## 7. 技术栈与仓库骨架（只定结构，不写代码）

**栈**：TypeScript + Node 22 / React 19 + Vite + Tailwind + shadcn + TanStack Query + ECharts / Fastify 5 + Zod / Drizzle / PostgreSQL 16+pgvector / pg-boss / Vercel AI SDK / Langfuse（第 2 月）/ S3 兼容 / docker compose ≤7 容器。

**明确不采用**：Dify、FastGPT（多租户条款）、n8n（Sustainable Use）、Flowise（已归档）、RAGFlow（5~9 容器）、OpenViking（AGPL）、Phoenix（ELv2）、Medusa/Vendure 代码（只借模型）。

```
leyova-next/
├ apps/
│  ├ api/         Fastify：路由只做「解析→权限→domain→序列化」，禁止 SQL
│  ├ worker/      AI 任务 / 同步 / 定时（pg-boss）
│  └ web/         SPA（静态产物可并入 api）
├ packages/
│  ├ kernel/      identity / object / metric / ai / event / link / module-runtime
│  ├ modules/     connect / live_planning / live_run / live_review / media / content
│  │              crossborder_listing / crossborder_fulfill / crossborder_settle
│  │              inventory / creator / service
│  ├ contracts/   Zod schema（前后端共用）
│  ├ metrics/     指标注册表（TS 常量 + 参数化 SQL 模板）
│  └ connectors/  平台 API 客户端 / Excel 解析
├ db/  migrations/<module>/  seeds/  rollups/
└ ops/ docker-compose / backup / 压测脚本
```

**分层铁律**：routes 无 SQL；domain 无 IO；metrics 是唯一允许聚合 SQL 的地方；connectors 只取数不做业务判断；每个路由必须带 `domain` tag（CI 检查）。

---

## 8. 安全与多租户（预留 SaaS，v1 只 1 个租户）

- 每行带 `tenant_id`；服务层强制作用域，RLS 作第二道防线。
- 三维权限：`can(user, action, object) = 岗位有权 && 数据范围覆盖 && 对象状态允许`。
- 模块守卫：未授权即 403 `MODULE_NOT_LICENSED`（不是 404，要让客户知道可买）。
- 审计：所有写动作记录 who/what/before/after/trace_id；AI 动作额外记录 approval。
- 私有化交付：license JWT（模块列表 + 到期 + 机器指纹）离线校验；数据不出内网。

---

## 9. 交付路线（每阶段都能单独卖）

| 阶段 | 交付 | 人天 | 可卖状态 |
|---|---|---:|---|
| P0 内核 | 身份/三维权限/指标注册表/AI 运行时/事件/module-runtime + 演示数据生成器 | 15 | 不可卖 |
| P1 直播基础版 | connect + live_planning + live_run + live_review + 复盘 Agent + 排品 Agent | 32 | **可卖直播基础版** |
| P2 直播专业版 | media + content + 投放 Agent + 切片 Agent | 22 | 可卖直播专业版 |
| P3 跨境版 | crossborder_listing/fulfill/settle + Listing Agent | 30 | 可卖跨境版 |
| P4 增值包 | inventory / creator / service + 授权计费后台 | 20 | 可卖增值包 |
| P5 规模化 | TikTok Shop / Amazon SP-API 接入 + 1.2 亿行压测 | 18 | 可规模化 |
| **合计** | | **137** | |

**演示数据**：固定随机种子、可一键重建；平台分布/退款率分层/时段峰值接近真实，并**故意埋 10 个高退款低毛利 SKU + 3 个异常场次**用于验收 Agent 是否避坑、归因是否定位准确。

---

## 10. 验收（不通过不算交付）

### 10.1 业务验收（9 条）

1. 30 个 SKU + 库存 + 历史数据 → 10 分钟内产出完整排品表，6 组字段齐全、硬校验全过。
2. 排品表一键开场次，时点提醒按计划触发，中控不用 Excel。
3. 指标偏离基线 60 秒内出告警卡 + 建议动作，误报率 ≤20%。
4. 下播 30 分钟内出五段归因 + 行动项，归因分解之和 = GMV 差额（±1%）。
5. 投放导入 → 出调整单，三种 ROI 分列，结算未成熟有提示。
6. 新建 SKU 缺 GPSR 责任人 → 上架被阻断；补齐后生成多语言 listing。
7. 导入 Amazon 结算报告 → 分录级差异定位 → 单品 P&L 可下钻。
8. 任取 20 个 AI 结论 → 100% 有证据、0 个裸数字。
9. 主播账号访问财务/结算接口 → 全部 403 且有审计。

### 10.2 模块化验收（4 条）

10. 关闭 `media` → 菜单消失、API 403、worker 任务 skipped、数据仍可导出。
11. 卸载再装 → 90 天内数据完整恢复。
12. 只装内核 + 1 个模块 → 系统能启动、能登录、不报错。
13. 跨租户访问 → 100% 403 + 审计。

### 10.3 容量验收（5 条）

14. 灌 3 年 1.2 亿行 → <6 小时，库 <300GB。
15. 看板 600 QPS → P95 <300ms，无 5xx。
16. 明细钻取（单场 200 SKU × 3 个月）→ P95 <800ms。
17. 平台回调 80 写/秒 × 10 分钟 → 不丢不重，P99 <200ms。
18. 汇总任务水位线中断后可续跑，不重复计算。

### 10.4 反 ERP 验收（3 条）

19. 关掉全部 AI → 系统价值显著下降（有 5 个核心屏变成"只能看数"），证明确实以 AI 判断为核心。
20. 只买 `live_review` 一个模块 → 能独立产生复盘报告与行动项。
21. 任一模块的产出物都能被下一个模块消费（排品 → 场次 → 复盘 → 行动项 → 下场排品）。

---

## 11. 风险（按"会不会重蹈旧系统"排序）

| # | 风险 | 新系统防线 |
|---|---|---|
| 1 | 又长成 ERP | 六条反 ERP 判据 + 模块准入四条 + 季度启用率审计（<20% 观察 → 下线） |
| 2 | AI 又变聊天气泡 | 每个 Agent 的验收绑定 artifact 采纳率，不达标不上线 |
| 3 | 模块耦合复活 | 禁止跨模块外键 + CI 检查 import + 只用 module_link |
| 4 | 口径再分裂 | routes 层禁止 SQL；指标只能来自注册表；每数字带口径版本 |
| 5 | 数据量上来后崩 | 分区脚本 + 汇总层 + 5 条量化演进触发器 |
| 6 | 许可证踩坑 | 不采用清单写进 README；新依赖必须过 license 检查 |
| 7 | 人少做不完 | 每阶段可卖；P1 结束即可自用；P4/P5 可延后 |

---

## 12. 旧系统反面教材（只作对照，不复用任何代码/表/页面）

| 旧系统实测事实 | 新系统对应防线 |
|---|---|
| 419 个 API operation 中 409 个无领域 tag | 每个路由强制 `domain` tag，CI 阻断 |
| 93 个导航入口、15 个页面被挂 3~5 次 | 平台是筛选器不是导航维度；导航由模块 manifest 生成 |
| 240 张表 / 86 张 0 行 | 内核 20 表 + 模块 4~6 表；模块不装就不建表 |
| 三套接入管线 39 个端点、运行表全 0 行 | 只有一个 `connect` 模块，三条来源一套幂等 |
| 同一 GMV 四个数、裸 SUM 放大 2.43 倍 | 金额三口径分列 + 指标注册表 + 禁止裸 SQL |
| 选品 97 条与排品 103 条互不相认 | 选品产出必须是 `run_plan_draft`，直接落排品表 |
| `session_staff_assignments` 0 行、排班断链 | `staff_assignment` 在内核，场次-人员强制绑定 |
| `reconciliation_runs` 0 行、对账从未跑过 | 结算对账是 `crossborder_settle` 的 P0 验收项 |
| `ai_v2_llm_call = 0`、AI 结论是预制 | AI 每次运行留 `llm_call` 与 evidence；无调用即视为未实现 |
| 微信/天猫店铺过滤静默丢失（bigint 字符串） | 契约测试覆盖"3 店返回 3 个不同值" |

---

## 13. 现在就可以开始的三件事（不写业务代码）

1. **确认模块清单与默认组合**（§3.2）：默认只装 4 个模块，是否符合你的售卖思路。
2. **确认计量口径**（§3.5）：按场次 / 按 SKU / 按消耗阶梯——这决定 manifest 与 entitlement 的字段。
3. **确认 AI 编排 spike 是否做**（§5.4）：做则 2 周内出结论；不做则直接按自研实施。

确认后第一步是建新仓骨架（Phase 0，15 人天），**旧仓一行不动**。
