<h1 align="center">Leyova</h1>

<p align="center">
  <img src="apps/web/public/brand/leyova-primary-logo.png#gh-light-mode-only" alt="Leyova" width="320">
  <img src="apps/web/public/brand/leyova-primary-logo-dark.png#gh-dark-mode-only" alt="Leyova" width="320">
</p>

<p align="center">
  <strong>全渠道电商经营决策中枢</strong><br>
  让品牌自播与多平台经营，回到真实利润
</p>

<p align="center">
  <a href="https://github.com/BlazarLIU/leyova/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-663399.svg" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22-16A34A.svg" alt="Node" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-14%2B-336791.svg" alt="PostgreSQL" /></a>
</p>

***

## 产品定位

Leyova 是面向**品牌自播团队、MCN 机构与跨平台电商卖家**的企业级经营系统。

它把分散在抖音、快手、微信视频号的店铺后台数据、直播场次、货盘、投放与人员绩效，收敛到一套统一的经营视图。管理层看到可解释的利润，运营团队看到今天该做什么，财务与 HR 看到可对账的结果。

与只汇总 GMV 的工具不同，Leyova 以**真实净利（Net-ROI）**为统一口径：平台扣点、投流消耗、退换货折损、坑位费等成本逐层抵扣。所有对外呈现的数字都能回溯到统一指标目录与原始数据，而不是各页面各写一套 SQL。

## 适用场景

| 客户类型 | 典型问题 | Leyova 的解法 |
| :--- | :--- | :--- |
| 品牌自播团队 | 多平台数据割裂，利润算不清 | 统一接入、统一口径、统一复盘 |
| MCN / 代运营 | 多品牌多直播间，人效与排期混乱 | 多租户隔离、场次排班、主播效能 |
| 跨平台卖家 | 投放、货盘、排班各看各的 | 从流量到成交再到复盘的经营视图 |
| 企业数字化团队 | 自建成本高，数据不可信 | 私有化部署、数据门禁、开放接口 |

## 核心价值

### 真实净利，而非虚高 GMV

平台扣点、投流费用、退款折损、坑位费等成本逐层抵扣，输出可解释的 Net-ROI。同一指标只在一个地方定义，避免口径漂移与“同名不同数”。

### 从发现问题到验证结果的决策闭环

今天的变化暴露异常，调查与决策案给出动作，决策追踪与复核验证结果，知识与规则库沉淀经验。每个决策都能落到责任人、截止时间与可复核的结论。

### 可信数据，AI 可溯源

数据入库前经过行数守恒、金额守恒、跨表对账、新鲜度等质量门禁；AI 输出的所有经营数字强制回溯到指标目录，未通过核验的结论不会作为可信口径展示。

### 企业级权限与隔离

按租户、品牌、店铺、项目、主播与用户维度进行数据隔离；角色权限与数据权限分离；写操作可配置审批；关键动作全量审计。

### 开放与可集成

提供标准 API 与 MCP Server，可对接外部 AI 客户端、企业 BI、数据仓库与内部系统。支持 Docker Compose 快速部署，也支持私有化交付。

## 能力全景

| 业务域 | 关键能力 |
| :--- | :--- |
| 经营决策 | 今天的变化（经营诊断）、AI 助手、调查与决策案、决策追踪与复核、全域投流与净 ROI |
| 货盘与选品 | 货盘排品测算、AI 选品与趋势、商品主数据与库存 |
| 场次与主播 | 排班日历、AI 排班建议、主播档案、场次调度 |
| 人工登记 | 个人达成、直播登记、登记数据管理 |
| 规则与合规 | 合规规则雷达、知识与规则库 |
| 数据管理 | 数据管理、数据上传、数据质量与隔离 |
| 系统与运维 | 账号管理、角色与权限、平台与渠道、直播间管理、系统配置与 AI、审计日志、任务队列 |

## 平台覆盖与数据接入

**覆盖平台**：抖音、快手、微信视频号（核心直播电商三平台）。淘宝、天猫、小红书、京东、拼多多等货架电商模块已下线，不再提供页面入口与 API。

**两种接入方式**：

- **手动上传**：支持 CSV / Excel，提供列映射建议、清洗预演与导入前校验，适合以人工导表为主的场景。
- **平台 API 同步**：配置店铺授权后由同步任务自动拉取，内置抖音、快手、视频号适配器。

平台官方 OpenAPI 凭证由客户自行申请与配置，系统不内置任何凭据。

## 受控 AI

Leyova 的 AI 不是脱离数据的聊天窗口，而是受权限、审批与审计约束的经营助手。

- **风险分级**：只读分析直接执行；写操作必须人工审批后才会真实落库；管理类工具仅超管可用。
- **审批闭环**：批准后系统真实执行，并回写执行结果，避免“批了但没执行”的假成功。
- **数字溯源**：经营结论中的数字必须来自指标目录查询，未通过核验的内容不展示为可信口径。
- **外部集成**：MCP Server 向外部 AI 客户端暴露只读工具域，支持 Token 鉴权与签名校验。
- **可选接入**：未配置外部模型时系统功能完整可用，AI 面板会明确提示不可用，而不是返回假数据。

## 技术架构

```text
Web 控制台 ─────────────┐
外部 AI 客户端 ─ MCP ───┼──→ API 服务 ──→ PostgreSQL
后台任务 worker ────────┘
```

- **Web 控制台**：React 19 + Vite 6 + Tailwind CSS 4，模块化路由与角色可见性控制。
- **API 服务**：Fastify 5 + TypeScript + PostgreSQL，统一鉴权、指标目录、质量门禁与审计。
- **MCP Server**：面向外部 AI 客户端的只读数据网关。
- **数据层**：PostgreSQL 行级安全、事实表分区、增量迁移与数据归档。
- **部署**：Docker Compose 一键启动，支持私有化与独立数据库。

## 安全与权限

- **角色体系**：内置老板（超级管理员）、运营总监、运营专员、中控、HRBP、投放专员六类角色，支持模块级授权与数据范围控制。
- **数据隔离**：基于 PostgreSQL 行级安全（RLS），按租户、平台、店铺、项目与主播维度过滤；未授权上下文默认不可见。
- **最小权限**：应用请求使用独立数据库角色；高风险表启用强制行级安全；业务视图避免绕过基表策略。
- **审计与加密**：关键操作全量审计；平台授权凭证落库前加密；AI 写操作强制审批并留痕。
- **品牌门户**：支持品牌方只读账号，按授权品牌与项目查看数据，不进入运营写流程。

## 快速开始

### Docker Compose

```bash
git clone https://github.com/BlazarLIU/leyova.git
cd leyova

cp .env.example .env
# 编辑 .env，将 DB_PASSWORD / SESSION_SECRET / API_ENCRYPTION_KEY /
# LEYOVA_MCP_TOKEN / LEYOVA_MCP_SIGNING_SECRET 替换为强随机值（推荐：openssl rand -hex 32）

docker compose up -d
```

查看 API 启动日志获取一次性安装凭证（也可在 `.env` 中通过 `LEYOVA_SETUP_TOKEN` 预先指定）：

```bash
docker compose logs api | grep -A 5 "安装凭证"
```

启动后访问：

- Web 控制台：`http://localhost:5513`（首次访问自动引导至 `/setup` 创建超级管理员账号）
- 后端 API：`http://localhost:8788`
- API 文档（Swagger UI）：`http://localhost:8788/docs`

Compose 编排包含带 `pgvector` 扩展的 PostgreSQL 16、API 服务与 Web 静态站点，API 启动时自动执行迁移。

### 本地开发

环境要求：Node.js ≥ 22、pnpm ≥ 9、PostgreSQL ≥ 14（需支持 `vector` 与 `pg_trgm` 扩展）。

```bash
pnpm install

cp apps/api/.env.example apps/api/.env
# 配置 DATABASE_URL、SESSION_SECRET、API_ENCRYPTION_KEY 等环境变量

pnpm db:setup
pnpm dev
```

### 数据库初始化与首次配置

```bash
# 执行基线 schema、系统默认数据与全部增量迁移
pnpm db:setup
```

初始化后系统仅包含角色、模块、系统配置、告警规则、目标模板等系统默认数据：

- **零内置账号**：不预置默认管理员或演示账号。首次打开系统自动进入 `/setup` 安装向导，由部署者使用服务端启动日志中的一次性安装凭证创建自己的最高权限（`super_admin`）账号。
- **零预置大模型信息**：仓库与数据库初始化脚本不包含任何大模型 API Key、服务地址或默认模型配置。部署并登录后，按需前往「系统配置与 AI → AI 模型」自行填写并测试连通性即可。
- **零演示业务数据**：不附带任何合成或真实店铺、主播、场次与订单数据。

生产部署前请配置强随机密钥、HTTPS、备份与监控。

## 项目结构

```text
leyova/
├── apps/
│   ├── web/              # Web 控制台
│   ├── api/              # API 服务与后台任务
│   └── mcp-server/       # MCP 数据网关
├── database/
│   ├── 01_schema.sql     # 全量基线 schema
│   ├── 02_seed.sql       # 角色 / 模块 / 系统配置等默认数据
│   └── migrations/       # 增量迁移链（含演示数据清理）
├── scripts/              # 质量门禁、健康探测、冒烟、备份与基准
└── docker-compose.yml
```

## 常用命令

| 命令 | 作用 |
| :--- | :--- |
| `pnpm dev` | 同时启动 Web 与 API |
| `pnpm build` | 构建全部应用 |
| `pnpm test` | 运行测试 |
| `pnpm check:guardrails` | 架构与编码约束检查 |
| `pnpm schema:check` | 校验 schema 与迁移一致性 |
| `pnpm ops:smoke` | 端到端冒烟 |
| `pnpm ops:probe` | 生产健康探测 |
| `pnpm openapi:check` | 校验 OpenAPI 产物是否为最新 |

## 许可证与商业合作

本项目采用 [GNU Affero General Public License v3.0](LICENSE)（AGPL-3.0）开源许可协议。

AGPL-3.0 允许商业使用与私有部署；如修改程序并通过网络向用户提供服务，需按同一许可证开放对应源码。

如需私有化部署、行业定制、数据迁移或商业授权，请联系项目团队。
