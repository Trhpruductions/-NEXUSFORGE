import type { Metadata } from "next";
import { Exo_2, Orbitron } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { RouteTransition } from "@/components/layout/route-transition";
import "./globals.css";
import "./themes.css";

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

// Use the public frontend origin for metadata and canonical URLs in production.
const metadataBase = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : new URL("http://127.0.0.1:3300");

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "Nexus Forge Gaming",
    template: "%s | Nexus Forge Gaming",
  },
  description: "Servers, voice, video and chat for gamers, creators and esports teams, with more included free. Web and Windows. 18+.",
  // Icons and the link-preview image come from app/favicon.ico, app/apple-icon.png and
  // app/opengraph-image.png (made from the logo by scripts/brand-images.cjs).
  openGraph: {
    title: "Nexus Forge Gaming",
    description: "Servers, voice, video and chat for gamers, with more included free.",
    siteName: "Nexus Forge Gaming",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${exo.variable} ${orbitron.variable} h-full w-full antialiased overflow-hidden`}>
      <body className="m-0 flex h-full w-full flex-col overflow-hidden bg-background p-0 text-foreground">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AppProviders>
          <RouteTransition>{children}</RouteTransition>
        </AppProviders>
      </body>
    </html>
  );
}
