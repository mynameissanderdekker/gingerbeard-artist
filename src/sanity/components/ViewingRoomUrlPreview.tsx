'use client'
import { useFormValue } from 'sanity'
import { SlugInput } from 'sanity'
import type { SlugInputProps, StringInputProps } from 'sanity'
import { useState } from 'react'

import { useRoomLink } from './useRoomLink'

export function ViewingRoomSlugInput(props: SlugInputProps) {
  const slug = useFormValue(['slug', 'current']) as string | undefined
  const [copied, setCopied] = useState(false)
  // Link mét sleutel (lib/roomKey); zonder sleutel geeft /room/<slug> 404.
  const { url } = useRoomLink('privatesale', slug)

  function copy() {
    if (!url) return
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SlugInput {...props} />
      {url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--card-bg-color, #f8f8f8)', border: '1px solid var(--card-border-color, #e0e0e0)', borderRadius: 4, fontSize: 13 }}>
          <span style={{ flex: 1, color: 'var(--card-muted-fg-color, #555)', wordBreak: 'break-all' }}>{url}</span>
          <button type="button" onClick={copy} style={{ flexShrink: 0, padding: '5px 10px', background: copied ? '#d1fae5' : 'var(--card-bg-color, #fff)', border: '1px solid var(--card-border-color, #ccc)', borderRadius: 3, fontSize: 12, cursor: 'pointer', color: copied ? '#065f46' : 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
            {copied ? 'Gekopieerd ✓' : 'Kopieer link'}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: '5px 10px', background: 'var(--card-bg-color, #fff)', border: '1px solid var(--card-border-color, #ccc)', borderRadius: 3, fontSize: 12, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Open ↗</a>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--card-muted-fg-color, #888)' }}>Vul een slug in om de link te genereren</div>
      )}
    </div>
  )
}

export function ViewingRoomUrlPreview(_props: StringInputProps) {
  const slug = useFormValue(['slug', 'current']) as string | undefined
  const [copied, setCopied] = useState(false)
  const { url: link, fout } = useRoomLink('privatesale', slug)
  if (!slug) return <div style={{ fontSize: 13, color: 'var(--card-muted-fg-color, #888)', padding: '8px 0' }}>URL wordt gegenereerd zodra je een slug invult.</div>
  if (!link) return <div style={{ fontSize: 13, color: fout ? '#b91c1c' : 'var(--card-muted-fg-color, #888)', padding: '8px 0' }}>{fout ?? 'Link ophalen…'}</div>
  const url = link
  function copy() { navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) }) }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--card-bg-color, #f8f8f8)', border: '1px solid var(--card-border-color, #e0e0e0)', borderRadius: 4, fontSize: 13 }}>
      <span style={{ flex: 1, color: 'var(--card-muted-fg-color, #555)', wordBreak: 'break-all' }}>{url}</span>
      <button type="button" onClick={copy} style={{ flexShrink: 0, padding: '5px 10px', background: copied ? '#d1fae5' : 'var(--card-bg-color, #fff)', border: '1px solid var(--card-border-color, #ccc)', borderRadius: 3, fontSize: 12, cursor: 'pointer', color: copied ? '#065f46' : 'inherit', whiteSpace: 'nowrap' }}>{copied ? 'Gekopieerd ✓' : 'Kopieer'}</button>
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: '5px 10px', background: 'var(--card-bg-color, #fff)', border: '1px solid var(--card-border-color, #ccc)', borderRadius: 3, fontSize: 12, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Open ↗</a>
    </div>
  )
}
