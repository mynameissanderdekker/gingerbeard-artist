'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { urlFor } from '@/sanity/lib/image'
import EnquirePanel from '@/components/EnquirePanel'
import ViewInRoomModal from '@/components/ViewInRoomModal'
import { useCartStore } from '@/store/cart'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SanityImageSource = any

export interface ArtworkData {
  _id: string
  title: string
  year?: number
  medium?: string
  dimensions?: { widthCm?: number; heightCm?: number; depthCm?: number }
  dimensionsExclFrame?: boolean
  images?: Array<{ asset?: { _ref: string; _id?: string; url?: string }; hotspot?: object; crop?: object }>
  roomImageUrl?: string
  showViewOnWall?: boolean
  roomImageWidth?: number
  priceExclVAT?: number
  priceIncVat?: number
  vatRate?: number | string
  options?: Array<{ label: string; sku?: string; priceExclVAT: number; buyUrl?: string }>
  status?: string
  availableInShop?: boolean
  buyUrl?: string
  editionTotal?: number
  editionAP?: number
  slug?: { current: string }
  description?: Array<{ children?: Array<{ text?: string }> }>
  metaDescription?: string
}

function imgUrl(img: SanityImageSource, width: number) {
  return urlFor(img).width(width).auto('format').quality(85).url()
}

function formatDimensions(d?: { widthCm?: number; heightCm?: number; depthCm?: number }) {
  if (!d) return null
  const wh = [d.widthCm, d.heightCm].filter(Boolean)
  if (!wh.length) return null
  const base = wh.join(' × ') + ' cm'
  return d.depthCm ? `${base} × ${d.depthCm} cm` : base
}

function formatPrice(excl: number, vatRate: number | string | null | undefined = 9) {
  const incl = excl * (1 + Number(vatRate ?? 9) / 100)
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(incl)
}

function blockText(blocks?: Array<{ children?: Array<{ text?: string }> }>) {
  return blocks?.map(b => b.children?.map(c => c.text).join('')).filter(Boolean).join('\n\n') ?? null
}

export default function ArtworkDetail({ artwork }: { artwork: ArtworkData }) {
  const images = artwork.images ?? []
  const [activeIdx, setActiveIdx] = useState(0)
  const [enquireOpen, setEnquireOpen] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const router = useRouter()

  const hasOptions = (artwork.options?.length ?? 0) > 0
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(0)
  const selectedOption = hasOptions ? artwork.options![selectedOptionIdx] : null
  const effectivePriceExclVAT = selectedOption?.priceExclVAT ?? artwork.priceExclVAT

  const activeImg = images[activeIdx]
  const mainUrl   = activeImg?.asset?.url
    ? `${activeImg.asset.url}?w=1400&auto=format&q=85`
    : activeImg?.asset ? imgUrl(activeImg as SanityImageSource, 1400) : null
  const thumbMain = activeImg?.asset?.url
    ? `${activeImg.asset.url}?w=400&auto=format&q=85`
    : activeImg?.asset ? imgUrl(activeImg as SanityImageSource, 400) : null

  const dims    = formatDimensions(artwork.dimensions)
  const edition = [
    artwork.editionTotal ? `${artwork.editionTotal}` : null,
    artwork.editionAP    ? `+ ${artwork.editionAP} AP` : null,
  ].filter(Boolean).join(' ')

  const isSoldOut       = artwork.status === 'sold_out'
  const sellInWebshop   = artwork.availableInShop === true
  const descText        = blockText(artwork.description)

  // EnquirePanel expects this shape — pass clean base URL (no transform params), panel adds its own
  const enquireArtwork = {
    _id:   artwork._id,
    title: artwork.title,
    year:  artwork.year ?? 0,
    image: activeImg?.asset?.url ?? undefined,
    slug:  artwork.slug?.current,
  }

  return (
    <>
      {/* artwork-detail class triggers .site-main:has(.artwork-detail) CSS override → full bleed */}
      <div className="artwork-detail flex flex-col lg:flex-row">

        {/* ── Image column: no background, X button absolute top-right, thumbnails below ── */}
        <div className="flex-1 min-w-0 flex flex-col relative" style={{ padding: '40px 48px 32px' }}>
          {/* X close button — absolute so it doesn't push image down */}
          <button
            onClick={() => router.back()}
            className="text-gray-400 hover:text-black transition-colors text-xl leading-none absolute"
            style={{ top: '40px', right: '48px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-label="Back"
          >
            ✕
          </button>

          {/* Main image — fixed height container so thumbnails don't jump on image switch */}
          <div className="flex items-center justify-center" style={{ height: '55vh' }}>
            {mainUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mainUrl}
                alt={artwork.title}
                className="object-contain"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
                fetchPriority="high"
              />
            ) : (
              <div className="w-64 h-64 bg-gray-100" />
            )}
          </div>

          {/* Thumbnails below image — larger */}
          {images.length > 1 && (
            <div className="flex flex-row flex-wrap gap-3 mt-6 justify-center">
              {images.map((img, i) => {
                const thumbUrl = img?.asset?.url
                  ? `${img.asset.url}?w=300&auto=format&q=80`
                  : img?.asset ? imgUrl(img as SanityImageSource, 300) : null
                return (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`w-24 h-24 overflow-hidden border transition-colors duration-150 bg-gray-50 ${
                      i === activeIdx ? 'border-black' : 'border-transparent hover:border-gray-400'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbUrl ?? undefined}
                      alt={`${artwork.title} — ${i + 1}`}
                      className="w-full h-full object-contain"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Info panel: right column ── */}
        <div
          className="lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col overflow-y-auto border-l border-gray-100 bg-white"
          style={{ padding: '40px 28px 28px' }}
        >
          {/* Title + year — direct bovenaan, geen back link */}
          <h1 className="text-lg font-normal leading-snug mb-0.5">{artwork.title}</h1>
          {artwork.year && (
            <p className="text-sm text-gray-400 mb-4 italic">{artwork.year}</p>
          )}

          {/* Details */}
          <dl className="space-y-2 text-sm border-t border-gray-100 pt-4">
            {artwork.medium && (
              <div className="flex gap-3">
                <dt className="text-gray-400 w-16 shrink-0">Medium</dt>
                <dd className="text-gray-800 leading-snug">{artwork.medium}</dd>
              </div>
            )}
            {dims && (
              <div className="flex gap-3">
                <dt className="text-gray-400 w-16 shrink-0">Size</dt>
                <dd className="text-gray-800">
                  {dims}{artwork.dimensionsExclFrame && <span className="text-gray-400 text-xs ml-1">excl. frame</span>}
                </dd>
              </div>
            )}
            {edition && (
              <div className="flex gap-3">
                <dt className="text-gray-400 w-16 shrink-0">Edition</dt>
                <dd className="text-gray-800">{edition}</dd>
              </div>
            )}
          </dl>

          {descText && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">{descText}</p>
          )}

          {/* Price + CTAs */}
          <div className="mt-6 flex flex-col gap-2">
            {artwork.slug?.current === 'get-in-touch' && (
              <a
                href="/contact"
                className="border border-black px-6 py-3 text-xs tracking-widest uppercase font-medium text-center hover:bg-black hover:text-white transition-colors duration-150"
              >
                Get in touch
              </a>
            )}

            {isSoldOut && (
              <p className="text-xs tracking-widest uppercase text-gray-400">Sold out</p>
            )}

            {!isSoldOut && hasOptions && (
              <div className="flex flex-col gap-2">
                {artwork.options!.map((opt, i) => (
                  <button
                    key={opt.sku ?? opt.label}
                    onClick={() => setSelectedOptionIdx(i)}
                    className={`text-left border px-4 py-2.5 text-sm transition-colors duration-150 ${
                      i === selectedOptionIdx
                        ? 'border-black bg-black text-white'
                        : 'border-gray-300 hover:border-black'
                    }`}
                  >
                    <span className="block">{opt.label} <span className="opacity-50 font-normal text-xs">excl. frame</span></span>
                    {sellInWebshop && (
                      <span className="block text-xs opacity-70 mt-0.5">
                        {formatPrice(opt.priceExclVAT, artwork.vatRate)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}


            {/* Prijs alleen als het werk in de webshop staat — zelfde regel als
                Torch. Buiten de webshop is de prijs iets voor de prijslijst of
                een gesprek, niet voor de pagina. */}
            {!isSoldOut && sellInWebshop && !hasOptions && effectivePriceExclVAT && (
              <p className="text-xl font-medium">
                {formatPrice(effectivePriceExclVAT, artwork.vatRate)}
              </p>
            )}
            {!isSoldOut && sellInWebshop && !effectivePriceExclVAT && !hasOptions && (
              <p className="text-sm text-gray-500 uppercase tracking-widest">Price on request</p>
            )}

            {/* Buy — availableInShop aan → voeg toe aan cart en ga naar /cart */}
            {!isSoldOut && sellInWebshop && effectivePriceExclVAT && (
              <button
                onClick={() => {
                  const variantKey = selectedOption?.sku ?? selectedOption?.label
                  addItem({
                    id: variantKey ? `${artwork._id}::${variantKey}` : artwork._id,
                    slug: artwork.slug?.current ?? '',
                    title: artwork.title,
                    priceIncl: effectivePriceExclVAT
                      ? effectivePriceExclVAT * (1 + Number(artwork.vatRate ?? 9) / 100)
                      : 0,
                    imageUrl: thumbMain ?? undefined,
                    variantLabel: selectedOption?.label,
                  })
                  router.push('/cart')
                }}
                className="border border-black px-6 py-3 text-xs tracking-widest uppercase font-medium hover:bg-black hover:text-white transition-colors duration-150"
              >
                Buy
              </button>
            )}

            {/* Enquire — availableInShop uit → slide-in contactformulier */}
            {!isSoldOut && !sellInWebshop && (
              <button
                onClick={() => setEnquireOpen(true)}
                className="border border-black px-6 py-3 text-xs tracking-widest uppercase font-medium hover:bg-black hover:text-white transition-colors duration-150"
              >
                Enquire
              </button>
            )}

            {artwork.showViewOnWall && mainUrl && (
              <button
                onClick={() => setRoomOpen(true)}
                className="border border-gray-300 px-6 py-3 text-xs tracking-widest uppercase font-medium text-gray-500 hover:border-gray-500 hover:text-gray-800 transition-colors duration-150"
              >
                View on wall
              </button>
            )}
          </div>

        </div>
      </div>

      {enquireOpen && (
        <EnquirePanel
          artwork={enquireArtwork}
          onClose={() => setEnquireOpen(false)}
        />
      )}

      {roomOpen && mainUrl && (
        <ViewInRoomModal
          imageUrl={artwork.roomImageUrl ?? mainUrl}
          title={artwork.title}
          widthCm={artwork.roomImageWidth ?? artwork.dimensions?.widthCm}
          onClose={() => setRoomOpen(false)}
        />
      )}
    </>
  )
}
