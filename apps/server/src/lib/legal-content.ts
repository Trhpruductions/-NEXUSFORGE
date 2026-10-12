/**
 * Starting text for legal documents, loaded once as a draft "in review" when a policy has
 * no versions yet. After that the text is managed from the Legal admin dashboard and
 * lives in the database. Bracketed [placeholders] block publishing until filled in.
 */

export const legalPolicyCatalog = [
  { slug: "terms", title: "Terms of Service", summary: "The agreement between you and Vexora Gaming for using the app and its services.", sortOrder: 1, requiredAtSignup: true },
  { slug: "privacy", title: "Privacy Policy", summary: "What information we collect, why, and the choices you have.", sortOrder: 2, requiredAtSignup: true },
  { slug: "eula", title: "End User License Agreement", summary: "Terms for installing and running the Vexora desktop and mobile apps.", sortOrder: 3, requiredAtSignup: false },
  { slug: "acceptable-use", title: "Acceptable Use Policy", summary: "What you may and may not do on Vexora Gaming.", sortOrder: 4, requiredAtSignup: false },
  { slug: "community-rules", title: "Community Rules", summary: "How to treat other players in forges, chat, voice and events.", sortOrder: 5, requiredAtSignup: false },
  { slug: "refunds", title: "Refund Policy", summary: "Purchases, subscriptions, cancellations and refunds.", sortOrder: 6, requiredAtSignup: false },
  { slug: "cookies", title: "Cookie Policy", summary: "Cookies and similar storage the app uses.", sortOrder: 7, requiredAtSignup: false },
  { slug: "ip", title: "Intellectual Property Policy", summary: "Copyright and trademark complaints, and how we handle them.", sortOrder: 8, requiredAtSignup: false },
  { slug: "moderation", title: "Moderation Policy", summary: "How reports are reviewed and what actions moderators can take.", sortOrder: 9, requiredAtSignup: false },
  { slug: "appeals", title: "Appeals Policy", summary: "How to appeal a moderation or account decision.", sortOrder: 10, requiredAtSignup: false },
] as const;

export const termsSeedSummary =
  "Initial Terms of Service, adapted to Vexora Gaming (name, and section 6 describes forges, voice, events and integrations instead of Rust/GTA servers). Fill in every [placeholder] (operator, contact, website, effective date, jurisdiction) and have the liability, indemnity, dispute and payment sections reviewed before publishing.";

export const termsSeedContent = `# Vexora Gaming Terms of Service

**Effective Date:** [Launch Date]
**Last Updated:** October 11, 2026
**Operated By:** [Legal Operator Name]
**Contact:** [Official Support Email]
**Website:** [Official Website URL]

## 1. Introduction and Acceptance

Welcome to Vexora Gaming ("Vexora," "we," "us," or "our").

These Terms of Service ("Terms") govern your access to and use of the Vexora Gaming application, website, Discord integrations, gaming servers, software, digital features, community services, and any other products or services we make available (collectively, the "Services").

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

Vexora provides community servers ("forges"), text, voice and video channels, events and tournaments, and integrations with games and other platforms.

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

The Services may contain software, source code, branding, graphics, logos, designs, text, documentation, interfaces, and other materials owned by or licensed to the relevant Vexora operator.

Except for the limited license expressly granted in these Terms, no ownership rights are transferred to you.

You must not claim ownership of our proprietary materials or commercially exploit them without authorization.

Any separately commissioned software, graphics, development work, or other deliverables will be governed by the applicable written agreement.

Third-party names, logos, games, and trademarks belong to their respective owners. Their appearance in the Services does not imply endorsement or ownership by Vexora.

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
