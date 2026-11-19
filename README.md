<h1 align="center">Leyova · 全渠道电商数字化运营中枢</h1>

<p align="center">
  <img src="docs/logo/Leyova_primary_logo_transparent.png#gh-light-mode-only" alt="Leyova" width="340">
  <img src="docs/logo/Leyova_primary_logo_transparent_dark.png#gh-dark-mode-only" alt="Leyova" width="340">
</p>

<p align="center">
  面向品牌自播团队、MCN 机构与跨平台电商卖家的全链路经营系统
</p>

<p align="center">
  经营大盘 · 场次运营 · 货盘履约 · 内容达人 · 人效协同 · 受控 AI 决策
</p>

<p align="center">
  <a href="https://github.com/BlazarLIU/leyova/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-F42902.svg" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-16A34A.svg" alt="Node" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19-2563EB.svg" alt="React 19" /></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/fastify-5-171717.svg" alt="Fastify 5" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-14%2B-336791.svg" alt="PostgreSQL" /></a>
</p>

***

## 平台简介

Leyova 覆盖**抖音、快手、淘宝/天猫、微信视频号、小红书**五大电商主阵地，由三个应用协同组成：

| 应用 | 说明 | 默认端口 |
| :--- | :--- | :--- |
| `apps/web` | Web 控制台（React 19 + Vite 6 + Tailwind CSS 4） | 5513 |
| `apps/api` | 后端 API 服务（Fastify 5 + PostgreSQL，435 条路由） | 8788 |
| `apps/mcp-server` | MCP Server（Model Context Protocol，供外部 AI 客户端安全取数） | 9101 |

系统坚持**真实净利（Net-ROI）**口径而非虚高 GMV：整合平台扣点、投流消耗、退换货折损与履约成本，所有取数经由统一指标目录（Metric Catalog）与 SQL 质量门禁引擎，杜绝同名指标多处手写、口径漂移与数据幻觉。

***

## 品牌视觉

界面遵循「**70% 雪白 / 20% 墨黑 / 7% 橙红 / 3% 荧光绿**」的用色比例，橙红承载品牌与关键动作，荧光绿只用于 AI 与增长信号。

| Token | 值 | 用途 |
| :--- | :--- | :--- |
| `--color-orbit-primary` | `#F42902` | 品牌主色、主按钮、关键数据 |
| `--color-orbit-primary-dark` | `#C81F00` | 悬停 / 按压态 |
| `--color-orbit-accent` | `#83FD80` | AI、增长、成功提示的强调 |
| `--color-orbit-ink` | `#171717` | 深色版块、导航栏、重点卡片 |
| `--color-orbit-snow` | `#FDFDFD` | 深底反白文字 |
| 语义色 | success `#16A34A` · warning `#E0A008` · danger `#DC2626` · info `#2563EB` | 状态表达，不做装饰 |

- **圆角阶梯**：8 / 10 / 14 / 18 / 22（`sm → 3xl`），全站收敛到同一套。
- **字体**：Manrope + Noto Sans SC，数字启用 tabular-nums，保证指标列对齐。
- **主题**：浅色为品牌默认，深色为墨黑画布；所有颜色走运行时 CSS 变量，无硬编码色值。
- **图表**：统一色板 `src/constants/chartPalette.ts`，橙红主序列 + 荧光绿次级，深浅主题共用。

***

## 业务功能全景

Web 控制台按 9 大运营工作面组织 118 个业务页面（`apps/web/src/data/route-manifest.ts` 为唯一路由真值源，支持模块级热插拔与角色可见性控制）。

### 今日作战

经营驾驶舱、全渠道大盘、BI 仪表盘、店铺经营看板、目标达成、改进任务、问题库、异常中心。

### 场次

场次管理与排品调度、智能排品推荐、直播间健康度与多直播间总览、人工登记（个人达成 / 直播登记 / 登记数据）、直播复盘矩阵（复盘总览、商品分析、短视频引流、渠道流量、转化漏斗、改进闭环）。

### 货盘

商品结构分析、商品主数据与库存中心、平台专属商品与渠道结构视图。

### 流量与投放

全域投放与净 ROI（限投手相关角色）、搜索词卡位、万相台投放对账、**平台流量洞察**（抖音三池调度、淘系三源流量、天猫品牌×场次与五层抵扣、快手公私域切片与间接成交、小红书流量来源、视频号公私域联动）、活动管理、竞品观察。

### 订单履约售后

履约 SLA 与赔付风控、售后工单与原因归因、客服响应与绩效、退款分析、异常检测。

### 内容与达人

内容排产与归因、达人合作与佣金、会员与私域、视频创作与数据、小红书内容矩阵（笔记看板 / 种草转化链路 / 笔记→直播→成交 / 买手画像 / 蒲公英达人）、视频号内容。

### 人与钱

话术库、主播列表与档案、训练管理与能力看板、直播排班与排班设置、HRBP 工作台。

### 数据

数据管理、数据上传（CSV / Excel，含列映射建议与导入前校验）、多平台接入向导（自定义清洗映射）、上传数据管理、数据质量看板。

### 系统

账号管理、角色与模块权限、运营人员管理、平台与渠道管理、直播间管理、系统配置、模块热插拔、异步任务与运维队列、字典管理、操作审计日志、平台规则雷达、违规事件看板。

### AI Ops 工作区（独立侧栏，4 个工作面 + 内核治理）

- **工作面 1 · 作战台**：AI 助手对话、今日作战单、经营诊断台、待办审批中心、实时告警流
- **工作面 2 · 场次台与全域复盘**：货盘排品编辑、提词卡与指令、盯盘驾驶舱、单场五段复盘、复盘总览 / 商品 / 短视频 / 渠道 / 漏斗穿透
- **工作面 3 · 货与内容**：AI 全品类选品、货盘结构分析、价格与渠道价目、内容排产与切片、投放协同与熔断
- **工作面 4 · 财务与人资工作台**：利润与单位经济 P&L、结算对账分录（仅限财务口径角色）、HRBP 效能总览、主播效能排行、改进闭环追踪、AI 智能排班推荐
- **系统与内核治理**：22+5 指标注册字典、Decision Case 决策流、知识库与模型中心

***

## 数据底座与质量门禁

- **统一指标目录**（`apps/api/src/catalog`）：22 个核心指标（GMV、净成交额、退款率、CTR、GPM、投流花费、ROI、Net-ROI 等）+ 5 个标准维度，全部以 SQL 表达式注册，取数只允许经目录路由到对应事实表视图，杜绝同一指标多处手写。
- **SQL 质量门禁引擎**（`apps/api/src/qm`）：8 条规则码（行数守恒、金额守恒、枚举合法、平台对账、跨表对账、时间连续、新鲜度 SLA、批次键唯一），手动上传与 API 同步均需过门禁，`fatal` 级拦截直接拒绝入库。
- **事实表分桶**：`fact_trade_daily` / `fact_traffic_daily` / `fact_ad_spend_daily`，交易事实按月分区，配视图路由默认口径。
- **两条数据接入路径**：
  1. **手动上传**：前端「数据 → 上传」或 `POST /api/v1/ingest/manual-upload`，支持列映射、清洗预演 Diff、质量门禁校验；
  2. **平台 API 同步**：「系统 → 平台与渠道管理」配置店铺凭证后由同步任务拉取（内置抖音 / 淘系 / 视频号适配器，小红书与快手以手动上传为主）。**平台官方 OpenAPI 凭证由用户自行申请配置**，系统不内置任何凭据。
- **定时任务**（`apps/api/src/cron` + worker 进程）：事实聚合、异常检测、合规巡检、旧数据归档、分区管理。

***

## 受控 AI 能力

- **29 个注册 AI 工具**（复盘、洞察、任务、经营数据等），按风险分级：`read_only` 直接执行、`write_with_approval` 需人工审批后才真实落库、`admin_only` 仅超管可用。
- **审批闭环**：待审批动作在「待办审批中心」处理，批准后系统真实执行并复用同一条工具日志记录结果，审批单状态流转为 `approved → executed / failed`，杜绝「批了但没执行」的假成功。
- **数据真实性核验**：AI 分析输出的所有数字强制溯源至指标目录查询，未通过核验的结论不会展示为可信口径。
- **MCP Server**：向外部 AI 客户端（如 Claude Desktop）暴露 6 个只读工具域（直播 / 主播 / 商品 / 复盘 / 任务 / BI），Token 鉴权 + 可选签名校验。
- **LLM 接入**：通过环境变量配置外部模型服务（`AI_ENABLED`、`KNOWLEDGE_BASE_API_*`、`OPENVIKING_API_*`），未配置时系统功能完整可用，AI 面板显式提示不可用而非返回假数据。

***

## 角色与权限

系统内置 **8 个真实角色**（数据库 `roles` 表单一真值源，前端 `apps/web/src/constants/roles.ts` 对齐）：

| 角色 | 说明 | 演示账号 |
| :--- | :--- | :--- |
| `super_admin` | 系统管理员，账号 / 角色权限 / 系统配置 | `admin` |
| `ops_director` | 运营总监，全盘经营与审批 | `manager_liu`、`director_zhou` |
| `ops_staff` | 运营专员，场次调度 / 排品 / 复盘 | `operator_wang`、`staff_lin` |
| `ad_buyer` | 投放专员，投流对账 / ROI / 关键词 | `finance_chen`、`buyer_xu` |
| `controller` | 直播中控，现场节奏与商品上下架 | `control_zhao`、`ctrl_wu`、`ctrl_douyin`、`ctrl_taobao`、`ctrl_xhs`、`ctrl_wechat` |
| `video_editor` | 短视频运营 / 编导，脚本与切片排产 | `video_lin` |
| `cs_agent` | 客服，会话与售后工单 | `cs_qian` |
| `hrbp` | HRBP，排班 / 人效 / 绩效 | `hr_li` |

> **财务口径说明**：系统不设独立 `finance` 角色。财务 P&L、结算对账等财务口径页面对 `super_admin` / `ops_director` / `hrbp` 开放，其余角色（含 `ad_buyer`）不可见不可访问。
>
> **数据权限**：PostgreSQL 行级安全（RLS）按租户与店铺隔离；投流成本类数据仅 `super_admin` / `ops_director` / `ad_buyer` 可见，`brand_viewer` 为品牌方门户用户类型（需先创建账号并授权品牌）。

所有演示账号初始密码：`Admin@123456`（仅用于演示环境，生产部署请务必修改，可通过 `DEFAULT_USER_PASSWORD` 环境变量调整）。

***

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
git clone https://github.com/BlazarLIU/leyova.git
cd leyova
docker compose up -d
# Web 控制台: http://localhost:5513
# 后端 API:   http://localhost:8788
```

Compose 编排：PostgreSQL 16 + API（启动时自动执行迁移）+ Web（Nginx 静态托管 + API 反代）。

### 方式二：本地开发

环境要求：Node.js ≥ 22，pnpm ≥ 9，PostgreSQL ≥ 14

```bash
pnpm install

# 配置环境变量
cp apps/api/.env.example apps/api/.env
# 按实际环境修改 DATABASE_URL / SESSION_SECRET

# 初始化数据库（建库 + 全量迁移，74 个迁移文件）
node database/demo/init.mjs

# 启动前后端双进程热重载
pnpm dev
```

### 演示数据

```bash
# 灌入演示数据（人员 / 场次 / 排品 / 短视频 / 订单 / 考勤等，并回填聚合表）
node database/demo/init.mjs --with-demo   # 或 pnpm db:init:demo

# 接入真实数据后一键清空演示数据（保留账号、角色、权限、平台配置等基础数据）
pnpm demo:reset
```

> 演示数据为**合成数据**，设计原则与数据清单见 [`database/demo/README.md`](database/demo/README.md)。接入真实生产数据请使用上方两条数据接入路径，或先 `demo:reset` 再导入。

***

## 仓库结构

```
leyova/
├── apps/
│   ├── web/          # Web 控制台（React 19 + Vite 6 + Tailwind 4 + Radix UI）
│   ├── api/          # 后端 API（Fastify 5 + pg + zod，435 条路由）
│   └── mcp-server/   # MCP Server（6 个只读工具域，端口 9101）
├── database/
│   ├── 01_schema.sql # 全量 schema（238 张表）
│   ├── migrations/   # 74 个增量迁移
│   └── demo/         # 初始化 / 演示数据生成与清空脚本
├── scripts/          # 门禁检查 / 健康探测 / 基准 / e2e 冒烟
└── docker-compose.yml
```

## 常用命令

| 命令 | 说明 |
| :--- | :--- |
| `pnpm dev` / `pnpm dev:api` / `pnpm dev:web` / `pnpm dev:mcp` | 开发启动（全量 / 单应用） |
| `pnpm build` | 构建全部三个应用 |
| `pnpm test` | API + Web 测试 |
| `pnpm db:migrate` | 执行增量迁移 |
| `pnpm check:guardrails` | 前后端接口契约守卫（前端调用 vs 后端路由对账） |
| `pnpm schema:check` | 校验 `01_schema.sql` 与数据库实际结构一致 |
| `pnpm openapi:check` | OpenAPI 文档漂移检查 |
| `pnpm ops:probe` / `pnpm ops:smoke` / `pnpm ops:bench` | 运维健康探测 / e2e 冒烟 / 聚合基准 |
| `pnpm worker` | 启动后台定时任务进程（聚合 / 异常检测 / 合规巡检 / 归档 / 分区） |

## 可观测性与安全

- `/metrics` 与 `/api/v1/metrics` 暴露 Prometheus 指标，需会话或 `METRICS_TOKEN` 鉴权，匿名访问返回 401。
- 全量操作审计日志（「系统 → 操作审计日志」）。
- AI 工具调用全量记录于 `ai_tool_logs`，写操作强制走审批流（`ai_action_approvals`）。
- 凭证（平台授权 Token 等）落库前经 `API_ENCRYPTION_KEY` 加密。

## 开源许可证

本项目采用 [Apache-2.0 License](LICENSE) 开源许可协议。
