# NexusForge Platform Deployment Checklist

Use this quick guide when deploying NexusForge to common hosts.

## Option A: Vercel (Web) + Render (API)

### 1) Deploy API on Render

Service type:

- Web Service (Node)

Build/start:

```bash
npm install
npm run build -w @nexusforge/server
npm run start -w @nexusforge/server
```

Set API environment variables:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=<your-db-url>
JWT_ACCESS_SECRET=<min-32-char-secret>
JWT_REFRESH_SECRET=<min-32-char-secret>
CLIENT_ORIGIN=https://app.your-domain.com
APP_WEB_URL=https://app.your-domain.com
NEXUSFORGE_DESKTOP_ONLY=false
```

Optional billing envs (required for checkout):

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_CORE_MONTHLY
- STRIPE_PRICE_CORE_YEARLY
- STRIPE_PRICE_PLUS_MONTHLY
- STRIPE_PRICE_PLUS_YEARLY
- STRIPE_PRICE_ELITE_MONTHLY
- STRIPE_PRICE_ELITE_YEARLY
- STRIPE_PRICE_INFINITE_MONTHLY
- STRIPE_PRICE_INFINITE_YEARLY
- STRIPE_PRICE_FORGE_BOOST_PACK
- STRIPE_PRICE_CREATOR_CAMPAIGN_SLOT
- STRIPE_PRICE_EVENT_TICKET_PASS
- STRIPE_PRICE_TEAM_BRANDING_KIT
- STRIPE_PRICE_ADVANCED_MODERATION_AI

### 2) Deploy Web on Vercel

Project root:

- apps/web

Set web environment variables:

```bash
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXUSFORGE_DESKTOP_ONLY=false
```

Optional:

```bash
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=<public-vapid-key>
```

### 3) Domain mapping

- Map web domain (example): https://app.your-domain.com
- Map API domain (example): https://api.your-domain.com

### 4) Post-deploy smoke checks

```bash
curl -i https://api.your-domain.com/api/health
curl -i https://api.your-domain.com/api/runtime/launch-mode
```

Expected launch-mode body includes:

```json
{"desktopOnly":false}
```

Then open https://app.your-domain.com and confirm login requests go to https://api.your-domain.com.

### 5) Critical: Prevent SPA fallback rewrites for desktop update files

Your web host must serve these two paths as real files, never HTML fallback:

- /desktop-update.json
- /NexusForge Desktop Setup 1.0.11.exe

If these paths return text/html, desktop auto-update will fail.

Validation command:

```bash
npm run desktop:update:validate:insecure
```

Recommended additional verification:

```bash
curl -kI "https://app.your-domain.com/desktop-update.json"
curl -kI "https://app.your-domain.com/NexusForge%20Desktop%20Setup%20Latest.exe"
curl -kI "https://app.your-domain.com/NexusForge%20Desktop%20Setup%201.0.11.exe"
```

Expected headers:

- `desktop-update.json` returns `application/json` (or `text/json`)
- installer `.exe` URLs return `application/octet-stream`
- installer URLs must not return `text/html`

### 6) Nginx static-file guard (if using Nginx in front of web app)

Installers and desktop manifest must bypass SPA fallback and be served as real files.

Example nginx location blocks:

```nginx
# Desktop update manifest: serve file directly
location = /desktop-update.json {
  add_header Cache-Control "no-store" always;
  try_files /desktop-update.json =404;
}

# Stable and versioned installer names: serve binary directly
location ~* ^/NexusForge%20Desktop%20Setup%20(Latest|[0-9]+\.[0-9]+\.[0-9]+)\.exe$ {
  default_type application/octet-stream;
  add_header Cache-Control "public, max-age=300" always;
  try_files $uri =404;
}

# SPA/app routes (example)
location / {
  try_files $uri $uri/ /index.html;
}
```

If your public app domain is behind a CDN or reverse proxy, ensure these exact paths are excluded from HTML rewrite/page rules there as well.

## Option B: Vercel (Web) + Railway (API)

### 1) Deploy API on Railway

Service setup:

- Node service from repository

Build/start:

```bash
npm install
npm run build -w @nexusforge/server
npm run start -w @nexusforge/server
```

Set the same API environment variables as Option A.

### 2) Deploy Web on Vercel

Use the same Vercel setup and envs as Option A.

### 3) Post-deploy smoke checks

Use the same health and launch-mode checks as Option A.

Also enforce the same no-rewrite requirement for:

- /desktop-update.json
- /NexusForge Desktop Setup 1.0.11.exe

## Fast Failure Triage

- Browser users see desktop-only page:
  - Set NEXUSFORGE_DESKTOP_ONLY=false on both web and API.
  - Verify /api/runtime/launch-mode returns desktopOnly false.

- Remote users cannot log in:
  - NEXT_PUBLIC_API_URL still points to localhost or private URL.
  - CLIENT_ORIGIN missing deployed web origin.

- Stripe returns to localhost:
  - APP_WEB_URL still set to localhost on API.
