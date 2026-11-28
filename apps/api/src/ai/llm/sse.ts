/**
 * ai/llm/sse.ts — 极简 SSE 行解析
 * 将 fetch 响应体按行拆分，只把 `data:` 负载交给回调，忽略注释与空行。
 */

export async function readSseStream(
  res: Response,
  onData: (data: string) => void
): Promise<void> {
  const body = res.body
  if (!body) throw new Error('响应无 body，无法流式读取')

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleLine = (line: string): void => {
    const trimmed = line.replace(/\r$/, '')
    if (!trimmed.startsWith('data:')) return
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return
    onData(data)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx = buffer.indexOf('\n')
    while (idx >= 0) {
      handleLine(buffer.slice(0, idx))
      buffer = buffer.slice(idx + 1)
      idx = buffer.indexOf('\n')
    }
  }
  if (buffer.trim()) handleLine(buffer)
}
