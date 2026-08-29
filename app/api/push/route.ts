import { getSql } from "@/lib/db";
import { getPushPublicKey, sendTestNotification } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscriptionInput = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function GET() {
  const publicKey = await getPushPublicKey();
  if (!publicKey) return Response.json({ error: "Pushmeldingen zijn nog niet gereed" }, { status: 503 });
  return Response.json({ publicKey }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const input = (await request.json()) as SubscriptionInput;
  if (!input.endpoint?.startsWith("https://") || !input.keys?.p256dh || !input.keys.auth) {
    return Response.json({ error: "Ongeldige pushregistratie" }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (${input.endpoint}, ${input.keys.p256dh}, ${input.keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = NOW()
  `;
  return Response.json({ subscribed: true });
}

export async function DELETE(request: Request) {
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (endpoint) {
    const sql = getSql();
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  }
  return Response.json({ subscribed: false });
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as SubscriptionInput;
    if (!input.endpoint?.startsWith("https://") || !input.keys?.p256dh || !input.keys.auth) {
      return Response.json({ error: "Ongeldige pushregistratie" }, { status: 400 });
    }
    await sendTestNotification({ endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth });
    return Response.json({ sent: true });
  } catch (error) {
    console.error("[push] testmelding mislukt", error);
    return Response.json({ error: "Testmelding versturen is mislukt" }, { status: 502 });
  }
}
