# 00 · 总裁定

> 本文件是全部结论的汇总。每条均可回溯到 `_evidence/` 或本目录其他分册的文件行号。

## 一、总体判断

系统 **不是空壳**，也 **不是可直接交付的生产系统**。准确描述是：

> **业务骨架真实、平台接入半通、AI 外层超前、数据与权限链路存在系统性断点。**

- 真实：数据治理层 917 行真实签名 + `fetch` 的 7 平台适配器；场次主键数据模型；AI v2 可追溯契约（3648 次运行、19983 条 claim、42531 条 evidence）；质量门禁 3 项通过。
- 半通：22 个店铺 0 个真实授权，多平台同步 `total=22 completed=0`；243 张表中 123 张 0 行；驾驶舱 `roi=0 / top_products=[]`。
- 超前：AI-Ops 30 条路由中 5 页 100% 硬编码、5 页真实数据上派生指标造假、6 页真实但降级；LLM 实际关闭。
- 断点：权限角色字符串在代码与数据库之间对不上；平台切换后端 0 生效；54 个页面静默吞错；**同步链路系统性少算、AI 写操作审批空转、手动上传绕过质量门禁**。

## 二、六个问题域的定量结论

### 1. 模块/分组是否贴近真实业务 → 方向对，颗粒度错

业务真实作业链是一条以「场次」为主键的链：目标 → 选品 → 排品 → 排班 → 预热 → 开播盯盘 → 下播结算 → 履约售后 → 复盘。

系统现状：
- 9 大工作面方向正确（今日作战 / 场次执行 / 货盘 / 流量投放 / 履约售后 / 内容达人 / 人与钱 / 数据资产 / 系统治理）。
- 但「场次执行」被劈成经典分支「场次管理」与 AI-Ops 分支「排品 / 提词 / 盯盘 / 复盘」两套导航，用户在两个 URL 前缀间来回跳。
- `route-manifest.ts` 90 条里，同一业务动作出现多次入口（`UnifiedScheduleHub` 4 个入口、`UnifiedDashboardHub` 4 个入口、`PlatformInsightPage` 10 个入口）。
- 结论：**分组骨架可保留，需合并为「单场作战室」一条主轴。**

### 2. 切平台后能否对应显示 → 不能（四层中只有两层半生效）

| 层 | 机制 | 实测效果 |
|---|---|---|
| ① 前端菜单 `platforms` 字段 | `route-manifest.ts` 22/90 条声明；`platform-navigation.ts:99-101` 过滤 | 经典侧栏隐藏 16–20 项（taobao 叠加直播后 35 项） |
| ② 前端模块 `isModuleSupported` | `usePlatform.tsx:113-123` + `LIVE_ONLY_MODULES` 18 条 | 18 条中 **7 条模块码与 manifest 不一致 → 永不命中**；capabilities 缺失时一次隐藏 24 项 |
| ③ 路由可达性 `checkRoutePlatformCompatibility` | `platformRoute.ts:12-34` + `Layout.tsx:197-210` | 只显示「平台不匹配」提示，**路由依然存在** |
| ④ 后端数据与权限 | `access-resolver.ts` + `module-guard.ts` | **0 过滤**：前端从不发送 `x-leyova-platform`；`overview.ts` 无 platform 条件；六平台 `supportedModules` 与 `system_modules.code` 命名不一致 |

决定性证据：
- `GET /api/v1/overview/sessions` 带 `douyin` 与 `xiaohongshu` 头，响应 **md5 完全相同**（140 场）。
- `ctrl_xhs` 读 `GET /api/v1/sessions/1/pnl` 返回 **200**，body 是 `platformCode=douyin`。
- `platform_capability_matrix` 198 行，**0 行 `is_applicable=false`**，六平台签名完全相同。

**判定：平台切换当前是纯前端菜单装饰，且装饰逻辑本身有 7 条死编码。中控跨平台看到的是全平台混合数据。**

### 3. 每个功能真实场景能否用 → 约 1/3

122 个页面分级（详见 `03-RUNTIME-USABILITY.md`）：

| 等级 | 数量 | 说明 |
|---|---:|---|
| A 真实可用（接口在、数据能读、无编造） | ~45 | 登录、用户/角色、AI 对话、分析台、选品、渠道/漏斗复盘、HRBP 工作台、榜单等 |
| B 半可用（接口在，但数据空/降级/静默） | ~40 | 驾驶舱、场次列表、告警、任务、排期、话术库等 |
| C 空壳/造假 | 11 | 5 页 100% 写死（货盘结构/切片/活动/案例/结算）；5 页在真实数据上叠加派生造假（驾驶舱/场次复盘/主播绩效/财务 P&L/审批）；1 页空态硬编码；另 4 个幽灵页面单列 |
| D 直接报错 | 3 | `/insights/tmall/promotion-layers`、`/insights/wechat/affiliate`、`/insights/wechat/content` 显示「未找到页面配置」 |

另有 **54/122 个页面** 存在 `catch {}` 静默吞错。

### 4. 多余与重复 → 有，且成体系

- 导航事实源 **6 套并行**（manifest / ai-ops-navigation / platform-navigation 派生 / GlobalSearch 硬编码 / Topbar 标签副本 / classic-routes 消费）。
- 同组件多入口：`UnifiedDashboardHub` 4 个、`UnifiedScheduleHub` 4 个、`PlatformInsightPage` 10 个。
- 双份角色白名单：`Layout.tsx:66-80` 与 `RequireAiOpsAccess.tsx:16-32`。
- 20 条 redirect（App 13 + manifest 7），其中 `/ai/selection` 与 `/ai/selection/history` 指向同一页，历史入口名义存在实际丢失。
- 死代码：8 个 review 组件 0 引用、3 个 barrel 死文件、10 个类型 0 引用、4 个幽灵页面。

### 5. 功能关系图谱 → 见 `05-RELATIONSHIP-GRAPH.md`

核心结论：数据模型以「场次（session_id）」为枢纽是**正确**的；但 UI 层被经典/AI-Ops 两套导航切成两半，导致同一场次的「排品—盯盘—结算—复盘」在界面上不连续。

### 6. 改进计划 → 见 `06-IMPROVEMENT-PLAN.md`

P0 11 项（阻断性问题）、P1 13 项、P2 7 项、P3 5 项。

### 7. 后端链路的三个 P0（前端看不出来，但决定数据真假）

| # | 问题 | 证据 | 后果 |
|---|---|---|---|
| 1 | **同步系统性少算**：单页拉取无分页（每店最多 50 单/次）、`fetchTrafficData` 恒 `[]`、0 行也标 `completed`、水位用 UTC | `platform/adapters/base.ts:78-110`；`ingest/sync-job.ts:43-47,238-284` | GMV/订单长期少算，流量永远为空，被跳过的数据窗口永久丢失 |
| 2 | **AI 写操作审批空转**：`write_with_approval` 只建 pending 不执行；`/ai/approve` 再次进 pending | `ai/tool-registry.ts:101-130`；`routes/ai.ts:599-670` | 「AI 生成排品/活动/任务」永远不落库；`ai_tool_logs` 仅 3 行 |
| 3 | **手动上传绕过质量门禁且可清零**：未调用 `UnifiedDataPipelineService`；缺失列填 0 + 全列覆盖 | `routes/ingest-upload.ts:9,148-169`；`ingest/manual-mapper.ts:288-352` | 脏数据直接入仓；只含部分指标的文件把已有 GMV/订单更新为 0 |

外加两条结构性缺陷：
- `MODULE_MAP` 缺 8 个前缀（27 个端点），**财务角色访问不了 `/api/v1/finance`**，`ops_staff/ad_buyer/video_editor/cs_agent/controller` 访问话术库等全部 403。
- 238 张表仅 **58 张启用 RLS**；`ai_v2_*` 的 RLS 是 `USING (true)`；MCP 服务在非生产环境仅凭 `X-Leyova-User-Id` 头即可冒充任意用户。

## 三、5 项 AI 标准的判定（摘要）

| # | 标准 | 判定 | 关键证据 |
|---|---|---|---|
| 1 | LangGraph/CrewAI/Dify/Coze 多 Agent 跑直播闭环 | **未达标（自研规则引擎替代）** | 无上述依赖；`orchestrator.ts` 为自研 rule planner；`ai_v2_run` 3648 次全部 `engine=rule`，0 次 `engine=llm` |
| 2 | 豆包/通义/抖音/千川/剪映/数字人/ASR 打通 | **部分**：抖音/淘宝/小红书/快手/视频号 有真实签名代码；**千川/剪映/数字人/ASR 无任何实现**；豆包/通义仅 OpenAI 兼容壳且未配置 | `platform-adapters.ts` 917 行真实签名；关键词检索无 qianchuan/jianying/asr/digital-human 实现 |
| 3 | Milvus/Chroma 向量知识库 | **未达标** | 无向量库依赖、无 vector/embedding 表；`kb-client.ts` 仅 HTTP 转发外部 RAG 服务，`/kb/status` 返回 `configured=false, provider=none, degraded=true`；Ollama 虽有 `nomic-embed-text` 但未接线 |
| 4 | 提示词体系 + AI 使用 SOP + 培训 | **未达标** | 无 prompt 表、无版本管理；`prompt_version` 硬编码 `'v2.0'`；无 SOP/培训数据表 |
| 5 | 持续迭代 + 数字人 + 多 IP 并行 | **部分** | 有 ai_eval（3420 次，通过率见分册）、有告警与任务；**无数字人、无多 IP 账号矩阵实现** |

详见 `07-AI-CAPABILITY-GAP.md`。

## 四、必须让决策者知道的三件事

1. **当前最危险的不是缺功能，是「看起来有」。** AI-Ops 有 6 个页面 100% 硬编码、4 个页面的真实数据被下标公式篡改（`gpm = 1500 + (10 - i%10)*120`），而错误被 `catch {}` 吞掉。业务人员会据此做排班、定级、投放决策。
2. **权限模型的角色名与数据库不一致，造成「该看的看不到、不该看的能看到」。** `finance_chen`（真实角色 `ad_buyer`）看不到财务；`controller`（现场中控）反而能看成本与结算；`director_zhou` / `buyer_xu` **登录直接 401**。
3. **平台切换是演示级能力。** 对客户演示时切平台菜单会变，但数据不变、权限不变。一旦客户用两个平台的真实账号验证，会被立刻发现。

## 五、与前两份报告的关系

- Gemini 23 条：本轮裁定 **成立 14 / 部分成立 6 / 推翻 3**（详见 `08-CROSSCHECK.md`）。
- dsh 报告：其「8 成立 / 7 部分 / 8 误报」的裁定总体可信，但漏掉 22 项本轮新发现——前端 12 项（匿名 `/metrics`、`ctrl_xhs` 跨平台读、`user_platform_permissions` 真实账号 0 行、LLM 404+关闭、3 个洞察页直接报错、假签名 `SHA256-VERIFIED`、审批假成功、`disabledModules` 只影响侧栏、6 套导航源、`topbar` 标签副本、6 页写死、排品数据损坏），后端 10 项（同步少算、上传清零、审批空转、改用户重置整角色、MCP 冒充、RLS 58/238、2/435 schema、迁移漂移、孤儿表、`get_anchor_profile` SQL 错误）。
- 本轮不重复它们的结论，只补充证据与新增项。
