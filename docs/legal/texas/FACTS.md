# Facts sheet for the Texas legal documents

Every drafted document must match these facts. Where a fact is unknown it is written as a bracketed placeholder. Do not invent names, addresses, phone numbers, email addresses, dates or amounts.

## Operator (placeholders until the owner confirms)

- Service name: **Nexus Forge Gaming** (also written "NexusForge", "Forge"). Website: https://nfgcord.com (the app is at https://nfgcord.com/app).
- Made by: TRH Development (appears in the site footer).
- Operator (confirmed by the owner): **TRH Development**, a private sole proprietorship owned and operated by **Hank [Full Legal Name]** (the account name is trhdevelopment). It is not a separate legal entity, so the owner carries the business's liabilities personally. Documents must say "TRH Development, a sole proprietorship owned and operated by Hank [Full Legal Name]" and must not describe the operator as an LLC, corporation or other entity.
- Assumed name: if "TRH Development" is not the owner's own legal name, Texas requires an assumed name certificate filed with the county clerk (Tex. Bus. & Com. Code ch. 71). **[Owner to confirm the certificate is filed, and in which county.]**
- Principal business address (public notice address): **[Business Mailing Address]**. Texas state of operation: **Texas** **[Owner to confirm the state of residence for venue]**.
- Support contact: **[Support Email Address]**. Legal and privacy notices contact: **[Legal Notices Email Address]**. Mailing address for notices: **[Notice Mailing Address]**.
- Governing law: **Texas**, without regard to conflict-of-laws rules. Venue for court actions: **[County] County, Texas**, subject to the arbitration section where it applies.
- DMCA designated agent (copyright complaints): **[Designated Agent Name, Address, Email]**, to be registered with the U.S. Copyright Office.
- Effective date of each document: **[Effective Date]**. Version: **1.0 (draft for counsel review)**.

## The service

- Web app (browser) and a Windows desktop app (Electron, with automatic updates). Other platforms are not offered.
- Accounts: username, email address, password (stored as a salted hash), optional phone number verified by text message, optional two-factor sign-in (authenticator app and email or phone codes), optional Discord account link.
- Community spaces called "forges" (servers) with text channels, threads, forum channels, polls, reactions, custom emoji, stickers, a soundboard, roles and permissions, invites, bans, AutoMod filters, audit logs, webhooks and bots.
- Direct messages and friend lists.
- Voice and video calls, stages and screen sharing, using real-time media servers (LiveKit and a WebRTC peer connection). Audio and video are not recorded by the service. **[Owner to confirm: no recording or transcription]**.
- Feed with posts, comments, likes and short clips; events and event reminders; public server discovery; profiles with avatars, banners, bios and social links.
- A 3D avatar system with clothing and accessory options, presets and saved looks. Avatars are built from procedural models. They do not use face scans or facial geometry from photographs. **[Owner to confirm]**.
- Uploads: profile pictures, server icons and banners, message attachments. Accepted types are PNG, JPEG and WebP for pictures. Files are stored in object storage (S3-compatible) or on local server storage.
- Support tickets, problem reports and user reports with a moderation queue, and appeals for moderation decisions.
- Email: transactional mail through an SMTP provider **[Email Provider]**. SMS codes through Twilio.
- Push notifications through the web push standard.
- Status and error logging for staff. IP addresses are used for security (rate limiting, suspicious-sign-in alerts and abuse prevention).

## Paid features, digital items and virtual currency

- **Core+ subscriptions** (plan names: Core, Plus, Elite, Infinite) sold through **Stripe**, billed monthly or yearly. Higher upload limits, more servers and better video quality. Prices are shown on the pricing page before purchase. Cancellation and billing are managed in Settings > Billing.
- **Add-ons** sold through the same billing system, for example boost packs. **[Owner to confirm the full list]**.
- **Nexus Forge Coins**: an in-app virtual currency. Coins are earned through daily rewards, activity and mining, and are spent on cosmetic items, mining rigs and jackpot tickets. **Coins cannot be bought with money and cannot be cashed out or redeemed for money.** Coins may be sent between users where the transfer feature allows it. **[Owner to confirm whether peer transfers stay enabled]**.
- **Cosmetics store**: outfits, accessories and emotes bought with coins. Ownership is a licence to use the item inside the service. Items are not property and are not refundable in cash.
- **Mining rigs**: an in-app progression feature that adds coins over time. It has no real-money value and does not involve cryptocurrency mining.
- **Hourly jackpot**: players spend coins on tickets in a round, and one winner receives the pot in coins. Each round's draw can be checked against a published seed. **[OWNER AND COUNSEL DECISION REQUIRED: see README, legal risk 1. Do not publish any document that describes this feature as a game of chance until counsel has reviewed it.]**.
- **Crypto swap and internal "Nexus" assets** (named assets such as NF_BTC, NF_ETH and FORGE): internal in-app units with prices that are currently generated by the service. They are not connected to any blockchain or exchange and cannot be withdrawn. **[OWNER AND COUNSEL DECISION REQUIRED: see README, legal risk 2. Do not describe these as cryptocurrency or investments in any document.]**.
- Taxes: sales and use tax may apply to some digital purchases in Texas. **[Owner to confirm with a tax advisor.]**.

## Age

- The minimum age to use the service is **18**. Users declare a date of birth at sign-up. The age-verification system can also store a government document image submitted by the user. **[Owner to confirm what document types are accepted, how long they are kept and who can see them.]**.
- Under-18 users are blocked from using the service. The service does not knowingly collect data from anyone under 18.
- The age gate sets a cookie named `nexusforge_age18`.

## Data the service stores (summary for the privacy notice)

- Account data: username, email, password hash, phone number if verified, date of birth, display name, bio, profile pictures, status, activity presence, preferences and settings.
- Content: messages, attachments, posts, comments, server and channel content, reactions, reports and support tickets.
- Purchases and subscriptions: plan status and purchase records. Payment card details are handled by Stripe and are not stored by the service.
- Technical data: IP address, device and browser type, sign-in history, session records, error logs and audit logs.
- Cookies and local storage:
  - `nf_refresh`: an HTTP-only, same-site session cookie that keeps the user signed in.
  - a CSRF protection cookie set on sign-in.
  - `nexusforge_age18`: the age-gate cookie.
  - browser local storage for the signed-in session state, notification and display preferences, and device settings for calls.
- There are **no third-party advertising, analytics or tracking libraries** in the code at the time of drafting. **[Owner to confirm before publication.]**.
- No sale of personal data and no targeted advertising. **[Owner to confirm.]**.

## Retention (owner to confirm each period)

- Account data: kept while the account is active and for **[Retention Period]** after closure, unless the law requires longer.
- Messages and content: kept until deleted by the user or the server owner, or removed under the policies. Backups are kept for **[Backup Period]**.
- Age documents: kept for **[Document Retention Period]** and then deleted.
- Logs: kept for **[Log Retention Period]**.

## Texas and federal law the documents should reflect (counsel must verify current text before publication)

- Texas Data Privacy and Security Act, Tex. Bus. & Com. Code ch. 541 (privacy notice, consumer rights, sensitive data, data protection assessments). **[Counsel to confirm applicability: the Act exempts small businesses except in certain cases.]**.
- Texas data breach law, Tex. Bus. & Com. Code ch. 521 (notice to individuals and the Attorney General).
- Texas biometric identifier law, Tex. Bus. & Com. Code § 503.001 (CUBI).
- Texas SCOPE Act, Tex. Bus. & Com. Code ch. 509 (minors' online safety). **[Counsel to confirm which provisions are in force, since parts have been challenged in court.]**.
- Texas Deceptive Trade Practices Act, Tex. Bus. & Com. Code § 17.41 et seq.
- Texas Penal Code ch. 47 (gambling) and Texas Constitution art. III, § 47 (lotteries).
- Federal: COPPA (15 U.S.C. §§ 6501–6506; 16 C.F.R. pt. 312), DMCA safe harbour (17 U.S.C. § 512), E-SIGN (15 U.S.C. § 7001), Section 230 (47 U.S.C. § 230), the FAA (9 U.S.C. §§ 1–16) for arbitration.
- Texas Attorney General consumer complaints: Consumer Protection Division. **[Counsel to verify current address and phone before publishing.]**.
