import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const listings = sqliteTable("listings", {
 id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), seller: text("seller").notNull(), phone: text("phone").notNull(), telegram: text("telegram").notNull(), city: text("city").notNull(), brand: text("brand").notNull(), name: text("name").notNull(), gender: text("gender").notNull(), size: integer("size").notNull(), remaining: integer("remaining").notNull(), price: integer("price").notNull(), condition: text("condition").notNull(), description: text("description").notNull(), photos: text("photos").notNull(), status: text("status").notNull().default("active"), createdAt: integer("created_at").notNull()
});
