import { NextRequest, NextResponse } from 'next/server'
import { isValidAdminCookie } from '@/lib/adminAuth'
import { getSanityWriteClient } from '@/lib/sanityClient'
import { getResendClient } from '@/lib/resend'
import { syncToMailchimp } from '@/lib/mailchimp'
import { markSold } from '@/lib/markSold'
import { createNumberedOrder } from '@/lib/createOrder'
import { vatTreatment, type ClientLocation } from '@/lib/invoiceVat'

const FROM = 'Sander Dekker <hello@mynameissanderdekker.com>'

interface SaleItem {
  artworkId: string
  artworkTitle: string
  artworkYear?: number
  copyNumber: string
  priceExclVAT: number
  vatRate: number
}

export async function POST(req: NextRequest) {
  // Auth check — admin cookie of geldig Sanity-token (Studio)
  const session     = req.cookies.get('admin_session')?.value
  const sanityToken = req.headers.get('x-sanity-token')

  let authorized = isValidAdminCookie(session)

  if (!authorized && sanityToken) {
    try {
      const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
      const check = await fetch(`https://${projectId}.api.sanity.io/v1/users/me`, {
        headers: { Authorization: `Bearer ${sanityToken}` },
      })
      authorized = check.ok
    } catch { /* network error → niet geautoriseerd */ }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    contactId?: string
    firstName: string
    lastName: string
    email: string
    phone?: string
    company?: string
    vatNumber?: string
    street?: string
    postalCode?: string
    city?: string
    country?: string
    items: SaleItem[]
    soldVia: 'direct' | 'gallery' | 'artfair' | 'other'
    saleDate: string
    invoiceNumber: string
    paymentTermsDays?: number
    notes?: string
    sendConfirmation?: boolean
    paid?: boolean
    // Komt de verkoop uit een offerte, dan blijft die koppeling hier bewaard.
    // Zonder dit raakte de offerte los zodra hij verkoop werd: de order wist
    // niet waar hij vandaan kwam, en bij een vraag over "offerte 003" was er
    // niets terug te vinden.
    proposalId?: string
  }

  const sanity = getSanityWriteClient()

  // ── Is het werk nog te verkopen? ──────────────────────────────────────
  // Ontbrak. Een verkocht uniek werk kon nog een keer verkocht worden — twee
  // orders, twee facturen, één werk. Gemeten met scripts/testrun-double-sale.mts
  // in de gallery-template; hier dezelfde route, dus hetzelfde gat. `_rev`
  // gaat mee: de order en het werk worden straks in één transactie
  // geschreven, en alleen als het werk sinds dit moment niet is veranderd.
  const werken = await sanity.fetch<{
    _id: string; _rev: string; _type: string; title?: string; status?: string
    editionType?: string; editionTotal?: number; stock?: number
  }[]>(
    `*[_id in $ids]{ _id, _rev, _type, title, status, editionType, editionTotal, stock }`,
    { ids: body.items.map((i) => i.artworkId) }
  )
  const revVan = new Map(werken.map((w) => [w._id, w._rev]))
  for (const item of body.items) {
    const w = werken.find((x) => x._id === item.artworkId)
    if (!w) return NextResponse.json({ error: `Werk ${item.artworkId} bestaat niet (meer).` }, { status: 409 })
    const isEdition = w._type === 'publication' || (w.editionType === 'edition' && (w.editionTotal ?? 0) > 1)
    if (isEdition) {
      if ((w.stock ?? w.editionTotal ?? 1) < 1 || w.status === 'sold') {
        return NextResponse.json({ error: `"${w.title ?? w._id}" is uitverkocht.` }, { status: 409 })
      }
    } else if (w.status === 'sold' || w.status === 'sold_out') {
      return NextResponse.json({ error: `"${w.title ?? w._id}" is al verkocht.` }, { status: 409 })
    }
  }

  // ── Contact aanmaken of bijwerken ─────────────────────────────────────
  let contactId: string

  if (body.contactId) {
    await sanity.patch(body.contactId)
      .setIfMissing({ type: 'collector' })
      .set({
        ...(body.company    ? { company: body.company }       : {}),
        ...(body.vatNumber  ? { vatNumber: body.vatNumber }   : {}),
        ...(body.street     ? { street: body.street }         : {}),
        ...(body.postalCode ? { postalCode: body.postalCode } : {}),
        ...(body.city       ? { city: body.city }             : {}),
        ...(body.country    ? { country: body.country }       : {}),
      })
      .commit()
    contactId = body.contactId
  } else {
    // Gepubliceerd vóór concept: een contact dat nog niet gepubliceerd is
    // bestaat alleen als drafts.<id>; een order die daarnaar verwijst wijst
    // naar niets zodra het contact wél gepubliceerd wordt (factuur zonder
    // naam en adres — Torch, 7 sept 2026). Een concept publiceren we eerst.
    const gevonden = await sanity.fetch<{ _id: string }[]>(
      `*[_type == "contact" && email == $email]{ _id }`,
      { email: body.email }
    )
    const existing = gevonden.find((c) => !c._id.startsWith('drafts.')) ?? gevonden[0] ?? null
    if (existing?._id.startsWith('drafts.')) {
      const draft = await sanity.getDocument(existing._id)
      const publicId = existing._id.replace(/^drafts\./, '')
      if (draft) {
        await sanity.transaction().createOrReplace({ ...draft, _id: publicId }).delete(existing._id).commit()
      }
      contactId = publicId
    } else if (existing) {
      contactId = existing._id
    } else {
      const created = await sanity.create({
        _type:      'contact',
        firstName:  body.firstName,
        lastName:   body.lastName,
        email:      body.email,
        phone:      body.phone || undefined,
        company:    body.company || undefined,
        vatNumber:  body.vatNumber || undefined,
        street:     body.street || undefined,
        postalCode: body.postalCode || undefined,
        city:       body.city || undefined,
        country:    body.country || undefined,
        type:       'collector',
        source:     `manual sale — ${body.invoiceNumber}`,
        // Standaard aan, zoals in de Studio: je voert dit contact zelf in.
        subscribed: true,
        subscribedAt: new Date().toISOString(),
      })
      contactId = created._id
    }
  }

  // ── Order document aanmaken ───────────────────────────────────────────
  // Op centen afronden. Zonder dit belandt er drijvende-komma-ruis in een
  // boekhoudbedrag — €3000 excl. plus 9% werd €3270.0000000000005 — en die
  // ruis telt door in de omzet- en BTW-overzichten.
  const cent = (n: number) => Math.round(n * 100) / 100

  // Het tarief hangt af van waar de klant zit — EU verlegd, export 0%. De
  // factuur wist dat al; dit totaal rekende met het tarief van het werk en
  // zette op een Duitse order het Nederlandse bedrag.
  const clientLocation = await sanity.fetch<string | null>(`*[_id == $id][0].clientLocation`, { id: contactId })
  const vatRule = vatTreatment(clientLocation as ClientLocation)
  const totalIncl = cent(body.items.reduce((sum, i) => sum + i.priceExclVAT * (1 + vatRule.rate(i.vatRate) / 100), 0))
  const totalExcl = cent(body.items.reduce((sum, i) => sum + i.priceExclVAT, 0))

  // Order en werk in één transactie, met revisiecontrole op het werk en een
  // order-id dat het nummer uniek maakt. Het nummer uit de tool is een
  // voorkeur: twee open tools hebben allebei hetzelfde "volgende" nummer
  // opgehaald, en de tweede krijgt hier dan een vers nummer. Zie
  // src/lib/createOrder.ts.
  let orderNumber: string
  try {
    const aangemaakt = await createNumberedOrder(sanity, () => ({
    // De koper erbij. Ontbrak dit, dan bleef "Bill to" op de factuur leeg —
    // die leest uit `contact->`, niet uit de losse klantvelden hieronder — en
    // was er vanaf het contact geen weg terug naar de order.
    contact:       { _type: 'reference', _ref: contactId },
    ...(body.proposalId ? { proposal: { _type: 'reference', _ref: body.proposalId } } : {}),
    // Betaald of niet — de levering is een aparte vraag (fulfilment) en wordt
    // in de Studio gezet. Eerder stond hier 'delivered' om betaald te bedoelen.
    status:        body.paid ? 'paid' : 'awaiting-payment',
    channel:       'direct',
    customerName:  `${body.firstName} ${body.lastName}`,
    customerEmail: body.email,
    customerPhone: body.phone || undefined,
    companyName:   body.company || undefined,
    vatNumber:     body.vatNumber || undefined,
    shippingAddress: (body.street || body.city) ? {
      street:     body.street || '',
      postalCode: body.postalCode || '',
      city:       body.city || '',
      country:    body.country || '',
    } : undefined,
    items: body.items.map(item => ({
      _key:      crypto.randomUUID(),
      // Verwijzing naar het werk en het nettobedrag: zonder de eerste wist de
      // order niet wat er verkocht was, zonder de tweede viel de regel in de
      // BTW-aangifte terug op een benadering.
      item:      { _type: 'reference', _ref: item.artworkId },
      title:     `${item.artworkTitle}${item.artworkYear ? ` (${item.artworkYear})` : ''}${item.copyNumber ? ` — ${item.copyNumber}` : ''}`,
      quantity:  1,
      price:     cent(item.priceExclVAT * (1 + vatRule.rate(item.vatRate) / 100)),
      priceExcl: cent(item.priceExclVAT),
      vatRate:   item.vatRate,
    })),
    totalAmount: totalIncl,
    totalExcl,
    createdAt:   new Date().toISOString(),
    statusHistory: [{
      _key:      crypto.randomUUID(),
      _type:     'statusHistoryEntry',
      status:    body.paid ? 'paid' : 'awaiting-payment',
      changedAt: new Date().toISOString(),
      changedBy: 'admin',
      note:      `Handmatige verkoop — ${body.soldVia}`,
    }],
    }), {
      preferredNumber: body.invoiceNumber,
      numberOpts: { fallbackPrefix: 'SDK' },
      // Het verkochte werk bijwerken — in dezelfde transactie. Eerder stond
      // dit los ná de order en was een fout "niet fataal"; nu is er zonder
      // bijgewerkt werk ook geen order.
      addToTx: async (tx) => {
        for (const item of body.items) {
          await markSold(sanity, item.artworkId, 1, undefined, { tx, ifRevisionId: revVan.get(item.artworkId) })
        }
      },
    })
    orderNumber = aangemaakt.orderNumber
  } catch (err) {
    const msg = String((err as Error).message)
    if (/zojuist door iemand anders/.test(msg)) return NextResponse.json({ error: msg }, { status: 409 })
    throw err
  }

  // ── Purchases toevoegen aan contact (één per item) ────────────────────
  // Pas ná de order: dan staat het werkelijke factuurnummer erbij, en laat
  // een geweigerde verkoop geen spoor achter in het CRM.
  const purchaseEntries = body.items.map(item => ({
    _key:          crypto.randomUUID(),
    artwork:       { _type: 'reference', _ref: item.artworkId },
    copyNumber:    item.copyNumber || undefined,
    soldVia:       body.soldVia,
    editionNumber: orderNumber,
    date:          body.saleDate,
    price:         item.priceExclVAT,
  }))

  await sanity.patch(contactId)
    .setIfMissing({ purchases: [] })
    .append('purchases', purchaseEntries)
    .commit()

  // ── Mailchimp sync ─────────────────────────────────────────────────────
  try {
    await syncToMailchimp({
      email:      body.email,
      firstName:  body.firstName,
      lastName:   body.lastName,
      type:       'collector',
      country:    body.country,
      subscribed: true,
    })
  } catch { /* non-critical */ }

  // ── Bevestigingsmail naar koper ───────────────────────────────────────
  if (body.sendConfirmation && body.email && process.env.RESEND_API_KEY) {
    const resend = getResendClient()
    const dueDate = new Date(body.saleDate)
    dueDate.setDate(dueDate.getDate() + (body.paymentTermsDays ?? 14))
    const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const dateStr    = new Date(body.saleDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    const itemRows = body.items.map(item => {
      const incl = item.priceExclVAT * (1 + item.vatRate / 100)
      const vat  = incl - item.priceExclVAT
      return `
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:8px 0">
            ${item.artworkTitle}${item.artworkYear ? `, ${item.artworkYear}` : ''}
            ${item.copyNumber ? `<br><span style="color:#888;font-size:12px">${item.copyNumber}</span>` : ''}
          </td>
          <td style="padding:8px 0;text-align:right;vertical-align:top">€${item.priceExclVAT.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee">
          <td style="padding:4px 0;color:#888;font-size:12px">BTW ${item.vatRate}%</td>
          <td style="padding:4px 0;text-align:right;font-size:12px;color:#888">€${vat.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
        </tr>
      `
    }).join('')

    await resend.emails.send({
      from: FROM,
      to:   body.email,
      subject: body.paid
        ? `Thank you for your purchase — ${orderNumber}`
        : `Invoice ${orderNumber} — Sander Dekker`,
      html: `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;font-size:15px;line-height:1.6">
          <p>Dear ${body.firstName},</p>
          <p>${body.paid ? 'Thank you for your purchase. Here is a summary of your order.' : 'Thank you. Please find your invoice details below.'}</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
            <tr style="border-bottom:1px solid #eee">
              <td style="padding:8px 0;color:#666">${body.paid ? 'Order number' : 'Invoice number'}</td>
              <td style="padding:8px 0;text-align:right">${orderNumber}</td>
            </tr>
            <tr style="border-bottom:2px solid #111">
              <td style="padding:8px 0;color:#666">Date</td>
              <td style="padding:8px 0;text-align:right">${dateStr}</td>
            </tr>
            ${itemRows}
            <tr>
              <td style="padding:12px 0;font-weight:bold">Total incl. BTW</td>
              <td style="padding:12px 0;text-align:right;font-weight:bold">€${totalIncl.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</td>
            </tr>
          </table>
          ${body.notes ? `<p style="color:#555;font-size:13px;font-style:italic">${body.notes}</p>` : ''}
          ${body.paid ? '' : `<p style="font-size:13px;color:#666">Payment due by ${dueDateStr}.</p>`}
          <p>Kind regards,<br>Sander Dekker</p>
          <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
          <p style="font-size:11px;color:#aaa">Sander Dekker · hello@mynameissanderdekker.com · mynameissanderdekker.com</p>
        </div>
      `,
    }).catch(console.error)
  }

  // ── Notificatie naar Sander ───────────────────────────────────────────
  if (process.env.RESEND_API_KEY) {
    const resend = getResendClient()
    const itemList = body.items.map(i => `${i.artworkTitle}${i.copyNumber ? ` — ${i.copyNumber}` : ''} · €${i.priceExclVAT.toLocaleString('nl-NL')}`).join('<br>')
    await resend.emails.send({
      from: FROM,
      to:   'hello@mynameissanderdekker.com',
      subject: `${body.paid ? 'Sale registered' : 'Invoice created'} — ${orderNumber}`,
      html: `
        <p><strong>${body.paid ? 'Manual sale registered (paid)' : 'Invoice created (awaiting payment)'}</strong></p>
        <p>${itemList}</p>
        <p>Buyer: ${body.firstName} ${body.lastName} (${body.email})</p>
        <p>Total excl. BTW: €${totalExcl.toLocaleString('nl-NL')} · Total incl.: €${totalIncl.toLocaleString('nl-NL')}</p>
        <p>Invoice: ${orderNumber} · via ${body.soldVia}</p>
      `,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true, contactId, invoiceNumber: orderNumber })
}
