/**
 * Tegenspraken in de data zoeken — over de hele collectie, niet één werk.
 *
 * De prijsaudit vond 60 werken waar incl. en excl. elkaar tegenspraken. Dat
 * was één veld. Dit script doet hetzelfde voor alles wat een werk, een order
 * of een contact intern consistent moet houden: een verkocht werk hoort niet
 * te koop te staan, een editie kan niet meer voorraad hebben dan oplage, een
 * betaalde order hoort bij een werk dat ook echt op verkocht staat, en een
 * verwijzing hoort naar een document te wijzen dat bestaat.
 *
 * Elke bevinding toont maximaal vijf voorbeelden, met _id, zodat je hem in de
 * Studio kunt openen.
 *
 *   npx tsx --env-file=.env.local scripts/audit-data.mts
 *
 * Leest alleen. Schrijft niets.
 */

import { createClient } from '@sanity/client'

import { existsSync } from 'node:fs'

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  // De dataset uit de omgeving, niet hard 'production': anders meet je altijd
  // dezelfde installatie, ook als je een andere aan het nakijken bent.
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  apiVersion: '2026-06-18',
  token: process.env.SANITY_WRITE_TOKEN || process.env.SANITY_API_WRITE_TOKEN,
  useCdn: false,
})
const today = new Date().toISOString().slice(0, 10)

// De artist-template heeft één kunstenaar (geen artist-veld) en toont
// uitverkochte zines bewust in de shop met een SOLD OUT-badge.
const ARTIST_TEMPLATE = existsSync(new URL('../src/sanity/structure.ts', import.meta.url))

interface Bevinding { label: string; ernst: 'fout' | 'let op'; q: string; toon?: string }

// `q` is een GROQ-filter; `toon` de projectie voor de voorbeelden.
const controles: Bevinding[] = [
  // ── Geld ──────────────────────────────────────────────────────────────────
  { ernst: ARTIST_TEMPLATE ? 'let op' : 'fout', label: ARTIST_TEMPLATE ? 'uitverkocht werk in de shop (bewust, met SOLD OUT-badge)' : 'verkocht werk staat nog te koop in de webshop',
    q: `_type == "artwork" && status == "sold" && availableInShop == true` },
  { ernst: 'fout', label: 'betaalde order, maar het werk staat niet op verkocht',
    q: `_type == "order" && status == "paid" && count(items[item->editionType == "unique" && item->status != "sold"]) > 0`,
    toon: `orderNumber, "werken": items[item->editionType == "unique" && item->status != "sold"].item->{title, status}` },
  { ernst: 'fout', label: 'prijs incl. BTW is geen rond bedrag terwijl excl. er gelijk aan is — waarschijnlijk een excl-bedrag in het incl-veld (1 sept 2026: 16 werken)',
    q: `_type == "artwork" && defined(priceIncVat) && priceIncVat == priceExclVAT && priceIncVat != round(priceIncVat)`, toon: `title, priceIncVat` },
  { ernst: 'fout', label: 'te koop in de webshop zonder prijs',
    q: `_type in ["artwork", "publication"] && availableInShop == true && !(priceIncVat > 0)` },
  { ernst: 'fout', label: 'unieke werken die vaker dan één keer in een betaalde order zitten',
    q: `_type == "artwork" && editionType == "unique" && count(*[_type == "order" && status == "paid" && references(^._id)]) > 1`,
    toon: `title, "orders": *[_type == "order" && status == "paid" && references(^._id)].orderNumber` },
  { ernst: 'let op', label: 'prijs zonder BTW-tarief (valt terug op 9%)',
    q: `_type in ["artwork", "publication"] && defined(priceIncVat) && !defined(vatRate)` },
  { ernst: 'let op', label: 'beschikbaar werk zonder prijs',
    q: `_type == "artwork" && status == "available" && !defined(priceIncVat) && isPublication != true` },

  // ── Edities en voorraad ───────────────────────────────────────────────────
  { ernst: 'fout', label: 'editie met meer voorraad dan oplage',
    q: `_type == "artwork" && editionType == "edition" && defined(editionTotal) && stock > editionTotal`,
    toon: `title, stock, editionTotal` },
  { ernst: 'fout', label: 'negatieve voorraad',
    q: `_type in ["artwork", "publication"] && stock < 0`, toon: `title, stock` },
  { ernst: 'let op', label: 'editie zonder oplage',
    q: `_type == "artwork" && editionType == "edition" && !defined(editionTotal)` },
  { ernst: 'let op', label: 'editie beschikbaar met voorraad 0',
    q: `_type == "artwork" && editionType == "edition" && status == "available" && stock == 0`, toon: `title, stock` },
  { ernst: 'let op', label: 'variant beschikbaar met voorraad 0',
    q: `_type in ["artwork", "publication"] && count(shopVariants[status != "sold" && stock == 0]) > 0`,
    toon: `title, "varianten": shopVariants[status != "sold" && stock == 0].badge` },

  // ── Reserveringen ─────────────────────────────────────────────────────────
  { ernst: 'fout', label: 'gereserveerd zonder klant of einddatum',
    q: `_type == "artwork" && status == "reserved" && (!defined(reservedFor) || !defined(reservedUntil))` },
  { ernst: 'let op', label: 'reservering verlopen maar nog op reserved',
    q: `_type == "artwork" && status == "reserved" && reservedUntil < "${today}"`, toon: `title, reservedUntil` },

  // ── Verwijzingen ──────────────────────────────────────────────────────────
  { ernst: 'fout', label: 'werk verwijst naar een kunstenaar die niet bestaat',
    q: `_type == "artwork" && defined(artist._ref) && !defined(artist->_id)`, toon: `title, "ref": artist._ref` },
  { ernst: 'fout', label: 'expositie/beurs verwijst naar een werk dat niet bestaat',
    q: `_type in ["exhibition", "artFair"] && count(artworks[!defined(@->_id)]) > 0`,
    toon: `title, "dood": count(artworks[!defined(@->_id)])` },
  { ernst: 'fout', label: 'orderregel verwijst naar een werk dat niet bestaat',
    q: `_type == "order" && count(items[defined(item._ref) && !defined(item->_id)]) > 0`, toon: `orderNumber` },
  { ernst: 'fout', label: 'aankoop in CRM verwijst naar een werk dat niet bestaat',
    q: `_type == "contact" && count(purchases[defined(artwork._ref) && !defined(artwork->_id)]) > 0`,
    toon: `firstName, lastName, email` },
  { ernst: 'fout', label: 'order verwijst naar een contact dat niet bestaat',
    q: `_type == "order" && defined(contact._ref) && !defined(contact->_id)`, toon: `orderNumber` },
  ...(ARTIST_TEMPLATE ? [] : [{ ernst: 'let op' as const, label: 'werk zonder kunstenaar',
    q: `_type == "artwork" && !defined(artist) && isPublication != true` }]),

  // ── Dubbelingen ───────────────────────────────────────────────────────────
  { ernst: 'let op', label: 'werk hangt dubbel in dezelfde expositie/beurs',
    q: `_type in ["exhibition", "artFair"] && count(artworks) != count(array::unique(artworks[]._ref))`,
    toon: `title, "dubbel": count(artworks) - count(array::unique(artworks[]._ref))` },
  { ernst: 'let op', label: 'contacten met hetzelfde e-mailadres',
    q: `_type == "contact" && defined(email) && count(*[_type == "contact" && email == ^.email]) > 1`,
    toon: `email, firstName, lastName` },
  { ernst: 'let op', label: 'dubbel ordernummer',
    q: `_type == "order" && count(*[_type == "order" && orderNumber == ^.orderNumber]) > 1`, toon: `orderNumber` },

  // ── Onvolledig ────────────────────────────────────────────────────────────
  { ernst: 'fout', label: 'order zonder regels',
    q: `_type == "order" && count(items) == 0`, toon: `orderNumber, status` },
  { ernst: 'fout', label: 'betaalde order zonder contact (factuur zonder tenaamstelling)',
    q: `_type == "order" && status == "paid" && !defined(contact)`, toon: `orderNumber, customerEmail` },
  { ernst: 'let op', label: 'order zonder totalExcl (omzet leest null)',
    q: `_type == "order" && !(status in ["cancelled", "refunded"]) && !defined(totalExcl)`, toon: `orderNumber, channel` },
  { ernst: 'let op', label: 'te koop in de webshop zonder afbeelding',
    q: `_type in ["artwork", "publication"] && availableInShop == true && count(images) == 0 && !defined(image)` },
  { ernst: 'let op', label: 'werk zonder slug (geen eigen pagina)',
    q: `_type == "artwork" && !defined(slug.current) && isPublication != true` },
  { ernst: 'let op', label: 'contact zonder e-mail én zonder naam',
    q: `_type == "contact" && !defined(email) && !defined(firstName) && !defined(lastName)` },
  { ernst: 'let op', label: 'lege documenten (geen titel)',
    q: `_type in ["artwork", "exhibition", "artFair", "artist", "publication"] && !defined(title) && !defined(name)`,
    toon: `_type, _createdAt` },
]

let fouten = 0
let letOp = 0
console.log(`Audit over ${await client.fetch<number>('count(*[_type == "artwork"])')} werken, ${await client.fetch<number>('count(*[_type == "order"])')} orders, ${await client.fetch<number>('count(*[_type == "contact"])')} contacten\n`)

for (const c of controles) {
  let n: number
  try {
    n = await client.fetch<number>(`count(*[${c.q}])`)
  } catch (err) {
    console.log(`  ?  ${c.label} — query faalt: ${String((err as Error).message).slice(0, 100)}`)
    continue
  }
  if (n === 0) { console.log(`  ✓  ${c.label}`); continue }
  if (c.ernst === 'fout') fouten++; else letOp++
  console.log(`  ${c.ernst === 'fout' ? '✗' : '!'}  ${c.label} — ${n}`)
  const vb = await client.fetch<Record<string, unknown>[]>(`*[${c.q}][0..4]{_id, ${c.toon ?? 'title'}}`)
  for (const v of vb) {
    const { _id, ...rest } = v
    console.log(`       ${String(_id).padEnd(26)} ${JSON.stringify(rest).slice(0, 110)}`)
  }
}

console.log(`\n${fouten} fout(en), ${letOp} aandachtspunt(en).`)
process.exit(fouten ? 1 : 0)
