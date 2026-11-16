/**
 * resources.ts —— 通用资源层的路由注册入口
 *
 * P9-4：把「散落在 48 个路由文件里的手写 CRUD」逐步收敛到这里。
 *
 * 当前已托管：dict_items（原 routes/dict.ts 的手写 CRUD 的等价实现）。
 * 后续可按同样的方式把更多只读/简单 CRUD 的表搬进来。
 */

import type { FastifyInstance } from 'fastify'
import {
  validatorCompiler,
  serializerCompiler,
} from 'fastify-type-provider-zod'
import { registerResources, type ResourceOptions } from '../resources/register-resource.js'
import {
  dictItemCreateSchema,
  dictItemListQuerySchema,
  dictItemUpdateSchema,
} from '../resources/schemas.js'

/** dict_items 资源声明 */
const dictItemsResource: ResourceOptions = {
  name: 'dict-items',
  table: 'dict_items',
  primaryKey: 'id',
  description: '字典项（通用资源层托管）',
  tags: ['Resources'],
  writeRoles: ['super_admin', 'admin'],
  columns: [
    { column: 'id', field: 'id', sortable: true },
    { column: 'code', field: 'code', writable: true, filterable: true, sortable: true, searchable: true,
      zod: dictItemCreateSchema.shape.code },
    { column: 'name', field: 'name', writable: true, filterable: true, sortable: true, searchable: true,
      zod: dictItemCreateSchema.shape.name },
    { column: 'item_count', field: 'itemCount', writable: true, filterable: true, sortable: true,
      zod: dictItemCreateSchema.shape.itemCount },
    { column: 'status', field: 'status', writable: true, filterable: true, sortable: true,
      zod: dictItemCreateSchema.shape.status },
    { column: 'created_at', field: 'createdAt', sortable: true },
    { column: 'updated_at', field: 'updatedAt', sortable: true },
  ],
  createSchema: dictItemCreateSchema,
  updateSchema: dictItemUpdateSchema,
  listQuerySchema: dictItemListQuerySchema,
  defaultSort: { column: 'code', direction: 'asc' },
  auditResourceType: 'dict_item',
}

export async function resourceRoutes(app: FastifyInstance) {
  // P9-4：在**本插件作用域内**启用 zod 校验器 / 序列化器。
  // 不改全局 app.setValidatorCompiler —— 那会影响 48 个既有路由文件，
  // 它们用的是 Fastify 原生 JSON Schema，混用两套校验器风险高。
  // 作用域内注册的资源则完全走 zod → JSON Schema → Fastify 校验链。
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerResources(app, [dictItemsResource])
}

export default resourceRoutes
