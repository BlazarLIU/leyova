# Leyova AI 运营系统 — AI 运营系统

> 私有化单机交付：装在客户自己的服务器，数据不出客户网络，离线许可，无控制面。
> 定位：AI + 运营（不是 ERP）。主语是「场」，中心抽象是 Decision Case。

## 快速开始

```bash
pnpm install
export DATABASE_URL=postgresql://leyova@127.0.0.1:55432/leyova_ai_ops
pnpm db:migrate      # 建表（只增不改）
pnpm db:seed         # 岗位 + 27 个指标 + 最小演示数据
pnpm dev             # API  :8790
pnpm dev:worker      # Worker（pg-boss）
pnpm verify          # typecheck + test + 质量红线
```

## 目录

```
src/
  index.ts             API 入口
  worker.ts            Worker 入口
  server.ts            buildApp()
  config.ts  db.ts  errors.ts  ids.ts
  http/
    plugins/           auth / errors / requestId
    routes/            health / auth / members / invitations / metrics / instance / decisions
  kernel/              audit / events / idempotency / files / notify / modules
  identity/            账号·会话·邀请·权限
  metrics/             指标注册表 + 参数化查询
  decision/            Decision Case + 动作回执
db/
  migrations/          NNN_desc.sql（只增不改）
  seeds/               010_roles / 020_metrics / 030_demo
scripts/               verify.mjs（质量红线）
```

## 已完成（O0 地基）

- [x] 工程骨架 + 配置分层 + 错误契约
- [x] 身份系统：手机验证码登录 / 可选密码 / 邀请加入 / 会话管理 / 离职冻结
- [x] 三维权限：岗位 × 范围(brand/store/self) × 对象状态
- [x] 多租户隔离（按实例物理隔离，无 tenant_id）
- [x] 指标注册表：27 个指标，口径版本化
- [x] Decision Case 状态机 + 动作回执
- [x] 事件 outbox + worker
- [x] 幂等 / 文件 / 通知 / 审计
- [x] 模块 manifest / 授权 / 灰度
- [x] 演示数据（固定种子 + 埋雷）

## 质量红线（pnpm verify）

1. routes 层无 SQL
2. 每个路由文件声明 domain
3. 迁移只增不改
4. 指标必须注册后才能用
