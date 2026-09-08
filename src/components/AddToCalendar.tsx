'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * "Add to calendar" voor een expositie of beurs — Google, Apple, Outlook.
 *
 * Gedeeld tussen de gallery-core en de artist-core (sync-shared.mjs). Kent
 * geen galerie en geen kunstenaar: alles wat het toont komt uit de props.
 *
 * Wat hier anders is dan de eerste versie (die in de artist-core stond en
 * nergens werd gebruikt):
 *
 * - **De einddatum van een meerdaags evenement is exclusief.** iCalendar en
 *   Google rekenen bij een hele dag `DTEND` als "de dag ná de laatste": een
 *   beurs van 17 t/m 20 september heeft DTEND 21 september. Zonder die dag
 *   erbij eindigde het evenement in elke agenda op de 19e.
 * - **Komma's en puntkomma's worden ontsnapt.** "Amsterdam, NL" in LOCATION
 *   maakte het .ics-bestand anders ongeldig.
 * - **De knop blijft zichtbaar tot het evenement voorbij is**, niet tot het
 *   begonnen is. Wie op dag twee van een beurs langskomt wil dag drie in zijn
 *   agenda.
 * - Geen hook ná een vroege `return` — dat was een React-regel die alleen
 *   met een eslint-uitzondering stil te houden was.
 */

export interface AddToCalendarProps {
  title: string
  startDate: string    // 'YYYY-MM-DD'
  endDate?: string     // 'YYYY-MM-DD' — laatste dag; standaard gelijk aan startDate
  startTime?: string   // 'HH:MM' — weglaten voor een hele dag
  endTime?: string     // 'HH:MM'
  location?: string
  description?: string
  url?: string
  /** Tekst op de knop. */
  label?: string
}

// ── Datum ───────────────────────────────────────────────────────────────────

const compact = (d: string) => d.replace(/-/g, '')

/** De dag ná de gegeven datum, als YYYY-MM-DD. */
function dagErna(d: string): string {
  const [j, m, dd] = d.split('-').map(Number)
  const t = new Date(Date.UTC(j, m - 1, dd + 1))
  return t.toISOString().slice(0, 10)
}

function bereik(p: AddToCalendarProps): { start: string; eind: string; heleDag: boolean } {
  const heleDag = !p.startTime
  const laatste = p.endDate ?? p.startDate
  if (heleDag) {
    // Exclusief: de dag ná de laatste dag.
    return { start: compact(p.startDate), eind: compact(dagErna(laatste)), heleDag }
  }
  const tijd = (t?: string) => (t ?? '00:00').replace(':', '') + '00'
  return {
    start: `${compact(p.startDate)}T${tijd(p.startTime)}`,
    eind: `${compact(laatste)}T${tijd(p.endTime ?? p.startTime)}`,
    heleDag,
  }
}

function voorbij(p: AddToCalendarProps): boolean {
  const laatste = p.endDate ?? p.startDate
  return new Date(`${laatste}T23:59:59`) < new Date()
}

// ── Google ──────────────────────────────────────────────────────────────────

function googleUrl(p: AddToCalendarProps): string {
  const { start, eind } = bereik(p)
  const details = [p.description, p.url].filter(Boolean).join('\n\n')
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: p.title,
    dates: `${start}/${eind}`,
    ...(p.location ? { location: p.location } : {}),
    ...(details ? { details } : {}),
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
}

// ── iCalendar (.ics) — Apple, Outlook en alles wat de standaard leest ───────

/** Tekst in een .ics-veld: \ , ; en regeleinden moeten ontsnapt (RFC 5545). */
function ics(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function bouwIcs(p: AddToCalendarProps): string {
  const { start, eind, heleDag } = bereik(p)
  const nu = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const uid = `${start}-${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}@gingerbeard.works`
  const regels = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GingerBeard.Works//Add to calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nu}`,
    `SUMMARY:${ics(p.title)}`,
    heleDag ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    heleDag ? `DTEND;VALUE=DATE:${eind}` : `DTEND:${eind}`,
    ...(p.location ? [`LOCATION:${ics(p.location)}`] : []),
    ...(p.description ? [`DESCRIPTION:${ics(p.description)}`] : []),
    ...(p.url ? [`URL:${p.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return regels.join('\r\n') + '\r\n'
}

function downloadIcs(p: AddToCalendarProps) {
  const blob = new Blob([bouwIcs(p)], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

// ── Iconen ──────────────────────────────────────────────────────────────────

function KalenderIcoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1" y="2.5" width="14" height="12.5" rx="1.5" />
      <line x1="1" y1="6.5" x2="15" y2="6.5" />
      <line x1="5" y1="1" x2="5" y2="4" />
      <line x1="11" y1="1" x2="11" y2="4" />
    </svg>
  )
}

// Merkkleuren van Google en Outlook: hún merk, geen thema-kleur. audit-theme
// staat dit bestand die zeven hexwaarden toe.
function GoogleIcoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.805 10.023H12v4.05h5.65c-.244 1.265-.98 2.336-2.086 3.055v2.54h3.378c1.977-1.82 3.117-4.505 3.117-7.685 0-.488-.04-.965-.117-1.41z" fill="#4285F4" />
      <path d="M12 22c2.835 0 5.213-.94 6.95-2.547l-3.378-2.54c-.939.63-2.14 1.004-3.572 1.004-2.743 0-5.068-1.852-5.9-4.34H2.605v2.622C4.335 19.988 7.965 22 12 22z" fill="#34A853" />
      <path d="M6.1 13.577A5.96 5.96 0 0 1 5.762 12c0-.548.094-1.08.238-1.577V7.8H2.605A9.996 9.996 0 0 0 2 12c0 1.614.387 3.14 1.07 4.491L6.1 13.577z" fill="#FBBC05" />
      <path d="M12 6.083c1.545 0 2.93.53 4.02 1.573l3.013-3.014C17.208 2.932 14.832 2 12 2 7.965 2 4.335 4.012 2.605 7.8L6.1 10.423C6.932 7.935 9.257 6.083 12 6.083z" fill="#EA4335" />
    </svg>
  )
}
function AppleIcoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}
function OutlookIcoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="12" height="12" rx="1" fill="#0078D4" />
      <text x="8" y="15" textAnchor="middle" fontSize="8" fill="white" fontFamily="sans-serif" fontWeight="bold">O</text>
      <path d="M14 9h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6" stroke="#0078D4" strokeWidth="1.2" />
      <polyline points="14,9 17,12 14,15" fill="none" stroke="#0078D4" strokeWidth="1.2" />
    </svg>
  )
}

// ── Component ───────────────────────────────────────────────────────────────

export function AddToCalendar(props: AddToCalendarProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Hooks altijd vóór een eventuele vroege return.
  useEffect(() => {
    if (!open) return
    const dicht = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', dicht)
    return () => document.removeEventListener('mousedown', dicht)
  }, [open])

  if (!props.startDate || voorbij(props)) return null

  const opties = [
    { label: 'Google Calendar', icoon: <GoogleIcoon />, doe: () => window.open(googleUrl(props), '_blank', 'noopener') },
    { label: 'Apple Calendar',  icoon: <AppleIcoon />,  doe: () => downloadIcs(props) },
    { label: 'Outlook',         icoon: <OutlookIcoon />, doe: () => downloadIcs(props) },
  ]

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '7px 14px', fontSize: 13, fontFamily: 'inherit',
          color: 'var(--tone-800)', background: 'transparent',
          border: '1px solid var(--tone-300)', borderRadius: 'var(--radius-sm, 4px)',
          cursor: 'pointer', letterSpacing: '0.02em', whiteSpace: 'nowrap',
        }}
      >
        <KalenderIcoon />
        {props.label ?? 'Add to calendar'}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="2,3.5 5,6.5 8,3.5" />
        </svg>
      </button>

      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 180,
          background: 'var(--tone-paper)', border: '1px solid var(--color-border)',
          borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.10)', overflow: 'hidden', zIndex: 100,
        }}>
          {opties.map(({ label, icoon, doe }) => (
            <button key={label} type="button" role="option" aria-selected={false}
              onClick={() => { doe(); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', fontSize: 13, fontFamily: 'inherit',
                color: 'var(--tone-800)', background: 'transparent', border: 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              {icoon}{label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AddToCalendar
