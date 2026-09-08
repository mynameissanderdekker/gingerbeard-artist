import { defineField, defineType } from 'sanity'
import { ShareExhibitionRoomLink } from '../components/ShareRoomLink'
import { ExhibitionArtworkPicker } from '../components/ExhibitionArtworkPicker'
import { VenuePicker } from '../components/VenuePicker'
import { subtitleField, openingField } from './opening'

export const exhibition = defineType({
  name: 'exhibition',
  title: 'Exhibition',
  type: 'document',
  orderings: [
    {
      title: 'Year (newest first)',
      name: 'startDateDesc',
      by: [{ field: 'startDate', direction: 'desc' }],
    },
    {
      title: 'Year (oldest first)',
      name: 'startDateAsc',
      by: [{ field: 'startDate', direction: 'asc' }],
    },
  ],
  // Tabbladen gelijk aan de gallery-template: eerst de expositie opzetten, dan
  // werken koppelen, foto's toevoegen, en delen. CV staat apart omdat dat bij
  // een kunstenaar een eigen doel dient — het voedt je cv-pagina.
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
  // Begin- en einddatum horen bij elkaar en passen naast elkaar.
  fieldsets: [
    { name: 'dates',    title: ' ', options: { columns: 2, collapsible: false } },
    { name: 'announce', title: ' ', options: { columns: 2, collapsible: false } },
  ],
  fields: [
    defineField({
      name: 'title',
      group: 'details',
      title: 'Title',
      type: 'string',
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
      name: 'exhibitionType',
      group: 'details',
      title: 'Exhibition type',
      type: 'string',
      options: {
        list: [
          { title: 'Solo exhibition', value: 'solo' },
          { title: 'Duo exhibition', value: 'duo' },
          { title: 'Group exhibition', value: 'group' },
          { title: 'Permanent installation', value: 'permanent' },
          { title: 'Special project', value: 'special' },
        ],
        layout: 'dropdown',
      },
    }),
    defineField({
      // Kiest uit de galeries waar je mee werkt (contacten met het vinkje) en je
      // eigen studio. Blijft leeg als het ergens eenmaligs is — dan de
      // schakelaar hieronder.
      name: 'venueSpace',
      group: 'details',
      title: 'Where does it take place?',
      type: 'string',
      components: { input: VenuePicker },
      hidden: ({ document }) => !!document?.venueElsewhere,
    }),
    defineField({
      name: 'venueElsewhere',
      group: 'details',
      title: 'Somewhere else',
      type: 'boolean',
      initialValue: false,
      description: 'A one-off venue — a museum, a project space, a fair stand.',
    }),
    defineField({
      name: 'venue',
      group: 'details',
      title: 'Venue',
      type: 'object',
      options: { collapsible: false },
      hidden: ({ document }) => !document?.venueElsewhere && !(document?.venue as any)?.name,
      fields: [
        { name: 'name',       title: 'Venue name',      type: 'string' },
        { name: 'street',     title: 'Street + number', type: 'string' },
        { name: 'postalCode', title: 'Postal code',     type: 'string' },
        { name: 'city',       title: 'City',            type: 'string' },
        { name: 'country',    title: 'Country',         type: 'string' },
      ],
    }),
    defineField({
      name: 'hasPage',
      group: 'details',
      title: 'Has own page',
      description: 'When enabled, this exhibition gets a dedicated page and the listing becomes a clickable link.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'image',
      group: 'details',
      title: 'Banner Image',
      type: 'image',
      options: { hotspot: true, accept: 'image/*' },
    }),
    // Ondertitel en opening-blok — zie ./opening.ts.
    subtitleField,
    openingField('exhibition'),
    defineField({
      name: 'description',
      group: 'details',
      title: 'Description',
      type: 'array',
      of: [{ type: 'block', styles: [{ title: 'Normal', value: 'normal' }, { title: 'H2', value: 'h2' }] }],
    }),
    defineField({
      // Alleen-lezen: je koppelt vanuit het persbericht ("Related exhibitions"),
      // niet van twee kanten. Dat stond hier eerder wel, met de instructie om
      // beide lijsten gelijk te houden — een belofte die niemand nakomt.
      name: 'pressDerived',
      group: 'details',
      title: 'Press',
      description: 'Linked from the press item itself. Open a press article to add or remove.',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      // Zelfde veldnaam als in de gallery-template, andere vorm op de site:
      // daar een slider, hier een aankondiging. Standaard uit, omdat exposities
      // hier historie zijn — bijna geen enkele heeft een einddatum, dus
      // 'loopt nu' zegt niets en moet je zelf aanwijzen.
      name: 'showOnHomepage',
      group: 'homepage',
      title: 'Announce on the homepage',
      type: 'boolean',
      initialValue: false,
      description: 'Shows a pop-up to visitors, once each. Set the period below.',
    }),
    defineField({
      // Los van start- en einddatum van de expositie: je kondigt vaak eerder aan
      // dan de opening, en wilt de pop-up meestal eerder weg dan de expositie
      // voorbij is. Bovendien heeft bijna geen enkele expositie hier een
      // einddatum, dus zonder deze velden blijft de pop-up staan tot je het
      // vinkje zelf uitzet.
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
      description: 'Select a Project Series — create new ones via Studio → Project Series',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'projectSeries' }], options: { disableNew: true } }],
    }),
    defineField({
      name: 'artworks',
      group: 'artworks',
      title: 'Artworks',
      description: 'Select the artworks shown in this exhibition.',
      components: { input: ExhibitionArtworkPicker },
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'artwork' }], options: { disableNew: true } }],
    }),
    defineField({
      name: 'images',
      group: 'installation',
      title: 'Installation photos',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    }),
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
      title: 'Deel prijslijst met klant',
      type: 'string',
      readOnly: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      components: { field: ShareExhibitionRoomLink as any },
    }),
    defineField({
      name: 'cvProject',
      group: 'cv',
      title: 'CV — Project',
      type: 'reference',
      to: [{ type: 'project' }],
      options: { disableNew: true },
      description: 'Which project does this exhibition belong to? Used to group exhibitions on the CV.',
    }),
    defineField({
      name: 'showInCV',
      group: 'cv',
      title: 'Show in CV',
      type: 'boolean',
      initialValue: false,
      description: 'Include this exhibition in the CV on the About page.',
    }),
    defineField({
      // Bleef staan naast de venue-keuze: oudere exposities bewaren hier hun
      // plaatsnaam, en die willen we niet kwijt.
      name: 'gallery',
      group: 'details',
      title: 'Gallery / venue (previous field)',
      type: 'string',
      readOnly: true,
      hidden: ({ document }) => !document?.gallery,
    }),
    defineField({
      name: 'location',
      group: 'details',
      title: 'Location (previous field)',
      type: 'string',
      readOnly: true,
      hidden: ({ document }) => !document?.location,
    }),
  ],
  preview: {
    select: {
      title: 'title',
      gallery: 'gallery',
      startDate: 'startDate',
      exhibitionType: 'exhibitionType',
      isSolo: 'isSolo',
      media: 'images.0',
    },
    prepare({ title, gallery, startDate, exhibitionType, isSolo, media }) {
      const year = startDate ? new Date(startDate).getFullYear() : '?'
      const typeLabels: Record<string, string> = {
        solo: 'Solo', duo: 'Duo', group: 'Group',
        permanent: 'Permanent', special: 'Special',
      }
      const typeLabel = exhibitionType ? typeLabels[exhibitionType] : (isSolo ? 'Solo' : '')
      return {
        title: title ?? '—',
        subtitle: `${typeLabel ? typeLabel + ' — ' : ''}${gallery ?? ''} (${year})`,
        media,
      }
    },
  },
})
