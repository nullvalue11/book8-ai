import "./globals.css";

export const metadata = {
  title: "Book8 AI",
  description: "AI scheduling, search, billing, and integrations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black antialiased">
        {children}
      </body>
    </html>
  );
}