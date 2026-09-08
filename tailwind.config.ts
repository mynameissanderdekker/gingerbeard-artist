import type { Config } from "tailwindcss";

/**
 * De Tailwind-kleuren aan de thema-tokens hangen.
 *
 * `text-gray-500`, `bg-black` en `border-gray-200` stonden in ruim honderd
 * componenten vast aan Tailwinds eigen grijsschaal. Door ze hier naar de
 * CSS-variabelen uit globals.css te laten wijzen, volgt élke klasse het
 * thema zonder dat er een component voor is aangeraakt. Zie audit-theme.
 */
const toon = (n: number) => `var(--tone-${n})`

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Tailwinds tekstmaten aan dezelfde schaal als globals.css: `text-sm`
      // stond op 14px en `text-xs` op 12px, los van de rest van de site.
      fontSize: {
        xs:    ['var(--type-small)', { lineHeight: '1.5' }],
        sm:    ['var(--type-small)', { lineHeight: '1.5' }],
        base:  ['var(--type-body)',  { lineHeight: '1.6' }],
        lg:    ['var(--type-lead)',  { lineHeight: '1.5' }],
        xl:    ['var(--type-h4)',    { lineHeight: '1.3' }],
        '2xl': ['var(--type-h3)',    { lineHeight: '1.2' }],
      },
      colors: {
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        black: "var(--tone-ink)",
        white: "var(--tone-paper)",
        gray: {
          50: toon(50), 100: toon(100), 200: toon(200), 300: toon(300), 400: toon(400),
          500: toon(500), 600: toon(600), 700: toon(700), 800: toon(800), 900: toon(900),
        },
      },
    },
  },
  plugins: [],
};
export default config;
