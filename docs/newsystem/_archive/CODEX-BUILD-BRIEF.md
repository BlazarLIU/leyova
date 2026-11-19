# 施工单：新系统（AI 运营系统）· 交给 Codex 执行

> **这份文件是唯一的施工依据。** 读它一份就够，不需要读其他文档；如果其他地方与本文件冲突，以本文件为准。
> 你的任务：从零构建一套「AI 运营系统」。**不要修改、不要调用、不要依赖 `/home/leyova` 里的旧系统**——旧系统只是反面案例，不在本工程范围内。
> 所有产出放在 **`/home/leyova-next/`**（与旧目录完全隔离）。

---

## 0. 给 Codex 的执行规则（先读这一节）

1. **按任务编号顺序做**（T0.1 → T5.3）。每个任务都有「交付物」和「验收命令」，**验收不过不许进入下一个任务**。
2. **一次只做一个任务**。做完 → 跑验收 → 在 `PROGRESS.md` 记一行（任务号 / 完成时间 / 验收结果）→ 再做下一个。
3. **不许猜需求**。本文件没写的行为，不要自行发明；确实缺信息时，在 `QUESTIONS.md` 记一条并停下等你确认。
4. **不许引入本文件 §2.3 黑名单里的依赖**，不许引入任何 AGPL / ELv2 / Sustainable Use 许可的包。
5. **不许把 SQL 写进 HTTP 路由**；不许跨模块直接读表；不许在业务代码里硬编码指标数字。
6. 每个任务结束必须：`pnpm typecheck && pnpm lint && pnpm test` 全绿，且当任务的验收命令通过。
7. 提交前自查 §11「禁止事项」清单。

---

## 1. 系统是什么（30 秒理解）

**一套 AI 运营系统：观察经营 → 诊断问题 → 产出可执行物 → 人审 → 执行 → 测量效果 → 学习。**

不是 ERP。六条判据（做任何功能前先过一遍）：

| # | 判据 | 不通过就不做 |
|---|---|---|
| 1 | 主语是**动作**（排品/开播/复盘/调预算/上架），不是单据 | 是"采购单/凭证/工单"就别做 |
| 2 | 产出**可执行物**（能入库、能审批、能被下游消费），不是报表 | 只产出报表就别做 |
| 3 | 有**闭环**：下一场/下周期自动验证效果 | 做完就结束就别做 |
| 4 | 数据围绕**人·货·场·钱·客** | 围绕会计科目/BOM 就别做 |
| 5 | **只装一个模块也能用** | 必须全模块一起上就别做 |
| 6 | 关掉 AI 后系统价值**显著下降** | 关掉 AI 没影响 = 你在做 ERP |

核心循环（任何功能都必须嵌进其中一环）：

```
① Observe 取数 → ② Diagnose 找差异 → ③ Propose 出草案 → ④ Approve 人审
→ ⑤ Apply 落对象 → ⑥ Measure 看效果 → ⑦ Learn 进评测 →（回到①）
```

---

## 1.5 目标客户：中小企业（这条决定所有取舍）

客户画像：年 GMV 500 万~5,000 万；1 个品牌、1~3 个店铺、1~2 个直播间、3~10 人团队；**没有专职数据/IT**；多数拿不到平台 API 资质，只有后台导出的 Excel；老板自己就是运营负责人。

| 约束 | 对系统的硬要求 | 反例（不要做） |
|---|---|---|
| 没有实施团队 | **30 分钟自助开通**：3 步向导（建店→传近 30 天 Excel→出首份复盘） | 需要接口对接、需要实施顾问 |
| 拿不到 API | **Excel/CSV 导入是主路径**，API 是增强；提供 6 套标准模板 | 假设客户已有开放平台授权 |
| 不会配流程 | 审批**默认关闭**（可一键开启），工作流只给 6 个预置模板，不做画布编辑器 | 让客户自己画 BPMN/配 DSL |
| 不懂技术术语 | 页面说人话（"这场为什么少卖 12 万"），不出现"漏斗归因/口径版本"等词；解释藏在一层之下 | 把内部指标名直接暴露 |
| 预算敏感 | 入门套餐月费低、按店铺+模块计费、试用 14 天；**无实施费** | 私有化部署、按调用量计价 |
| 人多设备杂 | 核心页面（待办/提词卡/告警/复盘）**手机可用**（响应式，≥375px） | 只做 1440px 桌面端 |
| 数据量小但客户多 | **多租户从第一天就要做**（RLS + 配额 + 限流），单租户数据量小、租户数量大 | 单租户架构、后期再改多租户 |
| AI 成本敏感 | 每租户 AI 预算上限（默认 ￥100/月），批量任务夜间跑，超限降级为"只取数不出结论" | 每租户无限调用 |

**由此确定的默认值**（写死，不提供配置项）：
- 默认安装模块：`connect,trade,planning,run,review,knowledge`；其余关闭。
- 默认审批：**关闭**（单人团队自审留痕）；人数 ≥3 时提示开启。
- 默认时区/币种：Asia/Shanghai + CNY；跨境客户在开号时选市场。
- 默认 AI 模型：国产低价模型；单次 60k token；每租户每月预算 ￥100。
- 默认数据保留：明细 24 个月，汇总永久；导出随时可用。

## 2. 技术栈与硬约束

### 2.1 栈（版本按此，不许换）

| 层 | 选型 |
|---|---|
| 语言/运行时 | TypeScript 5.x + Node 22（ESM） |
| 包管理 | pnpm 9+，workspace |
| 前端 | React 19 + Vite + Tailwind + shadcn/ui + TanStack Query + TanStack Router + ECharts |
| 后端 | Fastify 5 + Zod（类型提供者）+ `@fastify/cookie` + `@fastify/static` |
| 数据库 | PostgreSQL 16 + pgvector；**多租户（所有业务表 `tenant_id` + RLS）**；`pg` 驱动 + Drizzle（仅用于迁移与类型） |
| 队列/任务 | `pg-boss`（PostgreSQL 队列，不引入 Redis） |
| AI | Vercel AI SDK（`ai` 包）+ OpenAI 兼容网关（DeepSeek/Qwen 可切） |
| 可观测 | Pino 日志；Langfuse 可选（默认关闭） |
| 测试 | Vitest（单测/集成）+ Playwright（E2E，P1 起） |
| 运行环境 | docker compose（api / worker / db / web），**最多 6 个容器** |

### 2.2 目录结构（照此创建）

```
/home/leyova-next/
├ apps/
│  ├ api/            Fastify HTTP
│  ├ worker/         pg-boss 消费者（AI/同步/汇总/事件/工作流）
│  └ web/            React SPA
├ packages/
│  ├ kernel/         身份/指标/AI运行时/事件/模块/审批/编排/预警
│  ├ modules/        14 个业务模块（每个独立目录）
│  ├ contracts/      Zod schema（前后端共用）
│  └ metrics/        指标注册表（TS 常量 + 参数化 SQL 模板）
├ db/
│  ├ migrations/     <module>/NNN_desc.sql（只增不改）
│  └ seeds/          演示数据生成器
├ ops/               compose / 备份脚本 / 压测脚本
└ PROGRESS.md
```

### 2.3 黑名单（禁止引入）

Dify、FastGPT、n8n、Flowise、LangGraph（Python/JS 均不引入）、RAGFlow、OpenViking、Arize Phoenix、MinIO、Medusa/Saleor/Vendure 代码、Temporal、Camunda。
理由：许可证（AGPL/ELv2/Sustainable Use）、多容器、或多一套运行时。**只借思想，不引入代码。**

### 2.4 编码约定（强制）

- **分层**：`routes/`（解析→鉴权→调 domain→序列化）→ `domain/`（纯函数，无 IO）→ `repo/`（SQL，参数化）。**routes 里出现 `SELECT/INSERT/UPDATE/DELETE` 即视为失败。**
- **每个路由必须声明 `domain` tag**（用于 OpenAPI 分组与质量检查）。
- **错误响应统一**：`{ error: { code, message, details? }, trace_id }`。
- **成功响应统一**：`{ data, meta? }`，`meta` 里带 `caliber`（指标口径）与 `next_cursor`。
- **金额**：`numeric(18,4)`，JSON 里传字符串，带 `currency`。
- **时间**：DB 存 `timestamptz`（UTC），API 传 ISO8601。
- **ID**：`bigserial`；对外可暴露，不做混淆。
- **软删**：`deleted_at`；查询默认过滤。
- **幂等**：所有外部写入带唯一键；写接口支持 `Idempotency-Key`。
- **多租户**：所有业务表带 `tenant_id`，服务层强制 + RLS 兜底；**v1 就是多租户**，禁止任何"单租户假设"（如全局唯一键不带 tenant_id）。
- **配额与限流**：每租户每分钟 API 请求数、每日 AI 运行数、存储上限都要有默认值并在超限时返回 `429 QUOTA_EXCEEDED`。
- **移动端**：待办、提词卡、告警、复盘四个页面必须 375px 可用（不做独立 App）。
- **模块边界**：模块只能 import `kernel/*` 或对方 `public.ts`；**禁止跨模块外键，跨模块关系只写 `module_link`**。

### 2.5 12 条质量红线（上线前必须全过，写进 `pnpm verify`）

1. routes 层无 SQL（正则扫描）
2. 每个路由有 `domain` tag
3. 每个模块有 manifest（权限/导航/计量/agent/jobs）
4. 禁止跨模块 import（依赖图检查）
5. 禁止跨模块外键（迁移 SQL 扫描）
6. 迁移命名 `<module>/NNN_desc.sql`，只增不改
7. 代码里出现的指标 code 必须在注册表
8. Zod schema ↔ OpenAPI ↔ 前端类型 三者零 diff
9. AI 黄金集回归不低于基线（P1 起）
10. 依赖许可证白名单（禁止黑名单许可证）
11. 前端主包 <300KB gzip
12. 迁移在空库与有数据库两态各跑一次

---

## 3. 本地环境与命令（每步都要能跑）

### 3.1 环境变量（`.env`）

```bash
DATABASE_URL=postgresql://app:app@localhost:5432/leyova
SESSION_SECRET=<32字节随机>
ENCRYPTION_KEY=<32字节base64>
AI_PROVIDER_BASE_URL=https://api.deepseek.com
AI_PROVIDER_API_KEY=<key>
AI_MODEL_DEFAULT=deepseek-chat
AI_MAX_TOKENS_PER_RUN=60000
EMBEDDING_MODEL=bge-m3
EMBEDDING_DIM=1024
S3_ENDPOINT=            # 为空时用本地 ./data/files
FEATURE_DEFAULT_MODULES=connect,trade,planning,run,review,knowledge
LOG_LEVEL=info
```

### 3.2 命令

```bash
pnpm dev            # api + worker + web 同时起
pnpm db:migrate     # 跑所有迁移
pnpm db:seed        # 生成演示数据（固定种子）
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm test           # vitest
pnpm verify         # 12 条质量红线 + 单测
pnpm e2e            # playwright（P1 起）
```

### 3.3 启动验收（T0.1）

```bash
curl -s localhost:8788/health   # → {"data":{"ok":true}}
curl -s localhost:8788/ready    # → {"data":{"db":"ok"}}
curl -s localhost:5513/ | head  # → HTML
```

---

## 4. 数据模型（109 张表，按此建）

> 规则：内核 39 张、14 个模块 70 张。**不装的模块不建表**。
> 所有表默认带：`created_at timestamptz not null default now()`；业务表带 `updated_at`；软删表带 `deleted_at`；业务表带 `tenant_id bigint not null`。

### 4.1 内核（39 张）

| 表 | 列（除默认列外） |
|---|---|
| `tenant` | id, name, status |
| `legal_entity` | id, tenant_id, name, country, tax_id, currency |
| `app_user` | id, tenant_id, email unique, password_hash, status, last_login_at |
| `role` | id, code unique, name, is_system |
| `user_role` | user_id, role_id, scope_type, scope_id, pk(user_id,role_id,scope_type,scope_id) |
| `staff_assignment` | id, tenant_id, user_id, object_type, object_id, starts_at, ends_at |
| `product` | id, tenant_id, title, brand_id, category_l1/l2/l3, status |
| `sku` | id, tenant_id, product_id, sku_code, barcode, spec_json jsonb, weight_g |
| `metric_definition` | code, caliber_version, name, unit, formula_sql, effective_from, source_url, dims_allowed text[], maturity_required, owner, pk(code,caliber_version) |
| `metric_dimension` | metric_code, dim_code, allowed_values_json, pk(metric_code,dim_code) |
| `source_registry` | code pk, type, latency, reliability, notes |
| `data_maturity` | metric_code, period, stage, value_json, pk(metric_code,period,stage) |
| `ai_agent` | code pk, name, module_id, model, tools_json, prompt_version, guardrails_json, status |
| `ai_run` | id, tenant_id, agent_code, module_id, trigger, subject_type, subject_id, status, cost_tokens, started_at, ended_at |
| `ai_step` | id, run_id, seq, type, input_json, output_json, latency_ms, error, unique(run_id,seq) |
| `ai_evidence` | id, run_id, step_id, source_type, source_ref, metric_code, value_json, fetched_at, hash |
| `ai_claim` | id, run_id, claim_text, evidence_refs bigint[], verdict, checked_numbers, matched, unmatched jsonb |
| `ai_artifact` | id, tenant_id, module_id, artifact_type, subject_type, subject_id, payload jsonb, schema_version, caliber_version jsonb, evidence_refs bigint[], checks jsonb, confidence numeric(4,3), state, created_by_run_id, approved_by, approved_at, applied_action_id, measured_at, outcome jsonb, superseded_by |
| `ai_action` | id, tenant_id, artifact_id, action_type, target_type, target_id, params_json, before_json, after_json, approval_status, executed_at, result_json, rollback_of |
| `domain_event` | id, tenant_id, event_type, version, aggregate_type, aggregate_id, occurred_at, idempotency_key, payload_json, trace_id, unique(tenant_id,idempotency_key) |
| `audit_log` | id, tenant_id, actor_id, action, object_type, object_id, before_json, after_json, trace_id, at |
| `metric_snapshot` | id, tenant_id, run_id, metric_code, at, value, source, latency_s |
| `module_link` | id, tenant_id, from_module, from_type, from_id, to_module, to_type, to_id, metadata_json |
| `module_manifest` | module_id pk, version, installed_at, min_kernel |
| `entitlement` | id, tenant_id, module_id, source, status, valid_from, valid_to, limits_json, unique(tenant_id,module_id) |
| `plan` | id, code, name, billing_cycle |
| `plan_module` | plan_id, module_id, price, metric, limit_value |
| `subscription` | id, tenant_id, plan_id, status, period_start, period_end |
| `feature_flag` | key, tenant_id, value_json, updated_by, pk(key,tenant_id) |
| `usage_meter` | tenant_id, module_id, metric, period, qty, pk(tenant_id,module_id,metric,period) |
| `alert_rule` | id, tenant_id, module_id, code, metric_code, condition_json, window_s, severity, cooldown_s, owner_role, enabled |
| `alert_event` | id, tenant_id, rule_id, subject_type, subject_id, value, baseline, severity, status, dedup_key unique, triggered_at, resolved_at |
| `alert_delivery` | id, event_id, channel, target, sent_at, result |
| `approval_policy` | id, tenant_id, module_id, target_type, condition_json, approver_roles text[], mode, sla_hours, escalate_to |
| `approval_request` | id, tenant_id, policy_id, artifact_id, action_id, status, current_step, due_at |
| `approval_decision` | id, request_id, step_no, approver_id, decision, comment, decided_at, unique(request_id,step_no,approver_id) |
| `workflow_definition` | id, tenant_id, code, version, module_id, trigger_type, dsl_json, status, unique(tenant_id,code,version) |
| `workflow_instance` | id, tenant_id, definition_id, version, subject_type, subject_id, status, current_step, context_json, started_at, ended_at |
| `workflow_step` | id, instance_id, seq, type, ref, status, attempts, input_json, output_json, error, unique(instance_id,seq) |

### 4.2 模块表（70 张）

| 模块 | 表 → 关键列 |
|---|---|
| `connect`(5) | `connector`(id, code, type, config_json, status) `sync_job`(id, connector_id, status, stats_json) `staging_record`(id, source, business_key, payload_json, fingerprint, status) `column_mapping`(id, source, mapping_json) `data_quality_issue`(id, source, rule, severity, detail_json, status) |
| `trade`(6) | `order`(id, channel_id, external_id, buyer_hash, amount_order, amount_paid, amount_settle, currency, status, placed_at) `order_line`(id, order_id, sku_id, qty, unit_price, discount, amount_paid, refund_qty) `order_event`(id, order_id, event_type, occurred_at, payload_json, idem_key) `fulfillment`(id, order_id, waybill_no, carrier, shipped_at, first_scan_at, delivered_at, promise_hours) `refund_case`(id, order_id, type, reason_code, amount, status, attributed_sku_id, attributed_run_id) `after_sale_ticket`(id, refund_case_id, assignee, sla_hours, status, resolution) |
| `live_planning`(6) | `channel_listing`(id, channel_id, sku_id, external_id, title, bullets_json, images_json, visibility, language, status) `price_list`(id, market, currency, tax_included, valid_from, valid_to) `price_list_item`(id, price_list_id, sku_id, list_price, sale_price) `run_plan`(id, room_id, plan_date, status, version) `run_plan_slot`(id, plan_id, round_no, seq_no, sku_id, slot_role, planned_minutes, live_price, mechanism_json, script_version_id) `qualification`(id, sku_id, type, cert_no, issuer, valid_from, valid_to, file_key) |
| `live_run`(5) | `live_run`(id, store_id, channel_id, room_id, run_type, status, planned_start, actual_start, actual_end) `run_slot`(id, run_id, plan_slot_id, round_no, seq_no, sku_id, slot_role, planned_start, planned_minutes, live_price, mechanism_json) `cue`(id, run_id, at_offset_sec, action_type, payload_json, executed_at, result) `script_version`(id, sku_id, version, sections_json, banned_word_check, status) `run_checklist`(id, run_id, item, result, checked_by, checked_at) |
| `live_review`(5) | `run_report`(id, run_id, headline, attribution_json, funnel_json, caliber_json, published_at) `funnel_snapshot`(id, run_id, step, value, drop_rate) `slot_result`(id, run_slot_id, ctr, pay_cnt, gmv_pay, gmv_settle, refund_rate, gpm, slot_output) `refund_attribution`(id, run_id, sku_id, amount, reason_code) `action_item`(id, run_id, who, what, due_at, verify_rule, status) |
| `media`(5) | `ad_campaign`(id, channel_id, external_id, objective, budget, bid_strategy, status) `ad_spend`(id, campaign_id, biz_date, spend, impressions, clicks, conversions, gmv_attributed, source) `ad_action`(id, artifact_id, campaign_id, op, from_value, to_value, approval_status, applied_at) `creative`(id, campaign_id, name, tags_json, file_key) `budget_guard`(id, scope_type, scope_id, limit_amount, window_s, action) |
| `content`(5) | `content_authorization`(id, source_type, source_id, scope, valid_to, evidence_key) `content_clip`(id, run_id, authorization_id, start_s, end_s, hook, status, file_key) `publish_record`(id, clip_id, account_id, platform_item_id, published_at, metrics_json) `matrix_account`(id, channel_id, name, status) `clip_metric`(id, clip_id, views, ctr, orders, gmv) |
| `crossborder_listing`(5) | `market_rule`(id, market, rule_code, value_json, effective_from, source_url) `compliance_file`(id, sku_id, market, type, number, valid_to, file_key, status) `listing_draft`(id, sku_id, market, language, title, bullets_json, compliance_json, status) `listing_publication`(id, draft_id, external_id, published_at, status) `market_sku`(id, sku_id, market, hs_code, declared_value, currency) |
| `crossborder_fulfill`(5) | `inbound_shipment`(id, sku_id, qty, mode, eta, status, costs_json) `stock_location`(id, name, type, country) `stock_level`(id, sku_id, location_id, stocked_qty, reserved_qty, available_qty generated) `reservation`(id, sku_id, ref_type, ref_id, qty, expires_at, status) `platform_clock`(id, channel_id, rule_code, deadline_hours, source_url, effective_from) |
| `crossborder_settle`(5) | `settlement_batch`(id, channel_id, period_start, period_end, currency, total_amount, file_key, status) `settlement_line`(id, batch_id, type, order_id, amount, sign) `cash_receipt`(id, batch_id, received_at, amount, fx_rate, account) `fx_rate`(id, base, quote, rate, rate_date, source) `pnl_snapshot`(id, scope_type, scope_id, period, revenue, refund, cogs, ad, commission, fulfillment, tax, fx_loss, penalty, net_profit) |
| `inventory`(4) | `stock_item`(id, sku_id, location_id, on_hand, safety, updated_at) `stock_move`(id, sku_id, qty, type, ref_type, ref_id, occurred_at) `stock_alert`(id, sku_id, type, threshold, status) `stock_count`(id, location_id, status, result_json) |
| `creator`(4) | `creator`(id, name, platform, category_tags, level) `cooperation`(id, creator_id, sku_id, fee, commission_rate, status) `sample`(id, cooperation_id, sent_at, received_at) `commission_settlement`(id, cooperation_id, base_gmv, rate, amount, period, status) |
| `service`(4) | `conversation`(id, channel_id, buyer_hash, intent, first_response_s, resolved_by, satisfaction) `ticket`(id, conversation_id, type, sla_hours, status, assignee) `review`(id, sku_id, rating, content, sentiment, topics_json) `experience_score`(id, store_id, metric_code, value, caliber_version, period, source_url) |
| `knowledge`(6) | `kb_space`(id, name, scope_type, scope_id, classification) `kb_document`(id, space_id, title, source_type, doc_type, market, effective_from, effective_to, status) `kb_document_version`(id, document_id, version_no, file_key, parsed_key, checksum, status) `kb_chunk`(id, version_id, seq, heading_path, page_from, page_to, text, embedding vector(1024), ts tsvector, embedding_version) `kb_ingest_job`(id, document_id, stage, status, error) `kb_query_log`(id, query, chunk_ids bigint[], run_id, feedback) |

### 4.3 关键表 DDL（风格基准，其余按同风格写）

```sql
CREATE TABLE ai_artifact (
  id bigserial PRIMARY KEY,
  tenant_id bigint NOT NULL,
  module_id text NOT NULL,
  artifact_type text NOT NULL,
  subject_type text NOT NULL,
  subject_id bigint NOT NULL,
  payload jsonb NOT NULL,
  schema_version int NOT NULL DEFAULT 1,
  caliber_version jsonb NOT NULL DEFAULT '{}',
  evidence_refs bigint[] NOT NULL DEFAULT '{}',
  checks jsonb NOT NULL DEFAULT '[]',
  confidence numeric(4,3),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN
    ('draft','pending_review','approved','rejected','applied','measured','closed','rolled_back','expired','superseded')),
  created_by_run_id bigint, approved_by bigint, approved_at timestamptz,
  applied_action_id bigint, measured_at timestamptz, outcome jsonb,
  superseded_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_artifact (tenant_id, module_id, state);
CREATE INDEX ON ai_artifact (subject_type, subject_id);

CREATE TABLE order (
  id bigserial PRIMARY KEY,
  tenant_id bigint NOT NULL,
  channel_id bigint NOT NULL,
  market text NOT NULL DEFAULT 'CN',
  external_id text NOT NULL,
  buyer_hash text,
  amount_order numeric(18,4) NOT NULL DEFAULT 0,
  amount_paid  numeric(18,4) NOT NULL DEFAULT 0,
  amount_settle numeric(18,4) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'CNY',
  status text NOT NULL,
  placed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, channel_id, external_id)
) PARTITION BY RANGE (placed_at);

CREATE TABLE metric_definition (
  code text NOT NULL,
  caliber_version text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  formula_sql text NOT NULL,
  effective_from date NOT NULL,
  source_url text,
  dims_allowed text[] NOT NULL DEFAULT '{}',
  maturity_required text,
  owner text,
  PRIMARY KEY (code, caliber_version)
);

CREATE TABLE domain_event (
  id bigserial,
  tenant_id bigint NOT NULL,
  event_type text NOT NULL,
  version int NOT NULL DEFAULT 1,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  idempotency_key text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}',
  trace_id text,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
```

### 4.4 分区与索引规则

- 按月分区：`order`、`order_line`、`settlement_line`、`domain_event`、`ai_evidence`、`ai_step`、`metric_snapshot`；**索引一律以 `tenant_id` 打头**。
- 容量口径（多租户合计）：按 1,000 个 SME 租户、平均每户 5 万单/年测算，3 年约 **1.5 亿行 / 300 GB**；单租户数据量很小，压力来自租户数量与聚合查询。
- 分区脚本：自动建未来 3 个月、删 13 个月前；**禁止手工建月表**。
- 时间列用 BRIN；业务键 `(tenant_id, xxx)` 用 B-tree；禁止低基数列单列索引。
- 看板查询只读 `agg_*` 汇总表（`agg_trade_day`/`agg_run_summary`/`agg_sku_day`/`agg_pnl_period`）。

---

## 5. 指标注册表（T0.4 要种进去的 27 个指标）

| code | 名称 | 公式 | 口径 | 成熟度 |
|---|---|---|---|---|
| `gmv_order` | 下单 GMV | Σ amount_order | 含未付 | T+0 |
| `gmv_pay` | 支付 GMV | Σ amount_paid | 含退款 | T+0 |
| `gmv_settle` | 结算 GMV | Σ amount_settle | 平台结算 | T+15 |
| `refund_rate` | 退款率 | refund/paid | 仅退/退货/品质 | T+15 |
| `quality_return_rate` | 品质退货率 | 品质+物流退货/支付单 | 平台考核 | T+15 |
| `aov_pay` | 客单价 | gmv_pay/支付订单数 | 支付 | T+0 |
| `uv_value` | UV 价值 | gmv/观看 UV | 人数 | T+1 |
| `gpm` | 千次观看成交 | gmv/观看人次×1000 | 官方 | T+1 |
| `avg_stay` | 平均停留 | 时长/人次 | 官方 | T+1 |
| `ctr_item` | 商品点击率 | 点击人数/曝光人数 | 直播商品卡 | T+1 |
| `cvr_run` | 场次转化率 | 支付单/观看人数 | 人数 | T+1 |
| `slot_output` | 坑产 | 单品 GMV/讲解分钟 | 支付 | T+15 |
| `attach_rate` | 连带率 | 件数/订单数 | 支付 | T+1 |
| `ad_spend` | 消耗 | Σ spend | 含服务费 | T+1 |
| `roi_pay` | 支付 ROI | gmv_pay/spend | — | T+1 |
| `roi_settle` | 结算 ROI | gmv_settle/spend | — | T+15 |
| `roi_blended` | 综合营销 ROI | gmv_settle/(spend+佣金+坑位) | — | T+15 |
| `experience_score` | 体验分 | 平台加权 | 5 分制/90 天 与 百分制/30 天 两个版本 | T+1 |
| `ship_sla` | 发货时效 | 支付→上传单号 | 承诺取最短 | T+1 |
| `pickup_sla` | 揽收时效 | 上传→首条揽件 | 24h | T+1 |
| `live_duration` | 有效直播时长 | 开播→下播（剔除挂机） | 平台判定 | T+1 |
| `commission_base` | 提成基数 | 支付/结算/毛利 | 按合同三选一 | T+15 |
| `landed_cost` | 到岸成本 | 货值+头程+关税+仓储 | 跨境 | T+15 |
| `cm3` | 单位经济 | gmv_settle-所有变动成本 | 跨境 | T+15 |
| `fx_loss` | 汇损 | 结算汇率差 | 跨境 | T+15 |
| `penalty_rate` | 罚金率 | 罚金/gmv | 跨境 | T+15 |
| `inventory_days` | 库存周转天数 | 平均库存/日均销 | 跨境 | T+1 |

**规则**：每个指标必须有 `caliber_version`；API 返回必须带 `caliber`；未注册的 code 在代码里出现即质量红线失败。

---

## 5A. AI 运行时契约（所有 Agent 共用，先读再用）

### 5A.1 状态机（artifact 唯一合法流转）

```
draft → pending_review → approved → applied → measured → closed
  │            │                         │
  │            └→ expired（超时未审）      └→ rolled_back
  └→ rejected / superseded
```

### 5A.2 工具（LLM 只能看到这 7 个 + 2 个可选）

| 工具 | 入参 | 返回 | 权限 |
|---|---|---|---|
| `list_metrics` | `{domain?}` | 指标列表 | 已授权模块 |
| `describe_metric` | `{code}` | 定义/公式/口径/成熟度/维度 | 同上 |
| `run_metric` | `{code,dims,filters,from,to}` | `{value,series?,caliber,source,maturity}` | 同上 |
| `get_object` | `{type,id}` | 对象摘要（按数据范围裁剪） | 数据范围 |
| `list_objects` | `{type,filters,limit≤50}` | 列表 | 同上 |
| `create_draft` | `{artifact_type,subject,payload,evidence_refs}` | artifact id | artifact 类型授权 |
| `apply_action` | `{artifact_id,action_type,params}` | action id | 必须已审批 |
| `check_compliance`* | `{sku_id,market}` | `{pass,missing[],source_urls[]}` | 只读 |
| `search_knowledge`* | `{query,scope,as_of}` | 片段 + 引用 | 只读 |

\* 仅当模块 `crossborder_listing` / `knowledge` 已授权时可用。

### 5A.3 五个 Agent 的输出契约（payload 必须长这样）

```jsonc
// 1) planning_agent → run_plan_draft
{ "type":"run_plan_draft",
  "slots":[{"seq":1,"sku":"SKU-1","role":"traffic|benefit|hero|profit","minutes":6,
            "price":39.9,"mechanism":"限时秒杀","reason":"...","evidence":["ev_1"]}],
  "checks":[{"rule":"qualification_valid","pass":true}],
  "caliber":{"gmv":"gmv_pay@v1","maturity":"T+15"},"confidence":0.72 }

// 2) review_agent → run_report + action_item
{ "type":"run_report","headline":"...","attribution":[
    {"stage":"traffic|funnel|slots|anchor|refund","delta":-106000,"share":0.86,"evidence":["ev_1"]}],
  "funnel":[{"step":"exposure","value":10726}],
  "actions":[{"who":"media_buyer","what":"...","when":"...","verify":"..."}] }

// 3) media_agent → ad_action
{ "type":"ad_action","actions":[{"campaign_id":"C-1","op":"budget|pause|creative",
    "from":2000,"to":2600,"reason":"...","expect":"...","risk":"..."}],
  "guards":{"max_delta_pct":30,"settlement_maturity":"T+15"} }

// 4) content_agent → clip_list
{ "type":"clip_list","clips":[{"source_run":1,"start":1240,"end":1305,"hook":"价格对比",
    "authorization_id":42,"reason":"...","risk":"..."}] }

// 5) listing_agent → listing_draft
{ "type":"listing_draft","market":"US","language":"en","title":"...","bullets":["..."],
  "compliance":[{"rule":"GPSR","pass":false,"missing":["EU responsible person"]}] }
```

### 5A.4 Critic 算法（不接受"看起来对"的数字）

1. 从 claim 文本抽取所有数字（正则 + 同 schema 字段）。
2. 每个数字必须映射到某条 `ai_evidence` 的 `(metric_code, dims, period)`。
3. 容差：金额 ±0.5%，比率 ±0.05pp，计数 0。
4. 全匹配 → `verified`；部分 → `insufficient`；不匹配 → `rejected`（**不生成 artifact**）。
5. `rejected` 时把不匹配项写入 `ai_claim.unmatched`。

### 5A.5 运行与成本

- 每次运行必须落 `ai_run/ai_step/ai_evidence/ai_claim`；**没有 llm_call 记录 = 视为未实现**（旧系统教训）。
- 单次 token 上限 60k；超限 → 降级为"只取数不出结论"。
- 所有工具调用参数要过 Zod；非法参数直接失败并记 `ai_step.error`。

## 6. 任务总表

| 阶段 | 任务 | 人天 | 完成标志 |
|---|---|---:|---|
| P0 内核 | T0.1 ~ T0.9 | 18 | 空系统可启动、权限生效、指标可查、AI 骨架能跑、模块可开关、演示数据可重建 |
| P1 直播基础 | T1.0 ~ T1.8 | 46 | 演示数据跑通「排品→开场→复盘→行动项→下场排品」，两个 Agent 可采纳 |
| P2 直播专业 | T2.1 ~ T2.4 | 26 | 场中告警、投放调整单、切片授权、两个 Agent |
| P3 跨境 | T3.1 ~ T3.4 | 30 | 合规阻断→listing→履约时钟→结算对账→单品 P&L |
| P4 增值 | T4.1 ~ T4.4 | 23 | 库存/达人/客服三个可选包 + 授权计费 |
| P5 规模化 | T5.1 ~ T5.3 | 18 | TikTok/Amazon API + 1.5 亿行压测 |
| **合计** | T0.1 ~ T5.3 | **161** | 42 条验收 + 4 条 SME 体验用例全绿 |

---

## 7. P0 内核任务（18 人天）

### T0.1 系统骨架与运行环境（1 人天）

**交付物**
- `pnpm-workspace.yaml`、根 `package.json`（scripts: dev/build/typecheck/lint/test/verify/db:migrate/db:seed）
- `apps/api`：Fastify 5，`GET /health`、`GET /ready`（查 DB）
- `apps/worker`：pg-boss 启动，消费一个 `noop` 队列
- `apps/web`：Vite + React 19 + Tailwind + Router（只放一个空壳首页）
- `ops/docker-compose.yml`：`db`(postgres:16 + pgvector) / `api` / `worker` / `web`
- `PROGRESS.md`（空表）

**验收**
```bash
docker compose -f ops/docker-compose.yml up -d db
pnpm dev &
curl -sf localhost:8788/health   # {"data":{"ok":true}}
curl -sf localhost:8788/ready    # {"data":{"db":"ok"}}
curl -sf localhost:5513/ >/dev/null && echo web-ok
```

### T0.2 数据结构基线（3 人天）

**交付物**
- `db/migrations/000_core/001_init.sql`：37 张内核表 + `audit_log` + 4 张 `agg_*` + 分区初始化函数
- `db/migrations/000_core/002_partitions.sql`：`ensure_partitions()`（建未来 3 个月、删 13 个月前）
- `packages/kernel/db.ts`：连接池（`max=20`）+ 事务封装 `withTx()`
- `db/migrate.ts`：按目录顺序执行、记录 `schema_migrations`

**验收**
```bash
pnpm db:migrate                 # 空库跑通
pnpm db:migrate                 # 再跑一次：无变化、不报错
psql $DATABASE_URL -c "\dt" | wc -l    # ≥ 42（37 内核 + audit + 4 汇总）
psql $DATABASE_URL -c "select ensure_partitions()"  # 生成未来 3 个月分区
```

### T0.3 认证、三维权限与审计（2 人天）

**交付物**
- `packages/kernel/auth/`：Argon2id 密码、HttpOnly Cookie 会话（12h 滑动）、登录失败 5 次锁 15 分钟
- `identity.can(user, action, object)`：岗位 × 数据范围（tenant/brand/store/self）× 对象状态
- 中间件顺序：`auth → tenant → module guard → scope → object state`
- `audit_log` 写入封装：`audit.record(actor, action, object, before, after, traceId)`
- 接口：`POST /api/v1/auth/login`、`POST /auth/logout`、`GET /me`、`GET /me/todo`（v1 返回空列表）

**验收**
```bash
curl -c c.txt -X POST localhost:8788/api/v1/auth/login \
  -H 'content-type: application/json' -d '{"email":"admin@local","password":"Admin@123456"}'
# → 200 + set-cookie
curl -b c.txt localhost:8788/api/v1/me            # → 当前用户
curl localhost:8788/api/v1/me                     # → 401 UNAUTHENTICATED
psql $DATABASE_URL -c "select count(*) from audit_log"  # ≥1（登录记审计）
```

### T0.4 指标注册表与查询（2 人天）

**交付物**
- `packages/metrics/registry.ts`：27 个指标常量（code/name/unit/formula/dims/maturity/caliber）
- `packages/metrics/sql.ts`：参数化模板（白名单维度 + 时间宏），**不接受任意 SQL**
- `db/seeds/010_metrics.sql`：写入 `metric_definition` / `metric_dimension`
- API：`GET /metrics`、`GET /metrics/{code}`、`POST /metrics/{code}/query`
  - 请求：`{dims:["run_id"],filters:{from,to,channel_id?},grain:"day"}`
  - 响应：`{data:[...],meta:{caliber:{code,version},maturity,source}}`

**验收**
```bash
curl -s -b c.txt localhost:8788/api/v1/metrics | jq '.data|length'   # 27
curl -s -b c.txt -X POST localhost:8788/api/v1/metrics/gmv_pay/query \
  -H 'content-type: application/json' \
  -d '{"dims":["biz_date"],"filters":{"from":"2026-11-01","to":"2026-11-16"}}' | jq '.meta.caliber'
# → {"code":"gmv_pay","version":"v1"}
curl -s -b c.txt -X POST localhost:8788/api/v1/metrics/gmv_pay/query \
  -d '{"dims":["drop table"]}' -H 'content-type: application/json'   # → 422 VALIDATION_FAILED
```

### T0.5 领域事件与 outbox（2 人天）

**交付物**
- `packages/kernel/events/`：`publish(event, tx)` 写 `domain_event`（同事务）、worker 投递、订阅注册表
- 幂等：`unique(tenant_id, idempotency_key)`；重复直接跳过
- 死信：连续失败 3 次进 `domain_event_failed`（或 `status='dead'` 列）
- worker：`event-dispatch` 队列，并发 10

**验收**
```bash
# 测试脚本触发两次同 idempotency_key 事件
pnpm test -- events
# 断言：domain_event 只有 1 行；订阅者只被调用 1 次
```

### T0.6 AI 运行时骨架（2 人天）

**交付物**
- 表：`ai_agent/ai_run/ai_step/ai_evidence/ai_claim/ai_artifact/ai_action`（T0.2 已建）
- `packages/kernel/ai/executor.ts`：`runAgent(code, subject, input)` → 依次 scope→observe→plan→act→verify→propose
- `critic.ts`：数字校验（金额 ±0.5%、比率 ±0.05pp、计数 0）；不一致 → `verdict=rejected`
- 工具注册：`list_metrics/describe_metric/run_metric/get_object/list_objects/create_draft/apply_action`（apply_action 未审批即 428）
- 一个 `echo_agent`：不做业务，只验证链路；`POST /ai/runs` 触发，`GET /ai/runs/{id}` 查

**验收**
```bash
curl -s -b c.txt -X POST localhost:8788/api/v1/ai/runs \
  -H 'content-type: application/json' -d '{"agent":"echo_agent","subject":{"type":"test","id":1}}'
# → {run_id, status:"succeeded"}
psql $DATABASE_URL -c "select type,count(*) from ai_step group by 1"   # 有 plan/verify 记录
# 篡改 evidence 后再跑：verdict=rejected，artifact 不生成
```

### T0.7 模块运行时（2 人天）

**交付物**
- `packages/kernel/module/`：manifest 类型、加载器、`entitlement` 校验、`feature_flag`、`moduleGuard`
- 每个路由声明 `module`；未授权 → `403 MODULE_NOT_LICENSED`（不是 404）
- `GET /nav` 只返回已授权模块菜单
- `GET /system/modules`、`POST /system/modules/{id}/entitle`、`POST /system/modules/{id}/disable`

**验收**
```bash
curl -b c.txt localhost:8788/api/v1/nav | jq '.data[].id'      # 只含默认 6 个
curl -b c.txt -X POST localhost:8788/api/v1/system/modules/trade/disable
curl -b c.txt localhost:8788/api/v1/trade/orders               # → 403 MODULE_NOT_LICENSED
curl -b c.txt localhost:8788/api/v1/nav | jq '.data[].id'      # trade 消失
```

### T0.8 演示数据生成器（1 人天）

**交付物**
- `db/seeds/generate.ts`：固定种子 `20261116`，可 `--scale=small|normal`
- 生成：1 租户 / 2 主体 / 21 店铺 / 6 市场 / 120 SKU / 90 天约 300 场 / 40 万单 / 300 投放计划 / 6 期结算 / 80 篇知识库文档
- **埋雷**：10 个高退款低毛利 SKU、3 场"流量跌 20% 转化持平"、2 个资质将过期 SKU、1 个毛利为负 SKU

**验收**
```bash
pnpm db:seed --seed=20261116
psql $DATABASE_URL -c "select count(*) from \"order\""      # ≈400000
psql $DATABASE_URL -c "select count(*) from sku"            # 120
# 两次 seed 结果一致（同种子同数据）
```

### T0.9 多租户隔离、配额与限流（3 人天）

**交付物**
- 每张业务表启用 RLS（策略：`tenant_id = current_setting('app.tenant_id')::bigint`），连接池每次取连接时 `SET app.tenant_id`
- 租户配额表 `tenant_quota`（API 每分钟、AI 每日次数、存储 MB、SKU 上限）
- 中间件：`rateLimit(tenant)` → 超限 `429 QUOTA_EXCEEDED`（带 `retry_after`）
- `POST /system/tenants`（开号）、`POST /system/tenants/{id}/suspend`（停号，数据保留）
- 数据导出：`GET /system/tenants/{id}/export`（JSONL 打包，异步任务）

**验收**
```bash
# 造两个租户 A/B，用 A 的会话访问 B 的数据 → 0 行（RLS 生效）
pnpm test -- tenant-isolation
# 单租户每分钟 >600 请求 → 429
# 停号后登录 → 403 TENANT_SUSPENDED；数据仍在
```

---

## 8. P1 直播基础版任务（46 人天）

### T1.0 开箱引导与模板（3 人天）

**交付物**
- 3 步向导 `/onboarding`：① 建店（平台/店铺名/时区）② 传近 30 天 Excel（场次/订单/投放，可只传一类）③ 生成首份复盘（无需 AI 也能出基础版）
- 6 套 Excel 模板（抖店/快手/视频号/淘宝/小红书/通用）+ 模板下载
- 一键加载"示例品牌"（可随时清空），让客户在没数据时也能看到完整界面
- 引导完成后落到 `/`（今日待办），并生成 3 条"下一步建议"

**验收**
```bash
# 新租户从 0 到出首份复盘 ≤30 分钟（用示例数据 3 分钟内）
pnpm e2e --project=onboarding
# 只传订单、不传场次 → 仍能出"店铺维度"复盘（降级但可用）
```

### T1.1 connect 数据接入（6 人天）

**交付物**
- 上传：`POST /connect/upload`（multipart；文件指纹 SHA256 幂等）
- 列映射：`GET/POST /connect/mappings`（Excel 表头 → 字段）
- 三类模板：场次、订单、投放；解析 → `staging_record` → 门禁 → 业务表
- 门禁：必填、金额非负、时间连续、重复检测、币种/时区归一
- 质量：`GET /connect/quality` 返回未通过记录

**验收**
```bash
curl -b c.txt -F file=@fixtures/orders.xlsx localhost:8788/api/v1/connect/upload
# 同一文件再传一次 → 200 且 imported=0（幂等）
curl -b c.txt localhost:8788/api/v1/connect/quality | jq '.data|length'
# 坏文件（缺金额列）→ 422 + 逐行列明错误
```

### T1.2 trade 交易与售后（6 人天）

**交付物**
- 订单：`GET /trade/orders`（游标分页、按平台/状态/时间过滤）、`GET /trade/orders/{id}`
- 事件：`order.paid/shipped/refunded`；`order_event` 幂等
- 退款：`GET /trade/refunds`、`POST /trade/refunds/{id}/decide`（归因到 sku/run）
- 履约：`POST /trade/orders/{id}/ship`（写 fulfillment + 事件）
- 状态机：只允许合法转移，非法 → 409 `CONFLICT_STATE`

**验收**
```bash
curl -b c.txt "localhost:8788/api/v1/trade/orders?limit=5" | jq '.data|length'   # 5
# 同一回调两次 → 订单不重复
pnpm test -- trade        # 状态机 + 幂等 + 三口径
```

### T1.3 live_planning 货盘与排品（8 人天）

**交付物**
- 商品/SKU/资质/价目：CRUD + `GET /planning/candidates`
- 排品表：`GET/POST /planning/plans`、`GET/POST /planning/plans/{id}/slots`（6 组字段）
- 硬闸门（服务端强制，不通过 422）：资质过期、毛利为负、库存<安全线、价格<成本、重复 SKU
- 发布：`POST /planning/plans/{id}/publish` → 版本 +1、发 `plan.published`
- 页面：排品表可拖拽排序、按货盘四层分组、显示闸门提示

**验收**
```bash
# 造 30 个 SKU + 库存 + 历史 → 10 分钟内产出完整排品表
curl -b c.txt -X POST localhost:8788/api/v1/planning/plans -d '{...}' | jq '.data.id'
# 放入毛利为负的 SKU → 422 且 details 指明 rule=margin_positive
# 发布后 GET /planning/plans/{id} 有 version+1 与 published_at
```

### T1.4 live_run 场次编排（6 人天）

**交付物**
- `POST /run/runs`（从 plan 生成，含全部 slot 与 cue）
- `POST /run/runs/{id}/start|end`；`GET /run/runs/{id}`
- `POST /run/runs/{id}/cues/{cid}/execute`（记录 before/after，可回滚）
- 提词卡：`GET /run/runs/{id}/slots`（品序/机制/话术/倒计时）
- 自检：`run_checklist` 四项；未过自检开播 → 409

**验收**
```bash
curl -b c.txt -X POST localhost:8788/api/v1/run/runs -d '{"plan_id":1}' | jq '.data.id'
curl -b c.txt -X POST localhost:8788/api/v1/run/runs/1/start   # 未自检 → 409
# 自检后再 start → 200；end 后发 run.finished 事件
```

### T1.5 live_review 复盘与行动项（7 人天）

**交付物**
- `POST /review/runs/{id}/report/generate`（调 review_agent；无 Agent 时先返回 501）
- `GET /review/runs/{id}/report`（五段归因 + 漏斗 + 坑产 + 证据引用）
- `GET /review/compare?ids=`（多场对比）
- 行动项：`GET/POST /review/action-items`、`PATCH /review/action-items/{id}`
- 成熟度：报告标注 T+1/T+15/T+30

**验收**
```bash
# 造一场"流量跌 20%、转化持平" → 归因第一位必须是 traffic，占比 >70%
pnpm test -- review-attribution
# 归因分解之和 = 支付 GMV 差额（±1%），否则 422
```

### T1.6 审批与工作流 v0（5 人天）

**交付物**
- `approval_policy`/`approval_request`/`approval_decision`：金额分级、any/all/seq、SLA、升级
- `GET /approvals`、`POST /approvals/{id}/decide`
- `workflow_definition/instance/step`：DSL 五种步骤（agent/approval/action/timer/webhook）
- `POST /workflows/{id}/start`、`GET /workflows/instances/{id}`
- 两条流程：`plan_publish`、`report_publish`
- **小团队模式（默认）**：审批关闭，发布即生效但写审计（`approved_by=self`）；租户人数 ≥3 时在设置页提示开启分级审批
- 待办中心数据源：`GET /me/todo` 合并 artifact 审批 + 流程任务 + 预警确认

**验收**
```bash
# 排品发布（影响 8 万）→ 生成 2 级审批
curl -b c.txt -X POST localhost:8788/api/v1/planning/plans/1/publish   # 428 APPROVAL_REQUIRED
curl -b c.txt -X POST localhost:8788/api/v1/approvals/1/decide -d '{"decision":"approve"}'
# 一级通过后 current_step=2；越级审批 → 403
# kill worker 后重启 → 实例从当前 step 继续，已完成步骤不重复
```

### T1.7 两个 Agent + 黄金集（3 人天）

**交付物**
- `planning_agent`：输入 run_date/room/target；输出 `run_plan_draft`（6 组字段 + 理由 + evidence）
- `review_agent`：输入 run_id；输出 `run_report` + `action_item`
- 黄金集：`evals/planning/*.json` 30 例、`evals/review/*.json` 30 例（含埋雷）
- 评测命令：`pnpm eval --agent=planning|review`，输出数字准确性/采纳率/证据完备率

**验收**
```bash
pnpm eval --agent=review
# 数字准确性 ≥95%；证据完备率 100%；rejected 的用例必须给出 unmatched 数字
```

### T1.8 直播闭环 E2E（2 人天）

**交付物**
- Playwright：登录 → 排品 → 发布审批 → 开场 → 录结果 → 复盘 → 采纳行动项 → 下场排品
- 演示脚本 `ops/demo/live-loop.md`（5 分钟可走完）

**验收**
```bash
pnpm e2e --project=live-loop     # 全绿
```

---

## 9. P2 直播专业版任务（26 人天）

### T2.1 场中驾驶舱与预警（10 人天）

**交付物**
- 快照写入：worker 每 60 秒把各直播间当前指标写 `metric_snapshot`（带 `source` 与 `latency_s`）
- 基线：`baseline(run_id, metric_code)` = 近 7 场同时段中位数；偏差超阈值触发预警
- 预警：`alert_rule` 评估 → `alert_event`（`dedup_key` 去重、冷却）→ 投递 → `ack/resolve`
- API：`GET /run/cockpit?room_id=`、`GET /alerts`、`POST /alerts/{id}/ack`、`POST /alerts/{id}/resolve`、`GET/POST /alert-rules`
- 页面：多指标卡 + 基线偏离条 + 告警流 + 建议动作（跳 artifact/action）

**验收**
```bash
# 造一个"停留时长低于基线 40%"的快照 → 60 秒内产生 alert_event
pnpm test -- cockpit-alert
# 同规则同主体 10 分钟内只产生 1 条 open 事件
# ack 后不再重复投递
```

### T2.2 media 投放协同（7 人天）

**交付物**
- `ad_campaign/ad_spend/ad_action/creative/budget_guard`
- API：`GET/POST /media/campaigns`、`GET /media/spend`、`GET/POST /media/actions`、`POST /media/actions/{id}/apply`、`GET /media/roi?basis=pay|settle|blended`
- 熔断：超支/零转化 → 5 分钟内生成 `ad_action` 并告警
- 硬规则：三种 ROI 分列；T+15 未成熟禁止"加预算"；单次调整 ≤±30%

**验收**
```bash
curl -b c.txt "localhost:8788/api/v1/media/roi?basis=pay" | jq '.meta.caliber'
# 结算未成熟时请求加预算 → 422 且 details.maturity=T+15
# 超支 120% 的 campaign → 5 分钟内出现 ad_action(status=pending)
```

### T2.3 content 内容与切片（5 人天）

**交付物**
- `content_authorization/content_clip/publish_record/matrix_account/clip_metric`
- API：`GET/POST /content/authorizations`、`GET/POST /content/clips`、`POST /content/clips/{id}/publish`、`GET /content/metrics`
- 硬规则：无有效授权 → 切片入队 409 `COMPLIANCE_BLOCKED`（带缺失授权 id）

**验收**
```bash
curl -b c.txt -X POST localhost:8788/api/v1/content/clips -d '{"run_id":1,"start":60,"end":90}'
# 无授权 → 409；补授权后 → 201
```

### T2.4 投放 Agent + 切片 Agent（4 人天）

**交付物**
- `media_agent` → `ad_action`（含预算/关停/换素材 + 预期区间 + 风险）
- `content_agent` → `clip_list` + `script_version`
- 黄金集各 30 例（media）/ 20 例（content）
- 断言：media 三 ROI 必填；content 无授权必拒

**验收**
```bash
pnpm eval --agent=media     # 采纳率 ≥50%，数字准确性 ≥95%
pnpm eval --agent=content   # 违禁词漏检 0
```

---

## 10. P3 跨境版任务（30 人天）

### T3.1 上架与合规（10 人天）

**交付物**
- `market_rule/compliance_file/listing_draft/listing_publication/market_sku`
- 合规 gate：`GET /cb/listing/compliance/{sku}?market=US` 返回缺失项；缺失则 `POST /cb/listing/drafts/{id}/publish` → 409 + missing[]
- Listing：`GET/POST /cb/listing/drafts`（多语言）、`POST .../publish`
- 市场规则：GPSR/EPR/CPC/CE/HS 可配置，带生效日期与来源 URL

**验收**
```bash
# 缺 GPSR 责任人的 SKU → 409，missing 含 GPSR
# 补齐后 publish → 200，生成 listing_publication
```

### T3.2 履约与平台时钟（8 人天）

**交付物**
- `platform_clock`：TikTok 48h 打包 + 3 日历日揽收；Amazon 等按渠道配置
- `inbound_shipment/stock_location/stock_level/reservation`
- 预留：`POST /cb/fulfill/reserve` → `available = stocked - reserved`；超时自动释放
- 预警：24h/12h/4h 三级；超时写 `clock.breached`

**验收**
```bash
# 造 47h 未发货订单 → 12h 与 4h 两级预警
# 预留 100 件、可售 80 → available=80；到点自动释放
pnpm test -- platform-clock
```

### T3.3 结算对账与利润（8 人天）

**交付物**
- `settlement_batch/settlement_line/cash_receipt/fx_rate/pnl_snapshot`
- 导入：`POST /cb/settle/batches`（平台账单文件）
- 对账：`GET /cb/settle/reconciliation?batch=` 分录级差异；`POST .../{id}/resolve`
- 利润：`GET /cb/settle/pnl?scope=sku|store|market`（含关税/VAT/仓储/罚金/汇损）
- 一致性：订单层 ≠ 结算层，P&L 只用结算层

**验收**
```bash
# 导入 Amazon 结算报告 → 差异清单可下钻到分录
# 单品 P&L 与手工核算误差 <1%
```

### T3.4 跨境 Listing Agent（4 人天）

**交付物**
- `listing_agent` → `listing_draft`（多语言 + 每条合规依据）
- 黄金集 20 例；断言：合规缺失必拦、AI 图像标注检查、TikTok 真人画面规则

**验收**
```bash
pnpm eval --agent=listing   # 合规拦截召回 100%，人工改写率 ≤40%
```

---

## 11. P4 增值包任务（23 人天）

### T4.1 inventory 库存（5 人天）
- 表 4 张；`GET /inventory/stock`、`POST /inventory/moves`、`GET /inventory/alerts`、`POST /inventory/counts`
- 规则：负库存禁止；预留必须显式；盘点差异需审批
- 验收：预留 100 后可售减少；释放后恢复；安全库存触发 `stock_alert`

### T4.2 creator 达人（5 人天）
- 表 4 张；`GET/POST /creator/creators`、`POST /creator/cooperations`、`GET /creator/settlement`
- 规则：佣金基数必须用 `gmv_settle`；坑位费/样品进单品 P&L
- 验收：同一场按支付 GMV 与结算 GMV 分佣差异可解释

### T4.3 service 客服（8 人天）
- 表 4 张；`GET /service/conversations`、`POST /service/conversations/{id}/reply`、`GET/POST /service/tickets`、`GET /service/reviews`、`GET /service/experience`
- AI 客服：只回五类（发图找款/规格/物流/售后图证/比价）；金额/赔付类转人工
- 体验分：按口径版本存（5 分制/90 天、百分制/30 天）
- 验收：独立解决率 ≥60%；金额类 100% 转人工；退款原因回流排品

### T4.4 授权计费与模块开关（5 人天）
- `plan/plan_module/subscription/entitlement/usage_meter`
- `GET /system/usage`、`POST /system/modules/{id}/entitle`
- 验收：跨租户访问 100% 403；关模块后 API 403、任务 skipped、数据可导出；卸载 90 天内可恢复

---

## 12. P5 规模化任务（18 人天）

### T5.1 TikTok Shop 接入（6 人天）
- OAuth 授权、订单/商品/财务 webhook、限流与重试、幂等
- 验收：授权成功 15 分钟内订单入库；重复回调不重复；限流触发自动退避

### T5.2 Amazon SP-API（6 人天）
- LWA、Reports 异步、Finances、FBA Inventory
- 验收：报表拉取任务可续跑；`getOrders` 限流下任务自动排队

### T5.3 1.5 亿行 / 1,000 租户压测（6 人天）
- 造 3 年数据；压测脚本 `ops/loadtest/`
- 验收（全部达标）：
```bash
pnpm loadtest --rows=150000000     # 灌入 <8h，库 <300GB
pnpm loadtest --qps=600 --endpoint=/api/v1/bi/overview   # P95 <300ms，5xx=0
pnpm loadtest --writes=80 --duration=600                 # 不丢不重，P99 <200ms
```

---

## 13. 页面清单（39 页，按此实现）

| # | 路由 | 页面 | 关键组件 | 数据来源 |
|---:|---|---|---|---|
| 0 | `/onboarding` | 开箱引导 | 3 步向导、模板下载、示例数据 | `/system/tenants/me/onboarding` |
| 1 | `/` | 今日待办 | 场次卡 / 待审草案 / 告警 / 行动项 | `/me/todo` |
| 2 | `/trade/orders` | 订单中心 | 列表、状态机、履约、三口径金额 | `/trade/orders` |
| 3 | `/trade/refunds` | 退款与售后 | 退款归因、工单、SLA | `/trade/refunds` |
| 4 | `/planning` | 排品表列表 | 表格、状态、版本 | `/planning/plans` |
| 5 | `/planning/:id` | 排品表编辑 | 拖拽排序、6 组字段、闸门提示 | `/planning/plans/{id}/slots` |
| 6 | `/planning/candidates` | 候选池 | 卡片、风险标记 | `/planning/candidates` |
| 7 | `/planning/prices` | 价格与渠道 | 市场价目表 | `/planning/prices` |
| 8 | `/run` | 场次列表 | 日历/列表 | `/run/runs` |
| 9 | `/run/:id` | 场次详情 | 时间轴、指令、自检 | `/run/runs/{id}` |
| 10 | `/run/:id/prompter` | 提词卡 | 大字卡、倒计时 | `/run/runs/{id}/slots` |
| 11 | `/cockpit` | 场中驾驶舱 | 指标卡、基线偏离、告警流 | `/run/cockpit` |
| 12 | `/review` | 复盘列表 | 场次对比 | `/review/runs` |
| 13 | `/review/:id` | 复盘报告 | 五段归因、下钻、证据 | `/review/runs/{id}/report` |
| 14 | `/review/compare` | 多场对比 | 对比表 | `/review/compare` |
| 15 | `/review/actions` | 行动项 | 看板、逾期 | `/review/action-items` |
| 16 | `/media` | 投放计划 | 计划健康度 | `/media/campaigns` |
| 17 | `/media/actions` | 调整单 | 审批卡、影响区间 | `/media/actions` |
| 18 | `/content/authorizations` | 授权登记 | 授权凭证 | `/content/authorizations` |
| 19 | `/content/clips` | 切片队列 | 高光列表、授权状态 | `/content/clips` |
| 20 | `/content/publish` | 分发记录 | 矩阵账号、数据回流 | `/content/publish` |
| 21 | `/cb/compliance` | 合规档案 | 认证矩阵、缺失清单 | `/cb/listing/compliance/{sku}` |
| 22 | `/cb/listing` | Listing 草稿 | 多语言编辑、合规依据 | `/cb/listing/drafts` |
| 23 | `/cb/fulfill` | 履约与时钟 | 倒计时、预警分级 | `/cb/fulfill/clock` |
| 24 | `/cb/settle` | 结算对账 | 批次、分录差异 | `/cb/settle/reconciliation` |
| 25 | `/cb/pnl` | 单品 P&L | 成本瀑布、下钻 | `/cb/settle/pnl` |
| 26 | `/catalog/products` | 商品与 SKU | 主数据表、渠道映射 | `/catalog/products` |
| 27 | `/catalog/inventory` | 库存与备货 | 可售/预留/在途 | `/inventory/stock` |
| 28 | `/catalog/channels` | 渠道与价格 | 渠道配置、价目表 | `/catalog/channels` |
| 29 | `/goal` | 目标与行动 | 目标树、达成率 | `/goal` |
| 30 | `/profit` | 利润与单位经济 | P&L 瀑布、CM3 | `/profit` |
| 31 | `/system/metrics` | 指标字典 | 版本、来源、冲突登记 | `/system/metrics` |
| 32 | `/system/sources` | 数据源与接入 | 连接器、同步状态、质量 | `/system/sources` |
| 33 | `/system/ai` | AI 运行与评测 | run 列表、trace、黄金集 | `/system/ai` |
| 34 | `/system/permissions` | 权限与审计 | 岗位、范围、审计日志 | `/system/permissions` |
| 35 | `/system/modules` | 模块与授权 | 安装、授权、用量 | `/system/modules` |
| 36 | `/system/workflows` | 流程与审批 | 定义、实例时间轴、超时升级 | `/system/workflows` |
| 37 | `/system/knowledge` | 知识库 | 空间、文档版本、切分预览、检索测试 | `/knowledge/documents` |
| 38 | `/ai/chat` | 运营助手 | 对话、artifact 卡片、审批 | `/ai/chat` |

**页面规范**：一页只解决一个动作；首屏 ≤3 个数字 + ≤3 个动作；每个数字 hover 显示口径/来源/成熟度；AI 草案必须显示"采纳/修改/驳回"三按钮。
**移动端要求**：`/`、`/run/:id/prompter`、`/cockpit`、`/review/:id` 四页在 375px 下可用（单列、底部操作条、表格转卡片）。

---

## 14. 验收用例（42 条，逐条写进测试）

| 组 | 编号 | 用例（摘要） |
|---|---|---|
| 业务 | B1–B10 | 排品 10 分钟可用 / 一键开场 / 60 秒告警 / 30 分钟复盘 / 行动项回流 / 投放三 ROI / GPSR 拦截 / 结算下钻 / 20 条 AI 结论有证据 / 主播越权 403 |
| 模块 | M1–M5 | 关 media 后菜单消失+403+任务跳过 / 卸载再装恢复 / 只装内核+1 模块可启动 / 跨租户 403 / 未授权模块 AI 工具不可见 |
| 容量 | C1–C5 | 1.5 亿行灌入 / 600 QPS / 明细钻取 / 80 写每秒 / 汇总中断续跑 |
| 反 ERP | A1–A4 | 关 AI 价值下降 / 只买 review 可用 / 全链路可消费 / 新功能能回答岗位场景 |
| 安全 | S1–S4 | 会话与 CSRF / SQL 注入 / 恶意上传 / 日志脱敏 |
| 交易 | T1–T3 | 支付→发货→退款回放 / 并发回调幂等 / 三口径不混算 |
| 知识库 | K1–K4 | 版本按 as_of 命中 / 无引用被拒 / confidential 不可越权 / 50 条黄金查询 ≥85% |
| 工作流 | W1–W5 | 两级审批 / 24h 自动验证 / kill 后恢复 / 超时升级 / 超步数中止 |
| 预警 | A5–A6 | 10 分钟去重 / ack 后不重复 |
| SME 体验 | E1–E4 | 30 分钟开通出首份复盘 / 只传订单也能用 / 375px 可操作 / 试用到期降级正确 |

---

## 14A. 套餐、计费与试用（SME 版）

| 套餐 | 月费（建议） | 含模块 | 店铺数 | AI 次数/月 |
|---|---|---:|---:|---:|
| 入门版 | ￥399 | connect, trade, planning, run, review, knowledge | 1 | 100 |
| 专业版 | ￥899 | 入门版 + media + content | 3 | 500 |
| 跨境版 | ￥1,299 | 专业版 + crossborder_listing/fulfill/settle | 3（含 2 市场） | 800 |
| 增值包 | ￥199/个 | inventory / creator / service（可叠加） | — | 各 100 |
| 试用 | 0（14 天） | 全模块 | 1 | 200 |

**规则**：
- 计费口径 = 店铺数 × 模块；**无实施费、无接口费**。
- 超 AI 次数：先降级（只取数不出结论），再按 ￥0.2/次计费（可关闭）。
- 超店铺数：新建店铺被拒（`402 PLAN_LIMIT`），提示升级。
- 试用到期：自动降级为只读 7 天，再停用；数据保留 90 天可导出。
- 私有化部署：**v1 不提供**（SME 无此需求，且运维成本与售价不匹配）。
- 价格与套餐写成 `plan` / `plan_module` 种子数据，不硬编码在代码里。

**验收**
```bash
# 试用到期 → 只读；新建店铺 → 402 PLAN_LIMIT；AI 超限 → 降级并提示
pnpm test -- billing-limits
```

## 15. 禁止事项（违反即返工）

1. 修改或调用 `/home/leyova` 旧系统的任何代码、表、接口。
2. 在 routes 里写 SQL；跨模块直接读表；跨模块建外键。
3. 把指标数字写死在页面或业务代码里；未注册指标出现在 UI。
4. 引入 §2.3 黑名单依赖或 AGPL/ELv2/Sustainable Use 许可的包。
5. 新增文件不写测试就合并；跳过验收命令。
6. 用 mock 数据冒充"已完成"（除演示数据生成器外）。
7. 让 AI 直接改数据库或执行未审批动作。
8. 把 prompt 全文存进 `ai_evidence`（只存 hash + 引用）。
9. 手工建月分区表（必须走 `ensure_partitions()`）。
10. 为通过验收而放宽断言/改测试期望值。

---

## 16. 完成定义（Definition of Done）

一个任务算完成，必须同时满足：

- [ ] 交付物文件已创建，路径与命名符合 §2.2
- [ ] `pnpm typecheck && pnpm lint && pnpm test` 全绿
- [ ] 本任务「验收」里的命令全部通过（把输出贴进 `PROGRESS.md`）
- [ ] 新接口有 Zod schema + OpenAPI tag + 至少 1 个测试
- [ ] 新表有迁移文件（只增不改），空库与有数据库两态各跑一次
- [ ] 涉及金额/权限/合规的路径有专门的失败用例
- [ ] 没有触碰 §15 任何一条

**最终交付**（P5 结束后）：
```bash
pnpm verify && pnpm e2e && pnpm eval --all && pnpm loadtest --rows=120000000
```
以上四条全绿，且 §14 的 42 条用例逐条有记录，才算系统完成。
