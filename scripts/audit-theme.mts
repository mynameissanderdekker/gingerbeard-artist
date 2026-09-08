/**
 * Zit er nog uiterlijk in de core dat per kunstenaar hoort te verschillen?
 *
 * Tegenhanger van audit-theme in gingerbeard-gallery. De vormgeving van
 * mynameissanderdekker zat in 3125 regels globals.css met 182 losse
 * hexkleuren, plus 226 in componenten. Nu hangt alles aan tokens in :root.
 *
 * Wat hier — anders dan bij de gallery — nog wél in de core zit: de
 * **identiteit**. "Sander Dekker" staat 68× hard in publieke code (metadata,
 * teksten, de Mindmap-homepage). Dat is geen styling maar het ontbreken van
 * een siteIdentity zoals de gallery-core die heeft. De grens staat op de
 * gemeten stand en mag alleen omlaag.
 *
 * Nu staan de tokens in `app/globals.css`, hangt de Tailwind-grijsschaal daar
 * aan, en kiest een thema (`themes/*.ts`) of Site Settings → Appearance de
 * waarden. Dit script houdt dat vast, op dezelfde manier als audit-tenant:
 * tellen wat er nog hard in de code staat, met een grens die op de gemeten
 * stand staat en **alleen omlaag mag**.
 *
 * Alleen publieke pagina's. De admin-UI, de Studio-panelen, de app op de
 * vloer en de PDF-documenten zijn voor elke galerie hetzelfde gereedschap;
 * dat mag één uiterlijk hebben.
 *
 *   npx tsx scripts/audit-theme.mts
 *
 * Leest alleen.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

// Gallery-template zonder src/, artist-template mét.
const ROOT = existsSync(new URL('../src/app', import.meta.url)) ? 'src' : '.'
const APP = join(ROOT, 'app')

/** Niet publiek: gereedschap voor de galerie, gelijk voor iedereen. */
const INTERN = /^(admin|app|proposal|submit|room|private-sales|studio|studio-feedback|api)(\/|$)/

/** De grens. Alleen omlaag; zie audit-tenant voor waarom. */
const GRENS = {
  hexKleuren: 7,     // de merkkleuren van Google en Outlook in AddToCalendar — hún merk, geen thema
  geistDirect: 0,    // n.v.t. hier (systeemstack), maar de controle blijft: een next/font-var in een component omzeilt het thema
  galerieNaam: 68,   // "Sander Dekker" / "mynameissanderdekker" hard in publieke code — gemeten 5 sept 2026
  lettermaatCss: 15, // losse px-lettermaten in globals.css — de Mindmap, het spinwheel, sluitkruisjes en de nav; de rest hangt aan --type-*
  lettermaatInline: 0, // losse px/rem/em-lettermaten in publieke componenten: alles via var(--type-…)
  //                    Dit is de identiteit, niet het uiterlijk: de artist-core heeft nog geen
  //                    siteIdentity zoals de gallery-core. Elke stap omlaag is er één; omhoog nooit.
}

/** Bestanden waarvan de hexkleuren van een derde partij zijn en dus mogen blijven. */
const MERKKLEUREN_TOEGESTAAN: Record<string, number> = {
  'src/components/AddToCalendar.tsx': 7,   // Google (4) en Outlook (3) in de iconen
}

/** Wat als klantnaam telt in déze core. */
const KLANTNAAM = /sander dekker|mynameissanderdekker/gi

function bestanden(dir: string): string[] {
  const uit: string[] = []
  for (const naam of readdirSync(dir)) {
    const p = join(dir, naam)
    if (statSync(p).isDirectory()) uit.push(...bestanden(p))
    else if (/\.tsx?$/.test(naam)) uit.push(p)
  }
  return uit
}

let fails = 0
const check = (l: string, ok: boolean, d = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${l}${d ? `  — ${d}` : ''}`)
  if (!ok) fails++
}

// In deze core staan de componenten náást app/, niet erin.
const COMPONENTS = join(ROOT, 'components')
const publiek = [
  ...bestanden(APP).filter((p) => !INTERN.test(relative(APP, p))),
  ...(existsSync(COMPONENTS) ? bestanden(COMPONENTS) : []),
]

// ── 1. Hexkleuren ─────────────────────────────────────────────────────────
const hexRe = /#[0-9a-fA-F]{3,6}\b/g
const treffers: { f: string; n: number; vb: string[] }[] = []
for (const f of publiek) {
  const s = readFileSync(f, 'utf8')
  const m = s.match(hexRe) ?? []
  const rel = relative(ROOT, f)
  const toegestaan = MERKKLEUREN_TOEGESTAAN[join(ROOT, rel).replace(/^\.\//, '')] ?? MERKKLEUREN_TOEGESTAAN[rel] ?? 0
  if (m.length > toegestaan) treffers.push({ f: rel, n: m.length - toegestaan, vb: [...new Set(m)].slice(0, 4) })
}
const hexTotaal = treffers.reduce((s, t) => s + t.n, 0)

console.log(`── ${publiek.length} publieke bestanden ──\n`)
check(`hexkleuren in publieke componenten, buiten merkkleuren van derden ≤ 0`, hexTotaal <= 0,
  `${hexTotaal} gevonden${hexTotaal ? '' : ' — alles via tokens (7 merkkleuren in AddToCalendar toegestaan)'}`)
for (const t of treffers.sort((a, b) => b.n - a.n).slice(0, 8)) {
  console.log(`      ${String(t.n).padStart(3)}  ${t.f}   ${t.vb.join(' ')}`)
}

// ── 2. Lettertype rechtstreeks ────────────────────────────────────────────
// `var(--font-geist-sans)` in een component omzeilt het thema: een galerie
// met een ander lettertype krijgt daar dan alsnog Geist.
let geist = 0
const geistWaar: string[] = []
for (const f of publiek) {
  const n = (readFileSync(f, 'utf8').match(/--font-geist-/g) ?? []).length
  if (n) { geist += n; geistWaar.push(`${relative(ROOT, f)} (${n})`) }
}
check(`lettertype alleen via het thema ≤ ${GRENS.geistDirect}`, geist <= GRENS.geistDirect,
  geist ? geistWaar.join(', ') : 'geen directe verwijzing naar Geist')

// ── 3. Een galerienaam in het uiterlijk ───────────────────────────────────
// audit-tenant kijkt hier ook naar, maar breder (mail, domein, IBAN). Hier
// alleen de vraag: staat de náám van een klant in een publieke component?
let naam = 0
const naamWaar: string[] = []
for (const f of publiek) {
  const s = readFileSync(f, 'utf8')
  // Hele commentaarregels tellen niet: uitleg over waarom iets níet
  // hardcoded is, is juist de bedoeling. Een regel met het woord "migratie"
  // in het commentaar erachter ook niet — dat is de oude waarde die één keer
  // gelezen wordt om niemand zijn winkelwagen te laten verliezen, met een
  // datum erbij wanneer hij weg mag. Staat die datum in het verleden, dan
  // hoort dit alsnog rood te worden; zie hieronder.
  const regels = s.split('\n').filter((r) => !/^\s*(\/\/|\*|\/\*)/.test(r))
  for (const r of regels) {
    const m = r.match(/\/\/.*migratie.*?(\d{1,2} \w+ \d{4})/)
    if (m) {
      const MAANDEN: Record<string, string> = { januari:'Jan', februari:'Feb', maart:'Mar', april:'Apr', mei:'May', juni:'Jun', juli:'Jul', augustus:'Aug', september:'Sep', oktober:'Oct', november:'Nov', december:'Dec' }
      const [dag, mnd, jaar] = m[1].split(' ')
      const tot = new Date(`${dag} ${MAANDEN[mnd.toLowerCase()] ?? mnd} ${jaar}`)
      if (!isNaN(tot.getTime()) && tot < new Date()) { naam++; naamWaar.push(`${relative(ROOT, f)}: migratie verlopen op ${m[1]}`) }
    }
  }
  const zonderCommentaar = regels.filter((r) => !/\/\/.*migratie/.test(r)).join('\n')
  const n = (zonderCommentaar.match(KLANTNAAM) ?? []).length
  if (n) { naam += n; naamWaar.push(`${relative(ROOT, f)} (${n})`) }
}
check(`geen klantnaam in publieke componenten ≤ ${GRENS.galerieNaam}`, naam <= GRENS.galerieNaam,
  naam ? naamWaar.join(', ') : 'schoon')

// ── 4. Zijn de tokens er wel? ─────────────────────────────────────────────
// Tellen dat er niets hardcoded is zegt nog niet dat het juiste er wél staat.
const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8')
const nodig = ['--tone-paper', '--tone-ink', '--tone-400', '--color-accent', '--color-bg', '--color-danger', '--radius', '--brand-1']
const mist = nodig.filter((t) => !css.includes(`${t}:`))
check('globals.css definieert de tokens waar de componenten op leunen', mist.length === 0,
  mist.length ? `ontbreekt: ${mist.join(', ')}` : `${nodig.length} gecontroleerd`)
const tw = readFileSync(join('tailwind.config.ts'), 'utf8')
check('Tailwind-grijsschaal hangt aan de tokens', /gray:\s*\{[\s\S]*toon\(400\)/.test(tw) && /black:\s*"var\(--tone-ink\)"/.test(tw),
  'text-gray-400 en bg-black volgen het thema')

// Elke token die een component gebruikt moet ook bestaan — anders valt hij
// stil terug op "niets", en dat zie je pas in de browser.
const gebruikt = new Set<string>()
for (const f of publiek) for (const m of readFileSync(f, 'utf8').matchAll(/var\((--[a-z0-9-]+)\)/g)) gebruikt.add(m[1])
const themaTokens = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]))
const onbekend = [...gebruikt].filter((t) => !themaTokens.has(t))
check('elke gebruikte token is gedefinieerd', onbekend.length === 0,
  onbekend.length ? `onbekend: ${onbekend.join(', ')}` : `${gebruikt.size} tokens in gebruik`)

// Lettermaten: één schaal (--type-*), geen losse px/rem/em. Body stond op 15px
// en er lagen ~80 eigen maten overheen; dat gaf het rommelige beeld.
const maatCss = [...css.matchAll(/font-size:\s*\d+px/g)].length
check(`losse px-lettermaten in globals.css ≤ ${GRENS.lettermaatCss}`, maatCss <= GRENS.lettermaatCss, `${maatCss}`)
let maatInline = 0
const maatWaar: string[] = []
for (const f of publiek) {
  const n = [...readFileSync(f, 'utf8').matchAll(/fontSize:\s*'[\d.]+(px|rem|em)'/g)].length
  if (n) { maatInline += n; maatWaar.push(`${relative(ROOT, f)} (${n})`) }
}
check(`losse lettermaten in publieke componenten ≤ ${GRENS.lettermaatInline}`, maatInline <= GRENS.lettermaatInline,
  maatWaar.length ? maatWaar.join(', ') : 'alles via var(--type-…)')

console.log(fails
  ? `\n${fails} punt(en) kloppen niet. Zet de grens nooit omhoog om dit groen te maken — dan is de vraag waarom er weer uiterlijk in de core kruipt.`
  : '\nHet uiterlijk zit in tokens; de core kent geen galerie.')
process.exit(fails ? 1 : 0)
