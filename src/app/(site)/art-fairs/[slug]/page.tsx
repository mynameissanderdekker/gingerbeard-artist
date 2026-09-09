/* eslint-disable @next/next/no-img-element */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { PortableText } from '@portabletext/react'
import BackLink from '@/components/BackLink'
import { EventIntro, type Opening } from '@/components/EventIntro'
import { datumBereik } from '@/lib/datumBereik'

export const revalidate = 3600

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const fair = await getArtFair(slug)
  if (!fair) return {}
  const img = fair.image?.asset?.url ?? fair.images?.[0]?.asset?.url
  return {
    title: fair.title,
    description: fair.subtitle ?? undefined,
    openGraph: {
      title: fair.title,
      description: fair.subtitle ?? undefined,
      ...(img ? { images: [{ url: `${img}?w=1200&auto=format` }] } : {}),
    },
  }
}

async function getArtFair(slug: string) {
  return client.fetch(
    `*[_type == "artFair" && slug.current == $slug][0]{
      _id, title, slug, booth, location, startDate, endDate, openingDate, openingTime, description, websiteUrl,
      subtitle, opening,
      // "Banner Image" stond wel in het schema maar werd hier niet uitgelezen:
      // je kon hem invullen en er gebeurde niets, op de pagina noch in de
      // aankondiging op de homepage.
      image{ asset->{ _id, url }, hotspot, crop },
      images[]{ asset->{ _id, url }, hotspot, crop },
      "artworks": [
        ...coalesce(artworkSeries[]->artworks[]->{ _id, title, year, medium, dimensions, slug, "mainImage": images[0]{ asset, hotspot, crop }, priceExclVAT, vatRate, status }, []),
        ...coalesce(artworks[]->{ _id, title, year, medium, dimensions, slug, "mainImage": images[0]{ asset, hotspot, crop }, priceExclVAT, vatRate, status }, [])
      ]
    }`,
    { slug }
  )
}

function imgUrl(asset: { url?: string; _ref?: string }, width: number) {
  if (asset.url) return `${asset.url}?w=${width}&auto=format&q=85`
  return urlFor({ asset: { _ref: asset._ref } }).width(width).auto('format').quality(85).url()
}

function formatPrice(excl: number, vatRate = 9) {
  const incl = excl * (1 + vatRate / 100)
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(incl)
}

export default async function ArtFairPage({ params }: Props) {
  const { slug } = await params
  const fair = await getArtFair(slug)
  if (!fair) notFound()

  const images = fair.images ?? []
  const artworks = fair.artworks ?? []

  // "Booth 12" — maar staat er al een naam in het veld ("Gallery Torch"), dan
  // geen "Booth" ervoor.
  const stand = fair.booth ? (/^[A-Za-z]?\d/.test(fair.booth) ? `Booth ${fair.booth}` : fair.booth) : null
  const meta = [datumBereik(fair.startDate, fair.endDate), fair.location, stand].filter(Boolean).join(' · ')
  const plek = [fair.location, stand].filter(Boolean).join(', ') || undefined
  // Terugval op de oude velden `openingDate` / `openingTime` zolang het nieuwe
  // blok leeg is — zo verdwijnt er niets van bestaande beurzen. Een tijd die
  // geen HH:MM is (bijv. "17:00 – 19:00") gaat als extra regel mee.
  const oudeTijd = typeof fair.openingTime === 'string' && /^\d{2}:\d{2}$/.test(fair.openingTime) ? fair.openingTime : undefined
  const opening: Opening | null = fair.opening ?? (fair.openingDate ? {
    show: true, heading: 'Opening', date: fair.openingDate, startTime: oudeTijd,
    note: !oudeTijd && fair.openingTime ? fair.openingTime : undefined,
  } : null)

  return (
    <div className="site-container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>

      <BackLink fallback="/" fallbackLabel="Home" />

      {/* Banner, 16:9 — de gangbare bannerverhouding. Een vaste maxHeight gaf
          per afbeelding een andere hoogte, dus de pagina sprong bij elke beurs
          een stukje; met een vaste verhouding staat de titel altijd op dezelfde
          plek en weet je bij het uploaden waar je op mikt. De standfoto's komen
          pas ná afloop, vandaar dat dit een eigen veld is. */}
      {fair.image?.asset && (
        <img
          src={`${imgUrl(fair.image.asset, 1600)}&h=900&fit=crop`}
          alt=""
          style={{
            width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
            objectPosition: 'center', display: 'block', marginBottom: '2rem',
          }}
        />
      )}

      {/* Datum + plek + stand, dan de titel — zelfde indeling als de expositie
          en als de gallery-core. */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p className="section-title" style={{ marginTop: 0, marginBottom: '2rem' }}>{meta || 'Art fair'}</p>
        <h1 style={{ fontSize: 'var(--type-h3)', fontWeight: 400, margin: 0 }}>{fair.title}</h1>
      </div>

      <div style={{ maxWidth: 720, marginBottom: '4rem' }}>
        <EventIntro
          subtitle={fair.subtitle ?? undefined}
          opening={opening}
          title={fair.title}
          location={plek}
          url={`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/art-fairs/${fair.slug?.current}`}
          aboutLabel={Array.isArray(fair.description) && fair.description.length > 0 ? 'About the fair' : undefined}
        />
        {Array.isArray(fair.description) && fair.description.length > 0 && (
          <div style={{ fontSize: 'var(--type-body)', color: 'var(--tone-700)', lineHeight: 1.7 }}>
            <PortableText value={fair.description} />
          </div>
        )}
        {fair.websiteUrl && (
          <p style={{ marginTop: 16, fontSize: 'var(--type-body)' }}>
            <a href={fair.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Visit the fair website ↗</a>
          </p>
        )}
      </div>

      {/* Artworks */}
      {artworks.length > 0 && (
        <div>
          <h2 className="section-title">Artworks</h2>
          <div className="works-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {artworks.map((a: typeof artworks[0]) => {
              const imgSrc = a.mainImage?.asset ? urlFor(a.mainImage).width(600).fit('max').url() : null
              const soldOut = a.status === 'sold'
              const meta = [
                a.year,
                a.dimensions?.widthCm && a.dimensions?.heightCm
                  ? `${a.dimensions.widthCm} × ${a.dimensions.heightCm} cm`
                  : null,
              ].filter(Boolean).join(' · ')
              const cardContent = (
                <>
                  <div className="works-grid-img-wrap">
                    {imgSrc ? <img src={imgSrc} alt={a.title} className="works-grid-img" /> : <div className="works-grid-img" style={{ background: 'var(--color-surface-2)' }} />}
                    {soldOut && <span className="works-badge works-badge-sold">SOLD OUT</span>}
                  </div>
                  <h3 className="works-grid-title">{a.title}</h3>
                  {a.medium && <p className="works-grid-medium">{a.medium}</p>}
                  {meta && <p className="works-grid-meta">{meta}</p>}
                </>
              )
              if (soldOut || !a.slug?.current) return <div key={a._id} className="works-grid-item is-sold-out">{cardContent}</div>
              return (
                <div key={a._id} className="works-grid-item">
                  {cardContent}
                  <Link href={`/works/${a.slug.current}`} className="btn-artwork-info">ARTWORK INFORMATION</Link>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {/* Booth photos — artwork-style grid */}
      {images.length > 0 && (
        <div style={{ marginBottom: '4rem' }}>
          <h2 className="section-title">Booth photos</h2>
          <div className="works-grid">
            {images.map((img: typeof images[0], i: number) => {
              const url = img?.asset ? imgUrl(img.asset, 800) : null
              return url ? (
                <div key={i} className="works-grid-item">
                  <div className="works-grid-img-wrap">
                    <img src={url} alt={`${fair.name} — ${i + 1}`} className="works-grid-img" />
                  </div>
                  <h3 className="works-grid-title" style={{ fontStyle: 'normal', fontWeight: 400 }}>Booth photo</h3>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export async function generateStaticParams() {
  try {
  const items = await client.fetch<{ slug: { current: string } }[]>(
    `*[_type == "artFair" && defined(slug.current) && hasPage == true]{ slug }`
  )
  return items.map(f => ({ slug: f.slug.current }))
  } catch { return [] }
}
