import type { Metadata } from "next";
import { CookieBanner } from "@/components/CookieBanner";
import "./globals.css";
import { client } from '@/sanity/lib/client'
import { theme } from '@/themes'
import { appearanceTokens, tokensAlsCss, type Appearance } from '@/lib/appearance'
import { NavDepthTracker } from '@/components/BackLink'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.mynameissanderdekker.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'My name is Sander Dekker',
    template: '%s — Sander Dekker',
  },
  description: 'Amsterdam-based photographer. Documentary projects on identity, self-expression and social acceptance — through zines, exhibitions and editions.',
  openGraph: {
    siteName: 'Sander Dekker',
    locale: 'en_GB',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Drie lagen: globals.css (het uiterlijk zoals het was), het thema van deze
  // installatie, en wat de kunstenaar zelf in Site Settings → Appearance heeft
  // gezet. Alleen wat afwijkt komt in de <style>; leeg = niets geïnjecteerd.
  const appearance = await client
    .fetch<Appearance | null>(`*[_type == "siteSettings"][0].appearance`, {}, { next: { revalidate: 300 } })
    .catch(() => null)
  const tokens = tokensAlsCss(theme.tokens, appearanceTokens(appearance))

  return (
    <html lang="en" className={theme.fontClassName || undefined}>
      <body>
        {tokens && <style id="theme-tokens" dangerouslySetInnerHTML={{ __html: tokens }} />}
        {/* Telt de pagina's in dit tabblad, zodat BackLink weet of er iets is om naar terug te gaan. */}
        <NavDepthTracker />
        {children}

        {/* Google Analytics 4 — long-term history & trends: analytics.google.com */}
        <CookieBanner />
      </body>
    </html>
  );
}
