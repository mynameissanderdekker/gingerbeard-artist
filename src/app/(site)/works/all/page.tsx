import { client } from '@/sanity/lib/client'
import { WorksAllClient } from '@/components/WorksAllClient'

export interface ArtworkItem {
  _id: string
  title: string
  year?: number
  slug: { current: string }
  mainImage?: { url?: string }
  priceExclVAT?: number
  priceIncVat?: number
  vatRate?: number | string
  options?: Array<{ priceExclVAT?: number }>
  status?: string
  category?: string
  featured?: boolean
  medium?: string
  dimensions?: { widthCm?: number; heightCm?: number }
}

async function getAllWorks(): Promise<{ works: ArtworkItem[]; categories: string[] }> {
  const [works, categories] = await Promise.all([
    client.fetch<ArtworkItem[]>(
      `*[_type == "artwork" && defined(slug.current) && availableInShop == true] | order(shopFeatured desc, year desc){
        _id, title, year, slug,
        "mainImage": images[0].asset->{ url },
        "priceExclVAT": select(defined(priceIncVat) => round(priceIncVat / (1 + select(vatRate == "21" => 21, vatRate == "0" => 0, 9) / 100) * 100) / 100, priceExclVAT),
        priceIncVat, vatRate, "options": options[]{priceExclVAT}, status, category, "featured": shopFeatured,
        medium, dimensions
      }`,
      {},
      { next: { revalidate: 60 } },
    ),
    client.fetch<string[]>(
      `array::unique(*[_type == "artwork" && defined(category) && category != ""].category) | order(@)`,
      {},
      { next: { revalidate: 60 } },
    ),
  ])

  return { works, categories }
}

export default async function WorksAllPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>
}) {
  const { cat } = await searchParams
  const { works, categories } = await getAllWorks()

  return (
    <WorksAllClient
      works={works}
      categories={categories}
      initialCat={cat}
    />
  )
}
