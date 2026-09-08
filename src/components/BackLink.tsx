'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'

/**
 * Terug naar waar je vandaan kwam — en anders naar een zinnige plek.
 *
 * Gedeeld tussen beide cores (sync-shared.mjs).
 *
 * Wat er misging, in twee rondes:
 *
 * 1. Elke detailpagina had een vaste link: `← Exhibitions`, `← Works`. Kom je
 *    van de homepage, een kunstenaarspagina of een aankondiging, dan zet die
 *    je ergens neer waar je niet was. Op een site waar je vanuit tien richtingen
 *    op een werk kunt komen, klopt een vaste terugknop bijna nooit.
 *
 * 2. De eerste vervanging keek naar `document.referrer`. Maar bij navigatie
 *    bínnen een Next-site (Link, router) verandert die niet: hij blijft staan
 *    op de verwijzer van de éérste paginalading. Van de homepage naar een
 *    beurs geklikt? De referrer zei nog "niets", en de knop viel terug op de
 *    vaste link. Precies het gedrag dat we wilden wegnemen.
 *
 * Nu houdt `NavDepthTracker` (in de root layout) zelf bij hoeveel pagina's
 * van deze site je in dit tabblad hebt gezien. Twee of meer → er is een vorige
 * pagina op deze site → `router.back()`. Eén → je kwam van buiten (gedeelde
 * link, Google, getypt) → de opgegeven terugvalpagina, met een label dat zegt
 * waar je heen gaat. Dat label is dan geen leugen: het is niet waar je vandaan
 * kwam, en het zegt dat ook niet.
 */

const SLEUTEL = 'gb-nav-depth'

/** In de root layout zetten. Rendert niets; telt de pagina's in dit tabblad. */
export function NavDepthTracker() {
  const pathname = usePathname()
  useEffect(() => {
    try {
      const n = Number(window.sessionStorage.getItem(SLEUTEL) ?? '0')
      window.sessionStorage.setItem(SLEUTEL, String(n + 1))
    } catch {
      /* privémodus zonder opslag: dan valt BackLink altijd terug op de vaste link */
    }
  }, [pathname])
  return null
}

function diepte(): number {
  try { return Number(window.sessionStorage.getItem(SLEUTEL) ?? '0') } catch { return 0 }
}

export default function BackLink({
  fallback,
  fallbackLabel,
  className = 'text-xs tracking-widest uppercase text-gray-400 hover:text-black mb-8 inline-block',
}: {
  /** Waarheen als er geen vorige pagina op deze site is. */
  fallback: string
  /** Wat er dan op de knop staat, bijv. "Exhibitions". */
  fallbackLabel: string
  className?: string
}) {
  // Server en client moeten dezelfde HTML opleveren; pas ná het monteren
  // weten we of er geschiedenis is. Tot die tijd: de terugval.
  const [kanTerug, setKanTerug] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // De tracker heeft deze pagina al meegeteld, dus ≥ 2 betekent: hiervoor
    // was er al een pagina van deze site in dit tabblad.
    setKanTerug(diepte() >= 2 && window.history.length > 1)
  }, [])

  if (!kanTerug) {
    return <Link href={fallback} className={className}>← {fallbackLabel}</Link>
  }
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className}
      style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
    >
      ← Back
    </button>
  )
}
