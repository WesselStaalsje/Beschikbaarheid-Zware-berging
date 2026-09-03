import webpush from "web-push";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";

type PushSettings = { public_key: string; private_key: string };
type StoredSubscription = { endpoint: string; p256dh: string; auth: string };
type StatusNotification = { name: string; depot: string; vehicleNumber: string | null; status: string; activityNote: string | null };
type StaleStatusNotification = { name: string; depot: string; vehicleNumber: string | null; status: string; minutesStale: number };

type PushPayload = { title: string; body: string; url?: string; tag?: string; ttl?: number };

export async function getPushPublicKey() {
  const sql = getSql();
  const rows = (await sql`SELECT public_key FROM push_settings WHERE id = 1`) as Array<{ public_key: string }>;
  return rows[0]?.public_key ?? null;
}

async function sendPushToAll({ title, body, url = "/", tag = `push-${randomUUID()}`, ttl = 300 }: PushPayload) {
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
  const payload = JSON.stringify({ title, body, url, tag });

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: ttl },
      );
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${subscription.endpoint}`;
      else throw error;
    }
  }));
  for (const result of results) if (result.status === "rejected") console.error("[push] melding mislukt", result.reason);
}

export async function sendStatusNotification(change: StatusNotification) {
  const vehicle = change.vehicleNumber ? ` · wagen ${change.vehicleNumber}` : "";
  const statusLabel = change.status === "available" ? "is beschikbaar" : change.status === "busy" ? "is bezig" : "is niet in dienst";
  const body = change.status === "busy" && change.activityNote
    ? `${change.depot}${vehicle} · ${change.activityNote}`
    : `${change.depot}${vehicle}`;

  await sendPushToAll({
    title: `${change.name} ${statusLabel}`,
    body,
    tag: `status-${randomUUID()}`,
  });
}

export async function sendStaleStatusNotification(change: StaleStatusNotification) {
  const vehicle = change.vehicleNumber ? ` · wagen ${change.vehicleNumber}` : "";
  const statusLabel = change.status === "available" ? "Beschikbaar" : "Bezig";
  const hours = Math.floor(change.minutesStale / 60);
  const minutes = change.minutesStale % 60;
  const duration = hours > 0 ? `${hours} uur${minutes ? ` en ${minutes} min` : ""}` : `${minutes} min`;

  await sendPushToAll({
    title: "Hey hallo?",
    body: `${change.name} staat al ${duration} op ${statusLabel}. Klopt deze status nog? ${change.depot}${vehicle}`,
    tag: `stale-${randomUUID()}`,
    ttl: 900,
  });
}

export async function sendTestNotification(subscription: StoredSubscription) {
  const sql = getSql();
  const rows = (await sql`SELECT public_key, private_key FROM push_settings WHERE id = 1`) as Array<PushSettings>;
  const settings = rows[0];
  if (!settings) throw new Error("Pushinstellingen ontbreken");

  webpush.setVapidDetails("https://beschikbaarheid-zware-berging.vercel.app", settings.public_key, settings.private_key);
  const payload = JSON.stringify({
    title: "Testmelding Zware Berging",
    body: "De meldingen werken op dit apparaat.",
    url: "/",
    tag: `push-test-${Date.now()}`,
  });

  await webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    payload,
    { TTL: 300 },
  );
}
