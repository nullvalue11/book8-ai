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
  width = 148,
  height = 28
}: HeaderLogoProps) {
  return (
    <Image
      src="/brand/book8_ai_logo.svg"
      alt="Book8 AI"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
