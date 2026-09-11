import { NextRequest, NextResponse } from 'next/server'
import { roomPad } from '@/lib/roomKey'
import { getResendClient } from '@/lib/resend'
import { getSanityWriteClient } from '@/lib/sanityClient'
import { verifyTurnstile, clientIp } from '@/lib/verifyTurnstile'

const TO = 'Sander Dekker <hello@mynameissanderdekker.com>'

export async function POST(req: NextRequest) {
  try {
    const resend = getResendClient()
    const sanity = getSanityWriteClient('2026-07-24')
    const { name, email, phone, message, newsletter, artworkTitle, artworkSlug, priceListSlug, turnstileToken } =
      await req.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Naam, e-mail en bericht zijn verplicht' }, { status: 400 })
    }

    // Dit formulier stuurt rechtstreeks mail naar de studio en stond volledig
    // open: geen widget op de pagina, geen controle op de server. Gemeten met
    // scripts/testrun-turnstile.mts — een verzonnen inzending kwam er zo door.
    const check = await verifyTurnstile(turnstileToken, { action: 'enquire', ip: clientIp(req) })
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    const subject = artworkTitle
      ? `Interesse: ${artworkTitle}`
      : 'Interesse in een werk'

    const lines = [
      `Naam: ${name}`,
      `E-mail: ${email}`,
      phone ? `Telefoon: ${phone}` : null,
      '',
      `Bericht:`,
      message,
      '',
      artworkTitle ? `Werk: ${artworkTitle}` : null,
      artworkSlug ? `URL: https://mynameissanderdekker.com/projects/innate-curiosity/${artworkSlug}` : null,
      // Interne mail naar de studio: deellink mét sleutel (lib/roomKey).
      priceListSlug ? `Price list: https://mynameissanderdekker.com${roomPad('privatesale', priceListSlug) ?? `/room/${priceListSlug}`}` : null,
      newsletter ? `Nieuwsbrief: Ja` : null,
    ].filter((l): l is string => l !== null)

    await resend.emails.send({
      from: 'Studio <studio@mynameissanderdekker.com>',
      to: TO,
      replyTo: email,
      subject,
      text: lines.join('\n'),
      html: `<pre style="font-family:sans-serif;font-size:14px;line-height:1.6">${lines.join('\n')}</pre>`,
    })

    // If newsletter checked, subscribe them to the contact list
    if (newsletter && email) {
      try {
        const existing = await sanity.fetch(
          `*[_type == "contact" && email == $email][0]{ _id, subscribed }`,
          { email }
        )
        if (!existing) {
          await sanity.create({
            _type: 'contact',
            email,
            firstName: name.split(' ')[0] ?? '',
            lastName: name.split(' ').slice(1).join(' ') ?? '',
            subscribed: true,
            subscribedAt: new Date().toISOString(),
            source: artworkTitle ? `enquiry: ${artworkTitle}` : 'enquiry form',
            type: 'collector',
          })
        } else if (!existing.subscribed) {
          await sanity.patch(existing._id).set({
            subscribed: true,
            subscribedAt: new Date().toISOString(),
          }).commit()
        }
      } catch (crmErr) {
        // CRM update failure shouldn't fail the whole request
        console.error('[enquire/crm]', crmErr)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/enquire]', err)
    return NextResponse.json({ error: 'Er ging iets mis. Probeer het later opnieuw.' }, { status: 500 })
  }
}
