# AI 能力差距评估：你要的 5 项，系统能不能做到

> 评估日期：2026-11-19
> 评估方式：**源码级核对**（`package.json` 全文扫框架关键字 + `apps/api/src/ai/` 全目录工具清单 + `kb-client.ts` 配置项 + LLM env 项 + 平台适配器实测），非文档转引。
> 评估对象：老大提出的 5 项 AI 能力建设需求。

---

## 〇、结论速查表

| # | 你的需求 | 能否做到 | 一句话现状 |
|---|---|---|---|
| 1 | LangGraph/CrewAI/Dify/Coze 多 Agent 工作流，跑通直播电商闭环 | **部分做到** | 有自研确定性编排（planner/executor/critic/reporter + 29 工具 + 证据血缘），但**无任何外部框架依赖**，且「商品入库 RAG→脚本→切片→投放复盘→数据回流」这条链一行代码都没有 |
| 2 | 对接第三方 API（豆包/通义/千川/剪映/数字人/ASR） | **1/6 接通** | LLM 侧已支持豆包/通义（OpenAI 兼容驱动，改 env 即可）；**千川、剪映、数字人、ASR 全未接** |
| 3 | 向量知识库（Milvus/Chroma）管商品资料/回放/爆款脚本/违禁词 | **未做到，但留了正解** | `kb-client.ts` 是外部 RAG 客户端（RAGFlow/MaxKB 兼容），设计原则写明「不自研引擎」；**未部署任何向量库，`ai_config` 表 0 行** |
| 4 | 提示词体系 + AI SOP + 内部培训 | **未做到** | 无 prompt 表、无版本化、无 SOP、无培训材料。唯一「提示词」相关是数据清洗模板，与 AI 无关 |
| 5 | 持续迭代 Agent 链路 + 数字人直播 + 多 IP 并行 | **未做到** | 有调用追溯和数字校验，但无效果回流、无 A/B、无自动迭代；**数字人 0 代码、多 IP 0 代码** |

---

## 一、已经具备的真实底座（好消息：不用从零建）

这一节是为了避免「看起来什么都不行」的误判。系统的 AI 地基比表面看到扎实得多。

### 1.1 确定性执行器 + 证据血缘（最值钱的地基）

`apps/api/src/ai/engine/executor.ts` 的核心原则写在文件头注释里：

```
1. 纯代码执行，绝不让 LLM 接触或直接运行 SQL。
2. 执行结果中的每一个数值，均自动生成唯一 EvidenceItem（带 parents[] 血缘关系与 SQL 快照）。
```

配套还有：
- `critic.ts` — 数字校验（`verifyNumbers`，容忍度 0.1%）
- `planner/rule-planner.ts` — LLM 离线时基于 Schema Mapper 生成高精度执行计划（注释写明参照 SuperSonic 规则解析器）
- `planner/schema-mapper.ts` — 问句 → 指标 schema 映射
- `contract/evidence.ts` — 证据包结构

**这意味着**：你要做的任何 Agent 链路，都不需要从「怎么让 AI 不乱说数字」开始解决。

### 1.2 29 个受控工具（已注册，可直接编排）

实测 `apps/api/src/ai/register-*.ts` 四个注册文件，去重后 **29 个**（`grep -h "name: '" register-*.ts | sort -u`）：

| 分类 | 工具 |
|---|---|
| 场次与直播（5） | `get_live_sessions` / `get_live_session_metrics` / `get_live_summary` / `get_room_health` / `get_review_overview` |
| 主播（5） | `get_anchor_list` / `get_anchor_profile` / `get_anchor_rank` / `get_anchor_performance` / `analyze_anchor` |
| 经营与趋势（4） | `get_business_overview` / `get_business_trend` / `get_bi_dashboard` / `get_anomalies` |
| 渠道与漏斗（4） | `get_channel_performance` / `get_channel_trend` / `get_funnel_analysis` / `get_roi_analysis` |
| 商品（3） | `get_product_performance` / `get_product_ranking` / `get_product_sku_details` |
| 退款（1） | `get_refund_analysis` |
| 生成与任务（6） | `generate_campaign_plan` / `generate_review` / `generate_selection_plan` / `create_improvement_task` / `get_improvement_tasks` / `update_task_status` |
| 对比（1） | `compare_sessions` |

注：`register-selection-tools.ts` 实际只注册 2 个（`generate_campaign_plan` / `generate_selection_plan`），与 review-task 文件重复计数，去重后计入上表。

这些工具已经通过 `/mcp`（Streamable HTTP + HMAC 签名 + fail-closed 鉴权，见 `ai/mcp-server.ts:322-353`）暴露给外部 Agent 调用。

### 1.3 受控生成已有雏形（但话术是硬编码）

`apps/api/src/services/campaign-plan-service.ts` 的 `generateCampaignPlan()` 产出 12 模块方案：

| 模块 | 内容 |
|---|---|
| m1 | 场次定位与目标拆解（目标 GMV/订单/观众/ROI） |
| m2 | 货盘结构分层（爆款主推 40% / 利润连带 35% / 引流福利 15% / 形象打榜 10%） |
| m3 | 选品依据与信号佐证 |
| m4 | 时段节奏与 5 分钟循环 |
| **m5** | **主播核心话术库**（opening / hookAndHold / pitch / urgency 四段） |
| m6 | 主播场控中控岗位协同 |
| m9 | 投流策略 |

且 **m5 过 `checkTextCompliance()` 违禁词检查**（`PROHIBITED_TERMS` 12 个绝对化用语：顶级/全网第一/绝无仅有/极品/顶尖/万能/第一品牌/国家级/世界级/最高级/最佳）。

**但关键缺陷**：`campaign-plan-service.ts:123-127` 的话术是**模板字符串硬编码**，不是 LLM 生成：

```ts
const scripts = {
  title: '主播核心话术库',
  opening: `欢迎各位来到${shop.shop_name}官方直播间！今天不讲虚的，全场换季爆款现货顺丰直发！`,
  hookAndHold: '左下角 1 号链接是今天专属福利款，主播手上的福利码还剩最后 50 份，扣【1】马上解锁！',
  ...
}
```

全文件无 `llm` / `chat()` 调用。也就是说：**「直播脚本生成」目前是套模板，不是 AI 生成。**

### 1.4 平台 OpenAPI 真实可用

`apps/api/src/modules/data-governance/adapters/platform-adapters.ts` 文件头注释：

> 7 大平台均通过真实 `fetch()`（`httpRequestJson`）与官方签名算法完成 OAuth 授权码换 Token、Token 刷新、订单增量拉取与售后退款拉取。

实测类：`DouyinGovernanceAdapter`、`KuaishouGovernanceAdapter` 等，`fetchOrders()` / `fetchRefunds()` 走真实 HTTP。凭证 AES-256-GCM 加密，`manual_only` / `mock_*` fail-closed 拦截（`platform/adapters/base.ts:89`）。

### 1.5 LLM 多 Provider 成本核算

`ai/llm/openai-compatible.ts` 文件头注释：

> 单一实现对接 DeepSeek、Qwen 通义千问、豆包、Ollama 与自建 vLLM。

`ai/llm/cost.ts` 按 token 计人民币成本。env 项：`AI_ENABLED` / `LLM_API_BASE` / `LLM_API_KEY` / `LLM_MODEL` / `LLM_TIMEOUT_MS` / `ANYTHINGLLM_API_BASE` / `ANYTHINGLLM_API_KEY`。

---

## 二、逐项差距分析

### 需求 1：LangGraph/CrewAI/Dify/Coze 多 Agent 工作流，落地直播电商闭环

**目标链路**：商品入库 RAG 知识库 → 直播脚本/短视频文案生成 → 直播高光切片 → 投流数据分析复盘 → 数据回流迭代提示词与人群标签

#### 现状

| 链路环节 | 现状 | 证据 |
|---|---|---|
| 多 Agent 编排框架 | **无** | `apps/api/package.json` 与根 `package.json` 全文扫 `langgraph`/`crewai`/`dify`/`coze`，**0 处命中** |
| 自研编排 | **有** | `ai/engine/{planner,executor,critic,reporter}` + `tool-registry.ts` |
| 商品入库 RAG | **无** | 无向量库、无商品资料向量化（见需求 3） |
| 直播脚本/文案生成 | **假有** | 模板字符串硬编码，非 LLM 生成（见 1.3） |
| 直播高光切片 | **无** | 全仓扫 `highlight`/`clip`/`切片`/`回放`，命中项全是 `trace/recorder.ts`（AI 调用追溯，与视频无关）和清洗规则，**无任何视频处理代码** |
| 投流数据分析复盘 | **有** | `get_roi_analysis` / `generate_review` / `fact_ad_spend_daily` 140 行 |
| 数据回流迭代提示词 | **无** | 无 prompt 表、无效果回流（见需求 4/5） |
| 人群标签 | **无** | 全库扫 `%tag%`/`%crowd%`/`%audience%`/`%persona%` 表名，**0 命中** |

#### 缺口清单

1. 无多 Agent 框架（要用得引 LangGraph/CrewAI，或在现有 `engine/` 上自建角色分工）
2. 链路 5 个环节中 3 个完全空白（RAG 入库、脚本真生成、高光切片）
3. 无「有状态工作流」承载：现有 `system_jobs` 表（144 行）+ Worker（pg-boss）具备条件，但 **Worker 进程没起**，且没有任何跨天/跨环节的链路定义
4. 无环节间的数据契约：脚本产出物没有结构化落库，切片没有任务表，人群标签没有表

#### 落地路径

**不引外部框架也能做**——现有 `ai/engine/` 已经是「确定性工具编排 + 证据血缘」，缺的只是：
- 一个 `workflow_definition` 表（环节 DAG + 每环节的输入输出契约）
- 把 5 个环节各自实现为受控工具（脚本生成 = LLM + 违禁词检查 + critic；高光切片 = 读 `fact_session_metrics` 峰值时段 + 导出时间码）
- 用 `system_jobs` 驱动链路执行（需先启 Worker）

如果坚持要 LangGraph/CrewAI：可以作为「可选执行器」接入（`FUSION-MASTER-PLAN.md` 第 4 条裁决原文：「自研执行器，状态在自家库；LangGraph/Mastra 只做一周 A/B，谁赢谁当可选执行器」）——**计划里已经这么定了，不要推翻**。

---

### 需求 2：对接第三方 API（豆包/通义/千川/剪映/数字人/ASR）

#### 逐项核对

| API | 现状 | 证据 | 接通成本 |
|---|---|---|---|
| **豆包大模型** | ✅ **已接通** | `openai-compatible.ts` 支持；设 `LLM_API_BASE=https://ark.cn-beijing.volces.com/api/v3` + `LLM_MODEL=doubao-*` 即可 | **0（改 env）** |
| **通义千问** | ✅ **已接通** | 同上，`LLM_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1` | **0（改 env）** |
| **抖音开放平台** | ✅ **已接通** | `platform-adapters.ts` 真实 OAuth + 订单/退款拉取；`dim_shop` 2 个 `authorized` | 已交付 |
| **千川（投放）** | ❌ **未接** | 全仓扫 `qianchuan`，命中项是 `alerts.ts`/`sessions.ts` 里的文案提及，**无 API 客户端**。`fact_ad_spend_daily` 140 行靠手工上传，`ad_plan` 48 行靠手工规划 | 中（要广告主授权 + 资质） |
| **剪映开放 API** | ❌ **未接** | 全仓扫 `jianying`/`capcut`，**0 命中** | 中 |
| **数字人** | ❌ **未接** | 全仓扫 `digital`/`avatar`/`虚拟人`，命中 `register-selection-tools.ts` / `selection-service.ts` 但那是「选品策略」的 `degraded` 策略名，**非数字人**。0 代码 | 高 |
| **ASR 语音识别** | ❌ **未接** | 全仓扫 `asr`/`speech`，命中 `manage-partitions.ts` / `validation-service.ts` / `cleaner-service.ts`，实为 `hasRangePartitionBound` 的子串误报。**真 0 代码** | 中（可本地 Whisper） |

#### 缺口清单

1. 千川：无 API 客户端、无授权流程、无投放计划回读
2. 剪映：无 API 客户端、无素材上传、无剪辑任务轮询
3. 数字人：0 代码
4. ASR：0 代码（但可用开源 Whisper 本地跑，不依赖商业 API）

#### 落地路径

- **豆包/通义**：零成本，加一个 `LLM_PROVIDER` 枚举 + 按任务选模型（脚本生成用豆包、问数用 DeepSeek），1-2 天。
- **ASR**：本地 Whisper（`faster-whisper` 或 `whisper.cpp`）跑直播回放 → 文字 → 违禁词扫描 → 复盘素材。不依赖商业 API，2-3 周。
- **千川**：需你提供广告主授权与资质，4-6 周。**建议排在 ASR 之后**，因为它阻塞在外部条件。
- **剪映**：建议**先不做全自动**。半自动方案（见需求 1）已能满足「高光切片」业务目标。
- **数字人**：见需求 5 的合规讨论。

---

### 需求 3：向量知识库（Milvus/Chroma）管商品资料/直播回放/爆款脚本/违禁词

#### 现状：设计上留了正解，实现上是空白

`apps/api/src/lib/kb-client.ts` 文件头注释（原文）：

```
1. **不自研底层引擎**：文档解析、切片、向量化、检索全部由外部知识库负责
2. **不内嵌服务**：本系统不部署、不打包 RAGFlow/MaxKB，只作为 HTTP 客户端
3. **优雅降级**：未配置或服务不可达时，AI 助手主链路完全不受影响
4. **使用者自部署**：部署 leyova 的人填写自己部署的 RAGFlow 地址即可接入
```

配置项：`kb.provider`（ragflow/maxkb/none）、`kb.baseUrl`、`kb.apiKey`、`kb.datasetIds`、`kb.topK`、`kb.similarityThreshold`，来源优先级「数据库 `ai_config` 表 > 环境变量」。

**实测**：`ai_config` 表 **0 行** → 知识库完全未配置，`kb-client` 处于「优雅降级」状态（即不起作用）。

#### 缺口清单

| 项 | 现状 |
|---|---|
| Milvus / Chroma | **0 处引用**（`package.json` 全文扫无命中） |
| pgvector | **0 处引用** |
| embedding 模型 | 无配置项 |
| 商品资料向量化 | 无 |
| 直播回放向量化 | 无（且无回放存储） |
| 爆款脚本向量化 | 无（且 `script_library` 96 行未向量化） |
| 违禁词库向量化 | 无（违禁词只有 `PROHIBITED_TERMS` 12 个硬编码数组） |
| 持续迭代机制 | 无 |

#### 落地路径（推荐）

**不要自建 Milvus/Chroma。** 系统设计原则已经写明「不自研引擎」，且自建向量库的运维成本对 SME 交付形态（私有化单机）是纯负担。

推荐：**部署一套 RAGFlow**（Docker 单机，含 embedding + 向量库 + 检索），然后把四类资料灌进去：

| 资料 | 来源 | 状态 |
|---|---|---|
| 商品资料 | `dim_product` 20 条 + 商品详情 | 数据在，待灌 |
| 爆款脚本 | `script_library` 96 行 | 数据在，待灌 |
| 违禁词库 | `PROHIBITED_TERMS` 12 条 + 各平台规则 | 数据薄，待扩 |
| 直播回放 | 无 | **缺数据源**，需先解决回放存储与 ASR |

接通动作：填 `ai_config` 三行（provider/baseUrl/apiKey）+ 在 AI 助手的系统提示里加「先检索知识库再回答」。**这条路径已经铺好，只差部署和配置。**

如果确实要 Milvus/Chroma：需改写 `kb-client.ts` 增加 provider，并把 embedding 调用链补上——**不推荐，与既有设计原则冲突**。

---

### 需求 4：提示词体系 + AI SOP + 内部培训

#### 现状：全缺

| 项 | 现状 | 证据 |
|---|---|---|
| 提示词注册表 | **无** | 全库扫 `%prompt%` 表名，**0 命中**；`ai_config` 表 0 行 |
| 提示词版本化 | **无** | 无 `prompt_template` 表 |
| 提示词与代码的关系 | **硬编码散落** | `campaign-plan-service.ts:123-127`（话术模板，PROHIBITED_TERMS 在 :32-45）、`ai/engine/planner/*`（规则规划）、`register-*.ts`（工具 description） |
| AI 使用 SOP | **无** | 无文档 |
| 培训材料 | **无** | 无文档 |
| 验收标准 | **无** | 无文档 |

唯一与「提示词」字面相关的文件是 `apps/api/src/ingest/platform-templates.ts`——那是**数据清洗的平台字段映射模板**，与 AI 提示词无关。

#### 缺口清单

1. 提示词无集中管理：改一句系统提示要改代码、重新部署
2. 提示词无版本：无法 A/B、无法回滚、无法知道「哪个版本效果好」
3. 无效果回流：AI 产出被采纳/拒绝没有记录，无法迭代
4. 无 SOP：运营/剪辑/投流团队不知道能问什么、怎么验收
5. 无培训材料

#### 落地路径

1. **建 `prompt_template` 表**（code / version / content / scene / is_active / created_by），把散落的硬编码提示词收拢，AI 助手启动时从库里取。
2. **建 `ai_feedback` 表**（tool_log_id / adopted / reject_reason / business_result），接在现有 `ai_tool_logs` 后面——`generate_review` 产出的行动项被 `create_improvement_task` 落地时，就是天然的反馈点。
3. **SOP 文档三份**（给运营 / 剪辑 / 投流），内容就是「这个系统能问什么、哪些数字有证据血缘可以信、哪些没有、怎么验收」。**这一份我可以直接写，不需要改代码。**
4. **培训**：SOP 定稿后做一次内部分享；把「怎么提需求」写成模板（问题 → 期望指标 → 时间范围 → 平台/店铺）。

---

### 需求 5：持续迭代 Agent 链路 + 数字人直播 + 多 IP 账号并行

#### 5.1 持续迭代 Agent 链路

**现状**：
- ✅ 有 `ai/trace/recorder.ts`（调用追溯）
- ✅ 有 `critic.ts`（数字校验，容忍度 0.1%）
- ✅ 有 `ai_tool_logs` 表（记录 tool_name / risk_level / approval_status）
- ❌ 无效果回流（采纳率、业务结果）
- ❌ 无 A/B 机制
- ❌ 无自动迭代（提示词优化、工具选择优化）
- ❌ 无稳定性监控（成功率、P95 延迟、成本）

**缺口**：`FUSION-MASTER-PLAN.md` 定的运营指标（建议采纳率 ≥60%、行动项下场执行率 ≥50%）**目前一个都采不到**，因为没有反馈表。

**落地路径**：先建 `ai_feedback` 表（见需求 4），把「采纳率」这个第一指标跑起来，再谈自动迭代。**没有反馈数据的自动迭代是空转。**

#### 5.2 数字人直播

**现状**：0 代码。

**建议：明确不做。** 三个理由：
1. **合规**：与小红书工作区的红线直接冲突（不做虚假人设、不批量起号）。数字人直播在平台侧属高风险行为，抖音/视频号对无人直播有明确处罚规则。
2. **交付形态**：`FUSION-MASTER-PLAN.md` 不做清单原文：「无人直播/纯 AI 驱动直播」——**计划里已经否决过**。
3. **成本**：数字人 API 按时长计费，SME 客户承担不起，且效果不如真人。

**如果确实有需求**，建议只做「数字人口播素材生成」——用 TTS + 虚拟形象生成短视频素材，由人工决定是否发布，**不触碰平台自动开播**。这个形态合规可控。

#### 5.3 多 IP 账号并行自动化

**现状**：0 代码（全库扫 `multi.*account`/`账号矩阵`/`ip_pool`，0 命中）。

**建议：明确不做。** 理由同数字人——账号矩阵是平台重点打击对象，且与小红书工作区「不做批量起号、账号矩阵、养号」的红线直接冲突。

**替代方案**：如果真实需求是「一个团队管多个直播间」，系统**已经支持**——5 个中控账号（`ctrl_douyin`/`ctrl_taobao`/`ctrl_xhs`/`ctrl_wechat`/`ctrl_wu`）就是多直播间并行的人工形态。要提效应该做「一个驾驶舱看多直播间」，而不是自动化多账号。

---

## 三、三档投入方案（供你决策）

### 档 1 · 低投入快见效（2-3 周）

| # | 事项 | 工作量 | 依赖 |
|---|---|---|---|
| 1 | LLM 多 Provider 切换（`LLM_PROVIDER` 枚举 + 按任务选模型：脚本用豆包、问数用 DeepSeek） | 1-2 天 | 无 |
| 2 | `campaign-plan-service.ts:123-127` 硬编码话术改为 LLM 生成 + `checkTextCompliance` 把关 + critic 数字校验 | 3-5 天 | 事项 1 |
| 3 | 部署 RAGFlow（Docker 单机）+ 灌商品资料/爆款脚本/违禁词 + 填 `ai_config` 接通 `kb-client` | 3-5 天 | 无 |
| 4 | 写三份 AI 使用 SOP（运营/剪辑/投流） | 2-3 天 | 无（我可以直接写） |

**档 1 完成后的状态**：直播脚本真由 AI 生成且过违禁词检查；AI 助手能检索商品与脚本知识库；团队知道怎么用。

### 档 2 · 中投入建闭环（6-8 周）

| # | 事项 | 工作量 | 依赖 |
|---|---|---|---|
| 5 | 建 `prompt_template` 表 + 提示词收拢 + 版本化 | 1 周 | 无 |
| 6 | 建 `ai_feedback` 表 + 接在 `ai_tool_logs` 后，采「建议采纳率」 | 1 周 | 无 |
| 7 | 直播闭环工作流：`generate_campaign_plan → 场次执行 → generate_review → create_improvement_task → 回流选品`，用 `system_jobs` + pg-boss 驱动 | 2-3 周 | **必须先启 Worker** |
| 8 | 高光切片（半自动）：按 `fact_session_metrics` 的 GPM/转化峰值自动标记时间段，导出时间码给剪映人工精剪 | 1-2 周 | 无 |
| 9 | 本地 Whisper ASR：直播回放 → 文字 → 违禁词扫描 → 复盘素材 | 2 周 | 需回放数据源 |

**档 2 完成后的状态**：你要的那条闭环链路真正跑通（除数字人/多 IP）；有反馈数据可迭代。

### 档 3 · 高投入（3 个月+，需你拍板，且部分建议不做）

| # | 事项 | 建议 | 理由 |
|---|---|---|---|
| 10 | 千川开放平台接入 | **排期做** | 需广告主授权 + 资质；阻塞在外部条件 |
| 11 | 剪映开放 API 全自动切片 | **暂缓** | 半自动方案（档 2 事项 8）已能满足业务目标 |
| 12 | 数字人直播 | **明确不做** | 合规红线 + 计划已否决 + SME 成本不可承受 |
| 13 | 多 IP 账号并行自动化 | **明确不做** | 合规红线；真实需求用「多直播间统一驾驶舱」满足 |

---

## 四、需要你决策的问题

1. **档 1/2/3 选哪档？** 还是先只做档 1 的某几项？
2. **LLM 供应商**：豆包、通义、DeepSeek 都要，还是先用一家跑通？（影响事项 1 的设计）
3. **RAG 部署**：接受「部署一套 RAGFlow、系统只做客户端」的路线，还是坚持要 Milvus/Chroma 内嵌？（强烈建议前者）
4. **数字人与多 IP**：接受「明确不做」的结论，还是确有业务理由必须做？（若必须做，需单独讨论风控与合规方案）
5. **回放数据源**：直播回放文件目前存在哪？没有回放就没有 ASR、没有高光切片的输入。

---

## 五、证据索引

| 结论 | 证据位置 |
|---|---|
| 无 LangGraph/CrewAI/Dify/Coze | `apps/api/package.json` / `package.json` 全文扫描 0 命中 |
| 自研编排引擎 | `apps/api/src/ai/engine/{planner,executor,critic,reporter}` |
| 29 个受控工具 | `apps/api/src/ai/register-{default,insight,review-task,selection}-tools.ts` |
| 话术是硬编码非 LLM 生成 | `apps/api/src/services/campaign-plan-service.ts:123-127`（无 `llm`/`chat()` 调用） |
| 违禁词只有 12 个硬编码 | `apps/api/src/services/campaign-plan-service.ts:32-45` `PROHIBITED_TERMS` |
| LLM 已支持豆包/通义 | `apps/api/src/ai/llm/openai-compatible.ts:1-9` 文件头注释 |
| LLM env 配置项 | `apps/api/src/config/env.ts:23-30` |
| 知识库是外部客户端、未配置 | `apps/api/src/lib/kb-client.ts:1-17`；`ai_config` 表 0 行 |
| 平台 OpenAPI 真实可用 | `apps/api/src/modules/data-governance/adapters/platform-adapters.ts:6` |
| 合规采集器是 MOCK | `apps/api/src/modules/compliance/collector/douyin.ts:15-17`（`fetch()` 返回硬编码字符串，不发 HTTP） |
| 千川/剪映/数字人/ASR 全未接 | 全文扫描 0 命中（`asr` 命中项为 `hasRangePartitionBound` 子串误报） |
| 人群标签无表 | 全库 `%tag%`/`%crowd%`/`%audience%`/`%persona%` 表名 0 命中 |
| 高光切片无代码 | 全文扫 `highlight`/`clip`/`切片`/`回放`，命中项均为 AI 追溯与数据清洗，与视频无关 |
| 计划已否决数字人/多 IP | `docs/newsystem/FUSION-MASTER-PLAN.md` §1.3 不做清单、§0.2 裁决 4 |
| 计划已定「自研执行器」 | `docs/newsystem/FUSION-MASTER-PLAN.md` §0.2 裁决 4 原文 |
