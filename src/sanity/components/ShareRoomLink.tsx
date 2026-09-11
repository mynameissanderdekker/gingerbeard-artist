'use client'

import { useFormValue } from 'sanity'
import { useState } from 'react'
import { useRoomLink } from './useRoomLink'

export function ShareExhibitionRoomLink() {
  return <ShareRoomLink type="exhibition" />
}

export function ShareArtFairRoomLink() {
  return <ShareRoomLink type="artfair" />
}

function ShareRoomLink({ type }: { type: 'exhibition' | 'artfair' }) {
  const slug = useFormValue(['slug', 'current']) as string | undefined
  const [copied, setCopied] = useState(false)

  if (!slug) {
    return (
      <div style={{ fontSize: 13, color: '#6b7280', padding: '8px 0' }}>
        Sla eerst op en voeg een slug toe om de deellink te genereren.
      </div>
    )
  }

  // Link mét sleutel (lib/roomKey); zonder sleutel geeft de prijslijst 404.
  const { url, fout } = useRoomLink(type, slug)
  if (!url) return <div style={{ padding: '10px 14px', background: fout ? '#fef2f2' : '#f9fafb', borderRadius: 8, fontSize: 13, color: fout ? '#b91c1c' : '#9ca3af' }}>{fout ?? 'Deellink ophalen…'}</div>

  async function copy() {
    try { await navigator.clipboard.writeText(url!) } catch { /* */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontSize: 12, background: '#f3f4f6', padding: '4px 8px', borderRadius: 4, flex: 1, wordBreak: 'break-all' }}>
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          style={{ border: '1px solid #d1d5db', background: 'white', padding: '4px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {copied ? '✓ Gekopieerd' : 'Kopieer'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ border: '1px solid #d1d5db', background: 'white', padding: '4px 12px', borderRadius: 4, fontSize: 12, textDecoration: 'none', color: 'inherit', whiteSpace: 'nowrap' }}
        >
          Bekijk ↗
        </a>
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
        Stuur deze link naar de klant — prijzen worden live ingeladen.
      </p>
    </div>
  )
}
