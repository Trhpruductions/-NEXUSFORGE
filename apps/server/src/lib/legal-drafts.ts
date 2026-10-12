/**
 * First drafts of the shorter Legal Center policies, written from what the app does
 * today. Loaded as IN_REVIEW versions; every [placeholder] must be filled and the text
 * reviewed before an admin publishes it from /admin/legal.
 */

export const cookiesSeedSummary =
  "Initial Cookie Policy listing the three cookies the server sets (nf_refresh, nf_csrf, nexusforge_age18) and the browser storage the web app uses. Vexora uses no advertising or analytics cookies and self-hosts its fonts. Fill in the [placeholders] and update this list whenever a cookie or tracker is added.";

export const cookiesSeedContent = `# Vexora Gaming Cookie Policy

**Effective Date:** [Effective Date]
**Last Updated:** October 12, 2026
**Operated By:** [Legal Operator Name]
**Contact:** [Privacy Contact Email]

This policy explains the cookies and similar browser storage Vexora Gaming ("Vexora," "we," "us") uses on our website and web app. It should be read with our [Privacy Policy](/legal/privacy).

**In short:** we only use storage that the app needs to work and stay secure, and to remember your own preferences. We do not use advertising cookies, analytics or tracking cookies, or social media trackers, and we do not let third parties set cookies through our app.

## 1. What cookies and browser storage are

A cookie is a small file a website saves in your browser. Browser storage ("local storage" and "session storage") works in a similar way but is only read by the app running in your browser; it is not sent to our servers automatically.

## 2. Cookies we set

| Name | Purpose | How long it lasts |
|---|---|---|
| nf_refresh | Keeps you signed in. It holds a sign-in token that can't be read by scripts on the page. | Up to [30] days, or until you sign out |
| nf_csrf | Security. It protects your account from requests made by other websites pretending to be you. | Same as nf_refresh |
| nexusforge_age18 | Remembers that you confirmed you are 18 or older, so you aren't asked on every visit. It doesn't store your date of birth. | 1 year |

These cookies are strictly necessary. The app can't sign you in or keep your account secure without them, so they can't be switched off in the app. Where the law requires it, we rely on the exemption for strictly necessary storage.

## 3. Browser storage the app uses

| Name | Purpose |
|---|---|
| nexusforge-auth-session | Your current sign-in session in this browser. If you don't choose to stay signed in, it is kept in session storage and is removed when you close the browser. |
| nexusforge-auth-persist-mode | Remembers whether you chose to stay signed in. |
| vexora-workspace | Remembers the forge and channel you last had open and your unread counts. |
| vx-collapsed-categories | Remembers which channel categories you collapsed. |
| nexusforge_push_opt_in | Remembers that you turned on push notifications in this browser. |

If you turn on push notifications, your browser also registers a small background script (a "service worker") so we can deliver notifications. You can turn notifications off in Settings or in your browser at any time.

## 4. Third parties

- **Fonts** are served from our own servers, so loading the app does not contact a font provider.
- **Link previews and images** from other websites are fetched by our servers and shown through our own image proxy, so those websites don't receive your IP address or set cookies when you view a preview.
- **Payments**, if we offer paid features, are handled by [Payment Processor] on its own pages, which may use its own cookies under its own policy.
- **Signing in with or linking another account** (for example Discord) takes you to that provider's website, where its own cookies and privacy policy apply.

## 5. Your choices

You can delete or block cookies and site data in your browser settings. If you block the cookies in section 2, you won't be able to sign in. Signing out removes the sign-in cookies and the sign-in session stored in your browser.

## 6. Changes

If we start using a new cookie or type of storage, we will update this policy and the Last Updated date. If we ever want to use storage that is not strictly necessary, we will ask for your consent first where the law requires it.

## 7. Contact

Questions about this policy: [Privacy Contact Email].
`;

export const acceptableUseSeedSummary =
  "Initial Acceptable Use Policy: what may not be done with Vexora's services, accounts, bots, webhooks and the API (security abuse, spam and automation, fraud and coin abuse, illegal content, evading enforcement). Fill in the [placeholders] and review before publishing.";

export const acceptableUseSeedContent = `# Vexora Gaming Acceptable Use Policy

**Effective Date:** [Effective Date]
**Last Updated:** October 12, 2026
**Operated By:** [Legal Operator Name]
**Contact:** [Official Support Email]

This Acceptable Use Policy is part of our [Terms of Service](/legal/terms). It covers what you may not do with Vexora Gaming's app, website, API, bots and other services (the "Services"). How to treat other people is covered in our [Community Rules](/legal/community-rules). If you break this policy we may take the actions described in our [Moderation Policy](/legal/moderation).

## 1. Illegal and harmful content

Do not use the Services to share, sell, promote or request:

- Sexual content involving anyone under 18, or any content that sexualises minors. We report this to the relevant authorities.
- Intimate images of someone shared without their consent.
- Content that is illegal where you live or that infringes someone else's rights, including pirated games, software or media.
- Malware, phishing links, stolen accounts, account credentials or personal data belonging to others.
- Instructions or offers to commit serious crimes, including violent acts, fraud, or trafficking in weapons or drugs.

## 2. Security and service integrity

Do not:

- Access, or try to access, accounts, forges, channels or data you aren't allowed to.
- Probe, scan or test the security of the Services without our written permission. If you find a security problem, please report it to [Security Contact Email] and don't access other people's data.
- Interfere with or overload the Services, for example with denial-of-service attacks, flooding, or deliberately expensive requests.
- Get around rate limits, slowmode, timeouts, bans, blocks, privacy settings, age gates or any other safety or access control.
- Reverse engineer or modify the app to gain access or abilities you wouldn't otherwise have, except where the law allows it.

## 3. Spam, automation and fake activity

Do not:

- Send unsolicited bulk messages, friend requests, invites or mentions, or advertise where it isn't welcome.
- Run "self-bots" or scripts on a normal user account. Use a bot application from the Developer Portal for automation.
- Create accounts in bulk, or use multiple accounts to boost, vote, farm rewards or get around enforcement.
- Fake engagement, such as artificially inflating members, likes, followers or event sign-ups.

## 4. Bots, webhooks and the API

If you build on Vexora:

- Only use the access and permissions a user or forge has actually given your bot, and only for the features you describe.
- Keep bot tokens and webhook URLs secret. Anyone with a webhook URL can post to that channel; delete and recreate the webhook if it leaks.
- Don't use webhooks or bots to impersonate people, mass-mention, or post content that breaks our policies. You are responsible for everything your bot or webhook posts.
- Don't collect, store or share people's messages or profile data beyond what your feature needs, and delete it when asked.
- Respect rate limits and don't scrape the Services.

## 5. Coins, rewards and digital items

Vexora coins and digital items have no cash value and can't be withdrawn. Do not:

- Sell, buy or trade coins, items or accounts for real money or for anything outside the Services.
- Use bugs, scripts, multiple accounts or other unfair methods to earn coins, rewards, jackpot entries or items. Report bugs to us instead.
- Scam other players or use coin transfers to deceive, pressure or extort anyone.

We may remove coins or items gained by breaking these rules.

## 6. Impersonation and deception

Do not pretend to be another person, a Vexora staff member, or a company or organisation, and don't mislead people about where content comes from. Parody and fan accounts must be clearly labelled.

## 7. Evading enforcement

If your account, or your access to a forge, has been restricted, don't create new accounts or use other people's accounts to get around it. Use the [Appeals Policy](/legal/appeals) instead.

## 8. Reporting

To report something that breaks this policy, use **Report** on the message, or contact support from the app. For security issues, contact [Security Contact Email].
`;

export const communityRulesSeedSummary =
  "Initial Community Rules: plain-language rules for forges, chat, DMs, voice, stages, events and the feed (respect, no harassment or hate, 18+ platform, sensitive content, privacy, cheating), plus how forge-level rules work alongside them. Review before publishing.";

export const communityRulesSeedContent = `# Vexora Gaming Community Rules

**Effective Date:** [Effective Date]
**Last Updated:** October 12, 2026

Vexora Gaming is a place to find people to play with, build communities and hang out. These rules apply everywhere on Vexora: forges (community servers), channels, threads and forum posts, direct and group messages, voice and stage channels, video and screen sharing, events, profiles and the feed. They sit alongside our [Terms of Service](/legal/terms) and [Acceptable Use Policy](/legal/acceptable-use).

## 1. Respect other people

- **No harassment or bullying.** Don't threaten, intimidate, stalk or repeatedly target anyone, and don't organise others to do it. If someone blocks you or asks you to stop, stop.
- **No hate.** Don't attack or demean people because of race, ethnicity, national origin, religion, caste, sex, gender, gender identity, sexual orientation, age, disability or serious illness, and don't promote groups or symbols that do.
- **No threats or glorifying violence.** Don't threaten violence, or encourage or celebrate violent attacks or self-harm.
- **Trash talk is fine; abuse isn't.** Competitive banter about a match is part of gaming. Insults that target who someone is, or that keep going after they've asked you to stop, are not.

## 2. Vexora is for adults

- You must be 18 or older to use Vexora.
- Never share sexual content involving anyone under 18, or that sexualises minors, even if it's drawn, generated or described as fictional.
- Don't try to meet up with, groom or sexually approach anyone you believe may be under 18. Report it instead.

## 3. Sensitive and graphic content

- Don't share sexual content, nudity or graphic violence outside places that clearly allow it, and never with people who haven't chosen to see it, such as in an unwanted direct message.
- Don't share real gore, or content showing real people being seriously hurt.
- Don't share sexual images of anyone without their consent.

## 4. Privacy

- Don't share other people's personal information, such as their real name, address, phone number, photos, or workplace, without their permission ("doxxing").
- Don't record or share voice, video or screen-share calls without the consent of the people in them where the law requires it.
- Don't share private messages to embarrass or harm someone.

## 5. Play fair

- Don't sell or promote cheats, hacks, exploits or stolen accounts.
- Don't scam players, including with coins, items, giveaways, fake links or "free" offers.
- Don't spam, flood channels, mass-mention or mass-invite.

## 6. Be honest about who you are

Don't impersonate other people, creators, forge staff or Vexora staff. Don't use your profile, status or display name to break these rules.

## 7. Self-harm

If you or someone you're talking to is in danger, contact local emergency services. Don't encourage or give instructions for self-harm or suicide. You can report messages that suggest someone is at risk, and we may share support resources with them.

## 8. Forge rules

Forge owners and moderators can set extra rules for their forge, such as topic rules, channel rules, slowmode or AutoMod filters, and they can enforce those rules in their forge. Forge rules can be stricter than these rules, but never looser. A forge that is set up to break these rules may be removed.

## 9. Reporting and enforcement

Use **Report** on any message, or block someone to stop them contacting you. Reports about forge channels go to that forge's moderators; reports about direct messages go to Vexora staff. How decisions are made, and what happens next, is explained in our [Moderation Policy](/legal/moderation), and you can challenge a decision under our [Appeals Policy](/legal/appeals).
`;

export const moderationSeedSummary =
  "Initial Moderation Policy describing how moderation actually works today: reports (8 reasons, saved snapshot, 20/hour limit), forge moderators (delete, timeout, kick, ban, slowmode, AutoMod, audit log, rank checks) and platform staff (DM reports, ID review). Platform-level account suspension is described as a staff action; the app does not yet have a suspension tool, so build it before publishing or remove that wording. Fill in the [placeholders].";

export const moderationSeedContent = `# Vexora Gaming Moderation Policy

**Effective Date:** [Effective Date]
**Last Updated:** October 12, 2026
**Operated By:** [Legal Operator Name]
**Contact:** [Official Support Email]

This policy explains how content and behaviour are moderated on Vexora Gaming, who makes decisions, and what actions can be taken. It applies to our [Community Rules](/legal/community-rules) and [Acceptable Use Policy](/legal/acceptable-use).

## 1. Two layers of moderation

**Forge moderation.** Each forge (community server) is run by its owner and the members they give moderation permissions to. They enforce our rules and their own forge rules inside their forge. Forge moderators are volunteers and are not Vexora staff.

**Platform moderation.** Vexora staff handle reports about direct messages, problems that affect the whole platform, serious harm, and forges that are set up to break our rules. Staff can review any report.

## 2. Reporting

- Use **Report** on a message and choose a reason: spam, harassment, hate, sexual content, violence, self-harm, scam, or other. You can add details.
- When you report a message, we save a copy of it (and its attachments) so it can still be reviewed if it is later edited or deleted.
- Reports about forge channels go to that forge's moderators. Reports about direct messages go to Vexora staff.
- The person you report isn't told who reported them.
- To prevent abuse, each account can send up to [20] reports per hour. Knowingly false or abusive reports break our rules.
- You can also contact support from the app about a person, a forge, or anything a message report doesn't cover.

## 3. What forge moderators can do

Inside their own forge, members with the right permissions can:

- Delete messages, and pin or unpin them.
- **Time out** a member, so they can't send messages, react or join voice for a set time.
- **Kick** a member, removing them from the forge (they can rejoin with a new invite).
- **Ban** a member, removing them and stopping them from rejoining.
- Set **slowmode** on a channel, make channels private, and manage invites.
- Set up **AutoMod** filters that block messages with certain words, links or spam patterns.
- Manage who speaks on a **stage**.

Moderators can only act on members ranked below them, and the forge owner can't be moderated by their own forge. Moderation actions are recorded in the forge's audit log, which the forge's managers can see.

## 4. What Vexora staff can do

Depending on what happened, Vexora staff may:

- Remove content anywhere on the platform.
- Resolve or dismiss reports and record why.
- Restrict features, or suspend or permanently close an account. [Confirm: account suspension tools must be in place before this policy is published.]
- Remove a forge, or remove its owner's control of it.
- Review age verification submissions.
- Remove coins or items gained by breaking our rules.
- Report content to law enforcement where the law requires it, for example sexual content involving minors.

## 5. How we decide

We look at the reported content and its context, such as the conversation around it, how severe it is, whether it was aimed at someone, and the account's history. We act in proportion: a first, minor problem may only lead to content being removed, while serious harm, such as threats or content sexualising minors, can lead to an account being closed immediately.

We may use automated tools, such as rate limits, spam detection and forge AutoMod filters, to block content before it is posted. Decisions to suspend or close an account are made by a person.

## 6. Telling you about decisions

When Vexora staff take action against your account or content, we will tell you what we did and why, unless that would risk someone's safety, interfere with an investigation, or break the law. Forge moderators decide for themselves whether to explain their decisions.

## 7. Appeals

You can ask us to review a decision made by Vexora staff. See our [Appeals Policy](/legal/appeals).

## 8. Staff conduct

Staff only look at private information, such as reported direct messages, when they need to for a report, a safety issue or a legal requirement. Staff access is limited to what their role requires, and administrative actions are logged.
`;

export const appealsSeedSummary =
  "Initial Appeals Policy: how to appeal Vexora staff decisions through a support ticket, what to include, one appeal per decision, review by a different staff member where possible, and that forge-level bans go to the forge owner first. Fill in the [placeholders] (appeal window, response time) and review before publishing.";

export const appealsSeedContent = `# Vexora Gaming Appeals Policy

**Effective Date:** [Effective Date]
**Last Updated:** October 12, 2026
**Operated By:** [Legal Operator Name]
**Contact:** [Official Support Email]

If you think a moderation decision was wrong, you can ask for it to be reviewed. This policy explains how. It works alongside our [Moderation Policy](/legal/moderation).

## 1. What you can appeal

You can appeal decisions made by **Vexora staff**, including:

- Removal of your content.
- Restrictions on your account or features.
- Suspension or closure of your account.
- Removal of a forge you own, or of your control over it.
- Removal of coins or items.
- A rejected age verification.

## 2. Decisions made by forge moderators

Each forge's moderators enforce rules in their own forge. If you were timed out, kicked or banned from a forge, or your message was deleted there, contact that forge's owner or moderators first. Vexora staff don't reverse forge decisions just because you disagree with them. We will step in if a forge moderator broke our rules, for example by harassing you or abusing their permissions. Report that to support.

## 3. How to appeal

1. Open **Support** in the app and create a ticket in the **Account** category. If you can't sign in, email [Appeals Contact Email] from the email address on your account.
2. Say which decision you are appealing and roughly when it happened.
3. Explain why you think it was wrong, and include anything that helps, such as context we may have missed.

Please send one appeal for each decision. Never send your password or sign-in codes.

## 4. Time limits

Please appeal within [180] days of the decision. We aim to respond within [14] days, and we will let you know if we need longer.

## 5. How we review appeals

- Where possible, a different staff member from the one who made the original decision reviews your appeal.
- We look again at the original content, its context, the reason for the decision and what you sent us.
- We will tell you the outcome: the decision is upheld, changed, or reversed. If we reverse it, we restore what we can.
- An appeal decision is final, unless you give us important new information.

## 6. While your appeal is reviewed

The original decision stays in place while we review it. Don't create new accounts to get around a restriction; doing so breaks our [Acceptable Use Policy](/legal/acceptable-use) and can make an appeal harder to grant.

## 7. Other options

Depending on where you live, you may have other ways to challenge a decision, such as out-of-court dispute settlement or a complaint to a regulator. Using our appeals process doesn't take away any rights you have under the law.
`;
