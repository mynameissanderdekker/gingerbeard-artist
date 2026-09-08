import React from 'react'
import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import { urlFor } from '@/sanity/lib/image'
import ZineViewer from '@/components/ZineViewer'
import SpinWheel from '@/components/SpinWheel'
import VideoPlayer from '@/components/VideoPlayer'

// ── Types ─────────────────────────────────────────────────────────────────────

type SanityImage = { asset?: { _ref?: string }; hotspot?: unknown; crop?: unknown }

interface HeroVideoBlock   { _type: 'heroVideo'; url: string; posterImage?: SanityImage }
interface TextSectionBlock { _type: 'textSection'; content: unknown[]; width?: 'full' | '8col' | '6col'; textAlign?: 'left' | 'center' | 'right' }
interface ImageTextBlock   {
  _type: 'imageText'
  image?: SanityImage
  imageUrl?: string
  content?: unknown[]
  // new fields
  imagePosition?: 'left' | 'right'
  imageSplit?: '25' | '33' | '50' | '66' | '75'
  // legacy
  layout?: '4+8-left' | '8+4-right' | '3+9-left' | '9+3-right'
  caption?: string
}
interface GalleryBlock     { _type: 'galleryBlock'; images?: SanityImage[]; externalUrls?: string[]; columns?: 2 | 3 | 4; alignment?: 'left' | 'center' | 'right'; masonry?: boolean }
interface CardItem         { image?: SanityImage; imageUrl?: string; title?: string; text?: unknown[]; buttonLabel?: string; buttonUrl?: string }
interface CardsBlock       { _type: 'cardsBlock'; columns?: 2 | 3 | 4; cards?: CardItem[] }
interface PullQuoteBlock   { _type: 'pullQuote'; text: string }
interface ZineGridBlock    { _type: 'zineGrid'; showFeatured?: boolean; showAll?: boolean }
interface DividerBlock     { _type: 'dividerBlock' }
interface SpacerBlock      { _type: 'spacer'; size?: 'small' | 'medium' | 'large' }
interface HeroImageBlock   { _type: 'heroImage'; imageUrl?: string; image?: SanityImage; alt?: string }
interface PdfViewerBlock   { _type: 'pdfViewer'; pdfUrl: string }
interface VideoEmbedBlock  { _type: 'videoEmbed'; embedUrl: string; posterImage?: SanityImage }
interface SpinWheelBlock   { _type: 'spinWheel'; coverImage?: string; images?: string[] }
interface PersonBlock      { _type: 'personBlock'; name?: string; location?: string; images?: SanityImage[]; externalUrls?: string[]; imageSize?: '1/4' | '2/4' | '3/4' | 'full'; imageAlign?: 'left' | 'center' | 'right'; columns?: number; body?: unknown[] }

export type PageBlock =
  | HeroVideoBlock
  | HeroImageBlock
  | VideoEmbedBlock
  | TextSectionBlock
  | ImageTextBlock
  | GalleryBlock
  | CardsBlock
  | PullQuoteBlock
  | PdfViewerBlock
  | SpinWheelBlock
  | PersonBlock
  | ZineGridBlock
  | DividerBlock
  | SpacerBlock

interface ZineItem {
  number?: string
  title: string
  meta?: string
  description?: string
  featured: boolean
  projectSlug?: string
  mainImage?: SanityImage
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WIDTH_MAP = { full: '100%', '8col': '66.666%', '6col': '50%' }

function zineImg(zine: ZineItem) {
  if (zine.mainImage?.asset) return urlFor(zine.mainImage).width(800).fit('max').url()
  return null
}

// ── Block renderers ───────────────────────────────────────────────────────────

function HeroImage({ block }: { block: HeroImageBlock }) {
  const src = block.imageUrl ?? (block.image?.asset ? urlFor(block.image).width(1600).fit('max').url() : null)
  if (!src) return null
  return (
    <div className="project-hero">
      <Image src={src} alt={block.alt ?? ''} width={1600} height={1067} style={{ width: '100%', height: 'auto', display: 'block' }} sizes="100vw" priority />
    </div>
  )
}

function VideoEmbed({ block }: { block: VideoEmbedBlock }) {
  const posterUrl = block.posterImage?.asset ? urlFor(block.posterImage).width(1400).fit('max').url() : undefined
  return <VideoPlayer embedUrl={block.embedUrl} posterUrl={posterUrl} />
}

function PdfViewer({ block }: { block: PdfViewerBlock }) {
  return <ZineViewer pdfUrl={block.pdfUrl} />
}

function SpinWheelBlock_({ block }: { block: SpinWheelBlock }) {
  return (
    <div className="project-spin">
      <SpinWheel
        images={block.images ?? []}
        coverImage={block.coverImage ?? ''}
      />
    </div>
  )
}

function HeroVideo({ block }: { block: HeroVideoBlock }) {
  const posterUrl = block.posterImage?.asset ? urlFor(block.posterImage).width(1400).fit('max').url() : undefined
  return <VideoPlayer mp4Url={block.url} posterUrl={posterUrl} />
}

export const ptComponents = {
  block: {
    h1: ({ children }: { children?: React.ReactNode }) => <h1 style={{ fontSize: 'var(--type-h2)', fontWeight: 700, margin: '0.5em 0' }}>{children}</h1>,
    h2: ({ children }: { children?: React.ReactNode }) => <h2 style={{ fontSize: 'var(--type-h3)', fontWeight: 700, margin: '0.5em 0' }}>{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, margin: '0.5em 0' }}>{children}</h3>,
    h4: ({ children }: { children?: React.ReactNode }) => <h4 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, letterSpacing: 0, marginTop: '2rem', marginBottom: '0.4rem' }}>{children}</h4>,
    blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote style={{ borderLeft: '3px solid var(--tone-300)', paddingLeft: '1em', color: 'var(--tone-600)', margin: '1em 0', fontStyle: 'italic' }}>{children}</blockquote>,
  },
  marks: {
    underline: ({ children }: { children?: React.ReactNode }) => <span style={{ textDecoration: 'underline' }}>{children}</span>,
    link: ({ value, children }: { value?: { href?: string; blank?: boolean }; children?: React.ReactNode }) => (
      <a href={value?.href} target={value?.blank ? '_blank' : undefined} rel={value?.blank ? 'noopener noreferrer' : undefined} style={{ textDecoration: 'underline' }}>
        {children}
      </a>
    ),
  },
}

function TextSection({ block }: { block: TextSectionBlock }) {
  const widthClass = `project-intro--${block.width ?? '8col'}`
  const textAlign = block.textAlign ?? 'left'
  return (
    <div className={`project-intro ${widthClass}`} style={{ margin: '0 auto', textAlign, marginBottom: '0' }}>
      <PortableText value={block.content as Parameters<typeof PortableText>[0]['value']} components={ptComponents} />
    </div>
  )
}

function ImageText({ block }: { block: ImageTextBlock }) {
  // Resolve position + split from new fields, with fallback to legacy layout values
  const legacyRight = block.layout === '8+4-right' || block.layout === '9+3-right'
  const legacySplit = (block.layout === '3+9-left' || block.layout === '9+3-right') ? '25' : '33'
  const imgRight = block.imagePosition ? block.imagePosition === 'right' : legacyRight
  const split = block.imageSplit ?? legacySplit
  const splitMap: Record<string, string> = { '25': '25%', '33': '33.333%', '50': '50%', '66': '66.666%', '75': '75%' }
  const imgW = splitMap[split] ?? '50%'
  const textW = `calc(100% - ${imgW} - 40px)`

  // Use Sanity image, fallback to external URL, fallback to caption if it looks like a URL
  const isUrl = (s?: string) => s?.startsWith('http')
  const imgUrl = block.image?.asset
    ? urlFor(block.image).width(900).fit('max').url()
    : block.imageUrl ?? (isUrl(block.caption) ? block.caption : null)
  const captionText = isUrl(block.caption) ? undefined : block.caption

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: imgRight ? `${textW} ${imgW}` : `${imgW} ${textW}`,
      gap: '40px',
      alignItems: 'start',
    }}>
      {imgRight ? (
        <>
          <div className="project-intro">
            {block.content && <PortableText value={block.content as Parameters<typeof PortableText>[0]['value']} />}
          </div>
          <div>
            {imgUrl && <Image src={imgUrl} alt={captionText ?? ''} width={900} height={600} style={{ width: '100%', height: 'auto', display: 'block' }} sizes="50vw" />}
            {captionText && <p style={{ fontSize: 12, color: 'var(--tone-500)', marginTop: 8 }}>{captionText}</p>}
          </div>
        </>
      ) : (
        <>
          <div>
            {imgUrl && <Image src={imgUrl} alt={captionText ?? ''} width={900} height={600} style={{ width: '100%', height: 'auto', display: 'block' }} sizes="50vw" />}
            {captionText && <p style={{ fontSize: 12, color: 'var(--tone-500)', marginTop: 8 }}>{captionText}</p>}
          </div>
          <div className="project-intro">
            {block.content && <PortableText value={block.content as Parameters<typeof PortableText>[0]['value']} />}
          </div>
        </>
      )}
    </div>
  )
}

function Gallery({ block }: { block: GalleryBlock }) {
  const alignment = block.alignment ?? 'left'
  const masonry = block.masonry ?? false
  const sanityUrls = (block.images ?? [])
    .map(img => img?.asset ? urlFor(img).width(1200).fit('max').url() : null)
    .filter(Boolean) as string[]
  const allUrls = [...sanityUrls, ...(block.externalUrls ?? [])]
  const cols = block.columns ?? Math.min(allUrls.length || 1, 3)
  const justifyMap: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }
  // Masonry: CSS columns. Grid: use flex for center/right, grid class for left.
  const useFlex = !masonry && alignment !== 'left'
  const itemW = `calc(${100 / cols}% - ${12 * (cols - 1) / cols}px)`

  if (masonry) {
    return (
      <div className={`pb-gallery pb-gallery--masonry pb-gallery--${cols}col`} style={{ marginTop: '3rem' }}>
        {allUrls.map((url, i) => (
          <div key={i} className="pb-gallery-item">
            <Image src={url} alt="" width={1200} height={800} style={{ width: '100%', height: 'auto', display: 'block' }} sizes={cols === 1 ? '100vw' : cols === 2 ? '50vw' : cols === 3 ? '33vw' : '25vw'} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      className={useFlex ? undefined : `pb-gallery pb-gallery--${cols}col`}
      style={useFlex
        ? { display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: justifyMap[alignment], marginTop: '3rem' }
        : { marginTop: '3rem' }
      }
    >
      {allUrls.map((url, i) => (
        <div key={i} className={useFlex ? undefined : 'pb-gallery-item'} style={useFlex ? { width: itemW } : undefined}>
          <Image src={url} alt="" width={1200} height={800} style={{ width: '100%', height: 'auto', display: 'block' }} sizes={cols === 1 ? '100vw' : cols === 2 ? '50vw' : cols === 3 ? '33vw' : '25vw'} />
        </div>
      ))}
    </div>
  )
}

const IMG_SIZE_MAP: Record<string, string> = { '1/4': '25%', '2/4': '50%', '3/4': '75%', 'full': '100%' }
const IMG_ALIGN_MAP: Record<string, string> = { left: 'flex-start', center: 'center', right: 'flex-end' }

const IMG_SIZES_MAP: Record<string, string> = { '1/4': '25vw', '2/4': '50vw', '3/4': '75vw', 'full': '100vw' }

function PersonProfile({ block }: { block: PersonBlock }) {
  const sanityImgs = (block.images ?? [])
    .map(img => img?.asset ? urlFor(img).width(1200).fit('max').url() : null)
    .filter(Boolean) as string[]
  const imgs = sanityImgs.length > 0 ? sanityImgs : (block.externalUrls ?? [])
  const isSingle = imgs.length === 1
  const cols = isSingle ? 1 : (block.columns ?? Math.min(imgs.length, 3))
  const forcedCols = !isSingle && block.columns && block.columns > imgs.length

  // Single-image: respect explicit size + alignment
  const imgW = isSingle
    ? (IMG_SIZE_MAP[block.imageSize ?? 'full'])
    : `calc(${100 / cols}% - ${12 * (cols - 1) / cols}px)`
  const justifyContent = isSingle
    ? (IMG_ALIGN_MAP[block.imageAlign ?? 'left'])
    : (forcedCols ? 'center' : 'flex-start')
  const sizes = isSingle
    ? (IMG_SIZES_MAP[block.imageSize ?? 'full'])
    : (cols === 2 ? '50vw' : '33vw')

  return (
    <div style={{ marginTop: '3.5rem' }}>
      {imgs.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', justifyContent, marginBottom: '1.25rem' }}>
          {imgs.map((url, i) => (
            <div key={i} style={{ width: imgW }}>
              <Image src={url} alt="" width={1200} height={800} style={{ width: '100%', height: 'auto', display: 'block' }} sizes={sizes} />
            </div>
          ))}
        </div>
      )}
      {(block.name || block.location) && (
        <div className="project-intro project-intro--8col" style={{ margin: '0 auto' }}>
          <h4 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, letterSpacing: 0, margin: '0 0 0.6rem' }}>
            {block.name && <strong>{block.name}</strong>}
            {block.name && block.location && <span style={{ fontWeight: 400 }}> — </span>}
            {block.location && <em style={{ fontWeight: 400 }}>{block.location}</em>}
          </h4>
        </div>
      )}
      {block.body && block.body.length > 0 && (
        <div className="project-intro project-intro--8col" style={{ margin: '0 auto', marginBottom: 0 }}>
          <PortableText value={block.body as Parameters<typeof PortableText>[0]['value']} components={ptComponents} />
        </div>
      )}
    </div>
  )
}

function PullQuote({ block }: { block: PullQuoteBlock }) {
  return (
    <h2 className="project-pull-quote">{block.text}</h2>
  )
}

function ZineGrid({ block, zines }: { block: ZineGridBlock; zines: ZineItem[] }) {
  const featured = zines.filter(z => z.featured)
  const rest = zines.filter(z => !z.featured)

  return (
    <>
      {block.showFeatured !== false && featured.length > 0 && (
        <div className="zine-grid">
          {featured.map((zine, i) => {
            const imgUrl = zineImg(zine)
            const inner = (
              <>
                {imgUrl && <img src={imgUrl} alt={zine.title} className="zine-card-img" />}
                <div className="zine-card-body">
                  <h3 className="zine-card-title">{zine.number ? `${zine.number} ` : ''}{zine.title}</h3>
                  {zine.meta && <p className="zine-card-meta">{zine.meta}</p>}
                  {zine.description && <p className="zine-card-desc">{zine.description}</p>}
                  {zine.projectSlug && <span className="zine-read-link">Read the zine →</span>}
                </div>
              </>
            )
            return zine.projectSlug ? (
              <a key={i} href={`/projects/${zine.projectSlug}`} className="zine-card zine-card-link">{inner}</a>
            ) : (
              <div key={i} className="zine-card">{inner}</div>
            )
          })}
        </div>
      )}
      {block.showAll !== false && rest.length > 0 && (
        <div className="zine-grid zine-grid-all">
          {rest.map((zine, i) => {
            const imgUrl = zineImg(zine)
            return (
              <div key={i} className="zine-card">
                {imgUrl && <img src={imgUrl} alt={zine.title} className="zine-card-img" />}
                <div className="zine-card-body">
                  <h3 className="zine-card-title">{zine.number ? `${zine.number} ` : ''}{zine.title}</h3>
                  {zine.meta && <p className="zine-card-meta">{zine.meta}</p>}
                  {zine.description && <p className="zine-card-desc">{zine.description}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function Cards({ block }: { block: CardsBlock }) {
  const cols = block.columns ?? 3
  const cards = block.cards ?? []
  return (
    <div className={`pb-cards pb-cards--${cols}col`}>
      {cards.map((card, i) => {
        const imgUrl = card.image?.asset
          ? urlFor(card.image).width(800).fit('max').url()
          : card.imageUrl ?? null
        return (
          <div key={i}>
            {imgUrl && (
              <Image src={imgUrl} alt={card.title ?? ''} width={800} height={533} style={{ width: '100%', height: 'auto', display: 'block', marginBottom: '16px' }} sizes="33vw" />
            )}
            {card.title && (
              <p style={{ fontWeight: 700, marginBottom: '8px' }}>{card.title}</p>
            )}
            {card.text && card.text.length > 0 && (
              <div style={{ margin: 0 }}>
                <PortableText value={card.text as Parameters<typeof PortableText>[0]['value']} components={ptComponents} />
              </div>
            )}
            {card.buttonLabel && card.buttonUrl && (
              <a href={card.buttonUrl.replace(/^https?:\/\/localhost(:\d+)?/, '')} className="btn-artwork-info" style={{ marginTop: '12px' }}>
                {card.buttonLabel}
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Divider() {
  return <hr className="project-divider" />
}

const SPACER_HEIGHT = { small: '16px', medium: '48px', large: '96px' }

function Spacer({ block }: { block: SpacerBlock }) {
  return <div style={{ height: SPACER_HEIGHT[block.size ?? 'medium'] }} aria-hidden="true" />
}

// ── Main PageBuilder ──────────────────────────────────────────────────────────

interface PageBuilderProps {
  blocks: PageBlock[]
  zines?: ZineItem[]
}

export function PageBuilder({ blocks, zines = [] }: PageBuilderProps) {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block._type) {
          case 'heroImage':   return <HeroImage    key={i} block={block} />
          case 'heroVideo':   return <HeroVideo    key={i} block={block} />
          case 'videoEmbed':  return <VideoEmbed   key={i} block={block} />
          case 'textSection': return <TextSection  key={i} block={block} />
          case 'imageText':   return <ImageText    key={i} block={block} />
          case 'galleryBlock':return <Gallery      key={i} block={block} />
          case 'cardsBlock':  return <Cards        key={i} block={block} />
          case 'pullQuote':   return <PullQuote    key={i} block={block} />
          case 'pdfViewer':   return <PdfViewer    key={i} block={block} />
          case 'spinWheel':   return <SpinWheelBlock_ key={i} block={block} />
          case 'personBlock': return <PersonProfile   key={i} block={block} />
          case 'zineGrid':    return <ZineGrid     key={i} block={block} zines={zines} />
          case 'dividerBlock':return <Divider      key={i} />
          case 'spacer':      return <Spacer       key={i} block={block} />
          default:            return null
        }
      })}
    </>
  )
}
