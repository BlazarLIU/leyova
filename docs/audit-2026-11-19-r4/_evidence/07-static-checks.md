# 证据 07 · 静态计数与代码事实（本轮复核）

> 采集时间：2026-11-19
> 说明：数字均在本轮工作树上重新采集，不转引 dsh / Gemini。

## 1. 规模计数

| 项 | 本轮数字 |
|---|---:|
| `apps/web/src/pages/**/*.tsx` | **122** |
| `apps/web/src/**/*.tsx` | **172** |
| `route-manifest.ts` 中 `href:` | **91**（唯一 90，1 处非单引号写法） |
| `route-manifest.ts` 中 `module:` | **90**（去重 38 个模块码） |
| `route-manifest.ts` 中 `platforms:` | **22** |
| `ai-ops-navigation.ts` 中 `href:` | **30**（唯一 28） |
| `ai-ops-navigation.ts` 中 `module:` | **0** |
| `apps/api/src/routes/*.ts` | **76** |
| 运行时 OpenAPI operations | **442**（`openapi:check` 自报 439，口径不同） |
| 运行时 OpenAPI paths | **359** |
| public 表 | **243** |
| 0 行表 | **123（50.6%）** |

## 2. 角色硬编码（前端）

### `apps/web/src/components/layout/Layout.tsx:66-80`

```ts
const canAccessAiOps = isSuperAdmin || [
  'super_admin','admin','operator','ops_director','ops_staff','finance','controller','hrbp',
].includes(role)

const canAccessFinance = isSuperAdmin || ['super_admin','finance','controller'].includes(role)
const isOpsUser = isSuperAdmin || ['operator','ops_director','ops_staff'].includes(role)
const isFinanceUser = isSuperAdmin || ['finance','controller'].includes(role)
const isHrbpUser = isSuperAdmin || role === 'hrbp'
```

### `apps/web/src/components/auth/RequireAiOpsAccess.tsx:16-32`

```ts
const AI_OPS_ALLOWED_ROLES = ['super_admin','admin','operator','ops_director','ops_staff','finance','controller','hrbp']
const FINANCE_ALLOWED_ROLES = ['super_admin','finance','controller']
```

### 与 DB 的差异

DB `roles` 只有 8 个：`super_admin / ops_director / ops_staff / controller / hrbp / ad_buyer / video_editor / cs_agent`。

| 代码里的角色 | 是否存在于 DB | 后果 |
|---|---|---|
| `admin` | ❌ | 永远匹配不到（除 `super_admin` 外） |
| `operator` | ❌ | 永远匹配不到 |
| `finance` | ❌ | 财务专区对真实财务角色不开放 |
| `ad_buyer` | ✅ | **被 AI-Ops 白名单排除** |
| `video_editor` | ✅ | **被 AI-Ops 白名单排除** |
| `cs_agent` | ✅ | **被 AI-Ops 白名单排除** |

## 3. AI-Ops 假数据（`apps/web/src/services/ai-ops-data.ts`）

26 处命中，关键行：

| 行 | 内容 | 性质 |
|---:|---|---|
| 66 | `} catch { /* 静默失败，使用后备 */ }` | 静默 |
| 75 | `targetGmv: Number(s.gmv) > 0 ? Number(s.gmv) : 120000` | 兜底编造 |
| 192 | `} catch { /* 静默失败，使用后备真实样本 */ }` | 静默 |
| 315 | `} catch { /* 静默失败使用真实聚合 */ }` | 静默 |
| 318 | `const payGmv = Number(sess.gmv || pnl?.gmv) || 142000` | 兜底编造 |
| 336 | `gpm: Number(sess.gpm) \|\| 1850` | 兜底编造 |
| 413 / 447 / 545 / 554 / 589 / 621 / 660 / 700 | `catch { /* 静默失败 */ }` | 静默 |
| 577 | `const gpm = Math.round(1500 + (10 - (i % 10)) * 120)` | **索引数学伪造** |
| 592-595 | 4 个主播 `gpm: 2450/1820/1650/1200`、`netProfitContribution: 124000/76000/51000/22000` | 硬编码 |

## 4. 数据损坏

- `session_plan_products` 446 行，`product_name LIKE '%[object Object]%'` = **417 行（93.5%）**
- 根因：`database/demo/generate.mjs:381` 把对象 `p.cat` 直接模板字符串化
- 影响面：排品编辑、货盘结构、复盘商品分析、`/sessions/:id/slots`

## 5. 测试污染

- `users` 25 个 `__t_*` / `__res_*` 账号
- `dim_shop` 2 个 `__test_oauth_shop`（id 50/56，authStatus=authorized）
- `user_platform_permissions` 138 行**全部**属于测试账号；真实账号 0 行
