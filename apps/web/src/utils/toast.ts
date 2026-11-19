/**
 * 轻量级全局 Toast 通知组件（无外部依赖，优雅浮动）
 */

type ToastType = 'success' | 'error' | 'info' | 'warning'

function showToast(message: string, type: ToastType = 'success', duration = 3000) {
  if (typeof document === 'undefined') return

  let container = document.getElementById('ai-ops-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'ai-ops-toast-container'
    container.className = 'fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none'
    document.body.appendChild(container)
  }

  const toastEl = document.createElement('div')
  toastEl.className = `pointer-events-auto px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-medium flex items-center gap-2.5 transition-all duration-300 transform translate-y-2 opacity-0 backdrop-blur-xl ${
    type === 'success'
      ? 'bg-slate-900/95 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40'
      : type === 'error'
      ? 'bg-slate-900/95 border-rose-500/40 text-rose-300 shadow-rose-950/40'
      : type === 'warning'
      ? 'bg-slate-900/95 border-amber-500/40 text-amber-300 shadow-amber-950/40'
      : 'bg-slate-900/95 border-cyan-500/40 text-cyan-300 shadow-cyan-950/40'
  }`

  const icon =
    type === 'success'
      ? '✓'
      : type === 'error'
      ? '✕'
      : type === 'warning'
      ? '⚠'
      : 'ℹ'

  toastEl.innerHTML = `
    <span class="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[10px] ${
      type === 'success'
        ? 'bg-emerald-500/20 text-emerald-400'
        : type === 'error'
        ? 'bg-rose-500/20 text-rose-400'
        : type === 'warning'
        ? 'bg-amber-500/20 text-amber-400'
        : 'bg-cyan-500/20 text-cyan-400'
    }">${icon}</span>
    <span>${message}</span>
  `

  container.appendChild(toastEl)

  // Animate in
  requestAnimationFrame(() => {
    toastEl.classList.remove('translate-y-2', 'opacity-0')
    toastEl.classList.add('translate-y-0', 'opacity-100')
  })

  // Auto remove
  setTimeout(() => {
    toastEl.classList.remove('translate-y-0', 'opacity-100')
    toastEl.classList.add('-translate-y-2', 'opacity-0')
    setTimeout(() => {
      toastEl.remove()
      if (container && container.children.length === 0) {
        container.remove()
      }
    }, 300)
  }, duration)
}

export const toast = {
  success: (msg: string, duration?: number) => showToast(msg, 'success', duration),
  error: (msg: string, duration?: number) => showToast(msg, 'error', duration),
  warning: (msg: string, duration?: number) => showToast(msg, 'warning', duration),
  info: (msg: string, duration?: number) => showToast(msg, 'info', duration),
}
