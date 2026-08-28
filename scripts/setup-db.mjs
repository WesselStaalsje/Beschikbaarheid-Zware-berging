import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ontbreekt. Voeg eerst Neon Postgres toe via de Vercel Marketplace.");
}

const sql = neon(process.env.DATABASE_URL);
await sql`
  CREATE TABLE IF NOT EXISTS responders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    depot TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'off-duty' CHECK (status IN ('off-duty', 'available', 'busy')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL DEFAULT 'Meldkamer'
  )
`;
console.log("Database is gereed.");
