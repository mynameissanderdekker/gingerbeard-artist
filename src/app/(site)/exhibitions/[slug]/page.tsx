/* eslint-disable @next/next/no-img-element */
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import BackLink from '@/components/BackLink'
import { PortableText } from '@portabletext/react'
import { EventIntro, type Opening } from '@/components/EventIntro'
import { datumBereik } from '@/lib/datumBereik'

export const revalidate = 3600

interface Props { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const ex = await getExhibition(slug)
  if (!ex) return {}
  const img = ex.image?.asset?.url ?? ex.images?.[0]?.asset?.url
  return {
    title: ex.title,
    description: ex.subtitle ?? undefined,
    openGraph: {
      title: ex.title,
      description: ex.subtitle ?? undefined,
      ...(img ? { images: [{ url: `${img}?w=1200&auto=format` }] } : {}),
    },
  }
}

async function getExhibition(slug: string) {
  return client.fetch(
    `*[_type == "exhibition" && slug.current == $slug && hasPage == true][0]{
      _id, title, slug, gallery, location, startDate, endDate, exhibitionType, isSolo, description,
      subtitle, opening,
      // Waar het is. De pagina las alleen de oude tekstvelden gallery en
      // location; de venue-keuze (studio / galerie / elders) verscheen nergens.
      "venueName": select(
        venueElsewhere == true => venue.name,
        string::startsWith(venueSpace, "contact:") => *[_type == "contact" && _id == string::split(^.venueSpace, ":")[1]][0].company,
        string::startsWith(venueSpace, "own:") => *[_type == "siteSettings"][0].addresses[_key == string::split(^.venueSpace, ":")[1]][0].name,
        gallery
      ),
      "venueCity": select(
        venueElsewhere == true => venue.city,
        string::startsWith(venueSpace, "contact:") => *[_type == "contact" && _id == string::split(^.venueSpace, ":")[1]][0].city,
        string::startsWith(venueSpace, "own:") => *[_type == "siteSettings"][0].addresses[_key == string::split(^.venueSpace, ":")[1]][0].city,
        location
      ),
      // "Banner Image" werd hier net zo min uitgelezen als op de beurspagina:
      // een veld dat je kunt invullen en dat nergens verschijnt.
      image{ asset->{ _id, url }, hotspot, crop },
      images[]{ asset->{ _id, url }, hotspot, crop },
      press[]->{ _id, title, publication, date, url, image{ asset->{ _id, url }, hotspot, crop } },
      "artworks": [
        ...coalesce(artworkSeries[]->artworks[]->{ _id, title, year, medium, dimensions, slug, "mainImage": images[0]{ asset, hotspot, crop }, status }, []),
        ...coalesce(artworks[]->{ _id, title, year, medium, dimensions, slug, "mainImage": images[0]{ asset, hotspot, crop }, status }, [])
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

export default async function ExhibitionPage({ params }: Props) {
  const { slug } = await params
  const ex = await getExhibition(slug)
  if (!ex) notFound()

  const images = ex.images ?? []
  const artworks = ex.artworks ?? []
  const pressItems = ex.press ?? []

  const soort = ex.exhibitionType === 'solo' || ex.isSolo ? 'Solo exhibition'
    : ex.exhibitionType === 'duo' ? 'Duo exhibition'
    : ex.exhibitionType === 'group' ? 'Group exhibition'
    : ex.exhibitionType === 'permanent' ? 'Permanent installation'
    : ex.exhibitionType === 'special' ? 'Special project'
    : 'Exhibition'
  // Eén regel boven de titel: "17 – 20 Sept 2026 · Galerie X, Amsterdam · Solo exhibition".
  const meta = [datumBereik(ex.startDate, ex.endDate), [ex.venueName, ex.venueCity].filter(Boolean).join(', '), soort].filter(Boolean).join(' · ')
  const plek = [ex.venueName, ex.venueCity].filter(Boolean).join(', ') || undefined
  const opening: Opening | null = ex.opening ?? null

  return (
    <div className="site-container" style={{ paddingTop: '3rem', paddingBottom: '4rem' }}>

      {/* Back link */}
      <BackLink fallback="/" fallbackLabel="Home" />

      {/* Banner, 16:9 — zie de beurspagina voor de afweging. De zaalfoto's
          komen pas ná de opening, vandaar dat dit een eigen veld is. */}
      {ex.image?.asset && (
        <img
          src={`${imgUrl(ex.image.asset, 1600)}&h=900&fit=crop`}
          alt=""
          style={{
            width: '100%', aspectRatio: '16 / 9', objectFit: 'cover',
            objectPosition: 'center', display: 'block', marginBottom: '2rem',
          }}
        />
      )}

      {/* Datum + plek + soort, dan de titel — zelfde indeling als de gallery-core:
          de feiten in één regel erboven, geen kolom met labels ernaast. */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p className="section-title" style={{ marginTop: 0, marginBottom: '2rem' }}>{meta}</p>
        <h1 style={{ fontSize: 'var(--type-h3)', fontWeight: 400, margin: 0 }}>{ex.title}</h1>
      </div>

      <div style={{ maxWidth: 720, marginBottom: '4rem' }}>
        {/* Ondertitel, opening met agendaknop, kopje — zie EventIntro. */}
        <EventIntro
          subtitle={ex.subtitle ?? undefined}
          opening={opening}
          title={ex.title}
          location={plek}
          url={`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/exhibitions/${ex.slug?.current}`}
          aboutLabel={Array.isArray(ex.description) && ex.description.length > 0 ? 'About the exhibition' : undefined}
        />
        {/* De beschrijving is Portable Text; er stond `typeof === 'string'`,
            dus hij werd nooit getoond. */}
        {Array.isArray(ex.description) && ex.description.length > 0 && (
          <div style={{ fontSize: 'var(--type-body)', color: 'var(--tone-700)', lineHeight: 1.7 }}>
            <PortableText value={ex.description} />
          </div>
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
      {/* Installation views — artwork-style grid */}
      {images.length > 0 && (
        <div style={{ marginBottom: '4rem' }}>
          <h2 className="section-title">Installation views</h2>
          <div className="works-grid">
            {images.map((img: typeof images[0], i: number) => {
              const url = img?.asset ? imgUrl(img.asset, 800) : null
              return url ? (
                <div key={i} className="works-grid-item">
                  <div className="works-grid-img-wrap">
                    <img src={url} alt={`${ex.title} — installation view ${i + 1}`} className="works-grid-img" />
                  </div>
                  <h3 className="works-grid-title" style={{ fontStyle: 'normal', fontWeight: 400 }}>Installation view</h3>
                </div>
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Press */}
      {pressItems.length > 0 && (
        <div style={{ marginTop: '4rem' }}>
          <h2 className="section-title">Press</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {pressItems.map((item: { _id: string; title?: string; publication?: string; url?: string; image?: { asset?: { url?: string } } }) => {
              const imgUrl2 = item.image?.asset?.url
              return (
                <div key={item._id} style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', borderTop: '1px solid var(--tone-200)', paddingTop: '20px' }}>
                  {imgUrl2 && (
                    <img src={`${imgUrl2}?w=200&auto=format`} alt={item.title ?? ''} style={{ width: 120, flexShrink: 0, objectFit: 'cover' }} />
                  )}
                  <div>
                    {item.publication && <p style={{ margin: '0 0 4px', fontSize: 'var(--type-small)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.publication}</p>}
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 500, textDecoration: 'underline' }}>{item.title}</a>
                    ) : (
                      <p style={{ margin: 0, fontWeight: 500 }}>{item.title}</p>
                    )}
                  </div>
                </div>
              )
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
      `*[_type == "exhibition" && defined(slug.current) && hasPage == true]{ slug }`
    )
    return items.map(e => ({ slug: e.slug.current }))
  } catch { return [] }
}
