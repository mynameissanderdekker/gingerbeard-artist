import type { Metadata } from 'next'
import Link from 'next/link'
import { PortableText, type PortableTextComponents } from '@portabletext/react'
import { client } from '@/sanity/lib/client'
import { WorksAllSection } from '@/components/WorksAllSection'

const BASE_URL = 'https://www.mynameissanderdekker.com'

export const metadata: Metadata = {
  title: 'Available',
  description: 'Available works and editions by Sander Dekker — photographs and limited-edition zines. Direct from the studio.',
  alternates: {
    canonical: `${BASE_URL}/works`,
  },
  openGraph: {
    title: 'Available — Sander Dekker',
    description: 'Available works and editions by Sander Dekker — photographs and limited-edition zines. Direct from the studio.',
    url: `${BASE_URL}/works`,
    siteName: 'Sander Dekker',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Available — Sander Dekker',
    description: 'Available works and editions by Sander Dekker — photographs and limited-edition zines. Direct from the studio.',
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PT = any[]

const ptComponents: PortableTextComponents = {
  marks: {
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target={value?.blank ? '_blank' : undefined}
        rel={value?.blank ? 'noopener noreferrer' : undefined}
        className="works-section-link"
      >
        {children}
      </a>
    ),
  },
  types: {
    button: ({ value }) => (
      <div style={{ marginTop: '0.75rem' }}>
        <a
          href={value?.href}
          target={value?.blank ? '_blank' : undefined}
          rel={value?.blank ? 'noopener noreferrer' : undefined}
          className="works-btn"
          style={{ display: 'inline-block' }}
        >
          {value?.label}
        </a>
      </div>
    ),
  },
}

interface ArtworkCard {
  _id: string
  title: string
  year?: number
  slug: { current: string }
  mainImage?: { url?: string }
  priceIncVat?: number
  vatRate?: number | string
  status?: string
  category?: string
  featured?: boolean
  order?: number
  _type?: string
  buyUrl?: string
  medium?: string
  dimensions?: { widthCm?: number; heightCm?: number }
  // variant card (synthetic — not from Sanity directly)
  isVariantCard?: boolean
  variantBadge?: string
  variantNote?: string
  variantOnSale?: boolean
  variantSalePrice?: number
}

interface SectionConfig {
  title?: string
  categories?: string[]
  visible: boolean
  columns: number
  max2col?: number
  max3col?: number
  max4col?: number
  description?: PT
  showViewAll?: boolean
}

interface WorksPageConfig {
  sections?: SectionConfig[]
}

/**
 * Shopvarianten — dezelfde vorm op artwork en zine, en dezelfde als in de
 * gallery-template. Alle bedragen incl. BTW; er wordt niets omgerekend.
 */
interface ShopVariant {
  badge: string
  status?: string
  priceIncVat?: number
  onSale?: boolean
  salePrice?: number
  buyUrl?: string
  note?: string
  variantImages?: { asset: { url: string } }[]
}

type WithVariants = ArtworkCard & { shopVariants?: ShopVariant[] }

const VARIANT_PROJECTION = `shopVariants[]{
  badge, status, priceIncVat, onSale, salePrice, buyUrl, note,
  "variantImages": images[]{ asset->{ url } }
}`

/** Zet een product om in zijn eigen kaart, gevolgd door één kaart per variant. */
function expandVariants(item: WithVariants): ArtworkCard[] {
  const variants = (item.shopVariants ?? []).map((v, i) => ({
    _id: `${item._id}-variant-${i}`,
    _type: item._type,
    title: item.title,
    year: item.year,
    category: item.category,
    status: v.status ?? 'available',
    // De variantprijs vervangt de basisprijs; ontbreekt hij, dan geldt de basis.
    priceIncVat: v.priceIncVat ?? item.priceIncVat,
    vatRate: item.vatRate,
    featured: item.featured,
    order: item.order,
    slug: item.slug,
    mainImage: v.variantImages?.[0] ? { url: v.variantImages[0].asset.url } : item.mainImage,
    buyUrl: v.buyUrl ?? item.buyUrl,
    isVariantCard: true,
    variantBadge: v.badge,
    variantNote: v.note,
    variantOnSale: v.onSale,
    variantSalePrice: v.salePrice,
  } satisfies ArtworkCard))
  return [item as ArtworkCard, ...variants]
}

async function getWorksData(): Promise<{ config: WorksPageConfig | null; works: ArtworkCard[] }> {
  const [config, artworks, zines] = await Promise.all([
    client.fetch<WorksPageConfig | null>(
      `*[_type == "worksPage"][0]{ sections[]{ title, categories, visible, columns, max2col, max3col, max4col, showViewAll, description } }`,
      {},
      { next: { revalidate: 0 } },
    ),
    client.fetch<WithVariants[]>(
      `*[_type == "artwork" && defined(slug.current) && availableInShop == true] | order(shopFeatured desc, shopOrder asc, year desc){
        _id, _type, title, year, slug, "order": shopOrder,
        "mainImage": { "url": coalesce(images[0].asset->url, coverImageUrl) },
        priceIncVat, vatRate, status, category, "featured": shopFeatured, buyUrl,
        medium, dimensions,
        ${VARIANT_PROJECTION}
      }`,
      {},
      { next: { revalidate: 0 } },
    ),
    client.fetch<WithVariants[]>(
      `*[_type == "publication" && defined(publicationCategory)] | order(shopFeatured desc, order asc){
        _id, _type, title, "category": publicationCategory, status, priceIncVat, vatRate, "featured": shopFeatured, order,
        "year": null,
        "slug": { "current": coalesce(slug.current, projectSlug) },
        "mainImage": { "url": coalesce(coverImage.asset->url, coverImageUrl) },
        ${VARIANT_PROJECTION}
      }`,
      {},
      { next: { revalidate: 0 } },
    ),
  ])

  const expandedArtworks = artworks.flatMap(expandVariants)
  const expandedZines = zines.filter(z => z.slug?.current).flatMap(expandVariants)

  const works = [...expandedArtworks, ...expandedZines]
    .sort((a, b) => {
      // Items with an explicit order come first (ascending), items without go to the end
      // Variant cards share their parent's order value — they'll cluster together
      if (a.order != null && b.order != null) return a.order - b.order
      if (a.order != null) return -1
      if (b.order != null) return 1
      return 0
    })

  return { config, works }
}

function formatPrice(inclVat: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(inclVat)
}

function CartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </svg>
  )
}

// A few "Publications" artwork docs are really zines readable on their own
// project page rather than purchasable products — link them there instead.
const ZINE_PROJECT_LINKS: Record<string, string> = {
  'zine-no-9-asia': '/projects/asia',
  'zine-no-8-the-warsaw-saga': '/projects/warsaw-saga',
  'zine-no-2-girls-in-paris': '/projects/girls-in-paris',
}

function WorkCard({ w }: { w: ArtworkCard }) {
  const rawUrl = w.mainImage?.url ?? null
  const imgUrl = rawUrl
    ? rawUrl.includes('cdn.sanity.io')
      ? `${rawUrl}?w=600&auto=format&q=80`
      : rawUrl
    : null
  const soldOut = w.status === 'sold' || w.status === 'sold_out'
  const price = w.priceIncVat ? formatPrice(w.priceIncVat) : null

  const zineProjectHref = ZINE_PROJECT_LINKS[w.slug.current]
  const isZine = w._type === 'publication' || !!zineProjectHref
  const isVariant = w.isVariantCard === true
  const badge = w.variantBadge
  const isGetInTouch = w.slug.current === 'get-in-touch'

  // Variant card: use its buyUrl directly (external), or fall back to product page with ?variant=<badge>
  const variantParam = badge ? `?variant=${encodeURIComponent(badge.toLowerCase())}` : ''
  const variantHref = w.buyUrl ?? `/projects/${w.slug.current}${variantParam}`

  const href = isGetInTouch
    ? '/contact'
    : isVariant
    ? variantHref
    : zineProjectHref
    ?? (w._type === 'publication' ? `/projects/${w.slug.current}` : `/works/${w.slug.current}`)

  // Badge style per type
  const BADGE_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
    'Signed':          { bg: 'var(--color-text)', color: 'var(--tone-paper)', icon: '✦' },
    'Limited Edition': { bg: 'var(--color-warn-text)', color: 'var(--tone-paper)', icon: '◈' },
    'Special Edition': { bg: 'var(--color-link)', color: 'var(--tone-paper)', icon: '★' },
  }
  // Ook op voorvoegsel, zodat "Special Edition Box 1" de kleur van Special
  // Edition krijgt in plaats van de neutrale terugval.
  const badgeStyle = badge
    ? (BADGE_STYLES[badge] ??
       Object.entries(BADGE_STYLES).find(([k]) => badge.startsWith(k))?.[1] ??
       { bg: 'var(--tone-800)', color: 'var(--tone-paper)', icon: '' })
    : null

  const overlayLabel = isGetInTouch
    ? 'Get in touch'
    : isVariant
    ? (badge ? `Buy — ${badge}` : 'Buy variant')
    : isZine
    ? 'Read the zine'
    : soldOut
    ? 'More information'
    : <><CartIcon /> Add to cart</>

  const isExternalHref = isVariant && !!w.buyUrl

  const cardContent = (
    <>
      <div className="works-grid-img-wrap">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={w.title} className="works-grid-img" />
        ) : (
          <div className="works-grid-img" style={{ background: 'var(--color-surface-2)' }} />
        )}
        {isVariant && !soldOut && badgeStyle && (
          <span className="works-badge" style={{ background: badgeStyle.bg, color: badgeStyle.color, fontSize: 'var(--type-label)', letterSpacing: '0.08em' }}>
            {badgeStyle.icon && `${badgeStyle.icon} `}{badge?.toUpperCase()}
          </span>
        )}
        {isVariant && !soldOut && w.variantOnSale && w.variantSalePrice && (
          <span className="works-badge works-badge-sale" style={{ top: badgeStyle ? '1.6rem' : undefined, background: 'var(--color-danger)', color: 'var(--tone-paper)', fontSize: 'var(--type-label)', letterSpacing: '0.08em' }}>
            SALE
          </span>
        )}
        {soldOut && <span className="works-badge works-badge-sold">SOLD OUT</span>}
        <div className="works-hover-overlay">{overlayLabel}</div>
      </div>
      <h3 className="works-grid-title">
        {w.title}
        {isVariant && badge && <span style={{ color: 'var(--color-subtle)', fontStyle: 'normal' }}> — {badge.toLowerCase()}</span>}
        {!isVariant && isZine && <span style={{ color: 'var(--color-subtle)', fontStyle: 'normal' }}> (click to read)</span>}
      </h3>
      {w.variantNote && (
        <p className="works-grid-medium">{w.variantNote}</p>
      )}
      {!isVariant && w.medium && (
        <p className="works-grid-medium">{w.medium}</p>
      )}
      {(w.year || w.dimensions) && (
        <p className="works-grid-meta">
          {[
            w.year,
            w.dimensions?.widthCm && w.dimensions?.heightCm
              ? `${w.dimensions.widthCm} × ${w.dimensions.heightCm} cm`
              : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}
      {isVariant && w.variantOnSale && w.variantSalePrice ? (
        <p className="works-price">
          <span style={{ color: 'var(--color-danger)' }}>{formatPrice(w.variantSalePrice)}</span>
          {w.priceIncVat && <span style={{ color: 'var(--color-subtle)', textDecoration: 'line-through', marginLeft: '0.4em', fontSize: 'var(--type-body)' }}>{formatPrice(w.priceIncVat)}</span>}
        </p>
      ) : price ? (
        <p className="works-price">{price}</p>
      ) : null}
    </>
  )

  const className = `works-grid-item-link${soldOut ? ' is-sold-out' : ''}${isVariant ? ' is-variant-card' : ''}`
  const cardStyle = isVariant ? { background: 'var(--color-surface)' } : undefined

  if (isExternalHref) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={cardStyle}>
        {cardContent}
      </a>
    )
  }

  return (
    <Link href={href} className={className} style={cardStyle}>
      {cardContent}
    </Link>
  )
}

export default async function WorksPage() {
  const { config, works } = await getWorksData()

  const sections = config?.sections ?? []
  const visibleSections = sections.filter(s => s.visible)

  if (visibleSections.length === 0) {
    return (
      <>
        <section className="works-section">
          <div className="works-grid">
            {works.map(w => <WorkCard key={w._id} w={w} />)}
          </div>
        </section>
        <ContactSection />
      </>
    )
  }

  const grouped = visibleSections.map(s => {
    const cats = s.categories ?? []
    const isAll = cats.length === 0 || cats.includes('Alle werken')
    const filtered = isAll
      ? works
      : works.filter(w => w.category && cats.includes(w.category))
    const cols = s.columns ?? 3
    const effectiveMax = cols === 2
      ? (s.max2col ?? 4)
      : cols === 4
      ? (s.max4col ?? 4)
      : (s.max3col ?? 6)
    const showAll = effectiveMax === 0
    return {
      title: s.title || (s.categories ?? []).join(' & ') || '',
      isAll,
      columns: cols,
      max: effectiveMax,
      showAll,
      description: s.description,
      showViewAll: s.showViewAll ?? false,
      works: showAll ? filtered : filtered.slice(0, effectiveMax),
      total: filtered.length,
    }
  }).filter(g => g.works.length > 0)

  return (
    <>
      {grouped.map((group, i) => (
        <div key={group.title} style={i > 0 ? { marginTop: '4rem' } : undefined}>
          {group.isAll ? (
            // "Alle werken" — interactive filter + highlighted
            <WorksAllSection works={works} columns={group.columns} />
          ) : (
            <section className="works-section">
              <h2 className="works-section-title">{group.title}</h2>
              {group.description && group.description.length > 0 && (
                <div className="works-section-desc">
                  <PortableText value={group.description} components={ptComponents} />
                </div>
              )}
              <div
                className="works-grid"
                style={{ gridTemplateColumns: `repeat(${group.columns}, 1fr)` }}
              >
                {group.works.map(w => <WorkCard key={w._id} w={w} />)}
              </div>
              {group.showViewAll && !group.showAll && group.total > group.max && (
                <div style={{ marginTop: '1.5rem' }}>
                  <Link
                    href={`/works/all?cat=${encodeURIComponent(group.title)}`}
                    className="works-view-all"
                  >
                    Bekijk alle {group.title} ({group.total}) →
                  </Link>
                </div>
              )}
            </section>
          )}
        </div>
      ))}

      <ContactSection />
    </>
  )
}

function ContactSection() {
  return null
}
