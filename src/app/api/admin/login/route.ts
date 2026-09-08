import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, adminCookieValue, isValidSanityToken } from '@/lib/adminAuth'

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
    const { password } = await req.json().catch(() => ({}))
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
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
