import { useState, useEffect } from 'react'
import type { Theme } from '@/types'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('orbit-theme')
    // 品牌默认浅色（Snow White 底），用户显式选择深色后才进入 Ink 主题
    return stored === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('orbit-theme', theme)
    window.dispatchEvent(new CustomEvent('orbit-theme-change', { detail: theme }))
  }, [theme])

  useEffect(() => {
    const handler = (e: Event) => {
      const newTheme = (e as CustomEvent).detail as Theme
      if (newTheme && newTheme !== theme) {
        setTheme(newTheme)
      }
    }
    window.addEventListener('orbit-theme-change', handler)
    return () => window.removeEventListener('orbit-theme-change', handler)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}
