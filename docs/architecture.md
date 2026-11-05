# leyova 系统架构详细文档

> 更新日期: 2026-08-11

---

## 一、项目概览

**leyova** 是一个抖音直播电商数据管理系统，采用 **React 19 + Fastify + PostgreSQL** 技术栈，正在从旧版 PHP 系统向现代化架构迁移。

| 项目 | 说明 |
|------|------|
| 项目名称 | leyova (Orbit Dashboard) |
| 业务领域 | 抖音直播电商运营数据分析 |
| 旧版技术栈 | PHP + MySQL (MariaDB) |
| 新版技术栈 | React 19 + Fastify + PostgreSQL |
| 部署方式 | PM2 进程管理 |
| 开发状态 | 新旧系统并行运行中 |

---

## 二、技术栈全景

### 2.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5.6+ | 类型安全 |
| Vite | 6 | 构建工具与开发服务器 |
| Tailwind CSS | 4 | 样式框架 |
| React Router | 7 | 客户端路由 |
| TanStack Query | 5 | 服务端数据请求与缓存 (声明但未实际使用) |
| React Hook Form | 7 | 表单管理 |
| Zod | 3 | 数据校验 |
| Recharts | 2 | 图表渲染 |
| Framer Motion | 11 | 动画与过渡 |
| Lucide React | 0.400 | 图标组件库 |
| CVA | 0.7 | UI 组件变体管理 |
| clsx + tailwind-merge | - | 条件类名合并 |

### 2.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 24 | 运行时 |
| TypeScript | 5.6 | 类型安全 |
| Fastify | 5 | HTTP 服务框架 |
| Prisma | 7 | ORM / 模型定义 |
| PostgreSQL | 18 | 主数据库 |
| pg (node-postgres) | 8 | 底层数据库驱动 |
| bcryptjs | 3 | 密码哈希 |
| Zod | 3 | 数据校验 |
| ioredis | 6 | Redis 客户端 (备用缓存) |
| node-cron | 4 | 定时任务调度 |
| Pino | (Fastify 内置) | 结构化日志 |
| tsx | 4 | TypeScript 执行引擎 |

### 2.3 旧版技术栈 (待下线)

| 技术 | 版本 | 用途 |
|------|------|------|
| PHP | - | 旧版后端语言 |
| MySQL (MariaDB) | - | 旧版数据库 |
| PhpSpreadsheet | 3.1 | Excel 处理 |
| phpMyAdmin | - | 数据库管理工具 |

---

## 三、前端模块与页面

### 3.1 路由结构总览

整个应用包含 **40+ 功能页面**，分为 **11 个功能模块**，使用 `react-router-dom v7` 嵌套路由模式。

### 3.2 总览模块 (Overview)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/overview/home` | HomePage | 首页 KPI 仪表盘，核心统计数据展示 |
| `/overview/cockpit` | CockpitPage | 经营驾驶舱，GMV趋势/流量来源/退款率/ROI |
| `/overview/live-monitor` | LiveMonitorPage | 实时监控，直播实时数据 |
| `/overview/analytics` | AnalyticsPage | 数据分析，多维度数据探索 |

### 3.3 直播管理模块 (Live)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/live/attendance` | AttendancePage | 个人达成/考勤 (月历视图) |
| `/live/registration` | LiveRegistrationPage | 直播登记 (表单提交) |
| `/live/data` | DataLivePage | 登记数据管理 |

### 3.4 AI 分析助手

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/ai/chat` | ChatPage | AI 对话 (主播排行/渠道分析/GMV查询/异常预警等) |

### 3.5 数据管理模块 (Data)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/data/management` | DataManagementPage | 数据表管理 (pg_catalog 表清单) |
| `/data/upload` | DataUploadPage | CSⅤ/XLSX 数据上传与导入 |
| `/data/uploaded-data` | UploadedDataPage | 已上传数据管理 (主播/渠道数据) |
| `/data/quality` | DataQualityPage | 数据质量检查 (空值率/缺失检测) |

### 3.6 内容中心模块 (Content)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/content/video-create` | VideoCreatePage | 视频创作 |
| `/content/video-data` | VideoDataPage | 视频数据 |
| `/content/config` | ContentConfigPage | 中心配置 |

### 3.7 商业智能模块 (BI)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/bi/dashboard` | BiDashboardPage | BI 仪表盘 (GMV/订单/退款/平台拆分/日趋势) |
| `/bi/roi` | RoiDashboardPage | ROI 看板 (渠道ROI/每日趋势) |
| `/bi/anomaly-detection` | AnomalyDetectionPage | 异常检测 (GMV/观看人数异常) |

### 3.8 主播赋能模块 (Anchors)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/anchors/list` | AnchorListPage | 主播列表 (含能力评分/自动短板识别) |
| `/anchors/profile` | AnchorProfilePage | 主播档案 (详细信息/绩效) |
| `/anchors/training` | TrainingPage | 训练管理 (计划/记录) |
| `/anchors/scripts` | ScriptTemplatesPage | 话术模板 |

### 3.9 运营提效模块 (Ops)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/ops/capabilities` | CapabilitiesPage | 能力看板 (主播能力评分+排名) |
| `/ops/script-library` | ScriptLibraryPage | 话术库 |
| `/ops/issue-library` | IssueLibraryPage | 问题库 (含自动标签生成) |
| `/ops/goal-tracking` | GoalTrackingPage | 目标达成 (经营目标追踪) |
| `/ops/room-health` | RoomHealthPage | 直播间健康度 |
| `/ops/session-products` | SessionProductsPage | 场次排品 |

### 3.10 直播复盘模块 (Review)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/review/overview` | ReviewOverviewPage | 复盘总览 (KPI/环比/TOP渠道/TOP异常) |
| `/review/products` | ProductAnalysisPage | 商品分析 (含 SKU 嵌套) |
| `/review/short-videos` | ShortVideoTrafficPage | 短视频引流分析 |
| `/review/channels` | ChannelAnalysisPage | 渠道流量分析 (可排序/筛选) |
| `/review/anchors` | AnchorPerformancePage | 主播效能分析 |
| `/review/funnel` | FunnelAnalysisPage | 转化漏斗分析 (曝光→观看→商品曝光→商品点击→成交) |
| `/review/closed-loop` | ClosedLoopPage | 改进闭环 |

### 3.11 系统管理模块 (System)

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/system/config` | SystemConfigPage | 系统配置 (阈值/目标/字典/AI/账号/人员/直播间) |
| `/system/alerts` | AlertCenterPage | 异常中心 (告警事件+自动检测) |
| `/system/tasks` | ImprovementTasksPage | 改进任务 (从告警自动生成) |
| `/system/promotions` | PromotionCampaignsPage | 活动管理 |
| `/system/competitors` | CompetitorWatchPage | 竞品观察 (含价格数据) |
| `/system/multi-room` | MultiRoomOverviewPage | 多直播间总览 |

### 3.12 认证模块

| 路由 | 页面组件 | 说明 |
|------|---------|------|
| `/sign-in` | SignInPage | 登录页 |

---

## 四、后端 API 模块

### 4.1 路由模块总览 (13 个模块, 70+ API 端点)

所有 API 前缀为 `/api/v1/`，基于 Fastify 构建。

### 4.2 健康检查模块 (health.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 服务健康检查 (含 DB 连接状态) |
| GET | `/api/v1/ready` | 就绪检查 (DB 不可用返回 503) |

### 4.3 认证模块 (auth.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/auth/login` | 用户登录 (username + password → cookie session) |
| POST | `/api/v1/auth/logout` | 退出登录 |
| GET | `/api/v1/auth/me` | 获取当前用户信息 |
| POST | `/api/v1/auth/change-password` | 修改密码 |

### 4.4 概览模块 (overview.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/overview/stats` | 核心统计数据 (GMV/订单/在线/增长率) |
| GET | `/api/v1/overview/activities` | 最近活动列表 |
| GET | `/api/v1/overview/live-monitor` | 直播实时监控数据 |
| GET | `/api/v1/overview/cockpit` | 驾驶舱数据 (总GMV/GMV趋势/流量来源) |

### 4.5 主播管理模块 (anchors.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/anchors` 或 `/api/v1/anchors/list` | 主播列表 (含能力评分) |
| GET | `/api/v1/anchors/:id` 或 `/api/v1/anchors/profile/:id` | 主播详情 |
| GET | `/api/v1/anchors/:id/performance` | 主播绩效 (场均指标/月度趋势/对比) |
| GET | `/api/v1/anchors/training` 或 `/api/v1/training/plans` | 培训计划列表 |
| GET | `/api/v1/anchors/training/records` | 培训记录列表 |
| GET | `/api/v1/anchors/scripts` 或 `/api/v1/scripts/templates` | 话术模板列表 |

### 4.6 BI 分析模块 (bi.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/bi/dashboard` | BI 仪表盘 (GMV/订单/退款/平台拆分/日趋势) |
| GET | `/api/v1/bi/roi` | ROI 分析 (渠道ROI/每日趋势) |
| GET | `/api/v1/bi/refund` | 退款分析 (退款率/原因分布/记录列表) |
| GET | `/api/v1/bi/anomalies` | 异常检测 (GMV/观看人数异常) |

### 4.7 运营管理模块 (ops.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/ops/capabilities` | 主播能力评分 + 排名 |
| GET | `/api/v1/ops/goal-tracking` 或 `/api/v1/ops/goals` | 目标跟踪列表 |
| GET | `/api/v1/ops/script-library` 或 `/api/v1/ops/scripts` | 话术库列表 |
| GET | `/api/v1/ops/issue-library` 或 `/api/v1/ops/issues` | 问题库 + 自动标签 |
| GET | `/api/v1/ops/room-health` | 房间健康度列表 |
| GET | `/api/v1/ops/session-products` | 场次商品列表 |

### 4.8 系统管理模块 (system.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/system/roles` | 角色列表 |
| GET | `/api/v1/system/modules` | 系统模块列表 |
| PUT | `/api/v1/system/roles/modules` | 更新角色模块权限 |
| GET/POST/PUT/DELETE | `/api/v1/system/users` 及 `/:id` | 系统用户 CRUD |
| GET/POST/PUT/DELETE | `/api/v1/system/rooms` 及 `/:id` | 直播间 CRUD |
| GET/PUT | `/api/v1/system/config` | 系统配置 (key-value) |
| GET | `/api/v1/system/alerts` | 告警中心 |
| GET | `/api/v1/system/competitors` | 竞品监控 |
| GET | `/api/v1/system/multi-room` | 多房间概览 |
| GET | `/api/v1/system/inventory` | 库存风控 |
| GET | `/api/v1/system/tasks` | 改进任务列表 |
| PUT | `/api/v1/system/tasks/:id/status` | 更新任务状态 |
| GET/POST | `/api/v1/system/promotions` | 活动管理 |

### 4.9 人员管理模块 (personnel.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET/POST/DELETE/PUT | `/api/v1/personnel/anchors` 及 `/:id` | 主播人员管理 (软删除) |
| GET/POST/DELETE/PUT | `/api/v1/personnel/operators` 及 `/:id` | 运营人员管理 (软删除) |
| GET/POST/DELETE | `/api/v1/personnel/managers` 及 `/:id` | 经理/管理员管理 |
| GET | `/api/v1/attendance` | 考勤数据 (月历视图) |

### 4.10 数据管理模块 (data.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/data/tables` | 数据表清单 (pg_catalog) |
| POST | `/api/v1/data/tables/:id/refresh` | 刷新表统计 (ANALYZE) |
| GET | `/api/v1/data/uploads` | 上传记录列表 |
| GET | `/api/v1/data/uploads/:id/download` | 下载上传文件 |
| DELETE | `/api/v1/data/uploads/:id` | 删除上传记录和文件 |
| POST | `/api/v1/data/upload-preview` | 文件预览 (CSV/XLSX 解析+校验) |
| POST | `/api/v1/data/uploads` | 文件上传导入 (支持4种模板) |
| GET | `/api/v1/data/exports` | 导出记录列表 |
| POST | `/api/v1/data/exports` | 创建导出任务 |
| GET/PUT/DELETE | `/api/v1/data/live` 及 `/:id` | 直播数据 CRUD |
| GET | `/api/v1/data/quality` | 数据质量概览 |
| GET/DELETE | `/api/v1/data/uploaded-data/anchor` 及 `/:id` | 已导入主播分析数据管理 |
| GET/DELETE | `/api/v1/data/uploaded-data/channel` 及 `/:id` | 已导入渠道分析数据管理 |

### 4.11 复盘分析模块 (review.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/review/sessions` | 场次列表 |
| GET | `/api/v1/review/overview` | 复盘总览 (KPI/环比) |
| GET | `/api/v1/review/channels` | 渠道分析 |
| GET | `/api/v1/review/channels/:channel` | 单个渠道详情 |
| GET | `/api/v1/review/anchors` | 主播分析 (聚合指标) |
| GET | `/api/v1/review/funnel` | 转化漏斗 |
| GET | `/api/v1/review/compare` | 对比分析 (场次/时间段) |
| GET | `/api/v1/review/live-rooms` | 直播间列表 |
| GET | `/api/v1/review/session-info` | 场次信息 |
| GET | `/api/v1/review/products` | 商品详情 (含 SKU) |
| GET | `/api/v1/review/short-videos` | 短视频引流数据 |
| GET | `/api/v1/review/funnel-data` | 漏斗明细数据 |

### 4.12 场次管理模块 (sessions.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/sessions/:id` | 场次详情 |
| POST | `/api/v1/sessions` | 创建场次 |
| PATCH | `/api/v1/sessions/:id` | 更新场次 |
| POST | `/api/v1/sessions/:id/finalize` | 完结场次 |
| GET | `/api/v1/sessions/:id/metrics` | 场次指标 |

### 4.13 AI 助手模块 (ai.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/ai/daily-report` | 数据日报简报 |
| GET | `/api/v1/ai/sessions` | AI 对话列表 |
| POST | `/api/v1/ai/chat` | AI 对话 (数据驱动回复) |
| GET | `/api/v1/ai/messages/:conversationId` | 对话消息历史 |

### 4.14 直播登记模块 (livereg.ts)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/livereg/form-data` | 直播登记表单数据 (主播/房间/运营下拉) |
| POST | `/api/v1/livereg/submit` | 提交直播登记 |

---

## 五、数据库架构

### 5.1 PostgreSQL 数据库 (leyova) — 新系统主库

#### 5.1.1 核心系统表

| 表名 | 说明 | 核心字段 |
|------|------|---------|
| `users` | 系统用户 | id, username (unique), password_hash, real_name, role, status, last_login_at |
| `roles` | 角色定义 | id, code (unique), name, description |
| `permissions` | 权限定义 | id, code (unique), name, module |
| `role_permissions` | 角色-权限关联 | role_id, permission_id (联合主键) |
| `system_modules` | 系统模块 | id, code, name, icon, visible |
| `role_modules` | 角色-模块权限 | role_id, module_id |
| `user_sessions` | 用户会话 | id (UUID), user_id, expires_at |
| `audit_logs` | 审计日志 | id (BigInt), actor_user_id, action, resource_type, before_data (JSONB), after_data (JSONB) |
| `system_jobs` | 系统任务 | id (BigInt), job_type, status, input_payload (JSONB), result_payload (JSONB) |

#### 5.1.2 直播业务表

| 表名 | 说明 | 核心字段 |
|------|------|---------|
| `live_rooms` | 直播间 | id, name, platform, status |
| `anchors` | 主播 | id, name, platform, level, status |
| `operators` | 运营/中控 | id, name, employee_id, status |
| `live_sessions` | 直播场次 (核心) | id, room_id, anchor_id, title, date, status, gmv, orders, online_peak, duration_min |
| `anchor_profiles` | 主播档案 | id, anchor_id, tags (TEXT[]), 详细信息 |
| `anchor_capabilities` | 能力评分 | id, anchor_id, 各类能力维度评分 |
| `anchor_rankings` | 主播排名 | id, anchor_id, rank, period |
| `anchor_training_plans` | 培训计划 | id, anchor_id, title, status |
| `anchor_training_records` | 培训记录 | id, plan_id, progress, score |
| `anchor_script_templates` | 话术模板 | id, title, content, category |

#### 5.1.3 抖音数据对接表

| 表名 | 说明 |
|------|------|
| `douyin_anchor_daily_metrics` | 主播日粒度经营指标 |
| `douyin_channel_daily_metrics` | 渠道日粒度经营指标 |
| `session_anchor_metrics` | 场次主播分析数据 |
| `session_channel_metrics` | 场次渠道分析数据 |
| `session_live_basic_info` | 场次基本信息 |
| `session_overview_metrics` | 整体看板指标 |
| `session_short_video_traffic` | 短视频引流数据 |
| `session_product_details` | 商品明细 |
| `session_product_skus` | SKU 明细 |
| `data_uploads` | 数据上传记录 |
| `data_exports` | 数据导出记录 |

#### 5.1.4 运营业务表

| 表名 | 说明 |
|------|------|
| `system_config` | 系统配置 (KV) |
| `alert_rules` | 阈值/预警规则 |
| `alert_events` | 告警事件 |
| `goal_tracking` | 经营目标追踪 |
| `script_library` | 话术库 |
| `issue_library` | 问题库 |
| `room_health` | 直播间健康度 |
| `competitor_brands` | 竞品品牌 |
| `competitor_price_data` | 竞品价格数据 |
| `multi_room_status` | 多房间概览 |
| `product_templates` | 商品模板 |
| `product_template_items` | 模板商品明细 |
| `ad_plans` | 投放计划 |
| `ad_channel_metrics` | 投放渠道表现 |
| `promotions` | 活动管理 |
| `ai_conversations` | AI 对话会话 |
| `ai_messages` | AI 消息记录 |
| `ai_config` | AI 配置 |
| `dict_items` | 字典项 |
| `target_templates` | 目标模板 |

### 5.2 MySQL 数据库 (leyova) — 旧系统

#### 5.2.1 基础表 (19 张)

| 表名 | 说明 | 核心字段 |
|------|------|---------|
| `users` | 用户 | id, username, password, real_name, role (super_admin/admin/manager/employee), status |
| `anchors` | 主播 | id, anchor_name, platform, room_id, status |
| `rooms` | 直播间 | id, name, operator_id, status |
| `operators` | 中控/运营 | id, operator_name, employee_id, status |
| `controllers` | 导播设备 | id, controller_name, status |
| `data_groups` | 数据组 | id, group_name, created_by |
| `ad_streams` | 投流数据 | id, group_id, ad_cost, platform, ad_type |
| `livestreams` | 直播数据 (核心) | id, date, anchor_id, room_id, gmv, return_amount, gsv, ad_cost, ad_gsv |
| `login_logs` | 登录日志 | id, user_id, ip, login_time |
| `operation_logs` | 操作日志 | id, user_id, action, target_type, details |
| `sample_inventories` | 样衣库存 | id, item_code, item_name, type, status, quantity |
| `assets` | 资产 | id, asset_name, asset_code, category, value |
| `asset_inventories` | 资产盘点 | id, inventory_name, inventory_date, status |
| `asset_inventory_details` | 盘点详情 | id, inventory_id, asset_id, actual_status |
| `weekly_meetings` | 周会数据 | id, week_date, content |
| `personal_targets` | 个人目标 | id, user_id, target_date, target_gmv |
| `financial_records` | 财务记录 | id, date, description, receipt_amount, payment_amount |
| `user_rooms` | 用户-直播间关联 | id, user_id, room_id |

#### 5.2.2 迁移扩展表 (45+ 张)

**迁移 001 — 直播场次扩展:**
`metric_definitions`, `livestream_sessions`, `livestream_metric_intervals`, `livestream_traffic_sources`

**迁移 002 — 商品管理:**
`products`, `livestream_product_plans`, `livestream_product_metrics`, `livestream_product_segments`

**迁移 003 — 广告投放:**
`ad_accounts`, `ad_campaigns`, `ad_creatives`, `ad_campaign_metric_snapshots`

**迁移 004 — 主播赋能:**
`anchor_profiles`, `anchor_assessments`, `training_courses`, `anchor_training_tasks`, `training_submissions`

**迁移 005 — 运营与合规:**
`operation_actions`, `alert_rules`, `alert_events`, `livestream_review_reports`, `improvement_tasks`, `compliance_rules` (12种类型), `compliance_incidents`, `data_sync_jobs`, `data_upload_batches`, `data_upload_errors`, `script_templates`, `script_versions`, `livestream_media_assets`, `livestream_review_annotations`

**迁移 009 — Phase 4 高级功能:**
`product_profit_details`, `product_profit_summary`, `refund_reasons`, `anchor_schedules`, `anchor_product_matches`, `product_recommendations`, `training_recommendations`, `anomaly_detection_rules`, `anomaly_events`, `trend_predictions`, `competitor_brands`, `competitor_observations`, `promotion_campaigns`, `promotion_schedules`, `promotion_reports`, `room_benchmarks`, `room_comparisons`, `best_practices`, `practice_replications`, `bi_dashboards`, `bi_widgets`, `data_aggregation_snapshots`, `data_export_tasks`

**迁移 011 — P0 核心经营:**
`room_health_records`, `goal_tracking`, `session_product_planning`

**迁移 012 — P1 运营提效:**
`product_templates`, `template_product_relations`, `ad_plans`, `ad_reviews`, `ad_material_performance`, `anchor_skill_scores`, `script_library`, `issue_library`

---

## 六、系统架构目录

```
/path/to/leyova/
│
├── apps/web/                          # React 前端项目
│   ├── index.html                     # HTML 入口 (暗色主题)
│   ├── vite.config.ts                 # Vite 配置 (代理/@别名)
│   ├── package.json                   # 项目名: @leyova/web
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   ├── public/
│   │   ├── orbit-icon.svg             # Favicon
│   │   └── 404.html                   # SPA 路由处理
│   ├── src/
│   │   ├── main.tsx                   # React 入口
│   │   ├── App.tsx                    # 路由配置 (41条路由)
│   │   ├── index.css                  # 全局样式 (Tailwind + 主题变量)
│   │   ├── types/index.ts             # 全局类型定义
│   │   ├── services/api.ts            # API 请求封装 (fetch)
│   │   ├── hooks/
│   │   │   ├── useAuth.ts             # 认证 Hook
│   │   │   ├── useTheme.ts            # 主题切换 (dark/light)
│   │   │   └── useSidebar.ts          # 侧边栏状态管理
│   │   ├── data/
│   │   │   ├── navigation.ts          # 导航菜单配置
│   │   │   ├── dashboard.ts           # 仪表盘模拟数据
│   │   │   ├── contacts.ts            # 联系人模拟数据
│   │   │   ├── messages.ts            # AI 聊天模拟数据
│   │   │   └── billing.ts             # 账单模拟数据
│   │   ├── config/
│   │   │   └── reviewMetrics.ts       # 复盘指标配置 (30+指标)
│   │   ├── components/
│   │   │   ├── ui/                    # 通用 UI 组件库
│   │   │   │   ├── index.ts           # 统一导出
│   │   │   │   ├── Button.tsx         # 按钮 (6种variant, 8种size)
│   │   │   │   ├── Card.tsx           # 卡片 (Card/CardHeader/Body/Footer)
│   │   │   │   ├── Badge.tsx          # 徽标 (7种variant, 支持dot)
│   │   │   │   ├── Avatar.tsx         # 头像 (12种配色, 在线状态)
│   │   │   │   ├── Input.tsx          # 输入框 (label/prefix/suffix/error)
│   │   │   │   └── StatCard.tsx       # 统计卡片 (sparkline迷你图)
│   │   │   ├── layout/
│   │   │   │   ├── Layout.tsx         # 主布局 (Sidebar+Topbar+Footer)
│   │   │   │   ├── Sidebar.tsx        # 侧边导航 (可折叠/响应式/权限过滤)
│   │   │   │   ├── Topbar.tsx         # 顶部栏 (搜索/通知/主题/退出)
│   │   │   │   └── Footer.tsx         # 底部版权
│   │   │   ├── auth/
│   │   │   │   └── ProtectedRoute.tsx # 路由守卫 (待实现)
│   │   │   ├── ErrorBoundary.tsx      # 错误边界
│   │   │   └── review/               # 复盘专用组件 (8个)
│   │   │       ├── ReviewFilterBar.tsx
│   │   │       ├── ReviewFindingCard.tsx
│   │   │       ├── CompareDrawer.tsx
│   │   │       ├── AnchorRadar.tsx
│   │   │       ├── ChannelMatrix.tsx
│   │   │       ├── ReviewBenchmarkBadge.tsx
│   │   │       ├── ReviewFunnel.tsx
│   │   │       └── ReviewMetricGroup.tsx
│   │   └── pages/                     # 页面组件 (40+)
│   │       ├── auth/SignInPage.tsx
│   │       ├── overview/              # 4个页面
│   │       ├── live/                  # 3个页面
│   │       ├── ai/ChatPage.tsx
│   │       ├── data/                  # 4个页面
│   │       ├── content/               # 3个页面
│   │       ├── bi/                    # 3个页面
│   │       ├── anchors/               # 4个页面
│   │       ├── ops/                   # 6个页面
│   │       ├── review/               # 7个页面
│   │       └── system/               # 6个页面
│   └── docs/api-integration/          # API 集成文档
│
├── apps/api/                           # Node.js 后端项目
│   ├── package.json                   # 项目名: @leyova/api
│   ├── tsconfig.json                  # ES2022/NodeNext
│   ├── ecosystem.config.cjs           # PM2 配置
│   ├── .env                           # 环境变量 (DB连接/会话密钥)
│   ├── prisma/
│   │   └── schema.prisma              # Prisma 模型定义 (6个核心模型)
│   ├── prisma.config.ts               # Prisma 配置
│   ├── src/
│   │   ├── index.ts                   # 应用入口 (Fastify初始化)
│   │   ├── openapi.ts                 # OpenAPI 3.0 规范
│   │   ├── config/env.ts              # 环境变量 Zod 校验
│   │   ├── lib/
│   │   │   ├── db.ts                  # PostgreSQL 连接池
│   │   │   ├── http.ts                # 响应工具 (sendOk/sendError)
│   │   │   ├── session.ts             # 会话管理 (内存)
│   │   │   ├── guard.ts               # 认证/权限守卫
│   │   │   ├── logger.ts              # Pino 日志
│   │   │   ├── error-handler.ts       # 全局错误处理器
│   │   │   └── importer.ts            # CSV/XLSX 导入引擎
│   │   ├── routes/                    # 13个路由模块
│   │   ├── cron/                      # 3个定时任务
│   │   ├── cli/                       # 备份/日志清理工具
│   │   └── generated/                 # Prisma 生成代码
│   └── uploads/                       # 文件上传目录
│
├── database/                          # 数据库
│   ├── postgresql/                   # PostgreSQL 迁移 (14个SQL + seeds)
│   ├── migrations/                   # MySQL 迁移 (12个文件)
│   ├── backups/                      # 数据库备份
│   └── cleanup-for-production.sql    # 上线清理脚本
│
├── api/                               # 旧 PHP API
│   ├── helpers.php                    # API 辅助函数库
│   └── anchor_training.php            # 主播训练管理 API
│
├── css/
│   └── factory.css                    # Orbit Design System (2700行)
│
├── js/
│   ├── factory.js                     # Factory 核心 JS
│   └── charts.js                      # SVG 图表系统
│
├── docs/                              # 项目文档
│   ├── plan.md                        # 复盘模块落地计划
│   ├── douyin-daily-report-system-optimization-plan.md
│   ├── security/                      # 安全文档
│   └── test/                          # 测试数据
│
├── .trae/                             # Trae AI 配置
├── phpmyadmin/                        # phpMyAdmin
├── vendor/                            # Composer PHP 依赖
├── node_modules/                      # Node.js 依赖
├── uploads/sample_images/             # 示例图片
├── logs/                              # 运行时日志
│
├── .htaccess                          # Apache 路由重写
├── php.ini                            # PHP Session 配置
├── composer.json                      # PHP 依赖 (PhpSpreadsheet)
├── package.json                       # 根目录依赖 (node-cron, xlsx)
├── create_database.sql                # MySQL 建库脚本 (19张基础表)
├── phase1_database.sql                # 阶段一数据库变更
├── create_asset_tables.sql            # 资产表创建脚本
├── create_controller_table.sql        # 导播设备表创建脚本
├── sample_data_seed.sql               # 脱敏示例数据
├── backup_database.sql                # 数据库备份 SQL
├── add_room_operator.sql              # 添加房间运营人员 SQL
├── implementation_plan.md             # 抖音数据对接实施方案
├── README_LOG_MANAGEMENT.md           # 日志管理文档
├── cron_log_cleanup.sh                # 日志清理 Shell 脚本
├── test-api.sh                        # API 测试脚本
└── data_management.php.backup         # 旧数据管理页面备份
```

---

## 七、定时任务与 CLI 工具

### 7.1 定时任务

| 任务文件 | 调度 Cron | 说明 |
|---------|-----------|------|
| `aggregate-stats.ts` | `0 1 * * *` (每天 01:00) | 从 `live_sessions` 聚合每日统计到 `overview_daily_stats` |
| `detect-anomalies.ts` | `0 * * * *` (每小时) | GMV 异常波动检测 + 低活跃直播间检测 |
| `archive-old-data.ts` | `0 3 * * *` (每天 03:00) | 清理 `overview_daily_stats` 超过 90 天旧数据 |

### 7.2 CLI 工具

| 文件 | 说明 |
|------|------|
| `cli/backup.ts` | pg_dump 数据库备份 |
| `cli/cleanup-logs.ts` | 日志滚写清理 |
| `scripts/init_session.sh` | Session 目录初始化 |

### 7.3 外部脚本

| 文件 | 说明 |
|------|------|
| `cron_log_cleanup.sh` | 日志清理 Shell 脚本 |
| `test-api.sh` | 对 PHP 端点的 curl 测试脚本 (覆盖25+接口) |

---

## 八、权限与角色体系

### 8.1 角色定义

| 角色 | 代码 | 说明 |
|------|------|------|
| 超级管理员 | `super_admin` | 全部权限 |
| 运营总监 | `ops_director` | 运营管理权限 |
| 运营专员 | `ops_staff` | 运营执行权限 |
| 中控 | `controller` | 仅个人达成和直播登记 |
| 管理员 | `admin` | (旧系统) 管理权限 |
| 经理 | `manager` | (旧系统) 管理权限 |
| 员工 | `employee` | (旧系统) 基础权限 |

### 8.2 系统模块列表 (12个)

| 模块代码 | 模块名称 | 说明 |
|---------|---------|------|
| `overview` | 总览 | Dashboard |
| `session` | 场次 | 场次管理 |
| `anchor` | 主播 | 主播管理 |
| `data` | 数据 | 数据管理 |
| `bi` | BI | 商业智能 |
| `ops` | 运营 | 运营工具 |
| `ai` | AI | AI 分析 |
| `content` | 内容中心 | 内容管理 |
| `system_config` | 系统配置 | 系统设置 |
| `system_alerts` | 异常中心 | 告警管理 |
| `system_tasks` | 改进任务 | 任务管理 |
| `system_promotions` | 活动管理 | 促销活动 |
| `system_competitors` | 竞品观察 | 竞品分析 |
| `system_multiroom` | 多直播间 | 多房间总览 |
| `attendance` | 个人达成 | 考勤管理 |
| `livereg` | 直播登记 | 直播登记 |

---

## 九、关键业务流程

### 9.1 数据导入流程

```
用户上传 CSV/XLSX
        │
        ▼
   upload-preview (预览/校验)
        │
        ▼
   uploads (正式导入)
        │
        ├── 主播分析模板 → douyin_anchor_daily_metrics
        ├── 渠道分析模板 → douyin_channel_daily_metrics
        ├── 全场次模板   → session_{basic,overview,product,sku,short_video}_*
        └── CSV 模板     → live_sessions + session_channel_metrics
```

### 9.2 认证授权流程

```
用户登录 (POST /auth/login)
        │
        ▼
   bcryptjs 验证密码
        │
        ▼
   生成会话令牌 → 写入 user_sessions 表
        │
        ▼
   设置 Cookie (leyova_session)
        │
        ▼
   后续请求 → requireAuth → 读取 Cookie → 验证会话 → 获取用户信息
        │
        ▼
   权限操作 → requirePermission → 检查 role_modules / role_permissions
```

### 9.3 定时任务流程

```
每天 01:00  → 聚合日报统计 (live_sessions → overview_daily_stats)
每小时      → 异常检测 (GMV波动/低活跃直播间 → alert_events)
每天 03:00  → 归档旧数据 (删除90天前的 overview_daily_stats)
```

---

## 十、环境与部署

### 10.1 环境变量配置

| 变量 | 值示例 | 说明 |
|------|--------|------|
| `NODE_ENV` | development/test/production | 运行环境 |
| `PORT` | 8788 | 后端端口 |
| `HOST` | 0.0.0.0 | 监听地址 |
| `WEB_ORIGIN` | http://localhost:95513 | CORS 源 |
| `DATABASE_URL` | postgresql://postgres:change-me@localhost:5432/leyova | 数据库连接串 |
| `SESSION_COOKIE_NAME` | leyova_session | Session Cookie 名称 |
| `SESSION_SECRET` | (32字符随机串) | 会话密钥 |

### 10.2 PM2 进程管理

| 应用名 | 路径 | 端口 |
|--------|------|------|
| `leyova-api` | `apps/api/` | 8788 |
| `leyova-mcp` | `apps/mcp-server/` | 9101 |
| `leyova-web` | `apps/web/` | 95513 |

### 10.3 开发运行

```bash
# 安装依赖
pnpm install

# 后端开发 (热更新)
pnpm dev:api

# 前端开发
pnpm dev:web

# MCP Server
pnpm dev:mcp

# 生产构建
pnpm build
```

---

## 十一、核心设计要点

1. **双轨数据库**：PostgreSQL (新系统主库) + MySQL (旧系统遗留库)，逐步迁移
2. **RBAC 权限体系**：基于角色-模块-权限的三层控制，支持细粒度访问管理
3. **数据导入引擎**：支持 CSⅤ/XLSX 自动解析，四种导入模板自动识别
4. **AI 集成**：数据驱动 AI 问答，支持主播排行/渠道分析/异常预警/日报生成
5. **Orbit Design System**：完整的暗/亮双主题设计系统，统一 UI 组件库
6. **分层架构**：前端 (React) → API (Fastify) → 数据库 (PostgreSQL)，职责清晰
7. **定时自动化**：日报聚合、异常检测、数据归档全自动执行