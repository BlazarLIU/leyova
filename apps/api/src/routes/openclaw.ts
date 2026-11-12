/**
 * OpenClaw 配置管理 API。
 *
 * 「系统配置 → AI 配置」页读写的是 OpenClaw 真实配置 openclaw.json：
 * - GET /api/v1/openclaw/config  返回大模型 / 会话管理设置视图（apiKey 掩码）
 * - PUT /api/v1/openclaw/config  校验并写入 openclaw.json，自动重启 OpenClaw 生效
 *
 * 仅系统管理员（super_admin）可访问。
 */
import type { FastifyInstance } from 'fastify'
import { withRlsContext } from '../lib/db.js'
import { sendOk, sendError } from '../lib/http.js'
import { requireAuth } from '../lib/guard.js'
import { writeAuditLog } from '../lib/audit.js'
import { isAdminRole } from '../lib/ai-access.js'
import { getOpenClawConfigView, patchOpenClawConfig, restartOpenClaw } from '../lib/openclaw-config.js'

/** 轻量校验：主模型引用是否命中白名单（含前缀通配 provider/*） */
function allowListContains(allow: string[], ref: string): boolean {
  return allow.some((item) => {
    if (item.endsWith('/*')) {
      return ref.startsWith(item.slice(0, -1))
    }
    return item === ref
  })
}

function validateInput(body: Record<string, any>): string | null {
  try {
    if (body.modelsMode !== undefined && !['merge', 'override'].includes(body.modelsMode)) {
      return 'models 模式不合法（应为 merge / override）'
    }
    if (body.providerId) {
      const baseUrl = body.provider?.baseUrl
      if (baseUrl !== undefined && !/^https?:\/\/.+/.test(String(baseUrl))) {
        return '提供商地址不合法（需以 http(s):// 开头）'
      }
    }
    const allow = body.allowList
    if (Array.isArray(allow) && allow.length > 0) {
      if (allow.some((i: unknown) => typeof i !== 'string' || !i.trim())) {
        return '模型白名单含非法项'
      }
      if (body.primaryModel && !allowListContains(allow, String(body.primaryModel))) {
        return '主模型必须包含在模型白名单中'
      }
    }
    const s = body.session || {}
    const ints: Array<[number, number, number, string]> = [
      [s.maxConcurrent, 1, 100, '最大并发 Agent'],
      [s.subagentsMaxConcurrent, 1, 100, '子 Agent 最大并发'],
    ]
    for (const [v, min, max, name] of ints) {
      if (v !== undefined && (Number(v) < min || Number(v) > max)) {
        return `${name} 应在 ${min}-${max} 之间`
      }
    }
    const dm = s.dmScope
    if (dm !== undefined && !['main', 'per-peer', 'per-channel-peer', 'per-account-channel-peer'].includes(dm)) {
      return 'DM 会话作用域不合法'
    }
    if (s.compactionMode !== undefined && !['safeguard', 'default'].includes(s.compactionMode)) {
      return '精简策略不合法（应为 safeguard / default）'
    }
    if (s.contextInjection !== undefined && !['always', 'continuation-skip', 'never'].includes(s.contextInjection)) {
      return '上下文注入策略不合法'
    }
  } catch {
    return '请求体格式不正确'
  }
  return null
}

export async function openclawRoutes(app: FastifyInstance) {
  // ── GET /api/v1/openclaw/config ──
  app.get('/api/v1/openclaw/config', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isAdminRole(user.role)) {
      return sendError(reply, 403, '仅系统管理员可访问 OpenClaw 配置')
    }
    try {
      return sendOk(reply, getOpenClawConfigView())
    } catch (err) {
      request.log.warn({ err }, 'openclaw/config read failed')
      return sendError(reply, 500, '读取 OpenClaw 配置失败')
    }
  })

  // ── PUT /api/v1/openclaw/config ── 写入 openclaw.json 并重启生效
  app.put('/api/v1/openclaw/config', async (request, reply) => {
    const user = await requireAuth(request, reply)
    if (!user) return
    if (!isAdminRole(user.role)) {
      return sendError(reply, 403, '仅系统管理员可修改 OpenClaw 配置')
    }
    const body = (request.body || {}) as Record<string, any>
    const err = validateInput(body)
    if (err) {
      return sendError(reply, 400, err)
    }
    try {
      patchOpenClawConfig(body)
      const { killed, started } = restartOpenClaw()
      await withRlsContext(request, (client) => writeAuditLog(client, {
        request,
        action: 'openclaw.config.update',
        resourceType: 'openclaw_config',
        resourceId: body.providerId || 'global',
        afterData: {
          modelsMode: body.modelsMode,
          providerId: body.providerId,
          primaryModel: body.primaryModel,
          allowList: body.allowList,
          session: body.session,
          restarted: started,
        },
      }))
      return sendOk(reply, {
        message: '配置已保存，OpenClaw 已重启',
        restarted: started,
        killed,
      })
    } catch (e) {
      request.log.warn({ err: e }, 'openclaw/config update failed')
      return sendError(reply, 422, (e as Error).message || '更新 OpenClaw 配置失败')
    }
  })
}
