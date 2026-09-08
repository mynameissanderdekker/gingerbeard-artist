'use client'
import React, { useEffect } from 'react'
import { useClient } from 'sanity'

interface LayoutProps {
  renderDefault: (props: LayoutProps) => React.JSX.Element
}

const css = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.7; }
  }
  .orders-badge-pulse {
    display: inline-block;
    animation: pulse 1.5s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .orders-badge-pulse { animation: none; }
  }
`

/**
 * Eén keer per Studio-sessie de admin-cookie zetten met het Sanity-token van
 * de ingelogde gebruiker, zodat facturen en documenten onder /admin openen
 * zonder apart wachtwoord. Faalt stil: dan komt het wachtwoordscherm.
 */
function AdminSession() {
  const client = useClient({ apiVersion: '2024-01-01' })
  useEffect(() => {
    if (window.sessionStorage.getItem('gb-admin-session') === '1') return
    const token = (client as unknown as { config?: () => { token?: string } }).config?.()?.token
    if (!token) return
    fetch('/api/admin/login', { method: 'POST', headers: { 'x-sanity-token': token } })
      .then((r) => { if (r.ok) window.sessionStorage.setItem('gb-admin-session', '1') })
      .catch(() => {})
  }, [client])
  return null
}

export function StudioLayout({ renderDefault, ...props }: LayoutProps) {
  return (
    <>
      <style>{css}</style>
      <AdminSession />
      {renderDefault({ renderDefault, ...props } as LayoutProps)}
    </>
  )
}
