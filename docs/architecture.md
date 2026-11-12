# leyova 系统架构详细文档

> 更新日期: 2026-11-12

---

## 一、项目概览

**leyova**（乐播云）是一个**全渠道电商直播与代运营数字中台**，采用 **React 19 + Fastify 5 + PostgreSQL 18** 技术栈，支持抖音、快手、淘宝、天猫、京东、拼多多、小红书 **7 大平台**，兼顾 MCN 代运营与品牌自播双轨业务。

| 项目 | 说明 |
|------|------|
| 项目名称 | leyova (Orbit Dashboard) |
| 业务领域 | 7 大平台直播电商与全渠道货架运营数据分析 |
| 技术栈 | React 19 + Fastify 5 + PostgreSQL 18 |
| 部署方式 | PM2 进程管理 (`leyova-api:8788`, `leyova-web:5513`, `leyova-mcp:9101`) |
| 数据规模与隔离 | 143 张逻辑表 / 219 张物理表（含分区），28 张启用 PostgreSQL RLS |

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
| `/content/schedule` | ContentSchedulePage | 内容排产与归因 |
| `/content/center-config` | ContentCenterConfigPage | 生成服务配置（`/content/config` 重定向至此） |

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

### 4.1 路由模块总览 (38 个路由文件, 270 个 API 端点)

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
│   │   ├── App.tsx                    # 路由配置
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
│   │   └── pages/                     # 页面组件 (82个)
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
│   │   ├── routes/                    # 38个路由文件 (含 agency/ 4个)
│   │   ├── cron/                      # 5个定时任务
│   │   ├── cli/                       # 备份/日志清理工具
│   │   └── generated/                 # Prisma 生成代码
│   └── uploads/                       # 文件上传目录
│
├── database/                          # 数据库
│   ├── 01_schema.sql                 # 基线建表 (59 表)
│   ├── 02_seed.sql                   # 基础字典与默认账号
│   ├── 03_demo_data.sql              # 演示数据 (可重复执行)
│   ├── migrations/                   # PostgreSQL 增量迁移 (100~114, 15个文件)
│   └── migrate.js                    # 增量迁移执行器
│
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


---

## 八、权限与角色体系

### 8.1 角色定义 (`roles` 表 10 个内部角色 + 外部只读视图)

| 角色 | 代码 | 说明 |
|------|------|------|
| 超级管理员 | `super_admin` | 全部 31 项权限及租户/平台全局管控 |
| 管理员 | `admin` | 机构负责人/业务总监，跨项目审批与统筹 |
| 运营总监 | `ops_director` | 运营管理与全渠道看板权限（含投流总览） |
| 运营 | `operator` | 直播操盘、选品与场控运营（屏蔽成本/投流明文） |
| 运营专员 | `ops_staff` | 运营日常执行权限 |
| 投放专员 | `ad_buyer` | 全域投流消耗、归因窗口与 T+7 净成交 ROI 优化（屏蔽商品进价成本） |
| 财务 | `finance` | 成本录入、阶梯佣金核算、不可变月结对账单与净毛利查看 |
| HRBP | `hrbp` | 主播档案、梯队评级、考勤排班审批与绩效 |
| 中控 | `controller` | 个人达成与直播现场登记 |
| 员工 | `employee` | 基层一线作业人员基础工作台 |
| 品牌方代表 *(外部账号类型)* | `brand_viewer` | 外部品牌商受限只读视角（受 PostgreSQL RLS 物理行级隔离，默认屏蔽内部成本/消耗） |

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

### 9.3 定时任务流程（全量接入 `system_jobs` 状态追踪）

```
每天 01:00  → 聚合日报统计 (live_sessions → overview_daily_stats)
每天 01:30  → 多平台事实表汇总聚合 (aggregate-facts → agg_shop_daily / agg_platform_monthly)
每天 02:30  → AI 场次复盘草稿自动生成 (ai_review_drafts)
每天 03:00  → 冷数据归档 (overview_daily_stats 历史数据转存归档表)
每天 04:00  → 7 大分区表未来 3 个月预建与 DEFAULT 分区守护 (partition_maintenance)
每天 05:00  → 多平台官方授权店铺增量同步 (platform_api_sync，未授权/manual_only 自动跳过)
每小时      → 异常检测与阈值规则评测 (anomaly_detection → alert_events)
每周日 02:00 → PM2 与系统日志滚写清理 (log_rotation → rotateAllFiles)
```

---

## 十、环境与部署

### 10.1 环境变量配置

| 变量 | 值示例 | 说明 |
|------|--------|------|
| `NODE_ENV` | development/test/production | 运行环境（生产模式强制拒绝默认弱密钥） |
| `PORT` | 8788 | 后端 API 端口 |
| `HOST` | 0.0.0.0 | 监听地址 |
| `WEB_ORIGIN` | http://localhost:5513 | CORS 源 |
| `DATABASE_URL` | postgresql://user:password@127.0.0.1:55432/leyova | 数据库连接串 |
| `SESSION_COOKIE_NAME` | leyova_session | Session Cookie 名称 |
| `SESSION_SECRET` | (随机强密钥) | 会话密钥（生产禁止使用示例弱串） |
| `LEYOVA_MCP_TOKEN` | (48位以上随机串) | API/MCP 服务间 Bearer 认证令牌 |
| `LEYOVA_MCP_SIGNING_SECRET` | (48位以上随机串) | `X-Leyova-User-Sig` HMAC-SHA256 验签密钥 |
| `LEYOVA_MCP_REQUIRE_SIG` | true | 是否强制要求所有 MCP 请求携带 HMAC 用户签名 |

### 10.2 PM2 进程管理

| 应用名 | 路径 | 端口 |
|--------|------|------|
| `leyova-api` | `apps/api/` | 8788 |
| `leyova-mcp` | `apps/mcp-server/` | 9101 |
| `leyova-web` | `apps/web/` | 5513 |

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

## 十一、数据治理引擎

> 本章对应 `apps/api/src/modules/data-governance/` 与迁移 `114`，是系统接入真实平台数据的底座。

### 11.1 设计定位

企业级数据清洗与质量校验引擎，目标支撑**千万级数据量与按月物理分区**（迁移 114 标注目标：年营收 10 亿+、数据量 5000 万级）。

### 11.2 五段式流水线

```
外部数据源
   ↓  ingestion  原始接入（保留 raw 原文，可回溯）
raw_records
   ↓  cleaning   清洗标准化（字段映射、类型纠正、去重）
clean_records
   ↓  validation 质量校验（P0/P1/P2 三级问题，闸门拦截）
validation_runs + data_quality_issues
   ↓  publishing 发布到事实表（幂等写入）
canonical_orders / canonical_order_items / canonical_refund_events
   ↓  reconciliation 双源对账
reconciliation_runs + publish_reversals
```

### 11.3 模块与职责

| 文件 | 职责 |
|---|---|
| `ingestion/ingestion-service.ts` | 原始数据接入，写 `raw_records`，创建 `import_batches` |
| `cleaning/cleaner-service.ts` | 清洗标准化，写 `clean_records`，记录 `cleaning_runs` |
| `validation/validation-service.ts` | 质量校验，产出 `validation_runs` 与 `data_quality_issues` |
| `publishing/publishing-service.ts` | 发布到 canonical 层，含闸门检查与幂等写入 |
| `reconciliation/reconciliation-service.ts` | 双源对账，写 `reconciliation_runs` |
| `review/review-service.ts` | 人工复核流程 |
| `allocation.ts` | 优惠/费用分摊算法 |
| `adapters/` | 7 平台适配器（与 `src/platform/adapters/` **并存，职责重叠**） |
| `security.ts` | 治理链路权限校验 |
| `types.ts` | 规范化记录类型定义（Canonical*Record） |

### 11.4 数据表（14 张父表 + 按月分区子表）

| 分组 | 表 |
|---|---|
| 接入层 | `import_batches`、`import_files`、`raw_records` |
| 清洗层 | `clean_records`、`clean_rule_sets`、`cleaning_runs`、`field_mapping_rules`、`upload_column_mappings` |
| 校验层 | `validation_runs`、`data_quality_issues` |
| 规范化层 | `canonical_orders`、`canonical_order_items`、`canonical_refund_events` |
| 发布层 | `publish_runs`、`publish_reversals` |
| 对账层 | `reconciliation_runs` |

**分区规则与守护**：`raw_records`、`clean_records`、`canonical_orders`、`canonical_order_items`、`canonical_refund_events`、`fact_trade_daily`、`fact_traffic_daily` 全部按月物理分区。

> `cron/manage-partitions.ts` 通过 `hasRangePartitionBound()` 查询 `pg_inherits` 与 `pg_get_expr(c.relpartbound, c.oid)` 自动兼容历史 `_yYYYYmMM` / `_yYYYYMM` 分区命名，每日 `04:00` 提前预建未来 3 个月区间分区，并由 `ensureDefaultPartition()` 为 7 张分区表自动兜底创建 `DEFAULT` 分区，彻底消除跨月或历史补数写入失败风险。

### 11.5 API 端点与业务域覆盖

后端共 44 个路由模块、264 个 REST/MCP 端点：数据治理引擎 (`routes/governance.ts`) 覆盖接入批次、清洗、校验闸门、对账、原子发布与反向冲正，并将每次发布绑定至 `data_uploads` 与 `fact_trade_daily.upload_id` 血缘链。

---

## 十二、核心设计要点

1. **单一数据库**：PostgreSQL 18（136 张逻辑表 / 空库冷启动基线 206 张物理表，29 张启用 RLS 行级隔离，增量迁移 100~120）
2. **多维 RBAC + RLS**：应用层角色权限矩阵 + `leyova_app` 角色 PostgreSQL 行级策略双重纵深防御，支持品牌商只读与成本/投流脱敏
3. **双轨数据治理底座**：未授权/`manual_only` 店铺 fail-closed 拦截，CSV/XLSX 与 OpenAPI 统一落 `raw_records → clean_records → canonical_*`，支持财务级余数归底分摊与原子冲正
4. **AI 集成**：4 阶受控 AI 编排器 + 语义层按角色裁剪投流/成本敏感指标 + HMAC 签名 MCP 服务通信
5. **Orbit Design System**：完整的暗/亮双主题设计系统，支持纯代运营 / 纯品牌自播 / 全渠道总览三种工作模式
6. **分层架构**：前端 (React 19 · 93 页) → API (Fastify 5 · `buildApp()` 可注入测试实例) → 数据库 (PostgreSQL 18)
7. **可观测运维闭环**：全量定时任务写入 `system_jobs`，配套 `pg_dump` 校验与保留策略备份脚本、`copyFileSync + truncate` PM2 日志滚写工具与 HTTP 集成测试套件