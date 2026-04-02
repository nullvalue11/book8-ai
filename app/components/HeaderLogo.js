import Image from "next/image";
import Link from "next/link";

export default function HeaderLogo({ className = "", variant }) {
  const forceLight = variant === "light"; // white logo for dark backgrounds
  return (
    <Link href="/" className={`flex items-center ${className}`}>
      {/* Light mode logo - visible in light mode, hidden in dark mode or when variant=light */}
      <Image
        src="/brand/book8_ai_logo.png"
        alt="Book8-AI"
        width={152}
        height={32}
        className={`h-7 md:h-8 w-auto ${forceLight ? "hidden" : "dark:hidden"}`}
        priority
      />
      {/* Dark mode logo - visible on dark backgrounds or when variant=light */}
      <Image
        src="/brand/book8_ai_logo_white.png"
        alt="Book8-AI"
        width={152}
        height={32}
        className={`h-7 md:h-8 w-auto ${forceLight ? "block" : "hidden dark:block"}`}
        priority
      />
    </Link>
  );
}
