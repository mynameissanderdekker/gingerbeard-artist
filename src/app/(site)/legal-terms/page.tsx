import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Legal & Terms',
  description: 'Legal information and terms for mynameissanderdekker.com',
}

export default function LegalTermsPage() {
  return (
    <div className="project-intro" style={{ maxWidth: '720px', margin: '80px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 'var(--type-h3)', fontWeight: 700, marginBottom: '2rem' }}>Legal &amp; Terms</h1>

      <p>
        <strong>My name is Sander Dekker</strong><br />
        BTW number: NL002124967B84<br />
        Chamber of Commerce number: 52124819<br />
        Located: Amsterdam, Netherlands
      </p>

      <h2 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, marginTop: '2.5rem', marginBottom: '0.5rem' }}>About Transactions</h2>
      <p>
        We do not handle transactions ourselves.{' '}
        <a href="https://stripe.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>Stripe</a>{' '}
        payments handles all payments, including credit card, debit card, Apple Pay, etc. We do not receive your card information or store it on our server or database.
      </p>

      <h2 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, marginTop: '2rem', marginBottom: '0.5rem' }}>Order Confirmation</h2>
      <p>
        After your order has been completed, you will receive an email with a confirmation. If an item is out of stock, you will be notified afterwards and the amount will be automatically refunded within a day.
      </p>

      <h2 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, marginTop: '2rem', marginBottom: '0.5rem' }}>Delivery</h2>
      <p>
        All orders are processed and sent out within 2–4 business days (unless otherwise stated). We use MyParcel &amp; DHL to ship all orders and will provide you with a Track &amp; Trace code.
      </p>
      <p style={{ marginTop: '0.5rem' }}>
        <em>Please note that overseas delivery times can vary considerably.</em>
      </p>

      <h2 style={{ fontSize: 'var(--type-h4)', fontWeight: 700, marginTop: '2rem', marginBottom: '0.5rem' }}>Return Policy</h2>
      <p>
        We do not accept returns. Only if a product was received damaged or is defective, you may return it. You will be refunded the cost of the goods once we receive them. Before returning any item, please send an email to{' '}
        <a href="mailto:hello@mynameissanderdekker.com" style={{ textDecoration: 'underline' }}>
          hello@mynameissanderdekker.com
        </a>{' '}
        to inform us that the goods are being returned, specifying the items in question and the reason for the return.
      </p>
    </div>
  )
}
