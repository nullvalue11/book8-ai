import Image from "next/image";
import Link from "next/link";

export default function HeaderLogo({ className = "" }) {
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      {/* Light mode logo - visible in light mode, hidden in dark mode */}
      <Image
        src="/brand/book8_ai_logo.png"
        alt="Book8 AI"
        width={152}
        height={32}
        className="h-7 md:h-8 w-auto dark:hidden"
        priority
      />
      {/* Dark mode logo - hidden in light mode, visible in dark mode */}
      <Image
        src="/brand/book8_ai_logo_white.png"
        alt="Book8 AI"
        width={152}
        height={32}
        className="h-7 md:h-8 w-auto hidden dark:block"
        priority
      />
    </Link>
  );
}
