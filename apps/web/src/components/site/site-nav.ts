/** The public website's main menu (header, phone menu, footer "Product" column). */
export const siteNav: Array<{ label: string; href: string }> = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Download", href: "/download" },
  { label: "Developers", href: "/developer" },
  { label: "Support", href: "/support" },
];

export const footerColumns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Download", href: "/download" },
      { label: "What's new", href: "/app/updates" },
      { label: "Leaderboards", href: "/leaderboards" },
    ],
  },
  {
    title: "Build",
    links: [
      { label: "Developer portal", href: "/developer" },
      { label: "Bots", href: "/developer/bots" },
      { label: "Sign in with Nexus Forge", href: "/developer/oauth" },
      { label: "Webhooks", href: "/developer/webhooks" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About TRH Development", href: "/about" },
      { label: "Beta program", href: "/beta" },
      { label: "Support", href: "/support" },
      { label: "Report a problem", href: "/support#report" },
      { label: "Status", href: "/support#status" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "All policies", href: "/legal" },
    ],
  },
];
