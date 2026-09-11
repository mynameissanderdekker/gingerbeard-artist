import { NextRequest, NextResponse } from 'next/server'
import { roomKeyGeldig } from '@/lib/roomKey'
import { getSanityWriteClient } from '@/lib/sanityClient'
import { getSiteIdentity } from '@/lib/siteIdentity'

const ARTWORK_FIELDS = `
  _id, title, year, medium, status, vatRate,
  "priceIncVat": priceIncVat,
  "priceExclVAT": select(
    defined(priceIncVat) && vatRate == "21" => round(priceIncVat / 1.21 * 100) / 100,
    defined(priceIncVat) && vatRate == "0"  => priceIncVat,
    defined(priceIncVat)                    => round(priceIncVat / 1.09 * 100) / 100
  ),
  "widthCm": dimensions.widthCm,
  "heightCm": dimensions.heightCm,
  "depthCm": dimensions.depthCm,
  editionType, editionTotal, editionAP,
  "slug": slug.current,
  "image": images[0].asset->url
`

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  // Prijslijst alleen met de sleutel uit de deellink (lib/roomKey) — zonder
  // sleutel is dit een publieke prijslijst op de slug van de expositiepagina.
  if (!roomKeyGeldig('artfair', slug, req.nextUrl.searchParams.get('k'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const client = getSanityWriteClient('2026-01-01')
  const fair = await client.fetch(
    `*[_type == "artFair" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
      _id, title, location, startDate, endDate,
      "artworks": *[_type == "artwork" && ^._id in artFairs[]._ref && !(_id in path("drafts.**"))] | order(title asc) {
        "_key": _id,
        "contextNote": null,
        "artwork": { ${ARTWORK_FIELDS} }
      }
    }`,
    { slug }
  )

  if (!fair) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...fair, showPrices: true, siteEmail: (await getSiteIdentity(client)).email })
}
