# AI 相关面清点与第三方 API 核对（2026-11-19）

## 1. 三套 AI 面并存
| 面 | 位置 | 状态 |
|---|---|---|
| A. 真身 | `apps/api/src/ai/` | ✅ 运行中。engine（planner/executor/critic/reporter）+ 语义层 839 行 + 29 工具 + `/mcp` Streamable HTTP |
| B. 孤儿服务 | `apps/mcp-server/` | ⚠️ 运行中（:9101，21 工具），**全仓无任何调用方**（`grep -rn "9101" apps/web/src apps/api/src` → 0 命中，排除 config/env.ts） |
| C. 骨架 | `ai-ops/` | ❌ README 宣称「O0 地基已完成」（身份系统/三维权限/指标注册/Decision Case/outbox/幂等/模块 manifest 全部打勾），实际 `src/` **只有 1 个文件 `config.ts`**，7 个 DB 迁移，从未与 web 接线 |

注：`apps/mcp-server` 名为 MCP 实为**自定义 HTTP JSON 工具服务器**（`index.ts` 用 `node:http`，非 `@modelcontextprotocol/sdk`）；
真正的 MCP 实现在 `apps/api/src/ai/mcp-server.ts`（用 `McpServer` + `StreamableHTTPServerTransport`，挂在 `/mcp`）。

## 2. 多 Agent 框架依赖核对
```
grep -rn "langgraph\|crewai\|dify\|coze" apps/api/package.json package.json
→ 0 命中
```
→ **无任何外部编排框架**。现有的是自研确定性编排。

## 3. 已注册的 29 个受控工具（去重后）
出处：`apps/api/src/ai/register-{default,insight,review-task,selection}-tools.ts`
```
analyze_anchor            compare_sessions          create_improvement_task
generate_campaign_plan    generate_review           generate_selection_plan
get_anchor_kpi            get_anchor_list           get_anchor_performance
get_anchor_profile        get_anchor_rank           get_anomalies
get_bi_dashboard          get_bi_snapshot           get_bi_trend
get_business_overview     get_business_trend        get_channel_performance
get_channel_roi           get_channel_trend         get_funnel_analysis
get_improvement_tasks     get_live_session_metrics  get_live_sessions
get_live_summary          get_product_conversion    get_product_mix
get_product_ranking       get_product_sales         get_refund_analysis
get_review_overview       get_roi_analysis          get_room_health
get_session_anomalies     get_session_metrics       get_task_overview
list_pending_tasks        update_task_status
```
（`apps/mcp-server` 那 21 个是另一套，无调用方。）

注：清单由 `grep -h "name: '" apps/api/src/ai/register-{default,insight,review-task,selection}-tools.ts | sort -u` 得出；
其中 `register-selection-tools.ts` 只注册 2 个且与 review-task 重复，已去重。

## 4. 第三方 API 接通状态
| API | 状态 | 证据 |
|---|---|---|
| DeepSeek / 通义千问 / 豆包 / Ollama / vLLM | ✅ **已接通** | `ai/llm/openai-compatible.ts:1-9` 文件头：「单一实现对接 DeepSeek、Qwen 通义千问、豆包、Ollama 与自建 vLLM」。改 `LLM_API_BASE`+`LLM_MODEL` 即可切换 |
| 抖音/快手/淘宝/天猫/视频号/小红书 开放平台 | ✅ **已接通** | `modules/data-governance/adapters/platform-adapters.ts:6`：「7 大平台均通过真实 fetch() 与官方签名算法完成 OAuth 授权码换 Token、Token 刷新、订单增量拉取与售后退款拉取」 |
| 千川（投放） | ❌ 未接 | `grep -rn qianchuan` 命中均为文案提及，无 API 客户端。`fact_ad_spend_daily` 140 行靠手工上传 |
| 剪映开放 API | ❌ 未接 | `grep -rn "jianying\|capcut"` → 0 命中 |
| 数字人 | ❌ 未接 | `grep -rn "digital\|avatar\|虚拟人"` 命中 `register-selection-tools.ts`/`selection-service.ts`，实为选品降级策略名，非数字人 |
| ASR | ❌ 未接 | `grep -rn "asr\|speech"` 命中 `manage-partitions.ts`/`validation-service.ts`/`cleaner-service.ts`，实为 `hasRangePartitionBound` 子串误报。真 0 代码 |

LLM 相关 env（`apps/api/src/config/env.ts:23-30`）：
```
AI_ENABLED (default false)   LLM_API_BASE (default http://127.0.0.1:11434/v1)
LLM_API_KEY                  LLM_MODEL (default deepseek-chat)
LLM_TIMEOUT_MS (60000)       ANYTHINGLLM_API_BASE / ANYTHINGLLM_API_KEY
```

## 5. 向量知识库现状
- `apps/api/src/lib/kb-client.ts` 是**外部 RAG 客户端**（RAGFlow / MaxKB 兼容），文件头设计原则：
  「不自研底层引擎 / 不内嵌服务 / 优雅降级 / 使用者自部署」
- 配置项：`kb.provider`(ragflow|maxkb|none) / `kb.baseUrl` / `kb.apiKey` / `kb.datasetIds` / `kb.topK` / `kb.similarityThreshold`，来源「DB `ai_config` 表 > 环境变量」
- **实测 `ai_config` 表 0 行** → 知识库未配置，`kb-client` 处于优雅降级（不起作用）状态
- `grep -rn "milvus\|chroma\|pgvector"` → **0 命中**（package.json 与 src 全文）
- 无 embedding 配置项
- 人群标签：全库扫 `%tag%`/`%crowd%`/`%audience%`/`%persona%` 表名 → **0 命中**

## 6. 提示词体系现状
- `grep -rn "prompt_template\|提示词\|promptVersion"` 唯一命中 `apps/api/src/ingest/platform-templates.ts` —— 那是**数据清洗的平台字段映射模板**，与 AI 提示词无关
- 全库扫 `%prompt%` 表名 → **0 命中**；`ai_config` 0 行
- 提示词硬编码散落处：`campaign-plan-service.ts:123-127`（话术模板）、`ai/engine/planner/*`（规则规划）、`register-*.ts`（工具 description）

## 7. 「直播脚本生成」是真 AI 还是模板？
`apps/api/src/services/campaign-plan-service.ts` 的 `generateCampaignPlan()` 产出 12 模块方案，其中 m5 是话术库：
```ts
// :123-127
const scripts = {
  title: '主播核心话术库',
  opening: `欢迎各位来到${shop.shop_name}官方直播间！今天不讲虚的，全场换季爆款现货顺丰直发！`,
  hookAndHold: '左下角 1 号链接是今天专属福利款，主播手上的福利码还剩最后 50 份，扣【1】马上解锁！',
  pitch: '这款选用优质高支高密面料，亲肤透气不臃肿，专柜同等品质今天直播间直接砍掉中间商差价！',
  urgency: '这批货是当季现货直发，抢完立即转预售排期 15 天！倒数 3、2、1，直接改价上车！',
}
```
全文件无 `llm` / `chat()` 调用 → **纯模板字符串，不是 LLM 生成。**

违禁词检查是真的但很薄：`PROHIBITED_TERMS`（:32-45）只有 12 个绝对化用语硬编码数组。

## 8. 高光切片 / 直播回放
`grep -rn "highlight\|clip\|切片\|回放"` 命中项：
- `ai/trace/recorder.ts` —— AI 调用追溯，与视频无关
- `ingest/cleaner/rules.ts` / `engine.ts` —— 数据清洗规则
- `campaign-plan-service.ts` / `kb-client.ts` —— 文案提及
→ **无任何视频处理代码。**

## 9. 合规采集器是 MOCK
`apps/api/src/modules/compliance/collector/douyin.ts:15-17`：
```ts
async fetch(url: string, externalId?: string): Promise<RulePage | null> {
  const content = `抖音电商直播间治理专项规定：严禁使用绝对化用语，功效宣传须具备国家药监局备案。...`
  return { platformCode: this.platformCode, sourceUrl: url, ..., fetchMethod: 'headless', ... }
}
```
→ `fetch()` **不发 HTTP，返回硬编码字符串**。6 个平台采集器（douyin/kuaishou/taobao/wechat/xiaohongshu）同此模式。
→ 「平台规则雷达」「违规事件看板」两个导航项背后的数据是写死的演示文本。

## 10. 持续迭代 / 反馈回流
- ✅ 有 `ai/trace/recorder.ts`（调用追溯）、`critic.ts`（数字校验，容忍度 0.1%）、`ai_tool_logs` 表
- ❌ 无 `ai_feedback` 表、无采纳率统计、无 A/B、无自动迭代
- `FUSION-MASTER-PLAN.md` 定的运营指标（建议采纳率 ≥60%、行动项下场执行率 ≥50%）**目前一个都采不到**
