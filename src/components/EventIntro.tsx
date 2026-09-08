'use client'

import { AddToCalendar } from '@/components/AddToCalendar'

/**
 * Het kopblok van een expositie- of beurspagina, onder de titel — dezelfde
 * indeling als in de gallery-core, in de stijl van deze site:
 *
 *   Ondertitel (vet)                              ← één regel, optioneel
 *   Practical information | Opening               ← blok, in één keer aan/uit
 *   Saturday 12 September | 15:00 – 18:00
 *   Extra regel
 *   [ Add opening to calendar ]                   ← apart uit te zetten
 *   ABOUT THE EXHIBITION                          ← klein kopje boven de tekst
 *
 * De knop zet de opening in de agenda, niet de looptijd. Met een sluitdatum
 * wordt het één meerdaags item over hele dagen, zonder tijden (een beurs), en
 * heet het niet meer "Opening: …". Zonder openingsdatum geen knop.
 *
 * Niet gedeeld via sync-shared.mjs: de gallery-versie gebruikt Tailwind-
 * klassen, deze de inline stijl en `.section-title` van deze site. De
 * gegevens (`Opening`) zijn wél gelijk.
 */

export interface Opening {
  show?: boolean
  heading?: string
  date?: string
  endDate?: string
  startTime?: string
  endTime?: string
  note?: string
  /** Studio-veld "Generate 'Add to calendar' button". Ontbreekt = aan. */
  calendarButton?: boolean
}

function langeDatum(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

function datumRegel(van: string, tot?: string) {
  if (!tot || tot === van) return langeDatum(van)
  return `${langeDatum(van)} – ${langeDatum(tot)}`
}

const regel = { margin: 0, fontSize: 'var(--type-body)', lineHeight: 1.6, color: 'var(--tone-700)' } as const

export function EventIntro({
  subtitle, opening, title, location, url, aboutLabel,
}: {
  subtitle?: string
  opening?: Opening | null
  title: string
  /** Waar het is — adres, of locatie + stand van een beurs. */
  location?: string
  url?: string
  /** "About the exhibition" / "About the fair". Weggelaten = geen kopje. */
  aboutLabel?: string
}) {
  const toon = opening?.show === true
  // Een sluitdatum vóór de openingsdatum is een typefout; dan negeren we hem.
  const sluit = opening?.endDate && opening.date && opening.endDate > opening.date ? opening.endDate : undefined
  // Meerdaags = hele dagen: tijden tellen dan niet mee, ook als ze nog in het
  // document staan van vóór de sluitdatum.
  const van = sluit ? undefined : opening?.startTime
  const tot = sluit ? undefined : opening?.endTime
  const tijd = toon && van ? `${van}${tot ? ` – ${tot}` : ''}` : null
  const knop = toon && !!opening?.date && opening?.calendarButton !== false

  return (
    <>
      {subtitle && (
        <p style={{ ...regel, fontWeight: 600, color: 'var(--color-text)', marginBottom: '1.5rem' }}>{subtitle}</p>
      )}

      {toon && (
        <div style={{ marginBottom: '2rem' }}>
          {opening?.heading && <p style={regel}>{opening.heading}</p>}
          {opening?.date && (
            <p style={regel}>{datumRegel(opening.date, sluit)}{tijd ? ` | ${tijd}` : ''}</p>
          )}
          {opening?.note && <p style={{ ...regel, color: 'var(--color-subtle)', whiteSpace: 'pre-line', marginTop: 4 }}>{opening.note}</p>}
          {knop && (
            <div style={{ marginTop: 16 }}>
              <AddToCalendar
                title={sluit ? title : `Opening: ${title}`}
                startDate={opening!.date!}
                endDate={sluit}
                startTime={van}
                endTime={tot}
                location={location}
                description={[subtitle, opening!.note].filter(Boolean).join('\n')}
                url={url}
                label={sluit ? 'Add to calendar' : 'Add opening to calendar'}
              />
            </div>
          )}
        </div>
      )}

      {aboutLabel && (
        <p className="section-title" style={{ marginTop: 0, marginBottom: 16 }}>{aboutLabel}</p>
      )}
    </>
  )
}
