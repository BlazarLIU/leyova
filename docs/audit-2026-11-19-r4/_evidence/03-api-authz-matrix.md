# 证据 03 · 登录态接口鉴权矩阵（只读 GET）

> 采集时间：2026-11-19 06:30–06:40 UTC
> 方式：`POST /api/v1/auth/login` 取 Cookie 会话，之后全部 `GET`；未发送任何合法写请求
> 图例：200 正常 / 403 拒绝 / 401 未认证

## 1. 登录结果

| 账号 | 登录 | 说明 |
|---|---|---|
| admin | 200 | |
| operator_wang | 200 | |
| finance_chen | 200 | |
| video_lin | 200 | |
| cs_qian | 200 | |
| hr_li | 200 | |
| ctrl_douyin / ctrl_taobao / ctrl_xhs / ctrl_wechat | 200 | |
| **director_zhou** | **401** | bcrypt 校验：`Admin@123456` 不匹配（哈希长度 60，状态=1） |
| **buyer_xu** | **401** | 同上 |
| **ctrl_wu** | **401** | `users` 表不存在该用户 |

**原因链**：`database/migrations/119_round2_consolidation_and_differentiation.sql:400-409` 写入另一枚哈希 `$2b$10$Aj8G...`，且带 `NOT EXISTS (SELECT 1 FROM users WHERE role=...)` 条件；controller 角色已有 `control_zhao`，故 `ctrl_wu` 永不插入。README 的「统一初始密码 / ctrl_wu 账号」与真实库不一致。

## 2. 状态码矩阵（13 端点 × 9 账号）

| 账号 | me | cockpit | stats | ov/sessions | sessions/1 | scripts | net-roi | finance | metrics | ai/sessions | ai/daily | hrbp | weather |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| admin | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 | 200 |
| operator_wang | 200 | 200 | 200 | 200 | 200 | **403** | 200 | **403** | **403** | 200 | 200 | **403** | **403** |
| finance_chen | 200 | 200 | 200 | **403** | **403** | **403** | 200 | **403** | **403** | **403** | **403** | **403** | **403** |
| video_lin | 200 | **403** | **403** | 200 | 200 | **403** | **403** | **403** | **403** | **403** | **403** | **403** | **403** |
| cs_qian | 200 | **403** | **403** | 200 | 200 | **403** | **403** | **403** | **403** | **403** | **403** | **403** | **403** |
| hr_li | 200 | 200 | 200 | 200 | 200 | **403** | 200 | **403** | **403** | 200 | 200 | **200** | **403** |
| ctrl_douyin | 200 | **403** | **403** | 200 | 200 | **403** | **403** | **403** | **403** | **403** | **403** | **403** | **403** |
| director_zhou | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 |
| buyer_xu | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 | 401 |

对应路径：
- me=`/api/v1/auth/me`，cockpit=`/api/v1/overview/cockpit`，stats=`/api/v1/overview/stats`
- ov/sessions=`/api/v1/overview/sessions`，sessions/1=`/api/v1/sessions/1`
- scripts=`/api/v1/scripts/templates`，net-roi=`/api/v1/net-roi/overview`
- finance=`/api/v1/finance/accounting-subjects`，metrics=`/api/v1/metrics`
- ai/sessions=`/api/v1/ai/sessions`，ai/daily=`/api/v1/ai/daily-report`
- hrbp=`/api/v1/hrbp/overview`，weather=`/api/v1/weather/cities`

## 3. 403 原因分布（原始 message）

| 端点 | 403 原因 |
|---|---|
| `/api/v1/scripts/templates` | `路径 /api/v1/scripts/templates 未在模块映射表中声明，按 fail-closed 拒绝…`（除 admin/ops_director/super_admin 外全部 403） |
| `/api/v1/finance/accounting-subjects` | 同上（未在模块映射表声明） |
| `/api/v1/metrics` | 同上（未在模块映射表声明） |
| `/api/v1/weather/cities` | 同上（未在模块映射表声明） |
| `/api/v1/overview/*` | `当前账号无权访问模块「overview」` |
| `/api/v1/overview/sessions`、`/sessions/:id` | `当前账号无权访问模块「session」` |
| `/api/v1/net-roi/overview` | `当前账号无权访问模块「net_roi」` |
| `/api/v1/ai/*` | `当前账号无权访问模块「ai」` |
| `/api/v1/hrbp/overview` | `当前角色无权访问该功能`（operator_wang/video_lin/ctrl_douyin）；hr_li=200 |

## 4. 无 Cookie 基线

| 端点 | 状态 | 说明 |
|---|---:|---|
| `/api/v1/weather/cities` | 401 | 先被全局 auth-hook 拦截，未到模块守卫 |
| `/api/v1/overview/cockpit` | 401 | 正常 |
| **`/api/v1/metrics`** | **200** | **无需登录返回 Prometheus 指标文本** |

## 5. 重点发现

### A. 有页面入口但接口 403（用户必然撞墙）

1. **话术库**：`route-manifest.ts:150` 声明 `/ops/script-library`，`module:'ops'`、`anyModules:['ops','anchor']` → operator_wang/hr_li/video_lin 都能看到菜单；但 `/api/v1/scripts/templates` 不在 `MODULE_MAP` → 除 admin 类外一律 403。页面 `ScriptTemplatesPage.tsx:78` 用 `.catch(() => {})` 吞错并回退空列表 → **用户只看到「没有话术」，看不到权限错误**。
2. **财务专区**：`App.tsx:167-168` 的 `/ai-ops/finance/pnl|settle` 使用 `requireFinance`，白名单为 `super_admin/finance/controller`（`RequireAiOpsAccess.tsx:28-32`）。但库里无 `finance` 角色，`finance_chen` 实际是 `ad_buyer` → 被前端拦截；`controller` 反被允许。真正的财务 API `/api/v1/finance/*` 未映射模块 → 除 admin/ops_director 外全 403。财务页在 `ai-ops-data.ts:441-461` 失败时**静默回退硬编码数值**（142000 / 14% / 18.42%）。

### B. 无权限却能 200（越权/越界）

1. **`/api/v1/metrics` 匿名可读**（无 Cookie 200），其余端点均 401。若暴露公网即内部指标泄露面。
2. **中控跨平台读取**：`ctrl_xhs` 读 `GET /api/v1/sessions/1/pnl` 返回 **200**，body 明确 `platformCode=douyin`、`roomName=抖音主直播间`；`GET /api/v1/overview/sessions` 返回 **140 场**全平台场次。`ctrl_xhs` 与 `ctrl_douyin` 返回**完全一致**。
3. **会话 P&L 对非财务角色开放**：`video_lin`、`cs_qian`、`ctrl_*` 均 200（`costMasked=true`，但 `gmv/returnAmount/netRevenue` 可见）；`finance_chen` 反而 403（无 session 模块）。
