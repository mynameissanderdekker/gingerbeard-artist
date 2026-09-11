'use client'
import { useFormValue } from 'sanity'
import type { StringInputProps } from 'sanity'
import { useRoomLink } from './useRoomLink'

export function ViewingRoomPdfLinks(_props: StringInputProps) {
  const slug = useFormValue(['slug', 'current']) as string | undefined
  // PDF's achter dezelfde sleutel als de pagina (lib/roomKey).
  const { url, fout } = useRoomLink('privatesale', slug)
  if (!slug) return <div style={{ fontSize: 13, color: 'var(--card-muted-fg-color, #888)', padding: '8px 0' }}>Add a slug first to generate PDF links.</div>
  if (!url) return <div style={{ fontSize: 13, color: fout ? '#b91c1c' : 'var(--card-muted-fg-color, #888)', padding: '8px 0' }}>{fout ?? 'Links ophalen…'}</div>
  const compact = `${url.replace(/\?k=/, '/pdf?k=')}&style=compact`
  const full = `${url.replace(/\?k=/, '/pdf?k=')}&style=full`
  const linkStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--card-bg-color, #fff)', border: '1px solid var(--card-border-color, #ccc)', borderRadius: 4, fontSize: 13, color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <a href={compact} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>📄 Compact PDF <span style={{ fontSize: 11, opacity: 0.5 }}>↗</span></a>
      <a href={full} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={linkStyle}>🖼 Full PDF <span style={{ fontSize: 11, opacity: 0.5 }}>↗</span></a>
    </div>
  )
}
