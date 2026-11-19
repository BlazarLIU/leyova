# 新系统架构（ARCHITECTURE v1）

> 日期：2026-11-16 ｜ 配套：`BUILD-SPEC.md`（产品与交付）、`../rebuild-2026-11-16/60-OSS-REVIEW-VS-PROPOSED.md`（开源评估）
> 回答两个问题：① 那些开源项目的**架构思想**到底有没有进方案；② 怎么保证它是**一套系统**，而不是开源项目缝出来的怪东西。
> 结论先说：**借鉴的是机制，不是组件；核心路径上不压任何开源项目；每一个借鉴都必须在我们的契约里重新表达，否则不采纳。**

---

## 0. 一句话架构

**五层单向数据流 + 一个中心抽象（Artifact）+ 一个可插拔内核。**

```
┌─────────────────────────────────────────────────────────────────────┐
│ L5 效果层  结果回写 / 差异度量 / 评测集（eval_case）                    │
│              ▲                                    │                  │
│ L4 动作层  审批 → 能力端口 → 领域命令 → 状态变更 → 审计/回滚            │
│              ▲                                    │                  │
│ L3 判断层  Agent（计划→取数→校验→出草案） → Artifact（带证据）          │
│              ▲                                    │                  │
│ L2 指标层  指标注册表（口径版本） → 参数化查询 → 汇总表 + 成熟度         │
│              ▲                                    │                  │
│ L1 事实层  接入(staging→gate) / 订单 / 场次 / 结算 / 事件（追加为主）    │
│                                                                     │
│ 横向：身份与权限 · 模块运行时(安装/授权/灰度) · 事件总线 · 可观测 · 存储  │
└─────────────────────────────────────────────────────────────────────┘
```

**单向流**：数据只向上流（事实→指标→判断→动作→效果），控制只向下走（动作只能通过领域命令改事实，不能直接写表）。
**闭环**：L5 的结果必须回到 L3 的证据库与评测集——这是"AI+运营"与"报表系统"的分水岭。

---

## 1. 五条设计第一性原理

| # | 原理 | 具体含义 | 违反它的后果 |
|---|---|---|---|
| 1 | **判断必须可追溯到数字** | 任何结论（人写的或 AI 写的）都要挂 `evidence`；数字只能来自指标层 | 回到"AI 一本正经胡说" |
| 2 | **动作必须显式且可回滚** | 所有写操作是一条 `action`（谁、对什么、改前改后、能否撤销） | 回到"点一下不知道改了什么" |
| 3 | **模块之间只靠契约** | 事件 + link + 公开接口；禁止跨模块表访问与外键 | 回到"改一个模块崩三个" |
| 4 | **口径先于报表** | 先注册指标（版本/来源/成熟度），再做页面 | 回到"同一 GMV 四个数" |
| 5 | **核心路径不压开源** | 开源只能在边缘（模型网关、trace、对象存储），换掉任何一个系统仍可用 | 变成缝合怪：升级一个库，全系统陪葬 |

---

## 2. 中心抽象：Artifact（这套系统的"单据"）

ERP 的中心抽象是"单据"（采购单/凭证/工单）。**这套系统的中心抽象是 Artifact：一次判断的产物。**

```
Artifact = 类型 + 主体(对象引用) + 载荷(schema) + 证据 + 校验 + 置信度 + 状态机
```

### 2.1 状态机（唯一允许的流转）

```
        ┌────────── rejected
        │
draft ──┼──> pending_review ──> approved ──> applied ──> measured ──> closed
        │            │                             │
        │            └──> expired（超时未审）        └──> rolled_back
        └──> superseded（被新版本取代）
```

### 2.2 表结构（内核，一张表承载所有 Agent 的产出）

```sql
ai_artifact(
  id, tenant_id, module_id, artifact_type,        -- run_plan_draft / run_report / ad_action / clip_list / listing_draft
  subject_type, subject_id,                        -- 作用于哪个业务对象（场次/SKU/计划）
  payload jsonb,                                   -- 有 schema 的载荷（见 BUILD-SPEC §5.3）
  schema_version, caliber_version,
  evidence_refs bigint[],                          -- 证据（ai_evidence.id）
  checks jsonb,                                    -- 硬闸门结果
  confidence numeric(4,3),
  state text,                                      -- 状态机
  created_by_run_id, approved_by, approved_at,
  applied_action_id, measured_at, outcome jsonb,   -- 效果回写
  superseded_by, created_at, updated_at
)
```

**为什么它是中心抽象**：权限（谁能审哪类 artifact）、审计（谁批的）、计费（生成了多少 artifact）、评测（artifact 被采纳率）、UI（所有页面都是"artifact 的列表 + 详情 + 审批"）都挂在它上面。**一个抽象解决五件事，这才叫架构，不叫拼装。**

---

## 3. 模块内核：能力注册 + 三层开关

### 3.1 内核只提供五件事

| 能力 | 接口（概念） | 说明 |
|---|---|---|
| 身份 | `identity.can(user, action, object)` | 三维：岗位 × 数据范围 × 对象状态 |
| 指标 | `metric.query(code, dims, filters)` | 唯一取数入口，LLM 也只能走它 |
| 判断 | `artifact.create/submit/approve/apply` | 中心抽象的生命周期 |
| 事件 | `event.publish(domainEvent)` | outbox 表 + worker 投递 |
| 模块 | `module.installed/entitled/flag` | 安装、授权、灰度 |

**内核没有任何业务表**。业务表全部在模块自己的 schema 里。

### 3.2 模块之间怎么协作（这是"不缝合"的关键）

```
模块 A ──写自己的 schema──> 同事务写 outbox ──> worker ──> 领域事件
                                                          │
模块 B 订阅事件（幂等）──> 写自己的 schema ──> 需要引用 A 的对象？写 module_link
```

- **不允许**：A 的 SQL JOIN B 的表；A 直接调用 B 的 domain 函数；A 在 B 的表上建外键。
- **允许**：订阅 A 的事件；通过 `module_link` 记录关系；调用 A 的 `public.ts` 只读接口（有版本约束）。
- **卸载 A**：B 只看到"关联对象不存在"，按空态处理，不报错。这是"可插拔"能成立的根本原因。

### 3.3 开关与计费的落点

- 开关：`module_manifest`（装了什么）→ `entitlement`（买了什么）→ `feature_flag`（灰度/急停）。
- 拦截：导航（服务端过滤）→ API（403 `MODULE_NOT_LICENSED`）→ worker（跳过并记录）→ AI 工具（未授权模块的指标与动作对 LLM 不可见）。
- 计费：`usage_meter(tenant, module, metric, period, qty)`，每模块**只允许一个计量口径**。

---

## 4. 事件与一致性：强一致在模块内，最终一致在模块间

| 场景 | 一致性 | 做法 |
|---|---|---|
| 一个模块内的写（下单 + 锁定库存） | 强一致 | 单个 PG 事务 |
| 判断落库（artifact + 状态 + outbox） | 强一致 | 同一事务写 artifact 与 outbox |
| 跨模块（订单 → 结算 → P&L） | 最终一致 | outbox → 事件 → 消费方幂等 upsert；失败进死信队列人工处理 |
| 外部平台回调 | 至少一次 + 幂等 | `(source, external_id, version)` 唯一约束，`ON CONFLICT DO NOTHING` |
| AI 动作执行 | 显式 + 可补偿 | `ai_action` 记录 before/after；回滚是"反向领域命令"，不是改数据库 |

**事件信封**（统一，所有模块一致）：

```json
{
  "event_id": "uuid", "event_type": "order.paid", "version": 1,
  "tenant_id": 1, "module": "crossborder_fulfill",
  "aggregate_type": "order", "aggregate_id": "1002381",
  "occurred_at": "2026-11-16T10:00:00Z",
  "idempotency_key": "amz:order:1002381:v3",
  "payload": { "...": "..." },
  "trace_id": "..."
}
```

**禁止**：分布式事务、跨模块两阶段提交、"先写 A 再写 B 中间失败就算了"。

---

## 5. Agent 运行时：把"智能"关进状态机

### 5.1 一次运行的七个阶段（每一步都落库）

| # | 阶段 | 落库 | 约束 |
|---|---|---|---|
| 1 | scope | `ai_run(tenant, module, object, trigger)` | 未授权模块直接拒绝 |
| 2 | observe | `ai_step(type=fetch)` + `ai_evidence` | 只能通过 `metric.query` / `get_object` |
| 3 | plan | `ai_step(type=plan)` | 计划显式化，可审计 |
| 4 | act | `ai_step(type=tool_call)` | 工具白名单，参数化，记录 input/output hash |
| 5 | verify | `ai_claim` + critic | 数字必须能在 evidence 里复算；不一致则拒绝出稿 |
| 6 | propose | `ai_artifact(state=draft)` | 载荷过 schema 校验 + 硬闸门 |
| 7 | apply | `ai_action(applied)` | 走领域命令，同事务写业务表 + outbox |

### 5.2 工具就是能力端口（不是"给 LLM 一堆函数"）

```
Port（端口）        实现（由模块提供）              权限
metric.query    →   指标注册表 + 参数化 SQL     →   只读，按模块授权
object.get      →   模块 public.ts               →   只读，按数据范围
artifact.create →   artifact 服务                →   需 artifact 类型授权
action.apply    →   领域命令 + 审批              →   需审批 + 动作授权
compliance.check→   规则引擎（版本化规则）        →   只读
knowledge.search→   pgvector 检索                →   只读
```

**LLM 看到的永远是"端口"，不是表、不是 SQL、不是模块内部函数。** 这是权限边界，也是防止"AI 越权"的唯一可靠方式。

### 5.3 编排引擎（Mastra / LangGraph JS / 自研）只是"执行器"

- 状态真值源永远是 `ai_run/ai_step/ai_artifact/ai_action` 四张表；引擎的 checkpointer 只能当缓存。
- 选型 spike 的六条判据见 BUILD-SPEC §5.4；**不通过就用自研**（我们的流程是线性 6 步 + 一次审批，自研成本约 3~5 人天）。
- 无论选谁，**删掉引擎后系统仍能跑**（降级为自研执行器）——这是"不压开源"的具体检验。

---

## 6. 指标与读模型（CQRS-lite，不引入新组件）

```
写入（事实层）──> 领域事件 ──> 汇总任务 ──> agg_* 表（读模型）
                    │                          ▲
                    └──> 指标注册表（公式/口径/成熟度）──> metric.query
```

- 看板/列表只读 `agg_*` 与 `metric.query`；**页面不允许写 SQL**。
- 明细钻取走分区裁剪 + BRIN；超过 2,000 万行/次才考虑列存（ClickHouse）。
- 每个数字在 API 响应里带 `{value, unit, caliber_version, source, maturity}`——前端 hover 直接显示，不需要额外文档。

---

## 7. 一条完整链路（证明五层能串起来）

```
① 平台回调 order.paid
   → connect：staging → gate → order/order_line（幂等）
② 领域事件 order.paid
   → crossborder_fulfill：platform_clock 计算 48h/3 日/7 工作日截止
   → crossborder_settle：settlement_batch 待对账
③ 汇总任务
   → agg_trade_day / agg_sku_day 增量刷新
④ 场次结束（live_run.finished）
   → review_agent：取 22 个指标 → 五段归因 → ai_claim 校验 → artifact(run_report)
   → 人审：运营在"复盘"页改两条结论 → approve
   → action.apply：生成 action_item（下一场要做的事）
⑤ 下一场排品
   → planning_agent 读取 action_item + 指标 + 库存 → artifact(run_plan_draft)
   → 运营采纳 → 落 run_plan_slot
⑥ 下一场结束
   → outcome 回写：行动项是否执行、坑产是否改善 → eval_case
```

**每一环都有明确的生产者、消费者、失败处理与回滚点。** 这就是"系统"，不是"功能列表"。

---

## 8. 部署与运行时拓扑

| 进程/组件 | 职责 | 扩展方式 | 故障影响 |
|---|---|---|---|
| `api`（Fastify） | HTTP、平台回调、SSE 流式 | 无状态，水平扩 | 前端不可用 |
| `worker`（pg-boss） | AI 运行、同步、汇总、事件消费 | 按队列并发扩 | 判断/汇总延迟，HTTP 不受影响 |
| `postgres`（+pgvector） | 唯一真值源、队列、向量 | 垂直 + 只读副本 | 全站不可用（单点，必须有备份） |
| `langfuse`（可选） | LLM trace | 单实例 | 只影响可观测，不影响业务 |
| 对象存储 | 素材/导出/归档 | 云服务 | 影响素材与归档 |

**≤7 容器**；**核心路径只依赖 Node + PostgreSQL**，其余全部可降级。

---

## 9. 那些开源项目的架构，到底进了哪里（逐项落位）

> 规则：**只借机制，不借代码；每个机制必须能在我们的契约里重新表达；否则不采纳。**

| 项目 | 借的机制（具体到设计） | 落在哪 | 明确不借 | 移除测试 |
|---|---|---|---|---|
| **Mastra** | 工作流 **suspend/resume**：审批作为持久化状态，而不是内存 await | `ai_artifact.state` 状态机 + `ai_action.approval_status`；执行器可插拔 | 不用 `ee/`（auth/agent-builder/editor）；不用 Studio 进生产；不把它的存储当真值源 | 去掉 Mastra，自研执行器接同一状态机 |
| **LangGraph JS** | **显式状态转移 + checkpoint + interrupt**：可中断、可恢复、可回放 | `ai_step` 逐步留痕 + 回放校验（10 次结论一致）；分支用显式 `plan` 表达 | 不引入图 DSL 表达线性流程（5 个 Agent 都不需要图） | 去掉 LangGraph，`plan` 仍是显式 JSON |
| **RAGFlow** | **版面感知切分 + 引用优先检索**：政策/证书类文档必须能指回原文位置 | `knowledge.search` 端口：chunk 带 `doc_id/page/span`，结论必须带引用 | 不引入其 5~9 容器栈；不把向量库当商品事实库 | 去掉 RAGFlow，pgvector + 自研切分仍可用 |
| **OpenViking** | **按作用域组织记忆**：租户/角色/场景/对象四维作用域 | `agent_memory(tenant, role, scenario, object)` + 摘要 + 检索 | **AGPL 代码一行不用**；不做"记忆即服务" | 自研 200 行即可替代 |
| **Langfuse** | **trace 四层模型**：session → run → step → tool；评估数据集 | `ai_run/ai_step` 即同构；Langfuse 只做展示与评测 | 不用 `ee/`；不把业务状态放 Langfuse | 去掉后 trace 落 PG 文件日志，业务不受影响 |
| **Phoenix** | **评估指标定义**（faithfulness / context precision 的算法口径） | 评测集的 5 个指标定义 | ELv2，不引入 | — |
| **Vendure** | **Channel = 币种/语言/税/价格/可见性/权限** | `market` + `channel` + `price_list` + `channel_listing` + `channel_role_scope` | GPLv3 代码不用；不引入其 GraphQL 电商内核 | 模型照抄，无依赖 |
| **Medusa** | **模块隔离 + link 表 + 模块服务接口** | 模块独立 schema、禁止跨模块外键、`module_link`、`public.ts` 契约 | 不用其商品/订单模型（DTC 正向交易链）；不用 Enterprise 材料 | 架构形态照抄，无依赖 |
| **Vercel AI SDK** | 模型/工具/流式的统一抽象 | 模型网关适配层（唯一允许的**运行时依赖**） | 不让业务代码直接依赖其类型 | 换 HTTP 直连 provider，业务无感 |
| **Temporal / n8n** | **耐久执行的语义**：至少一次、幂等、补偿、重试退避 | `domain_event` + outbox + 幂等键 + 死信队列 | 不引入工作流引擎（多一个集群/容器） | 语义自实现，无依赖 |

**读法**：左边是"思想来源"，中间是"我们的设计"，右边是"拒绝的部分"。**没有任何一个项目出现在核心路径上。**

---

## 10. 为什么这不是缝合怪（四条可检验的判据）

| # | 判据 | 检验方法 |
|---|---|---|
| 1 | **单一真值源** | 每个关注点只有一个主人：事实=PG、指标=注册表、判断=artifact、动作=action、事件=outbox。不存在"两个系统都能改同一份数据" |
| 2 | **单向依赖** | 业务模块 → 内核 → 基础设施。反过来不允许（内核不 import 模块，模块不 import 另一个模块内部） |
| 3 | **移除测试** | 依次移除 Langfuse / Mastra / AI SDK / 向量检索，系统仍能完成核心闭环（只降级可观测或智能程度） |
| 4 | **契约测试** | 每个模块的公开接口有契约测试；升级/替换实现不改契约。CI 阻断跨模块 import 与 SQL |

**缝合怪的特征**正好相反：两个系统都能写同一份数据、依赖成环、移除任何一个就崩、靠"配置"粘合接口。我们用这四条把它挡在门外。

---

## 11. 这套架构与旧系统的关系

**零代码、零表、零页面复用。** 唯一继承的是"教训清单"（BUILD-SPEC §12）：旧系统 419 个无 tag 端点、93 个导航入口、86 张空表、同一 GMV 四个数、AI 零真实调用——每一条在新架构里都有一个明确机制对应（模块 tag、manifest 导航、模块不装不建表、指标注册表、ai_run 必留 llm_call）。

---

## 12. 现在需要你确认的（只影响顺序，不影响架构）

1. **模块默认组合**：内核 + connect + 直播三件套（4 个模块）是否符合售卖思路。
2. **计量口径**：场次 / SKU / 消耗阶梯。
3. **编排 spike**：做 2 周对比，还是直接自研（自研约 3~5 人天，风险是审批恢复要自己写对）。

确认后出新仓 Phase 0 的建仓清单（目录、依赖、CI 规则、第一版迁移顺序）——仍然只出文档。
