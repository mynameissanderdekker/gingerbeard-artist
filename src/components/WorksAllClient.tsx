'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { ArtworkItem } from '@/app/(site)/works/all/page'
import BackLink from '@/components/BackLink'

function formatPrice(excl: number, vatRate: number | string | null | undefined = 9) {
  const incl = excl * (1 + Number(vatRate ?? 9) / 100)
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(incl)
}

function WorkCard({ w }: { w: ArtworkItem }) {
  const imgUrl = w.mainImage?.url ? `${w.mainImage.url}?w=600&auto=format&q=80` : null
  const soldOut = w.status === 'sold_out'
  const cheapestOption = w.options?.length
    ? Math.min(...w.options.map(o => o.priceExclVAT ?? Infinity))
    : null
  const price = w.priceExclVAT
    ? formatPrice(w.priceExclVAT, w.vatRate)
    : cheapestOption && cheapestOption !== Infinity
      ? `from ${formatPrice(cheapestOption, w.vatRate)}`
      : null

  const inner = (
    <>
      <div className="works-grid-img-wrap">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={w.title} className="works-grid-img" />
        ) : (
          <div className="works-grid-img" style={{ background: 'var(--color-surface-2)' }} />
        )}
        {soldOut && <span className="works-badge works-badge-sold">SOLD OUT</span>}
      </div>
      <h3 className="works-grid-title">{w.title}</h3>
      {w.medium && <p className="works-grid-medium">{w.medium}</p>}
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
      {price && <p className="works-price">{price}</p>}
    </>
  )

  return soldOut ? (
    <div className="works-grid-item is-sold-out">{inner}</div>
  ) : (
    <Link href={`/works/${w.slug.current}`} className="works-grid-item-link">{inner}</Link>
  )
}

interface Props {
  works: ArtworkItem[]
  categories: string[]
  initialCat?: string
}

export function WorksAllClient({ works, categories, initialCat }: Props) {
  const [activeCat, setActiveCat] = useState<string>(initialCat ?? 'all')

  const featured = useMemo(
    () => works.filter(w => w.featured && (activeCat === 'all' || w.category === activeCat)),
    [works, activeCat]
  )

  const rest = useMemo(
    () => works.filter(w => !w.featured && (activeCat === 'all' || w.category === activeCat)),
    [works, activeCat]
  )

  return (
    <>
      {/* ── Category filter ── */}
      <div className="works-filter-bar">
        <button
          className={`works-filter-btn${activeCat === 'all' ? ' is-active' : ''}`}
          onClick={() => setActiveCat('all')}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            className={`works-filter-btn${activeCat === cat ? ' is-active' : ''}`}
            onClick={() => setActiveCat(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Highlighted ── */}
      {featured.length > 0 && (
        <section className="works-section">
          <h2 className="works-section-title">Highlighted</h2>
          <div className="works-grid">
            {featured.map(w => <WorkCard key={w._id} w={w} />)}
          </div>
        </section>
      )}

      {/* ── All works ── */}
      {rest.length > 0 && (
        <section className="works-section" style={featured.length > 0 ? { marginTop: '4rem' } : undefined}>
          {featured.length > 0 && (
            <h2 className="works-section-title">
              {activeCat === 'all' ? 'All works' : activeCat}
            </h2>
          )}
          <div className="works-grid">
            {rest.map(w => <WorkCard key={w._id} w={w} />)}
          </div>
        </section>
      )}

      {featured.length === 0 && rest.length === 0 && (
        <section className="works-section">
          <p style={{ color: 'var(--color-subtle)' }}>Geen werken gevonden in deze categorie.</p>
        </section>
      )}

      {/* ── Back link ── */}
      <section className="works-section" style={{ marginTop: '2rem' }}>
        <BackLink fallback="/works" fallbackLabel="Overview" className="works-view-all" />
      </section>
    </>
  )
}
