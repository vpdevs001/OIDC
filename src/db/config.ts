import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
export const db: Pool = drizzle(process.env.DATABASE_URL!);
