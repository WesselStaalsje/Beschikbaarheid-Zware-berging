import webpush from "web-push";
import { getSql } from "@/lib/db";

type PushSettings = { public_key: string; private_key: string };
type StoredSubscription = { endpoint: string; p256dh: string; auth: string };
type StatusNotification = { name: string; depot: string; vehicleNumber: string | null; status: string; activityNote: string | null };

export async function getPushPublicKey() {
  const sql = getSql();
  const rows = (await sql`SELECT public_key FROM push_settings WHERE id = 1`) as Array<{ public_key: string }>;
  return rows[0]?.public_key ?? null;
}

export async function sendStatusNotification(change: StatusNotification) {
  const sql = getSql();
  const [settingsResult, subscriptionsResult] = await Promise.all([
    sql`SELECT public_key, private_key FROM push_settings WHERE id = 1`,
    sql`SELECT endpoint, p256dh, auth FROM push_subscriptions`,
  ]);
  const settingsRows = settingsResult as unknown as Array<PushSettings>;
  const subscriptions = subscriptionsResult as unknown as Array<StoredSubscription>;
  const settings = settingsRows[0];
  if (!settings || subscriptions.length === 0) return;

  webpush.setVapidDetails("https://beschikbaarheid-zware-berging.vercel.app", settings.public_key, settings.private_key);
  const vehicle = change.vehicleNumber ? ` · wagen ${change.vehicleNumber}` : "";
  const statusLabel = change.status === "available" ? "is beschikbaar" : change.status === "busy" ? "is bezig" : "is niet in dienst";
  const body = change.status === "busy" && change.activityNote
    ? `${change.depot}${vehicle} · ${change.activityNote}`
    : `${change.depot}${vehicle}`;
  const payload = JSON.stringify({
    title: `${change.name} ${statusLabel}`,
    body,
    url: "/",
    tag: `status-${change.name}`,
  });

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 300 });
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
      else throw error;
    }
  }));
  for (const result of results) if (result.status === "rejected") console.error("Pushmelding mislukt", result.reason);
}
