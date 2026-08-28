import { getSql } from "@/lib/db";
import { PLUS_ROSTER_BY_ID } from "@/lib/plus-roster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set(["off-duty", "available", "busy"]);
type AvailabilityInput = { id?: string; status?: string };

export async function GET() {
  try {
    const sql = getSql();
    const rows = (await sql`SELECT id, name, depot, status, updated_at AS "updatedAt", updated_by AS "updatedBy" FROM responders ORDER BY depot, name`) as Array<Record<string, unknown>>;
    return Response.json(
      { responders: rows.filter((row) => PLUS_ROSTER_BY_ID.has(String(row.id))) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Database niet beschikbaar" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as AvailabilityInput;
    const rosterEntry = input.id ? PLUS_ROSTER_BY_ID.get(input.id) : undefined;
    if (!input.id || !rosterEntry || !input.status || !STATUSES.has(input.status)) {
      return Response.json({ error: "Ongeldige gegevens" }, { status: 400 });
    }
    const updatedBy = "Meldkamer";
    const updatedAt = new Date().toISOString();
    const sql = getSql();
    await sql`
      INSERT INTO responders (id, name, depot, status, updated_at, updated_by)
      VALUES (${input.id}, ${rosterEntry.name}, ${rosterEntry.depot}, ${input.status}, ${updatedAt}, ${updatedBy})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        depot = EXCLUDED.depot,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by
    `;
    return Response.json({ responder: { id: input.id, name: rosterEntry.name, depot: rosterEntry.depot, status: input.status, updatedAt, updatedBy } });
  } catch {
    return Response.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
