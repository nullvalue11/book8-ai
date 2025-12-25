import Link from "next/link";
import HeaderLogo from "./HeaderLogo";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[rgba(6,8,12,.75)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <HeaderLogo />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>
        </div>
        {/* right-side actions */}
        <div className="flex items-center gap-4">
          <Link href="/#auth" className="text-sm text-white/80 hover:text-white transition-colors">Sign In</Link>
          <Link href="/pricing" className="inline-flex h-11 items-center rounded-md px-4 text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-[0_8px_24px_-12px_rgba(124,77,255,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F14]">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
