/**
 * Resource 层的 zod schema 定义
 *
 * 每个资源在这里声明：入参校验（create/update）、列表查询（分页/排序/过滤）。
 * OpenAPI 文档由 zod 经 fastify-type-provider-zod 自动生成，不手写。
 */

import { z } from 'zod'

// ── 通用片段 ─────────────────────────────────────────────────────────────────

/** 主键参数 */
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

/** 列表查询：分页 + 排序 */
export const listQueryBase = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

/** 资源响应包装（与 lib/http.ts 的 sendOk 保持一致） */
export function okResponse<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data,
  })
}

export function errorResponse() {
  return z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.string().optional(),
  })
}

/** 分页列表响应 */
export function pagedResponse<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data: z.object({
      items: z.array(item),
      total: z.number().int(),
      page: z.number().int(),
      pageSize: z.number().int(),
      totalPages: z.number().int(),
    }),
  })
}

// ── dict_items ───────────────────────────────────────────────────────────────

export const dictItemSchema = z.object({
  id: z.number().int(),
  code: z.string(),
  name: z.string(),
  itemCount: z.number().int(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const dictItemCreateSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  itemCount: z.number().int().min(0).optional(),
  status: z.string().max(20).optional(),
})

export const dictItemUpdateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    itemCount: z.number().int().min(0).optional(),
    status: z.string().max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少需要一个更新字段' })

export const dictItemListQuerySchema = listQueryBase.extend({
  sortBy: z.enum(['id', 'code', 'name', 'itemCount', 'status', 'createdAt', 'updatedAt']).optional(),
  code: z.string().optional(),
  name: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
})
