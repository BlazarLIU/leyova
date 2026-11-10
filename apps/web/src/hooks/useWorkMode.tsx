import React, { createContext, useContext, useState } from 'react'

export type WorkMode = 'agency' | 'brand' | 'all'

export interface WorkModeInfo {
  mode: WorkMode
  label: string
  shortLabel: string
  description: string
  iconName: string
  badgeColor: string
}

export const WORK_MODES: Record<WorkMode, WorkModeInfo> = {
  agency: {
    mode: 'agency',
    label: '代运营模式 (MCN 专业版)',
    shortLabel: '代运营 MCN',
    description: '专注直播代运营与 MCN 机构：多品牌客户管理、主播排班调度与月度结算对账',
    iconName: 'Building2',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
  brand: {
    mode: 'brand',
    label: '品牌自播模式 (全渠道)',
    shortLabel: '品牌自营',
    description: '专注品牌自营全平台经营决策：7大平台货架大盘、真实净利算法与 AI 助手',
    iconName: 'Store',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  all: {
    mode: 'all',
    label: '全功能模式 (综合大盘)',
    shortLabel: '全功能总览',
    description: '集团管理与对外演示全开模式：同时包含代运营 MCN 与品牌自播的全部功能',
    iconName: 'Globe',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
}

interface WorkModeContextValue {
  workMode: WorkMode
  setWorkMode: (mode: WorkMode) => void
  currentModeInfo: WorkModeInfo
}

const WorkModeContext = createContext<WorkModeContextValue>({
  workMode: 'all',
  setWorkMode: () => {},
  currentModeInfo: WORK_MODES.all,
})

export const WorkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workMode, setWorkModeState] = useState<WorkMode>(() => {
    const saved = localStorage.getItem('leyova_work_mode') as WorkMode
    return saved && WORK_MODES[saved] ? saved : 'all'
  })

  const setWorkMode = (mode: WorkMode) => {
    setWorkModeState(mode)
    localStorage.setItem('leyova_work_mode', mode)
  }

  return (
    <WorkModeContext.Provider
      value={{
        workMode,
        setWorkMode,
        currentModeInfo: WORK_MODES[workMode],
      }}
    >
      {children}
    </WorkModeContext.Provider>
  )
}

export function useWorkMode() {
  return useContext(WorkModeContext)
}
export default useWorkMode
