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
  width = 120,
  height = 32
}: HeaderLogoProps) {
  const logoSrc = darkMode ? '/book8_ai_logo.svg' : '/book8_ai_logo.svg';
  
  return (
    <Image
      src={logoSrc}
      alt="Book8 AI"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
