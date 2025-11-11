import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0F14] flex items-center justify-center px-4">
      <div className="text-center">
        <Image
          src="/brand/book8_ai_icon_white.png"
          alt="Book8 AI"
          width={80}
          height={80}
          className="mx-auto mb-8 opacity-60"
        />
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white/80 mb-4">Page Not Found</h2>
        <p className="text-white/60 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md px-6 font-medium bg-brand-500 text-white hover:bg-brand-600 hover:scale-[1.01] active:scale-[0.99] transition-transform shadow-[0_8px_24px_-12px_rgba(124,77,255,.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0F14]"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
