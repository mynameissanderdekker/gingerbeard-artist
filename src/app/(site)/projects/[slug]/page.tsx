/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { PageBuilder, type PageBlock } from '@/components/PageBuilder'

const BASE_URL = 'https://www.mynameissanderdekker.com'

export const revalidate = 3600

// Hardcoded fallback descriptions per slug (overridden when Sanity metaDescription is set)
const PROJECT_DESCRIPTIONS: Record<string, string> = {
  'the-social-media-project': 'A decade-long documentary series: Sander Dekker contacted strangers via social media and photographed them in their own homes. Ten years, a dozen countries, hundreds of messages. 2011–2021.',
  'innate-curiosity': "What happens to curiosity when algorithms anticipate your interests before you've formed them? Sander Dekker's ongoing project on pre-digital ways of seeing and exploring the world.",
  'the-zine-project': 'Ten handmade zines published between 2021 and 2025, each an intimate exploration of a single person, place or theme. All editions sold out. Concluded at TORCH Gallery Amsterdam.',
  'the-social-landscape': 'TenFifteen: thousands of 10×15cm photographs as large-scale installation — a visual echo of the social media scroll. Permanent installations in Amsterdam, Hellerup and Lisse.',
  'fun': 'A long-term series in which Sander Dekker inserts himself as a neutral, expressionless presence in everyday situations — making the instinct to perform for a camera visible and absurd.',
  'it-is-us': 'A participatory work: people anonymously photograph a part of their body they feel strongly about. A collective body built from difference, pride and vulnerability.',
  'girls-in-paris': 'Eight women in Paris navigating questions of freedom, self-expression and autonomy. Intimate portraits paired with everyday language of judgment. Zine Nº.2, edition of 35.',
  'warsaw-saga': 'Zine Nº.8 — Portraits of LGBTQ+ individuals in Warsaw who stay true to themselves despite social and political pressure. SAGA stands for their right to be seen. Edition of 40, sold out.',
  'asia': 'Zine Nº.9 — Addressing Structural Inequalities in Amsterdam. Seven individuals with Asian heritage using self-expression to challenge stereotypes. Edition of 40, sold out.',
}

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await getProject(slug)
  if (!project) return {}

  const description = project.metaDescription ?? PROJECT_DESCRIPTIONS[slug] ?? `${project.title} — a project by Sander Dekker.`

  const ogImages = project.coverImageUrl
    ? [{
        url: project.coverImageUrl,
        width: project.coverImageWidth ?? 1200,
        height: project.coverImageHeight ?? 630,
        alt: project.title,
      }]
    : []

  return {
    title: project.title,
    description,
    alternates: {
      canonical: `${BASE_URL}/projects/${slug}`,
    },
    openGraph: {
      title: `${project.title} — Sander Dekker`,
      description,
      url: `${BASE_URL}/projects/${slug}`,
      siteName: 'Sander Dekker',
      locale: 'en_GB',
      type: 'website',
      ...(ogImages.length > 0 ? { images: ogImages } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${project.title} — Sander Dekker`,
      description,
      ...(ogImages.length > 0 ? { images: [ogImages[0].url] } : {}),
    },
  }
}

interface LinkedArtwork {
  _id: string
  title: string
  year?: number
  medium?: string
  dimensions?: { widthCm?: number; heightCm?: number }
  slug?: { current: string }
  mainImage?: { asset?: { _ref?: string }; hotspot?: unknown; crop?: unknown }
  status?: string
}

interface LinkedExhibition {
  _id: string
  _type: 'exhibition' | 'artFair'
  // exhibition fields
  title?: string
  gallery?: string
  exhibitionType?: string
  isSolo?: boolean
  // artFair fields
  name?: string
  fair?: string
  booth?: string
  websiteUrl?: string
  hasPage?: boolean
  slug?: { current: string }
  location?: string
  startDate?: string
}

// ── Query ──────────────────────────────────────────────────────────────────────

async function getProject(slug: string) {
  return client.fetch(
    `*[_type == "project" && slug.current == $slug && isPage == true][0]{
      _id, title,
      metaDescription,
      startYear,
      endYear,
      "coverImageUrl": coverImage.asset->url,
      "coverImageWidth": coverImage.asset->metadata.dimensions.width,
      "coverImageHeight": coverImage.asset->metadata.dimensions.height,
      pageBuilder,
      "artworks": [
        ...coalesce(artworkSeries[]->artworks[]->{ _id, title, year, medium, dimensions, slug, "mainImage": images[0]{ asset, hotspot, crop }, "priceExclVAT": select(defined(priceIncVat) => round(priceIncVat / (1 + select(vatRate == "21" => 21, vatRate == "0" => 0, 9) / 100) * 100) / 100, priceExclVAT), vatRate, status }, []),
        ...coalesce(artworks[]->{ _id, title, year, medium, dimensions, slug, "mainImage": images[0]{ asset, hotspot, crop }, "priceExclVAT": select(defined(priceIncVat) => round(priceIncVat / (1 + select(vatRate == "21" => 21, vatRate == "0" => 0, 9) / 100) * 100) / 100, priceExclVAT), vatRate, status }, [])
      ],
      "exhibitions": [
        ...*[_type == "exhibition" && cvProject._ref == ^._id]{ _id, _type, slug, hasPage, title, gallery, location, startDate, exhibitionType, isSolo, websiteUrl },
        ...*[_type == "artFair" && cvProject._ref == ^._id]{ _id, "_type": "artFair", slug, hasPage, title, "gallery": title, "fair": title, booth, location, startDate, websiteUrl }
      ] | order(startDate desc)
    }`,
    { slug }
  )
}

async function getZines() {
  return client.fetch(
    `*[_type == "publication"] | order(order asc) {
      number, title, meta, description, "featured": shopFeatured, projectSlug,
      "mainImage": images[0]{ asset, hotspot, crop }
    }`
  )
}

// ── Linked artworks grid ───────────────────────────────────────────────────────

function ArtworksGrid({ artworks, label = 'Artworks' }: { artworks: LinkedArtwork[]; label?: string }) {
  if (!artworks.length) return null
  return (
    <div style={{ marginTop: '3rem' }}>
      <h2 className="section-title">{label}</h2>
      <div className="works-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {artworks.map(a => {
          const imgUrl = a.mainImage?.asset
            ? urlFor(a.mainImage).width(600).fit('max').url()
            : null
          const soldOut = a.status === 'sold'

          const cardContent = (
            <>
              <div className="works-grid-img-wrap">
                {imgUrl
                  ? <img src={imgUrl} alt={a.title} className="works-grid-img" />
                  : <div className="works-grid-img" style={{ background: 'var(--color-surface-2)' }} />
                }
                {soldOut && <span className="works-badge works-badge-sold">SOLD OUT</span>}
              </div>
              <h3 className="works-grid-title">{a.title}</h3>
              {a.medium && <p className="works-grid-medium">{a.medium}</p>}
              {(a.year || a.dimensions) && (
                <p className="works-grid-meta">
                  {[
                    a.year,
                    a.dimensions?.widthCm && a.dimensions?.heightCm
                      ? `${a.dimensions.widthCm} × ${a.dimensions.heightCm} cm`
                      : null,
                  ].filter(Boolean).join(' · ')}
                </p>
              )}
            </>
          )

          if (soldOut || !a.slug?.current) {
            return <div key={a._id} className="works-grid-item is-sold-out">{cardContent}</div>
          }
          return (
            <div key={a._id} className="works-grid-item">
              {cardContent}
              <Link href={`/works/${a.slug.current}`} className="btn-artwork-info">ARTWORK INFORMATION</Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Linked exhibitions list ────────────────────────────────────────────────────

function ExhibitionsList({ exhibitions }: { exhibitions: LinkedExhibition[] }) {
  if (!exhibitions.length) return null
  return (
    <div style={{ marginTop: '3rem' }}>
      <h2 className="section-title">Exhibitions &amp; Art fairs</h2>
      <ul className="cv-list">
        {exhibitions.map(e => {
          const year = e.startDate ? new Date(e.startDate).getFullYear() : null
          const isArtFair = e._type === 'artFair'
          const label = isArtFair
            ? (e.name ?? e.fair ?? '—')
            : (e.gallery ?? e.title ?? '—')
          const typeLabel: Record<string, string> = { solo: 'Solo', duo: 'Duo', group: 'Group', permanent: 'Permanent', special: 'Special' }
          const detail = isArtFair
            ? e.booth
            : (e.exhibitionType ? typeLabel[e.exhibitionType] : e.isSolo ? 'Solo' : undefined)
          const internalUrl = e.hasPage && e.slug?.current
            ? (isArtFair ? `/art-fairs/${e.slug.current}` : `/exhibitions/${e.slug.current}`)
            : null
          const externalUrl = isArtFair ? e.websiteUrl : null
          const url = internalUrl ?? (e.hasPage ? externalUrl : null)
          return (
            <li key={e._id}>
              {year && <>{year} — </>}
              {url
                ? <Link href={url} {...(!internalUrl ? { target: '_blank', rel: 'noopener noreferrer' } : {})} style={{ textDecoration: 'underline' }}>{label}</Link>
                : label
              }
              {e.location && `, ${e.location}`}
              {detail && <span style={{ color: 'var(--tone-500)', fontSize: 'var(--type-small)' }}> ({detail})</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const [project, zines] = await Promise.all([getProject(slug), getZines()])
  if (!project) notFound()

  const artworks: LinkedArtwork[]       = project.artworks    ?? []
  const exhibitions: LinkedExhibition[] = project.exhibitions ?? []
  const pageBlocks: PageBlock[]         = project.pageBuilder ?? []

  const description = project.metaDescription ?? PROJECT_DESCRIPTIONS[slug] ?? `${project.title} — a project by Sander Dekker.`

  const creativeWorkSchema = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.title,
    creator: {
      '@type': 'Person',
      name: 'Sander Dekker',
      url: BASE_URL,
    },
    ...(project.startYear ? { dateCreated: String(project.startYear) } : {}),
    description,
    url: `${BASE_URL}/projects/${slug}`,
    artMedium: ['Photography', 'Installation'],
    inLanguage: 'en',
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkSchema) }}
      />
      {project.coverImageUrl && pageBlocks[0]?._type !== 'heroImage' && pageBlocks[0]?._type !== 'heroVideo' && (
        /* Show cover image as hero unless pageBuilder already starts with a hero block */
        <div className="project-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${project.coverImageUrl}?w=1600&auto=format&q=85`}
            alt={project.title}
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '70vh', objectFit: 'cover' }}
          />
        </div>
      )}
      <PageBuilder blocks={pageBlocks} zines={zines} />
      <ArtworksGrid artworks={artworks} label={['the-zine-project', 'the-social-media-project'].includes(slug) ? 'Artworks (selection)' : 'Artworks'} />
      <ExhibitionsList exhibitions={exhibitions} />
    </>
  )
}

export async function generateStaticParams() {
  try {
  const projects = await client.fetch<{ slug: { current: string } }[]>(
    `*[_type == "project" && isPage == true]{ slug }`
  )
  return projects.map(p => ({ slug: p.slug.current }))
  } catch { return [] }
}
