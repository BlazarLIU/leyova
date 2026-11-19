import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.resolve(__dirname, '..')
const SRC_ROOT = path.join(WEB_ROOT, 'src')

const useTableSource = fs.readFileSync(path.join(SRC_ROOT, 'hooks/useTable.ts'), 'utf8')
const dataPageSource = fs.readFileSync(path.join(SRC_ROOT, 'components/common/DataPage.tsx'), 'utf8')
const commonIndexSource = fs.readFileSync(path.join(SRC_ROOT, 'components/common/index.ts'), 'utf8')
const dashboardHubSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/bi/UnifiedDashboardHub.tsx'), 'utf8')
const scheduleHubSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/ops/schedule/UnifiedScheduleHub.tsx'), 'utf8')
const uploadedDataSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/data/UploadedDataPage.tsx'), 'utf8')
const appSource = fs.readFileSync(path.join(SRC_ROOT, 'App.tsx'), 'utf8')
const manifestSource = fs.readFileSync(path.join(SRC_ROOT, 'data/route-manifest.ts'), 'utf8')

describe('P4 前端重构架构契约测试: DataPage + useTable + 8合1看板 + 4合1排班', () => {
  test('useTable 钩子实现完整的分页、排序、筛选、搜索防抖、行选择与 CSV 导出', () => {
    assert.match(useTableSource, /export function useTable/)
    assert.match(useTableSource, /setPage\b/)
    assert.match(useTableSource, /setPageSize\b/)
    assert.match(useTableSource, /setSort\b/)
    assert.match(useTableSource, /setFilter\b/)
    assert.match(useTableSource, /resetFilters\b/)
    assert.match(useTableSource, /reload\b/)
    assert.match(useTableSource, /toggleSelectRow\b/)
    assert.match(useTableSource, /toggleSelectAll\b/)
    assert.match(useTableSource, /clearSelection\b/)
    assert.match(useTableSource, /exportCsv\b/)
    assert.match(useTableSource, /\\uFEFF/, 'CSV 导出应包含 UTF-8 BOM 避免 Excel 中文乱码')
  })

  test('DataPage 组件提供完整的声明式表格、搜索框、筛选栏、批量操作栏与分页器', () => {
    assert.match(dataPageSource, /export function DataPage/)
    assert.match(dataPageSource, /export interface ColumnDef/)
    assert.match(dataPageSource, /export interface DataPageProps/)
    assert.match(dataPageSource, /showPagination/)
    assert.match(dataPageSource, /batchActions/)
    assert.match(dataPageSource, /filterControls/)
    assert.match(dataPageSource, /emptyMessage/)
  })

  test('components/common/index.ts 统一对外导出 DataPage 与 useTable 原语', () => {
    assert.match(commonIndexSource, /export \{ DataPage \} from '\.\/DataPage'/)
    assert.match(commonIndexSource, /export \{ useTable \} from '\.\/useTable'/)
  })

  test('UnifiedDashboardHub 聚合 8 大分析视图且包含完整 tab 配置', () => {
    assert.match(dashboardHubSource, /export function UnifiedDashboardHub/)
    const expectedViews = [
      'cockpit',
      'bi',
      'omnichannel',
      'roi',
      'review',
      'traffic',
      'channels',
      'shop',
    ]
    for (const v of expectedViews) {
      assert.ok(
        dashboardHubSource.includes(`key: '${v}'`),
        `UnifiedDashboardHub 应包含视图配置: ${v}`
      )
    }
  })

  test('UnifiedScheduleHub 聚合 4 大排班场景 (月历/人员/个人/AI推荐)', () => {
    assert.match(scheduleHubSource, /export function UnifiedScheduleHub/)
    const expectedScheduleViews = ['calendar', 'management', 'recommend']
    for (const sv of expectedScheduleViews) {
      assert.ok(
        scheduleHubSource.includes(`key: '${sv}'`),
        `UnifiedScheduleHub 应包含排班视图配置: ${sv}`
      )
    }
  })

  test('UploadedDataPage 完成示范重构，接入 DataPage + useTable 并保留全量 API 端点', () => {
    assert.match(uploadedDataSource, /useTable</)
    assert.match(uploadedDataSource, /<DataPage/)
    assert.match(uploadedDataSource, /api\.get<any>\('\/api\/data\/uploaded-data\/anchor'/)
    assert.match(uploadedDataSource, /api\.get<any>\('\/api\/data\/uploaded-data\/channel'/)
    assert.match(uploadedDataSource, /api\.delete\(`\/api\/data\/uploaded-data\/anchor/)
    assert.match(uploadedDataSource, /api\.delete\(`\/api\/data\/uploaded-data\/channel/)
    assert.match(uploadedDataSource, /api\.post\('\/api\/data\/uploaded-data\/anchor\/batch-delete'/)
    assert.match(uploadedDataSource, /api\.post\('\/api\/data\/uploaded-data\/channel\/batch-delete'/)
  })

  test('主路由挂载 Unified Hub 并保留原 URL 访问能力（route-manifest）', () => {
    const hubCases = [
      ['/overview/cockpit', 'cockpit'],
      ['/omnichannel/dashboard', 'omnichannel'],
      ['/bi/dashboard', 'bi'],
    ]
    for (const [p, view] of hubCases) {
      const line = manifestSource.split('\n').find((l) => l.includes(`href: '${p}'`))
      assert.ok(line, `route-manifest 缺少 ${p}`)
      assert.ok(line.includes("'UnifiedDashboardHub'"), `${p} 应挂 UnifiedDashboardHub`)
      assert.ok(line.includes(`defaultView: '${view}'`), `${p} 的 defaultView 应为 ${view}`)
    }
    // 2026-11-18 组织收敛：「我的排班」导航已移除（个人考勤落点改为 /live/attendance），
    // my-schedule tab 已从 UnifiedScheduleHub 删除，仅保留月历与人员调度两个入口
    const scheduleCases = [
      ['/anchors/live-schedule', 'calendar'],
      ['/anchors/schedule', 'management'],
    ]
    for (const [p, view] of scheduleCases) {
      const line = manifestSource.split('\n').find((l) => l.includes(`href: '${p}'`))
      assert.ok(line, `route-manifest 缺少 ${p}`)
      assert.ok(line.includes("'UnifiedScheduleHub'"), `${p} 应挂 UnifiedScheduleHub`)
      assert.ok(line.includes(`defaultView: '${view}'`), `${p} 的 defaultView 应为 ${view}`)
    }
    // 2026-11-16：AI 智能排班已迁移至 AI 运营分支，旧 URL 在 App.tsx 以重定向保留（不在 nav manifest 中）
    assert.match(appSource, /<Route path="\/anchors\/schedule-recommend" element=\{<Navigate to="\/ai-ops\/people\/schedule-recommend" replace \/>\}/)
  })

  test('重度业务页推广 DataPage + useTable: FulfillmentSlaPage, CustomerServicePage, InventoryCenterPage, AuditLogsPage', () => {
    const fulfillmentSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/ops/fulfillment/FulfillmentSlaPage.tsx'), 'utf8')
    const csSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/ops/customer-service/CustomerServicePage.tsx'), 'utf8')
    const inventorySource = fs.readFileSync(path.join(SRC_ROOT, 'pages/ops/product-center/InventoryCenterPage.tsx'), 'utf8')
    const auditLogsSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/AuditLogsPage.tsx'), 'utf8')

    // Fulfillment
    assert.match(fulfillmentSource, /useTable</)
    assert.match(fulfillmentSource, /<DataPage<WaybillRow>/)
    assert.match(fulfillmentSource, /api\.get<FulfillmentOverview>\('\/fulfillment\/overview'\)/)
    assert.match(fulfillmentSource, /api\.get<WaybillRow\[\]>\('\/fulfillment\/waybills'/)

    // CS
    assert.match(csSource, /useTable</)
    assert.match(csSource, /<DataPage<CsSessionRow>/)
    assert.match(csSource, /<DataPage<CsAgent>/)
    assert.match(csSource, /api\.get<CsOverview>\('\/cs\/overview'\)/)

    // Inventory
    assert.match(inventorySource, /useTable</)
    assert.match(inventorySource, /<DataPage<ProductItem>/)
    assert.match(inventorySource, /<DataPage<ChannelListingItem>/)
    assert.match(inventorySource, /<DataPage<ReservationItem>/)
    assert.match(inventorySource, /<DataPage<LedgerRow>/)

    // Audit logs
    assert.match(auditLogsSource, /useTable</)
    assert.match(auditLogsSource, /<DataPage/)
  })

  test('Day-2 异步任务看板 (SystemJobsPage) 与数据质量工作台 (DataQualityPage) 门禁联动', () => {
    const jobsSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/SystemJobsPage.tsx'), 'utf8')
    const dqSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/data/DataQualityPage.tsx'), 'utf8')

    // SystemJobsPage
    assert.match(jobsSource, /export function SystemJobsPage/)
    assert.match(jobsSource, /useTable</)
    assert.match(jobsSource, /<DataPage<SystemJob>/)
    assert.match(jobsSource, /api\.get<JobsResponse>\('\/system\/jobs'/)
    assert.match(jobsSource, /api\.post\('\/system\/jobs'/)
    assert.match(jobsSource, /api\.post\(`\/system\/jobs\/\$\{job\.id\}\/cancel`/)

    // /system/jobs 由 route-manifest 驱动
    assert.ok(manifestSource.includes("href: '/system/jobs'"), 'route-manifest 应包含 /system/jobs')

    // DataQualityPage
    assert.match(dqSource, /handleRunQualityGates/)
    assert.match(dqSource, /handleEnqueueQualityGateJob/)
    assert.match(dqSource, /api\.post<BatchQualityReport>\(`\/governance\/batches\/\$\{batchId\}\/run-quality-gates`/)
    assert.match(dqSource, /api\.post\('\/system\/jobs', \{/)
  })

  test('支撑运营页面推广 DataPage + useTable: AlertCenterPage 与 PromotionCampaignsPage', () => {
    const alertSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/AlertCenterPage.tsx'), 'utf8')
    const promoSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/PromotionCampaignsPage.tsx'), 'utf8')

    // AlertCenterPage
    assert.match(alertSource, /export function AlertCenterPage/)
    assert.match(alertSource, /useTable</)
    assert.match(alertSource, /<DataPage<AlertItem>/)
    assert.match(alertSource, /<DataPage<AlertRule>/)
    assert.match(alertSource, /api\.get<any>\('\/api\/system\/alerts'/)
    assert.match(alertSource, /api\.get<AlertRule\[\]>\('\/api\/v1\/alerts\/rules'\)/)
    assert.match(alertSource, /api\.post\('\/api\/v1\/alerts\/rules'/)
    assert.match(alertSource, /api\.delete\(`\/api\/v1\/alerts\/rules\/\$\{id\}`\)/)
    assert.match(alertSource, /api\.put\(`\/api\/v1\/alerts\/rules\/\$\{rule\.id\}`/)
    assert.match(alertSource, /api\.post\('\/api\/v1\/alerts\/rules\/test-webhook'/)

    // PromotionCampaignsPage
    assert.match(promoSource, /export function PromotionCampaignsPage/)
    assert.match(promoSource, /useTable</)
    assert.match(promoSource, /<DataPage<Campaign>/)
    assert.match(promoSource, /api\.get<any>\('\/api\/system\/promotions'/)
    assert.match(promoSource, /api\.post\('\/api\/system\/promotions'/)
    assert.match(promoSource, /api\.get<any>\('\/api\/system\/rooms'\)/)
    assert.match(promoSource, /api\.get<any>\('\/api\/anchors\/list'\)/)
    assert.match(promoSource, /<PromotionLayerSimulator/)
  })

  test('系统配置与字典页面推广 DataPage + useTable: UsersPage 与 DictPage', () => {
    const usersSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/UsersPage.tsx'), 'utf8')
    const dictSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/DictPage.tsx'), 'utf8')

    // UsersPage
    assert.match(usersSource, /export function UsersPage/)
    assert.match(usersSource, /useTable</)
    assert.match(usersSource, /<DataPage<Account>/)
    assert.match(usersSource, /api\.get<Account\[\]>\('\/system\/users'\)/)
    assert.match(usersSource, /api\.post\('\/system\/users'/)
    assert.match(usersSource, /api\.delete\(`\/system\/users\/\$\{id\}`\)/)

    // DictPage
    assert.match(dictSource, /export function DictPage/)
    assert.match(dictSource, /useTable</)
    assert.match(dictSource, /<DataPage<DictItem>/)
    assert.match(dictSource, /api\.get<DictItem\[\]>\('\/system\/dict'\)/)
    assert.match(dictSource, /api\.post\('\/system\/dict'/)
    assert.match(dictSource, /api\.delete\(`\/system\/dict\/\$\{id\}`\)/)
  })

  test('卡片式系统子模块收敛 DataPage + useTable: RoomsSection 与 PersonnelSection', () => {
    const roomsSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/RoomsSection.tsx'), 'utf8')
    const personnelSource = fs.readFileSync(path.join(SRC_ROOT, 'pages/system/PersonnelSection.tsx'), 'utf8')

    // RoomsSection
    assert.match(roomsSource, /export function RoomsSection/)
    assert.match(roomsSource, /useTable</)
    assert.match(roomsSource, /<DataPage<LiveRoom>/)
    assert.match(roomsSource, /api\.get<LiveRoom\[\]>\('\/system\/rooms'\)/)
    assert.match(roomsSource, /api\.post<LiveRoom>\('\/system\/rooms'/)
    assert.match(roomsSource, /api\.put\(`\/system\/rooms\/\$\{editingRoom\.id\}`/)
    assert.match(roomsSource, /api\.delete\(`\/system\/rooms\/\$\{deletingId\}`\)/)

    // PersonnelSection
    assert.match(personnelSource, /export function PersonnelSection/)
    assert.match(personnelSource, /useTable</)
    assert.match(personnelSource, /<DataPage<PersonnelItem>/)
    assert.match(personnelSource, /api\.get<PersonnelItem\[\]>\(`\/personnel\/\$\{plural\(currentTab\)\}`\)/)
    assert.match(personnelSource, /api\.post\(`\/personnel\/\$\{plural\(activeTab\)\}`/)
    assert.match(personnelSource, /api\.put\(`\/personnel\/\$\{plural\(activeTab\)\}\/\$\{editingPerson\.id\}`/)
    assert.match(personnelSource, /api\.delete\(`\/personnel\/\$\{plural\(activeTab\)\}\/\$\{deletingId\}`\)/)
  })
})
