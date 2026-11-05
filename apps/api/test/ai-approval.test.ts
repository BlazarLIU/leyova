import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveApprovalAction, resolveRejectAction } from '../src/lib/ai-access.js'

// 固定时间便于判定过期分支
const FIXED = new Date('2026-09-09T12:00:00Z')

// ── resolveApprovalAction（approve 分支）──
test('approve: 请求不存在（含越权查他人 → 查无此行）映射 not_found', () => {
  assert.deepEqual(resolveApprovalAction(null), { kind: 'not_found' })
  assert.deepEqual(resolveApprovalAction(undefined), { kind: 'not_found' })
})

test('approve: 非 pending 状态（含重复审批）映射 not_pending', () => {
  assert.deepEqual(resolveApprovalAction({ approval_status: 'approved', expires_at: null }, FIXED), {
    kind: 'not_pending',
    status: 'approved',
  })
  assert.deepEqual(resolveApprovalAction({ approval_status: 'rejected', expires_at: null }, FIXED), {
    kind: 'not_pending',
    status: 'rejected',
  })
  assert.deepEqual(resolveApprovalAction({ approval_status: 'expired', expires_at: null }, FIXED), {
    kind: 'not_pending',
    status: 'expired',
  })
})

test('approve: 已过期（expires_at 在 now 之前）映射 expired', () => {
  const past = { approval_status: 'pending', expires_at: '2026-09-09T11:00:00Z' }
  assert.deepEqual(resolveApprovalAction(past, FIXED), { kind: 'expired' })
})

test('approve: pending 且未过期（含无 expires_at）→ execute', () => {
  const future = { approval_status: 'pending', expires_at: '2026-09-09T13:00:00Z' }
  assert.deepEqual(resolveApprovalAction(future, FIXED), { kind: 'execute' })
  assert.deepEqual(resolveApprovalAction({ approval_status: 'pending', expires_at: null }, FIXED), {
    kind: 'execute',
  })
})

// ── resolveRejectAction（reject 分支保持原语义：无过期分支）──
test('reject: 请求不存在映射 not_found', () => {
  assert.deepEqual(resolveRejectAction(null), { kind: 'not_found' })
  assert.deepEqual(resolveRejectAction(undefined), { kind: 'not_found' })
})

test('reject: 非 pending 状态映射 not_pending（含 expired，不当作独立过期分支）', () => {
  assert.deepEqual(resolveRejectAction({ approval_status: 'expired' }), {
    kind: 'not_pending',
    status: 'expired',
  })
  assert.deepEqual(resolveRejectAction({ approval_status: 'approved' }), {
    kind: 'not_pending',
    status: 'approved',
  })
})

test('reject: pending → execute', () => {
  assert.deepEqual(resolveRejectAction({ approval_status: 'pending' }), { kind: 'execute' })
})
