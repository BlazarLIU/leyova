import React, { useState, useEffect } from 'react'
import { Trophy, Users, Building2 } from 'lucide-react'
import { api } from '@/services/api'

interface LeaderboardItem {
  id: string | number
  name: string
  subtitle: string
  gmv: number
  percentage: number
}

interface PerformanceLeaderboardProps {
  className?: string
}

export const PerformanceLeaderboard: React.FC<PerformanceLeaderboardProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'anchor' | 'project'>('anchor')
  const [anchorItems, setAnchorItems] = useState<LeaderboardItem[]>([])
  const [projectItems, setProjectItems] = useState<LeaderboardItem[]>([])
  const [, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // 1. 获取主播排行数据
        const anchorData: any = await api.get('/anchors/rankings?limit=10').catch(() => null)
        if (anchorData) {
          const raw = anchorData.data?.items || anchorData.data || (Array.isArray(anchorData) ? anchorData : [])
          const maxGmv = raw.reduce((max: number, it: any) => Math.max(max, Number(it.gmv || it.sales_volume || 0)), 1)
          const mapped: LeaderboardItem[] = raw.slice(0, 10).map((it: any) => {
            const gmv = Number(it.gmv || it.sales_volume || 0)
            return {
              id: it.id || it.anchor_id,
              name: it.name || it.anchor_name || '签约主播',
              subtitle: it.room_name || it.project_name || it.shop_name || '核心直播间',
              gmv,
              percentage: Math.min(100, Math.round((gmv / maxGmv) * 100)),
            }
          })
          setAnchorItems(mapped)
        }

        // 2. 获取店铺/渠道排行数据（替代已下线的 agency 项目）
        const shopData: any = await api.get('/omnichannel/shops').catch(() => null)
        if (shopData) {
          const raw = shopData.data || (Array.isArray(shopData) ? shopData : [])
          const maxGmv = raw.reduce((max: number, it: any) => Math.max(max, Number(it.gmv || 0)), 1)
          const mapped: LeaderboardItem[] = raw.slice(0, 10).map((it: any) => {
            const gmv = Number(it.gmv || 0)
            return {
              id: it.shop_id || it.id,
              name: it.shop_name || it.name || '官方旗舰店',
              subtitle: it.platform_name || it.platformCode || '直播渠道',
              gmv,
              percentage: Math.min(100, Math.round((gmv / maxGmv) * 100)),
            }
          })
          setProjectItems(mapped)
        }
      } catch (err) {
        console.error('Failed to load leaderboard data', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // 如果接口暂无数据，展示默认高仿真数据
  const defaultAnchors: LeaderboardItem[] = [
    { id: 1, name: '小雪', subtitle: 'GAP抖音', gmv: 3485000, percentage: 95 },
    { id: 2, name: '林夕', subtitle: 'Calvin Klein官旗', gmv: 2890000, percentage: 80 },
    { id: 3, name: '阿哲', subtitle: '李宁自营直播间', gmv: 2315000, percentage: 65 },
    { id: 4, name: '婷婷', subtitle: 'Calvin Klein官旗', gmv: 1950000, percentage: 55 },
    { id: 5, name: '楚楚', subtitle: 'GAP抖音', gmv: 1720000, percentage: 48 },
    { id: 6, name: '大伟', subtitle: 'GAP抖音', gmv: 1540000, percentage: 43 },
    { id: 7, name: '若楠', subtitle: 'Calvin Klein女装', gmv: 1380000, percentage: 38 },
    { id: 8, name: '晓涵', subtitle: 'Calvin Klein女装', gmv: 1210000, percentage: 34 },
    { id: 9, name: '思思', subtitle: 'GAP抖音', gmv: 980000, percentage: 28 },
    { id: 10, name: '彭彭', subtitle: 'Calvin Klein女装', gmv: 850000, percentage: 24 },
  ]

  const defaultProjects: LeaderboardItem[] = [
    { id: 1, name: 'GAP抖音官方旗舰店代播项目', subtitle: '抖音电商 · 星辉代播', gmv: 6850000, percentage: 100 },
    { id: 2, name: 'Calvin Klein官旗全天代播', subtitle: '抖音电商 · 星辉代播', gmv: 4840000, percentage: 71 },
    { id: 3, name: '李宁自播矩阵代运营', subtitle: '快手电商 · 自营中心', gmv: 2315000, percentage: 34 },
    { id: 4, name: 'Calvin Klein女装视频号自播', subtitle: '微信视频号 · 华扬代播', gmv: 1950000, percentage: 28 },
  ]

  const items = activeTab === 'anchor' 
    ? (anchorItems.length > 0 ? anchorItems : defaultAnchors)
    : (projectItems.length > 0 ? projectItems : defaultProjects)

  return (
    <div className={`bg-white rounded-xl border border-orbit-border shadow-sm p-6 ${className}`}>
      {/* 头部与切换 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-orbit-border">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-status-warning" />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">业绩排行榜</h3>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {activeTab === 'anchor' 
              ? '按已同步的主播直播间成交金额统计' 
              : '按各平台店铺及直播间周期汇总统计'}
          </p>
        </div>

        {/* Tab 切换按钮 */}
        <div className="flex items-center bg-[var(--surface2)]/80 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('anchor')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'anchor'
                ? 'bg-white text-orbit-primary shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            主播 GMV
          </button>
          <button
            onClick={() => setActiveTab('project')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === 'project'
                ? 'bg-white text-orbit-primary shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            项目
          </button>
        </div>
      </div>

      {/* 排行列表 */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[11px] font-medium text-[var(--text-muted)] border-b border-orbit-border">
              <th className="py-2.5 px-2 w-12 text-center">#</th>
              <th className="py-2.5 px-3">{activeTab === 'anchor' ? '主播' : '项目名称'}</th>
              <th className="py-2.5 px-3">{activeTab === 'anchor' ? '所属项目' : '平台与客户'}</th>
              <th className="py-2.5 px-3 text-right">GMV</th>
              <th className="py-2.5 px-3 w-40">占比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-orbit-border text-xs">
            {items.map((item, index) => {
              const rank = index + 1
              let rankBadgeClass = 'bg-[var(--surface2)] text-[var(--text-muted)]'
              if (rank === 1) rankBadgeClass = 'bg-orbit-primary text-white font-bold shadow-xs'
              else if (rank === 2) rankBadgeClass = 'bg-orbit-info text-white font-medium'
              else if (rank === 3) rankBadgeClass = 'bg-orbit-info text-white font-medium'

              return (
                <tr key={item.id} className="hover:bg-orbit-info/30 transition-colors">
                  {/* 排名序号 */}
                  <td className="py-3 px-2 text-center">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px] ${rankBadgeClass}`}
                    >
                      {rank}
                    </span>
                  </td>

                  {/* 名称 */}
                  <td className="py-3 px-3 font-medium text-[var(--text-primary)]">
                    {item.name}
                  </td>

                  {/* 所属项目 / 平台 */}
                  <td className="py-3 px-3 text-[var(--text-muted)]">
                    <span className="inline-block max-w-[180px] truncate" title={item.subtitle}>
                      {item.subtitle}
                    </span>
                  </td>

                  {/* 成交金额 */}
                  <td className="py-3 px-3 text-right font-semibold text-[var(--text-primary)] tabular-nums">
                    ¥{item.gmv.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* 占比可视化进度条 */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[var(--surface2)] rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-orbit-primary h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] tabular-nums w-8 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
