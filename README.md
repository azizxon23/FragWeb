# FragWeb

A pre-owned perfume marketplace for Uzbekistan. The responsive website includes English, Russian, and Uzbek, a searchable product grid, location/gender filters, price sorting, saved items, listing details, seller contact through Telegram, and a two-step listing form.

## Current state

This is a working first version, published as an owner-private preview. Listings are stored in Cloudflare D1; photos are in R2. These are shared server resources, not browser storage. Only favorites and the language preference are stored on the visitor's device.

An empty marketplace displays clearly labelled **sample listings** with bottle illustrations. These are not real offers, cannot be contacted, and are never inserted into the database. Actual listings require the seller's own photos, account sign-in, name, current city/region, Uzbek phone number, Telegram username, packaging, description, price, total volume, and remaining volume. Phone numbers and account identifiers are excluded from listing responses. Birthplace is not collected.

Buyers and sellers chat directly on Telegram. There is no in-site messaging, payment processing, delivery service, or authenticity verification. Sellers can mark their own listings as sold under **My listings**. Photos are validated by type signatures and limited to four per listing, 5 MB per file.

## Open in VS Code and Codex

Target GitHub repository: https://github.com/azizxon23/FragWeb.git

If the source has already been pushed:

```bash
git clone https://github.com/azizxon23/FragWeb.git
cd FragWeb
npm ci
npm run build
```

Otherwise extract the source archive, open its folder in VS Code, and initialize/push it using your GitHub account. This project does not contain GitHub credentials. The hosted source repository is separate from the user's GitHub repository; configuring a remote alone does not prove a push occurred.

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
npm run build
```

Tests cover validation boundaries, catalog ranking, unknown matches, and valid/tampered/expired Telegram signatures. Browser checks cover catalog display, finder, filtering, saved items, translations, and sign-in gating. Full authenticated publishing and real Telegram client end-to-end checks require a signed-in deployment / connected bot.

## Before a public launch

Add reporting, moderation, seller verification, listing edit/delete, account deletion, rate limits, upload cleanup, pagination beyond 200 results, and an operational privacy/contact process. Review Uzbek data-hosting and consumer rules with qualified local advice. Contact and payment are currently arranged directly between users.

On Sites, ChatGPT identity headers are injected by the trusted dispatch layer. On any other host, do not trust client-provided `oai-authenticated-user-id` headers: replace that authentication path with verified sessions or Telegram validation, and strip incoming identity headers at the edge. Keep the API and database server-side.

## Assets

Hero photograph: https://images.unsplash.com/photo-1541643600914-78b084683601 (Unsplash). Sample bottle illustrations are authored SVG, not seller photographs. Fonts: DM Sans, Manrope, Playfair Display (Google Fonts).
