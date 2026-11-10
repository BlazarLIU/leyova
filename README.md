# Leyova (乐播云) · 全平台电商运营决策与 MCN 代播 SaaS 平台

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)]()
[![React](https://img.shields.io/badge/react-19-61dafb.svg)]()
[![Fastify](https://img.shields.io/badge/fastify-5-black.svg)]()
[![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-336791.svg)]()

> **Leyova** 是一套面向**品牌自播**与 **MCN 代运营**双轨场景的企业级电商数字化管理系统。全面覆盖 **7 大电商平台**（抖音、快手、淘宝、天猫、京东、拼多多、小红书），内置专业级 MCN 直播代运营体系、**真实净利算法引擎**、**主播智能排班**、**天气 AI 穿搭选品**与**不可篡改法律结算对账单**。

---

## 🌟 核心特性与架构亮点

### 1. 三大专属展示模块（顶栏一键无缝热切换）
系统内置 `useWorkMode` 工作模式状态机，支持用户在顶栏根据业务身份随时自由切换：
- 🏢 **代运营 MCN 模式 (专业代播版)**：聚焦代播服务商与 MCN 机构场景，包含专业代播运营中枢、主播排班调度、多品牌签约合同与月度结算对账中心。
- 🏷️ **品牌自播模式 (全渠道决策版)**：聚焦品牌商自营全渠道决策，汇聚 7 大平台货架大盘、真实净利算法、多平台专属经营看板（淘系万相台/京东四维星级/拼多多三口径对账），自动隐藏外包中介页面。
- 🌐 **全功能总览模式 (集团综合演示版)**：包含代运营 + 品牌自播的全部完整能力，满足集团总览、对外演示或兼具自营与代播双重业务的综合型机构。

### 2. 7 大主流电商平台全覆盖与自适应导航
针对不同电商平台的经营对象（直播间 vs 店铺 SKU vs 笔记达人），信息架构按业态自适应切换：
- **直播电商（抖音 / 快手）**：场次 GMV、千川投流、主播效能、公私域流量拆解、直播复盘与改进闭环；
- **货架电商（淘宝 / 天猫 / 京东 / 拼多多）**：店铺成交、商品结构、万相台投放对账、京东四维星级、拼多多成团转化漏斗；
- **内容种草（小红书）**：笔记曝光、互动回搜、达人矩阵与种草人群沉淀。

### 3. 真实净利算法与全口径成本模型
告别仅看 GMV 虚高数字的传统盲区。系统建立 `cost_entries` 全口径成本录入（人力、千川/广告投流、货品采购成本、平台扣点等），驾驶舱实时联动核算**真实净利润**与**净利率**。

### 4. 专业级直播代运营业务赋能
- **双维度业绩排行榜**：驾驶舱首屏支持「主播 GMV 排行榜」与「代播项目 GMV 排行榜」Top 10 自由切换与贡献占比进度条；
- **天气 AI 穿搭与智能选品**：基于 5 大核心产业带城市实时天气预报，AI 智能测算当日温差并精准匹配主推服饰 SKU 与主播开场三段式话术；
- **智能排班与防冲突矩阵**：4 大黄金时段（早间清醒场/午间冲锋场/晚间巅峰场/深夜长尾场）AI 测算主副播搭配，支持排班日历/明细看板、重叠时段智能阻断拦截与一键 AI 排期；
- **主播个人自驱看板 (`/anchors/my-performance`)**：为主播提供个人专属业绩中心、五维能力雷达评分、团队排名与开播前 30 分钟检查清单；
- **月结对账单与不可篡改 (IMMUTABLE) 法律凭证**：支持基础代播月费、GMV 梯度阶梯佣金、坑位费与违约扣减，账单一经发送或确认自动进入数据库锁定保护，并提供标准 A4 合同盖章位凭单打印与 PDF 导出；
- **甲方品牌独立受限门户 (Brand Portal)**：甲方品牌代表使用独立账号登录，数据只读且严格屏蔽代播内部成本 (`canViewCost: false`)。

### 5. 自研轻量四阶受控 AI 编排器
彻底解耦外部重型框架，系统自研四阶 Agentic 编排器（Planner → Executor → Critic → Reporter），严禁大模型自行编造数字，所有结论数字 100% 溯源真实事实表。

---

## 🏗️ 整体系统架构

```mermaid
flowchart TD
  subgraph 前端控制台 (apps/web · React 19 + Vite)
    Topbar[顶栏中枢: 模式切换器 / 平台店铺选择 / 全局Cmd+K搜索]
    Sidebar[自适应侧边栏: 按代运营/自播模式/业态动态裁剪]
    Views[78个业务页面: 驾驶舱 / 排班中心 / 成本对账 / 甲方门户 / AI工作台]
  end

  subgraph 后端微服务 (apps/api · Fastify 5 + TypeScript)
    Guard[RBAC 角色权限与租户隔离中间件]
    API_Core[258个业务API端点]
    Engine_Profit[真实净利算法引擎]
    Engine_Schedule[AI 智能排班推导引擎]
    Engine_Weather[气象与智能选品引擎]
    Engine_Alert[指标预警与飞书/钉钉 Webhook 推送]
    Engine_AI[自研四阶受控 Agentic 编排器]
  end

  subgraph 数据中枢 (PostgreSQL 14+)
    DB_Base[(126张业务表与历史事实表)]
    DB_Migrations[database/migrate.js 自动化版本迁移链]
  end

  Topbar --> Views
  Sidebar --> Views
  Views -->|REST / SSE 流式| Guard
  Guard --> API_Core
  API_Core --> Engine_Profit
  API_Core --> Engine_Schedule
  API_Core --> Engine_Weather
  API_Core --> Engine_Alert
  API_Core --> Engine_AI
  Engine_Profit --> DB_Base
  Engine_Schedule --> DB_Base
  Engine_AI --> DB_Base
  DB_Migrations --> DB_Base
```

---

## 🚀 极速开始 (Quick Start)

### 方式一：Docker Compose 一键启动（推荐，10 秒开箱即用）

确保本地已安装 [Docker](https://www.docker.com/) 与 Docker Compose：

```bash
# 1. 克隆仓库
git clone https://github.com/your-username/leyova.git
cd leyova

# 2. 一键启动容器集群（自动初始化 PostgreSQL 数据库并应用全部迁移）
docker compose up -d

# 3. 访问系统
# 前端 Web 控制台: http://localhost:5513
# 后端 API 接口:   http://localhost:8788
```

---

### 方式二：本地开发部署

#### 1. 前置依赖
- **Node.js**：≥ 22.0.0
- **pnpm**：≥ 9.0.0 (`npm i -g pnpm`)
- **PostgreSQL**：≥ 14.0（本地实例或容器均可）

#### 2. 安装依赖
```bash
pnpm install
```

#### 3. 配置环境变量
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```
根据本地 PostgreSQL 实际连接信息修改 `apps/api/.env` 中的 `DATABASE_URL`。

#### 4. 一键初始化与自动化数据库迁移
只需运行以下单条命令，系统将自动建库、跑完基线建表与增量迁移链：
```bash
pnpm db:migrate
```

#### 5. 启动服务
```bash
# 同时启动后端 API (端口 8788) 与前端 Web (端口 5513)
pnpm dev
```

---

## 🔑 默认登录账号

| 账号身份 | 用户名 | 密码 | 适用场景 |
| :--- | :--- | :--- | :--- |
| **超级管理员** | `admin` | `Admin@123456` | 全功能总览模式、平台启停配置、租户与账号管理 |
| **代播机构运营** | `operator` | `Admin@123456` | 代运营模式、项目签约管理、排班与月结对账 |
| **执棒主播代表** | `anchor_shen` | `Admin@123456` | 我的排班日程、我的带货绩效看板、气象选品话术 |
| **甲方品牌客户** | `gap_viewer` | `Admin@123456` | 甲方专属受限只读看板 (`/brand-login`) |

---

## 📂 项目工程目录规范

```text
leyova/
├── apps/
│   ├── api/                  # Fastify 5 后端 API 服务
│   │   ├── src/
│   │   │   ├── routes/       # 业务路由（agency代播 / costs成本 / schedule排班 / alerts预警 / ai）
│   │   │   ├── lib/          # 数据库连接池、安全守卫、天气客户端
│   │   │   └── index.ts      # 服务主入口
│   │   ├── Dockerfile        # 后端容器构建
│   │   └── package.json
│   ├── web/                  # React 19 前端控制台
│   │   ├── src/
│   │   │   ├── components/   # UI 与业务组件（WorkModeSwitcher / Leaderboard / PrintModal）
│   │   │   ├── hooks/        # 全局状态（useWorkMode / usePlatform / useTheme）
│   │   │   ├── pages/        # 78个业务页面（agency / anchors / brand-portal / shop / bi）
│   │   │   └── data/         # 动态自适应导航定义 (platform-navigation.ts)
│   │   ├── Dockerfile        # Nginx 生产容器构建
│   │   └── package.json
│   └── mcp-server/           # MCP (Model Context Protocol) 工具服务
├── database/                 # 数据库资产
│   ├── 01_schema.sql         # 初始基线建表
│   ├── 02_seed.sql           # 基础角色权限字典
│   ├── 03_demo_data.sql      # 演示数据
│   ├── migrations/           # 100~112 增量版本迁移 SQL 链
│   └── migrate.js            # 一键自动化迁移运行器
├── docker-compose.yml        # Docker 一键编排文件
├── ecosystem.config.cjs      # PM2 生产运维配置
├── package.json              # Monorepo 根配置
└── LICENSE                   # Apache-2.0 开源许可
```

---

## 📄 开源许可证 (License)

本项目采用 [Apache-2.0 License](LICENSE) 开源协议，商业友好，欢迎 Star、Fork 与提交 Pull Request！
