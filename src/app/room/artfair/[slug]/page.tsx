'use client'

import { useParams, useSearchParams } from 'next/navigation'
import AutoRoomPage from '@/app/room/AutoRoomPage'

export default function ArtFairRoomPage() {
  const params = useParams()
  const slug = params.slug as string
  const k = useSearchParams().get('k') ?? ''
  return <AutoRoomPage apiPath={`/api/room/artfair/${slug}?k=${encodeURIComponent(k)}`} />
}
