import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findDuplicateSession,
  buildDuplicateMessage,
  type SqlPool,
} from '../src/lib/livereg-dedupe.js'

interface Row {
  id: number
  anchor_name: string | null
  room_name: string | null
}

/** 构造一个可注入、并记录 SQL 与参数的假 DB。 */
function mockPool(rows: Row[]): { pool: SqlPool; calls: { sql: string; params?: unknown[] }[] } {
  const calls: { sql: string; params?: unknown[] }[] = []
  const pool: SqlPool = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params })
      return { rows }
    },
  }
  return { pool, calls }
}

// ── 验证步骤 1：新增拦截（命中重复）──
test('新增拦截: 同主播/直播间/日期/开始时间已有记录则判定为重复', async () => {
  const { pool, calls } = mockPool([{ id: 12, anchor_name: '冰冰', room_name: '直播间1' }])
  const dup = await findDuplicateSession(pool, {
    date: '2026-09-08',
    roomId: 3,
    anchorId: 7,
    startTime: '09:30',
  })
  assert.equal(dup?.id, 12)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].sql.includes("status <> 'cancelled'"), '应过滤作废记录')
  assert.ok(!calls[0].sql.includes('id <> $5'), '无 excludeId 时不应排除自身')
  assert.deepEqual(calls[0].params, ['2026-09-08', 3, 7, '09:30'])
})

// ── 验证步骤 2：新增放行（无匹配记录）──
test('新增放行: 无匹配记录时返回 null，允许登记', async () => {
  const { pool } = mockPool([])
  const dup = await findDuplicateSession(pool, {
    date: '2026-09-08',
    roomId: 3,
    anchorId: 7,
    startTime: '10:30',
  })
  assert.equal(dup, null)
})

// ── 验证步骤 3：编辑拦截（排除自身后仍命中其他记录）──
test('编辑拦截: 排除自身后仍命中其他重复记录则判定为重复', async () => {
  const { pool, calls } = mockPool([{ id: 99, anchor_name: '冰冰', room_name: '直播间1' }])
  const dup = await findDuplicateSession(pool, {
    date: '2026-09-08',
    roomId: 3,
    anchorId: 7,
    startTime: '09:30',
    excludeId: 12,
  })
  assert.equal(dup?.id, 99)
  assert.ok(calls[0].sql.includes('id <> $5'), '编辑时应排除自身 id')
  assert.deepEqual(calls[0].params, ['2026-09-08', 3, 7, '09:30', 12])
})

// ── 验证步骤 4：编辑自身放行（仅自身一条匹配，DB 已排除）──
test('编辑自身放行: 仅自身匹配且被排除时返回 null', async () => {
  const { pool, calls } = mockPool([]) // DB 端经 id<>$5 排除自身后返回空
  const dup = await findDuplicateSession(pool, {
    date: '2026-09-08',
    roomId: 3,
    anchorId: 7,
    startTime: '09:30',
    excludeId: 12,
  })
  assert.equal(dup, null)
  assert.ok(calls[0].sql.includes('id <> $5'))
})

// ── 验证步骤 5：作废记录放行（cancelled 不计重复）──
test('作废记录放行: SQL 过滤 status<>cancelled，作废记录不命中', async () => {
  const { pool, calls } = mockPool([]) // cancelled 被 SQL 过滤 => 返回空
  const dup = await findDuplicateSession(pool, {
    date: '2026-09-08',
    roomId: 3,
    anchorId: 7,
    startTime: '09:30',
  })
  assert.equal(dup, null)
  assert.ok(calls[0].sql.includes("status <> 'cancelled'"), '应只排除作废记录')
})

// ── startTime 为空跳过（不发起查重）──
test('startTime 为空跳过: 不发起查重查询', async () => {
  const { pool, calls } = mockPool([{ id: 1, anchor_name: 'x', room_name: 'y' }])
  const dup = await findDuplicateSession(pool, {
    date: '2026-09-08',
    roomId: 3,
    anchorId: 7,
  })
  assert.equal(dup, null)
  assert.equal(calls.length, 0, 'startTime 为空时不查库')
})

// ── 提示文案拼装 ──
test('buildDuplicateMessage: 带房间拼接可读提示', () => {
  assert.equal(
    buildDuplicateMessage({ id: 1, anchor_name: '冰冰', room_name: '直播间1' }, '2026-09-08', '09:30'),
    '冰冰 在「直播间1」2026-09-08 09:30 已登记开播，请勿重复登记'
  )
})

test('buildDuplicateMessage: 无房间时不带括号房间名', () => {
  assert.equal(
    buildDuplicateMessage({ id: 1, anchor_name: '冰冰', room_name: null }, '2026-09-08', '09:30'),
    '冰冰 在2026-09-08 09:30 已登记开播，请勿重复登记'
  )
})
