# 07 · AI 能力差距（对照 5 项标准）

> 判定口径：✅ 达标 / 🟡 部分达标 / ❌ 未达标。
> 所有「有/无」均以本仓库代码与运行时为准，不按宣传口径。

## 结论速览

| # | 标准 | 判定 | 一句话 |
|---|---|---|---|
| 1 | 多 Agent 业务工作流（LangGraph/CrewAI/Dify/Coze）落地直播闭环 | 🟡 | 有自研编排 + 29 个工具 + 可追溯契约，但**不是多 Agent**，且 LLM 关闭，实际只跑规则 |
| 2 | 第三方 API（豆包/通义/抖音/千川/剪映/数字人/ASR） | 🟡 | 抖音/淘宝/天猫/小红书/视频号/快手 有**真实签名代码**；千川/剪映/数字人/ASR **零实现**；豆包/通义只有 OpenAI 兼容壳且未配置 |
| 3 | 向量知识库（Milvus/Chroma） | ❌ | 无向量库、无 embedding 表；仅有 Ollama `nomic-embed-text` 未接线 |
| 4 | 提示词体系 + AI 使用 SOP + 培训 | ❌ | 无 prompt 表、无版本管理、无 SOP/培训载体 |
| 5 | 持续迭代 + 数字人 + 多 IP 并行 | 🟡 | 有评测/告警/任务/轨迹，但**无数字人、无多 IP 矩阵** |

---

## 标准 1：多 Agent 业务工作流

### 现状

- **未使用** LangGraph / CrewAI / Dify / Coze：`apps/api/package.json` 无相关依赖。
- 自研编排链：`ai/engine/orchestrator.ts` + `planner/rule-planner.ts` + `executor.ts` + `critic.ts` + `reporter/`。
- 工具层真实：`ai/tool-registry.ts` + 3 个 `register-*` 文件，注册 **29 个工具**（`get_live_sessions`、`get_funnel_analysis`、`generate_selection_plan`、`generate_campaign_plan`、`generate_review`、`create_improvement_task`、`update_task_status` 等）。
- **但写工具全部不可用**：`write_with_approval` 只建 pending 不执行，`/ai/approve` 后又进 pending（`ai/tool-registry.ts:101-130`、`routes/ai.ts:599-670`）→ `ai_action_approvals` 0 行。4 个生成/写工具形同占位。
- 另有 1 个工具本身是坏的：`get_anchor_profile` 引用不存在的列（`register-default-tools.ts:78-108`），调用即 SQL 报错。
- 可追溯契约真实：`ai/contract/*`（plan / claim / evidence / trace），DB 有 `ai_v2_run` 3648、`ai_v2_step` 5244、`ai_v2_claim` 19983、`ai_v2_evidence` 42531；verdict 3499 verified / 149 rejected。
- 但：`ai_v2_run` 中 `engine=rule` 占 **100%**，`engine=llm` 为 **0**；`.env` `AI_ENABLED=false`；默认模型 `deepseek-chat` 在 Ollama 中不存在。

### 差距

| 直播闭环环节 | 系统能力 | 差距 |
|---|---|---|
| 商品入库 → RAG 知识库 | 无 | 无向量化入库 |
| 直播脚本生成 | `generate_campaign_plan` 工具存在，但走规则/模板 | 无 LLM 生成、无 prompt 版本 |
| 短视频文案生成 | 无专用工具 | 缺 |
| 直播高光切片 | `AiOpsClips` 为写死 6 条 | 无 ASR、无切片服务 |
| 投流数据分析复盘 | `get_roi_analysis`、`generate_review` 存在 | 千川无接入，数据只有花费 |
| 数据回流迭代提示词/人群标签 | 有 `ai_eval_run`，无 prompt 回流 | 缺闭环 |

### 三档方案

| 档位 | 内容 | 适合 |
|---|---|---|
| MVP（不自建框架） | 用现成 Dify 或 Coze 搭 3 条工作流：①商品资料→脚本 ②场次数据→复盘 ③爆款拆解→选题；系统只提供只读 API/MCP 作为工具 | 1–2 周验证价值 |
| 标准 | 保留现有 orchestrator，把 `rule-planner` 升级为「LLM planner + 工具调用」，新增 3 个角色化 Agent（选品、脚本、复盘），共用 trace/claim/evidence | 1–1.5 月 |
| 进阶 | LangGraph 编排多 Agent + 人工审批节点 + 失败重试 + 知识库检索 | 1 季度 |

**建议**：先做 MVP。现有 29 个工具与 MCP server（`ai/mcp-server.ts`）已经把「系统能力」暴露出来了，接 Dify/Coze 的成本远低于自研多 Agent。

---

## 标准 2：第三方 API 对接

### 已有（代码级真实）

| 能力 | 文件 | 真实度 |
|---|---|---|
| 抖音 OAuth/订单/售后 | `modules/data-governance/adapters/platform-adapters.ts:181-270` | ✅ HMAC-SHA256 签名 + `fetch` |
| 快手 OAuth/订单 | 同文件 `:315-450` | ✅ |
| 淘宝/天猫 OAuth/订单 | 同文件 `:439-574` | ✅ |
| 小红书 OAuth/订单 | 同文件 `:574-707` | ✅ |
| 视频号小店 | 同文件 `:707+` | ✅ |
| 大模型 | `ai/llm/openai-compatible.ts` | 🟡 OpenAI 兼容协议，可指向任意厂商；但无 key、`AI_ENABLED=false` |
| MCP | `ai/mcp-server.ts` | ✅ 已有工具化出口 |

### 缺失（零实现）

| 能力 | 检索结果 | 影响 |
|---|---|---|
| 千川（巨量引擎） | 仅文案提及，无代码 | 投放 ROI/素材归因无法真实 |
| 剪映开放 API | 无 | 无法批量成片 |
| 数字人 | 无 | 无法数字人直播 |
| ASR 语音识别 | 无 | 无法直播转写/切片 |
| 豆包/通义专用 SDK | 无（仅 OpenAI 兼容） | 需按厂商协议适配 |

### 三档方案

| 档位 | 内容 |
|---|---|
| MVP | 先把 LLM 指向本地 Ollama（`llama3.1:8b` 或 `glm4:9b`）+ 开通一个平台真实店铺授权，跑通「同步→复盘」 |
| 标准 | 接千川（投放）+ ASR（阿里/讯飞）两条，补素材级归因表 |
| 进阶 | 剪映批量成片 + 数字人（按供应商评估） |

**注意**：抖音自研型应用只能自用，服务商型有资金/人员门槛；淘宝自研仅限天猫卖家（基准 §3）。这不是技术问题，是资质问题，需决策。

---

## 标准 3：向量知识库

### 现状

- 无 Milvus / Chroma / pgvector / qdrant / weaviate 依赖。
- DB 无 `vector` / `embedding` / `knowledge` 相关表。
- `lib/kb-client.ts` 只是转发到外部 RAG 服务（RAGFlow/AnythingLLM），`/kb/status` → `configured=false, provider=none, degraded=true`。
- 本地 Ollama 有 `nomic-embed-text`（嵌入模型），但没有任何代码调用它做向量化。
- 素材资产在 `script_library`（96 行），未向量化。

### 缺少的功能

1. 商品资料 → 分块 → 嵌入 → 入库。
2. 直播回放/爆款脚本 → ASR 转写 → 分块 → 入库（依赖标准 2 的 ASR）。
3. 违禁词库版本化 + 检索。
4. 检索接口（top-k + rerank）。
5. 增量更新与失效。

### 三档方案

| 档位 | 内容 |
|---|---|
| MVP | `pgvector`（已有 PG，改造成本最低）+ `nomic-embed-text`；先向量化 `script_library` 96 条与商品资料 |
| 标准 | 独立 collection：商品/脚本/回放/违禁词；加 rerank；接检索到 AI 工具层 |
| 进阶 | Milvus（数据量 > 百万或需多租户隔离时） |

**建议**：不要一上来上 Milvus。当前数据量（96 条脚本、几百 SKU）用 pgvector 足够。

---

## 标准 4：提示词体系 + SOP + 培训

### 现状

- 无 `prompt_template` / `prompt_version` 表。
- `ai.ts` 中 `prompt_version` 硬编码 `'v2.0'`。
- 无 prompt 变量、渲染、A/B、回滚。
- 无 SOP 文档载体（系统内），无培训记录表（`anchor_training_records` 0 行）。
- AI 产出有 trace（claim/evidence），但没有「人工修改率」「失败样本库」的统计。

### 缺少的功能

1. Prompt registry：模板、变量、版本、生效范围、灰度。
2. 每次运行记录 `prompt_template_id + version`（现在只有硬编码字符串）。
3. 人工修改率：AI 产出 → 人工编辑 → diff 统计。
4. 失败样本库：从 `ai_eval_run` 失败用例沉淀。
5. SOP：选品/脚本/复盘三类标准作业程序，嵌入系统帮助。
6. 培训：新人路径、考核、答疑库。

### 三档方案

| 档位 | 内容 |
|---|---|
| MVP | 建 `prompt_template` 表 + 3 个模板（选品/脚本/复盘）+ 运行记录版本号 |
| 标准 | 加 A/B、回滚、人工修改率、失败样本库；写 3 份 SOP 并挂到页面帮助 |
| 进阶 | 提示词效果看板 + 自动优化建议 |

---

## 标准 5：持续迭代 + 数字人 + 多 IP

### 现状

| 子项 | 状态 |
|---|---|
| 持续迭代 | 🟡 有 `ai_eval_run` 3420、`ai_v2_run` 轨迹、`alert_events`、`goal_tracking`、`system_jobs` |
| 稳定性 | 🟡 `system_jobs` 147 条全 completed（无失败样本），缺少真实失败演练；worker 未注册 |
| 数字人 | ❌ 无 |
| 多 IP 账号并行 | ❌ 无账号/设备/内容矩阵表 |
| 可复用自动化工具 | 🟡 29 个 AI 工具可复用，但未沉淀为对外工具目录 |

### 缺少的功能

1. 稳定性：失败注入、重试、断流检测、任务超时、补偿。
2. 数字人：供应商选择、脚本驱动、直播推流、合规标识（AI 生成内容持续标识）。
3. 多 IP：账号池、设备指纹、内容去重、发布排期、风控。
4. 工具目录：把现有 29 个工具整理为可被 Dify/Coze 调用的 OpenAPI。

### 三档方案

| 档位 | 内容 |
|---|---|
| MVP | 工具目录 + 失败重试 + 断流告警（不碰数字人） |
| 标准 | 数字人 POC（单账号、固定场景）+ 多 IP 账号表 |
| 进阶 | 数字人规模化 + 多 IP 自动化编排 |

---

## 缺口功能清单（按标准汇总）

| 标准 | 必须新建的功能 | 可直接复用的现有资产 |
|---|---|---|
| 1 | LLM planner、角色化 Agent、人工审批节点 | `orchestrator`、29 工具、trace/claim/evidence、MCP server |
| 2 | 千川客户端、ASR 客户端、剪映客户端、数字人客户端、云 LLM key 管理 | 已有 5 平台 OAuth 签名、OpenAI 兼容层 |
| 3 | pgvector 库、分块器、嵌入任务、检索接口、违禁词版本 | `script_library`、Ollama embedding、PG |
| 4 | prompt 表 + 版本 + A/B、人工修改率、失败样本库、SOP 页面 | `ai_eval_run`、`ai_v2_*` |
| 5 | 失败注入/重试、数字人、账号矩阵、工具目录 | `system_jobs`、`alert_events`、29 工具 |

## 最终判定

- **能做的**：AI 问答（规则）、复盘、选品建议、任务闭环、29 个工具的查询能力——这些**现在就能用**。
- **做不到的**：多 Agent 协作、LLM 生成内容、RAG 知识库、千川/剪映/ASR/数字人、提示词体系、多 IP。
- **最短路径**：先开 LLM（本地模型即可）+ pgvector + Dify/Coze 三个工作流，用现有 MCP 工具做后端，1–2 周可看到「AI 生成脚本 + 复盘」的真实闭环。
