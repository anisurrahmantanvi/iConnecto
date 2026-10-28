import { useCallback, useEffect, useRef, useState } from 'react'
import type { Page } from '@/types/db'
import { errorMessage } from '@/lib/supabase'

export function useDebounce<T>(value: T, delay = 350): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay)
    return () => window.clearTimeout(t)
  }, [value, delay])
  return v
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export interface PagedState<T> {
  items: T[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  reload: () => void
  setItems: (updater: (prev: T[]) => T[]) => void
}

/**
 * Cursor-paginated list loader. `fetchPage` must be stable (wrap in useCallback); when it changes the list reloads.
 * Stale responses from an older fetchPage are ignored.
 */
export function usePaged<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>, enabled = true): PagedState<T> {
  const [items, setItemsState] = useState<T[]>([])
  const [loading, setLoading] = useState(enabled)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const generation = useRef(0)
  const busy = useRef(false)

  const run = useCallback(
    async (reset: boolean, from: string | null) => {
      const gen = reset ? ++generation.current : generation.current
      busy.current = true
      if (reset) setLoading(true)
      else setLoadingMore(true)
      setError(null)
      try {
        const page = await fetchPage(from)
        if (gen !== generation.current) return
        setItemsState((prev) => (reset ? page.items : [...prev, ...page.items]))
        setCursor(page.nextCursor)
        setHasMore(page.nextCursor !== null)
      } catch (e) {
        if (gen !== generation.current) return
        setError(errorMessage(e))
      } finally {
        if (gen === generation.current) {
          setLoading(false)
          setLoadingMore(false)
          busy.current = false
        }
      }
    },
    [fetchPage],
  )

  useEffect(() => {
    if (!enabled) {
      setItemsState([])
      setLoading(false)
      setHasMore(false)
      return
    }
    void run(true, null)
  }, [run, enabled])

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore || !cursor) return
    void run(false, cursor)
  }, [run, hasMore, cursor])

  const reload = useCallback(() => void run(true, null), [run])
  const setItems = useCallback((updater: (prev: T[]) => T[]) => setItemsState(updater), [])

  return { items, loading, loadingMore, error, hasMore, loadMore, reload, setItems }
}

/** Calls onVisible when the sentinel element scrolls into view (infinite scroll). */
export function useInfiniteSentinel(onVisible: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const cb = useRef(onVisible)
  cb.current = onVisible
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && cb.current(), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [enabled])
  return ref
}

/** Runs an async loader once per dependency change with loading/error state. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loader()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, setData, loading, error, reload: () => setTick((t) => t + 1) }
}
