# 维度 6：改进计划

> 分级原则：**P0 = 生产库已在展示错误内容，不依赖外部条件**；**P1 = 需老大决策**；**P2 = 架构收敛**；**P3 = AI 能力扩建（按档位选择）**。
> 每项含：问题证据 / 改法 / 影响面 / 验收方式 / 是否需决策。
> **本计划不包含执行。是否开工、按什么顺序，等你逐项批准。**

---

## P0 — 立刻做，不依赖任何外部条件（7 项）

### P0-1 修演示数据生成器的对象字符串化 bug

| 项 | 内容 |
|---|---|
| **证据** | `session_plan_products` 446 行中 **417 行** `product_name` = `[object Object]精选-X款`；根因 `database/demo/generate.mjs:381` `products.push({..., cat })` 后使用 `${p.cat}` |
| **改法** | ① `generate.mjs:381` 改为 `${p.cat.name}`；② 写一次性清洗 SQL：`UPDATE session_plan_products SET product_name = regexp_replace(...) WHERE product_name LIKE '%[object Object]%'`（需从 `dim_product` 反查正确类目名） |
| **影响面** | 排品编辑页、货盘结构分析、复盘商品分析、`/sessions/:id/slots` 接口 |
| **验收** | `SELECT count(*) FROM session_plan_products WHERE product_name LIKE '%[object Object]%'` = 0；`/sessions/102/slots` 返回的 `skuTitle` 无 `[object Object]` |
| **需决策** | 否 |

### P0-2 角色模型归一（最严重）

| 项 | 内容 |
|---|---|
| **证据** | `Layout.tsx:77-79`、`RequireAiOpsAccess.tsx:17-29` 硬编码 `admin/operator/finance` —— DB 无这三个角色；后果：中控能进财务页、真财务（`finance_chen`/`ad_buyer`）进不了财务页、`ad_buyer/video_editor/cs_agent` 进不了 AI-Ops、`Sidebar.roleLabels` 缺 `video_editor`/`cs_agent` |
| **改法** | ① 以 DB `roles` 表为唯一事实源，把前端硬编码角色名全部改为 DB 实际角色码；② `controller` 从 `FINANCE_ALLOWED_ROLES` 移出；③ 把 `ad_buyer`/`video_editor`/`cs_agent` 加入 `AI_OPS_ALLOWED_ROLES`（按 11-18 报告给他们配模块的意图）；④ `Sidebar.roleLabels` 补 `video_editor`/`cs_agent`，删不存在的 `admin/operator/finance/employee/brand_viewer` |
| **影响面** | 全部角色的菜单可见性 + 财务页准入 + AI-Ops 准入 |
| **验收** | 六个账号（admin/ctrl_douyin/operator_wang/hr_li/video_lin/cs_qian）登录后：中控看不到 P&L 入口、`finance_chen` 能看到、video_lin/cs_qian 能进 AI-Ops；`/auth/me` 的 modules 与侧栏显示一致 |
| **需决策** | **是** —— 财务角色归属：新建 `finance` 角色，还是给 `ad_buyer` 开 `cost_visibility` 模块？ |

### P0-3 补齐 module-guard 的 7 个漏配路径

| 项 | 内容 |
|---|---|
| **证据** | 实测 `operator_wang`：`/scripts/templates` 403、`/metrics` 403、`/finance/accounting-subjects` 403；`module-guard.ts:201` 只豁免 `admin/ops_director/super_admin`，所以 ops_staff/ad_buyer/video_editor/cs_agent/controller 全被打 |
| **改法** | `MODULE_MAP` 补：`/api/v1/scripts/templates` → `ops`、`/api/v1/assortment/recommend` → `session_products`、`/api/v1/assortment/explain` → `session_products`、`/api/v1/metrics` → `bi`、`/api/v1/finance` → `net_roi` |
| **影响面** | 话术库、选品推荐、指标字典、财务科目对非管理角色恢复可用 |
| **验收** | `operator_wang` 打上述 5 个端点全部 200；话术库页面对 ops_staff 正常渲染 |
| **需决策** | 否 |

### P0-4 删除 weather 孤儿路由

| 项 | 内容 |
|---|---|
| **证据** | commit `4c97ec2` 删了前端天气页面，但 `routes/weather.ts` 两个端点仍在 `app.ts:205` 注册，且未进 `MODULE_MAP` |
| **改法** | 删 `routes/weather.ts` + `app.ts:52,205` 的 import/register |
| **影响面** | 减少 2 个孤儿端点 + 消除 fail-closed 噪音 |
| **验收** | `curl /api/v1/weather/cities` 返回 404；`openapi:check` 仍 0 漂移 |
| **需决策** | 否 |

### P0-5 干掉 AI-Ops 的「静默失败 + 假数据」

| 项 | 内容 |
|---|---|
| **证据** | `ai-ops-data.ts` 8 处 `catch { /* 静默失败 */ }` + 硬编码兜底；`fetchAnchorPerformanceList` 用 `gpm = 1500 + (10 - (i%10))*120` 索引数学伪造指标；5 个页面 100% `useState` 写死 |
| **改法** | ① 8 处 catch 改为「抛出明确错误 + 界面渲染失败态」；② `fetchAnchorPerformanceList` 删掉索引数学，改用 `/anchors/:id/performance` 真接口（逐个主播取真实绩效；批量场景先显示「暂无数据」，不要用索引推算）；③ 5 个全硬编码页面在 UI 显著位置标注「演示数据（非真实业务数据）」；④ 4 个可接真接口的页面（Cases/Clips/Campaigns/FinanceSettle）排期接真数据 |
| **影响面** | AI-Ops 全部 22 个页面的数据可信度 |
| **验收** | 断网/无权限时页面显示「数据加载失败」而非假数据；`AiOpsPeoplePage` 不再出现索引推算的 gpm |
| **需决策** | 否（「标注演示数据」是底线，接真接口可排 P3） |

### P0-6 修 3 个平台洞察页配置失配

| 项 | 内容 |
|---|---|
| **证据** | `findInsightConfig` 匹配不到 `/insights/tmall/promotion-layers`、`/insights/wechat/affiliate`、`/insights/wechat/content` → 渲染「未找到页面配置」空壳 |
| **改法** | `PlatformInsightConfig.ts` 给这 3 个配置补 `path: '/insights/...'` |
| **影响面** | 3 个平台洞察页恢复渲染 |
| **验收** | Node 复现 `findInsightConfig` 匹配逻辑，10 个导航路径全部 EXACT 或 STARTSWITH 命中；`frontend-integrity.test.mjs` 加一条「所有 PlatformInsightPage 导航项必须在 INSIGHT_PAGE_CONFIG 有配置」断言 |
| **需决策** | 否 |

### P0-7 让 17 个 cancelled 测试恢复

| 项 | 内容 |
|---|---|
| **证据** | `pnpm -F @leyova/api test` → 143 pass / 17 cancelled；`platform-adapters.test.ts` 因 `users_role_fkey` 外键违规（`operator` 角色不在 `roles` 表）整体中断 |
| **改法** | 二选一：① 在迁移里补 `operator` 角色种子（若该角色业务上需要）；② 改测试用现存角色（`ops_staff`） |
| **影响面** | 恢复 17 项测试覆盖；CI 与本地一致 |
| **验收** | `pnpm -F @leyova/api test` → cancelled 0，pass ≥ 160 |
| **需决策** | 否（推荐②，改动最小） |

---

## P1 — 需老大决策（6 项）

### P1-1 启动 Worker

| 项 | 内容 |
|---|---|
| **证据** | `ps aux` 无 `worker.ts` 进程；`ecosystem.config.cjs` 注册了 `leyova-worker` 但没起 |
| **改法** | `pm2 start ecosystem.config.cjs --only leyova-worker`（或按你的部署方式） |
| **影响面** | 聚合刷新、七段清洗、合规巡检、异常检测、分区维护、`system_jobs` 消费全部恢复 |
| **验收** | 进程在跑；`agg_shop_daily` 的 `max(biz_date)` 逐日推进；`alert_events` 行数随异常检测增长 |
| **需决策** | 否（但需确认部署方式） |

### P1-2 AI-Ops 导航补 module + 平台维度

| 项 | 内容 |
|---|---|
| **证据** | `ai-ops-navigation.ts` 28 项**零 module 字段**；超管在模块管理页关模块对 AI-Ops 无效；平台差异化对 AI-Ops 无效 |
| **改法** | 给每个 AI-Ops 项补 `module`（映射到现有 41 模块码）+ 可选 `platforms`；`buildAiOpsNavigation` 增加 `canSee(module)` 过滤 |
| **影响面** | AI-Ops 菜单与经典系统权限体系统一 |
| **验收** | 关掉 `content` 模块后，AI-Ops 的「内容排产与切片」消失；切到淘宝后 AI-Ops 不显示小红书专属项 |
| **需决策** | 否 |

### P1-3 双分支去重

| 项 | 内容 |
|---|---|
| **证据** | `/hrbp/workspace` 与 `/ai-ops/hrbp/workspace` 双注册同一组件（非 redirect）；`route-manifest.ts:95-101` 7 条复盘项是纯 redirect，AI-Ops 侧渲染同一批经典组件 |
| **改法** | ① HRBP 留一个入口，另一个设 redirect；② 删 7 条经典复盘 redirect 项 |
| **影响面** | 减少 14 个菜单入口中的 8 个冗余 |
| **验收** | 每个页面只有一个导航入口；`frontend-integrity.test.mjs` 仍绿 |
| **需决策** | 否 |

### P1-4 0 数据模块处置策略

| 项 | 内容 |
|---|---|
| **证据** | 仍 0 数据的模块：`search_seo`、`system_promotions`、`system_competitors`、`system_multiroom`、`compliance`、`content`、`content_schedule`、`kol`、`members` |
| **改法** | 三选一或组合：A) 生成 demo 数据让功能可体验；B) 加 `coming_soon` 标记从默认导航隐藏（保留深度链接）；C) 补手工录入引导（达人佣金、活动、竞品都可手工录） |
| **影响面** | 用户首次进入系统看到的是「可用 + 明确待开发」还是「一片空」 |
| **验收** | 无空页面；每个 0 数据模块要么有数据要么有「即将上线/去录入」引导 |
| **需决策** | **是** —— 选 A / B / C 哪种组合 |

### P1-5 合规采集器从 MOCK 改为真实或明确标注

| 项 | 内容 |
|---|---|
| **证据** | `collector/douyin.ts:15` 等 6 个 collector 的 `fetch()` 不发 HTTP，直接返回硬编码字符串，却标注 `fetchMethod: 'headless'` |
| **改法** | 二选一：① 接真实抓取（各平台规则中心，需处理反爬）；② **立即改**：把 `fetchMethod` 改为 `'manual'` 并在 UI 标注「示例规则，非实时采集」 |
| **影响面** | 「平台规则雷达」的数据可信度 |
| **验收** | 规则详情页明确显示数据来源；不再声称是无头抓取 |
| **需决策** | **是** —— 接真实抓取还是标注为示例 |

### P1-6 清理测试污染数据

| 项 | 内容 |
|---|---|
| **证据** | `users` 表 25 个 `__t_*` / `__res_*` 账号 |
| **改法** | 先确认无外键引用（`system_jobs`、`ai_tool_logs`、`audit_logs`），再 `DELETE`；同时给测试加 afterAll 清理 |
| **影响面** | 账号管理页列表干净 |
| **验收** | `SELECT count(*) FROM users WHERE username LIKE '\_\_%'` = 0；测试跑完后不新增污染账号 |
| **需决策** | 否 |

---

## P2 — 架构收敛（4 项）

### P2-1 平台差异化机制六套收敛为一套

| 项 | 内容 |
|---|---|
| **证据** | `platform_capability_matrix`(198 行全 true)、`LIVE_ONLY_MODULES`(18)、`LIVE_ONLY_ROUTES`(23)、`PLATFORM_EXCLUSIVE_ROUTES`(8)、`resolvePlatformMode`、`route-manifest.platforms`(22) —— **六套管同一件事，五套已死** |
| **改法** | **路线 A（推荐）**：承认 6 平台同构，删掉前五套，只保留 `route-manifest.platforms`。**路线 B**：按平台真实能力重新声明 `supportsX` + 口径差异 + 专属指标（3-4 周） |
| **影响面** | 删约 200 行死代码；或重建平台差异化 |
| **验收** | 只剩一套平台判定逻辑；切平台后侧栏变化符合预期 |
| **需决策** | **是** —— 路线 A 还是 B |

### P2-2 四套导航事实源收敛为一套

| 项 | 内容 |
|---|---|
| **证据** | `route-manifest.ts`(90, 有测试)、`ai-ops-navigation.ts`(28, 无 module)、`GlobalSearch.tsx`(6 硬编码)、`Topbar.tsx routeLabels`(28, 3 个路由无标题) |
| **改法** | 把 AI-Ops 导航纳入 `route-manifest`，加 `branch: 'classic' | 'ai-ops'` 字段；`GlobalSearch` 和 `Topbar routeLabels` 从 manifest 派生 |
| **影响面** | 导航层架构统一，改一处生效全部 |
| **验收** | 单一数据源；`nav-manifest.test.mjs` 覆盖两个分支；面包屑无「主页」兜底 |
| **需决策** | 否 |

### P2-3 `01_schema.sql` 与 DB 对齐

| 项 | 内容 |
|---|---|
| **证据** | `generate-schema.js --check` 失败：DB 252 表 vs `01_schema.sql` 238；4 张 `_deprecated_*` 表只在库里；迁移 `166-170` 未提交 git → CI 全新库 schema 与本地不一致 |
| **改法** | ① 重新生成 `01_schema.sql`；② `git add` 迁移 `166-170`；③ CI 加一步「迁移后 schema 与 01_schema 一致」检查 |
| **影响面** | 新环境部署一致性；CI 可信度 |
| **验收** | `generate-schema.js --check` 通过；CI 全新库有 `is_enabled`/`is_core` 列和自定义角色能力 |
| **需决策** | 否 |

### P2-4 按真实场景重新分组

| 项 | 内容 |
|---|---|
| **证据** | 见 `40-REDUNDANCY-AND-REGROUPING.md` 第二节 |
| **改法** | 9 组 → 8 组；「话术库」移入场次面；「会员与私域」移入履约面；「改进闭环追踪」移入 AI-Ops 工作面 2；0 数据模块加 `coming_soon` |
| **影响面** | 全部用户侧栏 |
| **验收** | 每个分组主题单一；每个页面唯一归属；用户能在 3 秒内找到「今天要用的功能」 |
| **需决策** | 否 |

---

## P3 — AI 能力扩建（按档位选择，需老大拍板）

> 详细分析见 `80-AI-CAPABILITY-GAP.md`。此处只列优先级。

### 档 1 · 低投入快见效（2-3 周）

| # | 事项 | 理由 |
|---|---|---|
| 1 | LLM 多 Provider 切换（`LLM_PROVIDER` 枚举：deepseek/qwen/doubao/ollama，按任务选模型） | `openai-compatible.ts` 已支持，只差配置层 |
| 2 | 话术 LLM 化：替掉 `campaign-plan-service.ts:123-127` 的硬编码模板，改为 LLM 生成 + 现有 `checkTextCompliance` 把关 + critic 数字校验 | 直播脚本/文案生成是你要的闭环第一环，且已有合规检查可复用 |
| 3 | 部署 RAGFlow 或 MaxKB，灌入商品资料/爆款脚本/违禁词库，填 `ai_config` 接通 `kb-client.ts` | **这条路已经铺好，只差部署和配置** |
| 4 | 补 `prompt_template` 表（版本化 + A/B） | 提示词体系的地基 |

### 档 2 · 中投入建闭环（6-8 周）

| # | 事项 | 理由 |
|---|---|---|
| 5 | 在 `ai/engine/` 上串「方案生成 → 场次执行 → 复盘 → 改进任务 → 回流选品」有状态链路 | 用现有 `system_jobs` + pg-boss，Worker 起起来即可跑 |
| 6 | 半自动高光切片：按 `fact_session_metrics` 的 GPM/转化峰值自动标记时间段，导出给剪映人工精剪 | **不硬接剪映 API**，除非你确认要全自动 |
| 7 | 投流数据回流：把 `ad_plan` 执行结果与 `fact_ad_spend_daily` 对比，自动生成调价建议 | 投放复盘闭环 |

### 档 3 · 高投入做自动化（3 个月+，建议明确不做部分）

| # | 事项 | 建议 |
|---|---|---|
| 8 | 千川开放平台接入 | 需商家授权 + 广告主资质，工作量中等 |
| 9 | ASR（直播回放→文字→违禁词扫描→复盘素材） | 可先用开源 Whisper 本地跑，不依赖商业 API |
| 10 | 数字人直播 | **建议明确不做** —— 与合规红线冲突（虚假人设），平台风控风险高 |
| 11 | 多 IP 账号并行自动化 | **建议明确不做** —— 同上，且技术上需解决指纹/代理/风控 |

---

## 四、执行顺序建议

```
第 1 周：P0-1（坏数据）→ P0-3（403 误伤）→ P0-4（删 weather）→ P0-6（洞察页）
                                  ↓
第 2 周：P0-2（角色归一，需先定财务归属）→ P0-7（测试恢复）
                                  ↓
第 3 周：P0-5（假数据治理）→ P1-1（起 Worker）→ P1-6（清污染账号）
                                  ↓
第 4 周起：P1-2/P1-3（AI-Ops 权限统一 + 去重）→ P2-2/P2-4（导航收敛 + 重新分组）
                                  ↓
并行：P3 档 1（LLM 切换 + 话术 LLM 化 + RAG 部署）
```

**依赖关系**：
- P0-2 依赖「财务角色归属」决策
- P1-4 依赖「0 数据模块处置策略」决策
- P2-1 依赖「平台差异化路线」决策
- P2-2 依赖 P1-2（AI-Ops 补 module 后才能统一 manifest）
- P3 全部依赖 P0-5（先不展示假数据，再谈接真数据）

---

## 五、需老大决策的 5 个问题（汇总）

| # | 问题 | 阻塞 |
|---|---|---|
| 1 | 财务角色归属：新建 `finance` 角色 vs 给 `ad_buyer` 开 `cost_visibility`？ | P0-2 |
| 2 | 0 数据模块：A 生成 demo / B 隐藏标 coming_soon / C 补录入引导？ | P1-4 |
| 3 | 合规采集器：接真实抓取 vs 标注为示例数据？ | P1-5 |
| 4 | 平台差异化：路线 A（废除死逻辑）vs 路线 B（重建）？ | P2-1 |
| 5 | AI 能力：档 1 / 档 2 / 档 3 做到哪？数字人与多 IP 是否明确不做？ | P3 全部 |
