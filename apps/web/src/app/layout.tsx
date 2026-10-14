import type { Metadata } from "next";
import { Exo_2, Orbitron } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { RouteTransition } from "@/components/layout/route-transition";
import "./globals.css";

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
  description: "Premium 18+ command network for gaming communities, creators, and power users.",
  icons: {
    icon: "/brand/nexusforge-mark.png",
    apple: "/brand/nexusforge-mark.png",
  },
  openGraph: {
    title: "Nexus Forge Gaming",
    description: "Premium 18+ command network for gaming communities",
    images: ["/brand/nexusforge-mark.png"],
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
