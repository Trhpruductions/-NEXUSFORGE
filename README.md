# Vexora Gaming

Built for gamers. Connected by community.

Vexora Gaming is a Discord-style platform for gaming communities: forges (servers) with text and voice channels, direct messages, events and tournaments, creator streams, an avatar studio and wardrobe, achievements, and an in-app economy. Every page follows the design reference in `design/vexora-app-mockup.png`, and everything on screen is live data from the API.

## Monorepo

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 app (React 19, Tailwind 4, TanStack Query, zustand, socket.io-client) |
| `apps/server` | Express 5 API + Socket.IO gateway, Prisma 7 on PostgreSQL |
| `apps/desktop` | Electron shell that wraps the web app |
| `packages/*` | Shared config and types |
| `design/` | The product mockup every page is built against |

## Run it locally

Requirements: Node 20+, PostgreSQL 15+ (a database named `nexusforge`).

```bash
npm install
cp apps/server/.env.example apps/server/.env      # set DATABASE_URL and the JWT secrets
cp apps/web/.env.example apps/web/.env.local       # NEXT_PUBLIC_API_URL=http://127.0.0.1:4001
cd apps/server && npx prisma db push && npx prisma generate && cd ../..
npm run dev
```

Open http://127.0.0.1:3000 (use `127.0.0.1`, not `localhost`, so the CSRF cookie matches the API origin).

## What works without any third-party keys

- Accounts with email and phone verification codes, two-factor sign-in, session management. In development the codes are printed by the API and shown in the UI.
- Age verification: date-of-birth attestation on every account, government-ID upload with an admin review queue at `/admin/age-verification`.
- Forges with channels, roles and permissions, invites, bans, pinned messages, reactions, replies, mentions, attachments, unread and mention counts.
- Voice channels: built-in peer-to-peer WebRTC voice with mute, deafen, speaking indicators and screen sharing. Calls persist while you browse the app. Add LiveKit keys to switch to a media server.
- Direct messages and friends, with realtime delivery, presence and typing.
- Events and tournaments with RSVPs, brackets, live match reporting and 15-minute reminders.
- Live streams: go live, followers get alerts, viewers watch Twitch / Kick / YouTube embeds in-app, viewer counts and stream history are recorded.
- Avatar Studio (layered SVG avatar with presets and emotes), Wardrobe with vector item art, outfit presets and a coin store.
- Achievements earned from real activity, profile badges, posts and clips with inline players.
- Settings: account, privacy, notifications, appearance (accent, density, text size), voice devices, connections, integrations, roles, moderation, billing.

## Optional integrations

Set these in `apps/server/.env` to turn on the real thing (the app keeps working without them):

| Feature | Variables |
| --- | --- |
| Email codes | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| SMS codes | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Media-server voice | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL` |
| Web push | `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` |
| Uploads to object storage | `S3_*` |
| Billing | `STRIPE_*` |

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web + API with hot reload |
| `npm run dev:desktop` | Electron shell against the local web app |
| `npm run desktop:installer` | Build the Windows installer |
| `cd apps/server && npx tsc --noEmit` | Type-check the API |
| `cd apps/web && npx tsc --noEmit && npx eslint src` | Type-check and lint the web app |

## Repository notes

- `var/` holds runtime files (uploaded ID documents, logs) and is git-ignored.
- After changing `apps/server/prisma/schema.prisma`, run `npx prisma db push && npx prisma generate` and restart the API.
- The many `*_SUMMARY.md` / `*_CHECKLIST.md` files at the root are historical planning documents from earlier phases.
