'use client'
import { useEffect, useState } from 'react'
import { useClient } from 'sanity'

/**
 * Deellink van een prijslijst mét sleutel, via /api/admin/room-link.
 * De sleutel wordt op de server berekend (lib/roomKey); de Studio krijgt hem
 * met het Studio-token. Zonder sleutel geeft de prijslijst 404.
 */
export function useRoomLink(type: 'exhibition' | 'artfair' | 'privatesale', slug: string | undefined) {
  const client = useClient({ apiVersion: '2024-01-01' })
  const [path, setPath] = useState<string | null>(null)
  const [fout, setFout] = useState<string | null>(null)
  useEffect(() => {
    if (!slug) { setPath(null); return }
    let actief = true
    const token = (client as unknown as { config?: () => { token?: string } }).config?.()?.token ?? ''
    fetch(`/api/admin/room-link?type=${type}&slug=${encodeURIComponent(slug)}`, { headers: { 'x-sanity-token': token } })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!actief) return
        if (r.ok && d.path) { setPath(d.path); setFout(null) }
        else setFout(d.error || `Deellink niet beschikbaar (${r.status})`)
      })
      .catch(() => actief && setFout('Deellink niet beschikbaar'))
    return () => { actief = false }
  }, [slug, type, client])
  const url = path && typeof window !== 'undefined' ? `${window.location.origin}${path}` : null
  return { url, path, fout }
}
