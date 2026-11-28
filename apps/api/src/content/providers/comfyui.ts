/**
 * comfyui.ts — ComfyUI 生成服务适配器
 *
 * 对应计划 P3「内容中心预开发」：
 *   - 把「能接 ComfyUI」的骨架搭好，主链路不依赖 ComfyUI 是否在线
 *   - 统一 ContentProvider 接口，MockProvider 用于无 ComfyUI 时的演示与联调
 *
 * ComfyUI HTTP API 参考（默认端口 8188）：
 *   GET  /system_stats              服务状态
 *   GET  /object_info               可用节点/模型清单
 *   POST /prompt                    提交 workflow，返回 prompt_id
 *   GET  /history/{prompt_id}       查询执行结果
 *   WS   /ws?clientId=...           进度推送
 */

export type TaskType = 'text2video' | 'image2video' | 'tts' | 'edit'

export interface ProviderInfo {
  providerType: 'comfyui' | 'mock'
  baseUrl: string
  apiKey?: string
}

export interface SubmitResult {
  promptId: string
  providerType: string
}

export interface TaskProgress {
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  outputUrls: string[]
  error?: string
  raw?: any
}

export interface ContentProvider {
  readonly providerType: string
  checkHealth(): Promise<{ ok: boolean; message: string; details?: any }>
  getObjectInfo(): Promise<Record<string, any>>
  submit(workflow: Record<string, any>, clientId?: string): Promise<SubmitResult>
  poll(promptId: string): Promise<TaskProgress>
}

// ---------------------------------------------------------------------------
// ComfyUI 实现
// ---------------------------------------------------------------------------

export class ComfyUIProvider implements ContentProvider {
  readonly providerType = 'comfyui'
  private baseUrl: string
  private apiKey?: string

  constructor(info: ProviderInfo) {
    this.baseUrl = info.baseUrl.replace(/\/+$/, '')
    this.apiKey = info.apiKey
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) h.Authorization = `Bearer ${this.apiKey}`
    return h
  }

  async checkHealth(): Promise<{ ok: boolean; message: string; details?: any }> {
    try {
      const res = await fetch(`${this.baseUrl}/system_stats`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) {
        return { ok: false, message: `ComfyUI 返回 HTTP ${res.status}` }
      }
      const stats = await res.json().catch(() => ({}))
      const devs = (stats?.devices || []) as any[]
      const gpu = devs[0]?.name || '未知设备'
      const vramTotal = devs[0]?.vram_total
      return {
        ok: true,
        message: `连接正常 · ${gpu}${vramTotal ? ` · 显存 ${(vramTotal / 1024 ** 3).toFixed(1)}GB` : ''}`,
        details: stats,
      }
    } catch (err: any) {
      return { ok: false, message: `无法连接 ComfyUI：${err?.message || err}` }
    }
  }

  async getObjectInfo(): Promise<Record<string, any>> {
    const res = await fetch(`${this.baseUrl}/object_info`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`获取节点信息失败: HTTP ${res.status}`)
    return res.json()
  }

  async submit(workflow: Record<string, any>, clientId?: string): Promise<SubmitResult> {
    const res = await fetch(`${this.baseUrl}/prompt`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ prompt: workflow, client_id: clientId }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`提交任务失败: HTTP ${res.status} ${text.slice(0, 300)}`)
    }
    const json = (await res.json()) as { prompt_id?: string; error?: any }
    if (!json.prompt_id) {
      throw new Error(`ComfyUI 未返回 prompt_id: ${JSON.stringify(json).slice(0, 300)}`)
    }
    return { promptId: json.prompt_id, providerType: this.providerType }
  }

  async poll(promptId: string): Promise<TaskProgress> {
    const res = await fetch(`${this.baseUrl}/history/${promptId}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      return { status: 'running', progress: 0, outputUrls: [], raw: { httpStatus: res.status } }
    }
    const history = (await res.json()) as Record<string, any>
    const entry = history[promptId]
    if (!entry) {
      return { status: 'running', progress: 0, outputUrls: [] }
    }

    const status = entry.status || {}
    if (status.status_str === 'error' || status.completed === false) {
      return {
        status: 'failed',
        progress: 0,
        outputUrls: [],
        error: JSON.stringify(status.messages || status).slice(0, 500),
        raw: entry,
      }
    }

    // 从 outputs 中提取产物 URL
    const outputUrls: string[] = []
    const outputs = entry.outputs || {}
    for (const nodeId of Object.keys(outputs)) {
      const node = outputs[nodeId] || {}
      for (const key of ['images', 'gifs', 'videos', 'audio']) {
        const arr = node[key]
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item?.filename) {
              const sub = item.subfolder ? `&subfolder=${encodeURIComponent(item.subfolder)}` : ''
              outputUrls.push(
                `${this.baseUrl}/view?filename=${encodeURIComponent(item.filename)}&type=${item.type || 'output'}${sub}`,
              )
            }
          }
        }
      }
    }

    const done = status.status_str === 'success' || status.completed === true
    return {
      status: done ? 'completed' : 'running',
      progress: done ? 100 : 50,
      outputUrls,
      raw: entry,
    }
  }
}

// ---------------------------------------------------------------------------
// Mock 实现（无 ComfyUI 时的占位，保证主链路可跑通）
// ---------------------------------------------------------------------------

const mockTasks = new Map<string, { createdAt: number; outputUrls: string[] }>()

export class MockProvider implements ContentProvider {
  readonly providerType = 'mock'

  async checkHealth() {
    return { ok: true, message: 'Mock 模式已启用（未连接真实生成服务，用于演示与联调）' }
  }

  async getObjectInfo() {
    return {
      _mock: true,
      note: '这是一份占位节点清单，接入真实 ComfyUI 后会返回实际节点与模型',
      CheckpointLoaderSimple: {
        input: { required: { ckpt_name: [['mock_model.safetensors']] } },
      },
    }
  }

  async submit(workflow: Record<string, any>, clientId?: string): Promise<SubmitResult> {
    const promptId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    mockTasks.set(promptId, { createdAt: Date.now(), outputUrls: [] })
    return { promptId, providerType: this.providerType }
  }

  async poll(promptId: string): Promise<TaskProgress> {
    const task = mockTasks.get(promptId)
    if (!task) {
      return { status: 'failed', progress: 0, outputUrls: [], error: '任务不存在' }
    }
    const elapsed = Date.now() - task.createdAt
    // 模拟 3 秒完成
    if (elapsed < 1500) {
      return { status: 'running', progress: Math.round((elapsed / 3000) * 100), outputUrls: [] }
    }
    if (elapsed < 3000) {
      return { status: 'running', progress: Math.round((elapsed / 3000) * 100), outputUrls: [] }
    }
    const url = `/mock-output/${promptId}.mp4`
    return { status: 'completed', progress: 100, outputUrls: [url] }
  }
}

/** 根据配置创建 provider 实例 */
export function createProvider(info: ProviderInfo): ContentProvider {
  if (info.providerType === 'mock') return new MockProvider()
  return new ComfyUIProvider(info)
}
