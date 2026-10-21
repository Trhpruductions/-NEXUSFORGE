# Voice: relay server (TURN) and sharing computer sound

Assessment written 21 Oct 2026. Neither feature is enabled today. This file describes what exists, what it
would take, and what the owner has to decide.

## 1. Relay server (TURN) for strict networks

### What exists
- Voice is peer-to-peer (WebRTC mesh). Browsers find each other with public STUN servers
  (`stun.l.google.com`). That fails behind strict NATs, some corporate or school networks, and some mobile
  carriers: those people can join a call but hear nothing.
- The server already supports a relay: `apps/server/src/lib/ice-servers.ts`. When `TURN_URLS` and
  `TURN_SHARED_SECRET` are set in `apps/server/.env`, every voice session gets short-lived relay credentials
  (coturn's "use-auth-secret" scheme: the username is the expiry time, the password an HMAC of it, valid
  `TURN_CREDENTIAL_TTL_SECONDS`, default 1 hour). The long-lived secret never reaches the browser.
  **Neither setting is set today.**

### Why it can't run on this PC
A relay needs public UDP and TCP ports. The site reaches the internet through a Cloudflare tunnel, which
carries web traffic only. Hosting a relay here would mean opening router ports and exposing the home IP
address. Not recommended.

### Options (owner decision: provider and cost)
| Option | Fits the existing code | Cost (rough) | Notes |
|---|---|---|---|
| **coturn on a small VPS** (Hetzner, DigitalOcean, Vultr…) | Yes, no code change | ~US$5/month plus traffic | Full control; one more server to keep updated. |
| **Cloudflare Realtime TURN** | Small change: fetch credentials from Cloudflare's API on the server | Pay per GB relayed | Already using Cloudflare; no server to maintain. |
| Metered.ca / Twilio Network Traversal | Small change (their credential API) | Free tier / pay per GB | Hosted, simple. |

Traffic estimate: only people whose direct connection fails use the relay (often 10-20%). A voice stream is
about 50 kbit/s per listener; a screen share is 1-3 Mbit/s per viewer.

### Setup for coturn (when chosen)
1. A VPS with a public IP and a DNS name, e.g. `turn.nfgcord.com`. That record must not be proxied through
   Cloudflare, since a relay can't run behind the proxy.
2. coturn with `use-auth-secret`, `static-auth-secret=<long random>`, `realm=nfgcord.com`, a TLS certificate
   for `turns:` on 443/tcp (gets through firewalls that only allow web traffic), and
   **`denied-peer-ip` for private and loopback ranges**, so the relay can't be used to reach the VPS's own
   network.
3. In `apps/server/.env`:
   `TURN_URLS=turn:turn.nfgcord.com:3478?transport=udp,turn:turn.nfgcord.com:3478?transport=tcp,turns:turn.nfgcord.com:443?transport=tcp`
   and `TURN_SHARED_SECRET=<the same secret>`. Restart the API.
4. Test from a network that blocks UDP (or force relay-only in a test browser): the call must connect through
   `relay` candidates.

## 2. Sharing computer sound with a screen share

### What exists
Screen sharing sends video only. The website asks for `audio: false` (`mesh-voice.ts`), and the desktop app's
screen handler answers with video only (`apps/desktop/main.js`, `registerScreenShareHandler`).

### What is possible
- **Browsers:**
  - Chrome and Edge on Windows: a "Share system audio" option when sharing a whole screen, and tab audio when
    sharing a tab.
  - Sharing a single window doesn't include sound.
  - Firefox and Safari don't share system sound.
- **Desktop app (Electron 42, Windows):** the screen handler can also return `audio: 'loopback'` (the computer's
  sound output), or `'loopbackWithMute'`, which also mutes the sound locally while sharing.

### The catch: echo
Computer sound includes the call itself: the other people's voices coming out of the sharer's speakers. With
plain loopback, everyone hears themselves back with a delay. Ways to avoid that, each needing a real test:
- Chrome's `restrictOwnAudio` capture option leaves out the page's own sound. Its availability in the
  Chromium version inside Electron 42 has to be checked.
- Play the call through a different output device than the one being shared (fragile for most users).
- Only offer computer sound when sharing a browser tab (`suppressLocalAudioPlayback`). That is browser-only.

### Plan (about 1-2 days of work, then testing)
1. A "Share computer sound" switch next to Share screen, **off by default**, explaining that headphones avoid
   echo.
2. Website: when it's on, ask for `audio: true` (with `restrictOwnAudio` / `suppressLocalAudioPlayback` where
   supported), send the captured sound as its own track next to the screen (each listener gets a separate
   volume for it), and show a clear note when the browser doesn't offer sound.
3. Desktop app: the picker gets the same switch; the handler answers `audio: 'loopback'` only when it's on.
   Microphone audio is never substituted for computer sound.
4. Test with two desktop copies on the private test site: a tone played on the sharer's PC reaches the
   viewer, the viewer doesn't hear their own voice back, and stopping the share stops the sound.

Owner decision: whether to build it now. It is listed as a known limitation in the 1.0.16 and 1.0.17 release
notes.
