'use client'

import { useState, useEffect } from 'react'
import { PortableText } from '@portabletext/react'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'
import { ptComponents } from '@/components/PageBuilder'

interface Quote {
  _key: string
  name: string
  role?: string
  publication?: string
  image?: { asset?: { _ref?: string } }
  quote?: string
  article?: string
  articleNl?: string
}

interface AboutData {
  portrait?: { asset?: { _ref?: string } }
  bio?: unknown[]
  quotes?: Quote[]
}

// Items can be either plain strings (legacy data) or {text, url} objects
type PubPressItem = string | { _key?: string; text: string; url?: string }

interface PubPressGroup {
  _key: string
  groupTitle: string
  items?: PubPressItem[]
}

interface PubPressColumn {
  _key: string
  columnTitle: string
  groups?: PubPressGroup[]
}

interface CvData {
  intro?: string
  cvPdfUrl?: string
  pubPressColumns?: PubPressColumn[]
}

interface CvLinkedItem {
  startDate?: string
  label: string
  gallery?: string
  location?: string
  exhibitionType?: string   // solo | duo | group | permanent | special | artFair
  projectTitle?: string
  projectOrder?: number
  hasPage?: boolean
  slug?: string
}


function QuoteItem({ q }: { q: Quote }) {
  const [open, setOpen] = useState(false)
  const [showNl, setShowNl] = useState(false)
  const imgUrl = q.image?.asset ? urlFor(q.image).width(460).fit('max').url() : null

  const articleText = showNl ? q.articleNl : q.article

  return (
    <div className="about-quote">
      <div className="about-quote-header">
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt={q.name} className="about-quote-img" />
        )}
        <div className="about-quote-meta">
          <p className="about-quote-name">
            <strong>{q.name}</strong>
            {q.role && <> — {q.role}</>}
            {q.publication && <>, <em>{q.publication}</em></>}
          </p>
          {q.quote && <p className="about-quote-text">{q.quote}</p>}
        </div>
      </div>
      {q.article && (
        <>
          <button className="about-quote-toggle" onClick={() => setOpen(o => !o)}>
            Read the whole article <span>{open ? '−' : '+'}</span>
          </button>
          {open && (
            <div className="about-quote-article">
              {q.articleNl && (
                <p style={{ fontSize: 'var(--type-label)', color: 'var(--color-subtle)', marginBottom: '1.2em' }}>
                  Translated from Dutch.{' '}
                  <button
                    onClick={() => setShowNl(v => !v)}
                    style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit', padding: 0 }}
                  >
                    {showNl ? 'Read English translation' : 'Lees het origineel in het Nederlands'}
                  </button>
                </p>
              )}
              {articleText?.split('\n\n').map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}


export default function AboutPage() {
  const [about, setAbout] = useState<AboutData | null>(null)
  const [cv, setCv] = useState<CvData | null>(null)
  const [linkedItems, setLinkedItems] = useState<CvLinkedItem[]>([])

  useEffect(() => {
    Promise.all([
      client.fetch<AboutData>(
        `*[_type == "aboutPage"][0]{ portrait, bio, quotes[]{ ..., articleNl } }`,
        {},
        { cache: 'no-store' }
      ),
      client.fetch<CvData>(
        `*[_type == "cvPage"][0]{
          intro,
          cvPdfUrl,
          pubPressColumns[]{ _key, columnTitle, groups[]{ _key, groupTitle, items[] } }
        }`,
        {},
        { cache: 'no-store' }
      ),
      client.fetch<CvLinkedItem[]>(
        `[
          ...*[_type == "exhibition" && showInCV == true]{
            startDate,
            "label": title,
            gallery,
            location,
            exhibitionType,
            hasPage,
            "slug": slug.current,
            "projectTitle": coalesce(cvProject->cvTitle, cvProject->title),
            "projectOrder": cvProject->order
          },
          ...*[_type == "artFair" && showInCV == true]{
            startDate,
            "label": title,
            "gallery": title,
            location,
            "exhibitionType": "artFair",
            hasPage,
            "slug": slug.current,
            "projectTitle": coalesce(cvProject->cvTitle, cvProject->title),
            "projectOrder": cvProject->order
          }
        ] | order(startDate desc)`,
        {},
        { cache: 'no-store' }
      ),
    ]).then(([aboutData, cvData, linked]) => {
      setAbout(aboutData)
      setCv(cvData)
      setLinkedItems(linked)
    })
  }, [])

  const quotes = about?.quotes ?? []
  const portraitUrl = about?.portrait?.asset ? urlFor(about.portrait).width(1200).fit('max').url() : null

  const pubPressColumns = cv?.pubPressColumns ?? []

  return (
    <>
      {/* Large horizontal photo, centered */}
      {portraitUrl && (
        <div className="about-hero-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portraitUrl} alt="Sander Dekker" />
        </div>
      )}

      {/* About text — same style as a project page text block */}
      {about?.bio && about.bio.length > 0 && (
        <div className="project-intro" style={{ maxWidth: '66.666%', marginLeft: 'auto', marginRight: 'auto' }}>
          <PortableText value={about.bio as Parameters<typeof PortableText>[0]['value']} components={ptComponents} />
        </div>
      )}

      <hr className="project-divider" />

      {quotes.length > 0 && (
        <>
          <h2 className="section-title">Selected Quotes</h2>
          <div className="about-quotes">
            {quotes.map(q => <QuoteItem key={q._key} q={q} />)}
          </div>
        </>
      )}

      {/* CV */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '48px', flexWrap: 'wrap', gap: '16px' }}>
        <h2 className="section-title" style={{ margin: 0 }}>Selected Projects &amp; Exhibitions</h2>
        {cv?.cvPdfUrl && (
          <a
            href={cv.cvPdfUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="cv-download-btn"
          >
            ↓ Download CV (PDF)
          </a>
        )}
      </div>
      {cv?.intro && (
        <p style={{ fontSize: 'var(--type-body)', color: 'var(--color-muted)', marginBottom: '24px', lineHeight: 1.7, marginTop: '8px' }}>
          {cv.intro}
        </p>
      )}

      {linkedItems.length > 0 && (() => {
        const typeLabel: Record<string, string> = {
          solo:      'Solo presentations',
          duo:       'Duo exhibitions',
          group:     'Group exhibitions (selection)',
          permanent: 'Permanent installations',
          special:   'Special projects (selection)',
          artFair:   'Art fairs (selection)',
        }
        const typeOrder = ['solo', 'duo', 'permanent', 'group', 'special', 'artFair']
        // For these projects, solo+duo+group+special all merge into "Gallery presentations"
        const galleryMergeProjects = new Set(['The Social Landscape', 'TenFifteen'])
        const galleryMergeTypes    = new Set(['solo', 'duo', 'group', 'special'])

        // Group by project → by type, preserving Sanity sort order
        const projects: Record<string, { order: number; byType: Record<string, CvLinkedItem[]> }> = {}
        const projectKeys: string[] = []
        for (const item of linkedItems) {
          const proj = item.projectTitle ?? 'Other'
          const type = item.exhibitionType ?? 'group'
          if (!projects[proj]) { projects[proj] = { order: item.projectOrder ?? 999, byType: {} }; projectKeys.push(proj) }
          if (!projects[proj].byType[type]) projects[proj].byType[type] = []
          projects[proj].byType[type].push(item)
        }
        projectKeys.sort((a, b) => projects[a].order - projects[b].order)

        const rightCol = new Set(['The Social Media Project'])
        const leftProjects  = projectKeys.filter(p => !rightCol.has(p))
        const rightProjects = projectKeys.filter(p =>  rightCol.has(p))

        function renderItem(item: CvLinkedItem, i: number) {
          const year  = item.startDate ? new Date(item.startDate).getFullYear() : null
          const venue = [item.gallery, item.location].filter(Boolean).join(', ')
          const text  = `${year}${venue ? ` — ${venue}` : ''}`
          const href  = item.hasPage && item.slug
            ? (item.exhibitionType === 'artFair' ? `/art-fairs/${item.slug}` : `/exhibitions/${item.slug}`)
            : null
          return <li key={i}>{href ? <a href={href} style={{ textDecoration: 'underline' }}>{text}</a> : text}</li>
        }

        function renderProject(proj: string) {
          const { byType } = projects[proj]
          const mergeGallery = galleryMergeProjects.has(proj)

          type Section = { label: string; items: CvLinkedItem[] }
          const sections: Section[] = []

          if (mergeGallery) {
            const galleryItems = typeOrder
              .filter(t => galleryMergeTypes.has(t) && byType[t]?.length)
              .flatMap(t => byType[t])
              .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
            if (galleryItems.length) sections.push({ label: 'Gallery presentations', items: galleryItems })
            ;['permanent', 'artFair'].forEach(t => {
              if (byType[t]?.length) sections.push({ label: typeLabel[t], items: byType[t] })
            })
          } else {
            typeOrder.forEach(t => {
              if (byType[t]?.length) sections.push({ label: typeLabel[t], items: byType[t] })
            })
          }

          return (
            <div key={proj} style={{ marginBottom: '2rem' }}>
              <h3 className="cv-project-name">• {proj}</h3>
              {sections.map(sec => (
                <div key={sec.label} style={{ marginBottom: '1rem' }}>
                  <p className="cv-sub-label">{sec.label}</p>
                  <ul className="cv-list">{sec.items.map(renderItem)}</ul>
                </div>
              ))}
            </div>
          )
        }

        return (
          <div className="cv-projects-grid" style={{ marginTop: '1.5rem' }}>
            <div>{leftProjects.map(renderProject)}</div>
            <div>{rightProjects.map(renderProject)}</div>
          </div>
        )
      })()}

      {pubPressColumns.length > 0 && (
        <>
          <hr className="project-divider" style={{ marginTop: '64px' }} />
          <h2 className="section-title">Publications, Press &amp; Media</h2>

          <div className="cv-projects-grid">
            {pubPressColumns.map(col => (
              <div key={col._key}>
                <p className="cv-sub-head">{col.columnTitle}</p>
                {(col.groups ?? []).map(g => (
                  <div key={g._key} style={{ marginBottom: '1.5rem' }}>
                    <p className="cv-sub-label">{g.groupTitle}</p>
                    <ul className="cv-list">
                      {(g.items ?? []).filter(Boolean).map((item, i) => {
                        const text = typeof item === 'string' ? item : item.text
                        const url  = typeof item === 'string' ? undefined : item.url
                        const key  = typeof item === 'string' ? i : (item._key ?? i)
                        return (
                          <li key={key}>
                            {url
                              ? <a href={url} target="_blank" rel="noopener noreferrer">{text}</a>
                              : text}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
