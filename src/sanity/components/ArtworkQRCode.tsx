'use client'
import { useFormValue } from 'sanity'
import type { FieldProps } from 'sanity'

const BASE_URL = 'https://www.mynameissanderdekker.com/works'

export function ArtworkQRCode(props: FieldProps) {
  const slug = (useFormValue(['slug']) as any)?.current as string | undefined

  if (!slug) return null

  const url = `${BASE_URL}/${slug}`
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&margin=8&color=000000&bgcolor=ffffff`

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0' }}>
      <img src={qrSrc} alt="QR code" width={80} height={80} style={{ borderRadius: 4, border: '1px solid #e5e5e5' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: '#666' }}>{url}</span>
        <span style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#2276fc', textDecoration: 'none' }}>Open page ↗</a>
          <span style={{ color: '#ccc' }}>·</span>
          <a href={qrSrc.replace('size=160x160', 'size=600x600')} download={`qr-${slug}.png`} style={{ color: '#2276fc', textDecoration: 'none' }}>Download QR ↓</a>
        </span>
      </div>
    </div>
  )
}
