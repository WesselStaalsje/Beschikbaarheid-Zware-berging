import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "@/lib/db";

const scrypt = promisify(scryptCallback);
export const ADMIN_COOKIE = "zb_admin_session";

export async function hashPin(pin: string, salt = randomBytes(16).toString("hex")) {
  const hash = (await scrypt(pin, salt, 64)) as Buffer;
  return { salt, hash: hash.toString("hex") };
}

export async function verifyPin(pin: string) {
  const sql = getSql();
  const rows = (await sql`SELECT pin_salt, pin_hash FROM admin_settings WHERE id = 1`) as Array<{ pin_salt: string; pin_hash: string }>;
  if (!rows[0]) return false;
  const candidate = (await scrypt(pin, String(rows[0].pin_salt), 64)) as Buffer;
  const expected = Buffer.from(String(rows[0].pin_hash), "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createAdminSession() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sql = getSql();
  await sql`INSERT INTO admin_sessions (token_hash, expires_at) VALUES (${tokenHash}, NOW() + INTERVAL '12 hours')`;
  return token;
}

export async function isAdmin(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  const token = cookie?.slice(ADMIN_COOKIE.length + 1);
  if (!token) return false;
  const tokenHash = createHash("sha256").update(decodeURIComponent(token)).digest("hex");
  const sql = getSql();
  const rows = (await sql`SELECT 1 FROM admin_sessions WHERE token_hash = ${tokenHash} AND expires_at > NOW()`) as Array<Record<string, unknown>>;
  return Boolean(rows[0]);
}

export function clearSessionCookie() {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0`;
}

export function sessionCookie(token: string) {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=43200`;
}
