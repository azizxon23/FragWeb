# FragWeb

A pre-owned perfume marketplace for Uzbekistan. The responsive website includes English, Russian, and Uzbek, a searchable product grid, location/gender filters, price sorting, saved items, listing details, seller contact through Telegram, and a two-step listing form.

## Current state

This is a working marketplace with public browsing and a separate protected admin portal. Listings are stored in Cloudflare D1; photos are in R2. These are shared server resources, not browser storage. Only favorites and the language preference are stored on the visitor's device.

An empty marketplace displays clearly labelled **sample listings** with bottle illustrations. These are not real offers, cannot be contacted, and are never inserted into the database. Actual listings require the seller's own photos, account sign-in, name, current city/region, Uzbek phone number, Telegram username, packaging, description, price, total volume, and remaining volume. Phone numbers and account identifiers are excluded from listing responses. Birthplace is not collected.

Buyers and sellers chat directly on Telegram. There is no in-site messaging, payment processing, delivery service, or authenticity verification. Sellers create a reusable profile with private contact details and can mark their own listings as sold under **My listings**. Public seller profiles show only their name, city, Telegram, bio, join date, and active listing count. Photos are validated by type signatures and limited to four per listing, 5 MB per file.

## Accounts, administrator access, and translated validation

The public marketplace lives at `/`; **Log in / Sign up** opens `/account`. The email/password registration path creates a password and requires email ownership verification through the existing ChatGPT sign-in service. After password signup, ordinary logins use email and password directly; a ChatGPT session alone never signs someone into the marketplace. Optional Google/Gmail and Telegram sign-in use OIDC Authorization Code + PKCE, while optional phone sign-in uses SMS verification. External methods authenticate through the selected provider without requiring a separate marketplace password. Email values are trimmed and lowercased, and the database enforces one credential record per email and verified identity. Concurrent duplicate signups fail atomically without duplicate profiles. Passwords use salted PBKDF2 verifiers; cookies are Secure, HttpOnly and SameSite=Strict and expire after eight hours. Logout and expiry invalidate marketplace access. Login attempts are rate limited by email and edge IP.

Existing passwordless profiles must use **Already had a profile without a password? Set one up**. Verify the original email, create and confirm a password, then log in normally. The setup path preserves the profile ID, listings and contacts, and cannot overwrite an existing password. A new signup using an existing profile/email is rejected. Marketplace and admin passwords/sessions are completely separate. Phone input is never required for email/password, Google or Telegram login; only the explicitly selected SMS flow requests it. Seller-contact requirements are separate from login.

Open **My profile** to save your seller details and choose a profile picture. New signups appear in the admin user list immediately, but need a valid phone/Telegram profile before selling. Avatars use R2 with an explicit upload purpose, ownership checks, a 5 MB limit and JPG/PNG/WebP signature validation. Save the profile to apply the chosen image. Public profiles expose the image and public details; private phone/email and credential/session records remain restricted. Images removed from a profile are detached, not deleted from shared storage.

The marketplace lives at `/`; the separate dark administration portal lives at `/admin`. Public visitors can browse without signing in. Selling, uploads and profile changes require sign-in. Admin controls and badges never appear inside seller profiles. The **Users** section labels every marketplace profile as **User**, even if that person also has a separate admin identity. Click a user to open a keyboard-accessible popup with private contact details, profile picture, account setup status and their 20 most recent listings. Full admin permissions are required on the detail API; passwords, verifiers and session tokens are never returned.

In `/admin`, verify your ChatGPT identity, then enter your administrative email and password. This creates a separate 8-hour HttpOnly, Secure, SameSite=Strict session bound to that verified identity. Marketplace login alone never grants administrative access. The owner email and PBKDF2 password verifier are configured as server runtime secrets `FRAGWEB_OWNER_EMAIL` and `FRAGWEB_OWNER_PASSWORD_HASH`. Missing configuration fails closed. The old `FRAGWEB_ADMIN_EMAILS` allowlist is no longer used. No admin password or verifier is committed to Git or sent to the browser.

The portal includes user/listing search, private contact details, reversible suspension, listing visibility moderation, audit history, and **Administrators**. Administrators can add another verified email with an individual initial password (12–128 characters), or revoke access with a reason. Share initial passwords privately. Revocation invalidates existing sessions immediately. The owner cannot be removed and administrators cannot revoke their own access. Administrative accounts are separate database records from seller profiles; no seller profile is required for an admin identity. A login limit allows five attempts per verified identity in 15 minutes.

For **portable loopback development only**, configure the ignored `.dev.vars` with `FRAGWEB_OWNER_EMAIL` matching the starter's simulated identity and a test-only verifier produced by running `node scripts/admin-password-hash.mjs` (password input is hidden). Never use the simulated identity for a public deployment. Production runtime secrets do not sync through Git. To use the configured production owner on your Mac, use the hosted `/admin` URL.

The admin panel lists marketplace profiles, including new registrations with incomplete seller details. It does not list anonymous visitors or treat external sign-in alone as registration. All admin mutations include a reason and atomically log the change. Admin accounts are protected from suspension. Suspended profiles cannot write, and their public listings/profiles are hidden.

The owner-only **Remove approved test listing** control archives the exact inspected test offer, retains its photo for recovery, preserves all seller profiles/other listings/admins, cleans expired sessions and rate-limit windows, and writes an audit event. It is idempotent and refuses changed test data. The action requires an authenticated owner admin session; deployment itself never silently deletes marketplace records.

Forms use application-owned validation with `noValidate`, so warning language follows the selected EN/RU/UZ language rather than the browser's locale. API failures carry stable codes and localized messages selected with `X-Fragweb-Language: en|ru|uz`. Error codes are translated again by the interface, so an existing error can be rendered in the current language. The server continues to validate all submitted data independently.

## Optional sign-in provider activation

The login and signup screens show Google/Gmail, Telegram and phone choices. Unconfigured providers are visibly unavailable; the app never fakes a successful login or SMS delivery. The `GET /api/auth/providers` response exposes only readiness booleans and the signed-in user's connected provider names, never identifiers or credentials. All provider secrets belong in hosted runtime settings (or the ignored `.dev.vars` for local development), never in Git.

| Method | Runtime settings | External setup |
| --- | --- | --- |
| Google/Gmail | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Create a Google OAuth Web client, configure its consent screen, and register the Google callback below. |
| Telegram | `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET` | Create the FragWeb bot, obtain the Login Widget/OIDC client credentials in BotFather, and register the site and Telegram callback below. Keep the default RS256 algorithm. These OIDC credentials are separate from the bot API token. |
| Phone / SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | Configure a Twilio Verify service and enable delivery to the intended countries, including Uzbekistan. SMS has provider costs and trial restrictions. |

Production callbacks:

- `https://fragweb-market.tanhoneysuckle.chatgpt.site/api/auth/google/callback`
- `https://fragweb-market.tanhoneysuckle.chatgpt.site/api/auth/telegram/callback`

Use corresponding callbacks for every development/custom host and register those exact URLs externally. After adding runtime settings, deploy the saved/current version to apply them. Availability then updates automatically from the server. No provider keys are currently configured in production.

OAuth requests are same-origin POSTs, with a ten-minute, one-use, browser-bound state record, nonce validation, PKCE and fixed provider endpoints. ID-token signatures, issuer, audience, authorized party, expiry, subject, nonce and (for Google) verified email are validated on the server using `jose`. Telegram requests only `openid profile`, without mandatory phone or bot-message permissions. Access/refresh tokens are not retained. The original Sites identity integration remains in place for admin login and the original email-password verification flow.

SMS requests enforce international-number formatting, a browser-bound ten-minute challenge, a resend cooldown, phone/IP quotas and a maximum of five checks. The code is checked by Twilio against the specific verification ID; the server requires an approved result matching the number and service. Verification is consumed once before issuing a marketplace session. The app never stores or logs SMS codes. Test suites mock provider traffic; they never send real messages.

New external registrations create ordinary User profiles. Logging in with an unknown external identity does not silently create a new account. Matching email/phone information is not automatically merged: log into the original account, open **My profile**, and connect the additional method explicitly. Linking is bound to the original password/provider session, and logging out invalidates in-flight linking. The database uniquely constrains provider subjects, one identity per provider per profile, and normalized nonempty profile emails. Multiple phone/Telegram-only accounts may have no email; a phone is not requested by Google/Telegram flows. The admin role is never inferred from an external email or phone.

References: [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [Telegram Login](https://core.telegram.org/bots/telegram-login), [Twilio Verify](https://www.twilio.com/docs/verify/api).

## Open in VS Code and Codex

Target GitHub repository: https://github.com/azizxon23/FragWeb.git

If the source has already been pushed:

```bash
git clone https://github.com/azizxon23/FragWeb.git
cd FragWeb
npm ci
npm run build
```

Your Mac checkout is `~/Developer/FragWeb`. The separately installed per-user sync service checks GitHub main every 30 seconds and only fast-forwards a clean checkout. Keep local changes committed or resolve them explicitly; the service intentionally pauses for a dirty or diverged checkout. This project contains no GitHub credentials. The hosted source repository and GitHub have separate histories; releases must contain the same source tree.

Requires Node.js 22.13 or newer. `AGENTS.md` gives Codex the project requirements and next milestones.

### Local preview on your Mac

A clean clone or source archive automatically uses the portable profile on your Mac:

```bash
npm ci
npm run build
```

Apply the initial migration once to the local database:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_broad_pepper_potts.sql
```

Apply each later migration once in order as well:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_smiling_captain_marvel.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_bored_killmonger.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_cloudy_luke_cage.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_slow_selene.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_moaning_meteorite.sql
```

Do not replay migrations already applied. `git pull` updates source files; it does not install dependencies, migrate your local database, or deploy the hosted site.

Then run:

```bash
npm run dev
```

Open the URL printed by the terminal. The starter's portable loopback sign-in simulation is available at `/signin-with-chatgpt?return_to=/`. It is excluded from production. Managed previews do not simulate sign-in. Local and hosted databases are separate.

## Shared architecture and Telegram

```text
Website / Telegram Mini App -> same API -> D1 listings + R2 photos
Future bot / channel worker -> shared server data layer -> same D1 + R2
```

A Telegram Mini App is this website inside Telegram, not a separate mobile app. The website loads Telegram's official SDK, calls ready/expand, and sends initData to the API. Server-side HMAC validation, expiry checks, and Telegram actor IDs are implemented in `lib/telegram.ts`. They remain inactive until a real `TELEGRAM_BOT_TOKEN` is configured server-side. Do not put bot tokens in browser code, Git, the hosting manifest, or screenshots.

Later setup:

1. Create a bot with BotFather and an associated channel. Add the bot as a channel admin only when publishing to the channel is wanted.
2. Set the bot's Main Mini App / menu URL to the **public HTTPS** deployment. The current owner-private preview is for development and cannot serve as a public marketplace launch.
3. Store `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`, and a webhook secret in the hosting platform's secret store. A standalone Wrangler deployment can use `wrangler secret put` against its own configured Worker.
4. Implement a bot webhook with Telegram's secret-token header and update-id deduplication. Import the shared data layer; never give the browser direct database credentials.
5. Add a transactional outbox for channel publication, retries, and duplicate prevention. Publish approved listings only. Store Telegram message IDs so edits and sold listings update the existing post.

The bot, channel webhook, automated posting, and channel credentials are **not created or connected** in this version. Telegram identity validation has unit tests but requires a real bot for client integration testing.

Official reference: https://core.telegram.org/bots/webapps

## Perfume identification

`lib/catalog.ts` supplies a small starter catalog and a ranked token/prefix name matcher. `/api/identify?q=creed%20aventus` exposes the same matching logic for a future bot. The interface shows candidate perfumes and Fragrantica links. This is **catalog name matching**, not a trained machine-learning or photo-recognition model. Unknown names can be entered manually; the French Avenue Royal Blend entry uses a Fragrantica search link. Expand the curated catalog before relying on broad coverage. Fragrantica is an external reference, not an integrated data provider.

A photo model would need a labelled image dataset, candidate confidence scores, evaluation against similar bottles, and manual confirmation. Do not equate bottle recognition with authenticity verification or scrape Fragrantica without permission.

## Source map

- `app/page.tsx`: responsive marketplace and seller flows
- `app/account-panel.tsx`: seller profiles; `app/admin/`: separate dark admin portal; `app/admin-panel.tsx`: moderation controls
- `app/api/profile`, `app/api/profiles`, `app/api/admin`: owner-scoped and public profile APIs, server-authorized management
- `lib/errors.ts`, `lib/form-validation.ts`: localized errors and accessible client validation
- `app/globals.css`: visual system and mobile layouts
- `lib/i18n.ts`: English, Russian, and Uzbek UI text
- `lib/catalog.ts`: sample data and fragrance name matching
- `lib/validation.ts`: authoritative listing validation
- `lib/auth.ts`, `lib/telegram.ts`: owner identity and Telegram signature validation
- `app/api/listings/route.ts`: read/create and owner-scoped mark-as-sold API
- `app/api/uploads/route.ts`: authenticated image uploads
- `app/api/images/[key]/route.ts`: image delivery
- `db/schema.ts`, `drizzle/`: durable schema and migration history

## Verification

```bash
npx tsc --noEmit
node --experimental-strip-types --test tests/domain.test.mjs
node --test tests/api.test.mjs
node --test tests/providers.test.mjs
npm run build
```

Tests cover validation boundaries, EN/RU/UZ errors, catalog ranking, unknown matches, valid/tampered/expired Telegram signatures, and fail-closed administrator permissions. The isolated Miniflare API test applies every migration and exercises profile privacy, role injection rejection, uploads, ownership, moderation, suspension, restoration, audit logging, and same-origin checks. Test identities and records are temporary and never inserted into the deployed database. Browser checks cover catalog display, finder, filtering, saved items, translations, and sign-in gating. Full authenticated publishing and real Telegram client end-to-end checks require a signed-in deployment / connected bot.

## Known limits

Password recovery/change, email changes and replacing ChatGPT-based email verification with transactional email are not implemented. Keep the verified identity integration when moving hosts, or replace it with a verified email provider. Native password login already works without ChatGPT after account setup.

## Before a public launch

Add reporting, seller verification, listing edit/delete, account deletion, rate limits, upload cleanup, public-catalog pagination beyond 200 results, and an operational privacy/contact process. Administrator search is already paginated at 20 rows per page. D1 indexes support owner and catalog queries. Review Uzbek data-hosting and consumer rules with qualified local advice. Contact and payment are currently arranged directly between users.

On Sites, ChatGPT identity headers are injected by the trusted dispatch layer. On any other host, do not trust client-provided `oai-authenticated-user-id` headers: replace that authentication path with verified sessions or Telegram validation, and strip incoming identity headers at the edge. Keep the API and database server-side.

## Assets

Hero photograph: https://images.unsplash.com/photo-1541643600914-78b084683601 (Unsplash). Sample bottle illustrations are authored SVG, not seller photographs. Fonts: DM Sans, Manrope, Playfair Display (Google Fonts).

## Listing likes, comments, and administrative review

Active, visible listings accept likes and comments from signed-in marketplace users, including accounts without a phone number. D1 stores this activity across devices. Hearts still save favorites on the current device; the separate Like button records a public like. One profile can like a listing once, and clicking again removes its like. Comments are plain text, trimmed to 1–1000 characters, and authors can delete their own comments. Deletion clears the text and cannot be undone by administrators. Likes are limited to 120 requests and comments to 20 posts per account per 15 minutes.

Anonymous visitors can read counts and comments. Public responses contain display names, avatars and public profile IDs, with no private phone/email or authentication IDs. Suspended authors, hidden/deleted comments and inaccessible listings do not expose public activity. Sold/archived listings stop accepting engagement. Comment pages contain 20 records ordered by creation time and ID.

In the dark admin portal, click a listing name or its card to open a native detail dialog with photos, description, price, volume, condition, seller information, paginated likes and comments. Click a seller, liker or commenter to open the existing User details dialog. Administrators can hide/restore comments with a required reason; the update and audit event are atomic. Deleted comments cannot be restored. Administrative and marketplace sessions remain separate.

Migration: `drizzle/0006_purple_vengeance.sql` appends the two engagement tables and indexes without changing existing records. Hosted deployment applies it automatically. Local setups should apply only unapplied migrations using the D1 command above and this filename. Additional verification: `node --test tests/engagement.test.mjs`.

## GitHub Pages and D1

GitHub Pages serves static files. A static frontend can call a separately deployed Cloudflare Worker API backed by D1, but D1 bindings and secrets stay on the Worker. This Vinext application currently deploys its server routes, secure same-origin authentication, D1 and R2 together on Cloudflare Workers; it is not a static Pages export. Moving the frontend alone would require a planned API/authentication migration. GitHub Pages also excludes sites primarily facilitating commercial transactions, so it is not enabled for FragWeb. Keep source in GitHub and use a Cloudflare Workers deployment, optionally connected to GitHub builds, for independent hosting.

References: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Cloudflare D1](https://developers.cloudflare.com/d1/get-started/).
