import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["off-duty", "available", "busy"]);
type AvailabilityInput = { id?: string; status?: string; activityNote?: string | null };

export async function GET() {
  try {
    const sql = getSql();
    const [depots, responders] = await Promise.all([
      sql`SELECT id, name FROM depots WHERE active = TRUE ORDER BY sort_order, name`,
      sql`SELECT r.id, r.name, d.name AS depot, r.status, r.activity_note AS "activityNote", r.updated_at AS "updatedAt", r.updated_by AS "updatedBy"
          FROM responders r JOIN depots d ON d.id = r.depot_id
          WHERE r.active = TRUE AND d.active = TRUE ORDER BY d.sort_order, r.sort_order, r.name`,
    ]);
    return Response.json({ depots, responders }, { headers: { "cache-control": "no-store" } });
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
    const rows = (await sql`
      UPDATE responders r SET status = ${input.status}, activity_note = ${activityNote}, updated_at = ${updatedAt}, updated_by = ${updatedBy}
      FROM depots d WHERE r.id = ${input.id} AND r.active = TRUE AND d.id = r.depot_id AND d.active = TRUE
      RETURNING r.id, r.name, d.name AS depot, r.status, r.activity_note AS "activityNote", r.updated_at AS "updatedAt", r.updated_by AS "updatedBy"
    `) as Array<{ id: string; name: string; depot: string; status: string; activityNote: string | null; updatedAt: string; updatedBy: string }>;
    if (!rows[0]) return Response.json({ error: "Chauffeur niet gevonden" }, { status: 404 });
    return Response.json({ responder: rows[0] });
  } catch {
    return Response.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
