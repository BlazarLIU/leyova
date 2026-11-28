import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sanitizeSnippet,
  filterChunksByTenant,
  toCitations,
  needsKnowledge,
  appendCitationsToMarkdown,
} from '../../src/ai/run/knowledge.js'
import type { KnowledgeChunk } from '../../src/lib/kb-client.js'

function chunk(partial: Partial<KnowledgeChunk>): KnowledgeChunk {
  return {
    chunkId: 'c1',
    documentId: 'd1',
    documentName: 'SOP 文档',
    content: '客服响应时效要求：5 分钟内首响。',
    similarity: 0.8,
    ...partial,
  }
}

test('knowledge: 片段清洗去掉控制字符并截断', () => {
  const raw = '第一行\u0000\u0007第二行\n\n  第三行  '
  assert.equal(sanitizeSnippet(raw), '第一行 第二行 第三行')
  assert.equal(sanitizeSnippet('abcdef', 3), 'abc')
})

test('knowledge: 带租户标记的跨租户片段被丢弃', () => {
  const chunks = [
    chunk({ chunkId: 'a', metadata: { tenantId: 1 } }),
    chunk({ chunkId: 'b', metadata: { tenant_id: 2 } }),
    chunk({ chunkId: 'c' }),
  ]
  const kept = filterChunksByTenant(chunks, 1).map((c) => c.chunkId)
  assert.deepEqual(kept, ['a', 'c'])
})

test('knowledge: 引用去重、按相关度排序并生成序号', () => {
  const citations = toCitations(
    [
      chunk({ chunkId: 'low', similarity: 0.3 }),
      chunk({ chunkId: 'high', similarity: 0.9 }),
      chunk({ chunkId: 'high', similarity: 0.9 }),
    ],
    1
  )
  assert.equal(citations.length, 2)
  assert.deepEqual(citations.map((c) => c.seq), [1, 2])
  assert.equal(citations[0].chunkId, 'high')
  assert.equal(citations[0].tenantId, 1)
})

test('knowledge: 知识型问题识别', () => {
  assert.equal(needsKnowledge('售后 SOP 流程是什么'), true)
  assert.equal(needsKnowledge('昨天抖音销售额多少'), false)
})

test('knowledge: 引用追加到回答末尾', () => {
  const citations = toCitations([chunk({})], 1)
  const out = appendCitationsToMarkdown('正文', citations)
  assert.match(out, /参考来源/)
  assert.match(out, /《SOP 文档》/)
  assert.match(out, /客服响应时效要求/)
  assert.equal(appendCitationsToMarkdown('正文', []), '正文')
})
