import 'dotenv/config'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'

import './tools/live.js'
import './tools/anchor.js'
import './tools/product.js'
import './tools/review.js'
import './tools/bi.js'
import './tools/task.js'

import { listTools, executeTool, getToolSchemas } from './registry.js'
import { pool } from './db.js'
import { parseAuth } from './auth.js'
import type { ToolContext } from './types.js'

const PORT = parseInt(process.env.MCP_PORT || '9101', 10)

function sendJSON(res: ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) })
  res.end(json)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://localhost:${PORT}`)
  const path = url.pathname

  if (req.method === 'GET' && path === '/health') {
    return sendJSON(res, 200, { status: 'ok', tools: listTools().length })
  }

  if (req.method === 'GET' && path === '/tools') {
    return sendJSON(res, 200, { tools: getToolSchemas() })
  }

  if (req.method === 'POST' && path === '/tools/call') {
    const auth = await parseAuth(req)
    if ('error' in auth) return sendJSON(res, auth.status, { error: auth.error })

    const raw = await readBody(req)
    let body: { tool?: string; params?: unknown }
    try {
      body = JSON.parse(raw)
    } catch {
      return sendJSON(res, 400, { error: 'Invalid JSON body' })
    }

    const { tool, params } = body
    if (!tool) return sendJSON(res, 400, { error: 'Missing "tool" field' })

    const ctx: ToolContext = {
      userId: auth.userId,
      role: auth.role,
      tenantId: auth.tenantId,
      scopeType: auth.scopeType,
      scopeId: auth.scopeId,
      pool,
    }

    const result = await executeTool(tool, params || {}, ctx)
    return sendJSON(res, result.ok ? 200 : 422, result)
  }

  return sendJSON(res, 404, { error: 'Not found' })
})

const HOST = process.env.MCP_HOST || '127.0.0.1'

server.listen(PORT, HOST, () => {
  console.log(`[leyova-mcp-server] listening on http://${HOST}:${PORT}`)
  console.log(`[leyova-mcp-server] ${listTools().length} tools registered`)
})
