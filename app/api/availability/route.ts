import { getSql } from "@/lib/db";
import { sendStatusNotification } from "@/lib/push";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["off-duty", "available", "busy"]);
type AvailabilityInput = { id?: string; status?: string; activityNote?: string | null };
type StandbyRow = { date: string; name: string; updatedAt: string | null; updatedBy: string | null };

export async function GET() {
  try {
    const sql = getSql();
    const [depots, responders] = await Promise.all([
      sql`SELECT id, name FROM depots WHERE active = TRUE ORDER BY sort_order, name`,
      sql`SELECT r.id, r.name, r.vehicle_number AS "vehicleNumber", d.name AS depot, r.status, r.activity_note AS "activityNote", r.updated_at AS "updatedAt", r.updated_by AS "updatedBy"
          FROM responders r JOIN depots d ON d.id = r.depot_id
          WHERE r.active = TRUE AND d.active = TRUE ORDER BY d.sort_order, r.sort_order, r.name`,
    ]);
    const standbyRows = (await sql`SELECT duty_date::text AS date, person_name AS name, updated_at AS "updatedAt", updated_by AS "updatedBy"
      FROM standby_roster
      WHERE duty_date = (NOW() AT TIME ZONE 'Europe/Amsterdam')::date
      LIMIT 1`) as StandbyRow[];
    return Response.json({ depots, responders, standby: standbyRows[0] ?? null }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Database niet beschikbaar" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as AvailabilityInput;
    if (!input.id || !input.status || !STATUSES.has(input.status)) {
      return Response.json({ error: "Ongeldige gegevens" }, { status: 400 });
    }
    const updatedBy = "Meldkamer";
    const updatedAt = new Date().toISOString();
    const activityNote = input.status === "busy" ? (input.activityNote ?? "").trim().slice(0, 100) || null : null;
    const sql = getSql();
    const previousRows = (await sql`SELECT status, activity_note AS "activityNote" FROM responders WHERE id = ${input.id}`) as Array<{ status: string; activityNote: string | null }>;
    const rows = (await sql`
      UPDATE responders r SET status = ${input.status}, activity_note = ${activityNote}, updated_at = ${updatedAt}, updated_by = ${updatedBy}
      FROM depots d WHERE r.id = ${input.id} AND r.active = TRUE AND d.id = r.depot_id AND d.active = TRUE
      RETURNING r.id, r.name, r.vehicle_number AS "vehicleNumber", d.name AS depot, r.status, r.activity_note AS "activityNote", r.updated_at AS "updatedAt", r.updated_by AS "updatedBy"
    `) as Array<{ id: string; name: string; vehicleNumber: string | null; depot: string; status: string; activityNote: string | null; updatedAt: string; updatedBy: string }>;
    if (!rows[0]) return Response.json({ error: "Chauffeur niet gevonden" }, { status: 404 });
    const previous = previousRows[0];
    if (!previous || previous.status !== input.status || previous.activityNote !== activityNote) {
      after(() => sendStatusNotification(rows[0]));
    }
    return Response.json({ responder: rows[0] });
  } catch {
    return Response.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
