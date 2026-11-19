import React, { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, X, Check, Search } from 'lucide-react'

export interface SearchableSelectOption {
  value: string | number
  label: string
  subLabel?: string
  badge?: string
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string | number
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  emptyMessage?: string
  allowClear?: boolean
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '请选择或输入搜索...',
  className = '',
  disabled = false,
  emptyMessage = '未找到匹配项',
  allowClear = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 当前选中的项
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value))
  }, [options, value])

  // 当外部 value 改变时，同步输入框展示文案
  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedOption.label)
    } else if (!value) {
      setQuery('')
    }
  }, [selectedOption, value])

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        // 恢复成选中的选项文字
        if (selectedOption) {
          setQuery(selectedOption.label)
        } else {
          setQuery('')
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [selectedOption])

  // 模糊匹配选项
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q)
      const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(q) : false
      const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(q) : false
      return matchLabel || matchSub || matchBadge
    })
  }, [options, query])

  const handleSelect = (val: string | number) => {
    onChange(String(val))
    const opt = options.find((o) => String(o.value) === String(val))
    if (opt) setQuery(opt.label)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div
        className={`flex items-center justify-between w-full h-9 rounded-lg border px-3 text-xs transition-colors cursor-pointer ${
          disabled
            ? 'bg-orbit-surface2/50 border-orbit-border/50 text-slate-500 cursor-not-allowed'
            : isOpen
            ? 'bg-orbit-surface border-orbit-primary ring-1 ring-orbit-primary/30 text-slate-200'
            : 'bg-orbit-surface2 border-orbit-border text-slate-200 hover:border-orbit-border2'
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true)
            inputRef.current?.focus()
          }
        }}
      >
        <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (!isOpen) setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-500 truncate"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1.5 text-slate-400">
          {allowClear && query && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:text-slate-200 hover:bg-white/10"
              title="清除选择"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-orbit-primary' : ''}`}
          />
        </div>
      </div>

      {/* 下拉面板 */}
      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto rounded-xl border border-orbit-border bg-orbit-surface shadow-2xl p-1 divide-y divide-orbit-border/40">
          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center text-[11px] text-slate-500 flex flex-col items-center gap-1">
              <Search className="w-3.5 h-3.5 text-slate-600" />
              <span>{emptyMessage}</span>
            </div>
          ) : (
            <div className="py-0.5">
              {filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value)
                return (
                  <div
                    key={String(opt.value)}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-orbit-primary/20 text-orbit-primary-light font-semibold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span className="text-[10px] text-slate-500 font-mono shrink-0">
                          {opt.subLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-surface2 text-cyan-400 border border-orbit-border/60">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-orbit-primary-light" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
