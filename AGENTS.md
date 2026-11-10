# FragWeb instructions for Codex

FragWeb is a marketplace for pre-owned perfumes in Uzbekistan. Preserve the cream/plum visual direction and responsive grid. Support English, Russian, and Uzbek throughout every user-facing feature.

## Architecture

- TypeScript, React, Vinext/Vite, Cloudflare Workers.
- D1 is the single source of truth for listings. R2 stores photos. Do not move marketplace records into localStorage.
- A future Telegram bot and Mini App must use the same server data layer and database. Do not create a separate bot database.
- Keep phone numbers and owner IDs out of public API responses. Collect current city/region, not birthplace or home address.
- All writes require verified identity, same-origin protection, and server validation. Owner-only changes must enforce ownership in the SQL query.
- Sites identity headers are trusted only behind Sites dispatch. Standalone hosts need verified sessions / edge header stripping.
- No secrets in source, browser bundles, logs, or Git. Telegram initData must be validated on the server, including freshness.
- Sample cards must stay labelled and must not become real database records or contactable offers.
- Current finder is name matching against a starter catalog, not AI photo recognition. Do not claim otherwise.

## Accounts and authorization

- Marketplace `/` and dark admin portal `/admin` are separate experiences. Never put admin controls or badges in seller profiles.
- Admin APIs require a separate HttpOnly password session bound to verified ChatGPT identity. The protected owner uses FRAGWEB_OWNER_EMAIL and FRAGWEB_OWNER_PASSWORD_HASH runtime secrets; additional administrative identities live in admin_accounts, separate from profiles. Admins may add/revoke other admins with required audit reasons. Never expose hashes, grant access from a claimed email, remove the protected owner, or make the first registrant an admin.
- Marketplace credentials live in marketplace_accounts, with normalized unique emails and verified identity keys. Signup, legacy password setup and login are distinct; only initial setup uses trusted email verification. Native marketplace writes require its separate password session, never only a platform/admin session. New signup creates a User profile without admin privileges.
- Optional Google/Gmail and Telegram sign-in use server-validated OIDC + PKCE; SMS uses provider-verified one-time codes. Never activate unconfigured methods or claim they work without credentials. Keep phone optional unless the SMS method is selected.
- external_identities are linked only through an explicit authenticated flow. Never merge based only on claimed identifiers, reuse an identity across profiles, or infer admin status from a provider account. Market sessions belong to profiles, including external profiles with no marketplace password.
- Admin password sessions expire after 8 hours; revocation invalidates sessions immediately. Keep login rate limits, same-origin checks, and server enforcement. Public browsing is anonymous; uploads, selling and profile writes require verified identity.
- User-detail APIs require admin authorization; never return password hashes or tokens. Label marketplace profiles as User and keep admin identities in the separate Administrators section.
- Avatars require upload purpose and ownership validation, valid image types and size limits.
- Cleanup archives only the specifically approved test listing, preserves other profiles/listings and requires the owner admin session. Never reset the database for a cleanup request.
- Keep all private contact data out of public profile/listing responses. Admin and owner endpoints may expose only the data appropriate for that role.
- Suspended profiles must be excluded from public listings and must be blocked from write actions, including uploads.
- Likes/comments use D1 and marketplace sessions, never device-only state or admin identity. One like per profile/listing; public activity excludes hidden/deleted comments and suspended authors. Comment deletion enforces author ownership in SQL. Admin comment moderation requires a reason and atomic audit.
- Admin mutations must include a reason and atomically record an audit event. Preserve the owner suspension guard.
- User-visible errors must use stable codes from lib/errors.ts and be localized in EN/RU/UZ. Browser-language validation popovers are disabled; never remove server validation.

## Commands

```bash
npx tsc --noEmit
node --experimental-strip-types --test tests/domain.test.mjs
node --test tests/api.test.mjs
node --test tests/providers.test.mjs
node --test tests/engagement.test.mjs
npm run build
```

Read README.md for local database migration and Mac setup. Preserve `sites()` in vite.config.ts. Append migrations; do not rewrite applied SQL or Drizzle snapshots. Never commit .env files, .dev.vars, .wrangler, .sites-runtime, node_modules, or dist.

## Next milestones

1. Keep GitHub main and the hosted release on identical source trees. The Mac auto-sync only fast-forwards a clean checkout. Never overwrite local work, commit runtime secrets, or claim local synchronization without evidence.
2. Add seller edit/delete, account deletion, reporting, and rate limits. Profiles, reversible admin moderation, and action audit logging are implemented.
3. Create Telegram integration only when the user supplies the bot/channel configuration securely. Add webhook deduplication and an outbox before automated channel posts.
4. Extend the catalog, then optionally evaluate a photo recognition service with confidence thresholds and human confirmation.

The user prefers complete implementation and concise explanations. Preserve existing user changes. Do not build payments, commissions, or shipping integrations without a request.
