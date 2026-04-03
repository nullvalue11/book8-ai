"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SiteLanguageProvider } from "@/hooks/useBookingLanguage";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <SiteLanguageProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </SiteLanguageProvider>
    </SessionProvider>
  );
}
