import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClipMind AI",
  description: "AI video summarization and key moments platform"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
