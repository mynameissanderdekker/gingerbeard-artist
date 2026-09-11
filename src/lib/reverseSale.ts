import type { SanityClient } from '@sanity/client'

/**
 * Een verkoop terugdraaien: annuleren of terugbetalen.
 *
 * Wat er stond: `cancelled` en `refunded` waren alleen een status op de order.
 * Het werk bleef op `sold`, bleef uit de webshop, de voorraad bleef afgeboekt
 * en de aankoop bleef in het CRM staan. Wie zich vergiste in het werk kon dat
 * alleen repareren door met de hand vier dingen terug te zetten — als je wist
 * welke vier.
 *
 * Dit is het spiegelbeeld van `markSold`. Elke stap die daar gezet wordt,
 * wordt hier teruggenomen:
 *
 *   markSold                          reverseSale
 *   ────────────────────────────────  ──────────────────────────────────
 *   voorraad −n                       voorraad +n
 *   status → sold (bij 0 / uniek)     status → available
 *   availableInShop → false           alleen terug bij een webshoporder
 *   reservering gewist                blijft gewist
 *   purchases[] op het contact        de regel van déze order eruit
 *
 * **`availableInShop` gaat alleen terug aan bij een webshopbestelling.** Daar
 * wéten we dat het werk in de winkel lag — anders was het niet te bestellen.
 * Bij een verkoop in de galerie is dat niet bekend: `markSold` bewaart de
 * vorige waarde niet, en een werk dat nooit in de webshop lag zou er dan
 * ineens in verschijnen. Terugzetten wat je niet weet is erger dan het aan de
 * galerie laten.
 */

export interface ReverseResult {
  orderNumber?: string
  /** Per regel wat er is teruggedraaid, in mensentaal. */
  changes: string[]
  /** Wat niet kon, met de reden. Geen fout: de rest gaat gewoon door. */
  skipped: string[]
}

interface OrderItem {
  item?: { _ref?: string }
  title?: string
  quantity?: number
  variant?: string
}

export async function reverseSale(
  client: SanityClient,
  orderId: string
): Promise<ReverseResult> {
  const order = await client.fetch<{
    _id: string
    orderNumber?: string
    channel?: string
    stripeSessionId?: string
    items?: OrderItem[]
    contact?: { _ref?: string }
  } | null>(
    `*[_id == $id][0]{ _id, orderNumber, channel, stripeSessionId, items, contact }`,
    { id: orderId }
  )
  if (!order) throw new Error(`Order ${orderId} bestaat niet.`)

  const uitDeWinkel = order.channel === 'webshop' || !!order.stripeSessionId
  const res: ReverseResult = { orderNumber: order.orderNumber, changes: [], skipped: [] }
  const tx = client.transaction()

  for (const regel of order.items ?? []) {
    const id = regel.item?._ref
    const naam = regel.title || id || 'onbekend werk'
    if (!id) {
      // Oudere orders hebben soms alleen een titel. Dan valt er niets terug te
      // zetten, en dat hoort de galerie te weten in plaats van te denken dat
      // het gelukt is.
      res.skipped.push(`${naam}: geen verwijzing naar een werk op deze regel`)
      continue
    }
    const aantal = regel.quantity ?? 1

    // ── Variant (bv. "Signed"): eigen voorraad, los van het basisproduct ──
    if (regel.variant) {
      const v = await client.fetch<{ _key: string; stock?: number } | null>(
        `*[_id == $id][0].shopVariants[lower(badge) == lower($b)][0]{ _key, stock }`,
        { id, b: regel.variant }
      )
      if (!v) {
        res.skipped.push(`${naam} (${regel.variant}): die uitvoering bestaat niet meer`)
        continue
      }
      const terug = (v.stock ?? 0) + aantal
      tx.patch(client.patch(id).set({
        [`shopVariants[_key=="${v._key}"].stock`]: terug,
        [`shopVariants[_key=="${v._key}"].status`]: 'available',
      }))
      res.changes.push(`${naam} (${regel.variant}): voorraad ${v.stock ?? 0} → ${terug}`)
      continue
    }

    const art = await client.fetch<{
      _type?: string
      editionType?: string
      editionTotal?: number
      stock?: number
      status?: string
    } | null>(`*[_id == $id][0]{ _type, editionType, editionTotal, stock, status }`, { id })
    if (!art) {
      res.skipped.push(`${naam}: het werk is verwijderd`)
      continue
    }

    const patch: Record<string, unknown> = {}
    const isEdition =
      art._type === 'publication' ||
      (art.editionType === 'edition' && (art.editionTotal ?? 0) > 1)

    if (isEdition) {
      const terug = (art.stock ?? 0) + aantal
      patch.stock = terug
      if (art.status === 'sold') patch.status = 'available'
      res.changes.push(`${naam}: voorraad ${art.stock ?? 0} → ${terug}`)
    } else if (art.status === 'sold') {
      patch.status = 'available'
      res.changes.push(`${naam}: verkocht → beschikbaar`)
    } else {
      // Iemand heeft het werk intussen zelf aangepast — bijvoorbeeld op
      // "niet te koop" gezet. Dan is de status van de galerie leidend.
      res.skipped.push(`${naam}: staat op "${art.status ?? 'onbekend'}", niet op verkocht — met rust gelaten`)
    }

    if (uitDeWinkel && (patch.status === 'available')) {
      patch.availableInShop = true
      res.changes.push(`${naam}: terug in de webshop`)
    }

    if (Object.keys(patch).length) tx.patch(client.patch(id).set(patch))
  }

  // ── De aankoop uit het CRM ──────────────────────────────────────────────
  // `purchases[]` op het contact is verzamelgeschiedenis. Blijft de regel
  // staan, dan heeft de klant volgens zijn eigen Collectie-tab iets in bezit
  // dat hij nooit heeft gekregen.
  if (order.contact?._ref && order.orderNumber) {
    const contact = await client.fetch<{ purchases?: { _key: string; orderNumber?: string; artwork?: { _ref?: string } }[] } | null>(
      `*[_id == $id][0]{ purchases }`, { id: order.contact._ref }
    )
    const aankopen = contact?.purchases ?? []
    // Op ordernummer — en voor regels van vóór 11 sept 2026, die geen
    // ordernummer hebben, op het werk zelf. Dezelfde klant koopt hetzelfde
    // werk niet twee keer zonder dat een van de twee een nummer heeft.
    const werkIds = new Set((order.items ?? []).map((it) => it.item?._ref).filter(Boolean))
    let treffers = aankopen.filter((p) => p.orderNumber === order.orderNumber)
    if (!treffers.length) treffers = aankopen.filter((p) => !p.orderNumber && p.artwork?._ref && werkIds.has(p.artwork._ref))
    if (treffers.length) {
      tx.patch(client.patch(order.contact._ref).unset(
        treffers.map((p) => `purchases[_key=="${p._key}"]`)
      ))
      res.changes.push(`${treffers.length} aankoop(en) uit het CRM van de klant gehaald`)
    }
  }

  // Alles in één transactie: een half teruggedraaide verkoop is verwarrender
  // dan een die helemaal niet is teruggedraaid.
  if (res.changes.length) await tx.commit()
  return res
}
