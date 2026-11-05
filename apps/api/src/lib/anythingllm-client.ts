/**
 * AnythingLLM client — real implementation.
 *
 * This client assumes an AnythingLLM server is deployed and configured
 * with an API key. It uses the workspace chat endpoint and a light-weight
 * workspace discovery helper.
 */

import { env } from '../config/env.js'

interface AnythingLLMWorkspace {
  id: string
  slug?: string
  name?: string
}

interface AnythingLLMChatResponse {
  text?: string
  response?: string
  message?: string
  content?: string
  textResponse?: string
}

function isEnabled(): boolean {
  return !!env.ANYTHINGLLM_API_BASE && !!env.ANYTHINGLLM_API_KEY
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${env.ANYTHINGLLM_API_KEY}`,
  }
}

async function llmFetch<T>(path: string, body?: Record<string, unknown>): Promise<T | null> {
  if (!isEnabled()) return null
  const res = await fetch(`${env.ANYTHINGLLM_API_BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn(`[anythingllm] ${path} returned ${res.status}: ${text.slice(0, 200)}`)
    return null
  }
  return res.json() as Promise<T>
}

async function findWorkspace(workspaceName?: string): Promise<AnythingLLMWorkspace | null> {
  if (!workspaceName) return null
  const res = await llmFetch<{ workspaces?: AnythingLLMWorkspace[] }>('/api/v1/workspaces')
  const workspaces = res?.workspaces || []
  const byName = workspaces.find((w) => w.slug === workspaceName || w.name === workspaceName)
  return byName ?? null
}

/**
 * Ask the knowledge base a question.
 */
export async function searchKnowledge(
  query: string,
  workspaceName = 'leyova-knowledge'
): Promise<string | null> {
  const workspace = await findWorkspace(workspaceName)
  if (!workspace) return null

  const res = await llmFetch<AnythingLLMChatResponse>(
    `/api/v1/workspace/${workspace.slug || workspace.id}/chat`,
    {
      message: query,
      // 用 query（纯 RAG 检索）而非 chat（agent 模式）：稳定且无跨会话 agent 串扰
      mode: 'query',
    }
  )

  const text = res?.textResponse || res?.text || res?.response || res?.message || res?.content
  // 过滤无相关内容的兜底回复，避免污染上下文
  const trimmed = text?.trim() || ''
  if (!trimmed || /no relevant information/i.test(trimmed)) return null
  return trimmed
}

/**
 * Create or rename workspace if needed.
 */
export async function ensureWorkspace(name: string): Promise<string | null> {
  const existing = await findWorkspace(name)
  if (existing) return existing.slug || existing.id

  const created = await llmFetch<AnythingLLMWorkspace>('/api/v1/workspaces', {
    name,
    slug: name,
  })
  return created?.slug || created?.id || null
}
