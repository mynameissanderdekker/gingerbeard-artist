import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Deellink van een prijslijst per expositie of beurs: onraadbaar maken.
 *
 * `/room/exhibition/<slug>` stond tot 11 september 2026 open voor iedereen die
 * de slug van de expositie kende — en die staat gewoon in de URL van de
 * publieke expositiepagina. Elke expositie en elke beurs had daarmee een
 * publieke prijslijst met álle prijzen. Regel 1 (nooit prijzen buiten de
 * webshop) op de grootste schaal die er is.
 *
 * Nu: de link krijgt `?k=<sleutel>`, afgeleid van een servergeheim en de
 * slug. Geen schemawijziging, geen migratie; bestaande links zonder sleutel
 * werken niet meer, en dat is de bedoeling. De Studio (`ShareRoomLink`) en
 * de app halen de volledige link op via een beveiligde route.
 *
 * Fail closed: zonder `ADMIN_PASSWORD` is er geen sleutel en dus geen
 * toegang — dezelfde regel als bij de admin-cookie.
 */
export type RoomType = 'exhibition' | 'artfair' | 'privatesale'

export function roomKey(type: RoomType, slug: string): string | null {
  const geheim = process.env.ADMIN_PASSWORD
  if (!geheim) return null
  return createHmac('sha256', geheim).update(`room-v1:${type}:${slug}`).digest('hex').slice(0, 24)
}

export function roomKeyGeldig(type: RoomType, slug: string, k: string | null | undefined): boolean {
  const verwacht = roomKey(type, slug)
  if (!verwacht || !k || k.length !== verwacht.length) return false
  return timingSafeEqual(Buffer.from(verwacht), Buffer.from(k))
}

/** Pad (zonder domein) van de deellink, of null zonder geheim.
 *  privatesale (Studio → Price Lists) woont op /room/<slug>, de andere twee
 *  op /room/<type>/<slug>. */
export function roomPad(type: RoomType, slug: string): string | null {
  const k = roomKey(type, slug)
  if (!k) return null
  const basis = type === 'privatesale' ? `/room/${encodeURIComponent(slug)}` : `/room/${type}/${encodeURIComponent(slug)}`
  return `${basis}?k=${k}`
}
