import "./globals.css";
import { ThemeProvider } from "next-themes";

export const metadata = {
  title: "Book8 AI",
  description: "AI scheduling, search, billing, and integrations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
