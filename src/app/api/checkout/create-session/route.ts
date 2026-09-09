import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe'
import { getSanityReadClient } from '@/lib/sanityClient'
import { priceCart, applyCoupon, CheckoutError } from '@/lib/checkoutPricing'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

export async function POST(req: NextRequest) {
  try {
    const { items: cart, coupon: couponIn } = await req.json() as {
      items: { id: string; quantity?: number }[]
      coupon?: { code?: string } | null
    }

    if (!cart?.length) {
      return NextResponse.json({ error: 'Geen producten' }, { status: 400 })
    }

    // Prijs, voorraad en kortingscode komen van de server — zie
    // lib/checkoutPricing.ts voor waarom. De browser zegt alleen wát en hoeveel.
    const sanity = getSanityReadClient()
    const items = await priceCart(sanity, cart)
    const subtotal = items.reduce((s, i) => s + i.priceIncl * i.quantity, 0)
    const coupon = await applyCoupon(sanity, couponIn?.code, subtotal)

    const stripe = getStripeClient()

    let stripeCouponId: string | undefined
    if (coupon && coupon.discountAmount > 0) {
      const stripeCoupon = await stripe.coupons.create({
        name: `Coupon ${coupon.code}`,
        ...(coupon.type === 'percentage'
          ? { percent_off: coupon.value }
          : { amount_off: Math.round(coupon.discountAmount * 100), currency: 'eur' }),
        duration: 'once',
        metadata: { code: coupon.code, sanityId: coupon.sanityId ?? '' },
      })
      stripeCouponId = stripeCoupon.id
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await (stripe.checkout.sessions.create as any)({
      mode: 'payment',
      automatic_payment_methods: { enabled: true },
      line_items: items.map((item) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: item.title,
            ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
          },
          unit_amount: Math.round(item.priceIncl * 100), // in centen, serverprijs
        },
        quantity: item.quantity,
      })),
      phone_number_collection: { enabled: true },
      shipping_address_collection: {
        allowed_countries: ['NL', 'BE', 'DE', 'FR', 'GB', 'US', 'AT', 'DK', 'IT', 'ES', 'PT', 'SE', 'NO', 'CH'],
      },
      billing_address_collection: 'auto',
      // Use our own coupon OR allow Stripe promo codes (not both)
      ...(stripeCouponId
        ? { discounts: [{ coupon: stripeCouponId }] }
        : { allow_promotion_codes: true }),
      custom_fields: [
        {
          key: 'company_name',
          label: { type: 'custom', custom: 'Company name' },
          type: 'text',
          optional: true,
        },
        {
          key: 'vat_number',
          label: { type: 'custom', custom: 'BTW number' },
          type: 'text',
          optional: true,
        },
      ],
      customer_email: undefined,
      success_url: `${BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/cart`,
      metadata: {
        items: JSON.stringify(items.map((i) => i.title)),
        itemsJson: JSON.stringify(items.map((i) => ({
          title:     i.title,
          price:     i.priceIncl,
          priceExcl: i.priceExcl,
          vatRate:   i.vatRate,
          quantity:  i.quantity,
          artworkId: i.artworkId,
          ...(i.variantLabel ? { variant: i.variantLabel } : {}),
        }))),
        // Soort, waarde én bedrag van de korting mee, niet alleen de code: de
        // webhook moet de korting op de order kunnen vastleggen. Stripe trok
        // hem wel van het betaalbedrag af, maar het orderdocument wist er
        // niets van — de regels telden dan op tot méér dan er betaald was.
        ...(coupon ? {
          couponCode: coupon.code,
          couponSanityId: coupon.sanityId,
          couponType: coupon.type,
          couponValue: String(coupon.value),
          couponAmount: String(coupon.discountAmount),
        } : {}),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    console.error('Stripe error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sessie aanmaken mislukt' },
      { status: 500 }
    )
  }
}
