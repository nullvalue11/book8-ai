import HeaderLogo from "./HeaderLogo";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-black/40 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
        <HeaderLogo />
        {/* right-side actions */}
        <div className="flex items-center gap-4">
          <button className="text-sm text-white/80 hover:text-white">Sign In</button>
          <button className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand transition">
            Get Started
          </button>
        </div>
      </div>
    </header>
  );
}
