# Leyova 现网运行时功能实测审计（Runtime Functional Audit）

- **审计对象**：`/home/leyova`（远程 SSH 工作区 `cpolar-server`，用户 `odlive`）现网运行态
- **审计时间**：2026-11-16 07:38:22 — 08:20 UTC（Asia/Taipei 15:38 — 16:20）
- **代码版本**：`git HEAD = 1cccb41`（2026-11-16，`docs: 重写 README…`）
- **审计方式**：全部结论来自**实测**（真实登录、真实 HTTP 请求、真实 `psql` 计数、静态代码交叉核对），不含推测
- **约束遵守**：全程只读。未改动任何源码、未执行 DDL/DELETE/UPDATE、未 `pm2 restart`、未 `git commit`、未写入任何业务表
- **证据留档目录**：`/home/leyova/docs/audit-2026-11-16/_evidence/`

---

## 0) 结论先行

1. **不能交付给真实客户使用，可以交付给客户做「演示 / POC」。** 系统骨架（认证、RBAC、模块守卫、52 个路由文件、406 条已注册路由、240 张表）是真实且跑得起来的；但**驱动它的全部经营数据是 `is_demo=true` 的种子数据**（`fact_trade_daily` 18,630 行 100% `source='demo'`），且 6 个平台数据完全等量（每平台每日恰好 180 单）。给客户看"能跑"，一旦接真实店铺数据就会暴露口径与聚合问题。
2. **接口层健康度良好：242 个 GET 端点实测 212 个 2xx（87.6%），0 个 5xx，0 个超时。** 30 个 4xx 中 19 个是"缺必填参数"的正常校验（非故障），6 个是 **OpenAPI 文档漂移**（文档写了、代码没注册，运行态 404）。
3. **最严重的数据正确性问题：`/wechat/shop/{id}/overview` 与 `/tmall/shop/{id}/overview` 的店铺过滤被静默丢弃**——所有店铺返回同一份"全平台合计"。根因已定位到行：`dim_shop.id` 是 bigint，`node-postgres` 返回**字符串**，而 `wechat-analytics.ts` / `tmall-analytics.ts` 共 6 处用 `Number.isFinite(shopId)` 判断 → 永远 `false` → 过滤条件不拼进 SQL。实测：微信 3 个店铺 API 均返回 `totalGmv=3,127,091.77`（= 全平台合计），而单店真实值为 1,357,981.85 / 941,263.06 / 827,846.86。
4. **页面可用性比预期好：96 个页面中 82 个「可用」（有真实接口且全部 2xx 有数据）**，仅 4 个「壳」、2 个「坏」、5 个「半可用」、3 个是不带路由的子组件。但**「20 个平台专属页」是不成立的**：实际 24 条平台专属路由只由 **15 个页面文件**承载，其中 10 条路由共用 1 个 34 行的配置驱动通用壳。
5. **AI 模块是"预制结果"，不是"在线智能"**：`ai_v2_llm_call = 0` 行、`AI_ENABLED=false`，但 `ai_v2_evidence = 27,195` 行、`ai_v2_claim = 10,897` 行、`ai_v2_run = 1,578` 行。即所有 AI 结论都是预先写库的，**从未发生过一次真实 LLM 调用**。选品 / 排品页读得到数，但那些数是造出来的。

---

## 1) 实测方法与环境

### 1.1 环境事实核对（与 Lead 交接信息的差异）

| 项目 | Lead 交接说法 | 实测结果 | 判定 |
| :--- | :--- | :--- | :--- |
| PostgreSQL 端口 | `127.0.0.1:5432` | **`127.0.0.1:55432`**（`.env` 的 `DATABASE_URL=postgresql://leyova@127.0.0.1:55432/leyova`） | ⚠️ 5432 上另有一个 PG 实例，连上去会**挂起超时**（实测 `psql -p 5432` 60s 超时），审计 / 运维脚本必须用 55432 |
| API 健康检查 | `/health` | `/health` → **404**；真实路径是 `/api/v1/health` 与 `/api/v1/ready` | ⚠️ 监控脚本若探 `/health` 会误报 |
| 页面文件数 | 96 | 96（`apps/web/src/pages/**/*.tsx`） | ✅ |
| 后端路由文件数 | 52 | 52（`apps/api/src/routes/*.ts`） | ✅ |
| 迁移文件数 | 66 | 66（`database/migrations`） | ✅ |
| 前端页面目录 | 22 | 16 个一级目录（`system 18 / anchors 11 / review 7 / overview 6 / data 5 / ops 4 / content 4 / bi 4 / ai 4 / live 3 / shop 2 / compliance 2 / omnichannel 1 / insights 1 / brand-portal 1 / auth 1`） | ⚠️ 口径不同 |

### 1.2 运行态服务（`pm2 list` @ 2026-11-16T07:38Z）

| 服务 | pid | 端口 | 重启次数 | 状态 |
| :--- | ---: | :--- | ---: | :--- |
| leyova-api | 489681 | 8788 | **80** | online（uptime 2h） |
| leyova-web | 473443 | 5513 | **24** | online（uptime 2h） |
| leyova-postgres | 435251 | **55432** | 4 | online |
| leyova-worker | 466299 | — | 11 | online |
| leyova-mcp | 435253 | — | 11 | online |

> 观察：`leyova-api` 累计重启 **80 次**、`leyova-web` **24 次**，2 小时内各重启 1 次以上。虽当前 online，但重启频次意味着**不能承诺 7×24 稳定性**，属于交付前必须查清项（本审计只读，未查日志根因，建议另派任务）。

### 1.3 技术栈实测版本

| 组件 | 版本 |
| :--- | :--- |
| Node.js | v24.17.0 |
| pnpm | 11.20.0 |
| PostgreSQL | 18.6（Ubuntu 0.26.04.1） |
| OpenAPI | `leyova API v2` / `2.0.0` |
| 代码规模 | `apps/api/src` 187 个 `.ts`；`apps/web/src` 156 个 `.ts/.tsx` |
| 数据库对象 | `public` schema **240 张表**（含分区子表） |

### 1.4 审计脚本与方法（全部留档在 `_evidence/`）

| 脚本 | 作用 | 产物 |
| :--- | :--- | :--- |
| `probe_endpoints.mjs` | 登录取 Cookie → 遍历 OpenAPI 全部 GET → 记录状态 / 耗时 / 空数据 → 二轮用真实 id 重试路径参数端点 | `probe_admin.json` `probe_manager_liu.json` `probe_operator_wang.json` `probe_hr_li.json` |
| `probe_shop_scoped.sh` | 用**各平台自己的** `shop_id` 复测 48 个店铺维度端点 | `shop_scoped.tsv` |
| `probe_insights.sh` | 复测 10 个平台专属洞察端点 | `insights_probe.txt` |
| `extract_frontend_api.mjs` | 从 `apps/web/src` 提取 272 个 `(method, path)` 调用点，按 `services/api.ts` 的 `buildUrl` 语义归一化 | `frontend_api_paths.json` |
| `probe_frontend_calls.mjs` | 实测前端**真实调用**的 178 个 GET 端点 | `probe_frontend_calls.json` |
| `crosscheck_routes.mjs` | 从源码正则提取 406 条已注册路由，与 OpenAPI / 前端调用三方交叉 | `route_crosscheck.json` |
| `page_route_audit.mjs` | 96 页面 × 107 路由挂载关系、行数、是否被 `App.tsx` 引入 | `page_audit.json` |
| `page_audit_final.mjs` | 逐页面取真实调用 → 实测 → 四档分类 | `page_classification.json` |
| `openapi.json` | 运行态 OpenAPI 快照（`GET http://localhost:8788/docs/json`） | 55,950 bytes |
| `table_rowcounts.txt` | 240 张表 `count(*)` 精确行数 | 240 行 |

**测量命令示例（可复现）**

```bash
# OpenAPI 快照
curl -s http://localhost:8788/docs/json -o docs/audit-2026-11-16/_evidence/openapi.json
# 全量 GET 探测（admin）
cd docs/audit-2026-11-16/_evidence && node probe_endpoints.mjs admin
# 240 张表精确行数
PGPASSWORD= psql -h 127.0.0.1 -p 55432 -U leyova -d leyova -At -F'|' -f /tmp/allcnt.sql
# shop.id 类型验证（证明 bug 根因）
node -e "const pg=require('pg');(async()=>{const c=new pg.Client({host:'127.0.0.1',port:55432,user:'leyova',database:'leyova'});await c.connect();
const r=await c.query('SELECT id FROM public.dim_shop WHERE id=\$1',[7]);
console.log(typeof r.rows[0].id, Number.isFinite(r.rows[0].id));await c.end()})()"
# → string false
```

---

## 2) 端点实测统计

### 2.1 总量与成功率

| 指标 | 数值 | 说明 |
| :--- | ---: | :--- |
| OpenAPI 文档 path 数 | 345 | `GET /docs/json` |
| OpenAPI operation 数 | 419 | 其中 **GET 242**、其余为 POST/PUT/PATCH/DELETE |
| 源码实际注册路由数 | 406 | `app.get/post/put/patch/delete('...')` 静态提取 |
| **实测 GET 端点数** | **242** | 100% 覆盖，逐个发请求 |
| **2xx** | **212（87.6%）** | |
| ├ 其中返回**空数据** | 19 | 空数组 / `data:null` / 空对象 |
| ├ 其中**有数据** | 193 | |
| **4xx** | 30（12.4%） | |
| **5xx** | **0** | 无一例服务端异常 |
| **超时（8s）** | **0** | |
| **连接错误** | **0** | |

> `GET /mcp` 返回 401 是**设计如此**（MCP 服务需 `LEYOVA_MCP_TOKEN`），不计入故障。

### 2.2 分角色成功率（权限是否真的接上电）

| 账号 | 角色 | 2xx | 400 | 401 | 403 | 404 | 结论 |
| :--- | :--- | ---: | ---: | ---: | ---: | ---: | :--- |
| `admin` | super_admin | **212** | 19 | 1 | 0 | 10 | 全量可见 |
| `manager_liu` | admin | **211** | 19 | 1 | 1 | 10 | 与 super_admin 几乎等价 |
| `operator_wang` | operator | **141** | 13 | 1 | **82** | 5 | 权限真实收敛 |
| `hr_li` | hrbp | **82** | 10 | 1 | **147** | 2 | 权限真实收敛 |

**判定：RBAC 与模块守卫是"通了电"的**——403 不是白屏，而是带模块名的可读报错，例如：

```json
{"success":false,"message":"当前账号无权访问模块「after_sales」","module":"after_sales"}
{"success":false,"message":"当前账号无权访问模块「bi」","module":"bi"}
```

这一条**推翻了 2026-11-15 旧审计「权限：模型写对了，但没接上电」的结论**（详见第 6 节）。

### 2.3 认证实测（README 演示账号矩阵）

`POST /api/v1/auth/login`，body `{"username":"…","password":"Admin@123456"}`，认证方式为 **HttpOnly Cookie `leyova_session`**（OpenAPI `securitySchemes.cookieAuth`，无 Bearer Token）。

| README 声称的账号 | HTTP | 返回 | 判定 |
| :--- | ---: | :--- | :--- |
| `manager_liu`（机构负责人） | **200** | `{"user":{"id":7,"realName":"刘总监 (业务负责人)","role":"admin"}}` | ✅ |
| `director_zhang`（运营总监） | **401** | `{"success":false,"message":"用户名或密码不正确"}` | ❌ **账号不存在** |
| `operator_wang`（操盘手） | **200** | `{"user":{"id":8,"realName":"王运营 (操盘手)","role":"operator"}}` | ✅ |
| `buyer_sun`（投手） | **401** | `{"success":false,"message":"用户名或密码不正确"}` | ❌ **账号不存在** |
| `finance_chen`（财务） | **200** | `{"user":{"id":9,"realName":"陈财务 (对账主管)","role":"admin"}}` | ⚠️ 登录成功但 **role=admin，不是 finance** |
| `hr_li`（HRBP） | **200** | `{"user":{"id":10,"realName":"李HRBP (主播赋能)","role":"hrbp"}}` | ✅ |
| `gap_viewer`（品牌代表） | **401** | `{"success":false,"message":"用户名或密码不正确"}` | ❌ **账号不存在** |
| `admin`（超管） | **200** | `{"user":{"id":1,"realName":"平台超管","role":"super_admin"}}` | ✅ |

**`users` 表实测（32 行）真实存在的可用账号**：
`admin`(1, super_admin) / `manager_liu`(7, admin) / `operator_wang`(8, operator) / `finance_chen`(9, **admin**) / `hr_li`(10, hrbp) / `anchor_shen`(11, employee) / `control_zhao`(12, employee) / `director_zhou`(81, ops_director) / `staff_lin`(82, ops_staff) / `ctrl_wu`(83, controller) / `buyer_xu`(84, ad_buyer)。

**结论**：
1. README 的 8 个演示账号**3 个不存在**（`director_zhang` / `buyer_sun` / `gap_viewer`），实际对应账号是 `director_zhou` / `buyer_xu` / `__bv_test`（且 `__bv_test` `status=0` 已禁用）。这是**交付文档与实际不一致**，客户按 README 演示会当场登录失败。
2. `brand_viewer` 角色（README 主打的"签约品牌独立门户"）**没有任何启用状态的账号**，`/brand-portal` 路由无法做角色验收。
3. `finance_chen` 的 `role` 是 `admin` 而非 `finance` —— `users.role` 的 CHECK 约束里**没有 `finance`**，财务角色在数据模型层就不存在，README 的"财务主管"是冒充的 admin。

### 2.4 失败用例清单（30 条 4xx，按性质归类）

#### A. OpenAPI 文档漂移 —— 文档里有、代码没注册，运行态 404（**6 条，真缺陷**）

| 端点 | 实测 | 证据 |
| :--- | :--- | :--- |
| `GET /api/v1/anchors` | 404 `{"message":"Not Found"}` | `openapi.ts` 有定义，`routes/` 无注册 |
| `GET /api/v1/ops/session-products` | 404 `{"message":"Not Found"}` | `openapi.ts:198` 定义；真实路由是 `/api/v1/ops/session-plans`（`ops.ts:221` 注释自己写着"frontend: /ops/session-products"） |
| `GET /api/v1/inventory/stock` | 404 | `openapi.ts:412` 定义，源码只有 `/inventory/stock/adjust`(POST) |
| `GET /api/v1/cs/conversations` | 404 | `openapi.ts:443` 定义，无注册 |
| `GET /api/v1/system/competitors/{id}/prices` | 404 | 文档有、代码无 |
| `GET /api/v1/platforms/{code}/shops/{shopId}/credentials` | 404 | 文档有、代码无（`platforms/douyin/shops/1/credentials`、`kuaishou/4`、`taobao/10` 全部 404） |

#### B. 缺必填参数 —— 校验正常，非故障（**19 条**）

| 端点组 | 实测返回 |
| :--- | :--- |
| `GET /api/v1/bi/compare`、`/bi/metric-query` | 400 `缺少必选参数: metrics` |
| `GET /api/v1/review/funnel-data`、`/review/products`、`/review/session-info`、`/review/short-videos` | 400 `缺少 room_id 或 date 参数`（**带参复测全部 200 且有数据，见 2.5**） |
| `GET /api/v1/system/custom-fields/values` | 400 `必须提供实体类型 entityType 与实体标识 entityId` |
| `GET /api/v1/content/providers/1/object-info` | 404 `生成服务不存在` |
| `GET /api/v1/content/tasks/1`、`/data/uploads/1/download`、`/ingest/platform-templates/douyin` | 404 资源不存在（业务 404，合理） |
| `GET /api/v1/anchors/my/performance` | 404 `当前登录账号未绑定主播档案，请联系管理员在系统管理中关联`（业务 404，合理） |

#### C. 平台跨店校验 —— 我方探测参数错误所致，**非缺陷**（**5 条**）

`/api/v1/kuaishou/shop/1/*`、`/api/v1/taobao/shop/1/*`、`/api/v1/tmall/shop/1/overview`、`/api/v1/wechat/shop/1/overview` 返回：

```json
{"success":false,"message":"店铺 #1 (抖音主营旗舰店) 属于 douyin，与目标平台 kuaishou 不匹配"}
```

这实际是**正确行为**——`assertShopPlatform` 拦住了跨平台店铺串用（`lib/shop-guard.ts`）。用各平台真实 `shop_id`（douyin=1/2/3、kuaishou=4/5/6、taobao=10/11/12、tmall=13/14/15、wechat=7/8/9、xiaohongshu=16/17/18）复测 **48 个端点 → 45 个 200**（3 个 404 即上表 credentials）。

#### D. 凭据未配置 —— 真实缺口（**1 条**）

`GET /api/v1/platforms/douyin/oauth/url` → 400 `平台 douyin 尚未配置有效的官方 appKey，请先提供真实应用凭证`。
配合 `dim_shop.auth_status` 实测：**21 个店铺中 20 个 `manual_only`、仅 1 个 `authorized`** —— 即**平台授权打通基本为零，全靠手工录数**。

### 2.5 带参复测（证明 B 类不是故障）

| 端点 | 结果 |
| :--- | :--- |
| `GET /api/v1/review/session-info?room_id=1&date=2026-11-12` | **200**，返回 `session_id=5875`、`business_date=2026-11-12`、主播 / 场次明细 |
| `GET /api/v1/review/funnel-data?room_id=1&date=2026-11-12` | **200**，漏斗 5 层：曝光 10,726 → 观看 5,363（转化 50%）… |
| `GET /api/v1/review/products?room_id=1&date=2026-11-12` | **200**，返回商品明细数组（`product_code`、`price`、`session_id=5877`） |
| `GET /api/v1/review/short-videos?room_id=1&date=2026-11-12` | **200**，返回短视频引流明细（`video_name="引流短视频 5879"`） |

### 2.6 前端调用 ↔ 后端路由三方交叉

| 指标 | 数值 |
| :--- | ---: |
| 前端 `(method, path)` 调用点 | 272 |
| 其中方法可静态确定 | 226（GET 132 / POST 59 / PUT 14 / DELETE 16 / PATCH 5） |
| 后端源码已注册路由 | 406 |
| **静态可判定为"前端调了、后端没有"的死链** | **0**（4 条报警经核实是 `/personnel/${plural(tab)}` 动态拼接的误报） |
| **运行时实测 404 的前端调用（真实死链）** | **2**：`GET /api/v1/anchors/rankings`（→`主播不存在`）、`GET /api/v1/agency/projects`（→`Not Found`） |

**这 2 条死链的宿主**：`components/overview/PerformanceLeaderboard.tsx`（第 27、46 行），被 `pages/overview/CockpitPage.tsx:316` 使用，路由 `/overview/cockpit/standalone`。该组件用 `if (anchorRes.ok)` 静默吞掉失败，**页面上表现为"排行榜空着"，不会有任何报错**——这是最典型的"页面调用已下线接口"。

---

## 3) 页面与路由可达性（96 页逐页四档）

### 3.1 总览

| 档位 | 页数 | 占比 | 判定标准 |
| :--- | ---: | ---: | :--- |
| **可用** | **82** | 85.4% | 已挂载 + 有真实接口 + 全部 GET 2xx 且有数据（含视图路由页） |
| **半可用** | **5** | 5.2% | 接口通但返回空数据 / 通用壳无专属实现 / 仅写接口 |
| **壳** | **4** | 4.2% | 占位文案、未挂载死页、3 行 re-export 别名 |
| **坏** | **2** | 2.1% | 页面依赖的接口 404/400，功能不可用 |
| **子组件** | **3** | 3.1% | 无独立路由，嵌在 `SystemConfigPage` 内（非页面） |
| 合计 | **96** | 100% | |

### 3.2 路由结构

| 指标 | 数值 |
| :--- | ---: |
| `App.tsx` 中 `<Route>` 声明 | 109 |
| 可解析出 element 的路由 | 107 |
| 其中重定向路由（`<Navigate>`） | 1（`/bi/roi` → `/ops/net-roi`） |
| 一级路由段分布 | `anchors 16 / ops 14 / insights 14 / system 14 / shop 10 / review 7 / overview 6 / data 5 / ai 4 / bi 4 / content 4 / live 3 / compliance 3 / omnichannel 2 / hrbp 1 / brand-portal 1 / sign-in 1` |

### 3.3 「可用」页面清单（82 个，按模块，括号为代码行数）

| 模块 | 页面 |
| :--- | :--- |
| 总览 6 | `PlatformAwareHomePage (297)` `CockpitPage (389)` `LiveMonitorPage (237)` `SessionsPage (258)` `AnalyticsPage (264)` `UnifiedDashboardHub (247, 视图路由)` |
| 直播管理 3 | `AttendancePage (441)` `LiveRegistrationPage (520)` `DataLivePage (249)` |
| AI 4 | `ChatPage (784)` `SelectionPage (467)` `SelectionHistoryPage (260)` `AnalysisWorkbenchPage (505)` |
| 数据 / 全渠道 5 | `DataManagementPage (345)` `UploadedDataPage (387)` `OmniDashboardPage (346)` `ShopOverviewPage (243)` `ShopProductsPage (438)` |
| 平台专属 14 | `TaobaoShopBoardPage (210)` `TaobaoAdReconciliationPage (184)` `TaobaoProductChannelPage (232)` `TaobaoShopSessionPage (156)` `KsTrafficSplitPage (211)` `KsIndirectGmvPage (245)` `KsFansTeamPage (168)` `XhsNoteBoardPage (242)` `XhsConversionPage (293)` `XhsNoteToLivePage (163)` `WechatPrivatePublicPage (185)` `DouyinShortVideoFunnelPage (165)` 等 |
| 内容 1 | `ContentSchedulePage (389)` |
| BI 3 | `BiDashboardPage (341)` `RefundAnalysisPage (235)` `AnomalyDetectionPage (343)` |
| 主播赋能 8 | `AnchorListPage (320)` `AnchorProfilePage (662)` `HrbpWorkspacePage (279)` `LiveScheduleCalendarPage (664)` `MySchedulePage (295)` `ScheduleManagementPage (688)` `ScheduleRecommendPage (162)` `ScriptTemplatesPage (269)` |
| 运营提效 12 | `CapabilitiesPage (356)` `IssueLibraryPage (293)` `GoalTrackingPage (317)` `RoomHealthPage (234)` `SessionProductsPage (355)` `InventoryCenterPage (1191)` `FulfillmentSlaPage (581)` `AfterSalesPage (410)` `KolCooperationPage (461)` `CustomerServicePage (614)` `NetRoiPage (454)` `SearchKeywordsPage (540)` `MembersPage (182)` |
| 直播复盘 7 | `ReviewOverviewPage (827)` `ProductAnalysisPage (725)` `ShortVideoTrafficPage (645)` `ChannelAnalysisPage (833)` `AnchorPerformancePage (582)` `FunnelAnalysisPage (807)` `ClosedLoopPage (649)` |
| 系统 12 | `UsersPage (435)` `AuditLogsPage (310)` `DictPage (333)` `SystemConfigPage (635)` `PersonnelPage (49)` `RoomsPage (32)` `AlertCenterPage (884)` `ImprovementTasksPage (276)` `PromotionCampaignsPage (687)` `CompetitorWatchPage (321)` `MultiRoomOverviewPage (273)` `CompliancePage (296)` `RolesPage (321)` `SystemJobsPage (529)` |
| 合规 / 品牌 3 | `RuleRadarPage (799)` `ChangeDetailPage (352)` `BrandPortalPage (165)` |
| 登录 1 | `SignInPage (167)`（实测 5/8 账号登录成功） |

> 完整逐页数据见 `_evidence/page_classification.json`（含每页行数、路由、GET/POST 调用数、每个接口的实测状态码、空数据标记）。

### 3.4 「壳」与「坏」逐页明细

| 页面 | 行数 | 路由 | 档位 | 实测证据 |
| :--- | ---: | :--- | :--- | :--- |
| `pages/content/VideoCreatePage.tsx` | 34 | `/content/video-create` | **壳** | 源码含"**正在开发** / 即将上线"占位块，零接口调用 |
| `pages/content/VideoDataPage.tsx` | 34 | `/content/video-data` | **壳** | 同上，"**正在开发**" |
| `pages/overview/HomePage.tsx` | 200 | —（无路由） | **壳** | `App.tsx` 未引入，**死页**（已被 `PlatformAwareHomePage` 取代） |
| `pages/anchors/UnifiedScheduleHub.tsx` | **3** | 被解析为 `/anchors/live-schedule` | **壳** | 内容只有 `export { UnifiedScheduleHub } from '@/pages/ops/schedule/UnifiedScheduleHub'`——**3 行 re-export 别名，`grep` 零引用，死代码** |
| `pages/system/PlatformManagementPage.tsx` | 616 | `/system/platforms` | **坏** | `GET /platforms/douyin/oauth/url` → **400** `尚未配置有效的官方 appKey`；即"平台授权接入"功能**在现网完全不可用** |
| `pages/anchors/MyPerformancePage.tsx` | 274 | `/anchors/my-performance` | **坏** | `GET /anchors/my/performance` → **404** `当前登录账号未绑定主播档案`；admin 账号无主播档案且页面无兜底 → **该页对非主播角色永久空白** |

### 3.5 「半可用」逐页明细

| 页面 | 行数 | 路由 | 空数据接口 | 说明 |
| :--- | ---: | :--- | :--- | :--- |
| `pages/data/DataUploadPage.tsx` | 741 | `/data/upload` | 1/1 个 GET 全空 | `data_uploads` 表 **0 行**，上传历史永远为空 |
| `pages/data/DataQualityPage.tsx` | 1179 | `/data/quality` | 1/3 个 GET 空 | `data_quality_issues` **0 行**、`dq_quarantine` **0 行** → 质量报告无内容可展示 |
| `pages/anchors/TrainingPage.tsx` | 317 | `/anchors/training` | 1/2 个 GET 空 | `anchor_training_records` **0 行** → 培训记录空 |
| `pages/content/ContentCenterConfigPage.tsx` | 316 | `/content/center-config` | 1/2 个 GET 空 | `content_providers` **0 行** |
| `pages/insights/PlatformInsightPage.tsx` | **34** | 10 条路由共用 | — | 配置驱动通用壳：`findInsightConfig(pathname)` → `<DedicatedInsightShell>`。10 个后端端点均 **200 且有数据**，但**页面本身零业务逻辑** |

### 3.6 重点验证：「20 个平台专属页」到底成不成立

**实测：不成立。** 平台专属路由共 **24 条**（`/shop/*` 10 条 + `/insights/*` 14 条），由 **15 个页面文件**承载，分层如下：

| 层次 | 数量 | 实现 |
| :--- | ---: | :--- |
| 独立实现且有真实数据 | **14** | `pages/shop/**` 14 个文件（douyin 1 / kuaishou 3 / taobao 4 / wechat 1 / xiaohongshu 3 / 公共 2），每个 156–293 行，各自调用 `/kuaishou/shop/{id}/*`、`/taobao/shop/{id}/*` 等**平台专有端点** |
| 配置驱动通用壳（10 条路由 → 1 个 34 行文件） | **1** | `PlatformInsightPage` + `DedicatedInsightShell (370 行)` + `PlatformInsightConfig (119 行)`。10 条路由：`/insights/douyin/three-pools`、`/insights/taobao/three-sources`、`/insights/tmall/{brand-sessions,promotion-layers,live-promo-link}`、`/insights/xiaohongshu/{buyer-profile,dandelion,traffic-sources}`、`/insights/wechat/{affiliate,content}` |
| `pages/shop/tmall/` 目录 | **0 个文件** | **空目录**——天猫 3 个平台专属路由全走通用壳 |

**关键判定**：10 条通用壳路由的后端端点全部 **200 且有数据**（实测 `/insights/douyin/three-pools` 1,092B、`/tmall/promo-compare` 2,558B、`/insights/taobao/three-sources` 2,039B、`/insights/xiaohongshu/buyer-profile` 1,810B、`/wechat/affiliate` 708B…），所以**不是空壳**；但它们是"一个模板灌 10 个平台"，**不存在"针对各平台底层逻辑深度定制"这件事**（README 宣传语）。客户若按 README 期待"抖音三池 / 快手公私域 / 淘宝三源 / 小红书蒲公英"各自独立的产品形态，会看到 **10 个长得一模一样的表格页**。

**额外的可信度问题**：`GET /insights/xiaohongshu/buyer-profile` 返回 `range: {"from":"","to":""}` —— 日期区间是空的（其他 9 个都有值），说明这条配置漏传了 range。

---

## 4) 模块闭环判定

判定标准：
- **可用** = 数据有、接口通、页面能看、读写链路完整
- **半可用** = 骨架通但有断点（空数据 / 口径错 / 需人工补）
- **壳** = 只有页面和接口，无真实数据或无业务逻辑
- **坏** = 关键环节 4xx/5xx 或数据错误

| # | 模块 | 判定 | 关键证据 |
| :-- | :--- | :--- | :--- |
| 1 | **选品** | **半可用** | `GET /selection/recommendations` 200，返回 `SEL-20261116-QD9G / APPAREL / douyin / 杭州 / weather_led`；表 `fact_selection_recommendation` **97 行**、`fact_selection_item` **277 行**。但 `ai_v2_llm_call=0` + `AI_ENABLED=false` → **推荐结果是预置的，非在线生成**；`GET /selection/products`、`/selection/items` 均 **404**（子资源端点缺失） |
| 2 | **排品** | **可用（但无真实闭环）** | `GET /ops/session-plans` 200，返回 103 条计划（`id=103, room=抖音主营旗舰店-1号直播间, planDate=2026-11-25, anchor=沈知夏`）；`session_plans` **103 行**、`session_plan_products` **18,143 行**（货盘分层齐全）。**断点**：`session_staff_assignments` **0 行** → 排品计划无法关联"谁上场"，排品与排班两条链**没接上** |
| 3 | **商品库** | **半可用** | `GET /inventory/products` 200，`totalSkus=66 / totalSpus=59 / totalOnHand=21,000 / totalAvailable=18,873 / totalStockValue=2,985,869`；`dim_product` **66 行**、`dim_sku_mapping` **1,320 行**。**断点**：`dim_product_channel_listing` 仅 **31 行**，而店铺有 **21 个** → 平台铺货映射覆盖不足；`GET /products`、`/shop/products` 均 **404**（无全局商品列表端点，只能按店查） |
| 4 | **销售数据** | **半可用（数字不可信）** | 接口通、页面通、`canonical_orders` **32,400 行** + `fact_trade_daily` **18,630 行**。但：① `fact_trade_daily` **100% `is_demo=true` / `source='demo'`**；② **6 个平台完全等量**（每平台 5,400 单 / 每日恰好 180 单）；③ 数据**截止 2026-11-12**，今日 11-16，**滞后 4 天**，无增量入库 |
| 5 | **转化数据** | **可用（结构最完整）** | `session_channel_metrics` **25,740 行**、`agg_traffic_day_live` 7,208、`session_overview_metrics` 2,160、`session_live_basic_info` 2,160；`/review/*` 带参全部 200，漏斗 5 层（曝光 10,726 → 观看 5,363 → …）。**这是全系统唯一一条端到端数据链**（场次 → 渠道 → 漏斗 → 商品 → 短视频） |
| 6 | **投放** | **半可用** | `fact_ad_spend_daily` 2,160 行；`/taobao/shop/{id}/ad-reconciliation` 200（`adPlatform.spend=102,840.08, roi=3.35` vs `merchant.gmv=1,370,547, roi=13.33`）；`/kuaishou/shop/{id}/ad-roi` 200（`netRoi=2.14`）。**断点**：`/bi/dashboard` 的 `platforms[].roi` **全部为 0** |
| 7 | **履约** | **半可用** | `fact_fulfillment_waybill` **810 行**、`fact_after_sale_tickets` **810 行**、`fact_inventory_ledger` **4,871 行**、`fact_inventory_reservation` **50 行**；`/ops/fulfillment`、`/ops/after-sales` 页面可用。**断点**：`platform_sla_config` 仅 25 行（6 平台 × 多档 SLA 不足） |
| 8 | **财务** | **壳** | `fact_gl_entry` **56 行**、`fact_gl_voucher` **28 行**、`fact_settlement_cycles` 1,620 行。56 条凭证对应 3.2 万订单 → **凭证核销链路基本没跑**；`reconciliation_runs` **0 行** → **对账从未执行过一次** |
| 9 | **AI** | **壳（预制结果冒充智能）** | `ai_v2_run` 1,578 / `ai_v2_step` 2,266 / `ai_v2_claim` 10,897 / `ai_v2_evidence` 27,195，但 **`ai_v2_llm_call` = 0 行**，`ai_config` **0 行**、`ai_context_bindings` **0 行**、`ai_action_approvals` **0 行**；`.env` **`AI_ENABLED=false`**。`ai_conversations` 仅 4 条、`ai_messages` 8 条 → **对话几乎无人用过** |
| 10 | **排班** | **壳** | `staff_day_status` 2,369 行、`live_registrations` 5,940 行存在，但 **`session_staff_assignments` = 0 行** → 排班到"哪个人哪场戏"的关键表是空的；`/anchors/live-schedule`、`/anchors/my-schedule`、`/anchors/schedule`、`/anchors/schedule-recommend` 四个入口页面都在，但**底下没有一条真正的"场次-人员"绑定数据** |

### 4.1 用户最关心的 5 条链：到底闭环没有

| 链路 | 闭环？ | 一句话结论 | 决定性证据 |
| :--- | :--- | :--- | :--- |
| **选品 → 排品** | ❌ **没闭环** | 选品有 97 条推荐、排品有 103 个计划，但**两者之间没有外键 / 引用**；`fact_selection_item`(277) 与 `session_plan_products`(18,143) 互不相认 | 选品推荐结果无法"一键进排品"，页面只能 `navigate('/ops/session-products')` 跳过去让用户手填（`SelectionPage.tsx:404`） |
| **排品 → 销售** | ⚠️ **单向可查** | 能按场次查商品 / 销售（`/review/products?room_id&date` 200），但**排品计划与真实销售的字段级归因缺失**：`session_plan_products.product_code` 大量为空字符串 | 实测 `GET /review/products` 返回首行 `{"product_code":"","price":"0.00","plan_id":null}` |
| **销售数据** | ⚠️ **能算但不可信** | 4 个"总 GMV"互相对不上；且底层 100% demo | 见 4.2 |
| **转化数据** | ✅ **闭环最好的一条** | 场次 → 渠道 → 漏斗 → 商品 → 短视频全链有数，`/review/*` 全部实测 200 | 漏斗曝光 10,726 → 观看 5,363，转化率 50%，有 dropRate |
| **商品库** | ⚠️ **单点可用、跨平台断** | 66 SKU 主数据 + 库存台账可用；平台铺货映射只覆盖极小部分 | `dim_product_channel_listing=31` vs `dim_shop=21`，平均每店不到 1.5 条铺货记录 |

### 4.2 「同一个 GMV，四个数」——口径实测

同一租户（`tenant_id=1`）、同一近似时间窗，系统里能查到 **4 个不同的 GMV**：

| 来源 | 数值 | 口径 | 实测命令 |
| :--- | ---: | :--- | :--- |
| `GET /omnichannel/overview`（30 天） | **22,779,009.38** | `fact_trade_daily` 按平台默认 `amount_type`（gross_paid） | `curl …/api/v1/omnichannel/overview` |
| `GET /bi/dashboard`（近 7 天） | **1,250,270.82** | `session_live_basic_info.payment_amount`（**仅直播场次**，非全渠道） | `curl …/api/v1/bi/dashboard` |
| `SELECT SUM(gmv) FROM fact_trade_daily`（30 天，**裸 SUM**） | **55,142,352.18** | 未按 `amount_type` 过滤 → 6 种口径重复累加 | `psql -c "select sum(gmv) from fact_trade_daily where biz_date between '2026-10-18' and '2026-11-12'"` |
| `SELECT SUM(paid_amount) FROM canonical_orders`（同区间） | **17,054,764.00** | 订单明细原始金额 | 同上 |
| `GET /overview/stats`（今日） | 177,797.33 | 当日 | `curl …/api/v1/overview/stats` |

**这 4 个数本身不是 bug（口径不同），但系统没有任何"口径说明"**：页面上不显示口径标签。`/bi/dashboard` 的前端把万元当万元渲染是对的（`BiDashboardPage.tsx:56` `(total_gmv/10000).toFixed(0)` + `万`），但客户看到"全渠道 2277 万"和"BI 大盘 125 万"会直接质疑系统算错。

**`amount_type` 6 种口径实测分布（这是理解全系统的钥匙）**：

| amount_type | 行数 | 30 天 GMV | 说明 |
| :--- | ---: | ---: | :--- |
| `gross_paid` | 7,020 | 22,679,480.66 | 付款总额（平台默认口径） |
| `gross_settled` | 4,590 | 15,038,924.79 | 结算总额 |
| `net_settled` | 3,510 | 9,316,208.52 | 净结算 |
| `indirect_included` | 1,350 | 3,950,369.17 | 含间接成交（快手） |
| `onsite` | 1,080 | 2,355,842.40 | 站内 |
| `offsite` | 1,080 | 1,801,526.64 | 站外 |

> ⚠️ **给后续开发者的红线**：任何新写的 `fact_trade_daily` 聚合 SQL，**必须** `JOIN platform_caliber_config` 或显式写 `AND amount_type = '<口径>'`。漏写 → 数值放大 **2.43 倍**（55,142,352 / 22,679,481）。

---

## 5) 数据现状与死表清单

### 5.1 数据真伪（**本次审计最重要的发现之一**）

| 检查项 | 实测结果 | 命令 |
| :--- | :--- | :--- |
| `fact_trade_daily` 中 `is_demo=true` 占比 | **18,630 / 18,630 = 100%** | `select count(*) filter (where is_demo), count(*) from fact_trade_daily` |
| `fact_trade_daily` 中 `source='demo'` 占比 | **100%** | `select source, is_demo, count(*) from fact_trade_daily group by 1,2` |
| `canonical_orders` 平台分布 | **6 个平台，每个恰好 5,400 单 / 30 天 / 每日恰好 180 单** | `select source_platform,count(*),count(distinct biz_date),count(*)/count(distinct biz_date) from canonical_orders group by 1` |
| 每平台 GMV（同区间） | 2,841,104 / 2,841,254 / 2,840,934 / 2,844,874 / 2,842,484 / 2,844,114 —— **6 个数差 < 0.15%** | 同区间分组求和 |
| 数据新鲜度 | `fact_trade_daily` / `canonical_orders` / `fact_ad_spend_daily` / `fact_search_keyword_daily` **最大 `biz_date` = 2026-11-12**，今日 2026-11-16 | `select max(biz_date) from …` |

**判定**：全部经营数据是**合成种子数据**，且合成方式过于规整（平台间等量、每日等量），**不具备任何业务真实性**。系统当前只能做功能演示，不能做经营决策。

> 注：`fact_trade_daily.source_code` 在 2026-11-15 旧审计中被判为"全表 NULL"，**今日实测 NULL 率 = 0%**（已修复，见第 6 节）。

### 5.2 关键业务表行数（精确 `count(*)`，完整 240 行见 `_evidence/table_rowcounts.txt`）

| 表 | 行数 | 判定 |
| :--- | ---: | :--- |
| `canonical_orders`（分区合计） | 32,400 | ✅ 有数（demo） |
| `canonical_order_items`（分区合计） | 64,800 | ✅ 有数（demo） |
| `session_channel_metrics` | **25,740** | ✅ 转化链路主表，最扎实 |
| `fact_trade_daily`（8 分区合计） | 18,630 | ⚠️ 有数但全 demo + 6 口径并存 |
| `session_plan_products` | **18,143** | ✅ 排品货盘 |
| `agg_traffic_day_live` | 7,208 | ✅ |
| `agg_trade_day_platform_channel` | 7,020 | ✅ |
| `live_sessions` | **5,940** | ✅ 场次骨架 |
| `live_registrations` | 5,940 | ✅ |
| `fact_inventory_ledger` | 4,871 | ✅ 库存台账 |
| `platform_members_summary` | 4,860 | ✅ |
| `fact_search_keyword_daily` | 4,860 | ✅ 搜索词 |
| `session_overview_metrics` / `session_live_basic_info` | 2,160 / 2,160 | ✅ |
| `fact_ad_spend_daily` | 2,160 | ✅ 投放 |
| `staff_day_status` | 2,369 | ✅ 考勤 |
| `fact_settlement_cycles` | 1,620 | ⚠️ 有数但下游空 |
| `dim_sku_mapping` | 1,320 | ✅ |
| `session_anchor_metrics` | 960 | ✅ |
| `fact_fulfillment_waybill` / `fact_after_sale_tickets` | 810 / 810 | ✅ 履约 |
| `fact_cs_session` | 720 | ✅ 客服 |
| `fact_selection_item` | **277** | ⚠️ 选品明细偏少 |
| `fact_kol_cooperation` | 240 | ✅ |
| `platform_capability_matrix` | 198 | ✅ |
| `agg_shop_daily` | 141 | ⚠️ 应有 21 店 × 30 天 ≈ 630 |
| `fact_inventory_stock` | 132 | ⚠️ 66 SKU × 2 仓 |
| `script_library` | 116 | ✅ 话术库 |
| `session_plans` | **103** | ✅ 排品计划 |
| `fact_selection_recommendation` | **97** | ⚠️ 选品推荐 |
| `overview_daily_stats` | 90 | ✅ |
| `dim_product` | **66** | ⚠️ 5 平台 21 店只有 66 个 SKU |
| `fact_gl_entry` / `fact_gl_voucher` | **56 / 28** | ❌ 财务凭证严重不足 |
| `fact_inventory_reservation` | 50 | ⚠️ 锁库记录偏少 |
| `anchors` / `anchor_profiles` | 36 / 36 | ✅ |
| `dim_product_channel_listing` | **31** | ❌ 平台铺货映射缺失 |
| `platform_sla_config` | 25 | ⚠️ |
| `room_health` / `multi_room_status` | 24 / 24 | ⚠️ |
| `improvement_tasks` | 20 | ✅ |
| `xhs_note` / `kuaishou_fans_ops` | 5 / 5 | ⚠️ 小红书 / 快手专属表近乎空 |
| `issue_library` / `goal_tracking` | **4 / 4** | ⚠️ 问题库、目标追踪各 4 条 |
| `anchor_script_templates` / `anchor_training_plans` | 4 / **3** | ⚠️ |
| `users` | 32（**其中 27 个是 `__s2_admin_*` / `__t_*` / `__probe_op` / `__bv_test` 测试残留**） | ❌ 测试污染 |
| `ai_conversations` / `ai_messages` | 4 / 8 | ❌ AI 几乎无人用 |

### 5.3 死表清单（`count(*) = 0`，共 **86 / 240 = 35.8%**）

**A. 业务死表（建了但功能从未跑过）—— 22 张，这是"建了没跑"的核心证据**

| 表 | 应当谁写 | 实际后果 |
| :--- | :--- | :--- |
| `session_staff_assignments` | 排班 → 场次人员 | **排班模块无真实绑定数据** |
| `review_actions` | 直播复盘行动项 | 复盘"行动项"永远空 |
| `reconciliation_runs` | 财务对账 | **对账从未执行过** |
| `publish_runs` / `publish_reversals` | 内容发布 | 内容中心未发布过任何内容 |
| `content_assets` / `content_tasks` / `content_providers` | 内容生产 | 内容中心三张主表全空 |
| `data_uploads` / `import_files` / `stg_order_import` / `land_raw_dedup` / `upload_column_mappings` | 数据接入 | **数据上传 / 导入功能从未成功跑通一次** |
| `data_quality_issues` / `dq_quarantine` / `validation_runs` | 数据质量 | 质量页无内容 |
| `cleaning_runs` / `field_mapping_rules` / `entity_aliases` | 数据治理 | 清洗链路未跑 |
| `ai_v2_llm_call` | AI 推理 | **AI 从未真实调用 LLM** |
| `ai_config` / `ai_context_bindings` / `ai_action_approvals` | AI 配置与审批 | AI 无配置、无审批流 |
| `anchor_training_records` | 培训 | 培训记录空 |
| `video_metrics` | 视频数据 | `/content/video-data` 是占位页 |
| `overview_activities` | 首页动态流 | 首页"活动流"空 |
| `overview_daily_stats_archive` | 归档 | 无归档 |
| `data_exports` | 导出 | 无导出记录 |

**B. 结构性空表（未来月份分区，属正常）—— 64 张**
`canonical_orders_y202612`~`y202706`、`canonical_order_items_y202608/09/12`~`y202706`、`canonical_refund_events_*`、`raw_records_*`、`clean_records_*`、`fact_trade_daily_y2026m12/y2027m01/y202702`、`fact_traffic_daily_default` 等，共 64 张未来分区，`count(*)=0` 属预期（`manage-partitions` cron 已预建到 2027-06）。

### 5.4 数据完整性问题

| 问题 | 证据 |
| :--- | :--- |
| **重复店铺** | `dim_shop` 中 `视频号品牌自播旗舰店` 有 **id=7 和 id=23**；`视频号达人带货专营店` 有 **id=8 和 id=24**。`/api/v1/platforms` 返回的 wechat 店铺顺序是 `23,24,7,8,9`，即**前端默认选中 id=23 这个重复店** |
| **平台授权形同虚设** | 21 店中 **20 店 `auth_status='manual_only'`**，仅 1 店 `authorized` |
| **`finance` 角色不存在** | `users.role` 的 CHECK 约束枚举 15 种角色，**无 `finance`**；`finance_chen` 实为 `admin` |
| **测试数据污染** | `users` 32 行中 27 行是测试残留（`__s2_admin_1794656124276_b5c024` 等）；`__bv_test`（brand_viewer）`status=0` 已禁用 |
| **`agg_shop_daily` 覆盖不足** | 141 行 vs 应有 ≈ 21 店 × 30 天 = 630 行 |
| **`platform_sla_config` 25 行** | 6 平台 × 多档 SLA 明显不足 |

---

## 6) 与 2026-11-15 旧审计的差异（哪些旧结论已失效）

旧文档：`docs/audit-2026-11-15/00-MASTER-AUDIT-REPORT.md`（284 行，含 3 个"最致命结构性问题"）。

| # | 旧审计结论（2026-11-15） | 今日实测（2026-11-16） | 状态 |
| :-- | :--- | :--- | :--- |
| 1 | 🔴 `fact_trade_daily.source_code` **全表为 NULL** → 所有渠道归因静默失效 | `select count(*) filter (where source_code is null)` = **0 / 18,630 = 0.0%** | ✅ **已修复，旧结论失效** |
| 2 | 🔴 **裸 `SUM(gmv)` 放大 2.37 倍**，各平台倍数不等 → 平台排名反转 | 所有平台查询已改为 `AND f.amount_type = pcc.amount_type`（`kuaishou-analytics.ts:54`、`taobao-analytics.ts:81/211`，注释标 `P0-B-2: fail-closed`），经 `platform_caliber_config` 取默认口径 | ✅ **已修复，旧结论失效**；但"裸 SUM"陷阱仍存在于任何新写的 SQL（6 种 `amount_type`，不筛选放大 **2.43 倍**） |
| 3 | 🔴 `is_demo` 与 `source` 逻辑互斥，需老大定性 | 现在**完全一致**：18,630 行全部 `is_demo=true` 且 `source='demo'` | ✅ **一致了，但定性问题变成新问题**：现在是"100% 演示数据"，不是"混合" |
| 4 | 🔴 权限"模型写对了，但**没接上电**" | `hr_li` 实测 **147 个 403**、`operator_wang` **82 个 403**，403 body 带 `module` 字段与中文可读文案；`hr_li` 仅 82 个端点 2xx | ✅ **已修复，旧结论失效** |
| 5 | AI"查询型真，生成型假" | **更严重了**：`ai_v2_llm_call = 0` 且 `AI_ENABLED=false`；但 `ai_v2_evidence` 已有 **27,195** 行伪造证据链、`ai_v2_claim` 10,897 行 | ⚠️ **旧结论仍成立且恶化** |
| 6 | 主流程"无一步贯通" | 部分贯通：转化链路（场次 → 渠道 → 漏斗 → 商品 → 短视频）已闭环且全 200；但**选品 → 排品仍无外键**、`session_staff_assignments=0` | ⚠️ **部分失效**：转化闭环成立，选品 / 排班闭环仍不成立 |
| 7 | （旧文档未提） | **本次新增**：`/wechat/shop/{id}/overview`、`/tmall/shop/{id}/overview` **店铺过滤被静默丢弃**（6 处 `Number.isFinite(string)` bug） | 🆕 新发现 |
| 8 | （旧文档未提） | **本次新增**：OpenAPI 文档漂移 **6 条**（文档有、代码无，运行态 404） | 🆕 新发现 |
| 9 | （旧文档未提） | **本次新增**：README 演示账号 **3/8 不存在** | 🆕 新发现 |
| 10 | （旧文档未提） | **本次新增**：`pm2` 中 `leyova-api` 累计重启 **80 次** | 🆕 新发现 |
| 11 | 计数口径 | 旧文档按"52 路由文件 / 96 页面"统计——**与今日实测一致**，口径未漂移 | ✅ 有效 |

**一句话总结差异**：昨天报的 3 个 P0 里，**2 个（`source_code` NULL、裸 `SUM`）今天已经修好，第 3 个（权限没通电）也修好了**——工程侧的修复执行力是真实的。**但"数据是假的"这个更根本的问题昨天没被摆到台面上，今天必须摆上来**：修完 SQL 口径，底下仍然是 100% demo 数据。

---

## 7) 冗余与业务分组不贴合的具体清单

### 7.1 双份路由（同一页面挂两个 URL）—— **7 组 14 条路由**

| 视图路由 | 独立路由（`/standalone`） | 重复情况 |
| :--- | :--- | :--- |
| `/overview/cockpit` | `/overview/cockpit/standalone` | 同一 `CockpitPage` |
| `/omnichannel/dashboard` | `/omnichannel/dashboard/standalone` | 同一 `OmniDashboardPage` |
| `/bi/dashboard` | `/bi/dashboard/standalone` | 同一 `BiDashboardPage` |
| `/anchors/live-schedule` | `/anchors/live-schedule/standalone` | 同一 `LiveScheduleCalendarPage` |
| `/anchors/schedule` | `/anchors/schedule/standalone` | 同一 `ScheduleManagementPage` |
| `/anchors/my-schedule` | `/anchors/my-schedule/standalone` | 同一 `MySchedulePage` |
| `/anchors/schedule-recommend` | `/anchors/schedule-recommend/standalone` | 同一 `ScheduleRecommendPage` |

**证据**：`pages/bi/UnifiedDashboardHub.tsx` 与 `pages/ops/schedule/UnifiedScheduleHub.tsx` 都用 `lazy(() => import('@/pages/xxx'))` 把独立页原样挂进去。
**建议**：保留视图路由，删掉 7 条 `/standalone`（或反之），并在 `App.tsx` 加 `<Navigate>` 兼容旧链接。

### 7.2 该合并的模块

| 建议 | 依据 |
| :--- | :--- |
| **`/overview/*` 与 `/bi/*` 合并** | `overview` 6 页 + `bi` 4 页 = 10 个"看数"页面，其中 `CockpitPage`(389) 与 `BiDashboardPage`(341) 都是 GMV / 订单 / 退款 / 趋势四件套，只是口径不同（全渠道 vs 仅直播）。合并为 1 个带口径切换器的大盘 |
| **`/data/*` 5 页合并为 2 页** | `DataManagementPage(345)` / `DataUploadPage(741)` / `UploadedDataPage(387)` / `DataQualityPage(1179)` / `IngestWizardPage(744)` 共 3,396 行，却共享同一批空表（`data_uploads` / `import_files` / `data_quality_issues` 全 0 行）。建议合并为「数据接入」+「数据质量」2 页 |
| **`/anchors/*` 16 条路由收敛** | `anchors` 16 条路由里 8 条是排班（`live-schedule` / `schedule` / `my-schedule` / `schedule-recommend` 各 2 条）。建议 4 条视图路由 + 删 4 条 standalone |
| **`/ops/*` 14 页按业务重组** | 现在 `ops` 下混装 12 个互不相关的业务域：能力矩阵、话术库、问题库、目标追踪、直播间健康、场次排品、库存中心、履约 SLA、售后、达人合作、客服、Net-ROI、搜索词、会员。**这正是"业务分组不贴合"最严重的地方**——一个"运营提效"菜单里塞了供应链（库存 / 履约）、客服、财务（Net-ROI）、SEO 4 个不同岗位的东西 |
| **`/insights/*` 14 条 → 10 条通用壳建议直接删除** | 10 条路由共用 34 行 `PlatformInsightPage`，后端 10 个端点数据可由 1 个 `/insights/:platform/:dimension` 参数化路由承载。删 10 条路由、保留 4 条有独立实现的（`douyin/short-video`、`taobao/shop-session`、`xiaohongshu/note-live`、`wechat/private-public`） |

### 7.3 该删除的死代码

| 对象 | 证据 |
| :--- | :--- |
| `pages/anchors/UnifiedScheduleHub.tsx`（3 行） | 纯 re-export 别名，`grep -rn "pages/anchors/UnifiedScheduleHub"` **零引用** |
| `pages/overview/HomePage.tsx`（200 行） | `App.tsx` 未引入，已被 `PlatformAwareHomePage` 取代 |
| `pages/shop/tmall/` 空目录 | `ls pages/shop/tmall/` → **空**，但 `pages/shop/` 下 14 个文件是"平台专属页"的主体 |
| `components/overview/PerformanceLeaderboard.tsx` 的 2 个 fetch | 调 `/api/v1/anchors/rankings`、`/api/v1/agency/projects`，**两者均 404**，被 `if (res.ok)` 静默吞掉 |
| `dim_shop` 中 id=23 / 24 | 与 id=7 / 8 同名重复店铺，且是前端 wechat 默认选中项 |
| `users` 表 27 个 `__*` 测试账号 | 应从生产库清除（需 DDL，本审计未动） |

### 7.4 该补齐的空壳（比删更急）

| 缺口 | 现状 | 影响 |
| :--- | :--- | :--- |
| `/selection/products`、`/selection/items` | 前端不调、后端 404、文档未写 | "选品"没有选品明细接口 |
| `/products`、`/shop/products` 全局列表 | 404 | 商品库只能按店查，无法跨平台看总盘 |
| `session_staff_assignments` | 0 行 | 排班模块是"有页面无数据" |
| `reconciliation_runs` | 0 行 | 财务对账从未跑过 |
| `content_assets` / `content_tasks` | 0 行 | 内容中心 3 张主表全空，`VideoCreatePage` / `VideoDataPage` 是"正在开发"占位 |
| `ai_v2_llm_call` | 0 行 + `AI_ENABLED=false` | AI 全部是预制结果 |
| `platforms/*/oauth` 真实 appKey | 20/21 店 `manual_only` | 无法自动取数，全靠手工导 |
| `dim_product_channel_listing` | 31 行 vs 21 店 | 平台铺货映射断链 |

### 7.5 平台专属页冗余度小结

| 指标 | 数值 |
| :--- | ---: |
| 平台专属路由 | 24 |
| 承载页面文件 | 15 |
| 其中独立实现 | 14 |
| 其中配置驱动通用壳 | 1（服务 10 条路由） |
| 空目录 | 1（`pages/shop/tmall/`） |
| 平均每页行数 | 约 200 行 |
| 后端平台专有路由文件 | 8（`douyin/taobao/tmall/kuaishou/wechat/xiaohongshu/platform-dedicated/platform-insights`，合计 2,091 行） |

---

## 附：值得肯定之处（重构时别改坏）

1. **RBAC + 模块守卫是真的可用**：`module-guard.ts` 按路由前缀映射模块，403 带 `module` 字段与中文文案，4 个角色实测 82–212 个不同可见端点，收敛干净。这是全系统质量最高的部分。
2. **`shop-guard.ts` 的跨平台校验是对的**：拿 douyin 的 shop_id 去查 kuaishou 会明确报"店铺 #1 属于 douyin，与目标平台 kuaishou 不匹配"，而不是返回脏数据。
3. **`amount_type` 口径模型设计正确**（6 种口径 + `platform_caliber_config` 配置 + 查询侧 `fail-closed` 关联），这是很难得的严谨设计。
4. **转化链路（`/review/*`）是全系统唯一端到端闭环**：场次 → 渠道 → 漏斗 → 商品 → 短视频，21 张表、25,740 行渠道指标，带参全部 200 且数据自洽。
5. **OpenAPI 419 条文档 + 406 条注册路由的高度一致**（仅 6 条漂移），说明有人认真维护契约。
6. **240 张表的分区设计专业**：`fact_trade_daily` / `canonical_orders` / `raw_records` / `clean_records` 均按月分区且有 `manage-partitions` cron，未来分区已预建到 2027-06。

---

## 审计边界（如实声明）

1. 本次**只读**：未验证任何写操作（POST/PUT/DELETE）的业务正确性，仅验证了它们的路由存在性，以及 178 个前端实际调用的读接口的返回。
2. **未做浏览器 E2E**：页面"可用"判定基于「该页所有 GET 调用实测 2xx 且有数据 + 代码行数 + 是否挂载」，不等于像素级渲染正确。
3. **未查 pm2 重启根因**：80 次重启是观测事实，未读 `logs/` 定位原因，建议另派任务。
4. `pg_stat_user_tables.n_live_tup` 有延迟，本报告所有行数均为 `count(*)` 精确值（`_evidence/table_rowcounts.txt`）。
5. `/mcp` 端点 401 未计入故障（设计需要 token）。
6. 未触碰 `/home/leyova/.pgdata`、未改 `.env`、未 restart 任何服务、未 `git commit`、未写入任何业务表。

---

## 证据索引

| 文件 | 内容 |
| :--- | :--- |
| `_evidence/openapi.json` | 运行态 OpenAPI 全量快照（345 path / 419 op） |
| `_evidence/probe_admin.json` | admin 242 个 GET 的逐条实测结果（状态 / 耗时 / 字节 / 响应片段 / 是否空） |
| `_evidence/probe_manager_liu.json` / `probe_operator_wang.json` / `probe_hr_li.json` | 其余 3 角色同口径结果 |
| `_evidence/shop_scoped.tsv` | 48 个店铺维度端点的正确 shop_id 复测原始输出 |
| `_evidence/insights_probe.txt` | 10 个平台专属洞察端点原始输出 |
| `_evidence/frontend_api_paths.json` | 272 个前端 `(method,path)` 调用点 + 所属文件 + 是否在 OpenAPI |
| `_evidence/probe_frontend_calls.json` | 178 个前端真实 GET 调用的实测结果 |
| `_evidence/route_crosscheck.json` | 406 条后端注册路由 + 4 条静态死链判定 |
| `_evidence/page_audit.json` | 96 页面 × 107 路由挂载关系 / 行数 |
| `_evidence/page_classification.json` | **96 页面四档分类 + 每页每个接口的实测状态码** |
| `_evidence/table_rowcounts.txt` | 240 张表精确 `count(*)` |

> 复现方式：`cd /home/leyova/docs/audit-2026-11-16/_evidence && node probe_endpoints.mjs admin && node page_audit_final.mjs`
