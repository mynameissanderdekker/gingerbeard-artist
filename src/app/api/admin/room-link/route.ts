import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { roomPad, type RoomType } from '@/lib/roomKey'

/**
 * Geeft de deellink van een prijslijst (met sleutel) aan de Studio.
 * Alleen met Studio-token of admin-cookie — de sleutel is het slot.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const type = req.nextUrl.searchParams.get('type') as RoomType | null
  const slug = req.nextUrl.searchParams.get('slug')
  if ((type !== 'exhibition' && type !== 'artfair' && type !== 'privatesale') || !slug) {
    return NextResponse.json({ error: 'type en slug vereist' }, { status: 400 })
  }
  const pad = roomPad(type, slug)
  if (!pad) return NextResponse.json({ error: 'ADMIN_PASSWORD ontbreekt; geen deellink mogelijk' }, { status: 503 })
  const basis = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')
  return NextResponse.json({ path: pad, url: `${basis}${pad}` })
}
