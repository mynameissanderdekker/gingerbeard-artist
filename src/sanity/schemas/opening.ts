import { defineField } from 'sanity'

/**
 * Ondertitel en het opening-blok, gedeeld door `exhibition` en `artFair`.
 *
 * Zelfde opzet als in de gallery-core (daar staat het inline in het schema):
 *
 *   Heading
 *   Opening date | Closing date (optional)
 *   From | Until                          ← alleen zonder sluitdatum
 *   Extra line
 *   Generate "Add to calendar" button
 *
 * Tijden als keuzelijst (kwartieren) en niet als vrij tekstveld: Sanity heeft
 * geen tijd-veld, en "3 uur" of "15.00u" is voor de agendaknop onbruikbaar.
 * Uit een lijst komt altijd HH:MM.
 *
 * Meerdaags (sluitdatum ná openingsdatum) = hele dagen: de tijden verdwijnen
 * dan uit de Studio en tellen op de pagina niet mee. Openingstijden van een
 * beurs horen in de extra regel.
 */

export const OPENING_TIJDEN = Array.from({ length: 64 }, (_, i) => {
  const u = 8 + Math.floor(i / 4), m = (i % 4) * 15
  const t = `${String(u).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { title: t, value: t }
})

type Ouder = { show?: boolean; date?: string; endDate?: string }

const meerdaags = (p?: Ouder) => !!(p?.date && p?.endDate && p.endDate > p.date)
const verborgen = ({ parent }: { parent?: Ouder }) => parent?.show !== true
const verborgenOfMeerdaags = ({ parent }: { parent?: Ouder }) => parent?.show !== true || meerdaags(parent)

export const subtitleField = defineField({
  name: 'subtitle',
  group: 'details',
  title: 'Subtitle',
  type: 'string',
  description: 'One line under the title, e.g. "New work, shown for the first time". Optional.',
})

export function openingField(soort: 'exhibition' | 'fair') {
  return defineField({
    name: 'opening',
    group: 'details',
    title: 'Opening / practical information',
    type: 'object',
    options: { collapsible: true, collapsed: false },
    fieldsets: [
      { name: 'datums', title: ' ', options: { columns: 2 } },
      { name: 'tijden', title: ' ', options: { columns: 2 } },
    ],
    fields: [
      defineField({
        name: 'show', title: 'Show this block on the page', type: 'boolean', initialValue: false,
        description: `Off: nothing of this block appears, including the calendar button. A ${soort} without a separate opening simply leaves it off.`,
      }),
      defineField({
        name: 'heading', title: 'Heading', type: 'string',
        initialValue: 'Practical information | Official opening',
        hidden: verborgen,
      }),
      defineField({
        name: 'date', title: 'Opening date', type: 'date', fieldset: 'datums',
        description: "This goes into the visitor's calendar.",
        hidden: verborgen,
      }),
      defineField({
        name: 'endDate', title: 'Closing date (optional)', type: 'date', fieldset: 'datums',
        description: 'For a fair or a multi-day opening. The calendar item then covers whole days, opening to closing; put opening hours in the extra line.',
        hidden: verborgen,
      }),
      defineField({
        name: 'startTime', title: 'From', type: 'string', fieldset: 'tijden',
        options: { list: OPENING_TIJDEN },
        hidden: verborgenOfMeerdaags,
      }),
      defineField({
        name: 'endTime', title: 'Until', type: 'string', fieldset: 'tijden',
        options: { list: OPENING_TIJDEN },
        hidden: verborgenOfMeerdaags,
      }),
      defineField({
        name: 'note', title: 'Extra line', type: 'text', rows: 2,
        description: 'Optional, e.g. "Drinks from 17:00", opening hours, or a different address.',
        hidden: verborgen,
      }),
      defineField({
        name: 'calendarButton', title: 'Generate "Add to calendar" button', type: 'boolean', initialValue: true,
        description: "Puts the opening (date and times above) in the visitor's calendar. Needs an opening date.",
        hidden: verborgen,
      }),
    ],
  })
}
