**DRAFT FOR COUNSEL REVIEW. Not in effect until published by the operator. Texas law.**

# Nexus Forge Gaming Cookie Policy

**Draft pending attorney review. This document is not final.**

**Version 1.0 (draft)**
**Effective date:** the date this version is published by the operator
**Operator:** TRH Development, a sole proprietorship owned and operated by Hank

This Cookie Policy explains the cookies and browser storage that Nexus Forge Gaming uses in the Services. It should be read with our Privacy Policy, which explains how we use the personal data involved. The Services are the Nexus Forge Gaming website at https://nfgcord.com, the web app at https://nfgcord.com/app, and the Windows desktop app.

## 1. Cookies and browser storage

A cookie is a small piece of data that a website stores in your browser, and that the browser sends back to the website with later requests. Browser storage, called local storage and session storage, works in a similar way, but the app reads it in your browser and it is not sent to our servers automatically.

## 2. Our approach

We use only the cookies and storage that the Services need in order to work: to keep you signed in, to protect your account, to record your age confirmation, and to remember a few choices. We do not use advertising cookies, analytics cookies, tracking cookies or social media cookies. The Services do not include third-party advertising, analytics or tracking scripts.

Every item in this policy is used only to run the Services or to remember a choice you have made in them. None is set for advertising or tracking, so there are no optional advertising or tracking cookies to switch off. Clearing the items that keep you signed in or protect your account stops the Services from working for you, as Section 8 explains. Clearing the items that only remember your choices resets those choices and nothing more.

## 3. Cookies we set

| Name | What it is for | Lifetime | Settings |
|---|---|---|---|
| nf_refresh | Keeps you signed in. It holds a sign-in token that page scripts cannot read. | 30 days by default, or until you sign out | HTTP-only, Secure on production connections, SameSite=Lax, path / |
| nf_csrf | Protects your account against requests made by other websites on your behalf. The app sends the same value back in a request header, and the server refuses changes where the two do not match. | Same as nf_refresh | Not HTTP-only, so page scripts can read it. Secure on production connections, SameSite=Lax, path / |
| nexusforge_age18, or __Host-nexusforge_age18 on secure production connections | Records that you confirmed you are 18 or older, so you are not asked on every visit. The value is a signed token that records when you confirmed and a short hash of your browser's user-agent string. It does not contain your date of birth. | Five years | HTTP-only, Secure on production connections, SameSite=Strict, path / |

The nf_refresh and nf_csrf cookies are set when you sign in and are refreshed as your sign-in is renewed. When you sign out, the server removes both of them. The age-gate cookie is set when you confirm that you are 18 or older. If you choose to leave the age gate, the app removes it.

## 4. Browser storage the app uses

The web app also stores the following items in your browser. The items marked "this browser" stay in that browser until they are removed; the items marked "this session" are removed when that browser session ends.

| Key | Where | What it is for |
|---|---|---|
| nexusforge-auth-session | Local storage if you chose to stay signed in, otherwise session storage | Your sign-in state: a short-lived access token, the CSRF value that matches nf_csrf, and the profile details the app needs to show your account. |
| nexusforge-auth-persist-mode | Local storage | Remembers whether your sign-in state is kept in local storage or in session storage. |
| vexora-workspace | Local storage | Remembers the Forge you last selected. |
| vx-collapsed-categories | Local storage | Remembers which channel categories you have collapsed. |
| nf-get-started-dismissed | Local storage | Remembers that you dismissed the "Get started" panel. |
| nf-media-prefs:<your user ID> | Local storage | Your voice and video device choices. There is one saved entry for each account on the browser. |
| vx-suspension | Session storage | Details of an account suspension, kept so that the suspension notice can still be shown after the page is reloaded. |
| nf-stale-build-reload | Session storage | A short marker, removed after 60 seconds, that stops the app reloading again and again when a new version of the app has been published. |

The access token in the sign-in state is short-lived. The app renews it with the nf_refresh cookie, so the access token does not keep you signed in by itself.

## 5. The desktop app

The Windows desktop app stores its data on your computer, in the app's own data folder. That folder holds the browser data the app needs for the Services, which includes the cookies and storage described in this policy, and the desktop app's own files. Those files include the window position and size, your desktop preferences, the state of update checks, startup and local logs, and any downloaded update files. Removing the app's data folder, or uninstalling the app and deleting that folder, removes this data from your computer. Signing out removes the sign-in cookies and the sign-in session the app keeps.

## 6. Third-party services

Most of the Services run from our own website. The app's fonts are served from our website, so your browser does not contact a font provider when you use the app.

Two services are used in the Services and set their own storage:

- **Stripe** runs the checkout and billing pages for purchases. Those pages are operated by Stripe and are governed by Stripe's cookie policy, not this one.
- **Discord** is used only if you choose to link a Discord account. Discord's own cookies and policy apply on Discord's websites.

Link previews are built by our server, so the websites that a link points to do not receive your browser's cookies from us, and they do not set cookies in your browser when a preview is built.

## 7. How to control cookies and storage

You can view, block and delete cookies and site data in your browser's privacy or site settings. The exact menus differ between browsers, so look for the section on cookies and site data. You can also delete the browser storage for the Services from the same settings, or by clearing the site data for nfgcord.com.

Deleting the cookies or storage described in this policy signs you out, and the app will ask you to sign in again. Deleting the age-gate cookie means you will be asked to confirm your age again.

## 8. What happens if you block them

Blocking or deleting these cookies and storage affects the Services as follows.

- **Blocking nf_refresh** means the app cannot keep you signed in. When your current sign-in expires, you will be signed out, and you will not be able to sign in again until the cookie is allowed.
- **Blocking nf_csrf** means the Services refuse any request that changes your data, such as sending a message, saving a profile or making a purchase, and show an error when you try.
- **Blocking the age-gate cookie** means you will be shown the age gate on every visit, and you cannot use the Services until you confirm your age.
- **Blocking local storage or session storage** means the app cannot keep your selected Forge, your display and device choices, or the sign-in state kept there. The app can still renew your sign-in from nf_refresh if that cookie is allowed.

The sign-in cookies, the CSRF cookie and the age-gate cookie are needed to use the Services. Blocking browser storage removes saved choices and stored sign-in state, but the Services can still work while the cookies are allowed.

## 9. Changes to this policy

We will update this Cookie Policy when we add, remove or change a cookie or a type of storage. We will also update the version number and effective date. The Privacy Policy describes how we tell you about material changes.

## 10. Contact us

To ask a question about this Cookie Policy, or to make a privacy request, use the Support page at https://nfgcord.com/support. Never send us your password or sign-in codes.

- **Operator:** TRH Development, a sole proprietorship owned and operated by Hank
- **Website:** https://nfgcord.com
