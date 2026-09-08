'use client'

import { useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

type SignupState = 'idle' | 'loading' | 'success' | 'error'

export interface FooterSocial {
  instagram?: string
  linkedin?: string
  facebook?: string
  twitter?: string
  vimeo?: string
}

function IconInstagram() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}

function IconLinkedIn() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect x="2" y="9" width="4" height="12"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>
  )
}


export default function Footer({ social = {}, contactEmail = '' }: { social?: FooterSocial; contactEmail?: string }) {
  const pathname = usePathname()
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [email, setEmail]           = useState('')
  const [turnstileToken, setToken]  = useState<string | null>(null)
  const [state, setState]           = useState<SignupState>('idle')
  const turnstileRef                = useRef<TurnstileInstance>(null)

  // Hide footer on home page
  if (pathname === '/') return null

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, turnstileToken }),
      })
      setState(res.ok ? 'success' : 'error')
      if (res.ok) {
        setFirstName(''); setLastName(''); setEmail('')
        setToken(null)
        turnstileRef.current?.reset()
      }
    } catch {
      setState('error')
    }
  }

  return (
    <div className="footer-wrap">

      {/* Newsletter strip — full width, above columns */}
      <div className="footer-newsletter-strip">
        <div className="footer-newsletter-left">
          <p className="footer-newsletter-label">
            Get our newsletter including exhibitions, news and events
          </p>
          {state === 'success' ? (
            <p className="footer-newsletter-thanks">Thank you — you&apos;re on the list.</p>
          ) : (
            <form onSubmit={handleSignup} className="footer-signup footer-signup--inline">
              <input
                type="text"
                placeholder="First name *"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
                disabled={state === 'loading'}
              />
              <input
                type="text"
                placeholder="Last name *"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
                disabled={state === 'loading'}
              />
              <input
                type="email"
                placeholder="Email address *"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={state === 'loading'}
              />
              <Turnstile
                ref={turnstileRef}
                siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'}
                onSuccess={setToken}
                onError={() => setToken(null)}
                onExpire={() => setToken(null)}
                // De `action` komt terug uit siteverify en wordt daar
                // gecontroleerd: een token van het contactformulier kan zo
                // niet gebruikt worden om de nieuwsbrief te spammen.
                options={{ size: 'invisible', action: 'newsletter' }}
              />
              <button type="submit" disabled={state === 'loading' || !turnstileToken}>
                {state === 'loading' ? '…' : 'Sign up'}
              </button>
              {state === 'error' && (
                <span className="footer-signup-error">
                  Something went wrong. Please try again.
                </span>
              )}
            </form>
          )}
        </div>
        {/* De URL's stonden hier hardcoded terwijl Site Settings er al velden
            voor heeft. Een icoon verschijnt alleen als de link is ingevuld. */}
        <div className="footer-social">
          {social.instagram && (
            <a href={social.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <IconInstagram />
            </a>
          )}
          {social.linkedin && (
            <a href={social.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <IconLinkedIn />
            </a>
          )}
        </div>
      </div>

      {/* 4-column info grid */}
      <footer className="site-footer">

        {/* Column 1 — Press & info */}
        <div className="footer-col">
          <h4>Press &amp; info</h4>
          <p>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
          <p>Amsterdam, the Netherlands</p>
          <p>
            <a href="/press-kit.html" target="_blank" rel="noopener">
              Press kit (PDF)
            </a>
          </p>
        </div>

        {/* TODO: deze drie kolommen zijn hardcoded. Het zijn precies de
            contacten met type "gallery" en "I work with this gallery" aan —
            het veld dat de locatiekiezer op een expositie al gebruikt. Ze
            zouden daaruit moeten komen, met een kop per galerie als veld.
            Nu betekent een nieuwe galerie een codewijziging. */}
        {/* Column 2 — Mother gallery */}
        <div className="footer-col">
          <h4>Mother gallery</h4>
          <p>Torch Art Gallery</p>
          <p>Amsterdam, NL</p>
          <p><a href="mailto:mo@torchgallery.com">mo@torchgallery.com</a></p>
          <p><a href="https://www.torchgallery.com" target="_blank" rel="noopener noreferrer">www.torchgallery.com</a></p>
        </div>

        {/* Column 3 — Special projects */}
        <div className="footer-col">
          <h4>Special projects</h4>
          <p>Josilda da Conceição</p>
          <p>Amsterdam, NL</p>
          <p><a href="mailto:josilda@daconceicao.nl">josilda@daconceicao.nl</a></p>
          <p><a href="https://www.josildadaconceicao.com" target="_blank" rel="noopener noreferrer">www.josildadaconceicao.com</a></p>
        </div>

        {/* Column 4 — Denmark */}
        <div className="footer-col">
          <h4>Denmark</h4>
          <p>STRAYFIELD Gallery</p>
          <p>Hellerup, DK</p>
          <p><a href="mailto:info@strayfieldgallery.com">info@strayfieldgallery.com</a></p>
          <p><a href="https://www.strayfieldgallery.com" target="_blank" rel="noopener noreferrer">www.strayfieldgallery.com</a></p>
        </div>

      </footer>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-left">
          <span>© Sander Dekker 2026</span>
          <a href="/cookie-policy">Cookie policy</a>
          <a href="/legal-terms">Legal &amp; Terms</a>
        </div>
        <div className="footer-bottom-right">
          <span>fueled by <a href="https://www.gingerbeard.works/" target="_blank" rel="noopener noreferrer">GingerBeard.Works</a></span>
        </div>
      </div>

    </div>
  )
}
