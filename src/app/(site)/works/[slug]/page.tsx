import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { client } from '@/sanity/lib/client'
import ArtworkDetail, { type ArtworkData } from '@/components/ArtworkDetail'

const BASE_URL = 'https://www.mynameissanderdekker.com'

// ── Sanity query ──────────────────────────────────────────────────────────────

async function getArtwork(slug: string): Promise<ArtworkData | null> {
  return client.fetch(
    `*[_type == "artwork" && slug.current == $slug][0]{
      _id,
      title,
      year,
      medium,
      dimensions,
      dimensionsExclFrame,
      images[]{ asset->{ _id, url }, hotspot, crop },
      "priceExclVAT": select(defined(priceIncVat) => round(priceIncVat / (1 + select(vatRate == "21" => 21, vatRate == "0" => 0, 9) / 100) * 100) / 100, priceExclVAT),
      priceIncVat,
      vatRate,
      options,
      status,
      availableInShop,
      "roomImageUrl": roomImage.asset->url,
      showViewOnWall,
      roomImageWidth,
      buyUrl,
      editionTotal,
      editionAP,
      slug,
      description,
      metaDescription
    }`,
    { slug },
    { next: { revalidate: false } },
  )
}

async function getAllSlugs(): Promise<string[]> {
  const rows = await client.fetch<Array<{ slug: { current: string } }>>(
    `*[_type == "artwork" && defined(slug.current)]{ slug }`,
    {},
    { next: { revalidate: false } },
  )
  return rows.map(r => r.slug.current)
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const artwork = await getArtwork(slug)
  if (!artwork) return {}

  const description = artwork.metaDescription
    ?? (artwork.medium ? `${artwork.title} — ${artwork.medium}. Limited edition by Sander Dekker.` : `${artwork.title} — Limited edition by Sander Dekker.`)

  const ogImage = artwork.images?.[0]?.asset?.url
    ? [{ url: artwork.images[0].asset.url, alt: artwork.title }]
    : []

  return {
    title: artwork.title,
    description,
    alternates: {
      canonical: `${BASE_URL}/works/${slug}`,
    },
    openGraph: {
      title: `${artwork.title} — Sander Dekker`,
      description,
      url: `${BASE_URL}/works/${slug}`,
      siteName: 'Sander Dekker',
      locale: 'en_GB',
      type: 'website',
      ...(ogImage.length > 0 ? { images: ogImage } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${artwork.title} — Sander Dekker`,
      description,
      ...(ogImage.length > 0 ? { images: [ogImage[0].url] } : {}),
    },
  }
}

// ── Static params ─────────────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const slugs = await getAllSlugs()
    return slugs.map(slug => ({ slug }))
  } catch { return [] }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const artwork = await getArtwork(slug)

  if (!artwork) notFound()

  const isAvailable = artwork.status === 'available'
  const isSoldOut   = artwork.status === 'sold'

  // Determine the relevant price (first option or base price)
  const offerPrice = artwork.options?.length
    ? artwork.options[0].priceExclVAT
    : artwork.priceExclVAT

  const artworkSchema = {
    '@context': 'https://schema.org',
    '@type': 'VisualArtwork',
    name: artwork.title,
    creator: {
      '@type': 'Person',
      name: 'Sander Dekker',
      url: BASE_URL,
    },
    dateCreated: artwork.year?.toString(),
    artMedium: artwork.medium,
    url: `${BASE_URL}/works/${slug}`,
    ...(artwork.images?.[0]?.asset?.url ? { image: artwork.images[0].asset.url } : {}),
    // Prijs alleen naar Google als hij ook op de pagina staat (webshop).
    ...(offerPrice != null && artwork.availableInShop === true ? {
      offers: {
        '@type': 'Offer',
        price: offerPrice,
        priceCurrency: 'EUR',
        availability: isSoldOut
          ? 'https://schema.org/SoldOut'
          : isAvailable
          ? 'https://schema.org/InStock'
          : 'https://schema.org/PreOrder',
      },
    } : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(artworkSchema) }}
      />
      <ArtworkDetail artwork={artwork} />
    </>
  )
}
