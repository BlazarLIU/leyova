# 全平台电商升级与 AI 分析助手深度重构 · 实施方案与开发计划 (最终审计修订版)

> **基准代码库**：`/home/leyova`（React 19 + Fastify 5 + PostgreSQL 18，端口 55432，59 张业务表）  
> **重大架构决议**：
> 1. **外部 AI 解耦与纯接口化保留**：
>    - 彻底下线与清理 OpenClaw、DeerFlow、AnythingLLM 运行时与冗余依赖；
>    - **OpenViking 仅作为纯外部 API 客户端接口保留**（`openviking-client.ts`），**绝不将 OpenViking 服务或运行环境打包安装到系统内部**。支持通过环境变量/后台配置外部服务地址，未配置或离线时优雅降级，完全不阻塞 AI 分析助手的主链路。
>    - 企业知识库**不自研底层引擎**，采用成熟开源方案（推荐 **RAGFlow** / **MaxKB**）的标准 REST API 进行松耦合集成。
> 2. **平台启停总控与细粒度二维权限矩阵**：管理员拥有全站 7 大平台（抖音、快手、淘宝、天猫、京东、拼多多、小红书）的**全局启用/禁用总开关**；结合角色与人员，构建 **「平台 × 功能模块」二维权限控制网格**，未授权或未开启的平台在整站彻底隐形。
> 3. **根实体桥接设计**：以 `dim_shop` 为全渠道统一顶层实体，通过 `live_rooms.shop_id` 桥接现有直播体系，老业务表 100% 零破坏兼容。
> 4. **双轨供数与可自定义清洗**：官方 OpenAPI 与手动上传双轨汇入统一事实表，集成可视化管道清洗引擎。

---

## 一、系统现状审计与关键架构解耦 (System Audit & Decoupling)

基于对数据库 59 张表、后端 85+ API 端点、前端 45 个页面的深度代码审计，确立以下重构解耦原则：

```mermaid
graph TD
    subgraph 外部服务松耦合集成 (纯客户端接口，不内嵌服务)
        OC[OpenClaw: 彻底废弃移除] -.->|移除代码与配置| Clean[自研轻量 Agentic 编排器]
        DF[DeerFlow: 彻底废弃移除] -.->|移除网关与 Token| Clean
        AL[AnythingLLM: 废弃移除] -.->|替换为| OpenKB[外部开源企业知识库 RAGFlow/MaxKB (REST API)]
        OV[外部 OpenViking 实例] ===>|纯 HTTP 客户端接口 (未部署时优雅跳过)| Clean
    end

    subgraph 实体桥接模型
        P[dim_platform 平台字典] --> S[dim_shop 跨渠道统一店铺/主体]
        S -->|1:N 桥接现有直播体系| LR[live_rooms 现有直播间]
        S -->|1:N 货架直接挂载| FT[fact_trade_daily 交易事实]
        S -->|1:N 统一商品体系| DI[products / dim_item 商品]
        LR --> LS[live_sessions 现有直播场次保持不变]
    end

    subgraph 二维权限中枢
        Admin[系统最高管理员] -->|全局启停开关| PlatformConfig[system_platform_configs]
        PlatformConfig --> Matrix[二维权限矩阵: 平台范围 x 功能模块]
        Matrix --> UserA[拼多多运营: 仅拼多多货架]
        Matrix --> UserB[抖音主播: 仅抖音直播间]
        Matrix --> UserC[全渠道总监: 全部已开启平台]
    end
```

---

## 二、平台启停与二维权限控制矩阵 (Platform Governance & RBAC Matrix)

### 2.1 管理员全局平台总控开关
在系统配置中心新增「平台与渠道管理」，管理员可对 6 大生态 7 个平台进行启停控制：
- 抖音 (`douyin`)、快手 (`kuaishou`)、淘宝 (`taobao`)、天猫 (`tmall`)、京东 (`jd`)、拼多多 (`pdd`)、小红书 (`xiaohongshu`)。
- **全局阻断机制**：
  - 若管理员关闭了“拼多多”，则全站导航栏、数据大盘选择器、AI 问答指标范围、数据上传模板选择器中，拼多多相关内容**全链路隐藏**。
  - 后端中间件校验：请求带未开启的 `platform_code` 时，直接返回 `403 Platform Disabled`。

### 2.2 人员与角色细粒度二维权限矩阵 (`Role/User × Platform × Module`)
在原有 `system_modules` / `role_modules` 基础上，升级为二维权限模型：

```sql
-- 1. 系统平台全局配置表（最高管理员维护）
CREATE TABLE public.system_platform_configs (
    platform_code varchar(32) PRIMARY KEY,
    platform_name varchar(50) NOT NULL,
    category varchar(20) NOT NULL, -- 'live' | 'shelf' | 'content'
    is_enabled boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    api_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. 角色-平台授权表
CREATE TABLE public.role_platform_permissions (
    id serial PRIMARY KEY,
    role_id integer NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    allowed_modules text[] DEFAULT '{}'::text[], -- 允许访问该平台的哪些模块代码，为空表示全部
    created_at timestamptz DEFAULT now(),
    UNIQUE(role_id, platform_code)
);

-- 3. 用户特化平台授权表（针对特定员工加减权限）
CREATE TABLE public.user_platform_permissions (
    id serial PRIMARY KEY,
    user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code) ON DELETE CASCADE,
    shop_scope bigint[] DEFAULT '{}'::bigint[], -- 限定特定店铺 ID 列表，空表示该平台全部店铺
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, platform_code)
);
```

#### 前端与后端权限裁决逻辑
1. **有效平台交集计算**：
   $$\text{UserAccessiblePlatforms} = \text{SystemEnabledPlatforms} \cap \text{RolePlatforms} \cap \text{UserPlatforms}$$
2. **菜单动态裁决**：
   - `navigation.ts` 改造为纯动态计算函数：过滤掉不在用户 `UserAccessiblePlatforms` 范围内的平台专属板块；
   - 顶部选择器 `PlatformShopSelector` 仅展示当前用户有权且系统已开启的平台与店铺。

---

## 三、外部 AI 瘦身与开源企业知识库集成

### 3.1 外部 AI 架构精简与纯客户端接口设计
- **彻底下线 OpenClaw**：原网关中用于调用 OpenClaw 的转发代码、配置同步路由全部剥离，避免外部未受控的 Agent 产生不可预知的 SQL 与循环调用。
- **彻底下线 DeerFlow**：废弃 DeerFlow 内部 Token 与网关兜底，AI 助手全部走自研受控编排。
- **OpenViking 仅保留外部纯客户端接口 (External Plugin Interface Only)**：
  - **明确不安装**：系统本身**不部署、不打包、不依赖**本地 OpenViking 进程或运行时；
  - **仅保留客户端代码**：保留 `apps/api/src/lib/openviking-client.ts` 作为轻量 HTTP 适配器；
  - **按需接入与优雅降级**：通过环境变量 `OPENVIKING_API_BASE` 与 `OPENVIKING_API_KEY` 配置外部已部署的实例地址；若未配置或服务不可达，系统自动静默跳过长效记忆检索，直接依赖当前对话上下文，**核心问数与分析功能 100% 正常运行**。

### 3.2 企业知识库开源替代方案：集成 RAGFlow / MaxKB
**原则：不从零自建文档解析、切片与检索管道，直接通过 REST API 接入业界最顶级的开源企业级 RAG 引擎。**

#### 选型评估推荐：
1. **首选方案：RAGFlow (开源深度文档解析与混合检索系统)**
   - **优势**：具备业界最强的深度文档解析引擎（DeepDoc），对电商领域的复杂财务报表 Excel、多栏大促 PDF、表格和图表识别精度极高；原生支持密集与稀疏混合检索；提供开箱即用的标准 REST API。
2. **备选方案：MaxKB / FastGPT**
   - **优势**：极简部署、API 规范极度清晰，开箱支持按知识库 ID、分权限调用问答与上下文检索。

#### 集成对接设计 (`apps/api/src/lib/kb-client.ts`)
```typescript
export interface KnowledgeBaseClient {
  /** 检索与当前业务问题相关的知识切片（包含平台运营规则、爆款卖点、大促复盘经验） */
  searchContext(query: string, options: {
    datasetIds: string[]
    topK?: number
    similarityThreshold?: number
  }): Promise<KnowledgeChunk[]>
  
  /** 将 AI 复盘报告或战报一键推送到企业知识库沉淀 */
  uploadDocument(collection: string, doc: {
    title: string
    content: string
    metadata: Record<string, any>
  }): Promise<{ docId: string }>
}
```
- **业务打通**：AI 分析助手的原子工具 `search_knowledge` 直接代理调用该开源知识库 API；
- **免维护底座**：知识库的向量计算、文件上传解析全部由独立的开源知识库容器负责，主数据库无需承载沉重的文档解析与非结构化重载。

---

## 四、双轨数据接入与自定义数据清洗引擎

### 4.1 7 大平台官方 OpenAPI 连接器规范
系统在 `apps/api/src/platform/adapters/` 目录下预留各平台标准适配器：
1. `douyin.ts`（抖店 OpenAPI / 千川投放 API）
2. `kuaishou.ts`（快手小店 OpenAPI / 磁力金牛 API）
3. `taobao.ts`（阿里开放平台 TOP API / 万相台直通车）
4. `tmall.ts`（天猫品牌店铺专用扩展，复用淘系底层）
5. `jd.ts`（京东 JOS 开放平台 / POP+自营采销 API）
6. `pdd.ts`（拼多多开放平台 POP API / 多多搜索推广）
7. `xiaohongshu.ts`（小红书方舟开放平台 / 蒲公英合作数据 API）

每个适配器实现统一接口 `PlatformAdapter`：
- `exchangeToken` / `refreshToken`：统一 OAuth 凭证换取与刷新。
- `fetchTradeData` / `fetchTrafficData` / `fetchAdData`：拉取对应标准事实模型。
- `syncWatermark`：增量同步游标控制，防止重复拉取。

### 4.2 手动上传自定义数据清洗引擎 (Pipeline Rule Engine)
针对未开通 API 权限的店铺，通过手动上传提供 100% 功能体验。

#### 7 大类清洗规则元语：
1. **结构映射**：`rename_column`、`drop_column`、`split_column`、`merge_columns`
2. **类型解析**：`cast_currency`（清除货币符号/千分位）、`cast_percent`（百分比浮点转换）、`cast_duration`（中文时长转换为秒/分）、`cast_datetime`
3. **空值与默认值**：`fill_null`、`drop_if_null`、`default_value`
4. **去重与合并**：`dedup_by_keys`（多列联合去重，保留最新/数值大）
5. **异常截断**：`range_clip`（数值越界截断）、`outlier_iqr`（箱线图异常值探测）
6. **枚举归一与正则**：`map_value`（如“天猫旗舰店”→`tmall`）、`replace_regex`
7. **业务逻辑校验**：`assert_expr`（如 `gmv >= refund_amount`，异常行自动标记）

#### 前端交互向导 (`DataUploadPage.tsx`)：
1. 上传文件（CSV / XLSX）
2. 识别/选择所属平台与店铺
3. 字段智能映射（系统推荐 + 用户微调）
4. 清洗模式选择（可复用预设模板，或可视化增删清洗规则）
5. **预演 Diff 对照**：查看清洗前后数据样本对照、异常丢弃行清单与统计
6. 确认入库并保存自定义清洗模式为模板

---

## 五、AI 分析助手深度重构 (指标语义层 + 四阶受控编排)

重塑 AI 助手为专业的 Agentic BI 经营分析师：

```
┌──────────────────────────────────────────────────────────────┐
│ 用户前端: ChatPage 3.0 工作台 (三栏布局: 会话/分析流/行动面板)  │
├──────────────────────────────────────────────────────────────┤
│ 会话与上下文层: 短期上下文 + 外部 OpenViking 记忆插件 (纯接口) │
├──────────────────────────────────────────────────────────────┤
│ 受控编排器: Planner DAG → Executor → Critic → Reporter      │
├──────────────────────────────────────────────────────────────┤
│ 8 个受控分析工具:                                            │
│ list_metrics / list_dimensions / query_metric /              │
│ compare_periods / drill_down / detect_anomalies /            │
│ forecast_trend / search_knowledge (调用外部开源知识库 API)   │
├──────────────────────────────────────────────────────────────┤
│ 指标语义层: metric_definition + 参数化 SQL 编译器 + 权限硬注入 │
├──────────────────────────────────────────────────────────────┤
│ 底层数据: PostgreSQL 18 分区事实表 + 预聚合表                │
└──────────────────────────────────────────────────────────────┘
```

### 5.1 六大深度分析剧本 (Playbooks)
1. **S1 经营智能问数**：解析指标/维度/时段 → 语义层取数 → 平台对比 → 结构化卡片与趋势图。
2. **S2 波动与同环比归因**：计算波动差额 → 平台贡献度拆解 → 渠道/商品下钻 → 瀑布图与 TOP3 异动因子。
3. **S3 跨平台全渠道对标**：多平台口径对齐（GMV、毛利率、退款率、ROI） → 对比雷达图与渠道资源建议。
4. **S4 异动与故障定位**：定位异动时段 → 排查广告/商品状态 → 检索开源知识库近期大促与违规事件 → 综合归因。
5. **S5 业绩预测与情景推演**：历史趋势时间序列预测 → 目标缺口分析 → 输出保守/中性/冲刺三套资源配置建议。
6. **S6 全渠道复盘战报自动生成**：全周期指标汇总 → 亮点与短板提炼 → 自动生成 Markdown 报告 → **一键创建改进任务**并沉淀至知识库。

### 5.2 数字 100% 溯源质检 (Critic Verification)
Reporter 产出的所有分析结论必须带有数据来源引用标 `[e1]`、`[e2]`，Critic 模块在交付前端前比对原始工具取数快照：
- 若数字偏差超过 0.1%，自动阻断重写；
- 前端点击任意数字直接呼出「数据凭证面板」，展示统计口径、计算公式与底层快照。

---

## 六、数据库高性能调优与分区实施方案 (一步到位)

### 6.1 核心事实表声明式按月分区 (Range Partitioning)
针对 `fact_trade_daily`、`fact_traffic_daily`、`fact_product_daily`，按 `biz_date` 进行原生月度分区：
```sql
CREATE TABLE public.fact_trade_daily (
    id bigserial,
    biz_date date NOT NULL,
    platform_code varchar(32) NOT NULL REFERENCES public.system_platform_configs(platform_code),
    shop_id bigint NOT NULL REFERENCES public.dim_shop(id),
    channel_name varchar(100),
    gmv numeric(14,2) DEFAULT 0,
    paid_order_count integer DEFAULT 0,
    refund_amount numeric(14,2) DEFAULT 0,
    source varchar(20) DEFAULT 'api' NOT NULL, -- 'api' | 'manual'
    extra jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (biz_date, id)
) PARTITION BY RANGE (biz_date);
```
- 分区局部索引：`CREATE INDEX idx_trade_daily_ps ON fact_trade_daily (biz_date, platform_code, shop_id);`
- 自动分区管理：定时任务提前创建未来 3 个月的新分区，过往冷数据直接 Detach 归档。

### 6.2 预聚合层 (Rollup)
建立 `agg_shop_daily`（按店铺+日聚合）与 `agg_platform_monthly`（按平台+月聚合），AI 与 BI 默认直接查预聚合层，千万级数据查询耗时稳定在 20ms 以内。

---

## 七、分阶段落地里程碑与交付计划

| 阶段 | 交付主题 | 核心交付物 | 关键依赖与边界 |
| :--- | :--- | :--- | :--- |
| **P0 地基与权限矩阵** | 平台底座与实体桥接 | 1. 迁移链建立与 `dim_shop` / `system_platform_configs` / `role_platform_permissions`<br>2. `live_rooms` 增加 `shop_id` 桥接现有 59 表<br>3. 平台管理员总控开关与二维权限中间件<br>4. 冻结 `03_patches.sql` | 现有 45 个页面与全部老功能 100% 正常运行，老表建立只读兼容视图 |
| **P1 双轨接入与清洗** | 官方接口与自定义清洗 | 1. 7 大平台官方 API 接口定义与同步任务脚手架<br>2. 管道式数据清洗引擎（7 类规则 + 预演 Diff 对照）<br>3. 数据上传四步向导改造 | 无 API 授权时以手动上传为兜底，支持自定义模式保存复用 |
| **P2 多平台业务板块** | 货架电商与全渠道大盘 | 1. 淘天、拼多多、京东适配器与数据映射<br>2. 全渠道经营大盘 (`OmniDashboardPage`)<br>3. 货架店铺经营看板 (`ShopOverviewPage`)<br>4. 前端动态能力导航 | 未开启平台全局隐藏，用户只能看到被授权平台的数据 |
| **P3 内容中心与开源知识库** | ComfyUI 与知识库集成 | 1. ComfyUI REST/WebSocket 客户端与模板预设<br>2. 视频创作工作台与视频数据接口<br>3. 开源知识库 (RAGFlow/MaxKB) API 客户端对接 | 本地无 ComfyUI 时 Mock 优雅降级；知识库不自研底层 |
| **P4 AI 分析助手重构 (核心)** | 语义层 + 四阶 Agent | 1. 指标语义层 (`metric_definition` + 参数化 DSL)<br>2. Planner → Executor → Critic → Reporter 自研编排器<br>3. OpenViking 记忆插件（纯客户端 API 接口调用，不内嵌服务），下线 OpenClaw/DeerFlow/AnythingLLM<br>4. ChatPage 3.0 三栏工作台 (SSE 流式 + 图表卡片 + 证据溯源) | 严禁大模型自行算数；结论数字 100% 溯源通过 |
| **P5 深度决策与闭环** | 预测/复盘与全站联动 | 1. S5 目标预测与 S6 复盘战报自动生成<br>2. 一键转改进任务与一键沉淀经验至开源知识库<br>3. BI/复盘页面右上角“AI 分析此屏”全局联动 | 形成“分析 → 归因 → 决策 → 任务 → 知识沉淀”完整闭环 |

---

## 八、待拍板确认项 (Action Items)

1. **开源企业知识库选型**：首选推荐 **RAGFlow**（文档与电商复杂财务表格、PDF 解析能力极强，支持 Docker 一键部署），备选 **MaxKB**（UI 轻巧、API 极简）。你倾向于哪一个作为系统集成的开源知识库底座？
2. **P0 启动授权**：若以上架构决议全部确认无误，请指示批准，我们将立即进入 **P0 阶段的数据库迁移与实体桥接代码实现**！
