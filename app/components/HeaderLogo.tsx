'use client';
import Image from 'next/image';

interface HeaderLogoProps {
  darkMode?: boolean;
  className?: string;
  width?: number;
  height?: number;
}

export default function HeaderLogo({ 
  darkMode = false, 
  className = "",
  width = 152,
  height = 28
}: HeaderLogoProps) {
  return (
    <div className={className}>
      <Image
        src="/brand/book8_ai_logo.svg"
        alt="Book8 AI"
        width={width}
        height={height}
        className="h-auto w-32 sm:w-36 md:w-38"
        priority
      />
    </div>
  );
}
