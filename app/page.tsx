import Image from 'next/image'
import HomeHero from './(home)/HomeHero'

export default async function HomePage() {
  // On server we don't have direct access to localStorage; assume unauth for marketing page.
  // Dashboard has its own route; compact header is handled there.
  const isAuthed = false

  if (isAuthed) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Image src="/logo-mark.svg" alt="Book8 AI" width={40} height={40} priority className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-slate-100">Book8 AI</h1>
        </header>
      </div>
    )
  }

  return (
    <>
      <HomeHero />
    </>
  )
}
