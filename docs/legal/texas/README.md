# Nexus Forge Gaming: Texas legal documents (drafts)

**Status: drafts for counsel review. None of these documents is in effect, and none has been published.** They were prepared from the app's code and from the facts in [FACTS.md](FACTS.md). They are not legal advice. A Texas-licensed attorney should review every document, fill in the placeholders, and confirm the citations marked [VERIFY] before anything is published.

## The documents

| File | Document | Replaces the app's policy slug |
|---|---|---|
| [terms-of-service.md](terms-of-service.md) | Terms of Service | `terms` |
| [privacy-policy.md](privacy-policy.md) | Privacy Policy | `privacy` |
| [eula.md](eula.md) | End User License Agreement (desktop app) | `eula` |
| [acceptable-use-policy.md](acceptable-use-policy.md) | Acceptable Use Policy | `acceptable-use` |
| [community-rules.md](community-rules.md) | Community Rules | `community-rules` |
| [refund-policy.md](refund-policy.md) | Refund Policy | `refunds` |
| [cookie-policy.md](cookie-policy.md) | Cookie Policy | `cookies` |
| [ip-policy.md](ip-policy.md) | Intellectual Property and Copyright Policy | `ip` |
| [moderation-policy.md](moderation-policy.md) | Moderation Policy | `moderation` |
| [appeals-policy.md](appeals-policy.md) | Appeals Policy | `appeals` |
| [virtual-currency-terms.md](virtual-currency-terms.md) | Virtual Currency Terms (Nexus Forge Coins, the jackpot, internal assets) | none yet; the Terms cross-refer to it |

The slugs match the app's legal catalogue in `apps/server/src/lib/legal-content.ts`. The Virtual Currency Terms do not have a slug yet. Adding one means a small code change to that catalogue, which I have not made.

## Legal risks to decide before publication

These are not drafting questions. The documents can describe what the app does, but they cannot make these features lawful. Each needs a decision by the owner and counsel.

1. **The hourly jackpot may be an illegal prize game in Texas.** Players spend coins (50 per ticket) on a round, and one winner receives the pot. Texas prohibits gambling (Tex. Penal Code ch. 47) and lotteries (Tex. Const. art. III, § 47). The risk depends on whether coins have value. The app says they cannot be bought with money or cashed out, but that does not settle the question. Options for counsel to weigh: remove the jackpot; keep it only with a free entry route that needs no purchase and has no value attached; or restructure it. Until this is decided, the Virtual Currency Terms carry a blocking notice.
2. **The crypto swap and the internal "Nexus" assets (NF_BTC, NF_ETH, FORGE).** The code generates their prices itself ("simulate industrial flux" in `crypto-authority.ts`). Presenting simulated prices as market prices could be a deceptive trade practice under the Texas DTPA (Tex. Bus. & Com. Code § 17.41 et seq.). If any asset can be given value, exchanged, or bought, securities, commodities or money-transmission rules may apply. Recommendation: disable the swap, or rename the assets and remove any market-style pricing, until counsel has reviewed them.
3. **Age-verification documents.** The app can store an image of a government ID. Texas breach-notification law (Tex. Bus. & Com. Code ch. 521) covers government identification numbers, so this data needs security, a retention limit, and a breach plan. If the system matches a face to the ID photo, the Texas biometric law (Tex. Bus. & Com. Code § 503.001) applies and needs consent and destruction rules. The Privacy Policy says no biometric data is collected; that must be true before publication.
4. **Texas Data Privacy and Security Act (ch. 541).** The Act has a small-business exemption based on the SBA size standard. Counsel needs to confirm whether the operator qualifies. If it does not, the privacy notice and rights procedures in the Privacy Policy are required.
5. **The Texas SCOPE Act (ch. 509).** It covers online services that let users interact socially and share content, which describes chat, voice and feeds. Some of its provisions have been challenged in court. The app is 18+ and blocks under-18 users, which reduces the exposure, but counsel must confirm which provisions are in force and whether the age gate meets them.
6. **Taxes.** Texas sales and use tax may apply to some digital purchases. Confirm with a tax advisor before publishing the Refund Policy.
7. **Subscriptions.** Core+ renews automatically. Confirm the disclosures, cancellation method and any federal rules that apply to the subscription sign-up and cancellation flow.
8. **Arbitration and class waiver.** The Terms use binding individual arbitration with a class-action waiver. Counsel should confirm enforceability under the Federal Arbitration Act and Texas law, and the carve-outs (justice-court claims and injunctive relief).

## Placeholders

Every unknown fact is a bracketed placeholder. The full list is in [FACTS.md](FACTS.md). The most important ones are:

- the legal operator name, entity type and state of formation, which must be filled in before any document can be published;
- the notice and support email addresses and the postal address;
- the county for venue;
- the DMCA designated agent, which must also be registered with the U.S. Copyright Office;
- every retention period;
- the refund window and the other [OWNER DECISION] items.

## How to publish (owner action, not done)

The app stores policy versions in its database. Each version starts as a draft (`IN_REVIEW`) and goes live only when it is published. To publish:

1. Fill in the placeholders and clear every [VERIFY], [Owner to confirm] and [OWNER DECISION] marker.
2. Paste the final text into the admin legal page for the matching policy, as a new version, and check it there.
3. Publish the version. Nothing is published automatically. Required-at-sign-up policies (Terms and Privacy) will then start asking new users to accept them.

Publishing is outward-facing, so it stays with the owner.

## Before publication checklist

- [ ] Counsel has reviewed every document.
- [ ] Every placeholder is filled in, or deliberately removed.
- [ ] Every [VERIFY] citation is checked against the current statute.
- [ ] Decisions 1 to 8 above are made and the documents match them.
- [ ] The Virtual Currency Terms blocking notice is removed only after the jackpot and internal-asset decisions are made.
- [ ] The Texas Attorney General complaint contact has been checked against the official site.
- [ ] The privacy notice matches the actual data flows, including the age-document handling.
