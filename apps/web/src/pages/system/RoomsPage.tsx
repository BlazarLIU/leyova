import { useState } from 'react'
import { Radio } from 'lucide-react'
import type { LiveRoom } from '@/types'
import { RoomsSection } from './RoomsSection'

/** 直播间管理独立页（对应 system_rooms 模块，支持运营总监 / Admin / Super Admin） */
export function RoomsPage() {
  const [rooms, setRooms] = useState<LiveRoom[]>([])

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 max-w-[1600px] w-full">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-orbit-primary/10 border border-orbit-primary/20">
          <Radio className="w-6 h-6 text-orbit-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">直播间管理</h1>
          <p className="text-sm text-[var(--text-muted)]">配置直播间基本信息、所属平台及开播运行状态</p>
        </div>
      </div>

      <RoomsSection rooms={rooms} onRoomsChange={setRooms} />
    </div>
  )
}

