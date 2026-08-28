import { ADMIN_COOKIE, clearSessionCookie, createAdminSession, isAdmin, sessionCookie, verifyPin } from "@/lib/admin-auth";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return Response.json({ authenticated: await isAdmin(request) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const { pin } = (await request.json()) as { pin?: string };
  if (!pin || !(await verifyPin(pin))) return Response.json({ error: "Onjuiste pincode" }, { status: 401 });
  const token = await createAdminSession();
  return Response.json({ authenticated: true }, { headers: { "set-cookie": sessionCookie(token) } });
}

export async function DELETE(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  const token = cookie?.slice(ADMIN_COOKIE.length + 1);
  if (token) {
    const hash = createHash("sha256").update(decodeURIComponent(token)).digest("hex");
    const sql = getSql();
    await sql`DELETE FROM admin_sessions WHERE token_hash = ${hash}`;
  }
  return Response.json({ authenticated: false }, { headers: { "set-cookie": clearSessionCookie() } });
}
