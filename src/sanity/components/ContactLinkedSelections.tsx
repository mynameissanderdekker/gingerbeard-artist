'use client'

import { useEffect, useState } from 'react'
import { useFormValue } from 'sanity'
import { useListClient } from './useListClient'
import { useRoomLink } from './useRoomLink'

interface Selection {
  _id: string
  _type: 'privateSale'
  title?: string
  slug?: { current: string }
  token?: string
  occasion?: string
  isActive?: boolean
  _createdAt: string
}

export function ContactLinkedSelections() {
  const client = useListClient()
  const id = useFormValue(['_id']) as string | undefined
  const docId = id?.replace(/^drafts\./, '')

  const [items, setItems] = useState<Selection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!docId) {
      setItems([])
      setLoading(false)
      return
    }
    let mounted = true

    const query = `*[_type == "privateSale" && contact._ref == $id] | order(_createdAt desc) {
      _id, _type, title, slug, token, occasion, isActive, _createdAt
    }`

    const fetch = () => {
      client.fetch<Selection[]>(query, { id: docId }).then((result) => {
        if (mounted) {
          setItems(result)
          setLoading(false)
        }
      })
    }

    fetch()

    const sub = client
      .listen(query, { id: docId }, { visibility: 'query' })
      .subscribe(fetch)

    return () => {
      mounted = false
      sub.unsubscribe()
    }
  }, [client, docId])

  if (loading) {
    return (
      <div style={{ fontSize: 13, color: 'var(--card-muted-fg-color, #888)', padding: '8px 0' }}>
        Loading…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ fontSize: 13, color: 'var(--card-muted-fg-color, #888)', padding: '8px 0' }}>
        Geen gekoppelde private sales.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item) => {
        const active = item.isActive
        // Prijslijst woont op /room/<slug>?k=… (lib/roomKey). Het schema
        // heeft geen `token`-veld; de route /private-sales/[token] vindt
        // daarom nooit iets — hier stond die link, en die was altijd dood.
        const slug = item.slug?.current
        const date = new Date(item._createdAt).toLocaleDateString('nl-NL', {
          day: '2-digit', month: 'short', year: 'numeric',
        })

        return (
          <div
            key={item._id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              padding: '8px 10px',
              border: '1px solid var(--card-border-color, #e0e0e0)',
              borderRadius: 4,
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 500 }}>{item.title || '—'}</span>
              {item.occasion && (
                <span style={{ color: 'var(--card-muted-fg-color, #888)', fontSize: 12 }}>
                  {item.occasion}
                </span>
              )}
              {slug && <RoomPath slug={slug} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: active ? '#d1fae5' : '#f3f4f6',
                  color: active ? '#065f46' : '#6b7280',
                }}
              >
                Price list · {active ? 'actief' : 'inactief'}
              </span>
              <span style={{ color: 'var(--card-muted-fg-color, #888)', fontSize: 11 }}>{date}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RoomPath({ slug }: { slug: string }) {
  const { path, fout } = useRoomLink('privatesale', slug)
  return (
    <span style={{ color: fout ? '#b91c1c' : 'var(--card-muted-fg-color, #888)', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all' }}>
      {fout ?? path ?? '…'}
    </span>
  )
}
