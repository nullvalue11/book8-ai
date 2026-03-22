"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import HeaderLogo from "./HeaderLogo";
import { Shield, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Header({ variant }) {
  const { data: session, status } = useSession();
  const [hasToken, setHasToken] = useState(false);
  const [tokenUserEmail, setTokenUserEmail] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLanding = variant === "landing";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("book8_token");
      setHasToken(!!t);
      if (t) {
        try {
          const u = localStorage.getItem("book8_user");
          setTokenUserEmail(u ? JSON.parse(u).email || "" : "");
        } catch {
          setTokenUserEmail("");
        }
      }
    }
  }, []);

  const isLoggedIn = (status === "authenticated" && session?.user) || hasToken;
  const displayEmail = session?.user?.email || tokenUserEmail;

  return (
    <header className={`sticky top-0 z-40 w-full border-b backdrop-blur-md supports-[backdrop-filter]:backdrop-blur-md ${
      isLanding ? "border-white/10 bg-[#0A0A0F]/80" : "border-border bg-background/95 supports-[backdrop-filter]:bg-background/75"
    }`}>
      <div className={`mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6 ${isLanding ? "text-white" : ""}`}>
        <div className="flex items-center gap-6">
          <HeaderLogo variant={isLanding ? "light" : undefined} />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/pricing" className={`text-sm transition-colors ${isLanding ? "text-[#94A3B8] hover:text-white" : "text-muted-foreground hover:text-foreground"}`}>
              Pricing
            </Link>
            <Link href="/privacy" className={`text-sm transition-colors flex items-center gap-1.5 ${isLanding ? "text-[#94A3B8] hover:text-white" : "text-muted-foreground hover:text-foreground"}`}>
              <Shield className="w-3.5 h-3.5" />
              Privacy
            </Link>
          </nav>
        </div>
        {/* right-side actions */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="md:hidden p-2 -mr-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <>
              <span className={`text-sm hidden sm:inline truncate max-w-[180px] ${isLanding ? "text-[#94A3B8]" : "text-muted-foreground"}`}>
                {displayEmail}
              </span>
              <Link href="/dashboard" className={`text-sm transition-colors ${isLanding ? "text-[#94A3B8] hover:text-white" : "text-muted-foreground hover:text-foreground"}`}>
                Dashboard
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.removeItem("book8_token");
                    localStorage.removeItem("book8_user");
                  }
                  signOut({ callbackUrl: "/" });
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/#auth" className={`text-sm transition-colors ${isLanding ? "text-[#94A3B8] hover:text-white" : "text-muted-foreground hover:text-foreground"}`}>Sign In</Link>
              <Link href="/setup" className={`inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                isLanding 
                  ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED] focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-[#0A0A0F]" 
                  : "bg-brand-500 text-white hover:bg-brand-600 hover:scale-[1.01] active:scale-[0.99] shadow-[0_8px_24px_-12px_rgba(124,77,255,.6)] focus-visible:ring-brand-500 focus-visible:ring-offset-background"
              }`}>
                Get Started →
              </Link>
            </>
          )}
          </div>
        </div>
      </div>
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden border-t ${isLanding ? "border-[#1e1e2e] bg-[#0A0A0F]/95" : "border-border bg-background/95"} backdrop-blur-lg`}>
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3">
            <Link href="/pricing" className={`py-3 transition-colors ${isLanding ? "text-[#F8FAFC] hover:text-[#8B5CF6]" : "text-foreground hover:text-[#8B5CF6]"}`} onClick={() => setMobileMenuOpen(false)}>
              Pricing
            </Link>
            <Link href="/privacy" className={`py-3 transition-colors flex items-center gap-2 ${isLanding ? "text-[#F8FAFC] hover:text-[#8B5CF6]" : "text-foreground hover:text-[#8B5CF6]"}`} onClick={() => setMobileMenuOpen(false)}>
              <Shield className="w-4 h-4" /> Privacy
            </Link>
            {isLoggedIn ? (
              <>
                <span className={`py-2 text-sm truncate ${isLanding ? "text-[#94A3B8]" : "text-muted-foreground"}`}>{displayEmail}</span>
                <Link href="/dashboard" className={`py-3 transition-colors ${isLanding ? "text-[#F8FAFC] hover:text-[#8B5CF6]" : "text-foreground hover:text-[#8B5CF6]"}`} onClick={() => setMobileMenuOpen(false)}>
                  Dashboard
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      localStorage.removeItem("book8_token");
                      localStorage.removeItem("book8_user");
                    }
                    signOut({ callbackUrl: "/" });
                    setMobileMenuOpen(false);
                  }}
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/#auth" className={`py-3 transition-colors ${isLanding ? "text-[#94A3B8] hover:text-white" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setMobileMenuOpen(false)}>
                  Sign In
                </Link>
                <Link href="/setup" className="inline-flex justify-center py-3 rounded-lg bg-[#8B5CF6] text-white font-medium" onClick={() => setMobileMenuOpen(false)}>
                  Get Started →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
