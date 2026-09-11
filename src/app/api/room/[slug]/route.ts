import { NextRequest, NextResponse } from 'next/server'
import { roomKeyGeldig } from '@/lib/roomKey'
import { getSanityWriteClient } from '@/lib/sanityClient'
import { getSiteIdentity } from '@/lib/siteIdentity'

const QUERY = `
  *[_type == "privateSale" && slug.current == $slug][0] {
    title,
    "description": occasion,
    "isPublished": isActive,
    password,
    expiresAt,
    showPrices,
    "artworks": artworks[] {
      _key,
      "contextNote": note,
      priceOverride,
      "artwork": artwork-> {
        _id,
        title,
        year,
        medium,
        status,
        "priceExclVAT": select(defined(priceIncVat) => round(priceIncVat / (1 + select(vatRate == "21" => 21, vatRate == "0" => 0, 9) / 100) * 100) / 100, priceExclVAT),
        priceIncVat,
        vatRate,
        editionTotal,
        editionAP,
        dimensions,
        "slug": slug.current,
        "image": images[0].asset->url,
        "editionRecords": editionRecords[] { number, status }
      }
    }
  }

`

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const passwordAttempt = req.nextUrl.searchParams.get('password')
  if (!roomKeyGeldig('privatesale', slug, req.nextUrl.searchParams.get('k'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const sanity = getSanityWriteClient('2026-07-24')
    const room = await sanity.fetch(QUERY, { slug })

    if (!room) {
      return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    }

    if (!room.isPublished) {
      return NextResponse.json({ error: 'Deze selectie is niet actief' }, { status: 404 })
    }

    if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Deze selectie is verlopen' }, { status: 410 })
    }

    if (room.password && room.password !== passwordAttempt) {
      return NextResponse.json({ requiresPassword: true }, { status: 401 })
    }

    // Strip private fields before returning
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...publicRoom } = room
    // De prijslijst toont een contactadres; dat stond in de pagina hardcoded.
    const site = await getSiteIdentity(sanity)
    return NextResponse.json({ ...publicRoom, siteEmail: site.email })
  } catch (err) {
    console.error('[api/room]', err)
    return NextResponse.json({ error: 'Er ging iets mis' }, { status: 500 })
  }
}
