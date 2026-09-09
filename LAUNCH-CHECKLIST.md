# Launch Checklist — mynameissanderdekker.com

Doorloop dit document **vóór elke lancering of grote update**.  
Alles hier is een keer misgegaan. Dat is waarom het op deze lijst staat.

---

## 1. Stripe

- [ ] Inloggen op [dashboard.stripe.com](https://dashboard.stripe.com) → **live-modus** (niet test)
- [ ] **Settings → Payment methods**: controleer welke methoden actief zijn
  - iDEAL ✓ (verplicht voor NL)
  - Bancontact ✓ (BE-klanten)
  - Card (Visa/Mastercard) ✓
  - PayPal — optioneel, maar populair
- [ ] Testbetaling gedaan in **live-modus** met een echte kaart (klein bedrag, daarna refund)
- [ ] Webhook endpoint is actief: `https://www.mynameissanderdekker.com/api/webhooks/stripe`
- [ ] Webhook stuurt minimaal: `checkout.session.completed`, `charge.refunded`
- [ ] `STRIPE_SECRET_KEY` op Vercel is de **live**-sleutel (begint met `sk_live_`, niet `sk_test_`)
- [ ] `STRIPE_WEBHOOK_SECRET` op Vercel klopt bij het live webhook endpoint

---

## 2. Prijzen

- [ ] **Geen prijzen zichtbaar** op artwork-pagina's (`/works/…`) — alleen Enquire of Buy knop
- [ ] Publicaties in de webshop tonen wel prijzen — dat is correct
- [ ] `audit-data` toont geen "te koop in de webshop zonder prijs":
  ```bash
  npx tsx --env-file=.env.local scripts/audit-data.mts
  ```
- [ ] BTW-tarief ingevuld op alle te-koop-items (9% standaard voor boeken/kunst)

---

## 3. Omgevingsvariabelen op Vercel

Controleer via Vercel dashboard → Settings → Environment Variables:

- [ ] `STRIPE_SECRET_KEY` — live sleutel
- [ ] `STRIPE_WEBHOOK_SECRET` — live webhook secret
- [ ] `SANITY_WRITE_TOKEN` — write token (niet de read-only CDN token)
- [ ] `ADMIN_PASSWORD` — ingesteld (zonder dit werkt `/admin` niet)
- [ ] `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile (zonder dit zijn formulieren open)
- [ ] `MAILCHIMP_API_KEY` + `MAILCHIMP_LIST_ID` — nieuwsbrief
- [ ] `SANITY_WEBHOOK_SECRET` — Mailchimp-webhook (zonder dit kan iedereen contacten insturen)
- [ ] `NEXT_PUBLIC_SANITY_PROJECT_ID` + `NEXT_PUBLIC_SANITY_DATASET`

---

## 4. Formulieren en bots

- [ ] Nieuwsbrief in de footer werkt — vul in, check of het adres in Mailchimp aankomt
- [ ] Contactformulier werkt — stuur een testbericht
- [ ] Enquire (werk aanvragen) werkt — open een werkpagina, klik "Enquire"
- [ ] Turnstile-widget is zichtbaar op alle drie de formulieren (het draaiende logo)
- [ ] Testrun draait groen:
  ```bash
  npx tsx --env-file=.env.local scripts/testrun-turnstile.mts
  ```

---

## 5. Webshop — volledige checkout flow

- [ ] Voeg een item toe aan de winkelwagen
- [ ] Ga naar `/cart` — prijs klopt (incl. BTW)
- [ ] Kortingscode werkt (test met een coupon uit Stripe dashboard)
- [ ] Checkout opent Stripe-formulier met de juiste betaalmethoden
- [ ] Na betaling: doorsturen naar `/checkout/success`
- [ ] Order verschijnt in Studio → Webshop orders
- [ ] Voorraad is afgetrokken op het product
- [ ] Bevestigingsmail wordt verstuurd (check inbox + spam)
- [ ] Testrun draait groen:
  ```bash
  npx tsx --env-file=.env.local scripts/testrun-webshop.mts
  ```

---

## 6. Content

- [ ] Alle publicaties die in de shop staan hebben een afbeelding
- [ ] Geen dubbele documenten (artwork én publication voor hetzelfde werk)
- [ ] `audit-data` draait zonder fouten:
  ```bash
  npx tsx --env-file=.env.local scripts/audit-data.mts
  ```
- [ ] Alle artworks die `availableInShop = true` hebben ook een prijs
- [ ] Geen ongepubliceerde drafts die al gelinkt zijn (gele balk in Studio)

---

## 7. Facturen en bedrijfsgegevens

- [ ] Studio → Site Settings → Invoice & business: KVK, IBAN, BTW-nummer en adres ingevuld
- [ ] Zonder die gegevens zijn facturen wettelijk niet geldig

---

## 8. SEO en metadata

- [ ] Open Graph-afbeelding aanwezig (gedeeld via social media ziet er goed uit)
- [ ] `sitemap.xml` is bereikbaar: `https://www.mynameissanderdekker.com/sitemap.xml`
- [ ] Google Search Console: domein geverifieerd en sitemap ingediend

---

## 9. Vóór elke push naar productie

```bash
./scripts/ship.sh "beschrijving van wat je hebt gedaan"
```

Het script controleert automatisch: TypeScript, `audit-theme`, `audit-studio-lists`, `audit-data`, `testrun-print` en `testrun-turnstile`. Gaat er iets rood, dan gaat er niets live.

---

## Bekende valkuilen (uit ervaring)

| Wat | Symptoom | Oplossing |
|-----|----------|-----------|
| Stripe in test-modus | Betalingen werken niet live | Schakel om naar live-modus in dashboard + vercel env |
| iDEAL uitgeschakeld | Klanten zien iDEAL niet | Activeer in Stripe → Settings → Payment methods |
| `TURNSTILE_SECRET_KEY` ontbreekt | Formulieren staan open voor bots | Zet sleutel op Vercel |
| Prijzen zichtbaar op artwork-pagina | Onprofessioneel, klanten zien excl. BTW | Verwijder prijsweergave uit ArtworkDetail |
| Artwork én publication voor hetzelfde werk | Shop toont dubbele items | Verwijder het artwork-document |
| Draft niet gepubliceerd | Afbeelding ontbreekt op site | Publish in Studio (gele balk = draft) |
| Invoice & business leeg | Facturen missen wettelijke gegevens | Invullen in Site Settings |
