import { defineField, defineType } from 'sanity'
import { ShareArtFairRoomLink } from '../components/ShareRoomLink'
import { subtitleField, openingField } from './opening'

export const artFair = defineType({
  name: 'artFair',
  title: 'Art Fair',
  type: 'document',
  // Begin- en einddatum horen bij elkaar en passen naast elkaar.
  // Zelfde tabbladen als de expositie, zodat de twee naast elkaar te lezen zijn.
  // De betekenis blijft verschillend: een expositie is een verhaal met ruimte,
  // een beurs een etalage — vandaar dat het twee types blijven.
  // Tabbladen in de volgorde waarin je een evenement opzet, en Details in de
  // volgorde waarin de pagina het toont. Homepage staat apart: aankondigen is
  // een andere handeling op een ander moment dan het evenement invoeren.
  groups: [
    { name: 'details',      title: 'Details', default: true },
    { name: 'homepage',     title: 'Homepage' },
    { name: 'artworks',     title: 'Artworks' },
    { name: 'installation', title: 'Photos' },
    { name: 'share',        title: 'Share' },
    { name: 'cv',           title: 'CV' },
  ],
  fieldsets: [
    { name: 'announce', title: ' ', options: { columns: 2, collapsible: false } },
    { name: 'dates', title: ' ', options: { columns: 2, collapsible: false } },
  ],
  fields: [
    // Heette `name` en bevatte het próject ("The Social Media Project"),
    // terwijl de beurs in een apart veld `fair` stond. Het project staat al in
    // `cvProject` — in negen van de tien gevallen was `name` daar een
    // letterlijke kopie van. De titel is nu de beurs, zoals `title` op de
    // expositie en in de gallery-template.
    defineField({
      name: 'title',
      group: 'details',
      title: 'Fair',
      type: 'string',
      description: 'E.g. "Art Rotterdam". Which project you showed there is set under CV.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug',
      group: 'details',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'startDate',
      group: 'details',
      fieldset: 'dates',
      title: 'Start date',
      type: 'date',
    }),
    defineField({
      name: 'endDate',
      group: 'details',
      fieldset: 'dates',
      title: 'End date',
      type: 'date',
    }),
    defineField({
      name: 'location',
      group: 'details',
      title: 'Location',
      type: 'string',
      description: 'E.g. "Rotterdam, NL"',
    }),
    defineField({
      name: 'booth',
      group: 'details',
      title: 'Stand / Booth',
      type: 'string',
      description: 'E.g. "Booth A12" or "Gallery Torch"',
    }),
    defineField({
      name: 'hasPage',
      group: 'details',
      title: 'Has own page',
      description: 'When enabled, this art fair gets a dedicated page and the listing becomes a clickable link.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      // Ontbrak hier, terwijl de expositie en de gallery-template hem wel
      // hebben — en de aankondiging op de homepage hem leest.
      name: 'image',
      group: 'details',
      title: 'Banner Image',
      type: 'image',
      options: { hotspot: true, accept: 'image/*' },
    }),
    subtitleField,
    openingField('fair'),
    defineField({
      // Heette `notes` en was een kaal tekstveld; de expositie en de
      // gallery-template gebruiken hier `description` met opmaak.
      name: 'description',
      group: 'details',
      title: 'Description',
      type: 'array',
      of: [{ type: 'block', styles: [{ title: 'Normal', value: 'normal' }, { title: 'H2', value: 'h2' }] }],
    }),
    defineField({
      name: 'websiteUrl',
      group: 'details',
      title: 'Website URL',
      description: 'Link to the fair or gallery website',
      type: 'url',
    }),
    defineField({
      // Eén richting, net als bij de expositie: je koppelt vanuit het
      // persbericht (`press.exhibitions[]` accepteert ook beurzen). Twee
      // lijsten die je met de hand gelijk moet houden lopen altijd uit elkaar.
      name: 'pressDerived',
      group: 'details',
      title: 'Press',
      description: 'Linked from the press item itself. Open a press article to add or remove.',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      // Zelfde aankondiging als bij de expositie. Een beurs is bij uitstek iets
      // wat je vooraf meldt — hij duurt vier dagen, dus achteraf heeft niemand
      // er meer iets aan.
      name: 'showOnHomepage',
      group: 'homepage',
      title: 'Announce on the homepage',
      type: 'boolean',
      initialValue: false,
      description: 'Shows a pop-up to visitors, once each. Set the period below.',
    }),
    defineField({
      name: 'announceFrom',
      group: 'homepage',
      fieldset: 'announce',
      title: 'Pop-up from',
      type: 'date',
      hidden: ({ document }) => !document?.showOnHomepage,
      description: 'Leave empty to start right away.',
    }),
    defineField({
      name: 'announceUntil',
      group: 'homepage',
      fieldset: 'announce',
      title: 'Pop-up until',
      type: 'date',
      hidden: ({ document }) => !document?.showOnHomepage,
      description: 'Leave empty to keep showing it until you switch it off.',
    }),
    defineField({
      name: 'artworkSeries',
      group: 'artworks',
      title: 'Artworks from series',
      description: 'Select a Series — all works in that series are shown at this fair',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'projectSeries' }], options: { disableNew: true } }],
    }),
    defineField({
      name: 'artworks',
      group: 'artworks',
      title: 'Individual artworks',
      description: 'Add specific works not covered by a series above',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'artwork' }] }],
    }),
    defineField({
      name: 'images',
      group: 'installation',
      title: 'Booth / installation photos',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    }),
    // De expositie had dit veld wel en de beurs niet: je kon de prijslijst van
    // een expositie beveiligen, die van een beurs niet.
    defineField({
      name: 'priceListPassword',
      group: 'share',
      title: 'Price list password',
      type: 'string',
      description: 'If set, the shared price list asks for this password. Leave empty for your own use only.',
    }),
    defineField({
      name: 'shareRoomLink',
      group: 'share',
      title: 'Share with client',
      type: 'string',
      readOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      components: { field: ShareArtFairRoomLink as any },
    }),
    defineField({
      name: 'cvProject',
      group: 'cv',
      title: 'CV — Project',
      type: 'reference',
      to: [{ type: 'project' }],
      options: { disableNew: true },
      description: 'Which project does this art fair belong to? Used to group entries on the CV.',
    }),
    defineField({
      name: 'showInCV',
      group: 'cv',
      title: 'Show in CV',
      type: 'boolean',
      initialValue: false,
      description: 'Include this art fair in the CV on the About page.',
    }),
    // `openingDate` / `openingTime` zijn vervangen door het `opening`-blok
    // (zie ./opening.ts) dat de expositie ook heeft. Bestaande waarden blijven
    // zichtbaar tot ze zijn overgezet; op de pagina vallen ze terug als het
    // nieuwe blok leeg is.
    defineField({
      name: 'openingDate',
      group: 'details',
      title: 'Opening date (old field)',
      type: 'date',
      readOnly: true,
      hidden: ({ document }) => !document?.openingDate,
      description: 'Replaced by "Opening / practical information" below. Copy it there and clear this field.',
    }),
    defineField({
      name: 'openingTime',
      group: 'details',
      title: 'Opening time (old field)',
      type: 'string',
      readOnly: true,
      hidden: ({ document }) => !document?.openingTime,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      location: 'location',
      startDate: 'startDate',
      media: 'images.0',
    },
    prepare({ title, location, startDate, media }) {
      const year = startDate ? new Date(startDate).getFullYear() : '?'
      return {
        title: title ?? '—',
        subtitle: `${location ?? ''} (${year})`,
        media,
      }
    },
  },
})
