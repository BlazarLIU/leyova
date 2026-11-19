import { motion } from 'framer-motion'
import { Video } from 'lucide-react'

export function VideoCreatePage() {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-[1600px]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">视频创作</h1>
            <p className="text-[var(--text-muted)] text-sm mt-1">AI 视频生成页面</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <div className="flex flex-col items-center justify-center py-24 rounded-xl border border-dashed border-orbit-border2 bg-orbit-surface">
          <Video className="w-10 h-10 text-[var(--text-primary)] mb-4" />
          <p className="text-lg font-medium text-[var(--text-muted)]">正在开发</p>
          <p className="text-sm text-[var(--text-primary)] mt-1">即将上线</p>
        </div>
      </motion.div>
    </div>
  )
}
