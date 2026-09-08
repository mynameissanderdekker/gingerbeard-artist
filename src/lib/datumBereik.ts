/**
 * Een looptijd op één regel, zonder herhaling:
 *
 *   17 – 20 September 2026        (zelfde maand)
 *   28 September – 3 October 2026 (zelfde jaar)
 *   12 December 2026 – 9 January 2027
 *   17 September 2026             (één datum, of geen einddatum)
 *
 * Voor de regel boven de titel van een expositie of beurs. Eerder stonden
 * begin en eind onder elkaar met een label ("Start" / "End") omdat de volle
 * vorm in een smalle kolom afbrak; op één regel over de volle breedte past
 * de korte vorm altijd.
 */
export function datumBereik(van?: string | null, tot?: string | null, locale = 'en-GB'): string | null {
  if (!van) return null
  const a = new Date(`${van}T12:00:00`)
  const b = tot ? new Date(`${tot}T12:00:00`) : null
  const vol = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  if (!b || tot === van) return vol(a)
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()} – ${vol(b)}`
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.toLocaleDateString(locale, { day: 'numeric', month: 'long' })} – ${vol(b)}`
  }
  return `${vol(a)} – ${vol(b)}`
}
