import { hashPin, isAdmin } from "@/lib/admin-auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminAction = { action?: string; id?: string; name?: string; depotId?: string; vehicleNumber?: string; active?: boolean; pin?: string; date?: string; personName?: string };
const cleanName = (value?: string) => value?.trim().slice(0, 80) ?? "";
const makeId = (name: string) => `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
const validDate = (value?: string) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "");

async function authorized(request: Request) {
  if (await isAdmin(request)) return null;
  return Response.json({ error: "Niet bevoegd" }, { status: 401 });
}

export async function GET(request: Request) {
  const denied = await authorized(request); if (denied) return denied;
  const sql = getSql();
  const [depots, responders, standby] = await Promise.all([
    sql`SELECT id, name, sort_order AS "sortOrder", active FROM depots ORDER BY sort_order, name`,
    sql`SELECT id, name, depot_id AS "depotId", vehicle_number AS "vehicleNumber", sort_order AS "sortOrder", active FROM responders ORDER BY depot_id, sort_order, name`,
    sql`SELECT duty_date::text AS date, person_name AS name, updated_at AS "updatedAt", updated_by AS "updatedBy" FROM standby_roster ORDER BY duty_date`,
  ]);
  return Response.json({ depots, responders, standby }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await authorized(request); if (denied) return denied;
  const body = (await request.json()) as AdminAction;
  const sql = getSql();
  const name = cleanName(body.name);

  if (body.action === "add-depot" && name) {
    const id = makeId(name);
    await sql`INSERT INTO depots (id, name, sort_order) VALUES (${id}, ${name}, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM depots))`;
  } else if (body.action === "update-depot" && body.id && name) {
    await sql`UPDATE depots SET name = ${name}, active = COALESCE(${body.active}, active) WHERE id = ${body.id}`;
  } else if (body.action === "add-responder" && name && body.depotId) {
    const id = makeId(name);
    const depotRows = (await sql`SELECT name FROM depots WHERE id = ${body.depotId}`) as Array<{ name: string }>;
    if (!depotRows[0]) return Response.json({ error: "Vestiging niet gevonden" }, { status: 404 });
    await sql`INSERT INTO responders (id, name, depot, depot_id, sort_order, status) VALUES (${id}, ${name}, ${String(depotRows[0].name)}, ${body.depotId}, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM responders WHERE depot_id = ${body.depotId}), 'off-duty')`;
  } else if (body.action === "update-responder" && body.id && name && body.depotId) {
    const depotRows = (await sql`SELECT name FROM depots WHERE id = ${body.depotId}`) as Array<{ name: string }>;
    if (!depotRows[0]) return Response.json({ error: "Vestiging niet gevonden" }, { status: 404 });
    const vehicleNumber = body.vehicleNumber?.trim().slice(0, 20) || null;
    await sql`UPDATE responders SET name = ${name}, depot_id = ${body.depotId}, depot = ${String(depotRows[0].name)}, vehicle_number = ${vehicleNumber}, active = COALESCE(${body.active}, active) WHERE id = ${body.id}`;
  } else if (body.action === "set-standby" && validDate(body.date) && cleanName(body.personName)) {
    const personName = cleanName(body.personName);
    await sql`
      INSERT INTO standby_roster (duty_date, person_name, updated_at, updated_by)
      VALUES (${body.date}::date, ${personName}, NOW(), 'Beheer')
      ON CONFLICT (duty_date) DO UPDATE SET person_name = EXCLUDED.person_name, updated_at = NOW(), updated_by = 'Beheer'
    `;
  } else if (body.action === "delete-standby" && validDate(body.date)) {
    await sql`DELETE FROM standby_roster WHERE duty_date = ${body.date}::date`;
  } else if (body.action === "change-pin" && body.pin && /^\d{4,12}$/.test(body.pin)) {
    const { salt, hash } = await hashPin(body.pin);
    await sql`INSERT INTO admin_settings (id, pin_salt, pin_hash) VALUES (1, ${salt}, ${hash}) ON CONFLICT (id) DO UPDATE SET pin_salt = EXCLUDED.pin_salt, pin_hash = EXCLUDED.pin_hash, updated_at = NOW()`;
    await sql`DELETE FROM admin_sessions`;
  } else {
    return Response.json({ error: "Ongeldige beheeractie" }, { status: 400 });
  }
  return Response.json({ success: true });
}
