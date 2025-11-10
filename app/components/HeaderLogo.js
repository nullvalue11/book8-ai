import Image from "next/image";
import Link from "next/link";

export default function HeaderLogo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src="/brand/book8_ai_logo.svg"
        alt="Book8 AI"
        width={152}
        height={28}
        className="opacity-90 hover:opacity-100 transition"
        priority
      />
    </Link>
  );
}
