/**
 * De hele verkoopcyclus van de artist-template, via de échte code.
 *
 *   werk → expositie → hangwerk → prijslijst → klant → optie → verkoop →
 *   factuur → betaald → verzonden → archief
 *
 * De laatste twee stappen zijn de reden dat dit script bestaat: een order
 * hoort uit de werklijst te verdwijnen zodra hij betaald én overgedragen is.
 * Dat hangt aan twee losse velden (`status` en `fulfilment`) en aan filters
 * die op vier plekken worden ingelezen — precies het soort samenspel dat je
 * niet ziet door de code te lezen.
 *
 * Let op: de koppeling werk↔expositie loopt hier vanaf het wérk
 * (`artwork.exhibitions[]`), omgekeerd aan de gallery-template.
 *
 *   npx tsx --env-file=.env.local scripts/testrun-flow.mts
 *   npx tsx --env-file=.env.local scripts/testrun-flow.mts --cleanup
 */

import { createClient } from '@sanity/client'

const CLEANUP = process.argv.includes('--cleanup')

const admin = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: '2026-01-01',
  token: process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
}).withConfig({ perspective: 'raw' })

const TOKEN = process.env.SANITY_WRITE_TOKEN ?? process.env.SANITY_API_WRITE_TOKEN
const authHeaders = { get: (h: string) => (h === 'x-sanity-token' ? TOKEN : null) }
const noCookies = { get: () => undefined }

const ID = {
  artwork: 'TEST-flow-artwork',
  exhibition: 'TEST-flow-exhibition',
  contact: 'TEST-flow-contact',
}

if (CLEANUP) {
  const ids = Object.values(ID)
  const found = await admin.fetch<{ _id: string; _type: string }[]>(
    `*[_id in $ids || _id in $drafts || (_type == "order" && contact._ref == $c)]{_id,_type}`,
    { ids, drafts: ids.map((i) => `drafts.${i}`), c: ID.contact }
  )
  const tx = admin.transaction()
  for (const d of found) tx.delete(d._id)
  if (found.length) await tx.commit()
  console.log(`${found.length} testdocument(en) verwijderd.`)
  process.exit(0)
}

let fails = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`)
  if (!ok) fails++
}
const iso = (n: number) => {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

const PRIJS_INCL = 3270      // 3000 excl. + 9%
const PRIJS_EXCL = 3000

// ── 1. Werk, expositie, hangwerk ─────────────────────────────────────────────
console.log('── 1. Werk, expositie en hangwerk ──')

await admin.createOrReplace({
  _id: ID.exhibition, _type: 'exhibition',
  title: 'Expositie X',
  slug: { _type: 'slug', current: 'test-expositie-x' },
  startDate: iso(-7), endDate: iso(21),
  gallery: 'Testruimte',
  location: 'Amsterdam',
} as never)

await admin.createOrReplace({
  _id: ID.artwork, _type: 'artwork',
  title: 'Kunstwerk X',
  slug: { _type: 'slug', current: 'test-kunstwerk-x' },
  year: 2026, medium: 'Archival pigment print',
  // Genest, niet plat: de prijslijst leest `dimensions.widthCm`.
  dimensions: { widthCm: 90, heightCm: 60 },
  editionType: 'unique',
  priceIncVat: PRIJS_INCL, priceExclVAT: PRIJS_EXCL, vatRate: 9,
  status: 'available',
  availableInShop: false,
  // Hier hangt het werk onder de expositie — vanaf het werk, niet andersom.
  exhibitions: [{ _type: 'reference', _key: 'exkey1', _ref: ID.exhibition }],
} as never)

console.log('  ✓ Kunstwerk X hangt onder Expositie X')

const hangt = await admin.fetch<number>(
  `count(*[_type == "artwork" && $ex in exhibitions[]._ref])`, { ex: ID.exhibition }
)
check('expositie vindt het werk', hangt === 1, `${hangt} werk(en)`)

// ── 2. Prijslijst ────────────────────────────────────────────────────────────
console.log('\n── 2. Prijslijst van de expositie ──')
const roomRoute = await import('../src/app/api/room/exhibition/[slug]/route')
// De deellink eist sinds 11 sept 2026 een sleutel (src/lib/roomKey); zonder 404.
const { roomPad } = await import('../src/lib/roomKey')
const roomRes = await roomRoute.GET(
  { nextUrl: new URL(`http://x/api${roomPad('exhibition', 'test-expositie-x')}`) } as never,
  { params: Promise.resolve({ slug: 'test-expositie-x' }) } as never
)
const room = await roomRes.json()
check('prijslijst gevonden', roomRes.status === 200 && !room.error, `${roomRes.status}`)
const regel = room.artworks?.[0]?.artwork
check('werk staat op de prijslijst', !!regel, regel ? regel.title : JSON.stringify(room).slice(0, 120))
if (regel) {
  check('prijs incl. BTW klopt', regel.priceIncVat === PRIJS_INCL, `€${regel.priceIncVat}`)
  check('prijs excl. BTW klopt', Math.round(regel.priceExclVAT) === PRIJS_EXCL, `€${regel.priceExclVAT}`)
  check('afmetingen komen mee', regel.widthCm === 90 && regel.heightCm === 60,
    `${regel.widthCm} × ${regel.heightCm} cm`)
}
console.log('    /room/exhibition/test-expositie-x')

// ── 3. Klant ─────────────────────────────────────────────────────────────────
console.log('\n── 3. Klant ──')
await admin.createOrReplace({
  _id: ID.contact, _type: 'contact',
  firstName: 'Xander', lastName: 'Xu',
  email: 'xander.xu@example.invalid',
  phone: '+31 6 11111111',
  street: 'Teststraat 1', postalCode: '1011 AB', city: 'Amsterdam', country: 'NL',
  clientLocation: 'nl',
} as never)
console.log('  ✓ Klant X aangemaakt')

// ── 4. Optie ─────────────────────────────────────────────────────────────────
console.log('\n── 4. Klant neemt een optie ──')
await admin.patch(ID.artwork).set({
  status: 'reserved',
  reservedFor: { _type: 'reference', _ref: ID.contact },
  reservedUntil: iso(14),
  reservedNote: 'Optie na bezoek aan Expositie X.',
}).commit()
const optie = await admin.fetch<Record<string, unknown>>(
  `*[_id == $id][0]{status, "voor": reservedFor._ref, reservedUntil}`, { id: ID.artwork })
check('werk staat in optie', optie.status === 'reserved', String(optie.status))
check('optie staat op naam van de klant', optie.voor === ID.contact, String(optie.voor))

// Een werk in optie hoort in de Studio onder Reservations te staan.
const inReserveringen = await admin.fetch<number>(
  `count(*[_type == "artwork" && status == "reserved" && _id == $id])`, { id: ID.artwork })
check('staat in de reserveringenlijst', inReserveringen === 1, `${inReserveringen}`)

// ── 5. Verkoop ───────────────────────────────────────────────────────────────
console.log('\n── 5. Klant koopt Kunstwerk X ──')
const numberRoute = await import('../src/app/api/admin/generate-number/route')
const nrRes = await numberRoute.GET({
  nextUrl: new URL('http://x/api/admin/generate-number?type=invoice'),
  cookies: noCookies, headers: authHeaders,
} as never)
const { number: factuurnummer } = await nrRes.json()
check('factuurnummer gegenereerd', !!factuurnummer, String(factuurnummer))

const saleRoute = await import('../src/app/api/manual-sale/route')
const saleRes = await saleRoute.POST({
  headers: authHeaders, cookies: noCookies,
  json: async () => ({
    contactId: ID.contact,
    firstName: 'Xander', lastName: 'Xu', email: 'xander.xu@example.invalid',
    items: [{
      artworkId: ID.artwork, artworkTitle: 'Kunstwerk X', artworkYear: 2026,
      copyNumber: '', priceExclVAT: PRIJS_EXCL, vatRate: 9,
    }],
    soldVia: 'direct', saleDate: iso(0),
    invoiceNumber: factuurnummer,
    paid: false,             // eerst onbetaald: zo is de weg naar 'betaald' te zien
    sendConfirmation: false,
    notes: 'Testverkoop — mag weg.',
  }),
} as never)
const saleBody = await saleRes.json()
check('verkoop vastgelegd', !saleBody.error, JSON.stringify(saleBody).slice(0, 140))

// ── 6. Wat de verkoop achterliet ─────────────────────────────────────────────
console.log('\n── 6. Werk, klant en factuur ──')
const aw = await admin.fetch<Record<string, unknown>>(
  `*[_id == $id][0]{status, availableInShop, "voor": reservedFor._ref, reservedUntil, reservedNote}`,
  { id: ID.artwork })
check('werk staat op verkocht', aw.status === 'sold', String(aw.status))
check('optie is opgeruimd', !aw.voor && !aw.reservedUntil && !aw.reservedNote,
  aw.voor ? 'reservedFor staat er nog' : 'leeg')

const nAankopen = await admin.fetch<number>(`count(*[_id == $c][0].purchases)`, { c: ID.contact })
check('aankoop in het CRM', nAankopen === 1, `${nAankopen}`)

const order = await admin.fetch<Record<string, unknown>>(
  `*[_type == "order" && contact._ref == $c][0]{
    _id, orderNumber, status, fulfilment, shippedAt, channel, totalAmount,
    "contact": contact._ref, items[]{title, price, vatRate}
  }`, { c: ID.contact })
check('precies één order', !!order, order ? String(order.orderNumber) : 'geen')
check('order gekoppeld aan de klant', order?.contact === ID.contact, String(order?.contact ?? 'leeg'))
check('order wacht op betaling', order?.status === 'awaiting-payment', String(order?.status))
// Exact, niet afgerond bij het controleren: een boekhoudbedrag hoort al op
// centen te staan als het wordt weggeschreven.
check('bedrag incl. BTW, zonder komma-ruis', order?.totalAmount === PRIJS_INCL, `€${order?.totalAmount}`)
console.log(`    factuur: /admin/invoices/${order?.orderNumber}`)

// ── 7. Open of archief? ──────────────────────────────────────────────────────
// Dit is de kern: het paneel zet twee velden, en twee filters bepalen in welke
// lijst de order belandt. Ze worden hier letterlijk uit de app geïmporteerd,
// zodat de test niet een eigen versie van de regel gaat controleren.
const { OPEN_ORDER_FILTER, DONE_ORDER_FILTER } = await import('../src/lib/orderStatus')
const orderId = String(order?._id)

async function waar(): Promise<{ open: boolean; archief: boolean }> {
  const [open, archief] = await Promise.all([
    admin.fetch<number>(`count(*[_id == $id && ${OPEN_ORDER_FILTER}])`, { id: orderId }),
    admin.fetch<number>(`count(*[_id == $id && ${DONE_ORDER_FILTER}])`, { id: orderId }),
  ])
  return { open: open === 1, archief: archief === 1 }
}

console.log('\n── 7. Van open naar archief ──')
let plek = await waar()
check('onbetaald → staat bij de openstaande orders', plek.open && !plek.archief,
  `open=${plek.open} archief=${plek.archief}`)

// Stap 1 van het afhandelpaneel: betaald.
await admin.patch(orderId).set({ status: 'paid' }).commit()
plek = await waar()
check('betaald, nog niet weg → blijft openstaan', plek.open && !plek.archief,
  `open=${plek.open} archief=${plek.archief}`)

// Stap 2: overgedragen. De gekozen manier ís de overdracht; de datum is detail.
await admin.patch(orderId).set({ fulfilment: 'shipped', shippedAt: iso(0) }).commit()
plek = await waar()
check('betaald én verzonden → naar het archief', !plek.open && plek.archief,
  `open=${plek.open} archief=${plek.archief}`)

// En terug: zet de overdracht op 'undecided', dan hoort hij weer op de lijst.
await admin.patch(orderId).set({ fulfilment: 'undecided' }).commit()
plek = await waar()
check('overdracht teruggedraaid → weer openstaand', plek.open && !plek.archief,
  `open=${plek.open} archief=${plek.archief}`)
await admin.patch(orderId).set({ fulfilment: 'shipped' }).commit()

console.log(`\n${fails === 0 ? 'Alles klopt.' : `${fails} punt(en) kloppen niet.`}`)
console.log('Opruimen: npx tsx --env-file=.env.local scripts/testrun-flow.mts --cleanup')
process.exit(fails === 0 ? 0 : 1)
