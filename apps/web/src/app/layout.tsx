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

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "NexusForge",
    template: "%s | NexusForge",
  },
  description: "Premium 18+ command network for gaming communities, creators, and power users.",
  icons: {
    icon: "/brand/nexusforge-main-logo.png",
    apple: "/brand/nexusforge-main-logo.png",
  },
  openGraph: {
    title: "NexusForge",
    description: "Premium 18+ command network for gaming communities",
    images: ["/brand/nexusforge-main-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${exo.variable} ${orbitron.variable} h-full min-h-dvh w-full antialiased`}>
      <body className="m-0 flex min-h-dvh w-full flex-col overflow-x-hidden bg-background p-0 text-foreground">
        <AppProviders>
          <RouteTransition>{children}</RouteTransition>
        </AppProviders>
      </body>
    </html>
  );
}
