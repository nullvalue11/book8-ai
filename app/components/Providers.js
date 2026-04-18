"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SiteLanguageProvider } from "@/hooks/useBookingLanguage";
import HtmlLangUpdater from "@/components/HtmlLangUpdater";
import SkipToMainLink from "@/components/SkipToMainLink";

export function Providers({ children }) {
  return (
    <SessionProvider>
      <SiteLanguageProvider>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme>
          <div className="relative">
            <SkipToMainLink />
            <HtmlLangUpdater />
            {children}
          </div>
          <Toaster richColors closeButton position="top-center" />
        </ThemeProvider>
      </SiteLanguageProvider>
    </SessionProvider>
  );
}
