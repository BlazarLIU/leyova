import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getPool } from '../src/lib/db.js'
import { acquireLeaderLock, releaseLeaderLock } from '../src/worker.js'

const TEST_LOCK_KEY = 98234999

describe('Day-2 异步任务与独立 Worker 守护进程测试', () => {
  before(async () => {
    // Ensure clean lock state
    await releaseLeaderLock(TEST_LOCK_KEY)
  })

  after(async () => {
    await releaseLeaderLock(TEST_LOCK_KEY)
    await getPool().end()
  })

  it('Leader 锁选举：单个实例成功获取 Advisory Lock 成为 Master', async () => {
    const isMaster = await acquireLeaderLock(TEST_LOCK_KEY)
    assert.equal(isMaster, true, '首个 Worker 应成功竞选为 Leader')

    // Clean up
    await releaseLeaderLock(TEST_LOCK_KEY)
  })

  it('Leader 互斥：持锁期间第二个连接尝试获取返回 false（Standby）', async () => {
    const isMaster = await acquireLeaderLock(TEST_LOCK_KEY)
    assert.equal(isMaster, true)

    // Second connection probe
    const pool = getPool()
    const secondClient = await pool.connect()
    try {
      const res = await secondClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [TEST_LOCK_KEY]
      )
      assert.equal(res.rows[0]?.acquired, false, '并发实例应无法重复获取 Master 锁')
    } finally {
      secondClient.release()
      await releaseLeaderLock(TEST_LOCK_KEY)
    }
  })

  it('system_jobs 任务队列表具备原子锁更新能力', async () => {
    const pool = getPool()
    // Insert a pending job
    const ins = await pool.query<{ id: number }>(
      `INSERT INTO system_jobs (job_type, job_name, status, run_at, input_payload)
       VALUES ('test_worker_probe', 'Worker原子队列探针', 'pending', NOW(), '{"foo":"bar"}'::jsonb)
       RETURNING id`
    )
    const jobId = ins.rows[0].id

    // Atomically claim via SKIP LOCKED
    const claim = await pool.query<{ id: number }>(
      `UPDATE system_jobs
       SET status = 'running',
           started_at = NOW()
       WHERE id = (
         SELECT id FROM system_jobs
         WHERE id = $1 AND status = 'pending'
         FOR UPDATE SKIP LOCKED
       )
       RETURNING id`,
      [jobId]
    )

    assert.equal(claim.rows.length, 1)
    assert.equal(claim.rows[0].id, jobId)

    // Complete job
    await pool.query(
      `UPDATE system_jobs
       SET status = 'completed',
           finished_at = NOW()
       WHERE id = $1`,
      [jobId]
    )

    const check = await pool.query(
      'SELECT status FROM system_jobs WHERE id = $1',
      [jobId]
    )
    assert.equal(check.rows[0].status, 'completed')
  })
})
