This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment

Create a local `.env.local` from `.env.example` and set:

- `NEXT_PUBLIC_API_URL` for the API origin used by the web client.
- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` to enable browser push subscription for profile settings.
- `NEXUSFORGE_AGE_GATE_SECRET` for server-signed 18+ verification cookies.
- `NEXUSFORGE_DESKTOP_ONLY` to control launch mode:
	- `true` keeps the web app desktop-only (non-desktop traffic is redirected to `/desktop-only`).
	- `false` enables normal browser/mobile access.

Age gate cookie note:

- In production, 18+ verification uses a `__Host-` scoped cookie and requires HTTPS.
- On local development, a legacy non-`__Host-` cookie name is used for localhost compatibility.

Hosted access note:

- For users outside your local network, `NEXT_PUBLIC_API_URL` must point to a public API origin (not localhost).

The value above is the default/fallback. Admin launch control can override launch mode at runtime via API, and that runtime state is persisted by the server database.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
