import { NextRequest } from 'next/server'
import { getResendClient } from '@/lib/resend'
import { getSanityWriteClient } from '@/lib/sanityClient'
import type { SanityClient } from '@sanity/client'
import { buildShippedEmail } from '@/lib/orderEmails'
import { isAdminRequest } from '@/lib/adminAuth'
import { generateInvoicePdf } from '@/lib/generateInvoicePdf'

const FROM_FALLBACK = 'Sander Dekker <hello@mynameissanderdekker.com>'

/**
 * Volgend factuurnummer.
 *
 * Telde eerder de bestaande facturen en deed +1 — dan levert een verwijderde
 * order hetzelfde nummer nog een keer op. Nu het hóógste bestaande nummer als
 * vertrekpunt, en gedeeld met de offertes zodat een nummer nooit twee keer
 * wordt uitgegeven.
 */
async function nextInvoiceNumber(sanity: SanityClient): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2)
  const prefix = (await sanity.fetch<string | null>(
    `*[_type == "siteSettings"][0].invoiceSettings.invoicePrefix`
  )) ?? 'SDK'
  const base = `${prefix}-${yy}-`

  // Béide velden: de verkooptool zet het nummer in `orderNumber`, deze route
  // in `invoiceNumber`.
  const [lastOrder, lastInvoice, lastProposal] = await Promise.all([
    sanity.fetch<string | null>(
      `*[_type == "order" && orderNumber match $p] | order(orderNumber desc)[0].orderNumber`,
      { p: `${base}*` }
    ),
    sanity.fetch<string | null>(
      `*[_type == "order" && invoiceNumber match $p] | order(invoiceNumber desc)[0].invoiceNumber`,
      { p: `${base}*` }
    ),
    sanity.fetch<string | null>(
      `*[_type == "proposal" && proposalNumber match $p] | order(proposalNumber desc)[0].proposalNumber`,
      { p: `PROP-${base}*` }
    ),
  ])
  const seqFrom = (v: string | null) => {
    const n = parseInt(v?.split('-').pop() ?? '0', 10)
    return isNaN(n) ? 0 : n
  }
  return `${base}${String(Math.max(seqFrom(lastOrder), seqFrom(lastInvoice), seqFrom(lastProposal)) + 1).padStart(3, '0')}`
}

export async function POST(request: NextRequest) {
  // Stond open: iedereen met een order-id kon de verzendmail laten sturen (8 sept 2026).
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const resend = getResendClient()
  const sanity = getSanityWriteClient()
  const { orderId } = await request.json()
  if (!orderId) return Response.json({ error: 'Missing orderId' }, { status: 400 })

  // ── Fetch full order ─────────────────────────────────────────────────────
  const order = await sanity.fetch<{
    _id:             string
    orderNumber:     string
    invoiceNumber?:  string
    customerName?:   string
    customerEmail?:  string
    status:          string
    fulfilment?:     string
    trackingNumber?: string
    trackingCarrier?: string
    shippingEmailSentAt?: string
    createdAt?:      string
    items?:          Array<{ title: string; quantity: number; price: number; vatRate?: number | string }>
    clientLocation?: 'nl' | 'eu' | 'export'
    shippingCost?:   number
    totalAmount?:    number
    shippingAddress?: {
      street?:     string
      postalCode?: string
      city?:       string
      country?:    string
    }
  } | null>(
    `*[_type == "order" && _id == $orderId][0]{
      _id, orderNumber, invoiceNumber, customerName, customerEmail, status, fulfilment,
      trackingNumber, trackingCarrier, shippingEmailSentAt, createdAt,
      items[]{ title, quantity, price, vatRate },
      "clientLocation": contact->clientLocation,
      shippingCost, totalAmount, shippingAddress
    }`,
    { orderId }
  )

  if (!order)                    return Response.json({ error: 'Order not found' }, { status: 404 })
  if (order.shippingEmailSentAt) return Response.json({ sent: false, reason: 'already_sent' })
  // Hangt aan de manier van leveren, niet aan de betaalstatus.
  if (order.fulfilment !== 'shipped' || !order.trackingNumber)
                                 return Response.json({ sent: false, reason: 'not_shipped' })
  if (!order.customerEmail)      return Response.json({ sent: false, reason: 'no_email' })

  // ── Generate invoice number (if not already set) ─────────────────────────
  const invoiceNumber = order.invoiceNumber ?? await nextInvoiceNumber(sanity)

  // Afzender uit Shop Settings, met de oude waarde als terugval.
  const fromEmail = await sanity.fetch<string | null>(
    `*[_type == "shopSettings"][0].fromEmail`
  )
  const from = fromEmail ? `Sander Dekker <${fromEmail}>` : FROM_FALLBACK

  // ── Verkopersgegevens uit Site Settings ──────────────────────────────────
  // Stonden hardcoded in de PDF-generator. Ontbrekende velden vallen daar
  // terug op de oude waarden, dus een lege instelling breekt niets.
  const seller = await sanity.fetch<{
    legalName?: string; address?: string; postalCode?: string; city?: string
    country?: string; kvkNumber?: string; vatNumber?: string
    iban?: string; bic?: string; website?: string
  } | null>(`*[_type == "siteSettings"][0].invoiceSettings`)

  // ── Generate PDF ─────────────────────────────────────────────────────────
  const pdfBytes = await generateInvoicePdf({
    invoiceNumber,
    issuedAt:       new Date(),
    orderNumber:    order.orderNumber,
    customerName:   order.customerName,
    customerEmail:  order.customerEmail,
    shippingAddress: order.shippingAddress,
    items:          order.items ?? [],
    clientLocation: order.clientLocation,
    shippingCost:   order.shippingCost,
    totalAmount:    order.totalAmount ?? 0,
    seller: {
      name:    seller?.legalName,
      attn:    seller?.legalName,
      street:  seller?.address,
      postal:  [seller?.postalCode, seller?.city].filter(Boolean).join(' '),
      country: seller?.country,
      website: seller?.website,
      iban:    seller?.iban,
      bic:     seller?.bic,
      btw:     seller?.vatNumber,
      kvk:     seller?.kvkNumber,
    },
  })

  // ── Upload PDF to Sanity as file asset ────────────────────────────────────
  const filename = `${invoiceNumber}.pdf`
  const asset = await sanity.assets.upload('file', Buffer.from(pdfBytes), {
    filename,
    contentType: 'application/pdf',
  })

  // ── Patch order with invoice data ─────────────────────────────────────────
  await sanity.patch(order._id).set({
    invoiceNumber,
    invoicePdf: { _type: 'file', asset: { _type: 'reference', _ref: asset._id } },
  }).commit()

  // ── Build and send shipping email ─────────────────────────────────────────
  const { subject, text } = buildShippedEmail({
    orderNumber:     order.orderNumber,
    customerName:    order.customerName,
    trackingNumber:  order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    postalCode:      order.shippingAddress?.postalCode,
  })

  await resend.emails.send({
    from,
    to:      order.customerEmail,
    subject,
    text,
    attachments: [{
      filename,
      content: Buffer.from(pdfBytes).toString('base64'),
    }],
  })

  // ── Mark email sent ───────────────────────────────────────────────────────
  await sanity.patch(order._id).set({ shippingEmailSentAt: new Date().toISOString() }).commit()

  return Response.json({ sent: true, invoiceNumber })
}
