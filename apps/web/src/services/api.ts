const API_BASE = '/api'

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | undefined>
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function buildUrl(endpoint: string): string {
  // Prevent double /api/ — if endpoint already starts with /api/, strip it
  const clean = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint
  // All backend routes are under /api/v1/ — auto-add v1 if not present
  if (clean.startsWith('/v1/')) {
    return `${API_BASE}${clean}`
  }
  return `${API_BASE}/v1${clean}`
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options

  // Build URL
  let url = buildUrl(endpoint)
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) searchParams.set(key, String(value))
    })
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }

  // Default headers
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...((fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH')
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(fetchOptions.headers as Record<string, string>),
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  })

  const responseData = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      responseData?.message || `HTTP ${response.status}`,
      response.status,
      responseData?.error
    )
  }

  // Auto-unwrap {success, data} response format
  if (responseData && typeof responseData === 'object' && 'success' in responseData && 'data' in responseData) {
    return responseData.data
  }

  return responseData
}

// Convenience methods
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string | number | undefined>) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  streamPost: (endpoint: string, body?: unknown) => {
    const clean = endpoint.startsWith('/api/') ? endpoint.slice(4) : endpoint
    const url = clean.startsWith('/v1/') ? `${API_BASE}${clean}` : `${API_BASE}/v1${clean}`
    return fetch(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      headers: {
        'Accept': 'text/event-stream',
        'Content-Type': 'application/json',
      },
    })
  },
}