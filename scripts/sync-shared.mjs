#!/usr/bin/env node
/**
 * De gedeelde Studio-code tussen de twee templates gelijk houden.
 *
 * Er is bewust géén npm-pakket. Met twee installaties kost dat meer dan het
 * oplevert: elke wijziging moet in beide werken, een slechte release raakt
 * beide sites, en je krijgt versiebeheer erbij. Dit script doet het enige wat
 * je op deze schaal echt nodig hebt — laten zien wanneer twee kopieën uit
 * elkaar lopen, vóórdat je erachter komt doordat er iets stuk is.
 *
 * Bouw je een derde installatie, dan kantelt die afweging en is een pakket
 * wél de goedkopere optie.
 *
 *   node scripts/sync-shared.mjs            # verschillen tonen
 *   node scripts/sync-shared.mjs --diff     # met de regels erbij
 *   node scripts/sync-shared.mjs --push     # Torch → artist-template
 *   node scripts/sync-shared.mjs --pull     # artist-template → Torch
 *   node scripts/sync-shared.mjs --check    # exitcode 1 bij afwijking (CI)
 *
 * De tegenhanger staat als `scripts/sync-shared.mjs` in de andere repo en is
 * hetzelfde bestand; --push en --pull kijken naar de repo waarin je staat.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HERE = resolve(__dirname, '..')

/**
 * Welke kant sta ik op?
 *
 * De tabel hieronder is geschreven vanuit de gallery-template (links) naar de
 * artist-template (rechts). Draai je hem om, dan moet ook de andere repo
 * gevonden worden — en die heette hier hardcoded `mynameissanderdekker`, dus
 * vanuit de artist-template wees hij naar zichzelf. Gevolg: `--check` vergeleek
 * die repo met zichzelf, vond de gallery-paden niet en meldde verschillen die
 * niet bestaan. Dat blokkeerde daar elke push.
 */
const ARTIST_HIER = existsSync(resolve(HERE, 'src', 'lib', 'orderStatus.ts'))

// De naam van de andere repo staat niet vast (de gallery-template is ooit
// hernoemd), dus zoeken we tussen de buren naar de repo met de andere indeling.
function vindAndere() {
  if (process.env.OTHER_REPO) return resolve(process.env.OTHER_REPO)
  const buren = resolve(HERE, '..')
  const kenmerk = ARTIST_HIER
    ? (d) => existsSync(join(d, 'lib', 'orderStatus.ts'))       // gallery-template
    : (d) => existsSync(join(d, 'src', 'lib', 'orderStatus.ts')) // artist-template
  try {
    for (const naam of readdirSync(buren)) {
      const d = join(buren, naam)
      if (d === HERE) continue
      if (existsSync(join(d, 'scripts', 'sync-shared.mjs')) && kenmerk(d)) return d
    }
  } catch { /* geen leesrechten op de bovenliggende map */ }
  return join(buren, ARTIST_HIER ? 'gingerbeard-gallery' : 'gingerbeard-artist')
}
const OTHER = vindAndere()

/**
 * Bestanden die woord voor woord gelijk horen te zijn.
 *
 * De paden verschillen omdat de gallery-template geen `src/` gebruikt en de
 * artist-template wel. Wat hier níet in staat is even bewust: `DashboardTool`,
 * `RegisterSaleTool`, `SalesOverviewTool`, `orderEmails` en `VenuePicker`
 * lijken sterk op elkaar maar hebben echte inhoudelijke verschillen — daar is
 * gelijktrekken een keuze, geen onderhoud.
 */
const SHARED = [
  ['lib/orderStatus.ts',                            'src/lib/orderStatus.ts'],
  ['lib/contactSearch.ts',                          'src/lib/contactSearch.ts'],
  ['lib/invoiceVat.ts',                             'src/lib/invoiceVat.ts'],
  ['lib/markSold.ts',                               'src/lib/markSold.ts'],
  ['lib/reverseSale.ts',                            'src/lib/reverseSale.ts'],
  ['lib/appearance.ts',                             'src/lib/appearance.ts'],
  ['app/components/BackLink.tsx',                   'src/components/BackLink.tsx'],
  ['app/components/AddToCalendar.tsx',              'src/components/AddToCalendar.tsx'],
  ['lib/createOrder.ts',                            'src/lib/createOrder.ts'],
  ['lib/adminAuth.ts',                              'src/lib/adminAuth.ts'],
  ['lib/verifyTurnstile.ts',                        'src/lib/verifyTurnstile.ts'],
  ['app/api/admin/login/route.ts',                  'src/app/api/admin/login/route.ts'],
  ['app/proposal/[id]/priceLabel.ts',               'src/app/proposal/[id]/priceLabel.ts'],
  ['sanity/components/useListClient.ts',            'src/sanity/components/useListClient.ts'],
  ['sanity/components/AttentionBadge.tsx',          'src/sanity/components/AttentionBadge.tsx'],
  ['sanity/components/NewDocumentRedirect.tsx',     'src/sanity/components/NewDocumentRedirect.tsx'],
  ['sanity/components/OrderCompletion.tsx',         'src/sanity/components/OrderCompletion.tsx'],
  ['sanity/components/ProposalCompletion.tsx',      'src/sanity/components/ProposalCompletion.tsx'],
  ['sanity/components/ProposalToSale.tsx',          'src/sanity/components/ProposalToSale.tsx'],
  ['sanity/components/AutoProposalNumber.tsx',      'src/sanity/components/AutoProposalNumber.tsx'],
  ['sanity/components/ArtworkReservation.tsx',      'src/sanity/components/ArtworkReservation.tsx'],
  ['sanity/components/ContactLinkedSelections.tsx', 'src/sanity/components/ContactLinkedSelections.tsx'],
  ['sanity/components/InstagramLink.tsx',           'src/sanity/components/InstagramLink.tsx'],
]

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const MODE = has('--push') ? 'push' : has('--pull') ? 'pull' : has('--check') ? 'check' : 'show'

if (!existsSync(OTHER)) {
  console.error(`Andere repo niet gevonden: ${OTHER}`)
  console.error('Zet OTHER_REPO=/pad/naar/repo als hij ergens anders staat.')
  process.exit(2)
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null)

let same = 0
const differing = []
const missing = []

for (const paar of SHARED) {
  // De tabel is geschreven gallery → artist. Sta je in de artist-template,
  // dan is "hier" de rechterkolom.
  const [hereRel, otherRel] = ARTIST_HIER ? [paar[1], paar[0]] : paar
  const a = read(join(HERE, hereRel))
  const b = read(join(OTHER, otherRel))

  if (a === null || b === null) {
    missing.push([hereRel, otherRel, a === null ? 'hier' : 'daar'])
    continue
  }
  if (a === b) { same++; continue }
  differing.push([hereRel, otherRel, a, b])
}

const name = basename(HERE)
const otherName = basename(OTHER)

console.log(`${name}  ↔  ${otherName}\n`)
console.log(`  gelijk      ${same}`)
console.log(`  verschillend ${differing.length}`)
if (missing.length) console.log(`  ontbreekt   ${missing.length}`)

for (const [h, o, waar] of missing) {
  console.log(`\n  ontbreekt ${waar}: ${waar === 'hier' ? h : o}`)
}

for (const [h, o, a, b] of differing) {
  const la = a.split('\n')
  const lb = b.split('\n')
  console.log(`\n  ≠ ${h}`)
  if (has('--diff')) {
    // Kleine, leesbare diff: alleen de regels die verschillen.
    const setB = new Set(lb)
    const setA = new Set(la)
    const removed = la.filter((l) => !setB.has(l) && l.trim())
    const added = lb.filter((l) => !setA.has(l) && l.trim())
    for (const l of removed.slice(0, 12)) console.log(`      - ${l.trim().slice(0, 100)}`)
    for (const l of added.slice(0, 12)) console.log(`      + ${l.trim().slice(0, 100)}`)
    const rest = removed.length + added.length - Math.min(removed.length, 12) - Math.min(added.length, 12)
    if (rest > 0) console.log(`      … nog ${rest} regels`)
  }
}

if (MODE === 'push' || MODE === 'pull') {
  for (const [h, o, a, b] of differing) {
    if (MODE === 'push') writeFileSync(join(OTHER, o), a)
    else writeFileSync(join(HERE, h), b)
  }
  const dir = MODE === 'push' ? `${name} → ${otherName}` : `${otherName} → ${name}`
  console.log(`\n${differing.length} bestand(en) overgezet: ${dir}`)
  console.log('Draai daarna `npx tsc --noEmit` in de repo die je hebt gewijzigd.')
} else if (differing.length || missing.length) {
  console.log(`\nOverzetten: --push (${name} wint) of --pull (${otherName} wint).`)
  console.log('Met --diff zie je de regels.')
  if (MODE === 'check') process.exit(1)
} else {
  console.log('\nAlles gelijk.')
}
