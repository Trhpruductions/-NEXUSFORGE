# NexusForge Deployment Env Checklist

Use this checklist for production/beta deployments where users are outside your local network.

If you want host-specific setup steps, use DEPLOYMENT_PLATFORM_CHECKLIST.md.

## 1) Web App Environment

Set these in your deployed web app environment:

```bash
NEXT_PUBLIC_APP_URL=https://app.your-domain.com
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXUSFORGE_DESKTOP_ONLY=false
```

Notes:

- `NEXT_PUBLIC_API_URL` must be a public API origin (never localhost).
- Keep `NEXUSFORGE_DESKTOP_ONLY=false` if browser/mobile users should access the full app.
- Set `NEXUSFORGE_DESKTOP_ONLY=true` only when intentionally forcing desktop-only mode.

## 2) API Server Environment

Set these in your deployed API environment:

```bash
CLIENT_ORIGIN=https://app.your-domain.com
APP_WEB_URL=https://app.your-domain.com
NEXUSFORGE_DESKTOP_ONLY=false
```

If you have multiple web origins, comma-separate them:

```bash
CLIENT_ORIGIN=https://app.your-domain.com,https://beta.your-domain.com
```

Notes:

- `CLIENT_ORIGIN` controls CORS allow-list.
- `APP_WEB_URL` is used for Stripe success/cancel/portal redirects.
- `NEXUSFORGE_DESKTOP_ONLY` seeds runtime launch mode defaults.

## 3) Required Auth/Billing Baseline

At minimum, make sure these are set on API before public login testing:

```bash
DATABASE_URL=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
```

For billing-enabled flows also set Stripe keys and all `STRIPE_PRICE_*` values.

## 4) Post-Deploy Verification

Run these checks against your public domains:

1. API health:

```bash
curl -i https://api.your-domain.com/api/health
```

2. Launch mode should return desktopOnly false for web access:

```bash
curl -i https://api.your-domain.com/api/runtime/launch-mode
```

Expected body includes:

```json
{"desktopOnly":false}
```

3. Browser client should call public API origin (not localhost):

- Open app in browser devtools Network tab.
- Confirm requests target `https://api.your-domain.com/...`.

## 5) Common Failure Map

- Users see desktop-only screen unexpectedly:
  - Set `NEXUSFORGE_DESKTOP_ONLY=false` on web + API.
  - Verify `/api/runtime/launch-mode` returns `desktopOnly:false`.

- Login fails only off-network:
  - `NEXT_PUBLIC_API_URL` still points to localhost or internal-only URL.
  - `CLIENT_ORIGIN` missing the deployed web origin.

- Stripe redirect returns to localhost:
  - `APP_WEB_URL` still set to localhost on API.

## 6) Gate Unblock Quickstart (Current Blockers)

Use this section to clear the last blocked gates quickly.

### A) Admin and Security Gate Inputs

`admin:badge:smoke` requires one of these auth input sets:

- `NEXUSFORGE_ADMIN_ACCESS_TOKEN`
- or both `NEXUSFORGE_ADMIN_EMAIL` and `NEXUSFORGE_ADMIN_PASSWORD`

PowerShell example (session-only env vars):

```powershell
$env:NEXUSFORGE_API_URL = "http://127.0.0.1:4001"
$env:NEXUSFORGE_ADMIN_EMAIL = "admin@example.com"
$env:NEXUSFORGE_ADMIN_PASSWORD = "<your-password>"
npm run admin:badge:smoke
```

If you already have a bearer token:

```powershell
$env:NEXUSFORGE_API_URL = "http://127.0.0.1:4001"
$env:NEXUSFORGE_ADMIN_ACCESS_TOKEN = "<your-admin-token>"
npm run admin:badge:smoke
```

### B) Deployment Gate Inputs

Update `scripts/desktop-release-deploy.env` with real values (placeholders are rejected):

- `NEXUSFORGE_DEPLOY_HOST`
- `NEXUSFORGE_DEPLOY_USER`
- `NEXUSFORGE_DEPLOY_WEBROOT`
- `NEXUSFORGE_DEPLOY_PORT`

Then run:

```powershell
npm run desktop:release:deploy:env
```

Optional verification-only check before upload:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/desktop-release-deploy-from-env.ps1 -WhatIf
```
