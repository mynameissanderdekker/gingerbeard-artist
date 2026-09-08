import { defineField, defineType } from 'sanity'
import { CompactDimensions } from '../components/CompactDimensions'
import { CategoryInput } from '../components/CategoryInput'
import { ArtworkQRCode } from '../components/ArtworkQRCode'

export const publication = defineType({
  // Een zine is geen eigen soort ding: het is een publicatie met de categorie
  // 'Zine', naast Book, Poster en Bag. Het type heette hier nog `zine` uit de
  // tijd dat er alleen zines waren.
  name: 'publication',
  title: 'Publication',
  type: 'document',
  orderings: [
    { title: 'Number (asc)', name: 'numberAsc', by: [{ field: 'order', direction: 'asc' }] },
  ],
  groups: [
    // Zelfde tabnamen als publication in de gallery-template, zodat je in
    // beide Studio's op dezelfde plek zoekt.
    { name: 'basis',   title: 'Basics', default: true },
    { name: 'details', title: 'Details' },
    { name: 'webshop', title: 'Webshop' },
  ],
  preview: {
    select: { title: 'title', number: 'number', media: 'images.0' },
    prepare({ title, number, media }) {
      return { title: [number, title].filter(Boolean).join(' — '), media }
    },
  },
  fields: [
    // ── Basics ────────────────────────────────────────────────────────────────
    defineField({
      name: 'number',
      title: 'Number',
      description: 'E.g. Nº2',
      type: 'string',
      group: 'basis',
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'basis',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug (URL)',
      type: 'slug',
      description: 'URL slug for the shop page (auto-generated from title)',
      group: 'basis',
      options: { source: 'title' },
    }),
    defineField({
      // Heet `publicationCategory` en niet `category`: dat laatste is bij het
      // artwork in gebruik voor iets anders, en de gallery-template maakt
      // datzelfde onderscheid.
      name: 'publicationCategory',
      title: 'Category',
      type: 'string',
      description: 'Book, Zine, Poster, Bag — places it in a shop section',
      group: 'basis',
      components: { input: CategoryInput },
    }),
    defineField({
      name: 'year',
      title: 'Year',
      type: 'number',
      group: 'basis',
    }),
    defineField({
      name: 'meta',
      title: 'Meta',
      description: 'E.g. September 2022 · Edition of 35',
      type: 'string',
      group: 'basis',
    }),
    defineField({
      name: 'dimensions',
      title: 'Dimensions (cm)',
      type: 'object',
      group: 'basis',
      components: { input: CompactDimensions },
      fields: [
        defineField({ name: 'widthCm',  title: 'Width',  type: 'number' }),
        defineField({ name: 'heightCm', title: 'Height', type: 'number' }),
        defineField({ name: 'depthCm',  title: 'Depth',  type: 'number' }),
      ],
    }),
    defineField({
      name: 'qrCode',
      title: 'QR Code',
      type: 'string',
      group: 'basis',
      readOnly: true,
      components: { field: ArtworkQRCode },
    }),
    defineField({
      name: 'weightKg',
      title: 'Weight (kg)',
      type: 'number',
      group: 'basis',
      description: 'Used for shipping cost calculation',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 4,
      group: 'basis',
    }),
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      group: 'basis',
      of: [{ type: 'image', options: { hotspot: true } }],
      description: 'First image = main photo',
    }),
    defineField({
      name: 'projectSlug',
      title: 'Links to project',
      description: 'Slug of the project page this publication links to (e.g. girls-in-paris). Leave empty if no project page exists.',
      type: 'string',
      group: 'basis',
    }),

    // ── Details ───────────────────────────────────────────────────────────────
    defineField({
      name: 'editionTotal',
      title: 'Edition total',
      type: 'number',
      group: 'details',
      description: 'E.g. 35 (for an edition of 35)',
    }),
    // Incl. BTW, zoals op het artwork en op de shopvarianten hieronder. Het
    // basisveld stond op excl. terwijl de varianten al incl. rekenden — een
    // boek en zijn gesigneerde uitvoering rekenden dus verschillend.
    defineField({
      name: 'priceIncVat',
      title: 'Price (incl. BTW)',
      type: 'number',
      group: 'basis',
    }),
    defineField({
      name: 'vatRate',
      title: 'BTW rate',
      type: 'string',
      group: 'basis',
      initialValue: '9',
      options: {
        list: [
          { title: '9%', value: '9' },
          { title: '21%', value: '21' },
          { title: '0% (export)', value: '0' },
        ],
      },
    }),
    defineField({
      name: 'priceExclVAT',
      title: 'Price excl. BTW [legacy — do not use]',
      type: 'number',
      group: 'details',
      hidden: true,
    }),

    // ── Boekgegevens ─────────────────────────────────────────────────────────
    defineField({ name: 'isbn', title: 'ISBN', type: 'string', group: 'details', description: 'E.g. 978-90-123456-7-8' }),
    defineField({ name: 'pageCount', title: 'Pages', type: 'number', group: 'details' }),
    defineField({ name: 'publisher', title: 'Published by', type: 'string', group: 'details' }),
    defineField({ name: 'publicationCode', title: 'Publication code', type: 'string', group: 'details', description: 'Internal reference, e.g. for storage' }),
    defineField({
      name: 'shopVariants',
      title: 'Shop variants',
      type: 'array',
      group: 'details',
      description: 'Extra cards in the shop listing — each variant shows alongside the standard card with its own badge, price and buy link.',
      of: [
        defineField({
          name: 'shopVariant',
          title: 'Variant',
          type: 'object',
          fieldsets: [
            { name: 'pricing', title: 'Price', options: { columns: 2 } },
            { name: 'sale', title: 'Sale', options: { columns: 2 } },
          ],
          fields: [
            defineField({
              name: 'badge',
              title: 'Type',
              type: 'string',
              // Vrij tekstveld, geen keuzelijst: een keuzelijst sluit een
              // genummerde uitvoering uit ("Special Edition Box 1"), en juist
              // die komt in de praktijk voor. De site herkent de drie bekende
              // waarden ook als voorvoegsel.
              description: 'Shown as a badge on the listing card. Use predefined values or enter a custom label (e.g. "Special Edition Box 1").',
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'status',
              title: 'Status',
              type: 'string',
              initialValue: 'available',
              options: {
                list: [
                  { title: 'Available', value: 'available' },
                  { title: 'Sold out', value: 'sold_out' },
                ],
                layout: 'radio',
                direction: 'horizontal',
              },
            }),
            // Incl. BTW, net als in de gallery-template. Er stond hier excl.,
            // wat betekende dat de site elke variantprijs eerst moest omrekenen
            // — één bedrag in twee vormen, en de kans op afrondingsverschil.
            defineField({
              name: 'priceIncVat',
              title: 'Price (incl. BTW)',
              type: 'number',
              fieldset: 'pricing',
            }),
            defineField({
              name: 'stock',
              title: 'Stock',
              type: 'number',
              fieldset: 'pricing',
            }),
            defineField({
              name: 'editionTotal',
              title: 'Edition total',
              type: 'number',
            }),
            defineField({
              name: 'onSale',
              title: 'On sale',
              type: 'boolean',
              initialValue: false,
              fieldset: 'sale',
            }),
            defineField({
              name: 'salePrice',
              title: 'Sale price (incl. BTW)',
              type: 'number',
              fieldset: 'sale',
            }),
            defineField({
              name: 'images',
              title: 'Own photos (optional)',
              type: 'array',
              description: 'Upload if this variant has its own cover image. Leave empty to use the main cover image.',
              of: [{ type: 'image', options: { hotspot: true } }],
            }),
            defineField({
              name: 'description',
              title: 'Description',
              type: 'array',
              description: 'Variant-specific description shown on the product page when this variant is selected.',
              of: [{ type: 'block' }],
            }),
            defineField({
              name: 'buyUrl',
              title: 'Buy link',
              type: 'url',
              description: 'Direct payment link for this variant',
            }),
            defineField({
              name: 'note',
              title: 'Note',
              type: 'string',
              description: 'Shown below the title, e.g. "Signed and numbered by the artist"',
            }),
          ],
          preview: {
            select: { badge: 'badge', price: 'priceIncVat', onSale: 'onSale', salePrice: 'salePrice', status: 'status' },
            prepare({ badge, price, onSale, salePrice, status }) {
              const displayPrice = onSale && salePrice != null ? `€${salePrice} (sale)` : price != null ? `€${price}` : null
              return {
                title: badge ?? '—',
                subtitle: [status, displayPrice].filter(Boolean).join(' · '),
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'options',
      title: 'Purchase options (variants)',
      type: 'array',
      group: 'details',
      description: 'Optional — use when this publication is sold in multiple variants, each with its own price. When set, these replace the single price above on the site and the buyer picks one before buying.',
      of: [
        defineField({
          name: 'publicationOption',
          title: 'Option',
          type: 'object',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'sku',
              title: 'SKU / code',
              type: 'string',
            }),
            defineField({
              name: 'priceExclVAT',
              title: 'Price (excl. BTW)',
              type: 'number',
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'buyUrl',
              title: 'Buy link (optional override)',
              type: 'url',
              description: 'Leave empty to use the main buy link',
            }),
          ],
          preview: {
            select: { label: 'label', price: 'priceExclVAT', sku: 'sku' },
            prepare({ label, price, sku }) {
              return {
                title: label ?? '—',
                subtitle: [sku, price != null ? `€${price}` : null].filter(Boolean).join(' — '),
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'details',
      initialValue: 'available',
      options: {
        list: [
          { title: 'Available', value: 'available' },
          { title: 'Sold out', value: 'sold_out' },
          { title: 'Coming soon', value: 'coming_soon' },
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
    }),

    // ── Webshop ───────────────────────────────────────────────────────────────
    defineField({
      name: 'availableInShop',
      title: 'Sell in webshop',
      type: 'boolean',
      group: 'webshop',
      description: 'On = "Buy" button (shopping cart). Off = "Enquire" button (contact form).',
      initialValue: false,
    }),
    defineField({
      name: 'shopFeatured',
      title: 'Featured (in webshop)',
      description: 'Show in the featured grid at the top',
      type: 'boolean',
      group: 'webshop',
      initialValue: false,
    }),
    // Deze vijf had het artwork wel en de publicatie niet — terwijl een boek
    // juist het type is met voorraad en verzendkosten.
    defineField({
      name: 'onSale', title: 'On sale', type: 'boolean', group: 'webshop', initialValue: false,
      hidden: ({ document }) => !document?.availableInShop,
    }),
    defineField({
      name: 'salePrice', title: 'Sale price (incl. BTW)', type: 'number', group: 'webshop',
      hidden: ({ document }) => !document?.availableInShop || !document?.onSale,
    }),
    defineField({
      name: 'stock', title: 'Stock', type: 'number', group: 'webshop', initialValue: 1,
      description: 'Quantity available for purchase in the webshop',
      hidden: ({ document }) => !document?.availableInShop,
    }),
    defineField({
      name: 'shippingNote', title: 'Shipping note', type: 'string', group: 'webshop',
      description: 'E.g. "Ships within 5 business days"',
      hidden: ({ document }) => !document?.availableInShop,
    }),
    defineField({
      name: 'shippingClass', title: 'Shipping class', type: 'reference', group: 'webshop',
      to: [{ type: 'shippingClass' }],
      description: 'Determines the shipping rate for this item in the webshop',
      hidden: ({ document }) => !document?.availableInShop,
    }),
    defineField({
      name: 'buyUrl',
      title: 'Buy link',
      type: 'url',
      group: 'webshop',
      description: 'Direct payment link — shown as "Buy" button when status is "Available"',
    }),
  ],
})
