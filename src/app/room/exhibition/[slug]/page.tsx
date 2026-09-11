'use client'

import { useParams, useSearchParams } from 'next/navigation'
import AutoRoomPage from '@/app/room/AutoRoomPage'

export default function ExhibitionRoomPage() {
  const params = useParams()
  const slug = params.slug as string
  const k = useSearchParams().get('k') ?? ''
  return <AutoRoomPage apiPath={`/api/room/exhibition/${slug}?k=${encodeURIComponent(k)}`} />
}
