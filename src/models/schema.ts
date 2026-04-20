import {
  uuid,
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  firstName: varchar("first_name", { length: 25 }),
  lastName: varchar("last_name", { length: 25 }),

  profileImageURL: text("profile_image_url"),

  email: varchar("email", { length: 322 }).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),

  password: varchar("password", { length: 66 }),
  salt: text("salt"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const applicationsTable = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),

  applicationName: varchar("application_name", { length: 100 }).notNull(),
  applicationURL: text("application_url").notNull(),
  redirectURI: text("redirect_uris").notNull(),

  clientId: varchar("client_id", { length: 100 }).notNull(),
  clientSecret: varchar("client_secret", { length: 100 }).notNull(),

  code: varchar("code", { length: 100 }),
  codeUserId: uuid("code_user_id"),
  codeExpiresAt: timestamp("code_expires_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});