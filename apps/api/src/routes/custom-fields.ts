import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { requireAuth, requireRole } from '../lib/guard.js'
import { sendOk, sendError } from '../lib/http.js'

const CF_ADMIN_ROLES = ['super_admin', 'admin', 'ops_director']
const CF_WRITE_ROLES = ['super_admin', 'admin', 'ops_director', 'ops_staff', 'operator', 'ad_buyer']

export async function customFieldRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/v1/system/custom-fields/definitions ── 获取实体自定义字段元定义列表
  app.get<{
    Querystring: { entityType?: string; platformCode?: string }
  }>('/api/v1/system/custom-fields/definitions', { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityType, platformCode } = request.query || {}
    try {
      const rows = await withRlsContext(request, async (client) => {
        const params: any[] = []
        const conds: string[] = ['is_active = true']

        if (entityType) {
          params.push(entityType)
          conds.push(`entity_type = $${params.length}`)
        }
        if (platformCode) {
          params.push(platformCode)
          conds.push(`(platform_code IS NULL OR platform_code = $${params.length})`)
        }

        const res = await client.query(
          `SELECT id, entity_type, field_key, field_label, data_type, platform_code,
                  options, is_required, default_value, validation_regex, description, sort_order, is_active, created_at
           FROM public.sys_custom_field_definition
           WHERE ${conds.join(' AND ')}
           ORDER BY sort_order ASC, id ASC`,
          params,
        )
        return res.rows.map((r) => ({
          id: Number(r.id),
          entityType: r.entity_type,
          fieldKey: r.field_key,
          fieldLabel: r.field_label,
          dataType: r.data_type,
          platformCode: r.platform_code,
          options: r.options || [],
          isRequired: Boolean(r.is_required),
          defaultValue: r.default_value,
          validationRegex: r.validation_regex,
          description: r.description,
          sortOrder: Number(r.sort_order),
          isActive: Boolean(r.is_active),
          createdAt: r.created_at,
        }))
      })
      return sendOk(reply, rows)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch custom field definitions')
      return sendError(reply, 500, '获取自定义字段定义失败')
    }
  })

  // ── POST /api/v1/system/custom-fields/definitions ── 创建自定义字段元定义
  app.post<{
    Body: {
      entityType: 'product' | 'shop' | 'live_session' | 'order' | 'ad_plan' | 'channel_listing'
      fieldKey: string
      fieldLabel: string
      dataType: 'string' | 'number' | 'boolean' | 'date' | 'select' | 'json'
      platformCode?: string
      options?: Array<{ label: string; value: any }>
      isRequired?: boolean
      defaultValue?: string
      validationRegex?: string
      description?: string
      sortOrder?: number
    }
  }>('/api/v1/system/custom-fields/definitions', { preHandler: [requireRole(CF_ADMIN_ROLES)] }, async (request, reply) => {
    const b = request.body
    if (!b?.entityType || !b?.fieldKey || !b?.fieldLabel || !b?.dataType) {
      return sendError(reply, 400, '必须提供实体类型、字段键名、字段标签与数据类型')
    }

    const fieldKey = b.fieldKey.trim().toLowerCase()
    if (!/^[a-z0-9_]{2,64}$/.test(fieldKey)) {
      return sendError(reply, 400, '字段键名必须为 2~64 位小写字母、数字或下划线')
    }

    try {
      const def = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `INSERT INTO public.sys_custom_field_definition (
             entity_type, field_key, field_label, data_type, platform_code,
             options, is_required, default_value, validation_regex, description, sort_order
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6::jsonb, $7, $8, $9, $10, $11
           )
           ON CONFLICT (entity_type, field_key, COALESCE(platform_code, '__all__'))
           DO UPDATE SET
             field_label = EXCLUDED.field_label,
             data_type = EXCLUDED.data_type,
             options = EXCLUDED.options,
             is_required = EXCLUDED.is_required,
             default_value = EXCLUDED.default_value,
             validation_regex = EXCLUDED.validation_regex,
             description = EXCLUDED.description,
             sort_order = EXCLUDED.sort_order,
             is_active = true,
             updated_at = now()
           RETURNING *`,
          [
            b.entityType,
            fieldKey,
            b.fieldLabel.trim(),
            b.dataType,
            b.platformCode || null,
            JSON.stringify(b.options || []),
            Boolean(b.isRequired),
            b.defaultValue || '',
            b.validationRegex || '',
            b.description || '',
            Number(b.sortOrder) || 0,
          ],
        )
        return res.rows[0]
      })
      return sendOk(reply, def)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to create custom field definition')
      return sendError(reply, 500, err?.message || '创建自定义字段定义失败')
    }
  })

  // ── PUT /api/v1/system/custom-fields/definitions/:id ── 更新自定义字段元定义
  app.put<{
    Params: { id: string }
    Body: {
      fieldLabel?: string
      options?: Array<{ label: string; value: any }>
      isRequired?: boolean
      defaultValue?: string
      validationRegex?: string
      description?: string
      sortOrder?: number
      isActive?: boolean
    }
  }>('/api/v1/system/custom-fields/definitions/:id', { preHandler: [requireRole(CF_ADMIN_ROLES)] }, async (request, reply) => {
    const id = Number(request.params.id)
    const b = request.body
    if (!id) return sendError(reply, 400, '无效的字段 ID')

    try {
      const def = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `UPDATE public.sys_custom_field_definition
           SET field_label = COALESCE($1, field_label),
               options = CASE WHEN $2::jsonb IS NOT NULL THEN $2::jsonb ELSE options END,
               is_required = COALESCE($3, is_required),
               default_value = COALESCE($4, default_value),
               validation_regex = COALESCE($5, validation_regex),
               description = COALESCE($6, description),
               sort_order = COALESCE($7, sort_order),
               is_active = COALESCE($8, is_active),
               updated_at = now()
           WHERE id = $9
           RETURNING *`,
          [
            b.fieldLabel ? b.fieldLabel.trim() : null,
            b.options ? JSON.stringify(b.options) : null,
            typeof b.isRequired === 'boolean' ? b.isRequired : null,
            b.defaultValue ?? null,
            b.validationRegex ?? null,
            b.description ?? null,
            typeof b.sortOrder === 'number' ? b.sortOrder : null,
            typeof b.isActive === 'boolean' ? b.isActive : null,
            id,
          ],
        )
        return res.rows[0]
      })

      if (!def) return sendError(reply, 404, '自定义字段定义不存在')
      return sendOk(reply, def)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update custom field definition')
      return sendError(reply, 500, err?.message || '更新自定义字段定义失败')
    }
  })

  // ── DELETE /api/v1/system/custom-fields/definitions/:id ── 停用或删除字段元定义
  app.delete<{ Params: { id: string } }>('/api/v1/system/custom-fields/definitions/:id', { preHandler: [requireRole(CF_ADMIN_ROLES)] }, async (request, reply) => {
    const id = Number(request.params.id)
    if (!id) return sendError(reply, 400, '无效的字段 ID')

    try {
      await withRlsContext(request, async (client) => {
        await client.query(`UPDATE public.sys_custom_field_definition SET is_active = false, updated_at = now() WHERE id = $1`, [id])
      })
      return sendOk(reply, { success: true })
    } catch (err) {
      request.log.error({ err }, 'Failed to delete custom field definition')
      return sendError(reply, 500, '删除自定义字段定义失败')
    }
  })

  // ── GET /api/v1/system/custom-fields/values ── 获取指定实体的自定义字段值
  app.get<{
    Querystring: { entityType: string; entityId: string }
  }>('/api/v1/system/custom-fields/values', { preHandler: [requireAuth] }, async (request, reply) => {
    const { entityType, entityId } = request.query || {}
    if (!entityType || !entityId) {
      return sendError(reply, 400, '必须提供实体类型 entityType 与实体标识 entityId')
    }

    try {
      const data = await withRlsContext(request, async (client) => {
        const res = await client.query(
          `SELECT v.id, v.field_id, v.field_key, v.field_value_text, v.field_value_number, v.field_value_json,
                  d.field_label, d.data_type, d.options, d.is_required
           FROM public.sys_custom_field_value v
           JOIN public.sys_custom_field_definition d ON d.id = v.field_id
           WHERE v.entity_type = $1 AND v.entity_id = $2 AND d.is_active = true`,
          [entityType, entityId],
        )

        const valuesMap: Record<string, any> = {}
        const items = res.rows.map((r) => {
          let val: any = r.field_value_text
          if (r.data_type === 'number') {
            val = r.field_value_number !== null ? Number(r.field_value_number) : null
          } else if (r.data_type === 'boolean') {
            val = r.field_value_text === 'true'
          } else if (r.data_type === 'json' || r.data_type === 'select') {
            val = r.field_value_text || r.field_value_json
          }
          valuesMap[r.field_key] = val
          return {
            id: Number(r.id),
            fieldId: Number(r.field_id),
            fieldKey: r.field_key,
            fieldLabel: r.field_label,
            dataType: r.data_type,
            value: val,
            options: r.options,
            isRequired: Boolean(r.is_required),
          }
        })

        return { entityType, entityId, values: valuesMap, items }
      })

      return sendOk(reply, data)
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch custom field values')
      return sendError(reply, 500, '获取实体自定义字段值失败')
    }
  })

  // ── POST /api/v1/system/custom-fields/values/batch-save ── 批量校验与保存实体自定义字段
  app.post<{
    Body: {
      entityType: 'product' | 'shop' | 'live_session' | 'order' | 'ad_plan' | 'channel_listing'
      entityId: string
      values: Record<string, any>
    }
  }>('/api/v1/system/custom-fields/values/batch-save', { preHandler: [requireRole(CF_WRITE_ROLES)] }, async (request, reply) => {
    const b = request.body
    if (!b?.entityType || !b?.entityId || !b?.values || typeof b.values !== 'object') {
      return sendError(reply, 400, '必须提供实体类型 entityType、实体 ID entityId 以及字段值对象 values')
    }

    try {
      const result = await withRlsContext(request, async (client) => {
        // 读取该实体的可用有效字段定义
        const defRes = await client.query(
          `SELECT id, field_key, field_label, data_type, options, is_required, validation_regex
           FROM public.sys_custom_field_definition
           WHERE entity_type = $1 AND is_active = true`,
          [b.entityType],
        )

        const defMap = new Map<string, any>()
        for (const row of defRes.rows) {
          defMap.set(row.field_key, row)
        }

        const savedFields: Record<string, any> = {}

        for (const [key, rawVal] of Object.entries(b.values)) {
          const def = defMap.get(key)
          if (!def) continue // 忽略无定义的无效键

          if (def.is_required && (rawVal === undefined || rawVal === null || rawVal === '')) {
            throw new Error(`字段 [${def.field_label}] 为必填项`)
          }

          let textVal = ''
          let numVal: number | null = null
          let jsonVal: any = {}

          if (def.data_type === 'number') {
            numVal = Number(rawVal)
            if (isNaN(numVal)) throw new Error(`字段 [${def.field_label}] 必须为有效数字`)
            textVal = String(numVal)
            savedFields[key] = numVal
          } else if (def.data_type === 'boolean') {
            const boolVal = Boolean(rawVal)
            textVal = boolVal ? 'true' : 'false'
            savedFields[key] = boolVal
          } else if (def.data_type === 'select') {
            textVal = String(rawVal)
            const allowedOpts = Array.isArray(def.options) ? def.options.map((o: any) => String(o.value)) : []
            if (allowedOpts.length > 0 && !allowedOpts.includes(textVal)) {
              throw new Error(`字段 [${def.field_label}] 选项无效: ${textVal}`)
            }
            savedFields[key] = textVal
          } else if (def.data_type === 'json') {
            jsonVal = typeof rawVal === 'object' ? rawVal : JSON.parse(String(rawVal || '{}'))
            textVal = JSON.stringify(jsonVal)
            savedFields[key] = jsonVal
          } else {
            textVal = String(rawVal || '')
            if (def.validation_regex && textVal) {
              const reg = new RegExp(def.validation_regex)
              if (!reg.test(textVal)) {
                throw new Error(`字段 [${def.field_label}] 格式不满足规则: ${def.validation_regex}`)
              }
            }
            savedFields[key] = textVal
          }

          await client.query(
            `INSERT INTO public.sys_custom_field_value (
               field_id, entity_type, entity_id, field_key,
               field_value_text, field_value_number, field_value_json, updated_at
             ) VALUES (
               $1, $2, $3, $4,
               $5, $6, $7::jsonb, now()
             )
             ON CONFLICT (field_id, entity_type, entity_id)
             DO UPDATE SET
               field_value_text = EXCLUDED.field_value_text,
               field_value_number = EXCLUDED.field_value_number,
               field_value_json = EXCLUDED.field_value_json,
               updated_at = now()`,
            [
              def.id,
              b.entityType,
              b.entityId,
              key,
              textVal,
              numVal,
              JSON.stringify(jsonVal),
            ],
          )
        }

        // 同步回宿主实体的 custom_fields JSONB 字段
        if (b.entityType === 'live_session') {
          await client.query(
            `UPDATE public.live_sessions
             SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $1::jsonb,
                 updated_at = now()
             WHERE id = $2`,
            [JSON.stringify(savedFields), Number(b.entityId)],
          )
        } else if (b.entityType === 'product') {
          await client.query(
            `UPDATE public.dim_product
             SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $1::jsonb,
                 updated_at = now()
             WHERE id = $2`,
            [JSON.stringify(savedFields), Number(b.entityId)],
          )
        } else if (b.entityType === 'ad_plan') {
          await client.query(
            `UPDATE public.ad_plan
             SET custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $1::jsonb,
                 updated_at = now()
             WHERE id = $2`,
            [JSON.stringify(savedFields), Number(b.entityId)],
          )
        }

        return { entityType: b.entityType, entityId: b.entityId, savedFields }
      })

      return sendOk(reply, result)
    } catch (err: any) {
      request.log.error({ err }, 'Failed to batch save custom fields')
      return sendError(reply, 400, err?.message || '保存自定义字段值失败')
    }
  })
}
