import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL && process.env.NODE_ENV !== "test") {
  console.warn("smokemap: DATABASE_URL not set");
}

export const sql = neon(DATABASE_URL || "");
