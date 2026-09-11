import { notFound } from 'next/navigation'
import { roomKeyGeldig } from '@/lib/roomKey'
import { createClient } from '@sanity/client'
import { getSiteIdentity } from '@/lib/siteIdentity'

export const dynamic = 'force-dynamic'

const client = createClient({
  projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2024-01-01',
  token:      process.env.SANITY_WRITE_TOKEN,
  useCdn:     false,
})

interface ArtworkData {
  _id: string
  title: string
  year?: number
  medium?: string
  status?: string
  priceOnRequest?: boolean
  priceExclVAT?: number
  priceIncVat?: number
  vatRate?: number
  editionTotal?: number
  editionAP?: number
  dimensions?: { widthCm?: number; heightCm?: number; depthCm?: number }
  image?: string
}

interface RoomArtwork {
  _key: string
  priceOverride?: number
  note?: string
  artwork: ArtworkData
}

interface RoomData {
  title: string
  showPrices: boolean
  artworks: RoomArtwork[]
  contact?: { firstName?: string; lastName?: string }
}

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ style?: string; k?: string }>
}

function formatDims(d?: ArtworkData['dimensions']) {
  if (!d) return null
  const parts = [d.widthCm, d.heightCm, d.depthCm].filter(n => n != null)
  return parts.length ? `${parts.join(' × ')} cm` : null
}

function formatPrice(excl: number, rate: number) {
  const incl = excl * (1 + rate / 100)
  const fmt = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
  return { excl: fmt(excl), incl: fmt(incl), rate }
}

export default async function ViewingRoomPdf({ params, searchParams }: Props) {
  // Naam, adres en e-mail kwamen hier hardcoded uit de code.
  const site = await getSiteIdentity(client)
  const { slug } = await params
  const { style = 'compact', k } = await searchParams
  if (!roomKeyGeldig('privatesale', slug, k)) notFound()
  const isFull = style === 'full'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const room = await (client.fetch as any)(
    `*[_type == "privateSale" && slug.current == $slug && isActive == true][0] {
      title, showPrices,
      "contact": contact->{ firstName, lastName },
      "artworks": artworks[] {
        _key, priceOverride, note,
        "artwork": artwork-> {
          _id, title, year, medium, status,
          priceExclVAT, vatRate,
          editionTotal, editionAP,
          dimensions,
          "image": images[0].asset->url
        }
      }
    }`,
    { slug }
  ) as RoomData | null

  if (!room) notFound()

  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{room.title} — Sander Dekker</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: #111;
            background: #fff;
            font-size: 13px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page { max-width: 760px; margin: 0 auto; padding: 48px 40px; }
          .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 20px; border-bottom: 1px solid #111; margin-bottom: 32px; }
          .brand { font-size: 15px; font-weight: 500; letter-spacing: 0.02em; }
          .brand-sub { font-size: 11px; color: #888; margin-top: 2px; letter-spacing: 0.05em; }
          .meta { text-align: right; font-size: 12px; color: #888; line-height: 1.7; }
          .room-title { font-size: 22px; font-weight: 400; letter-spacing: 0.01em; margin-bottom: 4px; }
          .room-occasion { font-size: 13px; color: #888; margin-bottom: 32px; }
          /* Compact style */
          .artwork-row { display: grid; grid-template-columns: ${isFull ? '1fr' : '200px 1fr'}; gap: ${isFull ? '0' : '28px'}; padding: 20px 0; border-bottom: 1px solid #e8e8e8; }
          .artwork-row:first-child { border-top: 1px solid #e8e8e8; }
          .artwork-image { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; background: #f5f5f3; display: block; }
          .artwork-image-wrap { ${isFull ? 'margin-bottom: 16px;' : ''} }
          .artwork-title { font-size: 15px; font-weight: 500; margin-bottom: 2px; }
          .artwork-year { font-size: 13px; color: #888; margin-bottom: 8px; }
          .artwork-meta { font-size: 12px; color: #666; margin-bottom: 2px; }
          .artwork-price { margin-top: 10px; }
          .artwork-price-excl { font-size: 14px; font-weight: 500; }
          .artwork-price-incl { font-size: 11px; color: #888; margin-top: 1px; }
          .artwork-note { margin-top: 10px; font-size: 12px; color: #555; font-style: italic; border-left: 2px solid #e0e0e0; padding-left: 10px; }
          .artwork-status { display: inline-block; margin-top: 8px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; }
          .status-available { background: #d1fae5; color: #065f46; }
          .status-enquire { background: #fef3c7; color: #92400e; }
          .status-sold { background: #f3f4f6; color: #6b7280; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e8e8e8; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; }
          @media print {
            .page { padding: 32px; }
            .artwork-row { page-break-inside: avoid; }
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Header */}
          <div className="header">
            <div>
              <div className="brand">Sander Dekker</div>
              <div className="brand-sub">mynameissanderdekker.com</div>
            </div>
            <div className="meta">
              {room.contact && (
                <div>{room.contact.firstName} {room.contact.lastName}</div>
              )}
              <div>{dateStr}</div>
            </div>
          </div>

          {/* Title */}
          <div className="room-title">{room.title}</div>

          {/* Artworks */}
          <div style={{ marginTop: 24 }}>
            {room.artworks?.map(({ _key, artwork, priceOverride, note }) => {
              if (!artwork) return null
              const dims = formatDims(artwork.dimensions)
              const priceExcl = priceOverride ?? artwork.priceExclVAT
              const rate = artwork.vatRate ?? 9
              const price = room.showPrices && priceExcl != null ? formatPrice(priceExcl, rate) : null

              return (
                <div key={_key} className="artwork-row">
                  {/* Image */}
                  {artwork.image && (
                    <div className="artwork-image-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${artwork.image}?w=${isFull ? 1200 : 400}&auto=format`}
                        alt={artwork.title}
                        className="artwork-image"
                        style={isFull ? { width: '100%', maxHeight: 480, objectFit: 'contain', background: '#f5f5f3' } : undefined}
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div>
                    <div className="artwork-title">{artwork.title}</div>
                    <div className="artwork-year">{artwork.year}</div>
                    {artwork.medium && <div className="artwork-meta">{artwork.medium}</div>}
                    {dims && <div className="artwork-meta">{dims}</div>}
                    {artwork.editionTotal && (
                      <div className="artwork-meta">
                        Edition of {artwork.editionTotal}
                        {artwork.editionAP ? ` + ${artwork.editionAP} AP` : ''}
                      </div>
                    )}

                    {price && (
                      <div className="artwork-price">
                        <div className="artwork-price-excl">{price.excl} excl. BTW</div>
                        {price.rate > 0 && (
                          <div className="artwork-price-incl">{price.incl} incl. {price.rate}% BTW</div>
                        )}
                      </div>
                    )}

                    {artwork.status && (
                      <div>
                        <span className={`artwork-status ${artwork.status === 'available' ? 'status-available' : !artwork.priceIncVat ? 'status-enquire' : 'status-sold'}`}>
                          {artwork.status === 'available' ? 'Available' : !artwork.priceIncVat ? 'On request' : 'Sold'}
                        </span>
                      </div>
                    )}

                    {note && <div className="artwork-note">{note}</div>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="footer">
            <span>{site.footerLine}</span>
            <span>Confidential</span>
          </div>
        </div>
      </body>
    </html>
  )
}
