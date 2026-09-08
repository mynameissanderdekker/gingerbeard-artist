'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useListClient } from './useListClient'

interface Publication {
  _id: string
  number?: string
  title: string
  year?: number
  imageUrl?: string
  publicationCategory?: string
  status?: string
  availableInShop?: boolean
  vatRate?: string
}

type Action = 'publicationCategory' | 'status' | 'availableInShop' | 'vatRate'

const ACTION_LABELS: Record<Action, string> = {
  publicationCategory: 'Category',
  status:              'Status',
  availableInShop:     'Webshop',
  vatRate:             'VAT rate',
}

const ACTION_ICONS: Record<Action, string> = {
  publicationCategory: '📚',
  status:              '🔵',
  availableInShop:     '🛒',
  vatRate:             '🧾',
}

const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({
  background: bg, color: fg, border: 'none', borderRadius: 6,
  padding: '8px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'opacity .15s',
})

const sel: React.CSSProperties = {
  border: '1px solid #d1d5db', borderRadius: 6,
  padding: '7px 12px', fontSize: 14,
}

export function BulkPublicationsTool() {
  const client = useListClient()

  const [publications, setPublications] = useState<Publication[]>([])
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [action, setAction]             = useState<Action>('publicationCategory')
  const [actionValue, setActionValue]   = useState('')
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [toast, setToast]               = useState('')
  const [viewMode, setViewMode]         = useState<'list' | 'medium' | 'large'>('large')

  const load = useCallback(async () => {
    setLoading(true)
    const pubs = await client.fetch<Publication[]>(`
      *[_type == "publication"] | order(order asc, year asc, title asc) {
        _id, number, title, year, publicationCategory, status, availableInShop, vatRate,
        "imageUrl": images[0].asset->url,
      }
    `)
    setPublications(pubs)
    setLoading(false)
  }, [client])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    if (!search) return publications
    const q = search.toLowerCase()
    return publications.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.number?.toLowerCase().includes(q)
    )
  }, [publications, search])

  function toggleAll() {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p._id)))
  }

  function toggle(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  async function handleApply() {
    if (selected.size === 0 || !actionValue) return
    setSaving(true)
    const ids = [...selected]
    try {
      const tx = client.transaction()
      if (action === 'availableInShop') {
        const val = actionValue === 'true'
        for (const id of ids) tx.patch(id, { set: { availableInShop: val } })
        await tx.commit()
        showToast(`✓ Webshop set to "${val ? 'visible' : 'hidden'}" on ${ids.length} publication(s)`)
      } else {
        for (const id of ids) tx.patch(id, { set: { [action]: actionValue } })
        await tx.commit()
        const label = ACTION_LABELS[action]
        showToast(`✓ ${label} set to "${actionValue}" on ${ids.length} publication(s)`)
      }
      setSelected(new Set())
      load()
    } finally {
      setSaving(false)
    }
  }

  const canApply = selected.size > 0 && !saving && (
    action === 'availableInShop'
      ? (actionValue === 'true' || actionValue === 'false')
      : !!actionValue
  )

  function currentHint(p: Publication): string {
    if (action === 'publicationCategory') return p.publicationCategory ?? '—'
    if (action === 'status') return p.status ?? '—'
    if (action === 'availableInShop') return p.availableInShop ? '✓ shop' : '✗'
    if (action === 'vatRate') return p.vatRate ? `${p.vatRate}%` : '—'
    return ''
  }

  return (
    <div style={{ padding: '24px 32px', fontFamily: 'system-ui, sans-serif', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Bulk edit publications</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
        Choose an action, select publications, then apply in one click.
      </p>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search by title or number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...sel, width: '100%', maxWidth: 400 }}
        />
      </div>

      {/* Step 1: Action tabs */}
      <div style={{ marginBottom: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Step 1 — Choose action
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {(Object.keys(ACTION_LABELS) as Action[]).map(a => {
            const isActive = action === a
            return (
              <button key={a}
                onClick={() => { setAction(a); setActionValue('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: isActive ? 700 : 500,
                  border: isActive ? '2px solid #111' : '2px solid #e5e7eb',
                  background: isActive ? '#111' : '#fff',
                  color: isActive ? '#fff' : '#374151',
                  transition: 'all .15s',
                }}>
                <span>{ACTION_ICONS[a]}</span>
                {ACTION_LABELS[a]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2: Value + Apply */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, padding: '14px 16px', background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap' }}>
          Step 2 —
        </p>

        {action === 'publicationCategory' && (
          <select value={actionValue} onChange={e => setActionValue(e.target.value)} style={{ ...sel, minWidth: 160 }}>
            <option value="">Choose category…</option>
            <option value="Book">Book</option>
            <option value="Zine">Zine</option>
            <option value="Poster">Poster</option>
            <option value="Bag">Bag</option>
          </select>
        )}

        {action === 'status' && (
          <select value={actionValue} onChange={e => setActionValue(e.target.value)} style={{ ...sel, minWidth: 180 }}>
            <option value="">Choose status…</option>
            <option value="available">Available</option>
            <option value="sold_out">Sold out</option>
            <option value="coming_soon">Coming soon</option>
          </select>
        )}

        {action === 'availableInShop' && (
          <select value={actionValue} onChange={e => setActionValue(e.target.value)} style={{ ...sel, minWidth: 200 }}>
            <option value="">Choose…</option>
            <option value="true">✓ Visible in webshop</option>
            <option value="false">✗ Hidden from webshop</option>
          </select>
        )}

        {action === 'vatRate' && (
          <select value={actionValue} onChange={e => setActionValue(e.target.value)} style={{ ...sel, minWidth: 140 }}>
            <option value="">Choose VAT rate…</option>
            <option value="9">9%</option>
            <option value="21">21%</option>
            <option value="0">0% (export)</option>
          </select>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleApply} disabled={!canApply}
            style={{ ...btn('#111'), opacity: canApply ? 1 : 0.4, whiteSpace: 'nowrap', padding: '9px 20px', fontSize: 14 }}>
            {saving ? 'Saving…' : `Apply to ${selected.size > 0 ? `${selected.size} publication(s)` : '…'}`}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 6, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 500 }}>
          {toast}
        </div>
      )}

      {/* Select all + view toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
        <input type="checkbox"
          checked={filtered.length > 0 && selected.size === filtered.length}
          onChange={toggleAll}
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {selected.size > 0 ? `${selected.size} selected` : `Select all (${filtered.length})`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid #e5e7eb', borderRadius: 5, overflow: 'hidden' }}>
          {(['list', 'medium', 'large'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)}
              title={mode === 'list' ? 'List' : mode === 'medium' ? 'Medium' : 'Large'}
              style={{ padding: '3px 8px', fontSize: 12, border: 'none', cursor: 'pointer', background: viewMode === mode ? '#111' : '#fff', color: viewMode === mode ? '#fff' : '#6b7280' }}>
              {mode === 'list' ? '☰' : mode === 'medium' ? '⊞' : '⬛'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', padding: '40px 0', textAlign: 'center' }}>Loading…</p>
      ) : viewMode === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map(pub => {
            const isSelected = selected.has(pub._id)
            return (
              <div key={pub._id} onClick={() => toggle(pub._id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: isSelected ? '#f9fafb' : '#fff' }}>
                <input type="checkbox" checked={isSelected} onChange={() => toggle(pub._id)}
                  onClick={e => e.stopPropagation()} style={{ width: 15, height: 15, flexShrink: 0 }} />
                <div style={{ width: 40, height: 40, flexShrink: 0, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                  {pub.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`${pub.imageUrl}?w=80&h=80&fit=max&auto=format`} alt={pub.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#d1d5db', fontSize: 16 }}>📖</span>
                  }
                </div>
                <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>{pub.number ?? ''}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pub.title ?? '—'}</span>
                <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>{pub.year ?? ''}</span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11, color: '#9ca3af' }}>{currentHint(pub)}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${viewMode === 'large' ? 200 : 130}px, 1fr))`, gap: viewMode === 'large' ? 16 : 10 }}>
          {filtered.map(pub => {
            const isSelected = selected.has(pub._id)
            return (
              <div key={pub._id} onClick={() => toggle(pub._id)}
                style={{ border: `2px solid ${isSelected ? '#111' : '#e5e7eb'}`, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', background: isSelected ? '#f9fafb' : '#fff', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, borderRadius: 3, padding: '2px 5px', zIndex: 2 }}>
                  {currentHint(pub)}
                </div>
                <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(pub._id)}
                    onClick={e => e.stopPropagation()} style={{ width: 16, height: 16 }} />
                </div>
                <div style={{ aspectRatio: '1', background: '#f3f4f6', overflow: 'hidden' }}>
                  {pub.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`${pub.imageUrl}?w=300&h=300&fit=max&auto=format`} alt={pub.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#d1d5db', fontSize: 28 }}>📖</span></div>
                  }
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  {pub.number && <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 1px' }}>{pub.number}</p>}
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pub.title ?? '—'}</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>{pub.year ?? ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
