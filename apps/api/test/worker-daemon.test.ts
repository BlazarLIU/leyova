import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { getPool } from '../src/lib/db.js'
import { acquireLeaderLock, releaseLeaderLock } from '../src/worker.js'
import {
  startJobEngine,
  stopJobEngine,
  sendJob,
  getAutomationHealthSnapshot,
  translateSyncErrorToHuman,
  isJobEngineRunning,
  QUEUE_NAMES,
} from '../src/jobs/boss.js'

const TEST_LOCK_KEY = 98234999

describe('方案 A：PostgreSQL pg-boss 异步调度引擎与业务化健康探针测试', () => {
  before(async () => {
    await releaseLeaderLock(TEST_LOCK_KEY)
  })

  after(async () => {
    await stopJobEngine()
    await releaseLeaderLock(TEST_LOCK_KEY)
    await getPool().end()
  })

  it('Leader 锁选举：单个实例成功获取 Advisory Lock 成为 Master', async () => {
    const isMaster = await acquireLeaderLock(TEST_LOCK_KEY)
    assert.equal(isMaster, true, '首个 Worker 应成功竞选为 Leader')
    await releaseLeaderLock(TEST_LOCK_KEY)
  })

  it('Leader 互斥：持锁期间第二个连接尝试获取返回 false（Standby）', async () => {
    const isMaster = await acquireLeaderLock(TEST_LOCK_KEY)
    assert.equal(isMaster, true)

    const pool = getPool()
    const secondClient = await pool.connect()
    try {
      const res = await secondClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [TEST_LOCK_KEY],
      )
      assert.equal(res.rows[0]?.acquired, false, '并发实例应无法重复获取 Master 锁')
    } finally {
      secondClient.release()
      await releaseLeaderLock(TEST_LOCK_KEY)
    }
  })

  it('pg-boss 引擎支持单盒启动、队列创建、幂等入队与优雅停机', async () => {
    const boss = await startJobEngine({
      enableWorkers: false,
      enableSchedules: true,
      runStartupSync: false,
    })
    assert.equal(isJobEngineRunning(), true)

    const schedules = await boss.getSchedules()
    assert.ok(schedules.some((s) => s.name === QUEUE_NAMES.FACT_AGGREGATION), '应自动注册事实汇总定时计划')
    assert.ok(schedules.some((s) => s.name === QUEUE_NAMES.AUTOMATION_CATCHUP), '应自动注册漏跑补偿定时计划')

    const jobId = await sendJob(
      QUEUE_NAMES.ANOMALY_DETECTION,
      { trigger: 'unit_test' },
      { singletonKey: `test-anomaly-${Date.now()}` },
    )
    assert.ok(jobId, 'pg-boss 应成功入队并返回 UUID')

    await stopJobEngine()
    assert.equal(isJobEngineRunning(), false)
  })

  it('业务化自动化健康快照与人话报错翻译正常可用', async () => {
    const pool = getPool()
    const snapshot = await getAutomationHealthSnapshot(pool)
    assert.ok(snapshot.yesterdayDate, '应包含昨日统计基准日期')
    assert.equal(typeof snapshot.yesterdayAggregated, 'boolean')
    assert.ok(Array.isArray(snapshot.shopSyncStatus))

    const authErr = translateSyncErrorToHuman('HTTP 401 unauthorized token expired')
    assert.match(authErr.title, /授权已失效/)
    const netErr = translateSyncErrorToHuman('ETIMEDOUT platform api busy')
    assert.match(netErr.title, /暂时繁忙/)
  })
})
