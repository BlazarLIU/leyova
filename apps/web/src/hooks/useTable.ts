import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

export type SortOrder = 'asc' | 'desc'

export interface TableFetchParams<TFilter = Record<string, any>> {
  page: number
  pageSize: number
  sortBy?: string
  sortOrder?: SortOrder
  search?: string
  filters: TFilter
}

export type FetchDataResponse<T> =
  | { items: T[]; total: number; stats?: Record<string, any> }
  | { data: T[]; total: number; stats?: Record<string, any> }
  | { list: T[]; total: number }
  | T[]

export interface UseTableOptions<T, TFilter = Record<string, any>> {
  fetchData: (params: TableFetchParams<TFilter>) => Promise<FetchDataResponse<T>>
  initialPage?: number
  initialPageSize?: number
  initialSortBy?: string
  initialSortOrder?: SortOrder
  initialFilters?: TFilter
  initialSearch?: string
  debounceMs?: number
  autoFetch?: boolean
  getRowId?: (row: T, index: number) => string | number
  onSuccess?: (data: T[], total: number) => void
  onError?: (error: Error) => void
}

export interface UseTableReturn<T, TFilter = Record<string, any>> {
  // Data state
  data: T[]
  total: number
  totalPages: number
  loading: boolean
  error: Error | null
  stats: Record<string, any> | undefined

  // Query params
  page: number
  pageSize: number
  sortBy: string | undefined
  sortOrder: SortOrder | undefined
  search: string
  filters: TFilter
  hasActiveFilters: boolean

  // Mutators
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  setSearch: (search: string) => void
  setSort: (column: string, order?: SortOrder) => void
  setFilter: <K extends keyof TFilter>(key: K, value: TFilter[K]) => void
  setFilters: (updater: Partial<TFilter> | ((prev: TFilter) => TFilter)) => void
  resetFilters: () => void
  reload: () => Promise<void>

  // Row selection
  selectedRowKeys: Set<string | number>
  selectedRows: T[]
  isRowSelected: (key: string | number) => boolean
  toggleSelectRow: (key: string | number, row: T) => void
  toggleSelectAll: () => void
  setSelectedRowKeys: (keys: Set<string | number> | ((prev: Set<string | number>) => Set<string | number>)) => void
  clearSelection: () => void

  // Export
  exportCsv: (filename?: string, columnHeaders?: { key: keyof T | string; label: string }[]) => void
}

export function useTable<T, TFilter extends Record<string, any> = Record<string, any>>(
  options: UseTableOptions<T, TFilter>
): UseTableReturn<T, TFilter> {
  const {
    fetchData,
    initialPage = 1,
    initialPageSize = 20,
    initialSortBy,
    initialSortOrder,
    initialFilters = {} as TFilter,
    initialSearch = '',
    debounceMs = 300,
    autoFetch = true,
    getRowId = (row: any, idx: number) => row?.id ?? row?.key ?? row?.code ?? idx,
    onSuccess,
    onError,
  } = options

  // State
  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [stats, setStats] = useState<Record<string, any> | undefined>(undefined)

  const [page, setPageState] = useState<number>(initialPage)
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize)
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy)
  const [sortOrder, setSortOrder] = useState<SortOrder | undefined>(initialSortOrder)
  const [search, setSearchState] = useState<string>(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialSearch)
  const [filters, setFiltersState] = useState<TFilter>(initialFilters)

  // Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string | number>>(new Set())

  // Keep track of search debounce timer
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchSeqRef = useRef<number>(0)

  // Debounce search update
  const setSearch = useCallback((val: string) => {
    setSearchState(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPageState(1)
    }, debounceMs)
  }, [debounceMs])

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Page mutator
  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, newPage))
  }, [])

  // Page size mutator
  const setPageSize = useCallback((newPageSize: number) => {
    setPageSizeState(newPageSize)
    setPageState(1)
  }, [])

  // Sort mutator
  const setSort = useCallback((column: string, order?: SortOrder) => {
    if (order) {
      setSortBy(column)
      setSortOrder(order)
    } else {
      // Toggle logic: undefined -> 'asc' -> 'desc' -> undefined
      if (sortBy !== column) {
        setSortBy(column)
        setSortOrder('asc')
      } else if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortBy(undefined)
        setSortOrder(undefined)
      }
    }
    setPageState(1)
  }, [sortBy, sortOrder])

  // Filter mutators
  const setFilter = useCallback(<K extends keyof TFilter>(key: K, value: TFilter[K]) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }))
    setPageState(1)
  }, [])

  const setFilters = useCallback((updater: Partial<TFilter> | ((prev: TFilter) => TFilter)) => {
    setFiltersState((prev) => {
      if (typeof updater === 'function') {
        return updater(prev)
      }
      return { ...prev, ...updater }
    })
    setPageState(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters)
    setSearchState(initialSearch)
    setDebouncedSearch(initialSearch)
    setSortBy(initialSortBy)
    setSortOrder(initialSortOrder)
    setPageState(1)
  }, [initialFilters, initialSearch, initialSortBy, initialSortOrder])

  const hasActiveFilters = useMemo(() => {
    if (search.trim().length > 0) return true
    for (const [key, val] of Object.entries(filters)) {
      if (val !== undefined && val !== null && val !== '' && val !== (initialFilters as any)[key]) {
        return true
      }
    }
    return false
  }, [search, filters, initialFilters])

  // Execute fetch
  const executeFetch = useCallback(async () => {
    const seq = ++fetchSeqRef.current
    setLoading(true)
    setError(null)

    try {
      const res = await fetchData({
        page,
        pageSize,
        sortBy,
        sortOrder,
        search: debouncedSearch.trim() || undefined,
        filters,
      })

      // Ignore stale responses
      if (seq !== fetchSeqRef.current) return

      let items: T[] = []
      let totalCount = 0
      let fetchedStats: Record<string, any> | undefined

      if (Array.isArray(res)) {
        items = res
        totalCount = res.length
      } else if (res && typeof res === 'object') {
        if ('items' in res && Array.isArray(res.items)) {
          items = res.items
          totalCount = res.total ?? res.items.length
          fetchedStats = res.stats
        } else if ('data' in res && Array.isArray(res.data)) {
          items = res.data
          totalCount = res.total ?? res.data.length
          fetchedStats = res.stats
        } else if ('list' in res && Array.isArray(res.list)) {
          items = res.list
          totalCount = res.total ?? res.list.length
        }
      }

      setData(items)
      setTotal(totalCount)
      setStats(fetchedStats)
      onSuccess?.(items, totalCount)
    } catch (err: any) {
      if (seq !== fetchSeqRef.current) return
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e)
      onError?.(e)
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoading(false)
      }
    }
  }, [fetchData, page, pageSize, sortBy, sortOrder, debouncedSearch, filters, onSuccess, onError])

  // Trigger on query dependencies changed
  useEffect(() => {
    if (autoFetch) {
      executeFetch()
    }
  }, [executeFetch, autoFetch])

  const reload = useCallback(async () => {
    await executeFetch()
  }, [executeFetch])

  // Selection handlers
  const isRowSelected = useCallback((key: string | number) => {
    return selectedRowKeys.has(key)
  }, [selectedRowKeys])

  const toggleSelectRow = useCallback((key: string | number, _row: T) => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelectedRowKeys((prev) => {
      const allCurrentKeys = data.map((r, i) => getRowId(r, i))
      const allSelected = allCurrentKeys.every((k) => prev.has(k))

      const next = new Set(prev)
      if (allSelected) {
        allCurrentKeys.forEach((k) => next.delete(k))
      } else {
        allCurrentKeys.forEach((k) => next.add(k))
      }
      return next
    })
  }, [data, getRowId])

  const clearSelection = useCallback(() => {
    setSelectedRowKeys(new Set())
  }, [])

  const selectedRows = useMemo(() => {
    return data.filter((r, i) => selectedRowKeys.has(getRowId(r, i)))
  }, [data, selectedRowKeys, getRowId])

  // CSV Export utility
  const exportCsv = useCallback((filename = 'export_data.csv', columnHeaders?: { key: keyof T | string; label: string }[]) => {
    if (!data || data.length === 0) return

    // Determine columns
    const cols = columnHeaders && columnHeaders.length > 0
      ? columnHeaders
      : Object.keys(data[0] as object).map((k) => ({ key: k, label: k }))

    // Build header row
    const headerRow = cols.map((c) => `"${String(c.label).replace(/"/g, '""')}"`).join(',')

    // Build data rows
    const rows = data.map((item: any) =>
      cols
        .map((c) => {
          const val = item[c.key]
          if (val === null || val === undefined) return '""'
          const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
          return `"${str.replace(/"/g, '""')}"`
        })
        .join(',')
    )

    // Prefix UTF-8 BOM for Excel compatibility
    const csvContent = '\uFEFF' + [headerRow, ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [data])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return {
    data,
    total,
    totalPages,
    loading,
    error,
    stats,

    page,
    pageSize,
    sortBy,
    sortOrder,
    search,
    filters,
    hasActiveFilters,

    setPage,
    setPageSize,
    setSearch,
    setSort,
    setFilter,
    setFilters,
    resetFilters,
    reload,

    selectedRowKeys,
    selectedRows,
    isRowSelected,
    toggleSelectRow,
    toggleSelectAll,
    setSelectedRowKeys,
    clearSelection,

    exportCsv,
  }
}
