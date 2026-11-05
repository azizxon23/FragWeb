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
    status: text("status").notNull().default("active"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [uniqueIndex("profiles_owner_unique").on(table.ownerId)],
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
