/**
 * Drizzle schema —— Resource 层的数据访问描述
 *
 * P9-4：新 Resource 层改用 Drizzle + fastify-type-provider-zod。
 *
 * 设计取舍：
 *  · 本文件只声明**被 Resource 层管理的表**，不追求覆盖 218 张全库表。
 *    逐表手写 Drizzle 声明在 218 张表的规模上是不划算的负债，
 *    因此采用「显式声明少量核心表 + 通用 registerResource 走动态 SQL」的混合模式。
 *  · 声明过的表走类型安全的 Drizzle 查询（编译期校验列名/类型）；
 *    未声明的表仍可通过 registerResource 注册（运行时校验 + 参数化）。
 *  · 所有 SQL 均参数化；表名/列名来自白名单常量，不接受用户输入。
 *
 * 重要：RLS 仍然生效。Resource 层所有查询都跑在 withRlsContext() 内，
 * 数据库以 leyova_app 角色执行，行级安全策略照常拦截。
 */

import { pgTable, serial, varchar, integer, timestamp } from 'drizzle-orm/pg-core'

/**
 * 字典项 —— Resource 层的第一批托管表。
 *
 * 选它作为样板的原因：
 *  · 结构简单（7 列），足以覆盖 CRUD 全链路
 *  · 有唯一约束（code），能验证冲突处理
 *  · 有默认值与时间戳，能验证默认值/自动更新时间
 *  · 原 dict.ts 路由是手写的，改造后可直接对比回归
 */
export const dictItems = pgTable('dict_items', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  itemCount: integer('item_count').notNull().default(0),
  status: varchar('status', { length: 20 }).notNull().default('启用'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Resource 层已声明的表注册表。
 *
 * key 是对外暴露的资源名（出现在 URL 路径里），value 是 Drizzle 表定义。
 * registerResource 会用这张表来校验「注册的资源是否在声明范围内」，
 * 避免出现「路由名与实际表名不一致」这类难查的漂移。
 */
export const managedTables = {
  dict_items: dictItems,
} as const

export type ManagedTableName = keyof typeof managedTables
