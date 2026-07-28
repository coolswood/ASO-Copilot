import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ASO Copilot",
  description: "Self-hosted ASO tracking for your own apps: keyword ranks, competitor spy, health scoring, and keyword research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PostHogProvider>
          <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
              <Link href="/" className="group flex items-center gap-2.5 font-semibold text-lg">
                <span className="inline-block h-6 w-6 rounded-md bg-accent transition-transform duration-300 group-hover:rotate-12" />
                ASO Copilot
              </Link>
              <nav className="flex items-center gap-6 text-sm text-muted">
                <Link href="/" className="group relative py-1 hover:text-foreground">
                  Dashboard
                  <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-accent transition-transform duration-200 group-hover:scale-x-100" />
                </Link>
                <Link href="/search" className="group relative py-1 hover:text-foreground">
                  Keyword Search
                  <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-accent transition-transform duration-200 group-hover:scale-x-100" />
                </Link>
                <Link
                  href="/apps/new"
                  className="rounded-lg bg-accent px-3.5 py-1.5 text-accent-foreground font-medium shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0"
                >
                  + Add App
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </PostHogProvider>
      </body>
    </html>
  );
}
