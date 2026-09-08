'use client'
import { useState, useEffect } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'

export function CookieBanner() {
  const [consent, setConsent] = useState<boolean | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('cookie_consent')
    if (stored !== null) setConsent(stored === 'true')
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'true')
    setConsent(true)
  }

  const decline = () => {
    localStorage.setItem('cookie_consent', 'false')
    setConsent(false)
  }

  return (
    <>
      {consent === true && <GoogleAnalytics gaId="G-TJPFN6X82E" />}

      {consent === null && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--tone-900)',
          color: 'var(--tone-paper)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          zIndex: 9999,
          fontSize: 'var(--type-small)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
          width: 'max-content',
          maxWidth: 'calc(100vw - 32px)',
          flexWrap: 'wrap',
        }}>
          <span>
            This site uses Google Analytics to measure visits.{' '}
            <a href="/cookie-policy" style={{ color: 'var(--tone-400)', textDecoration: 'underline' }}>
              Cookie policy
            </a>
          </span>
          <button
            onClick={accept}
            style={{
              background: 'var(--tone-paper)',
              color: 'var(--tone-900)',
              border: 'none',
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 'var(--type-small)',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
            }}
          >
            Accept
          </button>
          <button
            onClick={decline}
            style={{
              background: 'transparent',
              color: 'var(--tone-400)',
              border: '1px solid var(--tone-700)',
              padding: '6px 16px',
              cursor: 'pointer',
              fontSize: 'var(--type-small)',
              fontFamily: 'inherit',
              letterSpacing: '0.05em',
            }}
          >
            Decline
          </button>
        </div>
      )}
    </>
  )
}
