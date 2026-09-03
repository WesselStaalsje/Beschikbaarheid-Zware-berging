import { neon } from "@neondatabase/serverless";
import webpush from "web-push";

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
await sql`CREATE TABLE IF NOT EXISTS push_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;
await sql`CREATE TABLE IF NOT EXISTS standby_roster (
  duty_date DATE PRIMARY KEY,
  person_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'Rooster 2026'
)`;
const pushSettings = await sql`SELECT 1 FROM push_settings WHERE id = 1`;
if (!pushSettings[0]) {
  const keys = webpush.generateVAPIDKeys();
  await sql`INSERT INTO push_settings (id, public_key, private_key) VALUES (1, ${keys.publicKey}, ${keys.privateKey}) ON CONFLICT (id) DO NOTHING`;
}
await sql`
  INSERT INTO admin_settings (id, pin_salt, pin_hash)
  VALUES (1, '04cfb4a90c4363b20babd4d511ff7fa8', 'bcdf4b809f17a287a21416c86742972b7b2628b185fbd526bb5cbb15e3a7a10be09be5e0c032e60ac8022938567c519cb1380b48960140badfd7ec2b6b1d447d')
  ON CONFLICT (id) DO NOTHING
`;

const depots = [
  { id: "eindhoven", name: "Eindhoven" },
  { id: "duiven", name: "Duiven" },
  { id: "ede", name: "Ede" },
  { id: "ermelo", name: "Raamsdonksveer" },
  { id: "breda", name: "Breda" },
  { id: "roosendaal", name: "Roosendaal" },
  { id: "veghel", name: "Veghel" },
  { id: "hulten", name: "Hulten" },
];
for (const [sortOrder, depot] of depots.entries()) {
  const { id, name } = depot;
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
  const depot = depots.find((item) => item.id === depotId)?.name;
  await sql`
    INSERT INTO responders (id, name, depot, depot_id, sort_order, status)
    VALUES (${id}, ${name}, ${depot}, ${depotId}, ${sortOrder}, 'off-duty')
    ON CONFLICT (id) DO UPDATE SET depot_id = COALESCE(responders.depot_id, EXCLUDED.depot_id), sort_order = EXCLUDED.sort_order
  `;
}

const standbyRoster = [
  ["2026-09-01", "Bob", "Rooster september 2026"], ["2026-09-02", "Bob", "Rooster september 2026"],
  ["2026-09-03", "Bob", "Rooster september 2026"], ["2026-09-04", "Bob", "Rooster september 2026"],
  ["2026-09-05", "Bob", "Rooster september 2026"], ["2026-09-06", "Bob", "Rooster september 2026"],
  ["2026-09-07", "Stijn", "Rooster september 2026"], ["2026-09-08", "Stijn", "Rooster september 2026"],
  ["2026-09-09", "Stijn", "Rooster september 2026"], ["2026-09-10", "Stijn", "Rooster september 2026"],
  ["2026-09-11", "Stijn", "Rooster september 2026"], ["2026-09-12", "Stijn", "Rooster september 2026"],
  ["2026-09-13", "Stijn", "Rooster september 2026"],
  ["2026-09-14", "Nick", "Rooster september 2026"], ["2026-09-15", "Nick", "Rooster september 2026"],
  ["2026-09-16", "Nick", "Rooster september 2026"], ["2026-09-17", "Nick", "Rooster september 2026"],
  ["2026-09-18", "Olaf", "Rooster september 2026"], ["2026-09-19", "Olaf", "Rooster september 2026"],
  ["2026-09-20", "Olaf", "Rooster september 2026"], ["2026-09-21", "Olaf", "Rooster september 2026"],
  ["2026-09-22", "Bob", "Rooster september 2026"], ["2026-09-23", "Stijn", "Rooster september 2026"],
  ["2026-09-24", "Wessel", "Rooster september 2026"],
  ["2026-09-25", "Nick", "Rooster september 2026"], ["2026-09-26", "Nick", "Rooster september 2026"],
  ["2026-09-27", "Nick", "Rooster september 2026"], ["2026-09-28", "Nick", "Rooster september 2026"],
  ["2026-09-29", "Olaf", "Rooster september 2026"], ["2026-09-30", "Bob", "Rooster september 2026"],
  ["2026-10-01", "Stijn", "Rooster oktober 2026"],
  ["2026-10-02", "Wessel", "Rooster oktober 2026"], ["2026-10-03", "Wessel", "Rooster oktober 2026"], ["2026-10-04", "Wessel", "Rooster oktober 2026"], ["2026-10-05", "Wessel", "Rooster oktober 2026"],
  ["2026-10-06", "Nick", "Rooster oktober 2026"], ["2026-10-07", "Olaf", "Rooster oktober 2026"], ["2026-10-08", "Bob", "Rooster oktober 2026"],
  ["2026-10-09", "Stijn", "Rooster oktober 2026"], ["2026-10-10", "Stijn", "Rooster oktober 2026"], ["2026-10-11", "Stijn", "Rooster oktober 2026"], ["2026-10-12", "Stijn", "Rooster oktober 2026"],
  ["2026-10-13", "Wessel", "Rooster oktober 2026"], ["2026-10-14", "Nick", "Rooster oktober 2026"], ["2026-10-15", "Olaf", "Rooster oktober 2026"],
  ["2026-10-16", "Bob", "Rooster oktober 2026"], ["2026-10-17", "Bob", "Rooster oktober 2026"], ["2026-10-18", "Bob", "Rooster oktober 2026"], ["2026-10-19", "Bob", "Rooster oktober 2026"], ["2026-10-20", "Bob", "Rooster oktober 2026"],
  ["2026-10-21", "Wessel", "Rooster oktober 2026"], ["2026-10-22", "Nick", "Rooster oktober 2026"],
  ["2026-10-23", "Olaf", "Rooster oktober 2026"], ["2026-10-24", "Olaf", "Rooster oktober 2026"], ["2026-10-25", "Olaf", "Rooster oktober 2026"], ["2026-10-26", "Olaf", "Rooster oktober 2026"],
  ["2026-10-27", "Stijn", "Rooster oktober 2026"], ["2026-10-28", "Stijn", "Rooster oktober 2026"], ["2026-10-29", "Wessel", "Rooster oktober 2026"],
  ["2026-10-30", "Nick", "Rooster oktober 2026"], ["2026-10-31", "Nick", "Rooster oktober 2026"], ["2026-11-01", "Nick", "Rooster oktober 2026"],
];
for (const [dutyDate, personName, updatedBy] of standbyRoster) {
  await sql`
    INSERT INTO standby_roster (duty_date, person_name, updated_by)
    VALUES (${dutyDate}::date, ${personName}, ${updatedBy})
    ON CONFLICT (duty_date) DO NOTHING
  `;
}

await sql`UPDATE responders SET depot_id = LOWER(depot) WHERE depot_id IS NULL`;
await sql`DELETE FROM admin_sessions WHERE expires_at < NOW()`;
console.log("Database is gereed.");
