import { AddIcon, BasketIcon, DashboardIcon } from '@sanity/icons'
import { DashboardTool } from './components/DashboardTool'
import { makeNewDocumentRedirect } from './components/NewDocumentRedirect'
import { BulkAssignTool } from './components/BulkAssignTool'
import { BulkPublicationsTool } from './components/BulkPublicationsTool'

/**
 * Eén vorm voor "iets nieuws maken", overal hetzelfde: bovenaan de lijst, met
 * een plus-icoon, en een klik opent meteen een leeg formulier. Overgenomen uit
 * de gallery-template, waar dit bij artworks al zo werkte.
 */
function addNewItem(S: StructureBuilder, type: string, label: string) {
  return S.listItem()
    .title(`Add new ${label}`)
    .id(`new-${type}`)
    .icon(AddIcon)
    .child(S.component(makeNewDocumentRedirect(type, label)).title(`New ${label}`))
}
import type { StructureBuilder, StructureResolver } from 'sanity/structure'
import React from 'react'
import { attentionBadge } from './components/AttentionBadge'
import {
  OPEN_ORDER_FILTER, DONE_ORDER_FILTER,
  WEBSHOP_ORDER_FILTER, GALLERY_ORDER_FILTER,
} from '../lib/orderStatus'
import { MailingListExport } from './components/MailingListExport'
import { RegisterSaleTool } from './components/RegisterSaleTool'
import { SalesOverviewTool } from './components/SalesOverviewTool'

function HardcodedPage({ title, url }: { title: string; url: string }) {
  return React.createElement('div', {
    style: { padding: '32px 40px', fontFamily: 'system-ui, sans-serif', color: '#6b7280', fontSize: 14 }
  },
    React.createElement('p', { style: { marginBottom: 8, color: '#101112', fontWeight: 600 } }, title),
    React.createElement('p', { style: { marginBottom: 16 } }, 'This page is hardcoded in the codebase and cannot be edited from Studio.'),
    React.createElement('a', { href: url, target: '_blank', rel: 'noopener noreferrer', style: { color: '#2563eb', textDecoration: 'underline', fontSize: 13 } }, 'Open live page ↗')
  )
}

// Artwork list with category browsing (excludes 'book' category → see Publications)
const PUBLICATION_CATEGORIES = ['book', 'Zine']

type CustomFilter = { _id: string; title: string; status?: string; category?: string; inWebshop?: boolean }

function artworkListItem(S: StructureBuilder, categories: string[], customFilters: CustomFilter[] = []) {
  const artworkCategories = categories.filter(c => !PUBLICATION_CATEGORIES.includes(c))

  const categoryItems = artworkCategories.map((cat) =>
    S.listItem()
      .title(cat)
      .id(`artwork-cat-${cat.toLowerCase().replace(/\s+/g, '-')}`)
      .child(
        S.documentTypeList('artwork')
          .title(cat)
          .filter('_type == "artwork" && category == $cat')
          .params({ cat })
          .defaultOrdering([{ field: 'year', direction: 'desc' }])
      )
  )

  return S.listItem()
    .title('Artworks')
    .id('artwork')
    .child(
      S.list()
        .id('artwork-list')
        .title('Artworks')
        .items([
          addNewItem(S, 'artwork', 'artwork'),

          S.listItem()
            .title('Bulk edit artworks')
            .id('bulk-assign')
            .child(S.component(BulkAssignTool).title('Bulk edit artworks')),

          S.divider(),
          S.listItem()
            .title('All works')
            .id('artwork-all')
            .child(
              S.documentTypeList('artwork')
                .title('All works')
                .filter('_type == "artwork" && !(category in $pubCats)')
                .params({ pubCats: PUBLICATION_CATEGORIES })
                .defaultOrdering([{ field: 'year', direction: 'desc' }])
            ),
          ...(categoryItems.length > 0 ? [S.divider(), ...categoryItems] : []),
          S.divider(),
          S.listItem()
            .title('By project series')
            .id('artwork-by-series')
            .child(() =>
              S.documentTypeList('projectSeries')
                .title('Project series')
                .defaultOrdering([{ field: 'title', direction: 'asc' }])
                .child((seriesId) =>
                  S.documentList()
                    .title('Works in series')
                    .filter('_type == "artwork" && _id in *[_type == "projectSeries" && _id == $seriesId].artworks[]._ref')
                    .params({ seriesId })
                    .defaultOrdering([{ field: 'year', direction: 'desc' }])
                )
            ),
          S.divider(),
          S.listItem()
            .title('Sold works')
            .id('artwork-sold')
            .child(
              S.documentTypeList('artwork')
                .title('Sold works')
                .filter('_type == "artwork" && count(*[_type == "contact" && ^._id in purchases[].artwork._ref]) > 0')
                .defaultOrdering([{ field: 'year', direction: 'desc' }])
            ),
          S.listItem()
            .title('↔ Synced with Torch')
            .id('artwork-synced-torch')
            .child(
              S.documentTypeList('artwork')
                .title('↔ Synced with Torch')
                .filter('_type == "artwork" && defined(torchId)')
                .defaultOrdering([{ field: 'year', direction: 'desc' }])
            ),
          S.divider(),
          S.listItem()
            .title('In webshop')
            .id('artwork-in-webshop')
            .child(
              S.documentTypeList('artwork')
                .title('In webshop')
                .filter('_type == "artwork" && availableInShop == true && !(category in $pubCats)')
                .params({ pubCats: PUBLICATION_CATEGORIES })
                .defaultOrdering([{ field: 'shopFeatured', direction: 'desc' }, { field: 'shopOrder', direction: 'asc' }])
            ),
          ...(customFilters.length > 0 ? [S.divider()] : []),
          ...customFilters.map(f => {
            const parts: string[] = ['_type == "artwork"']
            if (f.status) parts.push(`status == "${f.status}"`)
            if (f.category) parts.push(`category == "${f.category}"`)
            if (f.inWebshop) parts.push('availableInShop == true')
            return S.listItem()
              .title(`★ ${f.title}`)
              .id(f._id)
              .child(
                S.documentTypeList('artwork')
                  .title(f.title)
                  .filter(parts.join(' && '))
                  .defaultOrdering([{ field: 'year', direction: 'desc' }])
              )
          }),
          S.divider(),
          S.listItem()
            .title('+ Manage custom filters')
            .id('manage-filters')
            .child(S.documentTypeList('artworkFilter').title('Custom filters')),
        ])
    )
}

// Publications
function publicationsListItem(S: StructureBuilder) {
  return S.listItem()
    .title('Publications')
    .id('publications')
    .child(
      S.list()
        .id('publications-list')
        .title('Publications')
        .items([
          addNewItem(S, 'publication', 'publication'),

          S.listItem()
            .title('Bulk edit publications')
            .id('bulk-publications')
            .child(S.component(BulkPublicationsTool).title('Bulk edit publications')),

          S.divider(),
          S.listItem()
            .title('All publications')
            .id('publications-all')
            .child(
              S.documentTypeList('publication')
                .title('All publications')
                .defaultOrdering([{ field: 'year', direction: 'desc' }])
            ),
          S.listItem()
            .title('In webshop')
            .id('publications-in-webshop')
            .child(
              S.documentTypeList('publication')
                .title('In webshop')
                .filter('_type == "publication" && availableInShop == true')
                .defaultOrdering([{ field: 'shopFeatured', direction: 'desc' }, { field: 'title', direction: 'asc' }])
            ),
        ])
    )
}

// Contacts with filters
function contactsListItem(S: StructureBuilder) {
  return S.listItem()
    .title('Contacts')
    .id('contact')
    .child(
      S.list()
        .id('contacts-list')
        .title('Contacts')
        .items([
          addNewItem(S, 'contact', 'contact'),
          S.divider(),
          S.listItem()
            .title('All contacts')
            .id('contacts-all')
            .child(
              S.documentTypeList('contact')
                .title('All contacts')
                .defaultOrdering([{ field: 'lastName', direction: 'asc' }])
            ),
          S.divider(),
          S.listItem()
            .title('Collectors')
            .id('contacts-collectors')
            .child(S.documentTypeList('contact').title('Collectors').filter('_type == "contact" && type == "collector"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
          S.listItem()
            .title('Newsletter')
            .id('contacts-newsletter')
            .child(S.documentTypeList('contact').title('Newsletter').filter('_type == "contact" && subscribed == true').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
          S.listItem()
            .title('Galleries & Museums')
            .id('contacts-galleries')
            .child(S.documentTypeList('contact').title('Galleries & Museums').filter('_type == "contact" && type == "gallery"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
          S.listItem()
            .title('Webshop customers')
            .id('contacts-webshop')
            .child(S.documentTypeList('contact').title('Webshop customers').filter('_type == "contact" && type == "webshop_customer"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
          S.divider(),
          // Bovenaan wat actie vraagt: een follow-updatum die bereikt is.
          S.listItem()
            .title('Follow-up')
            .id('contacts-followup')
            .icon(attentionBadge(
              `count(*[_type == "contact" && defined(followUpDate) && followUpDate <= $today])`,
              { color: 'amber', label: 'follow-ups', listenOn: 'contact' }
            ))
            .child(
              S.documentTypeList('contact')
                .title('Follow-up — sorted by date')
                .filter('_type == "contact" && defined(followUpDate)')
                .defaultOrdering([{ field: 'followUpDate', direction: 'asc' }])
            ),
          S.listItem()
            .title('Contact Tags')
            .id('contact-tags')
            .child(S.documentTypeList('contactTag').title('Contact Tags')),
          S.divider(),
          S.listItem()
            .title('Export mailing list')
            .id('contacts-mailing-export')
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .child(S.component(MailingListExport as any).title('Export mailing list')),
          S.divider(),
          S.listItem()
            .title('By country')
            .id('contacts-by-country')
            .child(
              S.list()
                .id('contacts-country-list')
                .title('By country')
                .items([
                  S.listItem().title('Netherlands (NL)').id('contacts-nl').child(S.documentTypeList('contact').title('Netherlands').filter('_type == "contact" && country == "NL"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('Belgium (BE)').id('contacts-be').child(S.documentTypeList('contact').title('Belgium').filter('_type == "contact" && country == "BE"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('Germany (DE)').id('contacts-de').child(S.documentTypeList('contact').title('Germany').filter('_type == "contact" && country == "DE"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('France (FR)').id('contacts-fr').child(S.documentTypeList('contact').title('France').filter('_type == "contact" && country == "FR"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('United Kingdom (GB)').id('contacts-gb').child(S.documentTypeList('contact').title('United Kingdom').filter('_type == "contact" && country == "GB"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('United States (US)').id('contacts-us').child(S.documentTypeList('contact').title('United States').filter('_type == "contact" && country == "US"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('Denmark (DK)').id('contacts-dk').child(S.documentTypeList('contact').title('Denmark').filter('_type == "contact" && country == "DK"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('Austria (AT)').id('contacts-at').child(S.documentTypeList('contact').title('Austria').filter('_type == "contact" && country == "AT"').defaultOrdering([{ field: 'lastName', direction: 'asc' }])),
                  S.listItem().title('Other countries').id('contacts-other').child(S.documentTypeList('contact').title('Other countries').filter('_type == "contact" && !(country in ["NL","BE","DE","FR","GB","US","DK","AT","FI","IT"])').defaultOrdering([{ field: 'country', direction: 'asc' }])),
                ])
            ),
        ])
    )
}

/**
 * Orders splitsen in "vraagt actie" en "klaar".
 *
 * Eén lange lijst waarin een afgeronde verkoop van vorig jaar tussen de
 * openstaande staat, laat je niet zien wat je moet doen. De filters staan in
 * `lib/orderStatus.ts` — nooit een tweede kopie maken.
 */
function orderListItem(S: StructureBuilder) {
  return S.listItem()
    .title('Orders')
    .id('order')
    .icon(attentionBadge(
      `count(*[_type == "order" && ${OPEN_ORDER_FILTER} && ${GALLERY_ORDER_FILTER}])`,
      { label: 'open orders', listenOn: 'order' }
    ))
    .child(
      S.documentList()
        .title('Orders')
        .schemaType('order')
        .filter(`_type == "order" && ${OPEN_ORDER_FILTER} && ${GALLERY_ORDER_FILTER}`)
        .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
    )
}

function orderArchiveListItem(S: StructureBuilder) {
  return S.listItem()
    .title('Archive')
    .id('order-archive')
    .child(
      S.documentList()
        .title('Archive')
        .schemaType('order')
        .filter(`_type == "order" && ${DONE_ORDER_FILTER} && ${GALLERY_ORDER_FILTER}`)
        .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
    )
}

// Order matters here: DocumentTypeListBuilder.clone() re-infers
// initialValueTemplates from the schema on every subsequent chained call, so
// initialValueTemplates([]) must be called LAST, after canHandleIntent() —
// otherwise canHandleIntent()'s own clone() silently resets it back to a
// non-empty (inferred) value and the create button reappears.
const noCreateIntent = () => false
function noCreate<T extends { canHandleIntent(fn: typeof noCreateIntent): T; initialValueTemplates(templates: never[]): T }>(list: T): T {
  return list.canHandleIntent(noCreateIntent).initialValueTemplates([])
}

/**
 * Webshopbestellingen: dezelfde orders, gefilterd op kanaal.
 *
 * Het is bewust een tweede weergave en geen ander documenttype. Een bestelling
 * komt binnen terwijl je slaapt en vraagt inpakken en versturen — een andere
 * reflex dan een verkoop die je zelf vastlegt. Geen aanmaakknop: die orders
 * ontstaan bij het afrekenen, nooit met de hand.
 */
function webshopOrderListItem(S: StructureBuilder) {
  const lijst = (title: string, filter: string) =>
    noCreate(
      S.documentList()
        .title(title)
        .schemaType('order')
        .filter(filter)
        .defaultOrdering([{ field: 'createdAt', direction: 'desc' }])
    )

  return S.listItem()
    .title('Webshop orders')
    .id('webshop-orders')
    // Op `OPEN_ORDER_FILTER`, niet op `awaiting-payment`: een betaalde
    // bestelling die nog verstuurd moet worden vraagt net zo goed actie, en
    // telde in het oude bolletje niet mee.
    .icon(attentionBadge(
      `count(*[_type == "order" && ${WEBSHOP_ORDER_FILTER} && ${OPEN_ORDER_FILTER}])`,
      { label: 'webshopbestellingen', listenOn: 'order' }
    ))
    .child(
      S.list()
        .title('Webshop orders')
        .items([
          S.listItem()
            .title('Nog te doen')
            .id('webshop-orders-open')
            .icon(attentionBadge(
              `count(*[_type == "order" && ${WEBSHOP_ORDER_FILTER} && ${OPEN_ORDER_FILTER}])`,
              { label: 'webshopbestellingen', listenOn: 'order' }
            ))
            .child(lijst(
              'Webshop — te betalen, te versturen of klaar te leggen',
              `_type == "order" && ${WEBSHOP_ORDER_FILTER} && ${OPEN_ORDER_FILTER}`
            )),

          S.listItem()
            .title('Afgehandeld')
            .id('webshop-orders-done')
            .child(lijst(
              'Webshop — afgehandeld',
              `_type == "order" && ${WEBSHOP_ORDER_FILTER} && ${DONE_ORDER_FILTER}`
            )),

          S.listItem()
            .title('Alle bestellingen')
            .id('webshop-orders-all')
            .child(lijst(
              'Webshop — alle bestellingen uit de winkel',
              `_type == "order" && ${WEBSHOP_ORDER_FILTER}`
            )),
        ])
    )
}

// Settings: singleton + shipping zones
function shopSettingsListItem(S: StructureBuilder) {
  return S.listItem()
    .title('Settings')
    .id('shopSettings')
    .child(
      S.list()
        .id('shop-settings-list')
        .title('Settings')
        .items([
          S.listItem()
            .title('Shop Settings')
            .id('shop-settings-singleton')
            .child(S.document().schemaType('shopSettings').documentId('shopSettings').title('Shop Settings')),
          S.listItem()
            .title('Shipping Zones')
            .id('shop-settings-shipping')
            .child(S.documentTypeList('shippingZone').title('Shipping Zones')),
        ])
    )
}

export const structure: StructureResolver = async (S, { getClient }) => {
  const client = getClient({ apiVersion: '2024-01-01' })

  const [categories, cvProjects, customFilters] = await Promise.all([
    client.fetch<string[]>(
      `array::unique(*[_type == "artwork" && defined(category) && category != ""].category) | order(@)`
    ).catch(() => [] as string[]),
    client.fetch<{ title: string }[]>(`*[_type == "projectSeries"]{ title }`)
      .then(series => {
        const titles = series.map(s => s.title.trim())
        return client.fetch<{ _id: string; title: string }[]>(
          `*[_type == "project" && isPage == true && title in $titles && !(_id in path("drafts.**"))] | order(order asc) { _id, title }`,
          { titles }
        )
      })
      .catch(() => [] as { _id: string; title: string }[]),
    client.fetch<{ _id: string; title: string; status?: string; category?: string; inWebshop?: boolean }[]>(
      `*[_type == "artworkFilter"] | order(order asc, title asc) { _id, title, status, category, inWebshop }`
    ).catch(() => [] as { _id: string; title: string; status?: string; category?: string; inWebshop?: boolean }[]),
  ])

  return S.list()
    .title('Content')
    .items([

      S.listItem()
        .title('Dashboard')
        .id('dashboard')
        .icon(DashboardIcon)
        .child(S.component().title('Dashboard').component(DashboardTool)),

      // ── COLLECTION ────────────────────────────────────────────────────────
      // Het werk zelf en waar het is, en meteen bovenaan: hier begint alles.
      // Heette WORKS met LOGISTICS als losse kop ernaast — maar waar een werk
      // ligt is een eigenschap van het werk, geen apart onderwerp.
      S.divider().title('COLLECTION'),

      artworkListItem(S, categories ?? [], customFilters),
      publicationsListItem(S),
      S.documentTypeListItem('projectSeries').title('Project Series'),
      // Press stond onder WEBSITE, maar er is geen perspagina op de site en
      // niets vraagt het type op. Het gaat óver het werk, dus hoort het hier —
      // net als in de gallery-template.
      S.documentTypeListItem('press').title('Press'),
      S.listItem()
        .title('Where is my work?')
        .id('where-is-my-work')
        .child(
          S.list()
            .id('logistics-list')
            .title('Where is my work?')
            .items([
              S.listItem()
                .title('Active loans')
                .id('loans-active')
                .child(
                  S.documentTypeList('loan')
                    .title('Active loans')
                    .filter('_type == "loan" && (!defined(endDate) || endDate >= $today)')
                    .params({ today: new Date().toISOString().slice(0, 10) })
                    .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                ),
              S.listItem()
                .title('All loans')
                .id('loans-all')
                .child(
                  S.documentTypeList('loan')
                    .title('All loans')
                    .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                ),
              S.divider(),
              S.documentTypeListItem('location').title('Manage locations'),
            ])
        ),

      // ── PROGRAMME ─────────────────────────────────────────────────────────
      // Staat hier ná COLLECTION, andersom dan in de gallery-template. Een
      // galerie stelt een programma samen — dat is waar het werk voor gemaakt
      // wordt, dus dat staat daar bovenaan. Voor een kunstenaar is het de
      // uitkomst: waar het werk heeft gehangen. Vandaar eerst het werk.
      S.divider().title('PROGRAMME'),

      S.listItem()
        .title('Exhibitions')
        .id('exhibition')
        .child(
          S.list()
            .id('exhibitions-list')
            .title('Exhibitions')
            .items([
              addNewItem(S, 'exhibition', 'exhibition'),
              S.divider(),
              S.listItem()
                .title('All exhibitions')
                .id('exhibition-all')
                .child(
                  S.documentTypeList('exhibition')
                    .title('All exhibitions')
                    .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                ),
              S.listItem()
                .title('No project linked')
                .id('exhibition-no-project')
                .child(
                  S.documentTypeList('exhibition')
                    .title('No project linked')
                    .filter('_type == "exhibition" && !defined(cvProject)')
                    .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                ),
              S.divider(),
              ...cvProjects.map(p =>
                S.listItem()
                  .title(p.title)
                  .id(`exhibition-project-${p._id}`)
                  .child(
                    S.documentTypeList('exhibition')
                      .title(p.title)
                      .filter('_type == "exhibition" && cvProject._ref == $projectId')
                      .params({ projectId: p._id })
                      .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                  )
              ),
            ])
        ),

      S.listItem()
        .title('Art Fairs')
        .id('artFair')
        .child(
          S.list()
            .id('artfairs-list')
            .title('Art Fairs')
            .items([
              addNewItem(S, 'artFair', 'art fair'),
              S.divider(),
              S.listItem()
                .title('All art fairs')
                .id('artfair-all')
                .child(
                  S.documentTypeList('artFair')
                    .title('All art fairs')
                    .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                ),
              S.listItem()
                .title('No project linked')
                .id('artfair-no-project')
                .child(
                  S.documentTypeList('artFair')
                    .title('No project linked')
                    .filter('_type == "artFair" && !defined(cvProject)')
                    .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                ),
              S.divider(),
              ...cvProjects.map(p =>
                S.listItem()
                  .title(p.title)
                  .id(`artfair-project-${p._id}`)
                  .child(
                    S.documentTypeList('artFair')
                      .title(p.title)
                      .filter('_type == "artFair" && cvProject._ref == $projectId')
                      .params({ projectId: p._id })
                      .defaultOrdering([{ field: 'startDate', direction: 'desc' }])
                  )
              ),
            ])
        ),

      // ── SALES ─────────────────────────────────────────────────────────────
      // In de volgorde waarin een verkoop ontstaat: eerst de handeling, dan
      // prijslijst → offerte → order → afgerond, en pas daarna de cijfers.
      S.divider().title('SALES'),

      S.listItem()
        .title('Make or Register a Sale')
        .id('register-sale')
        .icon(BasketIcon)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .child(S.component(RegisterSaleTool as any).title('Make or Register a Sale')),

      S.documentTypeListItem('privateSale').title('Price Lists'),

      S.listItem()
        .title('Proposals / Offertes')
        .id('proposals')
        .icon(attentionBadge(
          `count(*[_type == "proposal" && status == "sent" && defined(expiryDate) && expiryDate < $today])`,
          { color: 'amber', label: 'expired proposals', listenOn: 'proposal' }
        ))
        .child(
          S.list()
            .id('proposals-list')
            .title('Proposals / Offertes')
            .items([
              addNewItem(S, 'proposal', 'proposal'),
              S.divider(),
              S.listItem()
                .title('All proposals')
                .id('proposals-all')
                .child(S.documentTypeList('proposal').title('All proposals').defaultOrdering([{ field: '_createdAt', direction: 'desc' }])),
              S.divider(),
              S.listItem()
                .title('📤 Sent')
                .id('proposals-sent')
                .child(S.documentList().title('Sent').filter('_type == "proposal" && status == "sent"').defaultOrdering([{ field: '_createdAt', direction: 'desc' }])),
              S.listItem()
                .title('✅ Accepted')
                .id('proposals-accepted')
                .child(S.documentList().title('Accepted').filter('_type == "proposal" && status == "accepted"').defaultOrdering([{ field: '_createdAt', direction: 'desc' }])),
              S.listItem()
                .title('⬜ Drafts')
                .id('proposals-drafts')
                .child(S.documentList().title('Drafts').filter('_type == "proposal" && status == "draft"').defaultOrdering([{ field: '_createdAt', direction: 'desc' }])),
            ])
        ),

      orderListItem(S),
      orderArchiveListItem(S),

      S.listItem()
        .title('Sales Overview')
        .id('sales-overview')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .child(S.component(SalesOverviewTool as any).title('Sales Overview')),

      // ── WEBSHOP ───────────────────────────────────────────────────────────
      S.divider().title('WEBSHOP'),

      // Heet bij Torch ook Shop Layout: het is de indeling van de winkel, niet
      // de winkel zelf.
      S.listItem()
        .title('Shop Layout')
        .id('worksPage')
        .child(S.document().schemaType('worksPage').documentId('worksPage').title('Shop Layout')),

      webshopOrderListItem(S),
      S.documentTypeListItem('coupon').title('Coupons'),
      shopSettingsListItem(S),

      // ── CRM ───────────────────────────────────────────────────────────────
      S.divider().title('CRM'),

      contactsListItem(S),

      // ── WEBSITE ───────────────────────────────────────────────────────────
      // Blijft hier onderaan staan, net als bij Torch. Voor een kunstenaar is
      // de site wel de etalage, maar je opent de Studio om werk of een verkoop
      // in te voeren — niet om een pagina te herschrijven.
      S.divider().title('WEBSITE'),

      S.listItem()
        .title('About & CV')
        .id('aboutAndCv')
        .child(
          S.list()
            .id('about-cv-list')
            .title('About & CV')
            .items([
              S.listItem()
                .title('About')
                .id('aboutPage')
                .child(S.document().schemaType('aboutPage').documentId('aboutPage').title('About')),
              S.listItem()
                .title('CV')
                .id('cvPage')
                .child(S.document().schemaType('cvPage').documentId('cvPage').title('CV')),
            ])
        ),

      S.listItem()
        .title('Projects')
        .id('projectsOverview')
        .child(
          S.list()
            .id('projects-pages-list')
            .title('Projects')
            .items(
              cvProjects.map(p =>
                S.listItem()
                  .title(p.title)
                  .id(`project-page-${p._id}`)
                  .child(
                    S.document()
                      .schemaType('project')
                      .documentId(p._id)
                      .title(p.title)
                  )
              )
            )
        ),

      S.listItem()
        .title('Contact (hardcoded)')
        .id('contactPage')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .child(S.component(() => HardcodedPage({ title: 'Contact', url: 'https://www.mynameissanderdekker.com/contact' }) as any).title('Contact')),

      S.listItem()
        .title('Site Settings')
        .id('siteSettings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings').title('Site Settings')),

    ])
}
