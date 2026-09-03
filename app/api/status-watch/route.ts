import { getSql } from "@/lib/db";
import { sendStaleStatusNotification } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_AFTER_MINUTES = 90;

type StaleResponder = {
  id: string;
  name: string;
  vehicleNumber: string | null;
  depot: string;
  status: string;
  updatedAt: string;
  minutesStale: number;
};

export async function GET() {
  try {
    const sql = getSql();

    await sql`
      CREATE TABLE IF NOT EXISTS stale_status_alerts (
        responder_id TEXT PRIMARY KEY,
        status_updated_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const responders = (await sql`
      SELECT
        r.id,
        r.name,
        r.vehicle_number AS "vehicleNumber",
        d.name AS depot,
        r.status,
        r.updated_at AS "updatedAt",
        FLOOR(EXTRACT(EPOCH FROM (NOW() - r.updated_at)) / 60)::int AS "minutesStale"
      FROM responders r
      JOIN depots d ON d.id = r.depot_id
      WHERE r.active = TRUE
        AND d.active = TRUE
        AND r.status = 'busy'
        AND LOWER(d.name) <> 'buitenland'
        AND r.updated_at <= NOW() - (${STALE_AFTER_MINUTES} * INTERVAL '1 minute')
      ORDER BY r.updated_at ASC
    `) as StaleResponder[];

    let sent = 0;
    for (const responder of responders) {
      const alreadySent = (await sql`
        SELECT 1
        FROM stale_status_alerts
        WHERE responder_id = ${responder.id}
          AND status_updated_at = ${responder.updatedAt}::timestamptz
        LIMIT 1
      `) as Array<{ one: number }>;

      if (alreadySent[0]) continue;

      await sendStaleStatusNotification({
        name: responder.name,
        depot: responder.depot,
        vehicleNumber: responder.vehicleNumber,
        status: responder.status,
        minutesStale: responder.minutesStale,
      });

      await sql`
        INSERT INTO stale_status_alerts (responder_id, status_updated_at, sent_at)
        VALUES (${responder.id}, ${responder.updatedAt}::timestamptz, NOW())
        ON CONFLICT (responder_id)
        DO UPDATE SET status_updated_at = EXCLUDED.status_updated_at, sent_at = NOW()
      `;
      sent += 1;
    }

    return Response.json({ checked: responders.length, sent, thresholdMinutes: STALE_AFTER_MINUTES });
  } catch (error) {
    console.error("[status-watch] controle mislukt", error);
    return Response.json({ error: "Statuscontrole mislukt" }, { status: 500 });
  }
}
