# 证据 04 · 写路径校验探针（仅无效载荷）

> 采集时间：2026-11-19 06:35 UTC
> 规则：只发送**必然 4xx 的无效载荷**，确认校验层生效且未落库；不发送合法写请求
> 所有「落库校验」均为探针前后同一张表 `count(*)` 对比

| # | 账号 | 方法与路径 | 载荷 | 状态 | 返回 message | 落库校验 |
|---|---|---|---|---|---:|---|---|
| P1 | admin | POST `/api/v1/sessions` | `{"roomId":999999,"anchorId":999999,"date":"2026-11-19"}` | **400** | `房间或主播不存在` | `live_sessions` 仍 150 |
| P2 | admin | POST `/api/v1/scripts/templates` | `{}` | **400** | `请输入话术标题` | `anchor_script_templates` 仍 0 |
| P3 | admin | POST `/api/v1/after-sales/tickets` | `{}` | **400** | `平台、店铺、订单号、退款类型及原因归因为必填项` | `fact_after_sale_tickets` 仍 24 |
| P4 | admin | POST `/api/v1/system/users` | `{}` | **400** | `用户名不能为空且长度不能超过 50 个字符` | 无新用户 |
| P5 | admin | POST `/api/v1/net-roi/ad-plans` | `{}` | **400** | `缺少必填字段: planName, shopId, platformCode, adToolCode, planDate, plannedBudget` | `ad_plan` 仍 48 |
| P6 | admin | POST `/api/v1/finance/gl-vouchers` | `{}` | **400** | `必须提供凭证日期、凭证类型以及至少两笔复式记账借贷分录` | `fact_gl_voucher` 仍 60 |
| P7 | admin | POST `/api/v1/cs/sessions` | `{}` | **400** | `必须指定客服坐席ID` | `fact_cs_session` 仍 480 |
| P8 | operator_wang | POST `/api/v1/scripts/templates` | `{"title":"probe-invalid-role-test"}` | **403** | `路径 /api/v1/scripts/templates 未在模块映射表中声明，按 fail-closed 拒绝…` | 未进入 handler |

## 判定

- 7 条 handler 级校验均在写库前返回 400，表行数逐项未变；P1 因外键失败回滚，仅序列值可能前进。
- P8 被模块守卫提前拦截 → **话术库写接口对非 admin 角色不可用**（与读接口同样 403）。
- **未验证**：合法载荷的端到端写入、事务回滚、幂等、并发。只读约束下不做。
