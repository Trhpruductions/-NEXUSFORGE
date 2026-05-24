# Custom App Design Images

Place your selected app design image files in this folder.
These images will be used as the single source of truth for building the full app UI.

Recommended file types: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`

## Required image names

Use these exact file names for the app screens you want built:

- `app-home-desktop.png`
- `app-home-mobile.png`
- `app-login-desktop.png`
- `app-login-mobile.png`
- `app-register-desktop.png`
- `app-register-mobile.png`
- `app-forgot-password-desktop.png`
- `app-forgot-password-mobile.png`
- `app-pricing-desktop.png`
- `app-pricing-mobile.png`
- `app-core-plus-desktop.png`
- `app-core-plus-mobile.png`
- `app-notifications-desktop.png`
- `app-notifications-mobile.png`
- `app-settings-desktop.png`
- `app-settings-mobile.png`
- `app-admin-desktop.png`
- `app-admin-mobile.png`
- `app-voice-desktop.png`
- `app-voice-mobile.png`
- `app-server-desktop.png`
- `app-server-mobile.png`
- `app-join-desktop.png`
- `app-join-mobile.png`

If you have a design for a screen not listed here, add it with the prefix `app-` and either `-desktop` or `-mobile`.

When your images are ready, tell me and I will build the app design from this folder.

## Syncing the images into the app

After adding your images, run:

```bash
node scripts/sync-custom-design.mjs
```

This copies the custom design assets into `apps/web/public/custom-design` so the app loads them directly.

If you want the app to use the exact provided layout images, add these filenames:

- `app-home-desktop.jpg`
- `app-home-dashboard-desktop.jpg`
- `app-events-hall-desktop.jpg`
- `app-voice-stage-desktop.jpg`
- `app-voice-chat-desktop.jpg`
- `app-server-desktop.jpg`
- `app-join-desktop.jpg`
- `app-friends-desktop.jpg`
- `app-games-desktop.jpg`
- `app-activity-desktop.jpg`
- `app-rewards-desktop.jpg`
- `app-downloads-desktop.jpg`
- `app-notifications-desktop.jpg`
- `app-profile-desktop.jpg`
- `app-settings-desktop.jpg`
- `app-search-desktop.jpg`
- `app-support-desktop.jpg`

Other screens can use the same `app-*.jpg` pattern and will be available in the custom-design folder for future UI updates.
