import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api } from '@/services/api'

export interface AiOpsSession {
  id: number
  title: string
  roomName: string
  anchorName: string
  date: string
  startTime: string
  endTime: string
  status: 'live' | 'scheduled' | 'completed' | 'ended'
  gmv: number
  roi?: number
}

interface AiOpsSessionContextValue {
  selectedSessionId: number | null
  currentSession: AiOpsSession | null
  sessionList: AiOpsSession[]
  loading: boolean
  selectSession: (id: number) => void
  refreshSessions: () => Promise<void>
}

const AiOpsSessionContext = createContext<AiOpsSessionContextValue | undefined>(undefined)

const STORAGE_KEY = 'ai_ops_active_session_id'

export function AiOpsSessionProvider({ children }: { children: ReactNode }) {
  const [sessionList, setSessionList] = useState<AiOpsSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? parseInt(saved, 10) : null
  })
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await api.get('/overview/sessions')
      const items: any[] = res?.sessions || res?.data?.sessions || (Array.isArray(res) ? res : [])

      if (Array.isArray(items) && items.length > 0) {
        const mapped: AiOpsSession[] = items.map((s) => ({
          id: Number(s.id),
          title: s.title || `【${s.room || '官方直播间'}】${s.anchor || '主力主播'}专场`,
          roomName: s.room || s.roomName || '官方直播间',
          anchorName: s.anchor || s.anchorName || '签约主播',
          date: s.date || String(new Date().toISOString().slice(0, 10)),
          startTime: s.start_time || s.startTime || '19:00',
          endTime: s.end_time || s.endTime || '23:30',
          status: s.status === 'live' ? 'live' : s.status === 'scheduled' ? 'scheduled' : 'completed',
          gmv: Number(s.gmv || 0),
          roi: Number(s.roi || 0),
        }))

        setSessionList(mapped)

        // 智能选定场次：优先恢复保存的 ID，其次找 live 场，再找 scheduled 场，最后默认第一场
        setSelectedSessionId((prev) => {
          if (prev && mapped.some((m) => m.id === prev)) {
            return prev
          }
          const live = mapped.find((m) => m.status === 'live')
          if (live) return live.id
          const scheduled = mapped.find((m) => m.status === 'scheduled')
          if (scheduled) return scheduled.id
          return mapped[0]?.id || null
        })
      } else {
        // 后备演示场次（保证极端情况下系统可用）
        const fallbacks: AiOpsSession[] = [
          {
            id: 102,
            title: '【晚间黄金场】秋冬服饰新品大爆场',
            roomName: '服饰旗舰直播间',
            anchorName: '沈主播',
            date: new Date().toISOString().slice(0, 10),
            startTime: '19:00',
            endTime: '23:30',
            status: 'live',
            gmv: 142000,
            roi: 2.8,
          },
          {
            id: 101,
            title: '【早场晨播】美妆个护心选专场',
            roomName: '官方1号直播间',
            anchorName: '林主播',
            date: new Date().toISOString().slice(0, 10),
            startTime: '08:30',
            endTime: '12:00',
            status: 'completed',
            gmv: 65000,
            roi: 2.2,
          },
        ]
        setSessionList(fallbacks)
        setSelectedSessionId((prev) => prev || 102)
      }
    } catch {
      // 网络或接口异常时后备
      setSelectedSessionId((prev) => prev || 102)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const selectSession = useCallback((id: number) => {
    setSelectedSessionId(id)
    localStorage.setItem(STORAGE_KEY, String(id))
  }, [])

  const currentSession = sessionList.find((s) => s.id === selectedSessionId) || sessionList[0] || null

  return (
    <AiOpsSessionContext.Provider
      value={{
        selectedSessionId,
        currentSession,
        sessionList,
        loading,
        selectSession,
        refreshSessions: fetchSessions,
      }}
    >
      {children}
    </AiOpsSessionContext.Provider>
  )
}

export function useAiOpsSession() {
  const ctx = useContext(AiOpsSessionContext)
  if (!ctx) {
    throw new Error('useAiOpsSession must be used within an AiOpsSessionProvider')
  }
  return ctx
}
