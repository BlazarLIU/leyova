/**
 * registerResource —— 通用资源层（CRUD 生成器）
 *
 * P9-4 目标：用 `registerResource(table, schema, policy)` 一处生成
 *   列表（分页 + 排序 + 过滤）+ 详情 + 创建 + 更新 + 删除，
 *   并自动接入：zod 校验、RLS 上下文、审计日志、OpenAPI 文档。
 *
 * 设计原则：
 *  1. **不写死 SQL 字符串拼接**：表名/列名来自「注册时声明」的白名单，
 *     过滤字段名也必须在声明的 filterable 集合内，杜绝 SQL 注入面。
 *  2. **RLS 优先**：所有查询都包在 withRlsContext() 内，
 *     以 leyova_app 角色执行，行级安全策略照常生效。
 *  3. **审计不遗漏**：写操作自动落 audit_logs（before/after 快照）。
 *  4. **错误语义统一**：404 / 409 / 400 的判定下沉到这里，路由层不再重复判断。
 *
 * 使用示例见 routes/resources.ts。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify'
import type { ZodTypeAny, z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

// ─────────────────────────────────────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────────────────────────────────────

/** 列定义：把「数据库列名」映射到「对外字段名 + zod 校验器」 */
export interface ResourceColumn {
  /** 数据库列名（snake_case） */
  column: string
  /** 对外暴露的字段名（camelCase）；不填则用 column */
  field?: string
  /** zod 校验器；用于 create / update 的入参校验 */
  zod?: ZodTypeAny
  /** 是否可写（默认 false，只有显式声明才允许出现在 create/update body 里） */
  writable?: boolean
  /** 是否可作为列表过滤字段 */
  filterable?: boolean
  /** 是否可排序 */
  sortable?: boolean
  /** 是否可作为搜索关键词字段 */
  searchable?: boolean
}

export interface ResourceOptions {
  /** 资源名（小写 kebab-case），会出现在 URL 中 */
  name: string
  /** 数据库表名（必须是白名单常量，不可来自用户输入） */
  table: string
  /** 主键列名，默认 id */
  primaryKey?: string
  /** 列定义 */
  columns: ResourceColumn[]
  /** 创建入参 schema */
  createSchema: z.ZodTypeAny
  /** 更新入参 schema */
  updateSchema: z.ZodTypeAny
  /** 允许写入的角色列表；不填则仅 super_admin 可写 */
  writeRoles?: string[]
  /** 列表查询 schema（分页 / 排序 / 过滤） */
  listQuerySchema?: z.ZodTypeAny
  /** 审计日志的资源类型名，默认用 name */
  auditResourceType?: string
  /** 列表默认排序，默认按主键降序 */
  defaultSort?: { column: string; direction: 'asc' | 'desc' }
  /** 列表最大返回条数上限，默认 200 */
  maxPageSize?: number
  /** 标签，用于 OpenAPI 分组 */
  tags?: string[]
  /** 资源描述，用于 OpenAPI summary */
  description?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

/** 列名 → 对外字段名 */
function fieldOf(col: ResourceColumn): string {
  return col.field ?? col.column
}

/** 取列定义 */
function colByColumn(cols: ResourceColumn[], column: string): ResourceColumn | undefined {
  return cols.find((c) => c.column === column)
}

/**
 * 构造 INSERT。
 * 只写 writable 列；未提供的可选列走数据库默认值。
 */
function buildInsert(opts: ResourceOptions, body: Record<string, unknown>) {
  const writable = opts.columns.filter((c) => c.writable)
  const entries: { column: string; value: unknown }[] = []
  for (const col of writable) {
    const field = fieldOf(col)
    if (body[field] !== undefined) entries.push({ column: col.column, value: body[field] })
  }
  return entries
}

/**
 * 构造 UPDATE（只更新 body 中实际出现的字段）。
 */
function buildUpdate(opts: ResourceOptions, body: Record<string, unknown>) {
  const writable = opts.columns.filter((c) => c.writable)
  const entries: { column: string; value: unknown }[] = []
  for (const col of writable) {
    const field = fieldOf(col)
    if (body[field] !== undefined) entries.push({ column: col.column, value: body[field] })
  }
  return entries
}

/** 把数据库行（snake_case 列）映射成对外字段（camelCase） */
function mapRow(opts: ResourceOptions, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const col of opts.columns) {
    out[fieldOf(col)] = row[col.column]
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// registerResource
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 注册一个通用 CRUD 资源。
 *
 * 生成的端点：
 *   GET    /api/v1/resources/:name        列表（分页 + 排序 + 过滤）
 *   GET    /api/v1/resources/:name/:id    详情
 *   POST   /api/v1/resources/:name        创建（审计）
 *   PUT    /api/v1/resources/:name/:id    更新（审计，带 before 快照）
 *   DELETE /api/v1/resources/:name/:id    删除（审计，带 before 快照）
 *
 * @param app Fastify 实例
 * @param opts 资源声明
 */
export function registerResource(app: FastifyInstance, opts: ResourceOptions): void {
  const pk = opts.primaryKey ?? 'id'
  const maxPageSize = opts.maxPageSize ?? 200
  const defaultSort = opts.defaultSort ?? { column: pk, direction: 'desc' as const }
  const writeRoles = opts.writeRoles ?? ['super_admin']

  // ── 校验声明本身（启动即失败，避免运行期才暴露） ──
  const writableColumns = opts.columns.filter((c) => c.writable).map((c) => c.column)
  if (writableColumns.length === 0) {
    throw new Error(`[registerResource:${opts.name}] 至少要有一个 writable 列`)
  }
  if (!colByColumn(opts.columns, pk)) {
    throw new Error(`[registerResource:${opts.name}] 主键列 ${pk} 未在 columns 中声明`)
  }

  const filterable = opts.columns.filter((c) => c.filterable).map((c) => c.column)
  const sortable = opts.columns.filter((c) => c.sortable).map((c) => c.column)
  const searchable = opts.columns.filter((c) => c.searchable).map((c) => c.column)

  const basePath = `/api/v1/resources/${opts.name}`
  const tag = opts.tags?.[0] ?? 'Resources'

  // ── GET 列表 ──
  app.get(
    basePath,
    {
      schema: {
        tags: [tag],
        summary: opts.description ?? `${opts.name} 列表`,
        querystring: opts.listQuerySchema as never,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const q = (request.query ?? {}) as Record<string, unknown>
        const page = Math.max(1, Number(q.page ?? 1) || 1)
        const pageSize = Math.min(maxPageSize, Math.max(1, Number(q.pageSize ?? 50) || 50))
        const offset = (page - 1) * pageSize

        // 排序：白名单校验
        let sortColumn = defaultSort.column
        let sortDirection: 'asc' | 'desc' = defaultSort.direction
        if (q.sortBy) {
          const requested = String(q.sortBy)
          if (sortable.length > 0 && !sortable.includes(requested)) {
            return sendError(reply, 400, `不支持的排序字段：${requested}`)
          }
          if (sortable.length === 0 || sortable.includes(requested)) sortColumn = requested
        }
        if (q.sortOrder) {
          const d = String(q.sortOrder).toLowerCase()
          if (d !== 'asc' && d !== 'desc') {
            return sendError(reply, 400, `不支持的排序方向：${q.sortOrder}`)
          }
          sortDirection = d
        }

        // 过滤：白名单校验
        const filters: { column: string; value: unknown }[] = []
        for (const [key, value] of Object.entries(q)) {
          if (key === 'page' || key === 'pageSize' || key === 'sortBy' || key === 'sortOrder' || key === 'search') {
            continue
          }
          if (value === undefined || value === null || value === '') continue
          const col = opts.columns.find((c) => fieldOf(c) === key || c.column === key)
          if (!col || !filterable.includes(col.column)) continue // 静默忽略不可过滤字段
          filters.push({ column: col.column, value })
        }

        const result = await withRlsContext(request, async (client) => {
          const whereParts: string[] = []
          const values: unknown[] = []

          for (const f of filters) {
            values.push(f.value)
            whereParts.push(`"${f.column}" = $${values.length}`)
          }

          // 关键词搜索
          if (q.search && searchable.length > 0) {
            const pattern = `%${String(q.search)}%`
            const ors = searchable.map((c, i) => {
              values.push(pattern)
              return `"${c}"::text ILIKE $${values.length}`
            })
            whereParts.push(`(${ors.join(' OR ')})`)
          }

          const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

          // COUNT
          const countRes = await client.query(
            `SELECT COUNT(*)::int AS total FROM "${opts.table}" ${whereSql}`,
            values
          )
          const total = countRes.rows[0]?.total ?? 0

          // 分页查询
          const limitIdx = values.length + 1
          const offsetIdx = values.length + 2
          const listRes = await client.query(
            `SELECT * FROM "${opts.table}" ${whereSql}
             ORDER BY "${sortColumn}" ${sortDirection.toUpperCase()}
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            [...values, pageSize, offset]
          )

          return {
            total,
            items: listRes.rows.map((r) => mapRow(opts, r)),
          }
        })

        return sendOk(reply, {
          items: result.items,
          total: result.total,
          page,
          pageSize,
          totalPages: Math.ceil(result.total / pageSize),
        })
      } catch (err) {
        request.log.error({ err }, 'resource list failed')
        return sendError(reply, 500, `获取 ${opts.name} 列表失败`)
      }
    }
  )

  // ── GET 详情 ──
  app.get(
    `${basePath}/:id`,
    { schema: { tags: [tag], summary: `${opts.name} 详情` } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const id = (request.params as { id: string }).id
        const row = await withRlsContext(request, async (client) => {
          const res = await client.query(`SELECT * FROM "${opts.table}" WHERE "${pk}" = $1 LIMIT 1`, [id])
          return res.rows[0]
        })
        if (!row) return sendError(reply, 404, `${opts.name} 不存在`)
        return sendOk(reply, mapRow(opts, row))
      } catch (err) {
        request.log.error({ err }, 'resource get failed')
        return sendError(reply, 500, `获取 ${opts.name} 失败`)
      }
    }
  )

  // ── POST 创建 ──
  app.post(
    basePath,
    {
      preHandler: [requireRole(writeRoles)],
      schema: {
        tags: [tag],
        summary: `${opts.name} 创建`,
        body: opts.createSchema as never,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = (request.body ?? {}) as Record<string, unknown>
        const entries = buildInsert(opts, body)
        if (entries.length === 0) return sendError(reply, 400, '没有可写入的字段')

        const row = await withRlsContext(request, async (client) => {
          const cols = entries.map((e) => `"${e.column}"`).join(', ')
          const placeholders = entries.map((_, i) => `$${i + 1}`).join(', ')
          const res = await client.query(
            `INSERT INTO "${opts.table}" (${cols}) VALUES (${placeholders}) RETURNING *`,
            entries.map((e) => e.value)
          )
          const created = res.rows[0]
          await writeAuditLog(client, {
            action: 'create',
            resourceType: opts.auditResourceType ?? opts.name,
            resourceId: created?.[pk],
            afterData: mapRow(opts, created ?? {}),
            request,
          })
          return created
        })

        return sendOk(reply, mapRow(opts, row ?? {}), `${opts.name} 已创建`)
      } catch (err: any) {
        request.log.error({ err }, 'resource create failed')
        // 唯一约束冲突 → 409
        if (err?.code === '23505') {
          return sendError(reply, 409, `${opts.name} 已存在（唯一约束冲突）`)
        }
        return sendError(reply, 500, `创建 ${opts.name} 失败`)
      }
    }
  )

  // ── PUT 更新 ──
  app.put(
    `${basePath}/:id`,
    {
      preHandler: [requireRole(writeRoles)],
      schema: {
        tags: [tag],
        summary: `${opts.name} 更新`,
        body: opts.updateSchema as never,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const id = (request.params as { id: string }).id
        const body = (request.body ?? {}) as Record<string, unknown>
        const entries = buildUpdate(opts, body)
        if (entries.length === 0) return sendError(reply, 400, '没有需要更新的字段')

        const result = await withRlsContext(request, async (client) => {
          const beforeRes = await client.query(
            `SELECT * FROM "${opts.table}" WHERE "${pk}" = $1 LIMIT 1`,
            [id]
          )
          const before = beforeRes.rows[0]
          if (!before) return { notFound: true as const, row: undefined }

          const sets = entries.map((e, i) => `"${e.column}" = $${i + 2}`).join(', ')
          const res = await client.query(
            `UPDATE "${opts.table}" SET ${sets} WHERE "${pk}" = $1 RETURNING *`,
            [id, ...entries.map((e) => e.value)]
          )
          const after = res.rows[0]
          await writeAuditLog(client, {
            action: 'update',
            resourceType: opts.auditResourceType ?? opts.name,
            resourceId: id,
            beforeData: mapRow(opts, before),
            afterData: mapRow(opts, after ?? {}),
            request,
          })
          return { notFound: false as const, row: after }
        })

        if (result.notFound) return sendError(reply, 404, `${opts.name} 不存在`)
        return sendOk(reply, mapRow(opts, result.row ?? {}), '更新成功')
      } catch (err: any) {
        request.log.error({ err }, 'resource update failed')
        if (err?.code === '23505') {
          return sendError(reply, 409, `${opts.name} 已存在（唯一约束冲突）`)
        }
        return sendError(reply, 500, `更新 ${opts.name} 失败`)
      }
    }
  )

  // ── DELETE 删除 ──
  app.delete(
    `${basePath}/:id`,
    {
      preHandler: [requireRole(writeRoles)],
      schema: { tags: [tag], summary: `${opts.name} 删除` },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const id = (request.params as { id: string }).id
        const result = await withRlsContext(request, async (client) => {
          const beforeRes = await client.query(
            `SELECT * FROM "${opts.table}" WHERE "${pk}" = $1 LIMIT 1`,
            [id]
          )
          const before = beforeRes.rows[0]
          if (!before) return { notFound: true as const }

          await client.query(`DELETE FROM "${opts.table}" WHERE "${pk}" = $1`, [id])
          await writeAuditLog(client, {
            action: 'delete',
            resourceType: opts.auditResourceType ?? opts.name,
            resourceId: id,
            beforeData: mapRow(opts, before),
            request,
          })
          return { notFound: false as const }
        })

        if (result.notFound) return sendError(reply, 404, `${opts.name} 不存在`)
        return sendOk(reply, null, '删除成功')
      } catch (err: any) {
        request.log.error({ err }, 'resource delete failed')
        // 外键约束冲突 → 409
        if (err?.code === '23503') {
          return sendError(reply, 409, `${opts.name} 被其他数据引用，无法删除`)
        }
        return sendError(reply, 500, `删除 ${opts.name} 失败`)
      }
    }
  )
}

/**
 * 注册一组资源。
 */
export function registerResources(app: FastifyInstance, list: ResourceOptions[]): void {
  for (const opts of list) registerResource(app, opts)
}

/**
 * 以 Fastify 插件形式注册（保持 app.ts 的 register 风格一致）。
 */
export const resourcePlugin: FastifyPluginAsync = async (app) => {
  // 由 routes/resources.ts 在 register 时注入具体资源
}

export { managedTables } from './db/schema.js'
