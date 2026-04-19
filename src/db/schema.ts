import {
  pgTable,
  varchar,
  uuid,
  boolean,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid().defaultRandom().primaryKey(),
  firstName: varchar("first_name", { length: 45 }).notNull(),
  lastName: varchar("last_name", { length: 45 }),

  email: varchar("email", { length: 322 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),

  password: varchar("password", { length: 66 }),
  salt: text("salt"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updateAt: timestamp("updated_at").$onUpdate(() => new Date()),
});
