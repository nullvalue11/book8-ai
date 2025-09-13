import Link from 'next/link'

export const metadata = { title: 'Account | Book8 AI' }

export default function AccountShim({ searchParams }) {
  const msg = searchParams?.success
    ? 'Subscription successful.'
    : searchParams?.canceled
    ? 'Checkout canceled.'
    : 'Account page moved.'
  return (
    <main className="container py-12">
      <h1 className="text-2xl font-semibold">Book8 AI</h1>
      <p className="mt-3 text-muted-foreground">{msg} Continue to your dashboard.</p>
      <Link className="underline mt-6 inline-block" href="/">Go to Dashboard</Link>
    </main>
  )
}