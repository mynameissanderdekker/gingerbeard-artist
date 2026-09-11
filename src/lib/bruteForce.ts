/**
 * Rem op raden: pincode en beheerderswachtwoord.
 *
 * De pincode van de app is vier cijfers. Zonder rem is dat tienduizend
 * pogingen, en met een handvol parallelle verzoeken is dat in minuten
 * gedaan — en dan zie je prijzen, klanten, en kun je verkopen registreren
 * (gevonden 11 sept 2026, vlak voor een beurs waar de app op de vloer wordt
 * gebruikt).
 *
 * Wat dit doet, per IP en per doel:
 *   - na `MAX` mislukte pogingen: `BLOK` lang geweigerd (429)
 *   - elke mislukte poging wacht `VERTRAGING` voordat er antwoord komt
 *
 * Eerlijk over de grens: dit geheugen leeft per serverinstantie. Vercel start
 * er meerdere, dus een aanvaller die over instanties verdeeld raakt heeft
 * meer pogingen dan MAX. De vertraging geldt wél overal. Het echte slot zit
 * in de Vercel Firewall (Rate limiting op /api/app/unlock en
 * /api/admin/login) — zie CLAUDE.md. Dit is de vangrail voor als dat er niet
 * staat, en het maakt de pincode van vier cijfers geen giveaway meer.
 */
const MAX = 5
const BLOK = 15 * 60 * 1000
const VERTRAGING = 1500

type Stand = { fouten: number; tot: number }
const standen = new Map<string, Stand>()

function ipVan(req: { headers?: { get(name: string): string | null } }): string {
  const h = req.headers?.get?.('x-forwarded-for') ?? req.headers?.get?.('x-real-ip') ?? ''
  return h.split(',')[0].trim() || 'onbekend'
}

/** Geblokkeerd? Dan het antwoord dat terug moet; anders null. */
export function geblokkeerd(req: { headers?: { get(name: string): string | null } }, doel: string): Response | null {
  const sleutel = `${doel}:${ipVan(req)}`
  const s = standen.get(sleutel)
  if (!s) return null
  if (s.tot && Date.now() < s.tot) {
    const minuten = Math.ceil((s.tot - Date.now()) / 60000)
    return Response.json(
      { ok: false, error: `Te veel mislukte pogingen. Probeer het over ${minuten} minuten opnieuw.` },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((s.tot - Date.now()) / 1000)) } }
    )
  }
  if (s.tot && Date.now() >= s.tot) standen.delete(sleutel)
  return null
}

/** Een mislukte poging registreren, en de aanvaller even laten wachten. */
export async function mislukt(req: { headers?: { get(name: string): string | null } }, doel: string): Promise<void> {
  const sleutel = `${doel}:${ipVan(req)}`
  const s = standen.get(sleutel) ?? { fouten: 0, tot: 0 }
  s.fouten += 1
  if (s.fouten >= MAX) { s.tot = Date.now() + BLOK; s.fouten = 0 }
  standen.set(sleutel, s)
  // Opruimen zodat de map niet groeit: alles ouder dan de blokkeertijd weg.
  if (standen.size > 5000) for (const [k, v] of standen) if (!v.tot || v.tot < Date.now()) standen.delete(k)
  await new Promise((r) => setTimeout(r, VERTRAGING))
}

/** Geslaagd: de teller van dit IP wissen. */
export function geslaagd(req: { headers?: { get(name: string): string | null } }, doel: string): void {
  standen.delete(`${doel}:${ipVan(req)}`)
}
