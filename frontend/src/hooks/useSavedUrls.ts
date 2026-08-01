import { useCallback, useState } from 'react'
import { normalizeUrl } from '../lib/url'
import type { SavedUrl } from '../types'

export type AddUrlResult = { ok: true } | { ok: false; error: string }

/**
 * Single source of truth for the saved URL list.
 *
 * State lives in memory only, so the list resets on refresh. Everything that
 * touches storage is in here — swapping in localStorage or an API later means
 * changing this file and nothing else.
 */
export function useSavedUrls() {
  const [urls, setUrls] = useState<SavedUrl[]>([])

  const addUrl = useCallback(
    (raw: string): AddUrlResult => {
      const normalized = normalizeUrl(raw)
      if (!normalized) {
        return { ok: false, error: "That doesn't look like a valid URL." }
      }

      if (urls.some((item) => item.url === normalized)) {
        return { ok: false, error: 'Already saved.' }
      }

      const entry: SavedUrl = {
        id: crypto.randomUUID(),
        url: normalized,
        addedAt: Date.now(),
      }
      setUrls((current) => [entry, ...current])

      return { ok: true }
    },
    [urls],
  )

  const removeUrl = useCallback((id: string) => {
    setUrls((current) => current.filter((item) => item.id !== id))
  }, [])

  return { urls, addUrl, removeUrl }
}
