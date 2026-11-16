# Leyova (乐播云) · 全渠道电商数字化运营中枢

<p align="center">
  <img src="apps/web/public/orbit-icon.svg" width="96" height="96" alt="Leyova Logo" />
</p>

<p align="center">
  <strong>现代化企业级全渠道电商运营、多平台履约风控与数据智能决策平台</strong><br/>
  面向全渠道电商自播品牌、MCN 机构与泛货架卖家的坚固数字化技术基座
</p>

<p align="center">
  <a href="https://github.com/BlazarLIU/leyova/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg" alt="Node" /></a>
  <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-%3E%3D9.0.0-orange.svg" alt="pnpm" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/react-19.0-61dafb.svg" alt="React 19" /></a>
  <a href="https://fastify.dev/"><img src="https://img.shields.io/badge/fastify-5.0-black.svg" alt="Fastify 5" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-14%2B-336791.svg" alt="PostgreSQL" /></a>
  <a href="https://github.com/BlazarLIU/leyova/actions"><img src="https://img.shields.io/badge/CI-passing-success.svg" alt="CI Status" /></a>
  <a href="https://github.com/BlazarLIU/leyova/stargazers"><img src="https://img.shields.io/github/stars/BlazarLIU/leyova?style=social" alt="GitHub Stars" /></a>
</p>

---

## 📖 平台全景概述

**Leyova** 是一套开箱即用、高吞吐、零幻觉的现代化企业级全渠道电商运营中台。系统聚焦中国主流电商核心主阵地（**抖音、快手、淘宝、天猫、微信视频号**与**小红书种草**），彻底颠覆行业传统“只看虚高 GMV”与“裸手写前端表格”的痛点。

底层架构基于 **PostgreSQL 14+ / 18 分区表与物理级 RLS 深度防御**，内置**核心汇总层 (`agg_*`)**、**百万级数据七段清洗管道**、**单 SQL 8 质量门禁**、**全渠道防超卖锁库预留池**、**复式记账总账凭证链**、**AI 6 大核心契约层（60 题 Golden Set 100% 评测通过）**、**全栈 `<DataPage>` + `useTable` 声明式前端体系**与**独立分布式锁任务 Worker 守护进程**。

```mermaid
graph TD
  Core["Leyova 数字化运营中枢"]

  Core --> D1["📊 核心汇总层 (agg_*): 毫秒级多维出数 · 消灭大表裸扫 · 增量聚合"]
  Core --> D2["🛡️ 数据质量管道: UNLOGGED暂存 · 跨分区哨兵去重 · 隔离区 · 8条SQL门禁"]
  Core --> D3["🔒 权限体系收敛: 8→3表归一 (sys_role/perm) · Casbin元组 · PostgreSQL RLS"]
  Core --> D4["📦 大促领域补强: 渠道专享价与配额 · 悲观锁防超卖预留 · 复式记账总账 · 行级RMA"]
  Core --> D5["🤖 受控 AI 重建: 6核心契约 · 实体映射分词 · Ragas Critic核验 · 60题Golden Set"]
  Core --> D6["⚡ 声明式前端: <DataPage> + useTable · 8合1看板 · 4合1排班 · 防乱码CSV导出"]
  Core --> D7["⚙️ 高可用运维: 独立 Worker 异步解耦 · 分布式主备调度 · 全链路监控与健康探针"]
```

---

## 🌟 核心架构与系统亮点

### 1. 精益前端体系：`<DataPage>` + `useTable` 声明式全栈收敛
- **状态与取数原语归一**：自研 `useTable` Hook，统一封装分页、多列排序、多字段筛选、300ms 搜索防抖、批量行选择、请求时序竞争防丢、带 UTF-8 BOM 防乱码 CSV 导出。
- **声明式组件彻底替代手写 DOM**：全系统推广统一 `<DataPage<T>>` 架构，消灭数百处重复繁复的手写 HTML `<table>`。
- **8 合 1 统一驾驶舱看板 (`UnifiedDashboardHub`)**：无缝聚合核心经营驾驶舱、BI 综合大盘、全渠道分析、Net-ROI 投放投产比、单场复盘、短视频流量、渠道拆分与店铺矩阵，并支持 URL 查询参数与深层路由兼容。
- **4 合 1 排班调度中心 (`UnifiedScheduleHub`)**：深度整合排班月历看板、人员档案编排、个人出勤打卡与 AI 智能测算排班。
- **重度业务场景全量覆盖**：全渠道库存中心、履约 48h SLA 监控、客服效能、审计日志、预警规则、营销大促、账号配置与系统卡片全部接入标准组件。

---

### 2. 高性能核心汇总层 (`agg_*`) 与七段清洗质量管道
- **解决千万级报表慢查难题**：建立 `agg_trade_day_platform_channel` 与 `agg_traffic_day_live` 汇总表，看板与报表 100% 走汇总层出数，将历史 7 秒级的明细大表全表裸扫压缩至 **<5ms** 极速响应（基准压测提升 2.1x~5x）。
- **PostgreSQL Advisory Lock 并发互斥**：以 `hashtext('job:agg_daily')` 事务锁保障集群部署下汇总任务互斥，彻底杜绝数据脏写与重跑。
- **七段流式清洗管道**：`LAND` (原始留痕) → `STAGE` (UNLOGGED 高速暂存表，单机 5~20万行/s) → `VALIDATE` (SQL 集合门禁) → `NORMALIZE` (口径归一) → `DEDUP` (跨分区哨兵表 `land_raw_dedup` 全局排重) → `LOAD` (集合式写入) → `REPORT` (批次回执与告警)。
- **8 条 SQL 集合质量门禁**：行数守恒、金额守恒、自然键唯一、枚举合法、时间连续补 0、事实 vs 汇总核算、平台侧对账核查与新鲜度 SLA 监控，异常行自动流转进入 `dq_quarantine` 隔离区进行在线处置。

---

### 3. 极简现代权限架构：8→3 表收敛 + PostgreSQL RLS 物理深度防御
- **架构表 8→3 收敛归一**：彻底废弃历史碎片化权限表，收敛为标准 `sys_role`、`sys_role_permission`、`sys_user_role` 三张核心表，完整对齐 Casbin `(p, g)` 策略元组模型。
- **双向触发器平滑兼容**：通过 `sync_roles_to_sys_role` 与 `sync_role_modules_to_sys_perm` 等安全触发器，保障存量系统、历史测试与旧接口 100% 无破坏向后兼容。
- **通用 RLS 深度防御机制**：底层由 `rls_check_permission(role, module)` 与 `rls_check_scope(user_id, ...)` 双重函数统一判定，SQL 查询统一运行于受限身份 `leyova_app`，杜绝任何应用层水平或垂直越权旁路。

---

### 4. 深度吃透主流电商主阵地：平台专属打法与业务隔离

系统拒绝“千篇一律”的通用表单，针对各大平台底层商业与流量逻辑提供专属架构支撑：

| 主战场 | 平台底层商业与流量逻辑 | 操盘手/团队实战核心痛点 | Leyova 专属针对性业务设计 |
| :--- | :--- | :--- | :--- |
| **`douyin` 抖音电商** | 算法赛马推流 + 千川撬动自然流；内容场（短视频/主播话术）+ 货架场双轮驱动。 | 算法推流瞬息万变；千川过度消耗利润；服务体验分跌绿触发限流。 | • 直播间实时大屏与 GPM 毫秒级穿透<br/>• 千川投产比与自然流杠杆测算<br/>• 场次排品漏斗与抖店体验分预警雷达 |
| **`kuaishou` 快手电商** | 老铁信任经济 + 强私域深度沉淀；下播后次日长尾延时成交显著。 | 主播下播后 24~72 小时成交归因失真；老铁粉丝团黏性跟踪难度大。 | • 公私域流量切片看板 (`traffic-split`)<br/>• 下播后间接延时 GMV 核算 (`indirect-gmv`)<br/>• 老铁粉丝团分层与分成对账 |
| **`taobao` 淘宝集市** | 人找货主动心智；核心依靠搜索 SEO 卡位、聚划算/天天特卖跑量、万相台无界版。 | 搜索流量持续收窄；淘客佣金扣减后净利虚标；父子订单拆分繁杂。 | • 淘系店铺经营大盘 (`board`)<br/>• 阿里妈妈万相台无界版投放对账<br/>• 商品动销率与淘客佣金净利润核算 |
| **`tmall` 天猫商城** | 官方旗舰心智；平台级超级大促爆发；88VIP 消费券抵扣；DSR 动态评分三维雷达。 | 大促跨店满减凑单“秒退款”带来严重运费与补贴倒贴；入驻门槛高。 | • 品牌旗舰自播看板<br/>• **大促跨店满减券摊薄与退款损失穿透拆解**<br/>• DSR 评分预警与 88VIP 贡献度分析 |
| **`wechat` 微信视频号** | 微信生态公私域大联动；熟人社交圈背书与企业微信客户池冷启动。 | 公域流量与社群企微私域转化断层；长尾触达缺乏工具追踪。 | • 视频号公私域联动看板 (`wechat-private-public`)<br/>• 场次交易与企微客群回搜归因 |
| **`xiaohongshu` 小红书** | 生活方式真实种草 + 买手慢直播；“笔记评测种草 -> 站内回搜 -> 商卡拔草”。 | 种草容易拔草难，跨端流失归因断链；蒲公英达人水军刷量。 | • 种草回搜率 (Search Uplift) 转化分析 (`conversion`)<br/>• 蒲公英达人 ROI 投放矩阵与笔记带货漏斗 |

---

### 5. 电商大促与零售领域能力深度补强
- **Channel 级专享价与渠道独占配额**：支持同一 SPU/SKU 在抖音、天猫、视频号等不同平台独立配置专享售价与可用配额，约束 `allocated_stock >= reserved_stock` 防倒挂超卖。
- **大促防超卖原子锁库预留池**：下单时悲观行锁锁定物理库存与渠道配额，支付成功核销出库，超时或取消自动释放回库，全流程记录不可篡改的 `fact_inventory_ledger` 审计流水。
- **复式记账总账与凭证链 (`fact_gl_voucher`)**：遵循电商企业级会计规范，严格校验 `SUM(debit) == SUM(credit)`；单场盈亏可反向追溯凭证链（销售收入、出库成本、平台扣点、投流消耗、物流快递）。
- **订单全生命周期事件流与行级 RMA 售后**：订单状态流转记录不可篡改时间轴，支持子订单行级精确退换（退货、换货、维修、退款），质检合格自动联动回仓与流水记账。
- **EAV 自定义字段元数据引擎**：跨 6 大核心业务实体自由定义动态指标与校验规则，自动挂载宿主实体 JSONB 扩展字段，免频繁改库改表。

---

### 6. AI 模块 6 契约深度重建与 60 题 Golden Set 自动化评测
- **切除黑盒与死代码**：彻底移除 OpenClaw/DeerFlow 不受控黑盒依赖与死配置，实现全流程代码级确定性。
- **6 大核心契约层规范**：
  - `PlanSchema`：强类型意图识别与执行计划（支持单/多指标、趋势、时序预测、异动归因、多周期对比）；
  - `EvidenceSchema`：严格定义数据血缘依赖（`parents[]`），杜绝环路；
  - `ClaimPacketSchema`：结构化断言，**严禁裸数字，每个数值必须锚定证据包**；
  - `TraceSchema`：对齐 OpenTelemetry GenAI 统一追踪语义；
  - `CriticSchema`：借鉴 Ragas 算法逐句核验，未通过核验坚决拒答（`verdict='rejected'`），不输出未经核验的幻觉数据。
- **SuperSonic 倒排实体识别器**：基于同义词倒排索引与贪婪分词，实现自然语言到指标（gpm, roi, aov, refund_rate 等）、平台与维度的毫秒级精准映射，彻底根治问 GPM 答 GMV 等历史指标漂移问题。
- **60 题 Golden Set 自动化评测全绿**：
  - 覆盖 S1 问数 (15 题) ~ S6 复盘 (7 题) 完整业务场景；
  - 评测通过率：**100%（60/60 全部通过）**；
  - 意图识别准确率：**95.00%**；
  - 指标识别准确率：**96.67%**；
  - 未溯源数字总数：**0 个（绝对纯证据溯源）**。

---

### 7. 高可用后台任务调度与全栈可观测性
- **API 与重度计算进程解耦**：将批量数据清洗、8 项 SQL 数据质量门禁、核心指标增量预聚合、合规风险巡检等耗时任务彻底剥离出 Fastify Web 进程，移至独立 Worker 集群异步运行，保障前端交互与核心 API 始终具备稳定毫秒级吞吐。
- **分布式主备 Leader 选举机制 (Active-Standby)**：基于数据库分布式互斥锁，多实例集群部署时自动选举单一活跃 Master 调度节点，其余实例作为备机无缝待命；当 Master 宕机或维护时快速平滑接管，杜绝定时任务并发脏写。
- **全链路指标可观测体系**：集成标准 Prometheus 监控端点 (`/metrics`)，实时采集与输出 HTTP QPS、P95/P99 接口耗时、Node.js 运行时健康度（CPU、内存、EventLoop Lag）及数据库连接池负载状态。
- **端到端核心业务闭环健康巡检**：内置一键式探针与业务自动化冒烟套件 (`pnpm ops:smoke`)，可在 5 秒内全自动化穿透用户鉴权、数据入库、任务抢占、库存锁库、履约 SLA 及智能选品等核心链路，实时校验系统健康水准。

---

## 🏗️ 系统架构图

```mermaid
flowchart TD
  subgraph Layer1["1. 终端与表现层 (Presentation Layer · React 19 + Vite 6 + Tailwind CSS)"]
    direction LR
    UI_Console["多平台经营控制台\n(全渠道驾驶舱 / 实时大屏)"]
    UI_Live["运营中枢\n(场次调度 / 货盘排品 / 复盘看板)"]
    UI_Ops["履约与供应链看板\n(48h SLA / 售后工单 / 动态库存)"]
    UI_AI["智能决策工作台\n(AI 全品类选品 / 气象与趋势预测)"]
  end

  subgraph Layer2["2. API 与安全网关层 (API Gateway Layer · Fastify 5 + TypeScript)"]
    direction LR
    GW_Auth["统一身份鉴权与 RBAC\n(双重判定 / 租户严格隔离)"]
    GW_REST["核心业务 REST / SSE 接口\n(标准化契约 / 毫秒级吞吐)"]
    GW_Obs["Prometheus 生产级观测\n(/metrics 采样 / QPS / 延迟分位)"]
  end

  subgraph Layer3["3. 核心领域业务中枢 (Domain Core Services)"]
    direction LR
    Biz_Live["全链路运营中枢\n(场次流 / 转化漏斗 / 主播效能)"]
    Biz_Supply["履约与防超卖中枢\n(渠道独占配额 / 原子锁库 / 复式记账)"]
    Biz_AI["受控 AI 决策引擎\n(意图识别 / 证据链溯源 / 事实核验)"]
  end

  subgraph Layer4["4. 异步计算与任务调度 (Worker & Async Processing)"]
    direction LR
    W_Master["分布式主备 Leader 选举\n(单 Master 活跃 / 故障平滑转移)"]
    W_Pipe["七段流式清洗管道\n(暂存 / 哨兵排重 / 质量门禁隔离)"]
    W_Cron["核心指标预聚合与巡检\n(分钟级增量出数 / 合规自动巡检)"]
  end

  subgraph Layer5["5. 全渠道生态适配矩阵 (Omnichannel Adapters)"]
    direction LR
    PF_Douyin["抖音电商\n(抖店 / 千川投产)"]
    PF_Kuaishou["快手电商\n(公私域切片 / 老铁分成)"]
    PF_Wechat["微信视频号\n(私域联动 / 企微协同)"]
    PF_Taobao["淘宝 / 天猫\n(万相台 / 满减退款穿透)"]
    PF_Xhs["小红书\n(种草转化 / 达人撮合)"]
  end

  subgraph Layer6["6. 数据底座与物理级安全 (Data & Storage Layer · PostgreSQL 14+)"]
    direction LR
    DB_Agg["多维核心汇总层 (agg_*)\n(报表毫秒级响应 / 消灭大表全扫)"]
    DB_Facts["核心业务事实库\n(订单流 / 库存流水 / 规则知识库)"]
    DB_RLS["PostgreSQL RLS 物理级行安全\n(防越权旁路 / 租户数据硬隔离)"]
  end

  Layer1 ==>|HTTPS / WSS| Layer2
  Layer2 ==> Layer3
  Layer3 ==> Layer6
  Layer3 -.->|异步任务派发| Layer4
  Layer4 ==>|增量物化预聚| Layer6
  Layer3 <==> Layer5
```

---

## 🔑 体验账号清单 (初始密码统一为: `Admin@123456`)

系统数据库预置了覆盖多维度业务视角与 RLS 租户隔离的标准体验账号：

| 身份角色代码 | 身份名称 | 登录用户名 | 初始密码 | 推荐体验场景 |
| :--- | :--- | :--- | :--- | :--- |
| **`super_admin`** | **👑 超级管理员** | `admin` | `Admin@123456` | 平台底层运维、系统任务队列、Prometheus、数据字典与租户管理 |
| **`admin`** | **🏢 机构负责人** | `manager_liu` | `Admin@123456` | 全盘经营大盘、跨平台统筹、经营方案立项审批、业务线授权 |
| **`ops_director`**| **📊 运营总监** | `director_zhang` | `Admin@123456` | 全渠道 8合1 看板穿透、大促 5 层试算、SLA 履约风控与排品排班审核 |
| **`operator`** | **🚀 核心运营 (操盘手)** | `operator_wang` | `Admin@123456` | 场次调度、货盘排品、投流监控、运营复盘与 Net-ROI 评估 |
| **`ad_buyer`** | **📈 专业投手** | `buyer_sun` | `Admin@123456` | 广告投流消耗对账、关键词卡位、ROI 分析（成本台账严格脱敏） |
| **`finance`** | **💰 财务主管** | `finance_chen` | `Admin@123456` | 复式记账总账流水、凭证链核销、全口径真实成本核算与试算平衡 |
| **`hrbp`** | **👥 人才经营 HRBP** | `hr_li` | `Admin@123456` | 主播梯队画像、4合1 排班调度中心、考勤统计与绩效提成 |
| **`brand_viewer`**| **🏷️ 签约品牌代表** | `gap_viewer` | `Admin@123456` | 签约品牌独立受限门户 (`/brand-portal`)，底层 PostgreSQL RLS 物理级隔离 |

---

## 🚀 极速部署指南 (Quick Start)

### 方式一：Docker Compose 一键启动（推荐）

确保本地已安装 [Docker](https://www.docker.com/) 与 Docker Compose：

```bash
# 1. 克隆代码仓库
git clone https://github.com/BlazarLIU/leyova.git
cd leyova

# 2. 一键启动容器集群（自动初始化 PostgreSQL 实例并完成 Schema 重放与种子数据）
docker compose up -d

# 3. 访问系统
# 前端 Web 控制台:    http://localhost:5513
# 后端 Fastify API 服务: http://localhost:8788
# Prometheus 指标端点:  http://localhost:8788/metrics
```

---

### 方式二：本地开发部署

#### 1. 前置依赖
- **Node.js**：≥ 22.0.0
- **pnpm**：≥ 9.0.0 (`npm i -g pnpm`)
- **PostgreSQL**：≥ 14.0（本地安装或 Docker 启动均可）

#### 2. 安装 Monorepo 依赖
```bash
pnpm install
```

#### 3. 环境变量配置
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```
根据实际环境核对 `apps/api/.env` 中的数据库连接串 `DATABASE_URL`（例如：`postgresql://leyova:password@127.0.0.1:5432/leyova`）。

#### 4. 数据库初始化与增量迁移
```bash
pnpm db:migrate
```
该命令会自动按序扫描并执行 `database/migrations/` 下所有迁移脚本（已收录 100~165），自动装配权限策略、汇总表结构与初始种子。

#### 5. 编译、测试与本地双进程启动
```bash
# 编译全工作区代码
pnpm build

# 运行自动化测试全套件 (API 160项全绿 / Web 19项全绿)
pnpm test

# 启动本地开发服务 (支持前端 Vite 与后端 Fastify 热重载)
pnpm dev
```

---

### 方式三：生产环境日常巡检与自动化运维指令

系统内置了工业级的日常巡检、压测与闭环冒烟指令：

```bash
# 1. 执行全域架构综合健康探针 (秒级检查 DB / 迁移 / 汇总层 / Worker / API / Web / Prometheus)
pnpm ops:probe

# 2. 运行端到端 8 阶段业务闭环自动化冒烟套件 (<5s 全自动化穿透)
pnpm ops:smoke

# 3. 运行汇总层性能压测与 API 基准测试 (<5ms 响应验证)
pnpm ops:bench

# 4. 执行 CI 架构守卫检查 (0 RLS 越权、0 裸算 GMV、290 前端调用 100% 匹配)
pnpm check:guardrails
```

---

## 📂 项目工程目录规范

```text
leyova/
├── .github/                  # GitHub Actions CI/CD 流水线配置
├── apps/
│   ├── api/                  # Fastify 5 + TypeScript 高性能后端
│   │   ├── src/
│   │   │   ├── ai/           # 6 核心契约受控 AI、倒排实体识别与 Ragas Critic 核验器
│   │   │   ├── cron/         # 定时聚合、分区自动预建与异常巡检
│   │   │   ├── lib/          # PostgreSQL RLS 上下文、Casbin 元组守卫与 Prometheus metrics
│   │   │   ├── modules/      # 七段流式清洗管道、UNLOGGED 暂存与 8 条 SQL 质量门禁
│   │   │   ├── routes/       # 407 个标准业务路由模块 (经营、库存、履约、总账、AI、选品等)
│   │   │   ├── services/     # 统一数据接入管道、平台适配器与方案拆解服务
│   │   │   ├── worker.ts     # 独立任务 Worker 守护进程 (Advisory Lock Leader 选举)
│   │   │   ├── app.ts        # Fastify 应用装配工厂 (支持 inject 集成测试)
│   │   │   └── index.ts      # API HTTP 主进程入口
│   │   ├── test/             # 15 个测试套件 (160/160 全绿覆盖)
│   │   └── package.json
│   ├── web/                  # React 19 + Vite 6 + Tailwind CSS 精益前端
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── common/   # DataPage 统一页面组件与 useTable 状态取数原语
│   │   │   │   └── ui/       # 基于 Radix UI + Orbit 设计系统的高内聚组件库
│   │   │   ├── pages/        # 统一 Hub 与收敛业务页面
│   │   │   │   ├── bi/       # UnifiedDashboardHub (8合1 统一分析驾驶舱)
│   │   │   │   ├── ops/      # UnifiedScheduleHub (4合1 排班) / 履约SLA / 库存中心 / 客服
│   │   │   │   ├── shop/     # 抖音 / 快手 / 淘宝 / 天猫 / 视频号 / 小红书专属分析矩阵
│   │   │   │   └── system/   # 任务看板 / 审计日志 / 预警中心 / 账号配置 / 卡片组件
│   │   │   ├── services/     # API 客户端 (自动归一化前缀与携带凭证)
│   │   │   └── data/         # platform-navigation.ts 平台导航配置
│   │   ├── test/             # 2 个测试套件 (19/19 全绿覆盖)
│   │   └── package.json
│   └── mcp-server/           # MCP (Model Context Protocol) 独立工具服务
├── database/                 # 数据库全量资产
│   ├── 01_schema.sql         # 2,100 条 DDL 完整基线结构 (与数据库零漂移)
│   ├── 02_seed.sql           # 初始系统字典
│   ├── 03_demo_data.sql      # 演示数据
│   ├── migrations/           # 100~165 增量迁移 SQL 链 (共 66 个脚本)
│   ├── generate-schema.js    # DDL 逆向生成与漂移校验工具 (--check)
│   └── migrate.js            # 自动化增量版本迁移执行器
├── scripts/                  # 生产运维脚本集群
│   ├── ops-health-probe.mjs  # pnpm ops:probe 全域健康巡检探针
│   ├── e2e-smoke-flow.mjs    # pnpm ops:smoke 8 阶段业务闭环冒烟套件
│   ├── benchmark-aggregations.mjs # pnpm ops:bench 性能压测工具
│   └── check-guardrails.mjs  # pnpm check:guardrails CI 架构守卫门禁
├── ecosystem.config.cjs      # PM2 生产环境三进程托管 (api / web / worker)
├── package.json              # Monorepo 根配置与统一任务管理
└── LICENSE                   # Apache-2.0 开源许可协议
```

---

## 📄 开源许可证 (License)

本项目采用 [Apache-2.0 License](LICENSE) 开源许可协议。商业友好，欢迎 Star、Fork 并提交 Pull Request！
