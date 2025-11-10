import Image from "next/image";
import Link from "next/link";

export default function HeaderLogo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/brand/book8_ai_logo.svg"
        alt="Book8 AI"
        width={152}
        height={32}
        className="h-7 md:h-8 w-auto opacity-90 hover:opacity-100 transition-opacity duration-150 ease-out"
        priority
      />
    </Link>
  );
}
