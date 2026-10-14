/**
 * Starting text for legal documents, loaded once as a draft "in review" when a policy has
 * no versions yet. After that the text is managed from the Legal admin dashboard and
 * lives in the database. Bracketed [placeholders] block publishing until filled in.
 */

export const legalPolicyCatalog = [
  { slug: "terms", title: "Terms of Service", summary: "The agreement between you and Nexus Forge Gaming for using the app and its services.", sortOrder: 1, requiredAtSignup: true },
  { slug: "privacy", title: "Privacy Policy", summary: "What information we collect, why, and the choices you have.", sortOrder: 2, requiredAtSignup: true },
  { slug: "eula", title: "End User License Agreement", summary: "Terms for installing and running the Nexus Forge desktop and mobile apps.", sortOrder: 3, requiredAtSignup: false },
  { slug: "acceptable-use", title: "Acceptable Use Policy", summary: "What you may and may not do on Nexus Forge Gaming.", sortOrder: 4, requiredAtSignup: false },
  { slug: "community-rules", title: "Community Rules", summary: "How to treat other players in forges, chat, voice and events.", sortOrder: 5, requiredAtSignup: false },
  { slug: "refunds", title: "Refund Policy", summary: "Purchases, subscriptions, cancellations and refunds.", sortOrder: 6, requiredAtSignup: false },
  { slug: "cookies", title: "Cookie Policy", summary: "Cookies and similar storage the app uses.", sortOrder: 7, requiredAtSignup: false },
  { slug: "ip", title: "Intellectual Property Policy", summary: "Copyright and trademark complaints, and how we handle them.", sortOrder: 8, requiredAtSignup: false },
  { slug: "moderation", title: "Moderation Policy", summary: "How reports are reviewed and what actions moderators can take.", sortOrder: 9, requiredAtSignup: false },
  { slug: "appeals", title: "Appeals Policy", summary: "How to appeal a moderation or account decision.", sortOrder: 10, requiredAtSignup: false },
] as const;

export const termsSeedSummary =
  "Initial Terms of Service, adapted to Nexus Forge Gaming (name, and section 6 describes forges, voice, events and integrations instead of Rust/GTA servers). Fill in every [placeholder] (operator, contact, website, effective date, jurisdiction) and have the liability, indemnity, dispute and payment sections reviewed before publishing.";

export const termsSeedContent = `# Nexus Forge Gaming Terms of Service

**Effective Date:** [Launch Date]
**Last Updated:** October 11, 2026
**Operated By:** [Legal Operator Name]
**Contact:** [Official Support Email]
**Website:** [Official Website URL]

## 1. Introduction and Acceptance

Welcome to Nexus Forge Gaming ("Nexus Forge," "we," "us," or "our").

These Terms of Service ("Terms") govern your access to and use of the Nexus Forge Gaming application, website, Discord integrations, gaming servers, software, digital features, community services, and any other products or services we make available (collectively, the "Services").

By creating an account, accessing the application, connecting a third-party account, joining a supported gaming server, purchasing a product, or otherwise using the Services, you acknowledge that you have read and understood these Terms and agree to be bound by them where legally enforceable.

If you do not agree to these Terms, you must not access or use the Services.

These Terms apply alongside any additional rules or agreements presented for specific features, servers, purchases, or services. If a separate agreement expressly governs a particular service, that agreement applies to the extent of any conflict.

## 2. Eligibility

You may use the Services only if you meet the applicable age, eligibility, and account requirements.

You must comply with:

- The minimum age requirements applicable to the Services.
- The terms and policies of Discord, Steam, game publishers, and other connected platforms.
- Applicable laws and regulations.
- Any additional age or eligibility restrictions displayed for a particular feature.

You must not misrepresent your age or identity to bypass eligibility requirements.

If you are not legally able to enter into a binding agreement, you may use the Services only where permitted by applicable law and with any required parent or guardian involvement.

## 3. Accounts and Account Security

Certain features may require you to create an account or link an account from a third-party platform.

You agree to provide accurate information where required and to keep your account information reasonably current.

You are responsible for maintaining the confidentiality of your login credentials and for promptly reporting suspected unauthorized access.

You must not:

- Impersonate another person, business, staff member, or administrator.
- Use another person's account without authorization.
- Sell, transfer, rent, or trade app accounts without our written authorization.
- Circumvent account restrictions, bans, or security controls.
- Use fraudulent information to obtain access or benefits.
- Access accounts, databases, or administrative systems without permission.

We may require additional verification when reasonably necessary to protect users, prevent fraud, or secure the Services.

You must not share passwords, authentication tokens, recovery codes, or other confidential credentials with staff or other users.

## 4. License to Use the Application

Subject to these Terms, we grant you a limited, personal, non-exclusive, non-transferable, and revocable license to access and use the Services for their intended purposes.

This license does not transfer ownership of the application or any underlying intellectual property to you.

Except where applicable law permits or we expressly authorize it in writing, you must not:

- Copy, modify, distribute, or resell our proprietary software.
- Reverse engineer or attempt to derive source code from software where legally prohibited.
- Bypass technical restrictions or access controls.
- Remove proprietary notices or misrepresent ownership.
- Use the Services to create or distribute malicious software.
- Exploit bugs or vulnerabilities for unauthorized purposes.

Open-source components and third-party software remain subject to their respective licenses.

## 5. Acceptable Use

You agree to use the Services responsibly and in a manner that does not harm other users, our systems, or third parties.

The following activities are prohibited:

### 5.1 Harassment and Abuse

Threatening, stalking, bullying, targeted harassment, discriminatory abuse, or encouraging others to engage in such conduct.

### 5.2 Privacy Violations

Doxxing, unauthorized disclosure of private information, account intrusion, or surveillance that violates applicable law or another person's rights.

### 5.3 Fraud and Deception

Scamming, phishing, impersonation, fraudulent transactions, deceptive promotions, or attempts to obtain money, credentials, or access through dishonest means.

### 5.4 Spam and Disruption

Unsolicited bulk messaging, malicious advertising, repeated disruptive behavior, or attempts to interfere with community operations.

### 5.5 Security Abuse

Unauthorized access, credential theft, malicious attacks, denial-of-service activity, malware distribution, or interference with the availability or integrity of our systems.

### 5.6 Circumvention

Using alternate accounts, technical workarounds, or another person to evade a restriction or enforcement action.

### 5.7 Illegal Activity

Using the Services to facilitate unlawful activity or violate the rights of another person.

We may investigate reasonably substantiated reports of prohibited conduct and take proportionate action consistent with these Terms and applicable law.

## 6. Gaming Services and Server Rules

Nexus Forge provides community servers ("forges"), text, voice and video channels, events and tournaments, and integrations with games and other platforms.

Each forge, event or gaming service may have additional rules governing gameplay, cheating, exploits, roleplay conduct, player interactions, and server access.

You agree to follow the rules published for each service.

We may, where reasonably necessary:

- Set or change server capacity limits.
- Schedule maintenance and updates.
- Reset maps, wipe servers, or change game configurations.
- Remove unauthorized content or exploits.
- Suspend access to protect players or service integrity.
- Modify, suspend, or discontinue individual servers.

Unless expressly stated otherwise in a separate written agreement, we do not guarantee permanent access to a server, preservation of virtual items, or uninterrupted retention of game progress.

## 7. Fair Play, Cheating, and Exploits

You must not use cheats, unauthorized exploits, prohibited automation, malicious modifications, or other unfair methods contrary to the applicable game or server rules.

You must not knowingly abuse software defects to obtain unauthorized access, disrupt gameplay, duplicate restricted items, or gain an unfair advantage.

You must not interfere with other players' ability to use the Services.

Suspected vulnerabilities should be reported privately through official support channels. Reports made in good faith will be assessed on their merits.

Enforcement may include removal from a match or server, temporary suspension, permanent restriction, or referral to the relevant platform where appropriate.

## 8. User Content

"User Content" means messages, images, videos, usernames, profiles, uploads, suggestions, and other material that you submit through the Services.

You retain ownership of User Content to the extent that you own it under applicable law.

By submitting User Content, you grant us a non-exclusive, worldwide, royalty-free license to host, store, reproduce, display, transmit, and process that content as reasonably necessary to operate, secure, moderate, and provide the Services.

This license is limited to the purposes described above unless you separately authorize additional uses or another agreement applies.

You represent that you have the necessary rights to submit the content and grant this license.

You must not upload or distribute content that infringes intellectual property rights, violates applicable law, exposes private information without authorization, or otherwise breaches these Terms.

We may remove or restrict User Content when reasonably necessary to enforce our policies, protect users, or comply with legal obligations.

## 9. Intellectual Property

The Services may contain software, source code, branding, graphics, logos, designs, text, documentation, interfaces, and other materials owned by or licensed to the relevant Nexus Forge operator.

Except for the limited license expressly granted in these Terms, no ownership rights are transferred to you.

You must not claim ownership of our proprietary materials or commercially exploit them without authorization.

Any separately commissioned software, graphics, development work, or other deliverables will be governed by the applicable written agreement.

Third-party names, logos, games, and trademarks belong to their respective owners. Their appearance in the Services does not imply endorsement or ownership by Nexus Forge.

## 10. Third-Party Services

The Services may integrate with Discord, Steam, game publishers, payment processors, hosting providers, and other third-party services.

Those services may have independent terms, privacy policies, technical requirements, and availability limitations.

We do not control third-party services and are not responsible for their independent decisions or outages, except to the extent responsibility cannot lawfully be excluded.

Your use of a third-party service remains subject to its applicable terms.

## 11. Payments and Digital Purchases

Some Services may offer paid memberships, subscriptions, digital items, premium features, or other products.

Before completing a purchase, you will be provided with the applicable price, billing frequency, renewal conditions, and material restrictions.

You authorize the applicable payment provider to process transactions in accordance with the payment terms presented at checkout.

Where subscriptions renew automatically, the renewal terms and cancellation method will be disclosed before purchase.

Digital benefits do not guarantee immunity from moderation, uninterrupted service, permanent server availability, or preservation of virtual items.

Refunds, cancellations, and payment disputes are handled according to the applicable purchase terms and consumer protection laws.

Nothing in these Terms removes a right to a refund or other remedy that cannot legally be excluded.

## 12. Donations and Community Support

If voluntary contributions or donations are offered, their purpose and any associated benefits will be described before payment.

Unless expressly stated and legally qualified, contributions must not be understood as charitable donations or represented as tax-deductible.

A contribution does not provide ownership of the Services, administrative authority, immunity from moderation, or guaranteed permanent access.

Any benefits attached to a contribution remain subject to the terms presented when the contribution is made and applicable law.

## 13. Moderation and Enforcement

We may take reasonable action when users violate these Terms, applicable service rules, or third-party requirements.

Depending on the circumstances, enforcement may include:

- A warning or notice.
- Removal of content.
- Temporary restriction of features.
- A mute or kick from a community or server.
- Temporary account suspension.
- Permanent account or server restrictions.
- Removal of staff permissions.
- Suspension of access to purchased features where legally permitted.

We may act without prior warning where necessary to address serious misconduct, security threats, fraud, abuse, or risks to other users.

Where reasonably practical, we will maintain records of significant enforcement actions and provide an appeal mechanism.

You may appeal an eligible decision through our designated support channel. Appeals are reviewed according to our procedures, but reversal is not guaranteed.

Purchasing a membership or supporting the community does not exempt you from enforcement.

## 14. Reports and Complaints

Users may report suspected violations through the available reporting or support mechanisms.

Reports should be made in good faith and include relevant information where available.

We may investigate reports, request additional information, restrict access during an investigation when appropriate, or close a report where the available information does not support further action.

Knowingly fabricated reports, threats, retaliation, or deliberate abuse of reporting systems may themselves violate these Terms.

We will limit access to sensitive reports to personnel who reasonably need that access.

## 15. Privacy and Data Processing

Our collection and use of personal information are described in our Privacy Policy.

Depending on the features used, the Services may process account identifiers, gaming identifiers, activity records, moderation records, technical logs, support requests, and purchase status.

We will process information according to the purposes described in our Privacy Policy and applicable law.

You should not submit information that is unnecessary for the feature being used, particularly passwords, authentication tokens, payment card details, or another person's confidential information.

Requests concerning access to, correction of, or deletion of personal information may be submitted through the designated privacy contact.

## 16. Service Availability and Changes

We aim to operate the Services reliably but do not guarantee uninterrupted availability.

The Services may experience outages, maintenance, technical failures, security incidents, hosting limitations, or third-party disruptions.

We may add, modify, suspend, or discontinue features where reasonably necessary for technical, security, operational, legal, or business reasons.

Where practical, we will provide notice of significant planned changes.

Any rights concerning paid services, subscriptions, or prepaid benefits remain subject to applicable agreements and law.

## 17. Disclaimers

To the extent permitted by applicable law, the Services are provided on an "as available" basis without guarantees that they will be uninterrupted, error-free, or suitable for every user's requirements.

We do not guarantee that all bugs, vulnerabilities, compatibility issues, or service interruptions can be prevented.

Nothing in this section excludes a warranty or legal protection that cannot lawfully be excluded.

## 18. Limitation of Liability

To the maximum extent permitted by applicable law, the operator will not be liable for indirect, incidental, special, consequential, or punitive damages arising from use of the Services where such exclusion is legally enforceable.

Nothing in these Terms excludes or limits liability for fraud, intentional misconduct, or any other matter where liability cannot lawfully be excluded or limited.

Any additional limitation of liability must be applied only to the extent permitted by the law governing the relevant claim.

## 19. Indemnification

To the extent permitted by applicable law, you may be responsible for losses or reasonable costs arising from your unlawful conduct, your infringement of third-party rights, or your material breach of these Terms.

This section does not require you to indemnify us for losses caused by our own conduct where such a requirement would be unlawful.

Any indemnification obligation will be interpreted narrowly and consistently with applicable law.

## 20. Suspension and Termination

You may stop using the Services at any time.

We may suspend or terminate access where reasonably necessary to enforce these Terms, address security concerns, comply with legal obligations, or discontinue a service.

Where appropriate and legally required, we will provide notice or an opportunity to remedy a violation.

Termination does not automatically extinguish obligations that arose before termination, including valid payment obligations or rights relating to intellectual property, privacy, disputes, and liability.

Any post-termination data handling will follow our Privacy Policy and applicable law.

## 21. Changes to These Terms

We may revise these Terms as the Services evolve.

The updated version will identify its effective date. Where appropriate, we will provide notice of material changes through the application, website, or another reasonable channel.

Where applicable law requires renewed consent, we will obtain that consent before applying the affected terms.

Continued use of the Services after an update constitutes acceptance only where such acceptance is legally effective. Merely continuing to use a service will not replace consent where explicit consent is required.

## 22. Governing Law and Disputes

These Terms are subject to the laws applicable to the operator and the relevant dispute, without overriding mandatory consumer protections.

The applicable legal entity, jurisdiction, and dispute resolution procedure must be identified before publication: [Governing Jurisdiction and Dispute Procedure]

Nothing in this section removes any right to bring a claim before a court or authority where applicable law preserves that right.

## 23. General Provisions

**Entire Agreement:** These Terms, together with policies and agreements expressly incorporated into them, govern your use of the relevant Services.

**Severability:** If a provision is held unenforceable, the remaining provisions will continue to apply to the extent legally permitted.

**No Waiver:** Failure to enforce a provision immediately does not automatically waive the right to enforce it later.

**Assignment:** Any transfer of rights or obligations is subject to applicable law and any required consent.

**Third-Party Rights:** These Terms do not grant enforcement rights to third parties except where expressly provided by law or agreement.

**Language:** If translated versions conflict, the controlling version will be identified in the applicable service documentation, subject to applicable law.

## 24. Contact Information

For legal notices, questions, or concerns relating to these Terms:

- **Operator:** [Full Legal Name]
- **Support Email:** [Official Support Email]
- **Website:** [Official Website URL]
- **Legal Notices Address:** [Business Mailing Address, if applicable]

Please include sufficient information to identify the relevant service and the nature of your request.
`;

export const privacySeedSummary =
  "Initial Privacy Policy, written from what the app actually collects and does today (accounts, profiles, messages, sessions with partial IPs, hashed-IP server logs, ID checks deleted after review, peer-to-peer voice, Gmail email, push, Discord error alerts, 14-day account deletion and data export). Fill in every [placeholder] (operator, privacy contact, hosting location, providers, retention periods, legal bases) and have it reviewed before publishing. Update it whenever the app starts collecting something new.";

export const privacySeedContent = `# Nexus Forge Gaming Privacy Policy

**Effective Date:** [Effective Date]
**Last Updated:** October 11, 2026
**Operated By:** [Legal Operator Name]
**Privacy Contact:** [Privacy Contact Email]

This Privacy Policy explains what information Nexus Forge Gaming ("Nexus Forge," "we," "us," or "our") collects when you use our app, website and related services (the "Services"), how we use it, who can see it, and the choices you have. It should be read together with our [Terms of Service](/legal/terms).

We do not sell your personal information, and we do not show third-party advertising or use advertising trackers.

## 1. Information You Give Us

### 1.1 Account information

When you create an account we collect your username, email address, password and date of birth. Your password is stored only as a one-way cryptographic hash; we cannot see it. Your date of birth is used to confirm you are 18 or older.

If you choose to, you can also add a phone number (for sign-in codes and account recovery) and turn on two-factor authentication. If you use an authenticator app, we store its secret in encrypted form and store your recovery codes only as one-way hashes.

### 1.2 Profile information

Anything you add to your profile, such as a display name, avatar or avatar design, banner, bio, clan tag, social links, cosmetic items you own or equip, your current activity, and live-stream details if you go live. Most profile information is visible to other users (see section 5).

### 1.3 Content and activity

The content you create and the actions you take in the Services, including:

- Messages, replies, reactions, pins and files you send in forges (community servers) and channels.
- Direct messages and group direct messages, and their attachments.
- Posts, comments and likes in the feed.
- Forges you create or join, your roles and nickname in each, and forge settings you manage.
- Friends, friend requests, follows and the people you block.
- Events you create or respond to.
- Coins, transfers, rewards, jackpot entries, mining activity and purchases of digital items.

### 1.4 Age verification

Signing up requires you to confirm your date of birth. You may also choose to verify your age with a government ID (and, optionally, a selfie) to unlock age-verified features. These images are reviewed by authorized Nexus Forge staff and are **deleted as soon as the review is completed**, whether it is approved or rejected. We keep a record of the outcome, the type of document and the date of birth you declared. If you delete your account while a submission is still waiting for review, the images are deleted with it.

### 1.5 Support requests, reports and appeals

When you contact support, report a message, or appeal a decision, we collect what you send us. When you report a message, we save a copy of the reported message so it can still be reviewed if it is later deleted.

### 1.6 Payments

If we offer paid features, payments are handled by [Payment Processor]. We receive confirmation of the purchase (such as what you bought, the amount, and the subscription status) but we do not receive or store your full card number.

## 2. Information We Collect Automatically

### 2.1 Sign-in sessions and devices

For each device you sign in on, we record the time you signed in and last used it, the browser or app and operating system (from your device's user agent), and the **first part** of your IP address (for example, "203.0.113.x") so you can recognize your own sessions and so we can warn you about sign-ins from new devices. You can see and sign out of these sessions in Settings.

### 2.2 Server logs

Our servers record each request (such as the page or action requested, the time and the result) to keep the Services running and secure. In these logs your IP address is replaced with a one-way hash rather than being stored in full. Server logs are kept for [Server Log Retention Period].

### 2.3 Presence and activity

While you are signed in we record whether you are online and when you were last seen, so your friends and forge members can see your status. You can choose to appear offline (Invisible) and can hide your online status and activity in your privacy settings.

### 2.4 Notifications

We keep the notifications we send you so they appear in your inbox. If you turn on push notifications, your browser gives us a push address for your device; we use it only to deliver Nexus Forge notifications, and you can turn it off at any time.

### 2.5 Link previews

When a message contains a link, our server visits that page to show a preview (its title, description and image), and serves the preview image itself. This means the linked site sees a request from our server, not from you or the people reading the message. If you click the link, your browser visits the site directly.

### 2.6 Cookies and local storage

We use a small number of cookies and browser storage that are needed for the Services to work. We do not use advertising or cross-site tracking cookies. See our [Cookie Policy](/legal/cookies) for the details. In short:

- A secure, HTTP-only cookie that keeps you signed in.
- A cookie that protects your account against cross-site request forgery.
- Browser storage that remembers your sign-in on that device (if you chose to stay signed in), your selected forge, collapsed channel categories, and whether you turned on push notifications.

## 3. Information From Other Sources

- **Other users.** Other people may share information about you, for example by mentioning you, adding you to a group conversation, or reporting content.
- **Connected services.** If you connect a third-party account or use a Nexus Forge integration (for example, with Discord), we receive the information that service shares with us, according to its own settings and policies.

## 4. How We Use Information

We use information to:

- Provide the Services: create and secure your account, deliver messages, run forges, voice, events, the feed, rewards and the other features you use.
- Keep you and others safe: verify age, prevent fraud, spam and abuse, review reports, enforce our Terms and rules, and investigate security incidents.
- Protect your account: detect sign-ins from new devices, send sign-in and verification codes, and support two-factor authentication.
- Communicate with you: send verification, security, account and support emails, and the in-app and push notifications you choose to receive.
- Operate and improve the Services: troubleshoot problems, understand how features are used (in aggregate, within Nexus Forge), and plan capacity.
- Meet legal obligations and respond to lawful requests.

[Legal Bases Statement for Users in the EEA, UK or Other Jurisdictions That Require One]

## 5. Who Can See Your Information

- **Anyone signed in to Nexus Forge** can see your username, display name, avatar, profile, and your position on leaderboards.
- **Members of a forge** can see the messages, reactions and files you post in channels they can access, your nickname and roles there, and your online status (unless you hide it).
- **People in a direct message** can see the messages and files sent in that conversation.
- **Files you upload** are stored with hard-to-guess addresses; anyone who has the link to a file can open it, so be careful where you share links.
- **Forge moderators and owners** can see reports about messages in their forge (including who sent the report), their forge's audit log, and can take moderation actions under our rules. The person you report is never told who reported them.
- **Authorized Nexus Forge staff** can access information when needed to provide support, review ID submissions and reports (including reported direct messages), investigate abuse, and keep the Services secure.

## 6. Voice and Video

Voice and video calls currently connect participants **directly to each other** (peer-to-peer). Your audio and video are not recorded by Nexus Forge and do not pass through our servers. Because the connection is direct, **the other people in a call can see your device's IP address**. To set up these connections, your device contacts connection-helper (STUN) servers operated by Google, which can see your IP address. If we move voice to a relay or media server in the future, we will update this policy.

## 7. How We Share Information

We share information only as described in this policy:

- **Service providers** that process information on our behalf to run the Services, including: [Hosting Provider and Location]; Google (email delivery and voice connection setup); browser and operating-system push services (to deliver push notifications you turn on); Discord (for Nexus Forge's Discord integration and to alert our team about technical errors); [SMS Provider], if SMS codes are enabled; and [Payment Processor], if payments are enabled. They may use the information only to provide their service to us.
- **Other users**, as described in section 5, according to the features you use and your settings.
- **Legal and safety reasons**, when we believe in good faith it is required by law or a valid legal process, or necessary to prevent harm, fraud or abuse, or to protect the rights and safety of users, Nexus Forge or others.
- **Business changes**, if Nexus Forge is involved in a merger, acquisition or sale of assets, subject to this policy.
- **With your consent** or at your direction.

We do not sell personal information and do not share it for cross-context behavioral advertising.

## 8. How Long We Keep Information

- **Account information** is kept while your account exists.
- **Messages and content** are kept until you delete them, they are removed by moderation, or the forge or conversation is deleted.
- **ID verification images** are deleted as soon as they are reviewed; the outcome record is kept while your account exists.
- **Sign-in sessions** expire automatically and their records are kept so you can review recent activity.
- **Verification codes** expire after a few minutes.
- **Reports, moderation records and audit logs** are kept for as long as needed to keep the Services safe and to handle appeals: [Moderation Record Retention Period].
- **Coin, purchase and transaction records** are kept for as long as needed for accounting, fraud prevention and legal requirements.
- **Server logs** are kept for [Server Log Retention Period].

## 9. Deleting Your Account

You can delete your account in Settings → Account. After you confirm with your password:

- You are signed out on every device, and we email you.
- You have **14 days** to change your mind by signing in and choosing "Keep my account."
- After that, your account is permanently erased: your email, password, profile, phone number, date of birth, friends, follows, forge memberships, feed posts and comments, notifications, devices, authenticator settings and any ID verification data are removed.
- Messages you sent in forges and direct messages stay so other people's conversations still make sense, but they are shown as sent by a "deleted user" and are no longer linked to anything that identifies you.
- Coin and transaction records are kept without your identifying details where needed for accounting and fraud prevention.

Before you can delete your account you will need to transfer or delete any forges you own, delete bot apps you own, and cancel any active subscription, so that other people's communities aren't affected.

## 10. Your Choices and Rights

- **See and download your data.** Settings → Account → "Download my data" gives you a copy of your account, profile, settings, forges, friends, sessions, coins and transactions, events, support tickets, notifications, messages, direct messages, posts and comments.
- **Correct your information.** You can change your profile, email, password and settings at any time.
- **Control your privacy.** Choose who can send you friend requests and direct messages, whether others can see your online status and activity, how media is filtered, appear Invisible, and block people.
- **Control notifications.** Choose which notifications you get, set quiet hours, and turn push notifications on or off.
- **Delete your account.** See section 9.

Depending on where you live, you may have additional rights, such as to object to or restrict certain processing, or to complain to a data protection authority. To exercise any right, contact us at [Privacy Contact Email]. We may need to confirm your identity before acting on a request, and we will respond within the time required by applicable law.

## 11. Security

We protect information with measures that include hashed passwords, encrypted authenticator secrets, optional two-factor authentication, alerts for sign-ins from new devices, the ability to sign out other sessions, access controls that limit staff access to what their role requires, and records of moderation and administrative actions. No service can guarantee perfect security; if you believe your account has been compromised, change your password, sign out other sessions, and contact us.

## 12. Age Requirement

Nexus Forge Gaming is for people aged 18 and older. We do not knowingly collect information from anyone under 18. If we learn that an account belongs to someone under 18, we will close it. If you believe a minor is using Nexus Forge, please contact us.

## 13. International Transfers

Nexus Forge is operated from [Hosting Provider and Location], and our service providers may process information in other countries. Where the law requires it, we use appropriate safeguards for these transfers.

## 14. Changes to This Policy

We may update this policy as the Services change. Each version shows its effective date, and earlier versions remain available in the Legal Center. If a change is significant, we will tell you in the app before it takes effect and, where the law requires it, ask for your consent again.

## 15. Contact Us

- **Operator:** [Legal Operator Name]
- **Privacy Contact:** [Privacy Contact Email]
- **Legal Notices Address:** [Business Mailing Address, if applicable]

Please tell us which account your request is about. Never send us your password or sign-in codes.
`;
