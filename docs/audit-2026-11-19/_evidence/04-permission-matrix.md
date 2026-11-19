# 权限矩阵实测（2026-11-19）

测试账号初始密码统一为 `Admin@123456`（既有演示账号，只读探针，不写任何数据）。

## 1. DB 实际角色（roles 表，8 个）
```
super_admin, ops_director, ops_staff, controller, hrbp, ad_buyer, video_editor, cs_agent
```

## 2. 代码里硬编码但 DB 中不存在的角色
| 位置 | 硬编码值 |
|---|---|
| `apps/web/src/components/layout/Layout.tsx:77` | `['super_admin', 'finance', 'controller']` |
| `apps/web/src/components/layout/Layout.tsx:78` | `['operator', 'ops_director', 'ops_staff']` |
| `apps/web/src/components/layout/Layout.tsx:79` | `['finance', 'controller']` |
| `apps/web/src/components/auth/RequireAiOpsAccess.tsx:17-25` | `['super_admin','admin','operator','ops_director','ops_staff','finance','controller','hrbp']` |
| `apps/web/src/components/auth/RequireAiOpsAccess.tsx:28-31` | `['super_admin','finance','controller']` |

**`admin` / `operator` / `finance` 三个角色在 DB 中不存在。**

## 3. 真实账号的角色归属
| 账号 | 实际角色 |
|---|---|
| admin | super_admin |
| manager_liu | ops_director |
| director_zhou | ops_director |
| operator_wang | ops_staff |
| staff_lin | ops_staff |
| finance_chen | **ad_buyer**（不是 finance） |
| buyer_xu | ad_buyer |
| hr_li | hrbp |
| video_lin | video_editor |
| cs_qian | cs_agent |
| ctrl_douyin / ctrl_taobao / ctrl_xhs / ctrl_wechat / ctrl_wu | controller |

## 4. 权限错配的四个后果（已实测）

### 后果 A：中控能进财务页
`FINANCE_ALLOWED_ROLES = ['super_admin', 'finance', 'controller']` → controller 在列。
`/ai-ops/finance/pnl`、`/ai-ops/finance/settle` 对中控可见。
（注：`/sessions/:id/pnl` 服务端有 `costMasked` 脱敏，中控读到的是 `costMasked: true`，
但 AI-Ops 财务页面前端只做角色门，`AiOpsFinanceSettlePage` 是纯硬编码展示。）

### 后果 B：真财务被挡在财务页外
`finance_chen` 角色是 `ad_buyer`，不在 `FINANCE_ALLOWED_ROLES` → 打不开 P&L / 结算对账。

### 后果 C：三个角色完全进不了 AI-Ops
`AI_OPS_ALLOWED_ROLES` 不含 `ad_buyer` / `video_editor` / `cs_agent`
→ 投手、拍剪、客服后端访问任何 `/ai-ops/*` 都被 `RequireAiOpsAccess` 拦截成 403 页。

### 后果 D：isOpsUser 名不副实
`Layout.tsx:78` 含 `ops_director`/`ops_staff`（这两个 DB 有），但 `operator` 不存在 → 实际只有 super_admin 命中。

## 5. 中控（ctrl_douyin）对 AI-Ops 数据端点的访问实测
| 端点 | 归属模块 | HTTP | 说明 |
|---|---|---|---|
| GET /overview/sessions | session | **200** | 中控有 session 只读 |
| GET /anchors | anchor | **200** | 中控有 anchor 只读 |
| GET /sessions/102/pnl | session | **200** | costMasked=true（服务端脱敏） |
| GET /system/tasks | system_tasks | **403** | 中控未授权 |
| GET /ai/pending-approvals | ai | **403** | 中控未授权 |
| GET /alerts/events?status=pending | overview | **403** | 模块映射缺陷（见下） |

→ 中控能进 AI-Ops，但 6 个核心数据源里 3 个 403，前端静默失败后展示硬编码假数据。

## 6. /alerts/events 的模块映射缺陷
`apps/api/src/lib/module-guard.ts:83` 把 `/api/v1/alerts` 映射到 `overview` 模块。
但「实时告警流」页面对应的导航模块是 `system_alerts`（route-manifest.ts:84）。
→ 有 `system_alerts` 但没 `overview` 的角色（如中控若被授予 system_alerts）会 403；
  有 `overview` 但没 `system_alerts` 的角色反而能读告警。映射与业务语义不一致。

## 7. module-guard 漏配路径（非管理角色必 403）
`MODULE_MAP` 72 条前缀 vs 全仓 267 个 `/api/v1/*` 路径，未匹配 7 个：
```
/api/v1/assortment/recommend
/api/v1/assortment/explain/:productId
/api/v1/finance/accounting-subjects
/api/v1/metrics
/api/v1/scripts/templates
/api/v1/weather/cities
/api/v1/weather/recommendation
```
`module-guard.ts:212-219` fail-closed：未声明路径一律 403（admin/ops_director/super_admin 在 `:201-205` 被放宽，所以只有非管理角色受害）。

实测（operator_wang = ops_staff）：
```
GET /api/v1/scripts/templates  → 403 {"reason":"路径 /api/v1/scripts/templates 未在模块映射表中声明，按 fail-closed 拒绝"}
GET /api/v1/metrics            → 403
GET /api/v1/finance/accounting-subjects → 403
```
→ **「话术库」页（/ops/script-library）对运营专员完全不可用。**

另：`/api/v1/weather/*` 两条路由前端页面已在 commit 4c97ec2 删除，后端仍注册（`app.ts:205`），是孤儿路由。

## 8. 管理角色放宽（module-guard.ts:199-205）
```ts
if (utype === 'brand_viewer') return { ok: true }
if (role === 'admin' || role === 'ops_director' || role === 'super_admin') return { ok: true }
```
注意 `admin` 在 DB 中不存在，实际生效的是 `ops_director` + `super_admin`。
→ ops_director 以上不看模块授权，模块权限页面对他们只是「约束到某个平台/子域」。
