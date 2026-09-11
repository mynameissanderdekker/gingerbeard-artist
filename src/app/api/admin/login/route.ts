import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieValue, isValidSanityToken } from '@/lib/adminAuth'
import { geblokkeerd, mislukt, geslaagd } from '@/lib/bruteForce'
import { timingSafeEqual } from 'node:crypto'

/**
 * Wachtwoord → cookie, óf Studio-token → cookie. Zie lib/adminAuth.ts.
 *
 * De tweede weg bestaat omdat de factuur- en printpagina's onder /admin
 * gewone pagina's zijn: een browser kan bij het openen van een tab geen
 * `x-sanity-token`-header meesturen, dus wie al in de Studio zat kreeg
 * tóch het wachtwoordscherm. `AdminSession` in de Studio roept dit één keer
 * per sessie aan; daarna werken alle /admin-links. Het wachtwoord blijft
 * voor wie níet in de Studio zit.
 */
export async function POST(req: NextRequest) {
  const expected = adminCookieValue()
  // Fail closed: geen wachtwoord ingesteld = niemand erin, ook niet via de Studio.
  if (!expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const viaStudio = await isValidSanityToken(req.headers.get('x-sanity-token'))
  if (!viaStudio) {
    // Rem op raden — zelfde regel als de pincode van de app (lib/bruteForce.ts).
    const blok = geblokkeerd(req, 'admin-login')
    if (blok) return blok
    const { password } = await req.json().catch(() => ({}))
    const juist = process.env.ADMIN_PASSWORD ?? ''
    const ok = typeof password === 'string' && password.length === juist.length && juist.length > 0
      && timingSafeEqual(Buffer.from(password), Buffer.from(juist))
    if (!ok) {
      await mislukt(req, 'admin-login')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    geslaagd(req, 'admin-login')
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { maxAge: 0, path: '/' })
  return res
}
