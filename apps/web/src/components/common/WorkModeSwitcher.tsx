import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Store, Globe, ChevronDown, Check } from 'lucide-react'
import { useWorkMode, WorkMode, WORK_MODES } from '@/hooks/useWorkMode'
import { useNavigate, useLocation } from 'react-router-dom'

export const WorkModeSwitcher: React.FC = () => {
  const { workMode, setWorkMode, currentModeInfo } = useWorkMode()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleSelectMode = (mode: WorkMode) => {
    setWorkMode(mode)
    setIsOpen(false)

    // 智能导向：如果切换到代运营模式且当前不在代运营核心页面，则自动导向驾驶舱
    if (mode === 'agency' && (location.pathname.startsWith('/shop') || location.pathname.startsWith('/omnichannel'))) {
      navigate('/overview/cockpit')
    } else if (mode === 'brand' && location.pathname.startsWith('/agency')) {
      navigate('/omnichannel/dashboard')
    }
  }

  const getModeIcon = (mode: WorkMode) => {
    switch (mode) {
      case 'agency':
        return <Building2 className="w-3.5 h-3.5 text-purple-400" />
      case 'brand':
        return <Store className="w-3.5 h-3.5 text-blue-400" />
      case 'all':
      default:
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />
    }
  }

  return (
    <div ref={containerRef} className="relative z-30">
      {/* 模式选择主按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/90 hover:bg-gray-800 border border-gray-700/80 transition-all text-xs font-medium text-gray-200 shadow-xs"
        title="点击切换工作模式（代运营 / 品牌自播 / 全功能）"
      >
        <div className="flex items-center gap-1.5">
          {getModeIcon(workMode)}
          <span className="font-semibold">{currentModeInfo.shortLabel}</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${currentModeInfo.badgeColor}`}>
          {workMode.toUpperCase()}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-2 space-y-1 text-xs"
          >
            <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 border-b border-gray-800 flex items-center justify-between">
              <span>切换系统展示模块</span>
              <span className="text-[10px] text-gray-500">3 种工作视图</span>
            </div>

            {(['agency', 'brand', 'all'] as WorkMode[]).map((mode) => {
              const info = WORK_MODES[mode]
              const isSelected = workMode === mode

              return (
                <button
                  key={mode}
                  onClick={() => handleSelectMode(mode)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-gray-800/90 border border-gray-600/60 shadow-xs'
                      : 'hover:bg-gray-800/40 border border-transparent'
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-gray-800 border border-gray-700">
                    {getModeIcon(mode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {info.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">
                      {info.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default WorkModeSwitcher

