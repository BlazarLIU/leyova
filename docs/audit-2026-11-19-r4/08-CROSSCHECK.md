# 08 · 与前两份报告的逐条复核

> 对象：
> - **G** = `/home/odlive/.gemini/antigravity/brain/173535d2-.../full-system-audit-plan.md`（23 条 BUG）
> - **D** = `/home/leyova/docs/audit-2026-11-19/70-GEMINI-AUDIT-REVIEW.md`（dsh 对 G 的裁定 + 10 条遗漏）
>
> 本轮**不转述**，用自己的实测重新裁定；并标注「与 D 的分歧」。

## 一、对 Gemini 23 条的独立裁定

| # | 条目 | 本轮裁定 | 我的证据 / 与 D 的分歧 |
|---|---|---|---|
| 001 | 今日作战 12 项，业务只用 4 项 | ✅ 成立（分组膨胀） | 分组确实过载；数据侧 `goal_tracking=7`、`issue_library=0`。D 判「部分」，分歧在数据时点 |
| 002 | 内容与达人混入会员私域 | ✅ 成立（分类） | `route-manifest.ts:137` `/ops/members` 在 content 组 |
| 003 | 话术库归入人与钱 | ✅ 成立（分类） | 且更严重：`/api/v1/scripts/templates` 未进 `MODULE_MAP` → 运营专员 403（我实测 `operator_wang` 403） |
| 004 | 流量与投放 17 项膨胀 | ✅ 成立 | 17 项；其中 10 个 insight 路由收敛为 1 条参数化即可 |
| 005 | 履约售后 5 项 0 数据 | 🟡 部分成立 | 运单 420 / 客服 480 / 退款 24 / 工单 24 已是演示数据；`fact_settlement_cycles` 仍 0。结论「核心卖点空转」方向对，原因不是「没做」而是「没接真数据」 |
| 006 | LIVE_ONLY_ROUTES 与 MODULES 冗余不一致 | ✅ 成立，且更硬 | 我进一步发现 `LIVE_ONLY_MODULES` 18 条中 **7 条模块码与 manifest 永不匹配** |
| 007 | 直播路由缺 `platforms` 声明 | ✅ 成立 | 90 条中仅 22 条带 `platforms` |
| 008 | `PLATFORM_EXCLUSIVE_ROUTES` 缺 insight | ✅ 成立 | `platformRoute.ts:43-54` 仅 8 条 `/shop/*` |
| 009 | `PlatformInsightPage` 用 `window.location.pathname` | ❌ 推翻 | SPA 下 pathname 始终正确，非 bug。真正问题是 **3 个 insight 配置缺 `path`** 导致「未找到页面配置」 |
| 010 | 淘宝/天猫缺 `supportsLive` 精度 | 🟡 性质相反 | 实测六平台 `supportsLive` 全 `true`；问题是**全部同构**，不是「未返回 true」 |
| 011 | `*` 在 CLASSIC_ROUTES 前吞路由 | ❌ 推翻 | React Router v6 按 specificity 匹配，与 JSX 顺序无关；90 条全部命中 |
| 012 | 约 15 个幽灵页面 | 🟡 部分成立 | 真幽灵 **4 个**（`MyPerformancePage`、`MySchedulePage`、`anchors/UnifiedScheduleHub`、`system/AccountsSection`），其余被 Hub 复用 |
| 013 | HRBP 工作台双注册 | ✅ 成立 | `/hrbp/workspace` + `/ai-ops/hrbp/workspace` 同组件 |
| 014 | `RequireAccess` fail-closed 误拦 | ❌ 推翻 | 90 条均有 `module` 或 `anyModules`，当前无实例。可作为防御性测试建议 |
| 015 | AI-Ops 复盘与经典守卫不同（主播 403） | ✅ 成立，且更严重 | `ad_buyer/video_editor/cs_agent` 被 `AI_OPS_ALLOWED_ROLES` 排除 |
| 016 | DashboardHub 3 入口 | 🟡 部分成立 | 有意设计（不同 `defaultView`），但用户确实困惑 → P2 体验项 |
| 017 | ScheduleHub 4 入口 | 🟡 部分成立 | 同上 |
| 018 | AI-Ops 与经典大量重叠 | ✅ 成立 | 6 组同组件多入口 |
| 019 | CRM 类型无关 | 🟡 部分成立 | 是 **10 个死类型**，不是「模块」；删即可 |
| 020 | AI-Ops 导航与 manifest 割裂 | ✅ 成立 | 28 条 `module:0`，独立事实源 |
| 021 | AI-Ops 不检查 `disabledModules` | ✅ 成立 | `Sidebar.tsx:263-265` 直接 return，不经 `canSee` |
| 022 | 改进闭环归错工作面 | ✅ 成立 | `ai-ops-navigation.ts:103` 在「财务与人资」下 |
| 023 | `onlyHrbp` 定义未用 | ✅ 成立 | 第二参数带下划线未使用，影响小 |

### 统计与 D 的分歧

| 裁定 | 本轮 | D |
|---|---:|---:|
| 成立 | **14** | 8 |
| 部分成立 | **6** | 7 |
| 推翻 | **3** | 8 |

分歧主要来自**分类口径**：D 把 016/017/019（有意设计/死类型/体验）判为「误报」，我把它们判为「部分成立（体验或技术债）」。功能判断上双方一致：**真正的误报只有 009、011、014 三条**。

### 对 G 的总体评价

- 价值：静态线索源，尤其 007（platforms 缺失）、013~022（AI-Ops 结构债务）画得准。
- 致命缺陷：**无运行态验证**。所有「0 行」结论均为转引，导致 1/3 条目过期或误报。
- 结论：**只能当线索，不能当结论**。

## 二、对 D 的 10 条遗漏逐条复核

| # | D 的遗漏项 | 本轮复核 | 修正/补充 |
|---|---|---|---|
| 1 | 角色模型三处漂移 | ✅ 成立 | `Layout.tsx:66-80`、`RequireAiOpsAccess.tsx:16-32` 用 `admin/operator/finance`，DB 8 角色无这三个；`finance_chen` 实际 `ad_buyer` |
| 2 | 演示数据 `[object Object]` | ✅ 成立 | 446 行中 417 行；根因 `generate.mjs:381` |
| 3 | module-guard 误伤 7 路径 | ✅ 成立（我实测 4 个） | 实测 403：`scripts/templates`、`finance/accounting-subjects`、`metrics`、`weather/cities`；`assortment/*` 3 条未逐一验证 |
| 4 | AI-Ops 静默假数据 | ✅ 成立，且扩大 | 6 页 100% 写死、4 页真数据+派生造假、12 页假兜底；`updateImprovementTaskStatus` 失败 `return true` |
| 5 | 平台差异化整体失效 | ✅ 成立 | 198 行 0 项 `is_applicable=false`；六平台 `modulesByPlatform` 逐字节相同；前端**从不发送**平台头 |
| 6 | 3 个洞察页配置失配 | ✅ 成立 | `PlatformInsightConfig.ts:54,95,103` 缺 `path`；页面直接输出开发文案 |
| 7 | 后端测试是红的（143 pass / 17 cancelled） | ⚠️ 未复核 | 本轮只读约束，不运行会写库的测试；D 的结论保留，但需在隔离库复跑 |
| 8 | schema 漂移 + 迁移未提交 | ✅ 成立（已核实细节） | `generate-schema.js --check` 失败；`schema_migrations` 仅 56 条、最后 `155_p1_metric_catalog_unified`；156–170 迁移文件存在但 **0 条登记**，而 `system_module_parameters` 表已存在 → 手工建表/漂移，不只是「未提交」 |
| 9 | Worker 未运行，定时任务全停 | 🟡 **需修正** | worker 确实未注册；但 **API 内嵌 cron 在跑**：日志有 01:30 聚合、04:00 分区、05:00 多平台同步（`total=22 completed=0`）。「全停」不准确 |
| 10 | 孤儿 mcp-server / ai-ops 空壳 / 合规采集器 MOCK | 🟡 部分成立 | 合规采集器确为 MOCK（`collector/douyin.ts` 返回硬编码字符串却标 `fetchMethod:'headless'`）；mcp-server 在 `:9101` 运行（根路径 404 属正常）；**仓库中不存在 `apps/ai-ops` 目录**，该条已过期 |

### 对 D 的总体评价

- **实测扎实**，是目前最可靠的一份。
- 两处需修正：①「worker 全停」应为「worker 停、API cron 在跑」；②「apps/ai-ops 空壳」在当前工作树已不存在。
- 一处口径差异：把体验类问题一律判「误报」，会掩盖真实体验债。

## 三、三份报告都没覆盖的新发现（本轮独有）

| # | 发现 | 证据 |
|---|---|---|
| 1 | `/api/v1/metrics` **匿名 200** | `_evidence/03-api-authz-matrix.md` §4 |
| 2 | `ctrl_xhs` 可读抖音场次 P&L（跨平台越权） | 同 §5-B2 |
| 3 | `user_platform_permissions` 138 行**全是测试账号**，真实账号 0 行 | `_evidence/02-db-rowcounts.md` §8 |
| 4 | LLM 双重失效：`AI_ENABLED=false` + 默认模型 `deepseek-chat` 不在 Ollama；日志 404 | `_evidence/06-process-and-logs.md` |
| 5 | `ai_v2_run` 3648 次**全部 `engine=rule`**，LLM 从未成功执行 | DB 实测 |
| 6 | 财务页生成 **假签名 `SIG-…-SHA256-VERIFIED`** | `ai-ops-data.ts:500` |
| 7 | 审批/下发/闭环三处**假成功**（失败仍 `return true`） | `ai-ops-data.ts:700-702` 等 |
| 8 | `AI 日报` 忽略 `date` 参数，永远返回当天 | `ai.ts:59-72` |
| 9 | 导航事实源实际 **6 套**（含 `Topbar.tsx:11-51` 标签副本、`GlobalSearch.tsx` 硬编码） | 前端全量盘点 |
| 10 | 知识库服务已部署（`anythingllm-server`）但 **stopped**，故 `provider=none` | pm2 列表 + `/kb/status` |
| 11 | 6 个 AI-Ops 页面 100% 写死（结构/切片/活动/案例/结算） | 见 `03-RUNTIME-USABILITY.md` |
| 12 | `session_plan_products` 损坏 417 行导致排品/复盘全链路坏 | 同上 |

> 说明：第 1~3 条是**安全/权限**问题，第 4~8 条是**AI 可信度**问题，第 9~12 条是**结构与数据**问题。前两份报告均未系统覆盖。

### 后端链路 P0（三份报告都漏）

| # | 发现 | 证据 | 为何前两份看不到 |
|---|---|---|---|
| 1 | 同步单页拉取（每店每轮 ≤50 单）+ 流量恒 `[]` + 0 行也 `completed` + UTC 水位 | `platform/adapters/base.ts:78-110`；`sync-job.ts:43-47,238-284` | 二者只看「同步是否在跑」，不看「拉没拉全」 |
| 2 | AI 写操作审批空转：pending → approve → 再 pending | `ai/tool-registry.ts:101-130`；`routes/ai.ts:599-670` | 二者都只查了前端「假成功」，未追到后端执行分支 |
| 3 | 手动上传绕过 8 道门禁，缺列填 0 + 全列覆盖 | `ingest-upload.ts:9,148-169`；`manual-mapper.ts:288-352` | 二者均未审上传链路 |
| 4 | 改一个用户重置整角色授权 | `system-users.ts:118-175` | 未审写接口实现 |
| 5 | MCP 仅凭 `X-Leyova-User-Id` 冒充用户 + 超管池绕过 RLS | `mcp-server/src/index.ts`、`db.ts` | 只把它当「孤儿进程」，未审鉴权 |
| 6 | RLS 58/238；`ai_v2_*` 为 `USING (true)` | `_evidence/11-backend-inventory.md` §5 | 未查库内策略 |
| 7 | 仅 2/435 端点有 schema；迁移只登记到 155 | 同上 | 未做端点级盘点 |

## 四、口径统一说明

- **角色数**：以运行时 `roles` 表 **8 行**为准（`super_admin/ops_director/ops_staff/controller/hrbp/ad_buyer/video_editor/cs_agent`）。迁移 `131`/`144` 已**有意删除** `finance` 等角色，因此前端 `'finance'` 白名单是死代码，不是「迁移漂移」。
- **端点数**：静态统计 **435**，运行时 OpenAPI **442**（参数化展开口径不同）；两处并列引用，不混用。
- **`ai-ops/` 位置**：仓库根 `/home/leyova/ai-ops`，`src/` 只有 `config.ts`；`apps/ai-ops` 不存在。
- **worker**：pm2 未注册 `leyova-worker`；API 内嵌 cron 在跑（01:30 聚合、04:00 分区、05:00 同步），AI 日报（01:15）与异常巡检（每小时）在 `cron/index.ts:141-145` 被注释。

## 五、结论

1. **G 是线索，D 是基线，本轮是第三份独立证据。**
2. 三份报告在「平台差异化失效」「AI-Ops 假数据」「角色漂移」三件事上高度一致——**这三件应作为整改主干**。
3. 差异集中在：G 的静态误判、D 的两处时效误差、以及本轮新增的**安全/权限与 AI 可信度**问题。
4. 建议：以本轮 `_evidence/` 的 11 份原始证据（含 `11-backend-inventory.md`）为唯一事实源，其他两份作为交叉参考。
