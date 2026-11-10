import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const listings = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    seller: text("seller").notNull(),
    phone: text("phone").notNull(),
    telegram: text("telegram").notNull(),
    city: text("city").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    gender: text("gender").notNull(),
    size: integer("size").notNull(),
    remaining: integer("remaining").notNull(),
    price: integer("price").notNull(),
    condition: text("condition").notNull(),
    description: text("description").notNull(),
    photos: text("photos").notNull(),
    moderationStatus: text("moderation_status").notNull().default("visible"),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("listings_owner_idx").on(table.ownerId),
    index("listings_catalog_idx").on(
      table.status,
      table.moderationStatus,
      table.createdAt,
    ),
  ],
);

export const profiles = sqliteTable(
  "profiles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    displayName: text("display_name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull(),
    telegram: text("telegram").notNull(),
    city: text("city").notNull(),
    bio: text("bio").notNull().default(""),
    avatar: text("avatar").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("profiles_owner_unique").on(table.ownerId), uniqueIndex("profiles_email_unique").on(sql`lower(trim(${table.email}))`).where(sql`length(trim(${table.email})) > 0`)],
);
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("audit_created_idx").on(table.createdAt)],
);

// Administrative identities and sessions are separate from seller profiles.
export const adminAccounts = sqliteTable('admin_accounts', {
  email: text('email').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  addedBy: text('added_by').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const adminSessions = sqliteTable('admin_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  ownerId: text('owner_id').notNull(),
  email: text('email').notNull(),
  passwordVersion: text('password_version').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const adminAttempts = sqliteTable('admin_attempts', {
  ownerId: text('owner_id').primaryKey(),
  attempts: integer('attempts').notNull(),
  windowStart: integer('window_start').notNull(),
});

export const marketplaceAccounts = sqliteTable('marketplace_accounts', {
  ownerId: text('owner_id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('marketplace_accounts_email_unique').on(table.email)]);
export const marketplaceSessions = sqliteTable('marketplace_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  ownerId: text('owner_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('marketplace_sessions_owner_idx').on(table.ownerId)]);
export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  attempts: integer('attempts').notNull(),
  windowStart: integer('window_start').notNull(),
});

export const externalIdentities = sqliteTable('external_identities', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  subject: text('subject').notNull(),
  ownerId: text('owner_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('external_identity_unique').on(table.provider,table.subject),uniqueIndex('external_owner_provider_unique').on(table.ownerId,table.provider)]);
export const oauthFlows = sqliteTable('oauth_flows', {
  stateHash: text('state_hash').primaryKey(),
  browserHash: text('browser_hash').notNull(),
  provider: text('provider').notNull(),
  verifier: text('verifier').notNull(),
  nonce: text('nonce').notNull(),
  intent: text('intent').notNull(),
  linkOwner: text('link_owner').notNull().default(''),
  linkSessionHash: text('link_session_hash').notNull().default(''),
  returnTo: text('return_to').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const phoneChallenges = sqliteTable('phone_challenges', {
  idHash: text('id_hash').primaryKey(),
  phone: text('phone').notNull(),
  verificationSid: text('verification_sid').notNull(),
  intent: text('intent').notNull(),
  linkOwner: text('link_owner').notNull().default(''),
  linkSessionHash: text('link_session_hash').notNull().default(''),
  returnTo: text('return_to').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
});
