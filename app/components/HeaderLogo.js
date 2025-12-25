import Image from "next/image";
import Link from "next/link";

export default function HeaderLogo({ variant = "auto" }) {
  // Use white logo for dark backgrounds (default for dashboard header)
  const logoSrc = variant === "dark" 
    ? "/brand/book8_ai_logo.png" 
    : "/brand/book8_ai_logo_white.png";
  
  return (
    <Link href="/" className="flex items-center">
      <Image
        src={logoSrc}
        alt="Book8 AI"
        width={152}
        height={32}
        className="h-7 md:h-8 w-auto"
        priority
      />
    </Link>
  );
}
