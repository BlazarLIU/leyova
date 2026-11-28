/**
 * routes/integrations.ts — W8 集成中心
 *
 * 接口面（全部要求登录，写凭证仅超管）：
 *   GET    /api/v1/integrations                       连接器列表 + 健康态
 *   GET    /api/v1/integrations/catalog               连接器目录（能力清单）
 *   GET    /api/v1/integrations/call-logs             最近外部调用审计
 *   GET    /api/v1/integrations/llm/presets           豆包 / 通义模型预设
 *   POST   /api/v1/integrations/llm/test-connection   模型连通性测试
 *   POST   /api/v1/integrations/:platform/health-check 健康检查（默认真实探测）
 *   PUT    /api/v1/integrations/:platform/credentials  写入/轮换凭证（仅超管）
 *   DELETE /api/v1/integrations/:platform/credentials  吊销凭证（仅超管）
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { writeAuditLog } from '../lib/audit.js'
import { requireAuth } from '../lib/guard.js'
import { tenantIdOf } from '../lib/tenant-context.js'
import { connectorCatalog, getConnector, assertEndpointAllowed } from '../integrations/connectors.js'
import { listConnections, listCallLogs, runHealthCheck, ensureConnection } from '../integrations/service.js'
import {
  loadIntegrationCredential,
  revokeIntegrationCredential,
  saveIntegrationCredential,
  updateIntegrationConfig,
} from '../integrations/credentials.js'
import {
  LLM_PROVIDER_PRESETS,
  testLlmPresetConnection,
} from '../integrations/llm-presets.js'

const credentialSchema = z.object({
  secrets: z.record(z.string(), z.string().max(4096)),
  /** 非敏感配置（如 baseUrl / model），仅允许连接器声明的 configFields */
  config: z.record(z.string(), z.string().max(500)).optional(),
})

const llmTestSchema = z.object({
  preset: z.string().trim().min(1).max(64),
  apiKey: z.string().max(4096).optional(),
  model: z.string().trim().max(100).optional(),
})

const healthSchema = z.object({
  probe: z.boolean().optional(),
})

/** 连接上是否已存有指定非敏感配置（轮换凭证时允许不重复填写 baseUrl） */
async function hasStoredConfig(request: FastifyRequest, tenantId: number, platform: string, fields: string[]): Promise<boolean> {
  const { rows } = await withRlsContext(request, (client) =>
    client.query<{ config: Record<string, unknown> }>(
      `SELECT config FROM public.integration_connections WHERE tenant_id = $1 AND platform = $2 LIMIT 1`,
      [tenantId, platform]
    )
  )
  const config = rows[0]?.config || {}
  return fields.every((field) => Boolean(String(config[field] || '').trim()))
}

export async function integrationRoutes(app: FastifyInstance) {
  // ── 连接器列表 ──
  app.get('/api/v1/integrations', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!['super_admin', 'ops_director'].includes(user.role)) {
      return sendError(reply, 403, '当前角色无权查看集成中心')
    }
    const tenantId = tenantIdOf(user)
    const items = await listConnections(tenantId)
    return sendOk(reply, { items, total: items.length })
  })

  // ── 连接器目录 ──
  app.get('/api/v1/integrations/catalog', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!['super_admin', 'ops_director'].includes(user.role)) {
      return sendError(reply, 403, '当前角色无权查看集成目录')
    }
    const items = connectorCatalog()
    return sendOk(reply, { items, total: items.length })
  })

  // ── 调用审计 ──
  app.get('/api/v1/integrations/call-logs', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!['super_admin', 'ops_director'].includes(user.role)) {
      return sendError(reply, 403, '当前角色无权查看调用日志')
    }
    const query = (request.query || {}) as { platform?: string; limit?: string }
    const limit = Number(query.limit) || 50
    const items = await listCallLogs(tenantIdOf(user), {
      platform: query.platform ? String(query.platform).slice(0, 64) : undefined,
      limit,
    })
    return sendOk(reply, { items, total: items.length })
  })

  // ── 模型预设 ──
  app.get('/api/v1/integrations/llm/presets', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    return sendOk(reply, { items: LLM_PROVIDER_PRESETS, total: LLM_PROVIDER_PRESETS.length })
  })

  // ── 模型连通性测试 ──
  app.post('/api/v1/integrations/llm/test-connection', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!['super_admin', 'ops_director'].includes(user.role)) {
      return sendError(reply, 403, '当前角色无权测试模型连接')
    }
    const parsed = llmTestSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    const tenantId = tenantIdOf(user)
    const preset = parsed.data.preset
    if (!LLM_PROVIDER_PRESETS.some((item) => item.key === preset)) {
      return sendError(reply, 404, '未知模型预设')
    }

    let apiKey = parsed.data.apiKey?.trim()
    if (!apiKey) {
      const stored = await withRlsContext(request, (client) =>
        loadIntegrationCredential(client, tenantId, preset)
      )
      apiKey = stored?.secrets.apiKey
    }

    try {
      const result = await testLlmPresetConnection({
        preset,
        apiKey,
        model: parsed.data.model,
        tenantId,
        actorUserId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'integration.llm.test_connection',
          resourceType: 'integration_connection',
          resourceId: preset,
          afterData: {
            preset,
            model: result.model,
            ok: result.ok,
            configured: result.configured,
            latencyMs: result.latencyMs,
            errorCode: result.errorCode,
          },
        })
      )
      return sendOk(reply, result)
    } catch (err) {
      return sendError(reply, 500, (err as Error)?.message || '模型连通性测试失败')
    }
  })

  // ── 健康检查 ──
  app.post('/api/v1/integrations/:platform/health-check', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!['super_admin', 'ops_director'].includes(user.role)) {
      return sendError(reply, 403, '当前角色无权执行健康检查')
    }
    const { platform } = request.params as { platform: string }
    if (!getConnector(platform)) return sendError(reply, 404, '未知连接器')

    const parsed = healthSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '参数不合法')

    try {
      const outcome = await runHealthCheck({
        tenantId: tenantIdOf(user),
        platform,
        probe: parsed.data.probe !== false,
        actorUserId: user.id,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'integration.health_check',
          resourceType: 'integration_connection',
          resourceId: platform,
          afterData: {
            status: outcome.status,
            detail: outcome.detail,
            latencyMs: outcome.latencyMs,
            probe: outcome.probe,
            secretsConfigured: outcome.secretsConfigured,
          },
        })
      )
      return sendOk(reply, outcome)
    } catch (err) {
      return sendError(reply, 500, (err as Error)?.message || '健康检查失败')
    }
  })

  // ── 写入 / 轮换凭证（仅超管）──
  app.put('/api/v1/integrations/:platform/credentials', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (user.role !== 'super_admin') return sendError(reply, 403, '仅超级管理员可维护集成凭证')

    const { platform } = request.params as { platform: string }
    const connector = getConnector(platform)
    if (!connector) return sendError(reply, 404, '未知连接器')

    const parsed = credentialSchema.safeParse(request.body || {})
    if (!parsed.success) return sendError(reply, 400, '凭证格式不合法')

    const secrets: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.data.secrets || {})) {
      if (connector.credentialFields.includes(key) && value.trim()) {
        secrets[key] = value.trim()
      }
    }

    // 非敏感配置：只接受连接器声明的字段，避免任意键落库
    const allowedConfig = new Set(connector.configFields || [])
    const configPatch: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed.data.config || {})) {
      if (allowedConfig.has(key)) configPatch[key] = String(value).trim()
    }
    if (configPatch.baseUrl) {
      const rejected = assertEndpointAllowed(configPatch.baseUrl)
      if (rejected) return sendError(reply, 400, rejected)
    }

    const existingCredential = Object.keys(secrets).length === 0
      ? await withRlsContext(request, (client) => loadIntegrationCredential(client, tenantIdOf(user), platform))
      : null

    const missing = connector.credentialFields.filter((field) => !secrets[field])
    const canConfigOnlyUpdate = Boolean(existingCredential) && Object.keys(secrets).length === 0 && Object.keys(configPatch).length > 0

    if (missing.length > 0 && !canConfigOnlyUpdate) {
      return sendError(reply, 400, `缺少必填凭证：${missing.join('、')}`)
    }

    const missingConfig = (connector.requiredConfigFields || []).filter((field) => !configPatch[field])
    if (missingConfig.length > 0 && !(await hasStoredConfig(request, tenantIdOf(user), platform, missingConfig))) {
      return sendError(reply, 400, `缺少必填配置：${missingConfig.join('、')}`)
    }

    try {
      // 先把连接器登记进库（首次配置时 connections 行尚不存在）
      await withRlsContext(request, (client) =>
        ensureConnection(client, tenantIdOf(user), platform)
      )
      if (canConfigOnlyUpdate && existingCredential) {
        await updateIntegrationConfig({
          tenantId: tenantIdOf(user),
          platform,
          configPatch,
        })
        await withRlsContext(request, (client) =>
          writeAuditLog(client, {
            request,
            actorUserId: user.id,
            action: 'integration.config.update',
            resourceType: 'integration_connection',
            resourceId: platform,
            afterData: {
              platform,
              configKeys: Object.keys(configPatch),
            },
          })
        )
        return sendOk(reply, {
          platform,
          configured: true,
          credentialHint: existingCredential.hint,
          keyVersion: existingCredential.keyVersion,
          fields: Object.keys(existingCredential.secrets),
          configKeys: Object.keys(configPatch),
        })
      }

      const saved = await saveIntegrationCredential({
        tenantId: tenantIdOf(user),
        platform,
        secrets,
        credentialFields: connector.credentialFields,
        userId: user.id,
        configPatch: Object.keys(configPatch).length > 0 ? configPatch : undefined,
      })
      await withRlsContext(request, (client) =>
        writeAuditLog(client, {
          request,
          actorUserId: user.id,
          action: 'integration.credential.rotate',
          resourceType: 'integration_connection',
          resourceId: platform,
          afterData: {
            platform,
            fields: saved.fields,
            hint: saved.hint,
            keyVersion: saved.keyVersion,
            configKeys: Object.keys(configPatch),
          },
        })
      )
      return sendOk(reply, {
        platform,
        configured: true,
        credentialHint: saved.hint,
        keyVersion: saved.keyVersion,
        fields: saved.fields,
        configKeys: Object.keys(configPatch),
      })
    } catch (err) {
      return sendError(reply, 500, (err as Error)?.message || '凭证保存失败')
    }
  })

  // ── 吊销凭证（仅超管）──
  app.delete('/api/v1/integrations/:platform/credentials', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (user.role !== 'super_admin') return sendError(reply, 403, '仅超级管理员可维护集成凭证')

    const { platform } = request.params as { platform: string }
    if (!getConnector(platform)) return sendError(reply, 404, '未知连接器')

    const revoked = await withRlsContext(request, (client) =>
      revokeIntegrationCredential(client, tenantIdOf(user), platform)
    )
    if (!revoked) return sendError(reply, 404, '该连接尚未配置凭证')

    await withRlsContext(request, (client) =>
      writeAuditLog(client, {
        request,
        actorUserId: user.id,
        action: 'integration.credential.revoke',
        resourceType: 'integration_connection',
        resourceId: platform,
      })
    )
    return sendOk(reply, { platform, configured: false })
  })
}
