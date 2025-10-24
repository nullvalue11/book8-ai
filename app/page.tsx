import Image from 'next/image';
import HomeHero from './(home)/HomeHero';

// If you have a server-side auth helper, import it here
// import { getUser } from '@/app/lib/auth'

export default async function HomePage() {
  // const user = await getUser().catch(() => null)
  const user = null // Server cannot read localStorage; dashboard route handles authed views

  if (user) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <header className="mb-6 flex items-center gap-3">
          <Image src="/logo-mark.svg" alt="Book8 AI" width={40} height={40} priority />
          <h1 className="text-xl font-semibold text-slate-100">Book8 AI</h1>
        </header>
        {/* dashboard content follows */}
      </div>
    );
  }

  // Public marketing page
  return <HomeHero />;
}
