'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import EnquirePanel from '@/components/EnquirePanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditionRecord {
  number: string
  status: 'available' | 'reserved' | 'sold' | 'artist_hold'
}

interface ArtworkData {
  _id: string
  title: string
  year: number
  medium?: string
  status: string
  priceOnRequest?: boolean
  priceExclVAT?: number
  priceIncVat?: number
  vatRate?: number
  editionTotal?: number
  editionAP?: number
  slug?: string
  image?: string
  editionRecords?: EditionRecord[]
  dimensions?: { widthCm?: number; heightCm?: number; depthCm?: number }
}

interface RoomArtwork {
  _key: string
  contextNote?: string
  priceOverride?: number
  artwork: ArtworkData
}

interface Room {
  siteEmail?: string
  title: string
  description?: string
  showPrices: boolean
  artworks: RoomArtwork[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDimensions(d?: ArtworkData['dimensions']) {
  if (!d) return null
  const parts = [
    d.widthCm != null ? `${d.widthCm}` : null,
    d.heightCm != null ? `${d.heightCm}` : null,
    d.depthCm != null ? `${d.depthCm}` : null,
  ].filter(Boolean)
  return parts.length ? `${parts.join(' × ')} cm` : null
}

function countAvailable(records?: EditionRecord[]) {
  if (!records) return null
  return records.filter((r) => r.status === 'available').length
}

function formatPrice(priceExclVAT: number, vatRate: number) {
  const vat = priceExclVAT * (vatRate / 100)
  const inclVAT = priceExclVAT + vat
  return {
    excl: new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(priceExclVAT),
    incl: new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(inclVAT),
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const params = useParams()
  const slug = params?.slug as string
  const sleutel = useSearchParams().get('k') ?? ''

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresPassword, setRequiresPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const [activeArtwork, setActiveArtwork] = useState<ArtworkData | null>(null)

  async function fetchRoom(pw?: string) {
    const url = `/api/room/${slug}?k=${encodeURIComponent(sleutel)}${pw ? `&password=${encodeURIComponent(pw)}` : ''}`
    const res = await fetch(url)

    if (res.status === 401) {
      setRequiresPassword(true)
      if (pw) setPasswordError(true)
      setLoading(false)
      return
    }

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Er ging iets mis')
      setLoading(false)
      return
    }

    const data = await res.json()
    setRoom(data)
    setRequiresPassword(false)
    setLoading(false)
  }

  useEffect(() => {
    if (slug) fetchRoom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(false)
    setLoading(true)
    fetchRoom(password)
  }

  // ── States ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="room-page room-page--loading">
        <div className="room-loading-indicator" />
      </div>
    )
  }

  if (requiresPassword) {
    return (
      <div className="room-page">
        <div className="room-password-gate">
          <h1 className="room-password-title">Privéselectie</h1>
          <p className="room-password-sub">Voer de toegangscode in om deze selectie te bekijken.</p>
          <form onSubmit={handlePasswordSubmit} className="room-password-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Toegangscode"
              className={`room-password-input${passwordError ? ' room-password-input--error' : ''}`}
              autoFocus
            />
            {passwordError && (
              <p className="room-password-error">Onjuiste toegangscode</p>
            )}
            <button type="submit" className="room-password-btn">
              Bekijken
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="room-page">
        <div className="room-error">
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!room) return null

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* noindex — keep private sales out of search engines */}
      <meta name="robots" content="noindex, nofollow" />

      <div className="room-page">
        {/* Header */}
        <header className="room-header">
          <h1 className="room-title">Privéselectie</h1>
          {room.description && (
            <p className="room-description">{room.description}</p>
          )}
        </header>

        {/* PDF buttons */}
        <div className="room-actions no-print flex items-center gap-2">
          <a href={`/room/${slug}/pdf?style=compact&k=${encodeURIComponent(sleutel)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-gray-300 px-4 py-2 text-[12px] tracking-[0.15em] uppercase text-gray-500 hover:border-black hover:text-black transition-colors duration-150">
            Compact PDF
          </a>
          <a href={`/room/${slug}/pdf?style=full&k=${encodeURIComponent(sleutel)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 border border-gray-300 px-4 py-2 text-[12px] tracking-[0.15em] uppercase text-gray-500 hover:border-black hover:text-black transition-colors duration-150">
            Full PDF
          </a>
        </div>

        {/* Artwork list */}
        <div className="room-artworks">
          {room.artworks.map(({ _key, artwork, contextNote, priceOverride }) => {
            const dims = formatDimensions(artwork.dimensions)
            const available = countAvailable(artwork.editionRecords)
            const priceExcl = priceOverride ?? artwork.priceExclVAT
            const price = priceExcl && artwork.vatRate != null
              ? formatPrice(priceExcl, artwork.vatRate)
              : null

            return (
              <article key={_key} className="room-artwork">
                {/* Image */}
                <div className="room-artwork-image-wrap">
                  {artwork.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${artwork.image}?w=800&auto=format`}
                      alt={artwork.title}
                      className="room-artwork-image"
                      loading="lazy"
                    />
                  ) : (
                    <div className="room-artwork-image-placeholder" />
                  )}
                </div>

                {/* Info */}
                <div className="room-artwork-info">
                  <h2 className="room-artwork-title">{artwork.title}</h2>
                  <p className="room-artwork-year">{artwork.year}</p>

                  {artwork.medium && (
                    <p className="room-artwork-meta">{artwork.medium}</p>
                  )}
                  {dims && (
                    <p className="room-artwork-meta">{dims}</p>
                  )}
                  {artwork.editionTotal && (
                    <p className="room-artwork-meta">
                      Editie van {artwork.editionTotal}
                      {artwork.editionAP ? ` + ${artwork.editionAP} AP` : ''}
                      {available != null ? ` — ${available} beschikbaar` : ''}
                    </p>
                  )}

                  {room.showPrices && price && (
                    <div className="room-artwork-price">
                      <p className="room-artwork-price-excl">{price.excl} excl. BTW</p>
                      {artwork.vatRate != null && artwork.vatRate > 0 && (
                        <p className="room-artwork-price-incl">{price.incl} incl. {artwork.vatRate}% BTW</p>
                      )}
                    </div>
                  )}

                  {contextNote && (
                    <p className="room-artwork-note">{contextNote}</p>
                  )}

                  <div className="room-artwork-status">
                    {artwork.status === 'available' && (
                      <span className="room-status-badge room-status-badge--available">Beschikbaar</span>
                    )}
                    {!artwork.priceIncVat && (
                      <span className="room-status-badge room-status-badge--enquire">Op aanvraag</span>
                    )}
                    {artwork.status === 'sold' && (
                      <span className="room-status-badge room-status-badge--sold">Verkocht</span>
                    )}
                  </div>

                  {artwork.status === 'available' && (
                    <button
                      className="room-enquire-btn no-print"
                      onClick={() => setActiveArtwork(artwork)}
                    >
                      Interesse
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        {/* Footer */}
        <footer className="room-footer no-print">
          <p>
            Deze selectie is persoonlijk samengesteld en vertrouwelijk.
            Vragen?{' '}
            <a href={`mailto:${room?.siteEmail ?? ''}`}>
              {room?.siteEmail ?? ''}
            </a>
          </p>
        </footer>
      </div>

      {/* Enquire panel */}
      <EnquirePanel
        artwork={activeArtwork}
        priceListSlug={slug}
        onClose={() => setActiveArtwork(null)}
      />
    </>
  )
}
