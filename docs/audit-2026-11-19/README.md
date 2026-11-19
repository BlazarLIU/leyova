# Leyova 全系统审计（2026-11-19）

> 审计对象：`/home/leyova`（Leyova 乐播云 · 全渠道电商数字化运营中枢）
> 审计轮次：第三轮（前两轮：`../audit-2026-11-16/`、`../audit-2026-11-18/`）
> 本轮同时完成：Gemini 版审计（`/home/odlive/.gemini/antigravity/brain/173535d2-*/full-system-audit-plan.md`，23 条）逐条校订 + 5 项 AI 能力差距评估
> **本目录全部为只读审计产出，不含任何代码/配置/数据库修改。**

---

## 怎么读这份审计

**只有 10 分钟**：读 `00-EXECUTIVE-SUMMARY.md`（一句话结论 + 五个最硬问题 + 三句话建议）。

**要动手改**：读 `60-IMPROVEMENT-PLAN.md`（P0/P1/P2/P3 分级，每项含证据/改法/影响面/验收/是否需决策），
按第④节「执行顺序建议」排期。**P0-2、P1-4、P1-5、P2-1、P3 全部需要老大先决策。**

**要核对某个具体问题**：按下面的索引直接跳。

---

## 文档索引

| 文档 | 对应你的问题 | 行数 |
|---|---|---:|
| [`00-EXECUTIVE-SUMMARY.md`](00-EXECUTIVE-SUMMARY.md) | 总判断 | 145 |
| [`10-MODULE-BUSINESS-FIT.md`](10-MODULE-BUSINESS-FIT.md) | ① 各模块/分组是否真实贴近业务 | 274 |
| [`20-PLATFORM-SWITCH-MATRIX.md`](20-PLATFORM-SWITCH-MATRIX.md) | ② 切平台后能否对应显示 | 225 |
| [`30-RUNTIME-USABILITY.md`](30-RUNTIME-USABILITY.md) | ③ 每个功能能否在真实场景正常使用 | 326 |
| [`40-REDUNDANCY-AND-REGROUPING.md`](40-REDUNDANCY-AND-REGROUPING.md) | ④ 多余/重复功能 + 重新分组 | 168 |
| [`50-RELATIONSHIP-GRAPH.md`](50-RELATIONSHIP-GRAPH.md) | ⑤ 功能作用与关联 + 关系图谱 | 313 |
| [`60-IMPROVEMENT-PLAN.md`](60-IMPROVEMENT-PLAN.md) | ⑥ 详细分析改进计划 | 254 |
| [`70-GEMINI-AUDIT-REVIEW.md`](70-GEMINI-AUDIT-REVIEW.md) | Gemini 版 23 条逐条校订 | 252 |
| [`80-AI-CAPABILITY-GAP.md`](80-AI-CAPABILITY-GAP.md) | 你要的 5 项 AI 能力能否做到 | 359 |

## 证据目录（`_evidence/`）

| 文件 | 内容 |
|---|---|
| [`01-quality-gates.md`](_evidence/01-quality-gates.md) | 质量门禁实测：openapi ✅ / guardrails ✅ / tsc ✅ / api test ⚠️143+17cancelled / web test ✅ / schema drift ❌ / Worker ❌ |
| [`02-table-rowcounts.md`](_evidence/02-table-rowcounts.md) | 25 张表行数实测 + 417 行坏商品名根因 + 店铺授权分布 |
| [`03-platform-capabilities.md`](_evidence/03-platform-capabilities.md) | 6 平台能力同构实测 + capability matrix 198 行全 true + 10 个洞察端点数据实况 |
| [`04-permission-matrix.md`](_evidence/04-permission-matrix.md) | 角色模型漂移 + 中控 403 实测 + module-guard 7 个漏配路径 |
| [`05-ai-surface-inventory.md`](_evidence/05-ai-surface-inventory.md) | 三套 AI 面 + 29 工具清单 + 第三方 API 核对 + 向量库/提示词现状 |
| [`06-aiops-silent-failure.md`](_evidence/06-aiops-silent-failure.md) | AI-Ops 8 处静默失败 + 5 个全硬编码页面 + 3 个洞察页配置失配 |
| [`07-reproduce.sh`](_evidence/07-reproduce.sh) | **一键复现脚本**（只读） |

复现方式：
```bash
cd /home/leyova && bash docs/audit-2026-11-19/_evidence/07-reproduce.sh
```

---

## 五个最硬的问题（速览）

1. **角色模型三处漂移** — `Layout.tsx:77-79`、`RequireAiOpsAccess.tsx:17-29` 硬编码 `admin/operator/finance`，DB 里没有这三个角色。后果：中控能进财务页、真财务进不了、投手/拍剪/客服后端进不了 AI-Ops。
2. **多平台差异化名存实亡** — `platform_capability_matrix` 198 行全 true、6 适配器能力同构、`modulesByPlatform` 六平台逐字节相同。切平台只变 22/90 个导航项。
3. **AI-Ops 静默展示假数据** — `ai-ops-data.ts` 8 处静默失败 + 硬编码兜底（GMV 142000、gpm 用索引数学现推）；5 个页面 100% 写死。
4. **417 行坏商品名** — `session_plan_products` 446 行中 417 行是 `[object Object]精选-X款`（`generate.mjs:381`）。
5. **CI 绿灯但本地红** — api test 143 pass / 17 cancelled；schema 漂移；Worker 停摆（聚合/巡检/异常检测全停）。

## 已修正的勘误

审计过程中发现并修正的自身错误（保持记录可追）：
- `generate.mjs` 行号 378 → **381**（`products.push` 在 224，`${p.cat}` 在 381）
- `PROHIBITED_TERMS` 行号 33-46 → **32-45**
- 受控工具数 28 → **29**（去重后精确统计）
- 语义层指标数 27 → **30**（`METRIC_REGISTRY` 实测）
- `fetchAnchorPerformanceList` 建议接口 `/anchors/performance` → **`/anchors/:id/performance`**
- 40 号文档中「问题库/改进任务移入内容面」的归属矛盾 → 已修正为保留在「今日作战台」
