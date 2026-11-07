/**
 * knowledge-base.ts — 企业知识库配置与检索路由
 *
 * 对齐计划 3.2：
 *   - 系统不自研、不部署知识库，只作为外部 RAGFlow/MaxKB 的客户端
 *   - 使用者部署 leyova 后，在自己部署的 RAGFlow 上拿到地址与 API Key，
 *     在此处填入即可接入
 *   - 未配置时所有接口返回「未启用」，AI 助手主链路不受影响
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { sendOk, sendError } from '../lib/http.js'
import { getPool } from '../lib/db.js'
import {
  getKbConfig,
  testKnowledgeBaseConnection,
  searchKnowledgeBase,
  invalidateKbConfigCache,
  type KbProvider,
} from '../lib/kb-client.js'

const CONFIG_KEYS = [
  'kb.provider',
  'kb.baseUrl',
  'kb.apiKey',
  'kb.datasetIds',
  'kb.topK',
  'kb.similarityThreshold',
]

export async function knowledgeBaseRoutes(app: FastifyInstance) {
  const pool = getPool()

  // ── GET /api/v1/kb/config ── 读取配置（apiKey 脱敏）
  app.get('/api/v1/kb/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(
        `SELECT config_key, config_value FROM ai_config WHERE config_key = ANY($1::text[])`,
        [CONFIG_KEYS],
      )
      const map: Record<string, string> = {}
      for (const r of rows) map[r.config_key] = r.config_value

      const cfg = await getKbConfig()
      return sendOk(reply, {
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        apiKeyConfigured: !!cfg.apiKey,
        apiKeyMasked: cfg.apiKey
          ? cfg.apiKey.slice(0, 4) + '****' + cfg.apiKey.slice(-4)
          : '',
        datasetIds: cfg.datasetIds,
        topK: cfg.topK,
        similarityThreshold: cfg.similarityThreshold,
        configured: cfg.provider !== 'none' && !!cfg.baseUrl && !!cfg.apiKey,
      })
    } catch (err) {
      return sendError(reply, 500, '读取知识库配置失败')
    }
  })

  // ── PUT /api/v1/kb/config ── 保存配置
  app.put('/api/v1/kb/config', async (request: FastifyRequest<{
    Body: {
      provider?: KbProvider
      baseUrl?: string
      apiKey?: string
      datasetIds?: string[] | string
      topK?: number
      similarityThreshold?: number
    }
  }>, reply: FastifyReply) => {
    try {
      const b = request.body || {}
      const upserts: Array<[string, string]> = []

      if (b.provider !== undefined) upserts.push(['kb.provider', b.provider])
      if (b.baseUrl !== undefined) upserts.push(['kb.baseUrl', b.baseUrl.replace(/\/+$/, '')])
      // apiKey 为空字符串时视为不修改（避免前端回显星号覆盖真实值）
      if (b.apiKey !== undefined && b.apiKey !== '' && !b.apiKey.includes('****')) {
        upserts.push(['kb.apiKey', b.apiKey])
      }
      if (b.datasetIds !== undefined) {
        const ds = Array.isArray(b.datasetIds) ? b.datasetIds.join(',') : b.datasetIds
        upserts.push(['kb.datasetIds', ds])
      }
      if (b.topK !== undefined) upserts.push(['kb.topK', String(b.topK)])
      if (b.similarityThreshold !== undefined) {
        upserts.push(['kb.similarityThreshold', String(b.similarityThreshold)])
      }

      if (upserts.length === 0) return sendError(reply, 400, '没有需要更新的字段')

      for (const [k, v] of upserts) {
        await pool.query(
          `INSERT INTO ai_config (config_key, config_value)
           VALUES ($1, $2)
           ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value, updated_at = now()`,
          [k, v],
        )
      }

      // 配置已变更，主动失效缓存后再读回最新值
      invalidateKbConfigCache()
      const cfg = await getKbConfig()
      return sendOk(reply, {
        provider: cfg.provider,
        baseUrl: cfg.baseUrl,
        configured: cfg.provider !== 'none' && !!cfg.baseUrl && !!cfg.apiKey,
      }, '知识库配置已保存')
    } catch (err) {
      return sendError(reply, 500, '保存知识库配置失败')
    }
  })

  // ── POST /api/v1/kb/test ── 连通性测试
  app.post('/api/v1/kb/test', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await testKnowledgeBaseConnection()
      return sendOk(reply, result, result.message)
    } catch (err: any) {
      return sendError(reply, 500, err?.message || '测试连接失败')
    }
  })

  // ── POST /api/v1/kb/search ── 直接检索（供调试与外部调用）
  app.post('/api/v1/kb/search', async (request: FastifyRequest<{
    Body: { query: string; datasetIds?: string[]; topK?: number }
  }>, reply: FastifyReply) => {
    try {
      const { query, datasetIds, topK } = request.body || {}
      if (!query) return sendError(reply, 400, '缺少查询内容')
      const chunks = await searchKnowledgeBase(query, { datasetIds, topK })
      return sendOk(reply, { query, count: chunks.length, chunks })
    } catch (err) {
      return sendError(reply, 500, '知识库检索失败')
    }
  })

  // ── GET /api/v1/kb/status ── 简易状态（供前端徽标显示）
  app.get('/api/v1/kb/status', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const cfg = await getKbConfig()
      const configured = cfg.provider !== 'none' && !!cfg.baseUrl && !!cfg.apiKey
      return sendOk(reply, {
        configured,
        provider: cfg.provider,
        baseUrl: cfg.baseUrl || null,
        degraded: !configured,
        note: configured ? '知识库已接入' : '未接入企业知识库，AI 分析助手将仅使用当前对话上下文',
      })
    } catch (err) {
      return sendError(reply, 500, '获取知识库状态失败')
    }
  })
}
