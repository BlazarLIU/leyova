/**
 * dict.ts — 字典管理路由
 *
 * 修复背景：dict_items 表在审核中被列为「零引用死表」（D1），
 * 而导航里又有 /system/dict 菜单（E2 死链）。本路由为其接入真实读写。
 *
 * 表结构（database/01_schema.sql）：id, code, name, item_count, status, created_at, updated_at
 * 语义：每个 code+name 代表一个字典分类（如 platform / channel_type），item_count 记录其条目数。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'

export async function dictRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ── GET /api/v1/system/dict ──
  app.get('/api/v1/system/dict', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, code, name, item_count, status, created_at, updated_at
           FROM dict_items ORDER BY code`,
      )
      return sendOk(reply, rows)
    } catch (err) {
      return sendError(reply, 500, '获取字典失败')
    }
  })

  // ── POST /api/v1/system/dict ──
  app.post('/api/v1/system/dict', async (request: FastifyRequest<{
    Body: { code: string; name: string; itemCount?: number; status?: string }
  }>, reply: FastifyReply) => {
    try {
      const { code, name, itemCount, status } = request.body || ({} as any)
      if (!code || !name) return sendError(reply, 400, '缺少必要参数 (code, name)')

      const exists = await pool.query('SELECT 1 FROM dict_items WHERE code = $1', [code])
      if (exists.rows.length > 0) return sendError(reply, 409, '字典编码已存在')

      const { rows } = await pool.query(
        `INSERT INTO dict_items (code, name, item_count, status)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [code, name, itemCount ?? 0, status || '启用'],
      )
      return sendOk(reply, rows[0], '字典已创建')
    } catch (err) {
      return sendError(reply, 500, '创建字典失败')
    }
  })

  // ── PUT /api/v1/system/dict/:id ──
  app.put('/api/v1/system/dict/:id', async (request: FastifyRequest<{
    Params: { id: string }
    Body: { name?: string; itemCount?: number; status?: string }
  }>, reply: FastifyReply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      const b = request.body || ({} as any)

      const sets: string[] = []
      const vals: any[] = [id]
      let i = 2
      if (b.name !== undefined) { sets.push(`name = $${i++}`); vals.push(b.name) }
      if (b.itemCount !== undefined) { sets.push(`item_count = $${i++}`); vals.push(b.itemCount) }
      if (b.status !== undefined) { sets.push(`status = $${i++}`); vals.push(b.status) }
      if (sets.length === 0) return sendError(reply, 400, '没有需要更新的字段')
      sets.push('updated_at = now()')

      const { rows } = await pool.query(
        `UPDATE dict_items SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
        vals,
      )
      if (rows.length === 0) return sendError(reply, 404, '字典不存在')
      return sendOk(reply, rows[0], '更新成功')
    } catch (err) {
      return sendError(reply, 500, '更新字典失败')
    }
  })

  // ── DELETE /api/v1/system/dict/:id ──
  app.delete('/api/v1/system/dict/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const id = parseInt(request.params.id, 10)
      if (!Number.isFinite(id)) return sendError(reply, 400, '无效的 ID')
      await pool.query('DELETE FROM dict_items WHERE id = $1', [id])
      return sendOk(reply, { deleted: true }, '已删除')
    } catch (err) {
      return sendError(reply, 500, '删除字典失败')
    }
  })
}
