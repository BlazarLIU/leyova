# Leyova (乐播云) · 全渠道电商直播与代运营数字中台

<p align="center">
  <img src="apps/web/public/orbit-icon.svg" width="96" height="96" alt="Leyova Logo" />
</p>

<p align="center">
  <strong>下一代企业级全渠道电商直播运营、MCN 代播管理与数据智能决策平台</strong><br/>
  面向 MCN 代运营机构、品牌自播团队与全渠道多店铺卖家的数字化中枢
</p>

<p align="center">
  <a href="https://github.com/BlazarLIU/leyova/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node" /></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg" alt="pnpm" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19.0-61dafb.svg" alt="React 19" /></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/fastify-5.0-black.svg" alt="Fastify 5" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-14%2B-336791.svg" alt="PostgreSQL" /></a>
  <a href="https://github.com/BlazarLIU/leyova/stargazers"><img src="https://img.shields.io/github/stars/BlazarLIU/leyova?style=social" alt="GitHub Stars" /></a>
</p>

---

## 📖 平台全景概述

**Leyova** 是一套开箱即用的现代化企业级电商运营与数字决策中台。系统立足于中国电商“**品牌自播**”与“**MCN 代运营**”并存的双轨实际，原生支持 **7 大主流电商平台**（抖音、快手、淘宝、天猫、京东、拼多多、小红书）。

平台彻底打破了行业内常见的“仅看虚高 GMV”痛点，内置**全口径真实净利算法**、**4 阶受控 AI 助手**、**气象联动 AI 穿搭选品**、**智能防冲突排班**与**不可篡改法律结算凭单**，提供精细化的 **6 级 RBAC 角色权限管控**。

```mermaid
graph TD
  A[Leyova 数字化运营中枢] --> M1[🏢 纯代运营展示模式: MCN 机构中枢 / 签约项目 / 排班中心 / 月结对账单]
  A --> M2[🏷️ 纯品牌自播展示模式: 7 大平台全渠道货架 / 真实净利算法 / 投放对账]
  A --> M3[🌐 全功能总览展示模式: 代运营 + 品牌自播双轨融合全局决策]

  A --> RBAC[6 级账号身份权限: 系统管理员 / 管理员 / 运营 / 财务 / HRBP / 员工]
  A --> PF[7 大平台属性严格分流: 抖音 · 快手 · 淘宝 · 天猫 · 京东 · 拼多多 · 小红书]
  A --> AI[受控 AI 赋能: AI 助手 · 天气穿搭选品 · AI 智能排班 · 异动归因]
```

---

## 🌟 核心特色与架构亮点

### 1. 三大业务展示模式（顶栏一键热切换）
系统内置模式状态机，根据企业形态或演示诉求在顶栏秒级切换：
- **🏢 纯代运营模式 (Agency Pure Mode)**：面向代播服务商与 MCN 机构。聚焦代播签约项目合同、主播档案与排班考勤中心、不可篡改月度对账凭单与品牌自播档案；
- **🏷️ 纯品牌自播模式 (Brand Pure Mode)**：面向品牌商自营全渠道团队。聚焦全平台货架大盘、真实利润核算、多店铺投放对账，自动隐藏外包代播与中介菜单；
- **🌐 全功能总览模式 (Full Omnichannel Mode)**：代运营与品牌自播全功能融合，满足综合型大型机构与集团化决策。

---

### 2. 中国 7 大主流电商平台深度解构与严格属性隔离
系统依据各平台的底层商业逻辑与流量模型，对功能进行严格区分与自适应动态裁剪，**绝不跨界串扰**：

| 平台代号 / 名称 | 电商业务属性 | 核心流量分发与经营逻辑 | 系统特色专属功能模块 |
| :--- | :--- | :--- | :--- |
| **`douyin` 抖音电商** | 全域兴趣电商 | 算法赛马推流（5级流量池模型）、千川付费撬动自然流、短视频挂车与抖音商城双轮驱动。 | 直播大屏、实时监控、场次排品、复盘7联板 (转化漏斗/渠道流/主播效能)、千川 GPM 穿透。 |
| **`kuaishou` 快手电商** | 老铁信任电商 | 强人设私域黏性、老铁粉丝团沉淀、高频开播高复购、直接带货与下播后间接延时成交并重。 | 公私域流量切片 (`traffic-split`)、间接延时成交分析 (`indirect-gmv`)、老铁粉丝团运营 (`fans-team`)。 |
| **`taobao` 淘宝集市** | 搜索货架电商 | 人找货心智、关键词自然搜索 SEO、天天特卖与聚划算爆品、万相台无界投放、父子订单口径。 | 淘宝店铺看板 (`board`)、万相台投放对账 (`ad-reconciliation`)、商品渠道结构 (`product-channel`)。 |
| **`tmall` 天猫商城** | 品牌官方旗舰 | 官方大促（双11/618）爆发主阵地、88VIP 高净值会员资产、DSR 动态评分与保价考核。 | 品牌经营看板、大促满减优惠券摊薄拆解、DSR 动态评分三维雷达 (描述/服务/物流)。 |
| **`jd` 京东电商** | 自营品质 + POP | 自营（VC 采购入仓、京东物流次日达）与 POP 第三方商家双轨制、店铺星级四维考核。 | 京东经营看板 (`board`)、店铺星级四维考核 (`store-rating`)、仓配履约时效监控 (`fulfillment`)。 |
| **`pdd` 拼多多** | 社交裂变货架 | 单品爆款裂变、拼单成团算法、全站推广算法托管、比价跟价机制、买家“仅退款”仲裁风控。 | 成团转化漏斗 (`group-funnel`)、三口径比对 (`caliber-compare`)、仅退款秒退风控 (`refund`)。 |
| **`xiaohongshu` 小红书** | 内容种草买手 | 生活方式分享、看笔记种草到站内搜索回搜、商卡拔草闭环、买手慢直播（高客单重审美品质）。 | 笔记经营看板 (`notes`)、互动率 CES 与种草回搜转化链路 (`conversion`)、达人矩阵管理。 |

---

### 3. 六级账号身份与细粒度 RBAC 权限矩阵
系统建立起兼顾业务赋能与商业机密隔离的 6 级内部权限体系，并无缝外接品牌只读视角：

```mermaid
flowchart LR
  L1[👑 系统管理员 super_admin] --> L2[🏢 管理员 admin<br/>业务总监 / 机构负责人]
  L2 --> L3[🚀 运营 operator<br/>操盘手 / 场控 / 投放]
  L2 --> L4[💰 财务 finance<br/>成本核算 / 月结对账单]
  L2 --> L5[👥 HRBP hrbp<br/>主播梯队 / 考勤排班]
  L3 --> L6[🎙️ 员工 employee<br/>带货主播 / 现场中控]
  L5 --> L6
  
  EXT[🏷️ 品牌自播代表 brand_viewer<br/>品牌专属受限只读看板] -.->|物理 RLS 强隔离| L2
```

- **👑 Level 1 · 系统管理员 (`super_admin`)**：平台最高权限，平台店铺接入启停、多租户调度、数据字典与底层配置；
- **🏢 Level 2 · 管理员 (`admin`)**：机构负责人/业务总监，拥有全业务大盘审批、跨项目统筹与编制立项权限；
- **🚀 Level 3 · 运营 (`operator`)**：直播操盘手、现场场控与投放人员，负责场次调度、排品、投流与直播复盘；
- **💰 Level 4 · 财务 (`finance`)**：专注全口径内部成本录入、GMV 梯度佣金核算、不可篡改月结对账单生成与盖章打印；
- **👥 Level 5 · HRBP (`hrbp`)**：专注主播人才库画像、等级晋级签约、考勤统计、排班审批与绩效提成；
- **🎙️ Level 6 · 员工 (`employee`)**：一线作业人员（包含**带货主播**与**现场中控**），极简自驱工作台（我的排班日程、带货业绩看板、AI 穿搭话术、现场登记），**严密屏蔽内部商业成本与合同数据**；
- **🏷️ 外部视角 · 品牌自播代表 (`brand_viewer`)**：签约品牌商代表独立登录受限门户 (`/brand-portal`)，只读自身品牌项目，底层数据库物理级 RLS 隔离。

---

### 4. 专业级直播代运营业务赋能
- **双维度排行榜**：驾驶舱首屏支持「主播带货 GMV 榜」与「代播项目 GMV 榜」Top 10 自由切换与贡献度进度条；
- **天气 AI 穿搭与智能选品**：根据产业带城市实时天气预报，智能测算温差，自动推荐主推服饰 SKU 与主播开场三段式话术；
- **排班冲突阻断中心**：4 大黄金时段测算主副播组合，具备重叠时段智能阻断拦截与一键 AI 排期；
- **不可篡改月度对账单**：基础代播月费、GMV 梯度阶梯佣金、坑位费与违约扣减全自动化核算；账单一经发送即触发数据库锁定保护，杜绝擅自篡改，支持标准 A4 盖章凭证打印与 PDF 导出。

---

### 5. 自研受控 AI 助手与知识库联动
- 自研轻量四阶受控编排器（Planner → Executor → Critic → Reporter），严禁大模型幻觉瞎编数字，**所有数据 100% 溯源数据库真实事实表**；
- 自然语言交互，支持多维度趋势对比、经营异常波动归因、流量跌落检测与优化诊断；
- 开放标准知识库外挂接口，可接入开源 RAGFlow 或 MaxKB。

---

## 🏗️ 系统架构图

```mermaid
flowchart TD
  subgraph 前端控制台 (apps/web · React 19 + Vite + Tailwind)
    Topbar[顶栏中枢: 模式切换器 / 7大平台店铺选择 / 全局Cmd+K搜索]
    Sidebar[自适应侧边栏: 按代运营/自播模式与7大平台业态动态裁剪]
    Views[78个业务页面: 驾驶舱 / 排班中心 / 成本对账 / 品牌自播门户 / AI工作台]
  end

  subgraph 后端微服务 (apps/api · Fastify 5 + TypeScript)
    Guard[RBAC 6级身份权限 & 成本敏感数据隔离中间件]
    API_Core[258个业务API端点]
    Engine_Profit[全口径净利算法引擎]
    Engine_Schedule[AI 智能排班防冲突推导引擎]
    Engine_Weather[气象联动智能选品穿搭引擎]
    Engine_Alert[指标阈值告警与 Webhook 调度引擎]
    Engine_AI[自研四阶受控 Agentic 编排器]
  end

  subgraph 数据中枢 (PostgreSQL 14+)
    DB_Base[(126 张业务表与事实表)]
    DB_Migrations[database/migrate.js 自动化增量版本迁移链]
  end

  Topbar --> Views
  Sidebar --> Views
  Views -->|REST API / SSE 流式通信| Guard
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

## 🔑 默认登录账号清单 (初始密码统一为: `Admin@123456`)

系统数据库已预置 6 级权限与外部租户视角的标准体验账号，可直接登录进行全流程体验：

| 权限级别 | 身份角色 | 登录用户名 | 初始密码 | 推荐体验场景 |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | **👑 系统管理员** | `admin` | `Admin@123456` | 平台底层运维、全平台店铺启停配置、租户与账号权限管理 |
| **Level 2** | **🏢 管理员 (总监)** | `manager_liu` | `Admin@123456` | 机构负责人视角、全盘业务大盘、代播项目与签约立项、跨部门统筹 |
| **Level 3** | **🚀 运营 (操盘手)** | `operator_wang` | `Admin@123456` | 直播场次调度、货盘排品、投流监控、直播复盘与全渠道店铺运营 |
| **Level 4** | **💰 财务主管** | `finance_chen` | `Admin@123456` | 内部真实成本录入、GMV 阶梯佣金核算、月结对账单生成与法律凭证锁定 |
| **Level 5** | **👥 HRBP (主播赋能)** | `hr_li` | `Admin@123456` | 主播档案库画像、等级晋级签约、考勤统计、排班防超时审批与绩效提成 |
| **Level 6** | **🎙️ 员工 (带货主播)** | `anchor_shen` | `Admin@123456` | 个人自驱工作台：我的排班日程、我的带货绩效看板、气象选品话术、打卡考勤 |
| **Level 6** | **🎛️ 员工 (现场中控)** | `control_zhao` | `Admin@123456` | 现场工作台：直播登记台、场次数据填报、应急话术库速查 |
| **外部租户** | **🏷️ 品牌自播代表** | `gap_viewer` | `Admin@123456` | 品牌自播专属受限只读看板 (`/brand-portal`)，物理级 RLS 强隔离 |

---

## 🚀 极速部署指南 (Quick Start)

### 方式一：Docker Compose 一键启动（推荐，生产与演示环境首选）

确保本地已安装 [Docker](https://www.docker.com/) 与 Docker Compose：

```bash
# 1. 克隆仓库
git clone https://github.com/BlazarLIU/leyova.git
cd leyova

# 2. 一键启动容器集群（自动初始化 PostgreSQL 数据库并应用全部增量迁移）
docker compose up -d

# 3. 访问系统
# 前端 Web 控制台: http://localhost:5513
# 后端 API 接口:   http://localhost:8788
```

---

### 方式二：本地开发部署

#### 1. 前置环境要求
- **Node.js**：≥ 22.0.0
- **pnpm**：≥ 9.0.0 (`npm i -g pnpm`)
- **PostgreSQL**：≥ 14.0（本地实例或 Docker 均可）

#### 2. 安装项目依赖
```bash
pnpm install
```

#### 3. 环境变量配置
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```
根据实际情况修改 `apps/api/.env` 中的 `DATABASE_URL`（例如：`postgresql://leyova:password@127.0.0.1:5432/leyova`）。

#### 4. 一键执行数据库基线建表与增量迁移
```bash
pnpm db:migrate
```
该命令会自动扫描并运行 `database/migrations/` 下所有增量迁移脚本，自动注入基础字典与默认体验账号。

#### 5. 启动本地热重载开发服务
```bash
pnpm dev
```
启动后终端将显示：
- 前端 Web 控制台：`http://localhost:5513`
- 后端 Fastify API 服务：`http://localhost:8788`

---

## 📂 项目工程目录规范

```text
leyova/
├── .vscode/                  # 团队统一 VS Code 工作区配置、推荐插件与 F5 调试配置
├── apps/
│   ├── api/                  # Fastify 5 + TypeScript 后端服务
│   │   ├── src/
│   │   │   ├── ai/           # 自研四阶受控 AI 编排器与指标语义层
│   │   │   ├── routes/       # 业务路由（agency代播 / costs成本 / schedule排班 / bi / shop）
│   │   │   ├── lib/          # 数据库连接池、RBAC守卫、天气客户端
│   │   │   └── index.ts      # API 服务主入口
│   │   ├── Dockerfile        # 后端容器构建定义
│   │   └── package.json
│   ├── web/                  # React 19 + Vite 6 + Tailwind CSS 前端控制台
│   │   ├── src/
│   │   │   ├── components/   # 模块化 UI 与业务组件（WorkMode / Leaderboard / PrintModal）
│   │   │   ├── hooks/        # 全局状态（useWorkMode / usePlatform / useSidebar）
│   │   │   ├── pages/        # 78 个业务功能页面（agency / anchors / shop / bi / review）
│   │   │   └── data/         # 自适应多平台导航与业态分流 (platform-navigation.ts)
│   │   ├── Dockerfile        # Nginx 静态生产部署定义
│   │   └── package.json
│   └── mcp-server/           # MCP (Model Context Protocol) 工具服务
├── database/                 # 数据库资产
│   ├── 01_schema.sql         # 初始基线表结构
│   ├── 02_seed.sql           # 初始系统字典
│   ├── 03_demo_data.sql      # 演示数据
│   ├── migrations/           # 100~113 增量版本迁移 SQL 链
│   └── migrate.js            # 自动化增量版本迁移执行器
├── docker-compose.yml        # Docker 一键编排文件
├── ecosystem.config.cjs      # PM2 生产环境进程托管配置
├── package.json              # Monorepo 根配置
└── LICENSE                   # Apache-2.0 开源许可协议
```

---

## 📄 开源许可证 (License)

本项目采用 [Apache-2.0 License](LICENSE) 开源许可协议。商业友好，欢迎 Star、Fork 并提交 Pull Request！
