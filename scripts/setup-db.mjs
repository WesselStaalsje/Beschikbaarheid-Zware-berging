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
await sql`CREATE TABLE IF NOT EXISTS depots (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
)`;
await sql`ALTER TABLE responders ADD COLUMN IF NOT EXISTS depot_id TEXT`;
await sql`ALTER TABLE responders ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`;
await sql`ALTER TABLE responders ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
await sql`ALTER TABLE responders ADD COLUMN IF NOT EXISTS activity_note TEXT`;
await sql`ALTER TABLE responders ADD COLUMN IF NOT EXISTS vehicle_number TEXT`;
await sql`CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pin_salt TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
await sql`CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
await sql`CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at)`;
await sql`
  INSERT INTO admin_settings (id, pin_salt, pin_hash)
  VALUES (1, '04cfb4a90c4363b20babd4d511ff7fa8', 'bcdf4b809f17a287a21416c86742972b7b2628b185fbd526bb5cbb15e3a7a10be09be5e0c032e60ac8022938567c519cb1380b48960140badfd7ec2b6b1d447d')
  ON CONFLICT (id) DO NOTHING
`;

const depots = ["Eindhoven", "Duiven", "Ede", "Ermelo", "Breda", "Roosendaal", "Veghel", "Hulten"];
for (const [sortOrder, name] of depots.entries()) {
  const id = name.toLowerCase();
  await sql`INSERT INTO depots (id, name, sort_order) VALUES (${id}, ${name}, ${sortOrder}) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`;
}

const seedResponders = [
  ["eindhoven-twan", "Twan", "eindhoven", 0], ["eindhoven-simon", "Simon", "eindhoven", 1],
  ["duiven-erik", "Erik", "duiven", 0], ["duiven-hans-peter", "Hans-Peter", "duiven", 1],
  ["ede-timothy", "Timothy", "ede", 0], ["ermelo-jordi", "Jordi", "ermelo", 0],
  ["breda-arthur", "Arthur", "breda", 0], ["roosendaal-jorgen", "Jörgen", "roosendaal", 0],
  ["veghel-paul", "Paul", "veghel", 0],
];
for (const [id, name, depotId, sortOrder] of seedResponders) {
  const depot = depots.find((item) => item.toLowerCase() === depotId);
  await sql`
    INSERT INTO responders (id, name, depot, depot_id, sort_order, status)
    VALUES (${id}, ${name}, ${depot}, ${depotId}, ${sortOrder}, 'off-duty')
    ON CONFLICT (id) DO UPDATE SET depot_id = COALESCE(responders.depot_id, EXCLUDED.depot_id), sort_order = EXCLUDED.sort_order
  `;
}
await sql`UPDATE responders SET depot_id = LOWER(depot) WHERE depot_id IS NULL`;
await sql`DELETE FROM admin_sessions WHERE expires_at < NOW()`;
console.log("Database is gereed.");
