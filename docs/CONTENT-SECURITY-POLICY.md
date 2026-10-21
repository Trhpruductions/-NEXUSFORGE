# Content-Security-Policy (website)

Set in `apps/web/next.config.ts` (`contentSecurityPolicies`). It applies to every page of the website and to the
desktop app, which loads the same pages. The API and uploaded files have their own headers.

## What is enforced now

`base-uri 'self'; form-action 'self'; frame-ancestors 'self'`

- No page uses a `<base>` tag, so an injected one can't redirect the page's links and scripts.
- Forms only post to this site. Every form here is handled by JavaScript; the third-party sign-in (OAuth) approval
  uses a request and then a normal page change, not a form.
- Only this site may put its pages in a frame (this was already enforced before).

## What is only reported (nothing is blocked)

The full policy is sent as `Content-Security-Policy-Report-Only`. Browsers report what it **would** block to
`POST /api/errors/csp`. The reports appear on **Admin > Errors**, filter **Content policy**, grouped by rule,
blocked site and page, with a count. Only the blocked site (never its full address), the rule and the page path are
stored, so tokens in links never reach the log. Signed-out reports are limited per internet address and share the
browser part of the error log, so they can't crowd out server errors.

| Rule | Allows | Why |
|---|---|---|
| `script-src` | this site, inline scripts | Next.js writes page data as inline scripts. `eval` only in development. |
| `style-src` | this site, inline styles | The app sets many styles inline. |
| `img-src`, `media-src` | this site, `data:`, `blob:`, any https site | Avatars, link previews and attachments come from many sites. |
| `connect-src` | this site, `*.r2.cloudflarestorage.com` | Chat uploads go straight to Cloudflare R2. |
| `frame-src` | this site, `blob:`, YouTube, Twitch, Kick, Streamable | Video embeds; `blob:` for the ID-review PDF view. |
| `object-src` | nothing | No plugins. Kept report-only until the ID-review PDF view is confirmed unaffected. |

Browsers send the reports in two ways: `report-to` (Chrome, Edge) and `report-uri` (Firefox, Safari). Chrome only
delivers `report-to` reports to https addresses, and ignores `report-uri` when `report-to` is present, so development
and the private test site (plain http) use `report-uri` only.

## Tested (21 Oct 2026, private test site, headless Chrome)

- 30 pages, public and signed in (home, about, features, pricing, beta, download, developer, support, terms, privacy,
  sign-up, sign-in, and every main app page): **no violations**.
- A YouTube embed: allowed. An embed from a site not on the list: reported, received by the API, stored as one
  grouped row with the page path and no query string.
- Production build headers checked: no `eval`, reports to `/api/errors/csp` with both report forms.

## Next steps

1. Deploy (needs the owner's OK) and watch **Admin > Errors > Content policy** for a week of normal use, including
   the desktop app, the ID-review screen with a PDF, chat uploads, voice and screen share.
2. Add anything legitimate that shows up, then move the report-only rules into the enforced policy, keeping
   reporting on.
3. Later, optionally: nonces (`apps/web/src/proxy.ts`) to drop `'unsafe-inline'` for scripts. That makes every page
   render per request, so measure the extra load on this PC first.
