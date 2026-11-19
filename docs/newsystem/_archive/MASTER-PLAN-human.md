# 新系统总体方案（MASTER PLAN · 最终定稿）

> 日期：2026-11-16 ｜ 状态：**新系统唯一方案依据**。此前所有分散文档已归档，只作审计与调研留痕。
> 前提：这是一套**从零设计的系统**，与旧系统没有技术继承关系——旧系统只提供教训清单，不参与本系统的任何部分。先自用、架构预留 SaaS；当前无真实数据，用可复现的演示数据验收。
> 本文档不再提问。所有未定项已在 §0 用「假设 + 决策」定死；任何假设若与你的实际情况不符，只需改那一个数值，其余按比例推导。
> 全文结构：17 章正文 + 附录 7 节；关键数字：**14 个模块 / 109 张表 / 38 个页面 / 155 人天 / 42 条验收用例 / 19 条 ADR**。

---

## 0. 决策摘要

### 0.1 十八个已定决策（ADR 摘要，详见 §14）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 建设方式 | 从零设计、从零构建；旧系统不参与，只作反面案例 |
| D2 | 系统形态 | 模块化内核 + 14 个可插拔模块；默认装 6 个（connect/trade/planning/run/review/knowledge） |
| D3 | 中心抽象 | **Artifact**（一次判断的产物）：类型 + 主体 + 载荷 + 证据 + 校验 + 状态机 |
| D4 | 价格建模 | 价格属市场（`price_list`），渠道差异属 `channel_listing` |
| D5 | 模块耦合 | 禁止跨模块外键，跨模块关系只走 `module_link` |
| D6 | 金额建模 | 三口径分列：`amount_order` / `amount_paid` / `amount_settle`，永不合并 |
| D7 | AI 编排 | **自研执行器**（Vercel AI SDK + `ai_run/ai_step` 状态机）；Mastra/LangGraph 只作可选执行器，不作状态真值源 |
| D8 | 知识库 | pgvector + 自研切分；RAGFlow 不进核心与私有化包 |
| D9 | 可观测 | Langfuse 自托管（MIT 核心，避开 `ee/`），第 2 个月接入，可降级 |
| D10 | 前端 | React 19 + Vite SPA（不用 Next.js），TanStack Query/Router + ECharts + shadcn |
| D11 | 数据库 | PostgreSQL 16 + pgvector 单库；月分区 + 4 张汇总表；ClickHouse 仅按触发条件引入 |
| D12 | 部署 | docker compose，**≤6 容器**；核心路径只依赖 Node + PostgreSQL |
| D13 | 计费 | 每模块只允许一个计量口径；entitlement 为唯一授权载体 |
| D14 | 多租户 | v1 单租户（`tenant_id=1`），所有表带 `tenant_id`，服务层强制作用域 |
| D15 | 验收数据 | 固定种子演示数据 + 故意埋雷（10 个劣质 SKU、3 个异常场次） |
| D16 | 预警 | 内核级 `alert_rule/alert_event/alert_delivery`，模块只声明规则，统一收件箱 |
| D17 | 知识库 | 独立 `knowledge` 模块，PG + pgvector，文档版本化 + 生效日期 + 引用强制 |
| D18 | 工作流 | 自研表驱动状态机（审批 + SOP 编排），不引入 BPMN/Temporal；DSL 白名单，无任意脚本 |

### 0.2 规模假设（改这三个数即可缩放）

| 参数 | 取值 | 推导结果 |
|---|---:|---|
| 年 GMV | 2 亿元 | 支付订单 125 万/年，下单 160 万/年 |
| 客单价 | 160 元 | 订单行 384 万/年（连带 1.4） |
| 退款率 | 25% | 退款单 32 万/年 |
| 直播场次 | 1,200 场/年 | 场次商品槽 4.8 万/年，分钟快照 21.6 万/年 |
| 3 年累计 | — | **约 1.2 亿行 / 约 210 GB**（含事件与 AI 留痕） |

### 0.3 系统边界（明确不做）

| 不做 | 理由 |
|---|---|
| 通用 ERP（采购到付款 / 生产 BOM / 全流程 HR 薪酬 / 复式总账） | 用户明确"不是 ERP"；财务只做单品/单场/单店/单市场 P&L 快照 |
| 自研自动出价引擎 | 平台侧模型更强、数据更全；我们做目标管理与异常熔断 |
| 无人直播 / 纯 AI 驱动直播 | 微信小店细则明文定性"非真实直播"；TikTok 美区要求真人实时画面占比 |
| 自建数仓 / 上 OLAP（v1） | 单机 PG 足够；按 §10.3 触发条件再上 |
| 多租户计费后台（v1） | 预留 `tenant_id` 与 entitlement 表，不做套餐售卖 UI |
| 一次性接入全部平台 | 先 TikTok Shop + Amazon 两条 API，其余走 Excel |

---

## 1. 产品定义

### 1.1 一句话

**一套 AI 运营操作系统：观察经营 → 诊断问题 → 产出可执行物 → 人审 → 执行 → 测量效果 → 学习。**

### 1.2 六条反 ERP 判据（验收时逐条检验）

| # | 判据 | 通过标准 | ERP 的样子 |
|---|---|---|---|
| 1 | 主语测试 | 功能主语是**动作**（排品/开播/复盘/调预算/上架/回评） | 主语是**单据**（采购单/凭证/工单） |
| 2 | 产出测试 | 产出**可执行物**（可入库、可审批、可被下游消费） | 一张报表或一条记录 |
| 3 | 闭环测试 | 动作有"下一场/下周期自动验证效果" | 做完就结束 |
| 4 | 对象测试 | 数据围绕**人·货·场·钱·客** | 围绕会计科目/库存台账/BOM |
| 5 | 模块测试 | **只买一个模块也能用** | 必须全模块一起上 |
| 6 | 关 AI 测试 | 关掉 AI，系统价值**显著下降** | 关掉 AI 无影响（说明 AI 是装饰） |

### 1.3 核心循环（任何功能必须嵌入其中一环）

```
① Observe 取数 → ② Diagnose 找差异 → ③ Propose 出草案 → ④ Approve 人审
→ ⑤ Apply 落对象 → ⑥ Measure 看效果 → ⑦ Learn 进评测 →（回到 ①）
```

映射到系统：`metric.query` → `ai_claim` → `ai_artifact` → `approval` → `ai_action` → `outcome` → `eval_case`。

### 1.4 成功标准（产品层）

| 指标 | 目标 |
|---|---|
| AI 草案采纳率（排品/复盘） | ≥ 60% |
| 行动项下场执行率 | ≥ 50% |
| 复盘归因认可率 | ≥ 70% |
| 排品坑产预测误差（MAPE） | ≤ 35% |
| 单场复盘耗时 | 从 2 小时降到 15 分钟 |
| 排品表制作耗时 | 从 3 小时降到 20 分钟 |

---

## 2. 用户与场景

### 2.1 三类经营主体（决定权限与结算模型，不是三个版本）

| 主体 | 承担什么 | 系统映射 |
|---|---|---|
| 品牌自播 | 库存、退款、体验分、投流 | 完整模块（含 inventory/crossborder） |
| MCN 机构 | 人力、交付 KPI，不承担库存 | 只开 run/review/creator，inventory 关闭 |
| 达播合作 | 只承担流量与佣金 | 只开 creator + review（按达人维度） |

### 2.2 九个岗位的一天（页面按此组织）

| 岗位 | 核心动作 | 第一屏 | 系统替他判断 |
|---|---|---|---|
| 运营/操盘手 | 定货盘、排品、盯场、复盘 | 今日待办（场次 + 待审草案） | 排品草案、差距、归因 |
| 主播 | 对流程、记机制、开场钩子、逼单 | 本场提词卡 | 口播与后台一致性 |
| 助播 | 补位、递话、报库存、念评论 | 提词卡副屏 | 库存与机制提醒 |
| 中控 | 上下架、改价、发券、挂福袋 | 时点指令列表 | 漏执行/错价提醒 |
| 场控 | 控评、氛围、报时 | 评论风险流 | 违禁词/负面情绪 |
| 投手 | 建计划、测素材、加预算、砍劣质 | 计划健康度 + 调整单 | 异常熔断、预算建议 |
| 选品 | 对货、核价、核资质、出提案 | 候选池 + 风险标记 | 毛利/退款/资质风险 |
| 切片 | 选高光、剪辑、分发、追投 | 待剪清单（含授权） | 高光选段、重复度 |
| 客服 | 售前答疑、售后处理 | 待处理会话（SLA 排序） | 五类结构化问答 |

### 2.3 双域差异（只有三处，其余共享）

| 维度 | 境内直播 | 跨境 | 实现 |
|---|---|---|---|
| 成交场 | 场次 | 货架 listing + 场次 | 同一 `run` 模型，`run_type=live/always_on` |
| 履约时钟 | 48h 发货 + 24h 揽收 | 48h 打包 + 3 日历日揽收 + 7 工作日妥投 + FBA 供货天数 | `platform_clock` 按渠道配置，版本化 |
| 成本科目 | 佣金/坑位/投流/退款 | + 关税/VAT/仓储/罚金/汇损 | `pnl_snapshot` 科目按市场扩展 |

---

## 3. 架构

### 3.1 五层单向数据流

```
L5 效果层  结果回写 / 差异度量 / 评测集（eval_case）
              ▲                                    │
L4 动作层  审批 → 能力端口 → 领域命令 → 状态变更 → 审计/回滚
              ▲                                    │
L3 判断层  Agent（计划→取数→校验→出草案）→ Artifact（带证据）
              ▲                                    │
L2 指标层  指标注册表（口径版本）→ 参数化查询 → 汇总表 + 成熟度
              ▲                                    │
L1 事实层  接入(staging→gate) / 订单 / 场次 / 结算 / 事件（追加为主）
横向：身份权限 · 模块运行时 · 事件总线 · 可观测 · 存储
```

**单向**：数据向上流，控制向下走（动作只能经领域命令改事实）。
**闭环**：L5 必须回流 L3，否则就是报表系统。

### 3.2 中心抽象：Artifact

```
Artifact = 类型 + 主体(对象引用) + 载荷(schema) + 证据 + 校验 + 置信度 + 状态机
```

状态机（唯一允许的流转）：

```
        ┌── rejected
draft ──┼──> pending_review ──> approved ──> applied ──> measured ──> closed
        │            │                             │
        │            └──> expired（超时未审）        └──> rolled_back
        └──> superseded（被新版本取代）
```

一个抽象解决五件事：**权限**（谁能审哪类 artifact）、**审计**（谁批的）、**计费**（生成/采纳量）、**评测**（采纳率）、**UI**（每页都是列表+详情+审批）。

### 3.3 模块内核：只提供八件事（前五件是业务闭环，后三件是它们的配套）

| 能力 | 接口 | 说明 |
|---|---|---|
| 身份 | `identity.can(user, action, object)` | 岗位 × 数据范围 × 对象状态 |
| 指标 | `metric.query(code, dims, filters)` | 唯一取数入口（LLM 也只能走它） |
| 判断 | `artifact.create/submit/approve/apply` | 中心抽象生命周期 |
| 事件 | `event.publish(domainEvent)` | outbox + worker 投递 |
| 模块 | `module.installed/entitled/flag` | 安装/授权/灰度 |
| 审批 | `approval.request/decide` | 策略化审批（金额分级、会签/或签、超时升级） |
| 编排 | `workflow.start/advance` | SOP 状态机（agent/approval/action/timer/webhook） |
| 预警 | `alert.raise/ack/resolve` | 规则评估、去重、投递、升级 |

**内核不含任何业务表。**

### 3.4 模块协作规则

```
模块 A ──写自己 schema──> 同事务写 outbox ──> worker ──> 领域事件
                                                       │
模块 B 订阅事件（幂等）──> 写自己 schema ──> 需要引用 A 的对象？写 module_link
```

- 禁止：JOIN 别的模块的表、直接调别的模块 domain、跨模块外键。
- 允许：订阅事件、`module_link`、调用 `public.ts` 只读契约。
- 卸载 A：B 看到"关联对象不存在"走空态，不报错。

### 3.5 一致性模型

| 场景 | 一致性 | 做法 |
|---|---|---|
| 模块内写 | 强一致 | 单 PG 事务 |
| artifact + 状态 + outbox | 强一致 | 同一事务 |
| 跨模块（订单→结算→P&L） | 最终一致 | outbox → 事件 → 幂等 upsert；死信人工 |
| 平台回调 | 至少一次 + 幂等 | `(source, external_id, version)` 唯一约束 |
| AI 动作 | 显式 + 可补偿 | `ai_action` 记 before/after；回滚=反向领域命令 |

### 3.6 部署拓扑（≤6 容器）

| 容器 | 职责 | 扩展 | 故障影响 |
|---|---|---|---|
| `api`（Fastify） | HTTP、回调、SSE | 无状态水平扩 | 前端不可用 |
| `worker`（pg-boss） | AI、同步、汇总、事件 | 按队列并发扩 | 判断/汇总延迟 |
| `postgres`（+pgvector） | 真值源、队列、向量 | 垂直 + 只读副本 | 全站不可用（必须备份） |
| `web`（静态） | SPA | CDN/静态 | 前端不可用 |
| `langfuse`（可选） | LLM trace | 单实例 | 只影响可观测 |
| 对象存储 | 素材/导出/归档 | 云服务 | 影响素材与归档 |

### 3.7 开源项目的机制落位（不是组件拼装）

| 来源 | 借的机制 | 落在哪 | 不借 |
|---|---|---|---|
| Mastra | suspend/resume：审批是持久化状态 | `ai_artifact.state` + `ai_action.approval_status` | `ee/`、Studio 进生产、把其存储当真值源 |
| LangGraph JS | 显式状态转移 + checkpoint + interrupt | `ai_step` 留痕 + 回放校验 | 图 DSL（流程是线性的） |
| RAGFlow | 版面感知切分 + 引用优先 | `knowledge.search`：chunk 带 doc/page/span | 5~9 容器栈 |
| OpenViking | 记忆按租户/角色/场景/对象分域 | `agent_memory` 四维 | AGPL 代码 |
| Langfuse | trace 四层 session→run→step→tool | `ai_run/ai_step` 同构 | `ee/` |
| Phoenix | 评估指标算法口径 | 评测集 5 指标 | ELv2 实现 |
| Vendure | Channel = 币种/语言/税/价格/可见性/权限 | `market/channel/price_list/channel_listing` | GPLv3 代码 |
| Medusa | 模块隔离 + link + 服务接口 | 独立 schema、`module_link`、`public.ts` | DTC 商品/订单模型 |
| Vercel AI SDK | 模型/工具/流式抽象 | 模型网关（唯一运行时依赖） | 业务代码依赖其类型 |
| Temporal/n8n | 至少一次/幂等/补偿/退避 语义 | outbox + 幂等键 + 死信 | 工作流引擎 |

**移除测试**：依次拿掉 Langfuse、Mastra、AI SDK、向量检索，核心闭环仍能跑（只降级可观测/智能程度）。核心路径只依赖 Node + PostgreSQL。

---

### 3.8 系统怎么转起来：四条端到端链路

看一个系统，不看模块清单，看一条业务从进入到结束怎么走。

#### 链路 A：一场直播（T-1 到下场）

| 时点 | 谁 | 做什么 | 系统里发生什么 |
|---|---|---|---|
| T-1 14:00 | 选品 | 开会定货盘 | 候选池 → `run_plan_draft`（AI 排品草案，带理由与证据） |
| T-1 16:00 | 运营 | 改草案、定机制 | 草案 → 审批（按影响金额分级）→ `run_plan` + `run_plan_slot` |
| T-1 18:00 | 运营 | 发布排品表 | `plan.published` → 生成 `live_run` + `cue` 时点指令 |
| T 19:50 | 中控 | 开播前自检 | `run_checklist`（设备/资质/直播形式/AI 标识） |
| T 20:00 | 主播/助播 | 开播 | `run.started` → 提词卡按品序推进 |
| T 20:30 | 中控/投手 | 切品、改价、加预算 | 指令执行 → `cue.executed`；偏离基线 → `alert_event` → 建议动作 |
| T 23:00 | 全场 | 下播 | `run.finished` → 触发复盘工作流 |
| T 23:30 | 运营 | 审复盘 | `review_agent` 出五段归因 → 人审 → `run_report` + `action_item` |
| T+1 起 | 系统 | 回填退款与结算 | T+15/T+30 成熟度回写 → 行动项效果验证 → 进评测集 |

**失败处理**：AI 拒绝出稿（证据不足）→ 运营手填；审批超时 → 升级；指标延迟 → 报告标"未成熟"。

#### 链路 B：一笔订单（从进入到结算）

```
平台回调/导入 → connect 落 staging（指纹幂等）→ 门禁 → trade.order（三口径金额）
→ order.paid 事件 → 履约时钟开始计时（48h 打包/24h 揽收）
→ 发货（fulfillment）→ 签收 → 结算批次（settlement_batch/line）
→ 回款 + 汇兑（cash_receipt/fx_rate）→ 单品/单场/单店 P&L
→ 退款（refund_case，归因到 sku/run/creative）→ 反向冲减 P&L
```

**关键**：订单层金额 ≠ 结算层金额；退款不是"售后问题"，是"流量与选品问题的延迟账单"，必须反向进 P&L。

#### 链路 C：一个跨境 SKU（从建档到复购）

```
建档（SKU + 认证/HS/责任人）→ 合规 gate（缺失即阻断）→ 市场定价（price_list）
→ 多语言 listing（listing_agent 草稿 + 合规依据）→ 审批 → 发布（listing_publication）
→ 订单归集 → 平台时钟（48h/3 日历日/7 工作日）→ 头程/海外仓/FBA
→ 结算对账（分录级）→ 汇损 + 关税 + 罚金进成本 → 单品 P&L
→ 退货/差评 → 反哺选品与 listing 迭代
```

**关键**：合规是"上架前置 gate"，不是事后补证；结算层对不上，利润表就是假的。

#### 链路 D：一次 AI 判断（任何 Agent 都一样）

```
触发（事件/定时/人工）→ 校验模块授权与数据范围 → ai_run
→ 取数（只能走 metric.query / get_object）→ 记 ai_evidence
→ 计划（显式 JSON）→ 工具调用（每步留痕）→ ai_claim
→ Critic 校验（数字必须能复算）→ 通过则生成 ai_artifact(draft)
→ 人审（通过/驳回/改）→ ai_action（领域命令 + 审计 + 可回滚）
→ 效果回写（T+1/T+15）→ eval_case（喂养下一次）
```

**失败处理**：数字对不上 → 拒绝出稿并把"哪个数字没依据"写回；审批拒绝 → 记原因进评测；执行失败 → 反向命令回滚。

## 4. 数据模型

### 4.0 数据库选型（纯技术与业务场景判定）

判定只看 12 条硬要求，不看团队规模、运维习惯、招聘市场。

| # | 硬要求 | 为什么是硬要求 |
|---|---|---|
| R1 | 多表 ACID（订单 + 库存预留 + outbox 同事务） | 钱与库存不能"最终一致" |
| R2 | 精确十进制金额 | 浮点会让对账差几分钱，永远对不平 |
| R3 | 大表分区 + 时间裁剪 | 7 张表 3 年 1.2 亿行，必须能按月裁剪 |
| R4 | 半结构化存储 + 索引 | AI artifact payload、平台原始报文、机制配置 |
| R5 | 数据库级多租户隔离 | SaaS 化后第二道防线（第一道是服务层） |
| R6 | 复杂分析（窗口/CTE/同环比/归因） | 22 个指标与五段归因，不是简单 CRUD |
| R7 | 向量检索 | 政策/证书/SOP 的语义检索 |
| R8 | 中文全文检索 | 平台规则、话术库 |
| R9 | 事务性任务队列 | AI 运行与业务写入同事务入队，避免"写成功任务丢" |
| R10 | 单机私有化 / 离线部署 | 客户现场交付，不能假设云托管 |
| R11 | 许可与成本可控 | 不按核/按量收费 |
| R12 | 备份/CDC/逻辑复制生态 | 容灾与后续接数仓 |

### 4.0.1 候选矩阵（✅ 原生满足 ｜ ⚠️ 需外挂或有限 ｜ ❌ 不满足）

| 要求 | PostgreSQL 16 | MySQL 8 | TiDB | CockroachDB | MongoDB | ClickHouse | SQLite |
|---|---|---|---|---|---|---|---|
| R1 多表 ACID | ✅ | ✅ | ✅ | ✅ | ⚠️ 跨分片事务弱 | ❌ 无 OLTP 事务 | ⚠️ 单写 |
| R2 精确金额 | ✅ numeric | ✅ decimal | ✅ | ✅ | ✅ Decimal128 | ✅ | ✅ |
| R3 分区裁剪 | ✅ 声明式+BRIN | ⚠️ **分区表不支持外键** | ✅ | ✅ | ⚠️ 手工分片 | ✅ | ❌ |
| R4 半结构化 | ✅ JSONB+GIN | ⚠️ JSON 函数弱、多值索引有限 | ⚠️ | ✅ | ✅ 原生 | ✅ | ⚠️ |
| R5 DB 级隔离 | ✅ RLS | ❌ 无 RLS | ❌ | ⚠️ 有限 | ⚠️ 应用层 | ⚠️ 无 | ❌ |
| R6 复杂分析 | ✅ 窗口/CTE | ✅ 8.0 支持 | ✅ +TiFlash | ✅ | ❌ 聚合管道难维护 | ✅ 最强 | ⚠️ |
| R7 向量 | ✅ pgvector | ⚠️ 需外挂/企业版 | ⚠️ | ⚠️ 新版本有限 | ⚠️ Atlas 云依赖 | ⚠️ 近似 | ⚠️ 扩展 |
| R8 中文全文 | ✅ zhparser/pg_jieba | ⚠️ ngram 分词粗糙 | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| R9 事务性队列 | ✅ pg-boss/pgmq | ⚠️ 需 Redis | ⚠️ | ⚠️ | ❌ | ❌ | ❌ |
| R10 单机离线 | ✅ 一个进程 | ✅ | ❌ 多组件集群 | ❌ 多节点 | ✅ | ✅（但只读为主） | ✅ |
| R11 许可成本 | ✅ | ✅ | ✅ | ✅ | ⚠️ SSPL 风险 | ✅ | ✅ |
| R12 生态 | ✅ 逻辑复制/CDC | ✅ | ⚠️ | ⚠️ | ⚠️ | ✅ | ❌ |

**结论：只有 PostgreSQL 12 项全绿。** 其他引擎各有 2~5 项硬伤，且硬伤集中在 R1/R3/R5/R9 这四条——恰好是"钱、库存、租户、任务"四条不能妥协的地方。

### 4.0.2 逐个说清"为什么不是它"

- **MySQL 8**：技术上最接近的替代。但 **分区表不支持外键**，而订单/订单行/结算分录必须分区且要保持引用完整性——这一条就足够否掉"订单主库"的角色；加上无 RLS、JSON 索引弱、事务队列要外挂 Redis，最终会变成 "MySQL + Redis + 向量库 + 应用层隔离" 的四件套。
- **TiDB**：HTAP 与水平扩展是真的强，但单次事务要走 2PC，小事务延迟高于单机 PG；且 PD/TiKV/TiDB 多组件，与"客户现场单机私有化"冲突。技术上适合"写入 >5,000/秒 或单表 >10 亿行"，不是当前形态。
- **CockroachDB**：跨地域强一致是主场，但单区域小事务延迟更高、RLS/向量能力弱、部署仍是多节点。
- **MongoDB**：文档模型天然适合 artifact payload，但**结算对账、漏斗归因、P&L 需要大量多表 JOIN 与窗口函数**，用聚合管道写出来无法维护；金额与库存的系统记录不能放在弱关系约束的库里。
- **ClickHouse**：分析最强，但没有 OLTP 事务与行级更新，只能做"派生读模型"，不能做系统记录。
- **SQLite**：单写锁，多用户并发写直接排队；无 RLS；只适合桌面/离线单机版。

### 4.0.3 纯技术最优其实是"多引擎"，但为什么现在不这么做

如果完全不计运维成本，按"每个问题用最好的工具"，理想组合是：
`PostgreSQL（OLTP 真值源）+ ClickHouse（分析）+ Qdrant/Milvus（向量）+ Redis（队列/缓存）+ OpenSearch（全文）`。

它在技术上确实更强，但会引入**四个新的数据一致性边界**：双写、ETL 延迟、跨引擎对账、故障时部分可用。对"钱与库存"这类要求，**多一个副本就多一种对不平的可能**。所以技术上的正确做法是：

| 触发条件（量化） | 才引入 | 理由 |
|---|---|---|
| 单次即席分析扫描 >5,000 万行，或汇总后 P95 仍 >1.5s | ClickHouse（只读派生） | 列存扫描比行存快 10~100 倍 |
| 向量 >1,000 万条 或 检索 QPS >200 | 专用向量库 | pgvector HNSW 在千万级开始吃内存与召回 |
| 全文检索需要相关性调优/多语言分词 | OpenSearch | PG 分词与排序函数弱于专用引擎 |
| 持续写入 >5,000/秒 或 单表 >10 亿行 | TiDB / Citus | 单机垂直到顶 |
| 多地域双活 | CockroachDB / Spanner 类 | 跨区强一致 |

**在这些阈值发生前，单库 PG 在技术上就是最优解，不是妥协。**

### 4.0.4 PG 的真实弱点与对应手段（不回避）

| 弱点 | 触发场景 | 手段 |
|---|---|---|
| 更新膨胀 / autovacuum 压力 | artifact 状态频繁流转、订单状态更新 | `fillfactor=85~90`、按表调 autovacuum、状态表与流水表分离、分区 drop 代替 delete |
| 单机垂直上限 | 写入或连接数到顶 | 连接池 PgBouncer、只读副本、按域拆库、Citus 分片 |
| 大表即席分析慢 | 无汇总直接扫明细 | 强制走 `agg_*`；BRIN + 分区裁剪；`work_mem` 调优 |
| JSONB schema 漂移 | artifact 载荷版本演进 | `schema_version` + Zod 校验入库 + 只增字段 |
| pgvector 召回/内存 | 向量千万级 | HNSW 参数调优、分批重建、必要时外置向量库 |
| 无内置列存 | 大规模 OLAP | 按 §4.0.3 阈值引入 ClickHouse |

### 4.0.5 决策

**PostgreSQL 16 作为唯一系统记录（system of record），其余引擎一律按量化阈值后置引入，且只做派生读模型。**

换库的代价已被架构隔离：SQL 只在 `metrics/` 与各模块 repository；向量与队列走端口；事务边界按模块单事务；迁移按模块拆分。真要换，是换适配层，不是重写系统。

> 一句话：**在"钱要准、库存不能超卖、租户要隔离、任务不能丢、客户要单机私有化"这五条同时成立时，PostgreSQL 是技术上唯一不需要拼装的答案。**

### 4.1 总量与分区

| 层 | 表数 | 说明 |
|---|---:|---|
| 内核 | 39 | 身份6 / 商品2 / 指标4 / 判断7 / 事件1 / 关系1 / 观测2 / 模块与计费7 / 预警3 / 审批3 / 编排3 |
| 14 个模块 | 70 | 每模块 4~6 张，独立 schema |
| **合计** | **109** | 旧系统 240 张（86 张空），新系统不装模块就不建表 |

分区表：`order`、`order_line`、`settlement_line`、`domain_event`、`ai_evidence`、`ai_step`、`metric_snapshot`。
分区策略：月 RANGE，脚本自动建未来 3 个月、删 13 个月前；**禁止手工建月表**。

### 4.2 内核表（39 张，字段级）

| 表 | 关键字段 | 约束/索引 |
|---|---|---|
| `tenant` | id, name, status, created_at | pk |
| `legal_entity` | id, tenant_id, name, country, tax_id, currency | (tenant_id) |
| `user` | id, tenant_id, email, password_hash, status, last_login_at | unique(tenant_id,email) |
| `role` | id, code, name, is_system | unique(code) |
| `user_role` | user_id, role_id, scope_type, scope_id | pk(user_id,role_id,scope_type,scope_id) |
| `staff_assignment` | id, user_id, object_type, object_id, starts_at, ends_at | (object_type,object_id) |
| `product` | id, tenant_id, title, brand_id, category_l1~l3, status | (tenant_id,status) |
| `sku` | id, product_id, sku_code, barcode, spec_json, weight_g | unique(tenant_id,sku_code) |
| `metric_definition` | code, name, unit, formula_sql, caliber_version, effective_from, source_url, dims_allowed, maturity_required, owner | pk(code,caliber_version) |
| `metric_dimension` | metric_code, dim_code, allowed_values_json | pk(metric_code,dim_code) |
| `source_registry` | code, type(api/excel/third_party), latency, reliability, notes | pk(code) |
| `data_maturity` | metric_code, period, stage(T+1/T+15/T+30), value_json | pk(metric_code,period,stage) |
| `ai_agent` | code, name, module_id, model, tools_json, prompt_version, guardrails_json, status | pk(code) |
| `ai_run` | id, tenant_id, agent_code, module_id, trigger, subject_type, subject_id, status, cost_tokens, started_at, ended_at | (tenant_id,created_at), 月分区 |
| `ai_step` | id, run_id, seq, type(plan/fetch/tool_call/verify), input_json, output_json, latency_ms, error | (run_id,seq) |
| `ai_evidence` | id, run_id, step_id, source_type, source_ref, metric_code, value_json, fetched_at, hash | (run_id), 月分区 |
| `ai_claim` | id, run_id, claim_text, evidence_refs bigint[], verdict(verified/rejected/insufficient), checked_numbers, matched | (run_id) |
| `ai_artifact` | 见 §3.2 字段；+ schema_version, caliber_version, checks_json, confidence, state, created_by_run_id, approved_by/at, applied_action_id, measured_at, outcome_json, superseded_by | (tenant_id,module_id,state), (subject_type,subject_id) |
| `ai_action` | id, artifact_id, action_type, target_type, target_id, params_json, before_json, after_json, approval_status, executed_at, result_json, rollback_of | (artifact_id) |
| `domain_event` | id, tenant_id, event_type, version, aggregate_type, aggregate_id, occurred_at, idempotency_key, payload_json, trace_id | unique(tenant_id,idempotency_key), 月分区 |
| `audit_log` | id, tenant_id, actor_id, action, object_type, object_id, before_json, after_json, trace_id, at | (tenant_id,at), (object_type,object_id) |
| `metric_snapshot` | id, tenant_id, run_id, metric_code, at, value, source, latency_s | (run_id,at), (metric_code,at), 月分区 |
| `module_link` | id, tenant_id, from_module, from_type, from_id, to_module, to_type, to_id, metadata_json | (from_module,from_type,from_id), (to_module,to_type,to_id) |
| `module_manifest` | module_id, version, installed_at, min_kernel | pk(module_id) |
| `entitlement` | id, tenant_id, module_id, source, status, valid_from, valid_to, limits_json | unique(tenant_id,module_id) |
| `plan` / `plan_module` / `subscription` | 套餐与模块价格、周期 | — |
| `feature_flag` | key, tenant_id, value_json, updated_by | pk(key,tenant_id) |
| `usage_meter` | tenant_id, module_id, metric, period, qty | pk(tenant_id,module_id,metric,period) |
| `alert_rule` | id, tenant_id, module_id, code, metric_code, condition_json, window_s, severity, cooldown_s, owner_role, enabled | (tenant_id,module_id,enabled) |
| `alert_event` | id, tenant_id, rule_id, subject_type, subject_id, value, baseline, severity, status(open/ack/resolved), dedup_key, triggered_at, resolved_at | (tenant_id,status,severity), unique(dedup_key) |
| `alert_delivery` | id, event_id, channel, target, sent_at, result | (event_id) |
| `approval_policy` | id, tenant_id, module_id, target_type, condition_json, approver_roles[], mode(any/all/seq), sla_hours, escalate_to | (tenant_id,module_id,target_type) |
| `approval_request` | id, tenant_id, policy_id, artifact_id, action_id, status, current_step, due_at | (tenant_id,status,due_at) |
| `approval_decision` | id, request_id, step_no, approver_id, decision, comment, decided_at | unique(request_id,step_no,approver_id) |
| `workflow_definition` | id, tenant_id, code, version, module_id, trigger_type, dsl_json, status | unique(tenant_id,code,version) |
| `workflow_instance` | id, tenant_id, definition_id, version, subject_type, subject_id, status, current_step, context_json, started_at, ended_at | (tenant_id,status) |
| `workflow_step` | id, instance_id, seq, type, ref, status, attempts, input_json, output_json, error | unique(instance_id,seq) |

> 内核 39 张：身份 6、商品 2、指标 4、判断 7、事件 1、跨模块关系 1、观测 2、模块与计费 7、预警 3、审批 3、编排 3。其中 `plan`/`plan_module`/`subscription` 三张计费表在 v1 只建空表。

### 4.3 模块表清单（70 张）

| 模块 | 表 |
|---|---|
| `connect`(5) | connector, sync_job, staging_record, column_mapping, data_quality_issue |
| `trade`(6) | order, order_line, order_event, fulfillment, refund_case, after_sale_ticket |
| `live_planning`(6) | channel_listing, price_list, price_list_item, run_plan, run_plan_slot, qualification |
| `live_run`(5) | live_run, run_slot, cue, script_version, run_checklist |
| `live_review`(5) | run_report, funnel_snapshot, slot_result, refund_attribution, action_item |
| `media`(5) | ad_campaign, ad_spend, ad_action, creative, budget_guard |
| `content`(5) | content_authorization, content_clip, publish_record, matrix_account, clip_metric |
| `crossborder_listing`(5) | market_rule, compliance_file, listing_draft, listing_publication, market_sku |
| `crossborder_fulfill`(5) | inbound_shipment, stock_location, stock_level, reservation, platform_clock |
| `crossborder_settle`(5) | settlement_batch, settlement_line, cash_receipt, fx_rate, pnl_snapshot |
| `inventory`(4) | stock_item, stock_move, stock_alert, stock_count |
| `creator`(4) | creator, cooperation, sample, commission_settlement |
| `service`(4) | conversation, ticket, review, experience_score |
| `knowledge`(6) | kb_space, kb_document, kb_document_version, kb_chunk, kb_ingest_job, kb_query_log |

### 4.4 三条建模铁律

1. **金额三口径分列**，每个金额带 `currency`；`numeric(18,4)`。
2. **价格属市场**：`price_list(market,currency,tax_included,valid_from)` + `price_list_item(sku,list_price,sale_price)`。
3. **模块间无外键**：只走 `module_link`；卸载只删自己 schema。

### 4.5 索引与性能约定

- 时间列 **BRIN**；业务键 `(tenant_id, xxx)` B-Tree 复合索引；禁止低基数列单列索引。
- 看板只读 `agg_*`；明细钻取走分区裁剪。
- 大字段（prompt、listing 图片、切片）只存对象存储 key + 摘要。
- `ai_evidence` 只存 hash + 引用，不存全文 prompt。

---

## 5. 模块规格（14 个）

> 每个模块 = 独立 schema + manifest + 权限 + 导航 + API + 事件 + jobs + 可选 Agent + 一个计量口径。
> 标注 ✅ 为默认安装。权限命名统一 `{module}.{read|write|publish|admin}`。

### 5.1 `connect` ✅ 数据接入（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 三种来源（API / Excel / 第三方）→ staging → 归一 → 门禁 → 业务表 |
| 表 | connector / sync_job / staging_record / column_mapping / data_quality_issue |
| API | `POST /connect/upload`（文件指纹幂等）、`POST /connect/connectors/{id}/sync`、`GET /connect/jobs`、`GET /connect/quality`、`POST /connect/mappings` |
| 事件 | `import.completed`、`import.failed`、`quality.issue_raised` |
| jobs | 每日增量同步、失败重试、数据新鲜度检查 |
| 门禁 | 必填字段、金额非负、时间连续性、重复检测、币种/时区归一；第三方数据打 `analytics_only=true` 标记 |
| 计量 | 导入行数 |
| 验收 | 同一文件重复上传 0 重复；坏文件 100% 进隔离区并出 issue；第三方数据无法进入结算表（DB 级约束） |

### 5.2 `trade` 交易与售后（6 表，默认安装）

| 项 | 内容 |
|---|---|
| 边界 | 订单、订单行、状态事件、履约单、退款单、售后工单；**所有金额三口径分列** |
| 表 | order / order_line / order_event / fulfillment / refund_case / after_sale_ticket |
| API | `GET /trade/orders`、`GET /trade/orders/{id}`、`POST /trade/orders/{id}/ship`、`GET /trade/refunds`、`POST /trade/refunds/{id}/decide`、`POST /trade/orders/import` |
| 权限 | trade.read / trade.write / trade.audit |
| 导航 | 交易 → 订单中心 / 退款与售后 |
| 事件 | `order.paid`、`order.shipped`、`refund.created`、`refund.settled` |
| jobs | 发货超时扫描、揽收超时扫描、退款自动归因 |
| 硬规则 | 三口径分列；退款必须归因到 sku/run/creative；状态机只允许合法转移；并发回调幂等 |
| 计量 | 订单数 |
| 验收 | 支付→发货→退款全链路事件可回放；三口径不混算；退款可下钻到选品 |

### 5.3 `live_planning` ✅ 货盘与排品（6 表）

| 项 | 内容 |
|---|---|
| 边界 | 卖什么、什么价、什么角色、讲多久；产出排品表（6 组字段） |
| 表 | channel_listing / price_list / price_list_item / run_plan / run_plan_slot / qualification |
| API | `GET/POST /planning/plans`、`GET/POST /planning/plans/{id}/slots`、`POST /planning/plans/{id}/publish`、`GET /planning/candidates`、`GET/POST /planning/prices` |
| 权限 | planning.read / write / publish |
| 导航 | 直播 → 货盘与排品 |
| 事件 | `plan.published`、`plan.superseded` |
| AI | `planning_agent` → `run_plan_draft` |
| 硬闸门 | 资质过期、毛利为负、库存 < 安全线、价格低于成本、重复上架同 SKU |
| 计量 | SKU 数 |
| 验收 | 30 SKU → 10 分钟出完整排品表；6 组字段齐全；一键生成 `live_run` |

### 5.4 `live_run` ✅ 场次编排（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 几点做什么、谁按了什么；开播前自检；时点指令 |
| 表 | live_run / run_slot / cue / script_version / run_checklist |
| API | `POST /run/runs`（从 plan 生成）、`GET /run/runs/{id}`、`POST /run/runs/{id}/start|end`、`POST /run/runs/{id}/cues/{id}/execute`、`GET/POST /run/scripts` |
| 权限 | run.read / operate / admin |
| 导航 | 直播 → 场次编排 |
| 事件 | `run.started`、`run.finished`、`cue.executed`、`price.changed` |
| jobs | 开播提醒、时点提醒、未执行指令告警 |
| 防错 | 上下架/改价必须生成 `ai_action` 或人工 `operation_log`（带 before/after），7 天内可回滚 |
| 计量 | 场次 |
| 验收 | 从排品表一键开场；提醒按计划触发；错价改动可回滚 |

### 5.5 `live_review` ✅ 复盘归因（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 差在哪一段、下次改什么；五段归因 + 行动项 |
| 表 | run_report / funnel_snapshot / slot_result / refund_attribution / action_item |
| API | `GET /review/runs/{id}/report`、`POST /review/runs/{id}/report/generate`、`GET/POST /review/action-items`、`GET /review/compare?ids=` |
| 权限 | review.read / write |
| 导航 | 直播 → 复盘归因 |
| 事件 | `review.report_ready`、`action_item.created`、`action_item.closed` |
| AI | `review_agent` → `run_report` + `action_item` |
| 硬闸门 | 归因分解之和 ≠ GMV 差额（±1%）拒绝；禁"下次努力"类无动作结论；指标必须带成熟度 |
| 计量 | 场次（含 AI） |
| 验收 | 下播 30 分钟出报告；每条结论可下钻；行动项进入下一场排品 |

### 5.6 `media` ⬜ 投放协同（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 钱花得值不值、明天怎么花 |
| 表 | ad_campaign / ad_spend / ad_action / creative / budget_guard |
| API | `GET/POST /media/campaigns`、`GET /media/spend`、`POST /media/actions`、`GET /media/roi?basis=pay|settle|blended` |
| 权限 | media.read / write / approve |
| 事件 | `ad.spend_threshold`、`ad.action_applied` |
| AI | `media_agent` → `ad_action` |
| 硬闸门 | 三种 ROI 分列；结算未成熟禁"加预算"；单次调整 ≤±30%；熔断规则（超支/零转化） |
| 计量 | 消耗额阶梯 |
| 验收 | 导入千川日报 → 出调整单；熔断 5 分钟内生效；采纳/拒绝留痕 |

### 5.7 `content` ⬜ 内容与切片（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 素材能合法用吗、哪条值得追投 |
| 表 | content_authorization / content_clip / publish_record / matrix_account / clip_metric |
| API | `POST /content/authorizations`、`GET /content/clips`、`POST /content/clips/{id}/publish`、`GET /content/metrics` |
| 事件 | `clip.published`、`clip.performance_ready` |
| AI | `content_agent` → `clip_list` + `script_version` |
| 硬闸门 | 无授权不可入剪辑队列；违禁词零漏检；平台 AI 内容标识检查 |
| 计量 | 成片数 |
| 验收 | 无授权时接口 409 并给原因；成片可用率 ≥40% |

### 5.8 `crossborder_listing` ⬜ 跨境上架与合规（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 这个 SKU 能不能卖到这个国家 |
| 表 | market_rule / compliance_file / listing_draft / listing_publication / market_sku |
| API | `GET/POST /cb/listing/markets`、`POST /cb/listing/drafts`、`POST /cb/listing/drafts/{id}/publish`、`GET /cb/listing/compliance/{sku}` |
| 事件 | `listing.published`、`compliance.blocked` |
| AI | `listing_agent` → `listing_draft`（多语言 + 每条带合规依据） |
| 硬闸门 | GPSR 责任人/EPR/CPC/CE 缺失即阻断；AI 生成人像需 `contains-synthetic-performer`；TikTok 真人画面占比 |
| 计量 | SKU × 市场数 |
| 验收 | 缺 GPSR 责任人时发布被 409 阻断并给出补齐清单；补齐后生成英文 listing |

### 5.9 `crossborder_fulfill` ⬜ 跨境履约（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 货在哪、什么时候到、会不会超时被罚 |
| 表 | inbound_shipment / stock_location / stock_level / reservation / platform_clock |
| API | `GET /cb/fulfill/clock/{order}`、`POST /cb/fulfill/shipments`、`GET/POST /cb/fulfill/stock`、`POST /cb/fulfill/reserve` |
| 事件 | `clock.warning`、`clock.breached`、`stock.low` |
| jobs | 平台时钟分级预警（24h/12h/4h）、超时上报 |
| 硬闸门 | 预留 `available = stocked - reserved`；预留超时释放；跨渠道不共享可售 |
| 计量 | 订单数 |
| 验收 | 造一个 47h 未发货订单 → 12h/4h 两级预警；超时后自动记 breach |

### 5.10 `crossborder_settle` ⬜ 跨境结算与利润（5 表）

| 项 | 内容 |
|---|---|
| 边界 | 钱什么时候到、到底赚多少 |
| 表 | settlement_batch / settlement_line / cash_receipt / fx_rate / pnl_snapshot |
| API | `POST /cb/settle/batches`（导入）、`GET /cb/settle/reconciliation?batch=`、`GET /cb/settle/pnl?scope=sku|store|market` |
| 事件 | `settlement.imported`、`recon.mismatch`、`pnl.ready` |
| 硬闸门 | 分录级对账（订单层 ≠ 结算层）；汇损单列；罚金/仓储/广告进成本 |
| 计量 | 结算单数 |
| 验收 | 导入 Amazon 结算报告 → 差异可下钻到分录；单品 P&L 与手工核算误差 <1% |

### 5.11 `inventory` ⬜ 库存与备货（4 表）

| 项 | 内容 |
|---|---|
| 边界 | 缺货/滞销/预留/补货 |
| 表 | stock_item / stock_move / stock_alert / stock_count |
| API | `GET /inventory/stock`、`POST /inventory/moves`、`GET /inventory/alerts`、`POST /inventory/counts` |
| 事件 | `stock.below_safety`、`stock.expiring` |
| 硬闸门 | 预留必须显式；负库存禁止；盘点差异需审批 |
| 计量 | SKU 数 |
| 验收 | 预留 100 件后有货 80 件 → 可售 80；释放后恢复 |

### 5.12 `creator` ⬜ 达人合作与结算（4 表）

| 项 | 内容 |
|---|---|
| 边界 | 这个达人这场到底赚没赚 |
| 表 | creator / cooperation / sample / commission_settlement |
| API | `GET/POST /creator/creators`、`POST /creator/cooperations`、`GET /creator/settlement?period=` |
| 事件 | `cooperation.delivered`、`commission.settled` |
| 硬闸门 | 佣金基数必须用**结算 GMV**；坑位费/样品成本进单品 P&L |
| 计量 | 结算单数 |
| 验收 | 同一场，按支付 GMV 与结算 GMV 分佣差异可解释；单达人 P&L 可下钻 |

### 5.13 `service` ⬜ 客服与体验（4 表）

| 项 | 内容 |
|---|---|
| 边界 | 用户为什么不满、怎么不再发生 |
| 表 | conversation / ticket / review / experience_score |
| API | `GET /service/conversations`、`POST /service/tickets`、`GET /service/reviews`、`GET /service/experience?version=` |
| 事件 | `ticket.sla_warning`、`review.negative` |
| AI | 五类结构化问答（发图找款/规格/物流/售后图证/比价），金额与赔付类走规则引擎 |
| 硬闸门 | 体验分按口径版本存（5 分制/90 天 与 百分制/30 天并存） |
| 计量 | 会话数 |
| 验收 | 独立解决率 ≥60%；金额类问题 100% 转人工；退款原因回流到排品 |

---


### 5.14 `knowledge` 企业知识库（6 表，默认安装）

| 项 | 内容 |
|---|---|
| 边界 | 平台政策、商品资料、认证证书、内部 SOP、话术库、复盘结论的**可引用**检索；不做商品事实库与指标引擎 |
| 表 | kb_space（品牌/市场/团队空间）/ kb_document（文档 + 生效期）/ kb_document_version（版本 + 解析产物）/ kb_chunk（切分 + 向量 + 全文）/ kb_ingest_job / kb_query_log |
| 空间与权限 | `kb_space.scope_type`（tenant/brand/market/team）+ `classification`（public/internal/confidential）；检索先过空间 ACL，再按数据范围裁剪 |
| 版本与时效 | 文档有 `version_no`、`effective_from/to`、`checksum`；**查询必须带 `as_of` 并按生效期过滤**（政策改版后不能用旧版回答） |
| 切分 | 标题层级感知，500~800 token，重叠 15%，保留 `heading_path / page_from / page_to` |
| 索引 | `embedding vector(1024)` + HNSW；`ts tsvector` + GIN（中文分词 zhparser/pg_jieba）；`embedding_version` 支持模型升级重建 |
| 引用 | 检索返回 `{chunk_id, doc_id, version, page_from, page_to, score, effective_from}`；**AI 结论无引用即被 Critic 拒绝** |
| 无答案 | 最高分 < 阈值 → 返回"未收录/不确定"，禁止编造；记入 `kb_query_log` 供补文档 |
| API | `POST /knowledge/documents`、`POST /knowledge/documents/{id}/versions`、`POST /knowledge/search`、`GET /knowledge/coverage` |
| jobs | 解析/嵌入（批量可重试）、失效检测（checksum 变化）、过期提醒、覆盖率报告 |
| 计量 | 文档数 × 版本 |
| 验收 | 改版后按 `as_of` 命中正确版本；无引用结论 100% 被拒；confidential 不可被越权检索；50 条黄金查询命中率 ≥85% |

**存储事实**：10k 文档 / 50 万 chunk / 1024 维 ≈ 2 GB 向量，pgvector HNSW 单机足够；原文与解析产物放对象存储，PG 只存文本与向量。

---

## 6. AI 运行时（详细设计）

### 6.1 运行生命周期（每一步都落库）

| # | 阶段 | 写入 | 约束 | 失败处理 |
|---|---|---|---|---|
| 1 | scope | `ai_run(status=running)` | 模块授权 + 数据范围校验 | 403 终止 |
| 2 | observe | `ai_step(fetch)` + `ai_evidence` | 只能 `metric.query` / `get_object` | 缺数据则 `status=insufficient_data` |
| 3 | plan | `ai_step(plan)` | 计划为 JSON，可审计 | 计划非法则终止 |
| 4 | act | `ai_step(tool_call)` | 工具白名单 + 参数校验 | 重试 2 次后终止 |
| 5 | verify | `ai_claim` + critic | 数字必须可由 evidence 复算 | 不一致 → `verdict=rejected`，不出稿 |
| 6 | propose | `ai_artifact(state=draft)` | schema + 硬闸门 | 闸门失败 → 附带原因返回 |
| 7 | apply | `ai_action(applied)` | 审批 + 领域命令 + outbox | 回滚反向命令 |

### 6.2 七个工具契约（LLM 能看到的全部能力）

| 工具 | 入参 | 返回 | 权限 | 备注 |
|---|---|---|---|---|
| `list_metrics` | `{domain?}` | 指标列表（code/name/unit/caliber） | 已授权模块 | 只读 |
| `describe_metric` | `{code}` | 定义/公式/口径版本/成熟度/允许维度 | 同上 | 只读 |
| `run_metric` | `{code,dims,filters,from,to}` | `{value, series?, caliber, source, maturity}` | 同上 | 只读，参数化 |
| `get_object` | `{type,id}` | 对象摘要（按数据范围裁剪字段） | 数据范围 | 只读 |
| `list_objects` | `{type,filters,limit≤50}` | 列表 | 同上 | 只读 |
| `create_draft` | `{artifact_type,subject,payload,evidence_refs}` | artifact id | artifact 类型授权 | 只产草稿 |
| `apply_action` | `{artifact_id,action_type,params}` | action id | 需已审批 | 不直接执行 |
| `check_compliance` | `{sku_id,market}` | `{pass,missing[],source_urls[]}` | 只读 | 规则版本化 |
| `search_knowledge` | `{query,scope}` | 片段 + 文档引用 | 只读 | pgvector |

**LLM 永远看不到**：表名、SQL、其他模块的 domain 函数、未授权模块的指标。

### 6.3 五个 Agent 的完整 I/O

#### Agent-1 `planning_agent`（排品）

```json
// input
{ "run_date":"2026-12-01", "room_id":3, "target_gmv":180000,
  "constraints":{ "max_slots":30, "min_margin":0.15, "safety_stock_days":3 } }
// output artifact payload
{ "type":"run_plan_draft",
  "slots":[{"seq":1,"sku":"SKU-1023","role":"引流","minutes":6,"price":39.9,
            "mechanism":"限时秒杀","reason":"转化4.2%/退款8%/毛利18%/库存1200",
            "evidence":["ev_1042","ev_1043"]}],
  "checks":[{"rule":"qualification_valid","pass":true},
            {"rule":"margin_positive","pass":true},
            {"rule":"stock_above_safety","pass":true}],
  "caliber":{"gmv":"gmv_pay@v1","maturity":"T+15"},"confidence":0.72 }
```

- 使用工具：`list_metrics` `run_metric` `list_objects` `get_object` `check_compliance` `create_draft`
- 硬闸门：资质 / 毛利 / 库存 / 价格 / 重复 SKU
- 验收：采纳率 ≥60%；坑产 MAPE ≤35%；人工修改行数 ≤30%

#### Agent-2 `review_agent`（复盘）

```json
// input
{ "run_id":5875, "dimensions":["traffic","funnel","slots","anchor","refund"] }
// output
{ "type":"run_report",
  "headline":"本场 GMV 差 12.4 万，86% 来自流量结构变化",
  "attribution":[{"stage":"traffic","delta":-106000,"share":0.86,
                  "evidence":["ev_2001"],"detail":"付费流量占比从 42% 降到 21%"}],
  "funnel":[{"step":"exposure","value":10726},{"step":"view","value":5363}],
  "actions":[{"who":"media_buyer","what":"下场前 2h 补 5000 元千川","when":"2026-12-01T09:00",
              "verify":"下场付费流量占比 ≥35%"}]}
```

- 使用工具：`run_metric`（22 指标）`get_object` `search_knowledge` `create_draft`
- Critic 规则：Σ 归因 delta = 支付 GMV 差额（±1%）；每个 delta 必须引用 ≥1 evidence；`share` 之和 = 1（±0.02）；禁止无动作结论
- 验收：认可率 ≥70%；行动项执行率 ≥50%

#### Agent-3 `media_agent`（投放）

```json
{ "type":"ad_action",
  "actions":[{"campaign_id":"C-88","op":"budget","from":2000,"to":2600,
              "reason":"支付 ROI 3.1 / 结算 ROI 2.4（T+15 已成熟）",
              "expect":"7 日结算 ROI ≥2.2","risk":"退款率 27% 高于类目均值"}],
  "guards":{"max_delta_pct":30,"settlement_maturity":"T+15"} }
```

- 硬闸门：三种 ROI 分列；T+15 未成熟禁加预算；单次 ≤±30%；熔断（超支/零转化）
- 验收：采纳率 ≥50%；采纳组 7 日结算 ROI 不劣于对照组

#### Agent-4 `content_agent`（脚本/切片）

```json
{ "type":"clip_list",
  "clips":[{"source_run":5875,"start":1240,"end":1305,"hook":"价格对比",
            "authorization_id":42,"reason":"该段点击购物车率 4.8%",
            "risk":"含绝对化用语，需改字幕"}],
  "scripts":[{"product_id":77,"version":3,
              "sections":[{"name":"hook","text":"...","seconds":15}]}] }
```

- 硬闸门：授权缺失拒绝入队；违禁词零漏检；切片时长与平台规则
- 验收：成片可用率 ≥40%；违禁词漏检 0

#### Agent-5 `listing_agent`（跨境）

```json
{ "type":"listing_draft","market":"US","language":"en",
  "title":"...","bullets":["..."],
  "compliance":[{"rule":"GPSR","pass":false,"missing":["EU responsible person"]},
                {"rule":"CPC","pass":true}],
  "evidence":["ev_3001"] }
```

- 硬闸门：GPSR/EPR/CPC 缺失拦截；AI 图像标注；TikTok 真人占比
- 验收：人工改写率 ≤40%；合规拦截召回 100%

### 6.4 Critic（数字校验）算法

```
1. 抽取 claim 中的全部数字（正则 + schema 约束）
2. 每个数字必须能映射到 evidence 中某个 (metric_code, dims, period) 的值
3. 允许误差：金额 ±0.5%，比率 ±0.05pp，计数 0
4. 全部匹配 → verdict=verified；部分 → insufficient；不匹配 → rejected（不出稿）
5. rejected 时把不匹配项写回 ai_claim.unmatched，供 UI 显示"哪个数字没依据"
```

### 6.5 Prompt 与版本

- `ai_agent.prompt_version` + prompt 随版本号管理（存配置库，不入业务库）；每次运行记录版本号。
- 变更流程：改 prompt → 跑黄金集 → 分数不低于基线才允许上线（自动校验不通过即拒绝）。
- 模型路由：默认国产模型（DeepSeek/Qwen），失败降级备用；跨境场景可切海外模型。
- 成本：`ai_run.cost_tokens` 按模块聚合，进 `usage_meter`；单次运行设 token 上限（默认 60k）。

### 6.6 评测（Agent 可信度地基）

| 项 | 要求 |
|---|---|
| 黄金集 | 每 Agent ≥30 例；含"埋雷"（劣质 SKU、异常场次） |
| 自动判据 | 数字准确性（critic）、证据完备性（每条 claim ≥1 evidence）、schema 合规、闸门正确 |
| 人工判据 | 运营 1~5 分 + 是否采纳 |
| 回归 | 每次 prompt/模型变更全量跑；数字准确性下降即阻断 |
| 线上指标 | 采纳率、执行率、行动项有效率、rejected 率 |
| Trace | Langfuse（可选）或 PG 直查：session→run→step→tool |

---


### 6.7 AI 分析、报告、预警的数据怎么存

三类数据三种存法：

| 类别 | 特征 | 表 | 策略 | 保留 |
|---|---|---|---|---|
| **运行留痕** | 追加写、量大、按 run 查 | `ai_run/ai_step/ai_evidence/ai_claim` | 月分区；大字段只存对象存储 key + hash | 13 个月热，之后归档 |
| **产出物** | 有状态流转、要被审批与引用 | `ai_artifact`（`run_report` 是其中一种）+ 发布快照 | 结构化 jsonb payload + 快照 hash | 报告 3 年 |
| **预警** | 触发式、要去重、要确认 | `alert_rule/alert_event/alert_delivery` | 规则按模块声明；事件按 dedup_key 去重 | 13 个月 |

**报告不是新表，是 `artifact_type=run_report` 的 artifact**：
- payload 存结构化章节（headline / 五段归因 / 漏斗 / 动作项），不存 Markdown 字符串；
- 每条结论带 `evidence_refs`，点开回到 `ai_evidence` → 指标 → 事实；
- 发布时生成不可变快照（`report_publication`：快照 hash + 可见范围 + 分享 token），客户看到的是快照，不会"报告自己变了"。

**预警不是页面红点，是可追踪事件**：
```
规则（metric + 条件 + 窗口 + 冷却） → worker 定时评估
→ alert_event（dedup_key 去重，open）→ 投递（站内/企微/Webhook）
→ ack → 处置（跳 artifact 或 action）→ resolved
```
- 去重键 `tenant + rule + subject + 时间桶`；同类告警冷却 N 分钟；
- SLA 未 ack 自动升级上级；
- 与 AI 分工：预警负责"发现"，Agent 负责"解释 + 出草案"，用 `subject` 关联。

**索引与查询**：收件箱 `(tenant,status,severity,triggered_at)`；单场报告 `(subject_type,subject_id)`；证据下钻 `(run_id)` 走分区裁剪；成本 `ai_run(tenant,created_at)` 聚合 token。

**成本配额**：单次 token 上限（默认 60k）+ 每日配额；超限降级为"只取数不出结论"。

### 6.8 工作流与审批（三层，不是一套 BPMN）

| 层 | 是什么 | 谁定义 | 实现 |
|---|---|---|---|
| **L1 业务状态机** | 场次/artifact/订单状态 | 代码（硬编码） | DB CHECK 约束 + 合法转移 |
| **L2 审批流** | 谁能批、几级批、超时升级 | 配置 `approval_policy` | 策略 + 请求/决策表 |
| **L3 SOP 编排** | 跨对象流程（排品→审批→开播→复盘→验证） | 配置 `workflow_definition.dsl_json` | 表驱动状态机 + worker + pg-boss 定时 |

**L2 审批示例**：复盘发布金额影响 >5 万 → 运营总监 + 老板两级（seq）；预算调整 ≤2000 元运营可批，>2000 需主管。审批对象是 artifact 或 action；**没有审批就没有执行**；超时升级，越权 403。

**L3 DSL（v1 白名单，不执行任意脚本）**：

```json
{ "code":"review_to_action","version":3,"trigger":{"type":"event","event":"run.finished"},
  "steps":[
    {"id":"collect","type":"agent","agent":"review_agent","input":{"run_id":"${subject.id}"}},
    {"id":"review","type":"approval","policy":"report_publish"},
    {"id":"publish","type":"action","action":"report.publish","input":{"artifact_id":"${collect.artifact_id}"}},
    {"id":"wait","type":"timer","delay":"P1D"},
    {"id":"verify","type":"agent","agent":"review_agent","input":{"mode":"verify_outcome"}}
  ]}
```

- 步骤只有 5 种：`agent / approval / action / timer / webhook`。
- 幂等：`unique(instance_id, seq)`；失败重试 3 次退避 → 死信 + 告警。
- 等人：实例 `waiting`，审批事件唤醒（**不在内存 await**）。
- 保护：单步超时 1h、实例最多 50 步、`on_fail: abort|retry|compensate`。
- **Agent 负责判断（不确定），工作流负责顺序（确定）**；artifact 审批就是 workflow 的一个步骤。

**v1 六条标准流程**：排品发布、复盘发布、预算调整、Listing 发布、结算差异处理、周报生成分发。

**为什么不直接上 Temporal/Camunda**：流程是"短链路 + 人审 + 定时"，无跨系统长事务；多一套集群与 BPMN 画布会击穿单机私有化。触发再评估：实例 >1 万/天，或出现跨系统补偿 Saga，或跨天精确重试 >10 万次。

**待办中心**：`/inbox` 把 **artifact 审批 + 工作流人工任务 + 预警确认** 合成一个列表，带来源、对象、截止、影响金额、一键通过/驳回/转交。这是每天唯一必须打开的页面。


---

## 7. 指标注册表（22 个，全部版本化）

| # | code | 名称 | 公式 | 口径分支 | 成熟度 | 允许维度 |
|---|---|---|---|---|---|---|
| 1 | `gmv_order` | 下单 GMV | Σ amount_order | 含未付 | T+0 | 场次/商品/渠道/主播 |
| 2 | `gmv_pay` | 支付 GMV | Σ amount_paid | 含后续退款 | T+0 | 同上 |
| 3 | `gmv_settle` | 结算 GMV | Σ amount_settle | 平台结算口径 | T+15/T+30 | 同上 + 结算日 |
| 4 | `refund_rate` | 退款率 | 退款金额/支付金额 | 仅退款/退货退款/品质；按申请日或原单日 | T+15 | 商品/场次/主播/来源 |
| 5 | `quality_return_rate` | 品质退货率 | 品质+物流退货单/支付单 | 平台考核口径 | T+15 | 商品/SKU/供应商 |
| 6 | `aov_pay` | 客单价 | gmv_pay/支付订单数 | 支付或结算 | T+0 | 场次/渠道 |
| 7 | `uv_value` | UV 价值 | gmv/观看 UV | 人数 vs 人次 | T+1 | 场次/渠道 |
| 8 | `gpm` | 千次观看成交 | 成交额/观看人次×1000 | 官方口径 | T+1 | 场次/渠道/商品 |
| 9 | `avg_stay` | 平均停留 | 总观看时长/观看人次 | 官方 vs 第三方 | T+1 | 场次/时段 |
| 10 | `ctr_item` | 商品点击率 | 点击人数/曝光人数 | 曝光口径 | T+1 | 商品/讲解时段 |
| 11 | `cvr_run` | 场次转化率 | 支付订单数/观看人数 | 人数 vs 人次 | T+1 | 场次/渠道 |
| 12 | `slot_output` | 坑产 | 单品 GMV/讲解分钟 | 支付或结算 | T+15 | 商品/轮次 |
| 13 | `attach_rate` | 连带率 | 成交件数/成交订单数 | 支付 | T+1 | 场次/组合 |
| 14 | `ad_spend` | 消耗 | Σ spend | 是否含服务费 | T+1 | 计划/账户/日 |
| 15 | `roi_pay` | 支付 ROI | gmv_pay/spend | — | T+1 | 计划/商品/达人 |
| 16 | `roi_settle` | 结算 ROI | gmv_settle/spend | — | T+15 | 同上 |
| 17 | `roi_blended` | 综合营销 ROI | (gmv_settle)/(spend+佣金+坑位) | — | T+15 | 同上 |
| 18 | `experience_score` | 体验分 | 平台加权公式 | **5 分制/90 天** 与 **百分制/30 天** 并存 | T+1 | 店铺/日期/版本 |
| 19 | `ship_sla` | 发货时效 | 支付→上传单号 | 承诺取最短 | T+1 | 订单/商品 |
| 20 | `pickup_sla` | 揽收时效 | 上传→首条揽件 | 24h 独立考核 | T+1 | 订单/物流商 |
| 21 | `live_duration` | 有效直播时长 | 开播→下播（剔除挂机） | 平台判定 | T+1 | 场次/主播 |
| 22 | `commission_base` | 主播提成基数 | 支付/结算/毛利 | 三选一，按合同 | T+15 | 主播/场次 |

**跨境追加（同为注册指标，编号 23~27）**：`landed_cost`（到岸成本）、`cm3`（单位经济）、`fx_loss`（汇损）、`penalty_rate`（罚金率）、`inventory_days`（库存周转天数）。

**硬规则**：任何报表 / API / AI 结论必须带 `caliber_version`；未注册指标不得出现在 UI；体验分必须允许"按后台实际展示校准"。

---

## 8. API 设计规范

### 8.1 约定

| 项 | 规范 |
|---|---|
| 基址 | `/api/v1`，模块前缀 `/{module}`，如 `/api/v1/planning/plans` |
| 命名 | 资源复数；动作用子资源或 `POST /{id}/actions/{action}` |
| 方法 | GET 读、POST 建/动作、PUT 全量、PATCH 局部、DELETE 软删 |
| 分页 | 游标：`?cursor=xxx&limit=50`（默认 50，上限 200）；返回 `next_cursor` |
| 过滤 | 白名单参数；禁止任意 SQL 片段 |
| 排序 | `?sort=-created_at`（`-` 降序），仅白名单字段 |
| 幂等 | 写接口支持 `Idempotency-Key` 头；同 key 24h 内返回首次结果 |
| 版本 | URL 版本；破坏性变更升 `/v2`，不原地改 |
| 鉴权 | HttpOnly Cookie 会话；`SameSite=Lax`；CSRF token 用于写 |
| 授权 | 中间件顺序：认证 → 租户 → 模块授权 → 数据范围 → 对象状态 |
| 契约 | Zod schema 定义请求/响应；OpenAPI 自动生成，**100% 带 domain tag** |
| 时间 | 全部 UTC ISO8601；前端按用户时区渲染 |
| 金额 | 字符串十进制（`"1234.5600"`）+ `currency`，禁止 float |

### 8.2 响应封装

```json
{
  "data": { "...": "..." },
  "meta": {
    "caliber": { "gmv": "gmv_pay@v1", "maturity": "T+15" },
    "source": "fact_trade_daily+agg_trade_day",
    "generated_at": "2026-11-16T10:00:00Z",
    "next_cursor": null
  }
}
```

### 8.3 错误码（统一 problem+json 风格）

| HTTP | code | 含义 | 前端行为 |
|---:|---|---|---|
| 400 | `VALIDATION_FAILED` | 参数校验失败（含字段明细） | 表单标红 |
| 401 | `UNAUTHENTICATED` | 未登录/会话过期 | 跳登录 |
| 403 | `MODULE_NOT_LICENSED` | 模块未授权 | 显示"可开通"引导 |
| 403 | `FORBIDDEN_SCOPE` | 数据范围不足 | 提示联系管理员 |
| 404 | `NOT_FOUND` | 资源不存在（含跨租户） | 空态 |
| 409 | `CONFLICT_STATE` | 状态机不允许（如已结算账单修改） | 刷新后重试 |
| 409 | `COMPLIANCE_BLOCKED` | 合规闸门阻断（带 missing 列表） | 展示补齐清单 |
| 422 | `CALIBER_UNKNOWN` | 指标/口径未注册 | 开发期错误，不暴露给用户 |
| 428 | `APPROVAL_REQUIRED` | 动作需审批 | 弹审批卡 |
| 429 | `RATE_LIMITED` | 限流（带 Retry-After） | 退避 |
| 500 | `INTERNAL` | 未预期错误（带 trace_id） | 报错并给 trace_id |

### 8.4 平台回调

- `POST /api/v1/connect/webhooks/{channel}`，HMAC 校验（`X-Signature`），时间戳 ±5 分钟。
- 先落 `staging_record` 再返回 200；业务处理异步，失败进死信。
- 重放保护：`(channel, external_id, version)` 唯一。

---

## 9. 前端信息架构与页面清单（38 页）

### 9.1 导航（8 组，平台是筛选器不是导航维度）

```
今日待办（首页，按岗位渲染）
交易
 ├ 订单中心     ├ 退款与售后
直播
 ├ 货盘与排品   ├ 场次编排   ├ 场中驾驶舱   ├ 复盘归因
 ├ 投放协同     ├ 内容与切片 ├ 达人结算
跨境
 ├ 上架与合规   ├ 履约与时钟 ├ 结算与利润
主数据
 ├ 商品与 SKU   ├ 库存与备货 ├ 渠道与价格
经营
 ├ 目标与行动   ├ 利润与单位经济
系统
 ├ 指标字典     ├ 数据源与接入 ├ AI 运行与评测
 ├ 知识库       ├ 流程与审批   ├ 权限与审计
 └ 模块与授权
```

### 9.2 页面清单

| # | 路由 | 页面 | 主要角色 | 核心组件 | 关键接口 |
|---:|---|---|---|---|---|
| 1 | `/` | 今日待办 | 全部 | 场次卡、待审草案、告警、行动项 | `/me/todo` |
| 2 | `/planning` | 排品表列表 | 运营/选品 | 表格、状态、版本 | `/planning/plans` |
| 3 | `/planning/:id` | 排品表编辑 | 运营 | 拖拽排序、6 组字段、闸门提示 | `/planning/plans/{id}/slots` |
| 4 | `/planning/candidates` | 候选池 | 选品 | 卡片、风险标记 | `/planning/candidates` |
| 5 | `/planning/prices` | 价格与渠道 | 运营/财务 | 市场价目表 | `/planning/prices` |
| 6 | `/run` | 场次列表 | 运营/中控 | 日历/列表 | `/run/runs` |
| 7 | `/run/:id` | 场次详情 | 运营/中控 | 时间轴、指令、自检 | `/run/runs/{id}` |
| 8 | `/run/:id/prompter` | 提词卡 | 主播/助播 | 大字卡、机制、倒计时 | `/run/runs/{id}/slots` |
| 9 | `/cockpit` | 场中驾驶舱 | 运营/中控/投手 | 多指标卡、基线偏离、告警流 | `/run/cockpit` |
| 10 | `/review` | 复盘列表 | 运营/老板 | 场次对比 | `/review/runs` |
| 11 | `/review/:id` | 复盘报告 | 运营 | 五段归因、下钻、证据 | `/review/runs/{id}/report` |
| 12 | `/review/compare` | 多场对比 | 运营 | 对比表 | `/review/compare` |
| 13 | `/review/actions` | 行动项 | 运营/老板 | 看板、逾期 | `/review/action-items` |
| 14 | `/media` | 投放计划 | 投手 | 计划健康度 | `/media/campaigns` |
| 15 | `/media/actions` | 调整单 | 投手/运营 | 审批卡、影响区间 | `/media/actions` |
| 16 | `/content/authorizations` | 授权登记 | 切片/法务 | 授权凭证 | `/content/authorizations` |
| 17 | `/content/clips` | 切片队列 | 切片 | 高光列表、授权状态 | `/content/clips` |
| 18 | `/content/publish` | 分发记录 | 切片/运营 | 矩阵账号、数据回流 | `/content/publish` |
| 19 | `/cb/compliance` | 合规档案 | 跨境运营 | 认证矩阵、缺失清单 | `/cb/listing/compliance/{sku}` |
| 20 | `/cb/listing` | Listing 草稿 | 跨境运营 | 多语言编辑、合规依据 | `/cb/listing/drafts` |
| 21 | `/cb/fulfill` | 履约与时钟 | 跨境运营 | 倒计时、预警分级 | `/cb/fulfill/clock` |
| 22 | `/cb/settle` | 结算对账 | 财务 | 批次、分录差异 | `/cb/settle/reconciliation` |
| 23 | `/cb/pnl` | 单品 P&L | 财务/老板 | 成本瀑布、下钻 | `/cb/settle/pnl` |
| 24 | `/catalog/products` | 商品与 SKU | 商品 | 主数据表、渠道映射 | `/catalog/products` |
| 25 | `/catalog/inventory` | 库存与备货 | 仓储 | 可售/预留/在途 | `/inventory/stock` |
| 26 | `/catalog/channels` | 渠道与价格 | 运营 | 渠道配置、价目表 | `/catalog/channels` |
| 27 | `/goal` | 目标与行动 | 老板/总监 | 目标树、达成率 | `/goal` |
| 28 | `/profit` | 利润与单位经济 | 老板/财务 | P&L 瀑布、CM3 | `/profit` |
| 29 | `/system/metrics` | 指标字典 | 数据 | 版本、来源、冲突登记 | `/system/metrics` |
| 30 | `/system/sources` | 数据源与接入 | 运维 | 连接器、同步状态、质量 | `/system/sources` |
| 31 | `/system/ai` | AI 运行与评测 | 技术/运营 | run 列表、trace、黄金集 | `/system/ai` |
| 32 | `/system/permissions` | 权限与审计 | 超管 | 岗位、范围、审计日志 | `/system/permissions` |
| 33 | `/system/modules` | 模块与授权 | 超管/商务 | 安装、授权、用量 | `/system/modules` |
| 34 | `/ai/chat` | 运营助手 | 全部 | 对话、artifact 卡片、审批 | `/ai/chat` |
| 35 | `/system/workflows` | 流程与审批 | 超管/总监 | 定义、实例时间轴、超时升级 | `/system/workflows` |
| 36 | `/system/knowledge` | 知识库 | 运营/法务 | 空间、文档版本、切分预览、检索测试 | `/knowledge/documents` |
| 37 | `/trade/orders` | 订单中心 | 运营/客服 | 列表、状态机、履约、三口径 | `/trade/orders` |
| 38 | `/trade/refunds` | 退款与售后 | 客服/财务 | 退款归因、工单、SLA | `/trade/refunds` |

**页面原则**：一页只解决一个动作；每页必须有"AI 建议区"与"证据入口"；每页首屏不超过 3 个数字 + 3 个动作。

---

## 10. 基础设施、运维与安全

### 10.1 环境与配置

| 环境 | 用途 | 数据 |
|---|---|---|
| dev | 本地开发 | 演示数据（固定种子） |
| staging | 验收/压测 | 演示数据 + 脱敏样本 |
| prod | 自用/客户 | 真实数据，每日备份 |

配置：`.env`（非密）+ 密钥管理（生产用系统 keyring/云 KMS）；禁止把密钥写进代码或镜像。

### 10.2 备份与容灾

| 项 | 方案 |
|---|---|
| 全量备份 | 每日 `pg_dump -Fc` 到对象存储，保留 30 天 |
| 增量 | WAL 归档，RPO ≤15 分钟 |
| 恢复演练 | 每季度一次，RTO ≤2 小时，演练记录存档 |
| 对象存储 | 版本化 + 生命周期（素材 180 天转冷） |
| 配置备份 | 运行环境/环境变量/数据结构版本纳入配置管理 |

### 10.3 容量与演进触发器

| 触发条件 | 动作 |
|---|---|
| 单表 >5,000 万行 或 汇总查询 >2s | 加汇总表（不改存储） |
| 汇总后 P95 >1.5s 且单次扫 >2,000 万行 | 引入 ClickHouse（只放分析域） |
| 读 QPS >1,500 持续 10 分钟 | 只读副本 + PgBouncer |
| 写入 >300/秒 或 队列积压 >10 万 | 事件批量 COPY + worker 扩容 |
| 单库 >500 GB | 按域拆库（交易/分析/AI 留痕） |

### 10.4 监控与告警

| 层 | 指标 | 告警阈值 |
|---|---|---|
| API | QPS、P95、5xx 率 | 5xx >0.5% 持续 5 分钟 |
| DB | 连接数、慢查询、复制延迟、磁盘 | 磁盘 >80%；慢查询 >2s 且 >10 次/分 |
| 队列 | 积压、失败率、死信 | 积压 >1 万；死信 >0 |
| 业务 | 数据新鲜度、同步失败、时钟临近超时 | 数据滞后 >24h；超时订单 >0 |
| AI | 运行失败率、rejected 率、token 成本 | 失败 >5%；rejected >30% 需人工介入 |

### 10.5 安全与多租户

- 每行 `tenant_id`；服务层强制作用域，RLS 作第二道防线（`leyova_app` 角色）。
- 密码 Argon2id；会话 12 小时滑动；登录失败 5 次锁 15 分钟。
- 敏感字段（手机号/地址/收款账号）加密存储 + 展示脱敏；日志脱敏（禁止打印 token/密码）。
- 文件上传：类型白名单、大小限制、病毒扫描（可选）、私有桶 + 签名 URL。
- 审计：所有写动作 + 所有 AI 动作；保留 2 年。
- 跨境数据：按市场做数据驻留标记（`market.data_region`），导出走审批。

### 10.6 授权与计费（v1 只做能力，不做售卖 UI）

```
plan → plan_module（模块价格 + 计量口径 + 上限）
subscription（tenant, plan, period）
entitlement（tenant, module, source, status, valid_from/to, limits）
usage_meter（tenant, module, metric, period, qty）
```

- 私有化 license：JWT（模块列表 + 到期 + 机器指纹），离线校验，公钥内置。
- 超限行为：软限（提示 + 继续）与硬限（阻断写入）按模块配置。

---

## 11. 系统质量红线（12 条，上线前必须全过）

| # | 规则 | 检查方式 |
|---|---|---|
| 1 | routes 层禁止 SQL | 正则扫描 `SELECT|INSERT|UPDATE|DELETE` |
| 2 | 每个路由必须有 `domain` tag | OpenAPI 生成时校验 |
| 3 | 模块必须有 manifest（权限/导航/计量） | 构建脚本 |
| 4 | 禁止跨模块 import | 依赖图检查（只允许 kernel 与 `public.ts`） |
| 5 | 禁止跨模块外键 | 迁移 SQL 扫描 |
| 6 | 迁移命名 `<module>/NNN_desc.sql`，只增不改 | 目录与 diff 检查 |
| 7 | 指标必须注册后才能用 | 代码里出现的 metric code 必须在注册表 |
| 8 | 契约测试（Zod schema ↔ OpenAPI ↔ 前端类型） | 生成物 diff |
| 9 | 黄金集回归（AI） | 数字准确性不低于基线 |
| 10 | License 白名单（禁止 AGPL/ELv2/Sustainable Use 依赖） | 依赖树扫描 |
| 11 | 前端包体与首屏预算 | 构建产物检查（主包 <300KB gzip） |
| 12 | 数据结构变更可在空库 + 有数据两态各跑一次 | 双态各跑一次 |

---

## 12. 实施路线（155 人天，6 阶段，逐周）

> 人天按"熟悉业务的全栈 1 人"估算；2 人并行约 14 周。每阶段结束必须通过 Exit Gate 才进入下一阶段。

### P0 内核（15 人天 / 3 周）

| 周 | 任务 | 交付 |
|---|---|---|
| 1 | 系统骨架、12 条质量红线、运行环境、数据结构基线 | 能启动的空系统 |
| 1 | 身份与三维权限、审计 | 登录 + 403 可验证 |
| 2 | 指标注册表 v0（22 指标）+ `metric.query` | 指标 API 带口径 |
| 2 | `ai_run/step/evidence/claim/artifact/action` + 执行器骨架 | 一条端到端假 Agent |
| 3 | 模块运行时（manifest/entitlement/flag/guard）+ 演示数据生成器 | 可开关模块；数据可重建 |

**Exit Gate**：空库一键迁移；登录后按岗位看到不同首页；关掉一个模块其 API 403；演示数据 10 分钟重建。

### P1 直播基础版（43 人天 / 8 周，可卖）

| 周 | 任务 | 交付 |
|---|---|---|
| 4 | connect：上传/映射/门禁/幂等；trade：订单/订单行/事件/退款落库 | 三类模板可导入，订单可查可回放 |
| 5-6 | 货盘与排品：商品/SKU/资质/价格/排品表 6 组字段/闸门 | 排品表可编辑可发布 |
| 6-7 | 场次编排：从排品一键开场、指令、提词卡、自检 | 中控不用 Excel |
| 8 | 复盘归因：五段归因、漏斗、slot_result、行动项 | 下播 30 分钟出报告 |
| 9 | 复盘 Agent + 排品 Agent + 黄金集各 30 例 | 两个 artifact 可采纳 |

**Exit Gate**：演示数据跑通「选品→排品→开场→录结果→复盘→行动项→下场排品」；归因之和 = GMV 差额 ±1%；AI 结论 100% 有证据。

### P2 直播专业版（26 人天 / 5 周，可卖）

| 周 | 任务 |
|---|---|
| 10 | 场中驾驶舱：快照、基线（近 7 场同时段中位数）、告警、动作日志 |
| 11 | 投放协同：计划/消耗/三 ROI/调整单/熔断 |
| 12 | 内容与切片：授权、切片队列、分发、数据回流 |
| 13 | media Agent + content Agent + 黄金集 |

**Exit Gate**：偏离基线 60 秒出告警；熔断 5 分钟生效；无授权切片被 409 拒绝。

### P3 跨境版（30 人天 / 6 周，可卖）

| 周 | 任务 |
|---|---|
| 14-15 | 合规档案 + 市场规则 + 上架 gate + 多渠道 listing |
| 16-17 | 订单归集 + 平台时钟 + 履约 + 预留库存 |
| 18-19 | 结算对账 + 回款 + 汇兑 + 单品 P&L |
| 20 | listing Agent + 黄金集 20 例 |

**Exit Gate**：缺 GPSR 阻断上架；导入 Amazon 结算报告可下钻到分录；单品 P&L 误差 <1%。

### P4 增值包（23 人天 / 5 周）

| 周 | 任务 |
|---|---|
| 21 | inventory：可售/预留/在途、安全库存、盘点 |
| 22 | creator：达人、合作、佣金（结算 GMV 基数） |
| 23 | service：会话、工单、体验分（版本化）、AI 客服五类 |
| 24 | 授权与计费后台（套餐/用量/许可）、跨租户越权测试 |

**Exit Gate**：三个可选包默认关闭、开启即用；跨 tenant 100% 403。

### P5 规模化（18 人天 / 3 周）

| 周 | 任务 |
|---|---|
| 25 | TikTok Shop 接入（OAuth、订单/商品/财务、限流、幂等） |
| 26 | Amazon SP-API（LWA、Reports 异步、Finances、FBA Inventory） |
| 27 | 1.2 亿行压测 + 调优 + 容量报告 |

**Exit Gate**：真实店铺订单 15 分钟内入库；重复回调不重复；压测 5 条全过。

| 阶段 | P0 | P1 | P2 | P3 | P4 | P5 | 合计 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 人天 | 15 | 43 | 26 | 30 | 23 | 18 | **155** |

> 增量说明：P1 +11（trade 交易模块 6 + 审批流与工作流 v0 +5）、P2 +4（知识库）、P4 +3（流程后台与超时升级）。

---

## 13. 验收用例（编号，交付前逐条跑）

### 业务（B）

| # | 用例 | 通过标准 |
|---|---|---|
| B1 | 30 SKU + 库存 + 历史 → 排品草稿 | 10 分钟内产出，6 组字段齐全，闸门全过 |
| B2 | 排品发布 → 生成场次 | 场次含全部 slot 与指令，时间轴正确 |
| B3 | 场中指标偏离 | 60 秒内出告警卡 + 建议动作，误报 ≤20% |
| B4 | 下播 → 复盘报告 | 30 分钟内出，五段归因，分解之和 = 差额 ±1% |
| B5 | 行动项 → 下场排品 | 行动项出现在排品候选与提醒中 |
| B6 | 投放日报导入 → 调整单 | 三 ROI 分列，T+15 未成熟有提示 |
| B7 | 缺 GPSR → 上架 | 409 + 缺失清单；补齐后发布成功 |
| B8 | Amazon 结算导入 → 对账 | 差异可下钻到分录；P&L 误差 <1% |
| B9 | 20 个 AI 结论抽检 | 100% 有证据，0 裸数字 |
| B10 | 主播访问财务接口 | 403 + 审计记录 |

### 模块化（M）

| # | 用例 | 通过标准 |
|---|---|---|
| M1 | 关闭 media | 菜单消失、API 403、worker skipped、数据可导出 |
| M2 | 卸载再装 media | 90 天内数据恢复 |
| M3 | 只装内核 + planning | 系统可启动、可登录、无报错 |
| M4 | 跨租户访问 | 100% 403 + 审计 |
| M5 | 未授权模块的 AI 工具 | LLM 工具列表中不存在 |

### 容量（C）

| # | 用例 | 通过标准 |
|---|---|---|
| C1 | 灌 3 年 1.2 亿行 | <6 小时，库 <300GB |
| C2 | 看板 600 QPS | P95 <300ms，无 5xx |
| C3 | 明细钻取 200 SKU × 3 月 | P95 <800ms |
| C4 | 回调 80 写/秒 × 10 分钟 | 不丢不重，P99 <200ms |
| C5 | 汇总任务中断续跑 | 不重复计算，水位线正确 |

### 反 ERP（A）

| # | 用例 | 通过标准 |
|---|---|---|
| A1 | 关掉全部 AI | 5 个核心屏退化为"只能看数"，证明确以判断为核心 |
| A2 | 只买 review 一个模块 | 能独立产出复盘报告与行动项 |
| A3 | 排品→场次→复盘→行动项→排品 | 全链路可跑，产出物可被下游消费 |
| A4 | 新增一个功能的评审 | 能回答"哪个岗位/什么时刻/做什么决定"，否则不立项 |

### 安全（S）

| # | 用例 | 通过标准 |
|---|---|---|
| S1 | 会话过期/CSRF | 401/403，无越权 |
| S2 | SQL 注入/参数污染 | 全部参数化，注入无效 |
| S3 | 文件上传恶意类型 | 拒绝并记录 |
| S4 | 日志泄露敏感信息 | 抽查 100 条无 token/密码/完整手机号 |

---


### 13.5 交易与售后（T）

| # | 用例 | 通过标准 |
|---|---|---|
| T1 | 订单支付→发货→退款全链路 | 事件可回放，状态机拒绝非法转移 |
| T2 | 同一订单并发回调 | 幂等，不产生重复订单/重复退款 |
| T3 | 三口径金额 | 下单/支付/结算分列，裸加总被 API 拒绝 |

### 13.6 知识库、工作流、预警（K/W/A）

| # | 用例 | 通过标准 |
|---|---|---|
| K1 | 政策文档改版（生效日今天） | `as_of=昨天` 命中旧版，`as_of=今天` 命中新版 |
| K2 | AI 结论无引用 | Critic 拒绝出稿（verdict=rejected） |
| K3 | confidential 文档被无权限角色检索 | 0 命中 + 审计记录 |
| K4 | 50 条黄金查询 | 命中率 ≥85%，引用页码正确 |
| W1 | 排品发布（影响 8 万） | 触发两级审批；一级过后转二级；越级审批 403 |
| W2 | 复盘流程 | `run.finished` 触发；审批后 24h 自动验证行动项 |
| W3 | 流程执行中 kill worker | 重启后从当前 step 继续，已完成步骤不重复执行 |
| W4 | 审批超 SLA | 到期自动升级 + 收件箱置顶 |
| W5 | 实例超 50 步/单步超时 | 中止 + 告警 + 死信记录 |
| A5 | 预警去重 | 同规则同主体 10 分钟只产生 1 条 open 事件 |
| A6 | 预警确认与关闭 | ack 后不再重复投递；resolved 记录处置人 |

## 14. ADR 决策记录（摘要）

| # | 决策 | 备选 | 理由 | 代价 |
|---|---|---|---|---|
| ADR-1 | Greenfield 重写 | 渐进改造 | 旧系统无领域边界，改造=重排 IA；且用户明确推倒 | 6 个月才有完整能力 |
| ADR-2 | 模块化内核 | 单体 | 按模块售卖 + 可关闭 + 可卸载 | 模块契约与校验成本 |
| ADR-3 | Artifact 中心抽象 | 每功能自定义产出 | 一个抽象解决权限/审计/计费/评测/UI | 需要统一 schema 纪律 |
| ADR-4 | 模块间无外键 | 跨 schema 外键 | 卸载安全、独立演进 | 查询多一次 JOIN |
| ADR-5 | 价格在市场层 | 价格在 SKU | 多市场多币种，渠道差异大 | 取价需 join 价目表 |
| ADR-6 | 三口径金额分列 | 单 gmv 字段 | 旧系统因此放大 2.43 倍 | 报表需明确选口径 |
| ADR-7 | 自研 AI 执行器 | Mastra / LangGraph | 状态必须可用 SQL 查、可 JOIN 权限 | 审批恢复需自己写对（~3-5 人天） |
| ADR-8 | pgvector 而非 RAGFlow | RAGFlow | 私有化 ≤6 容器 | 复杂 PDF 解析弱，后续旁路 |
| ADR-9 | Langfuse 可选 | Phoenix | ELv2 阻断 SaaS；Langfuse MIT 核心 | 多一个容器（可降级） |
| ADR-10 | Vite SPA | Next.js | 内部系统无 SEO；避免 BFF 双真值源 | 首屏需 code-splitting |
| ADR-11 | 单库 PG + 月分区 | 直接上 ClickHouse | 1.2 亿行单机够；触发器明确 | 分析复杂度受限 |
| ADR-12 | 每模块一个计量口径 | 多口径 | 计费可算清 | 商务灵活性略降 |
| ADR-13 | v1 单租户 | 直接多租户 | 先自用；tenant_id 已预留 | SaaS 化需补隔离测试 |
| ADR-14 | 演示数据埋雷 | 干净数据 | 能验证 Agent 是否避坑 | 造数成本略高 |
| ADR-15 | 不引入工作流引擎 | Temporal | 线性流程 + 一次审批，引擎过重 | 跨天复杂流程需自建（暂不需要） |
| ADR-16 | 数据库用 PostgreSQL 16 | MySQL 8 / TiDB / Mongo | JSONB+分区+RLS+pgvector+窗口函数+PG 队列六项直接可用；1.2 亿行单机够 | 换库需补 RLS/向量/队列；已用端口隔离降低锁定 |
| ADR-17 | 预警在内核统一 | 各模块自建通知 | 规则/事件/投递统一，去重与升级只写一次 | 内核多 3 张表 |
| ADR-18 | 知识库独立模块 + PG | RAGFlow / 外部向量库 | 版本化 + 生效期 + 引用强制，仍在单库事务内 | 复杂 PDF 解析弱（后续旁路） |
| ADR-19 | 自研流程状态机 | Temporal / Camunda | 短链路 + 人审 + 定时，表驱动够用且可审计 | 超长流程需自建（当前无） |

---

## 15. 核心表 DDL 草案（节选 10 张）

```sql
-- 内核：租户与身份
CREATE TABLE tenant (
  id bigserial PRIMARY KEY, name text NOT NULL, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE app_user (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL REFERENCES tenant(id),
  email text NOT NULL, password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active', last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email));

-- 内核：商品最小主数据
CREATE TABLE product (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL,
  title text NOT NULL, brand_id bigint, category_l1 text, category_l2 text, category_l3 text,
  status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE sku (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL, product_id bigint NOT NULL REFERENCES product(id),
  sku_code text NOT NULL, barcode text, spec_json jsonb NOT NULL DEFAULT '{}',
  weight_g int, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sku_code));

-- 模块 live_planning：市场价目（价格属市场，不属 SKU）
CREATE TABLE price_list (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL, market text NOT NULL,
  currency char(3) NOT NULL, tax_included boolean NOT NULL DEFAULT true,
  valid_from date NOT NULL, valid_to date);

CREATE TABLE price_list_item (
  id bigserial PRIMARY KEY, price_list_id bigint NOT NULL REFERENCES price_list(id),
  sku_id bigint NOT NULL, list_price numeric(18,4) NOT NULL, sale_price numeric(18,4),
  UNIQUE (price_list_id, sku_id));

-- 模块 live_run：场次与排品执行
CREATE TABLE live_run (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL, store_id bigint NOT NULL,
  channel_id bigint NOT NULL, room_id bigint,
  run_type text NOT NULL DEFAULT 'live', status text NOT NULL DEFAULT 'planned',
  planned_start timestamptz, actual_start timestamptz, actual_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE run_slot (
  id bigserial PRIMARY KEY, run_id bigint NOT NULL REFERENCES live_run(id),
  round_no int NOT NULL, seq_no int NOT NULL, sku_id bigint NOT NULL,
  slot_role text NOT NULL CHECK (slot_role IN ('traffic','benefit','hero','profit')),
  planned_start timestamptz, planned_minutes int NOT NULL DEFAULT 5,
  live_price numeric(18,4), mechanism_json jsonb NOT NULL DEFAULT '{}',
  script_version_id bigint, UNIQUE (run_id, seq_no));

-- 内核：判断与动作
CREATE TABLE ai_artifact (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL, module_id text NOT NULL,
  artifact_type text NOT NULL, subject_type text NOT NULL, subject_id bigint NOT NULL,
  payload jsonb NOT NULL, schema_version int NOT NULL DEFAULT 1,
  caliber_version jsonb NOT NULL DEFAULT '{}',
  evidence_refs bigint[] NOT NULL DEFAULT '{}', checks jsonb NOT NULL DEFAULT '[]',
  confidence numeric(4,3), state text NOT NULL DEFAULT 'draft'
    CHECK (state IN ('draft','pending_review','approved','rejected','applied','measured','closed','rolled_back','expired','superseded')),
  created_by_run_id bigint, approved_by bigint, approved_at timestamptz,
  applied_action_id bigint, measured_at timestamptz, outcome jsonb,
  superseded_by bigint, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE ai_action (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL, artifact_id bigint NOT NULL REFERENCES ai_artifact(id),
  action_type text NOT NULL, target_type text NOT NULL, target_id bigint NOT NULL,
  params_json jsonb NOT NULL DEFAULT '{}', before_json jsonb, after_json jsonb,
  approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending','approved','rejected','expired')),
  executed_at timestamptz, result_json jsonb, rollback_of bigint,
  created_at timestamptz NOT NULL DEFAULT now());

-- 内核：事件（月分区父表）
CREATE TABLE domain_event (
  id bigserial, tenant_id bigint NOT NULL, event_type text NOT NULL, version int NOT NULL DEFAULT 1,
  aggregate_type text NOT NULL, aggregate_id text NOT NULL,
  occurred_at timestamptz NOT NULL, idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}', trace_id text,
  PRIMARY KEY (id, occurred_at)) PARTITION BY RANGE (occurred_at);
CREATE UNIQUE INDEX ON domain_event (tenant_id, idempotency_key, occurred_at);

-- 内核：跨模块关系（唯一允许的跨模块载体）
CREATE TABLE module_link (
  id bigserial PRIMARY KEY, tenant_id bigint NOT NULL,
  from_module text NOT NULL, from_type text NOT NULL, from_id bigint NOT NULL,
  to_module text NOT NULL, to_type text NOT NULL, to_id bigint NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON module_link (from_module, from_type, from_id);
CREATE INDEX ON module_link (to_module, to_type, to_id);

-- 内核：指标注册
CREATE TABLE metric_definition (
  code text NOT NULL, caliber_version text NOT NULL, name text NOT NULL, unit text NOT NULL,
  formula_sql text NOT NULL, effective_from date NOT NULL, source_url text,
  dims_allowed text[] NOT NULL DEFAULT '{}', maturity_required text,
  owner text, PRIMARY KEY (code, caliber_version));
```

> 完整 86 张表的迁移脚本在实施阶段按模块产出，命名 `db/migrations/<module>/NNN_desc.sql`，只增不改。

---

## 16. 交付清单（本文档定稿后）

| # | 产物 | 状态 |
|---|---|---|
| 1 | 本 MASTER-PLAN（产品+架构+模块+AI+指标+API+页面+运维+路线+验收+ADR+DDL） | ✅ 本次交付 |
| 2 | 12 条质量红线的自动校验清单 | 实施 P0 时产出 |
| 3 | 109 张表的完整迁移脚本 | 实施阶段按模块产出 |
| 4 | 演示数据生成器（含埋雷） | P0 |
| 5 | 黄金集（5 Agent × 30 例） | P1~P3 逐步补齐 |

**下一步只有一件事**：按 P0 的 15 人天把系统内核做出来。旧系统不做任何改动。

---

## 17. 附录

### 17.1 全部 107 张表清单（按域）

**内核（37）**
`tenant`(租户) `legal_entity`(签约主体/税号/币种) `user`(用户) `role`(岗位) `user_role`(岗位+数据范围) `staff_assignment`(对象负责人) `product`(商品) `sku`(SKU)
`metric_definition`(指标+口径版本) `metric_dimension`(允许维度) `source_registry`(数据源/延迟) `data_maturity`(T+1/15/30)
`ai_agent`(Agent 注册) `ai_run`(运行) `ai_step`(步骤) `ai_evidence`(证据) `ai_claim`(断言+校验) `ai_artifact`(产出物+状态机) `ai_action`(动作+审批+回滚)
`domain_event`(领域事件/月分区) `module_link`(跨模块关系) `audit_log`(审计) `metric_snapshot`(分钟级指标快照/月分区)
`module_manifest`(已装模块) `entitlement`(授权) `plan` `plan_module` `subscription` `feature_flag` `usage_meter`
`alert_rule` `alert_event` `alert_delivery`
`approval_policy` `approval_request` `approval_decision`
`workflow_definition` `workflow_instance` `workflow_step`

**connect（5）**：`connector`(连接器) `sync_job`(同步任务) `staging_record`(原样落库+指纹) `column_mapping`(列映射) `data_quality_issue`(质量问题)
**trade（6）**：`order`(订单/三口径) `order_line`(订单行) `order_event`(状态事件) `fulfillment`(运单/时效) `refund_case`(退款) `after_sale_ticket`(售后工单)
**live_planning（6）**：`channel_listing`(渠道商品) `price_list` `price_list_item`(市场价) `run_plan` `run_plan_slot`(排品表) `qualification`(资质)
**live_run（5）**：`live_run` `run_slot` `cue`(时点指令) `script_version`(话术版本) `run_checklist`(开播自检)
**live_review（5）**：`run_report` `funnel_snapshot` `slot_result`(坑产) `refund_attribution` `action_item`
**media（5）**：`ad_campaign` `ad_spend` `ad_action` `creative` `budget_guard`
**content（5）**：`content_authorization` `content_clip` `publish_record` `matrix_account` `clip_metric`
**crossborder_listing（5）**：`market_rule` `compliance_file` `listing_draft` `listing_publication` `market_sku`
**crossborder_fulfill（5）**：`inbound_shipment` `stock_location` `stock_level` `reservation` `platform_clock`
**crossborder_settle（5）**：`settlement_batch` `settlement_line` `cash_receipt` `fx_rate` `pnl_snapshot`
**inventory（4）**：`stock_item` `stock_move` `stock_alert` `stock_count`
**creator（4）**：`creator` `cooperation` `sample` `commission_settlement`
**service（4）**：`conversation` `ticket` `review` `experience_score`
**knowledge（6）**：`kb_space` `kb_document` `kb_document_version` `kb_chunk`(向量+全文) `kb_ingest_job` `kb_query_log`

### 17.2 API 端点目录（按模块，前缀 `/api/v1`）

| 模块 | 端点 |
|---|---|
| 身份 | `POST /auth/login` `POST /auth/logout` `GET /me` `GET /me/todo` `GET/POST /users` `GET/PATCH /users/{id}` `GET /roles` `GET/PUT /users/{id}/roles` `GET /audit-logs` |
| 模块 | `GET /system/modules` `POST /system/modules/{id}/install` `POST /system/modules/{id}/entitle` `GET/PUT /system/flags` `GET /system/usage` |
| 指标 | `GET /metrics` `GET /metrics/{code}` `POST /metrics/{code}/query` `POST /metrics/{code}/conflicts` |
| connect | `POST /connect/upload` `POST /connect/connectors` `POST /connect/connectors/{id}/sync` `GET /connect/jobs` `GET /connect/quality` `POST /connect/mappings` `POST /connect/webhooks/{channel}` |
| trade | `GET /trade/orders` `GET /trade/orders/{id}` `POST /trade/orders/import` `POST /trade/orders/{id}/ship` `GET /trade/refunds` `POST /trade/refunds/{id}/decide` `GET /trade/after-sales` |
| planning | `GET/POST /planning/plans` `GET/PATCH /planning/plans/{id}` `GET/POST /planning/plans/{id}/slots` `POST /planning/plans/{id}/publish` `GET /planning/candidates` `GET/POST /planning/prices` `GET/POST /planning/qualifications` |
| run | `POST /run/runs` `GET /run/runs` `GET /run/runs/{id}` `POST /run/runs/{id}/start` `POST /run/runs/{id}/end` `GET /run/runs/{id}/slots` `POST /run/runs/{id}/cues/{cid}/execute` `GET/POST /run/scripts` `GET /run/cockpit` |
| review | `GET /review/runs` `GET /review/runs/{id}/report` `POST /review/runs/{id}/report/generate` `GET /review/compare` `GET/POST /review/action-items` `PATCH /review/action-items/{id}` |
| media | `GET/POST /media/campaigns` `GET /media/spend` `GET/POST /media/actions` `POST /media/actions/{id}/apply` `GET /media/roi` `GET/POST /media/creatives` |
| content | `GET/POST /content/authorizations` `GET /content/clips` `POST /content/clips` `POST /content/clips/{id}/publish` `GET /content/publish` `GET /content/metrics` |
| cb/listing | `GET /cb/listing/markets` `GET/POST /cb/listing/drafts` `POST /cb/listing/drafts/{id}/publish` `GET /cb/listing/compliance/{sku}` `POST /cb/listing/compliance/{sku}/files` |
| cb/fulfill | `GET /cb/fulfill/clock/{order}` `GET/POST /cb/fulfill/shipments` `GET/POST /cb/fulfill/stock` `POST /cb/fulfill/reserve` `POST /cb/fulfill/release` |
| cb/settle | `POST /cb/settle/batches` `GET /cb/settle/reconciliation` `POST /cb/settle/reconciliation/{id}/resolve` `GET /cb/settle/cash` `GET /cb/settle/pnl` `GET /cb/settle/fx` |
| inventory | `GET /inventory/stock` `POST /inventory/moves` `GET /inventory/alerts` `POST /inventory/counts` |
| creator | `GET/POST /creator/creators` `POST /creator/cooperations` `GET /creator/samples` `GET /creator/settlement` |
| service | `GET /service/conversations` `POST /service/conversations/{id}/reply` `GET/POST /service/tickets` `GET /service/reviews` `GET /service/experience` |
| knowledge | `POST /knowledge/documents` `POST /knowledge/documents/{id}/versions` `POST /knowledge/search` `GET /knowledge/documents/{id}` `GET /knowledge/coverage` |
| AI | `GET /ai/runs` `GET /ai/runs/{id}` `GET /ai/runs/{id}/trace` `POST /ai/chat` `GET /ai/artifacts` `POST /ai/artifacts/{id}/approve` `POST /ai/artifacts/{id}/reject` `POST /ai/actions/{id}/rollback` `GET /ai/evals` |
| 审批/流程 | `GET /approvals` `POST /approvals/{id}/decide` `GET /workflows` `POST /workflows/{id}/start` `GET /workflows/instances/{id}` `POST /workflows/instances/{id}/signal` |
| 预警 | `GET /alerts` `POST /alerts/{id}/ack` `POST /alerts/{id}/resolve` `GET/POST /alert-rules` |
| 经营 | `GET /goal` `POST /goal` `GET /profit` `GET /profit/pnl` |
| 系统 | `GET /system/metrics` `GET /system/sources` `GET /system/permissions` `GET /system/workflows` `GET /system/knowledge` `GET /health` `GET /ready` |

### 17.3 系统构建顺序（12 步，每步可验收）

| # | 步骤 | 依赖 | 验收 |
|---:|---|---|---|
| 1 | 系统骨架 + 12 条质量红线 + 运行环境 | — | 空系统可启动，红线全绿 |
| 2 | 内核身份（tenant/legal_entity/user/role/user_role/staff_assignment） | 1 | 登录 + 三维权限 + 审计 |
| 3 | 商品最小主数据（product/sku） | 2 | 可建 SKU，跨模块可引用 |
| 4 | 指标注册表 + `metric.query` | 2 | 22 指标可查，带口径 |
| 5 | 事件 + outbox + worker | 2 | 事件可投递、幂等可验 |
| 6 | AI 运行时七表 + 执行器骨架 | 4,5 | 一条假 Agent 端到端 |
| 7 | 模块运行时（manifest/entitlement/flag/guard） | 2 | 关模块 403、菜单消失 |
| 8 | alert + approval + workflow 六表 | 5,7 | 规则触发→事件→审批→流程实例 |
| 9 | `connect` + `trade` | 3,5 | 导入→订单落库→事件回放 |
| 10 | `live_planning` + `live_run` + `live_review` | 9 | 排品→开场→复盘闭环 |
| 11 | `knowledge` + `media` + `content` | 6 | 检索带引用；投放调整单 |
| 12 | 跨境三模块 + 平台 API | 9 | 合规 gate + 结算对账 + P&L |

### 17.4 演示数据规格（固定种子，可一键重建）

| 生成器 | 规模 | 关键分布 | 用途 |
|---|---|---|---|
| 主体与店铺 | 1 租户 / 2 主体 / 21 店铺 / 6 市场 | 抖音 45%、快手 15%、视频号 10%、淘宝 15%、小红书 5%、TikTok 5%、Amazon 5% | 权限与渠道 |
| 商品 | 120 SKU / 60 SPU | 服饰退款 25%、食品 3%、家居 8% | 选品与排品 |
| 场次 | 90 天 × 3.3 场/天 ≈ 300 场 | 晚 8 点峰值、周末 +30% | 复盘与场中 |
| 订单 | 90 天 40 万单 / 96 万行 | 客单 160、连带 1.4、退款按类目 | 交易与结算 |
| 投放 | 90 天 × 300 计划 | 支付 ROI 1.8~3.5 | 投放协同 |
| 结算 | 6 个月批次 | 含退款/罚金/仓储/汇损 | 对账与 P&L |
| 知识库 | 80 文档 / 4,000 chunk | 平台政策、认证证书、SOP | 引用与无答案 |
| **埋雷** | 10 个 SKU（高退款+低毛利）、3 场（流量跌 20% 转化平）、2 个 SKU（资质将过期）、1 个 SKU（毛利为负） | — | 验证 Agent 避坑与归因定位 |

### 17.5 环境变量清单

| 变量 | 示例 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://app@db:5432/leyova` | 主库 |
| `PG_POOL_MAX` | `20` | 连接池 |
| `SESSION_SECRET` | 32 字节随机 | 会话签名 |
| `ENCRYPTION_KEY` | 32 字节 base64 | 敏感字段加密 |
| `AI_PROVIDER_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容网关 |
| `AI_PROVIDER_API_KEY` | — | 模型密钥 |
| `AI_MODEL_DEFAULT` | `deepseek-chat` | 默认模型 |
| `AI_MAX_TOKENS_PER_RUN` | `60000` | 单次上限 |
| `AI_DAILY_QUOTA` | `200` | 每日运行配额 |
| `EMBEDDING_MODEL` | `bge-m3` | 向量模型 |
| `EMBEDDING_DIM` | `1024` | 维度 |
| `LANGFUSE_HOST` / `_PUBLIC_KEY` / `_SECRET_KEY` | — | 可选 |
| `S3_ENDPOINT` / `_BUCKET` / `_KEY` / `_SECRET` | — | 对象存储 |
| `WEBHOOK_HMAC_SECRET_{CHANNEL}` | — | 平台回调验签 |
| `LICENSE_PUBLIC_KEY` | PEM | 私有化许可校验 |
| `FEATURE_DEFAULT_MODULES` | `connect,trade,planning,run,review,knowledge` | 默认安装 |
| `LOG_LEVEL` | `info` | 日志 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | 可选追踪 |

### 17.6 测试策略

| 层 | 范围 | 门槛 |
|---|---|---|
| 单元 | domain 纯函数（闸门、P&L、时钟、归因分解） | 覆盖率 ≥80%，关键函数 100% |
| 契约 | Zod schema ↔ OpenAPI ↔ 前端类型 | 生成物零 diff |
| 集成 | 每模块 API + DB（测试库迁移） | P1 关键链路全绿 |
| E2E | 排品→开场→复盘→行动项；跨境合规→上架→结算 | 每阶段 1 条主链路 |
| 压测 | 1.2 亿行、600 QPS、80 写/秒 | §13 C1~C5 |
| AI 评测 | 黄金集 5 Agent × 30 例 | 数字准确性不低于基线；采纳率达标 |
| 安全 | 越权、注入、上传、日志脱敏 | §13 S1~S4 |
| 模块化 | 关/卸/只装一个 | §13 M1~M5 |

### 17.7 术语表

| 术语 | 含义 |
|---|---|
| Artifact | 一次判断的产物（排品草案/复盘报告/调整单/Listing 草稿），有状态机与证据 |
| Evidence | 支撑结论的具体数字及其来源（指标+维度+周期） |
| Claim | 一条结论性断言，必须绑定 Evidence 并通过 Critic 校验 |
| 五段归因 | 流量结构 → 漏斗 → 货盘 → 主播 → 退款/体验分 |
| 坑产 | 单品 GMV / 讲解分钟，衡量"值不值得多给时间" |
| 三口径 GMV | 下单 / 支付 / 结算，永不合并 |
| 成熟度 | T+1 / T+15 / T+30，退款与结算回填后的可信阶段 |
| 平台时钟 | 平台罚则的时间规则（48h 打包、3 日历日揽收等），版本化 |
| module_link | 跨模块关系的唯一载体，替代跨模块外键 |
| entitlement | 模块授权记录，按模块收费的载体 |
| 待办中心 | artifact 审批 + 工作流人工任务 + 预警确认的统一入口 |
| 埋雷数据 | 演示数据中故意设置的劣质 SKU/异常场次，用于验收 Agent |

---

## 18. 定稿声明

- 本文件为**新系统唯一构建依据**，17 章正文 + 附录 7 节；所有数字互相对齐：**14 个模块 / 107 张表 / 38 个页面 / 155 人天 / 42 条验收用例 / 19 条 ADR**。
- 旧系统不做任何改动，也不作为新系统的组成部分；它只提供反面案例（§12 对照表）。
- 后续所有变更走 ADR：新增一条决策、更新受影响章节、同步数字，禁止另起方案文件。
