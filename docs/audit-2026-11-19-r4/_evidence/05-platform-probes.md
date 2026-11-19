# 证据 05 · 平台切换与能力实测

> 采集时间：2026-11-19 06:35 UTC

## 1. `/auth/me` 的实际结构

字段：`data.access.modules`、`data.access.modulesByPlatform.{douyin,kuaishou,wechat,taobao,tmall,xiaohongshu}`。

| 账号 | 角色 | modules 数 | 六平台模块数组 distinct 数 | 签名 |
|---|---|---:|---:|---|
| ctrl_douyin | controller | 6 | **1** | `a9923283…` |
| ctrl_taobao | controller | 6 | **1** | `a9923283…` |
| ctrl_xhs | controller | 6 | **1** | `a9923283…` |
| ctrl_wechat | controller | 6 | **1** | `a9923283…` |
| admin | super_admin | 41 | **1** | `f1e5879a…` |
| operator_wang | ops_staff | 32 | **1** | `b48f11e6…` |

中控 4 账号模块完全一致：

```
["anchor","live_data","live_registration","personal_achievement","session","session_products"]
```

且 douyin/kuaishou/wechat/taobao/tmall/xiaohongshu **逐字节相同**。

## 2. 数据层证据

| 项 | 结果 |
|---|---|
| `user_platform_permissions` 真实账号行数 | **0**（138 行全部属于 23 个 `__t_ad_buyer_*` 测试账号，每账号 6 平台） |
| `role_platform_permissions` | 48 行（角色×平台），用户级未生效 |
| `GET /api/v1/overview/sessions` 带 `x-leyova-platform: douyin` vs `xiaohongshu` | 响应 **md5 完全相同**（`092f9dac…`），140 场全部返回 |
| `GET /api/v1/sessions/1/pnl`（ctrl_xhs） | **200**，body 含 `platformCode=douyin`、`roomName=抖音主直播间` |

**结论**：平台切换目前是**纯前端展示层概念**。后端既无用户级平台绑定，也不按 `x-leyova-platform` 过滤数据；中控看到的是全平台全量数据。

## 3. `/api/v1/platforms` capabilities 六平台比对

| 平台 | 启用 | shops | capability keys | supportedModules |
|---|---|---:|---:|---|
| douyin | ✅ | 5 | 8 | 10 项（含 `cockpit`,`anchors`） |
| kuaishou | ✅ | 3 | 8 | 与 douyin **完全相同** |
| wechat | ✅ | 5 | 8 | 与 douyin **完全相同** |
| taobao | ✅ | 3 | 8 | 8 项（`shop_overview`,`ops_goals`） |
| tmall | ✅ | 3 | 8 | 与 taobao **完全相同** |
| xiaohongshu | ✅ | 3 | 8 | 7 项（`content_video_data`） |
| jd | ❌ | 0 | 0 | — |
| pdd | ❌ | 0 | 0 | — |

- 六平台 API 载荷去重后仅 **3 种**（抖音系 / 淘宝系 / 小红书）。
- 但 DB `platform_capability_matrix` 对六平台给出**完全相同**的 33 项能力、**0 项 `is_applicable=false`**。
- API 返回的 `supportedModules` 使用 `cockpit`、`anchors`、`ops_goals` 等**旧命名**，与 `system_modules.code`（`overview`/`anchor`/`ops`）不一致，无法被 `module-guard` 使用。

## 4. 平台切换净效果（本轮判定）

- 后端：0 差异（模块集合、数据集合都不随平台变）。
- 前端：仅 `route-manifest.ts` 中 **22/91** 条声明了 `platforms`，理论上最多影响 22 项；`LIVE_ONLY_MODULES` 因上游能力全 true 而不生效。
- 结论：**「切平台」当前不改变任何后端数据与权限，只可能隐藏少量前端入口**；且隐藏逻辑与业务真实差异无关（淘宝/天猫/小红书照样会显示直播相关入口）。
