"use client"

import * as React from "react"

interface CacheEntry<T> {
  data: T | null
  error: Error | null
  updatedAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

/**
 * Module-level store shared by every useCached consumer.
 *
 * `store.signal` is what makes a manual refresh actually refetch. The
 * fetching effect below keys on [key, staleMs, signal], so deleting a cache
 * entry on its own would leave the component rendering its loading state
 * forever. Bumping the signal re-runs every mounted effect, which is how a
 * control elsewhere on the page (the event header's refresh button) can
 * invalidate reads it does not itself own.
 *
 * Mutable values live on a holder object rather than module `let` bindings
 * so the React compiler lint rules treat writes as property updates.
 */
const store = { signal: 0, pending: 0 }
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of [...listeners]) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSignal(): number {
  return store.signal
}

function getPending(): number {
  return store.pending
}

function bumpSignal(): void {
  store.signal += 1
  notify()
}

function trackStart(): void {
  store.pending += 1
  notify()
}

function trackSettle(): void {
  store.pending = Math.max(0, store.pending - 1)
  notify()
}

/**
 * Invalidates every cached read and makes mounted consumers refetch.
 * In-flight requests are dropped from the map but still settle, so the
 * pending count stays balanced.
 */
export function refreshAllReads(): void {
  for (const key of [...cache.keys()]) cache.delete(key)
  for (const key of [...inflight.keys()]) inflight.delete(key)
  bumpSignal()
}

/**
 * Minimal stale-while-revalidate cache for reads.
 * Batch-friendly: dedupes in-flight requests by key.
 * Loading is derived from cache presence (no sync setState in effects).
 */
export function useCached<T>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  staleMs = 10_000
): { data: T | null; error: Error | null; loading: boolean; refresh: () => void } {
  const [, force] = React.useReducer((n: number) => n + 1, 0)
  const fetcherRef = React.useRef(fetcher)
  const signal = React.useSyncExternalStore(subscribe, getSignal, getSignal)

  React.useEffect(() => {
    fetcherRef.current = fetcher
  }, [fetcher])

  const refresh = React.useCallback(() => {
    if (!key) return
    cache.delete(key)
    inflight.delete(key)
    bumpSignal()
  }, [key])

  React.useEffect(() => {
    if (!key || !fetcherRef.current) return
    const currentKey = key
    const entry = cache.get(currentKey) as CacheEntry<T> | undefined
    const fresh = entry && Date.now() - entry.updatedAt < staleMs
    if (entry && fresh) return

    let cancelled = false
    let promise = inflight.get(currentKey) as Promise<T> | undefined
    if (!promise && fetcherRef.current) {
      const run = fetcherRef.current
      promise = run()
      inflight.set(currentKey, promise)
      trackStart()
      force()
    }
    promise
      ?.then((data) => {
        inflight.delete(currentKey)
        cache.set(currentKey, { data, error: null, updatedAt: Date.now() })
        trackSettle()
        if (!cancelled) force()
      })
      .catch((error: Error) => {
        inflight.delete(currentKey)
        cache.set(currentKey, { data: null, error, updatedAt: Date.now() })
        trackSettle()
        if (!cancelled) force()
      })
    return () => {
      cancelled = true
    }
  }, [key, staleMs, signal])

  const entry = (key ? cache.get(key) : undefined) as CacheEntry<T> | undefined
  const enabled = Boolean(key && fetcher)
  return {
    data: entry?.data ?? null,
    error: entry?.error ?? null,
    loading: enabled && !entry,
    refresh,
  }
}

/** True while any mounted read is in flight, for refresh-button feedback. */
export function usePendingReads(): boolean {
  return React.useSyncExternalStore(subscribe, getPending, getPending) > 0
}

export function invalidatePrefix(prefix: string): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of [...inflight.keys()]) {
    if (key.startsWith(prefix)) inflight.delete(key)
  }
}
