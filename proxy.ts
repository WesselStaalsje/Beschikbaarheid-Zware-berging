import { NextRequest, NextResponse } from "next/server";

function unauthorized() {
  return new NextResponse("Inloggen vereist", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Zware Berging", charset="UTF-8"' },
  });
}

export function proxy(request: NextRequest) {
  const expectedUser = process.env.APP_USER;
  const expectedPassword = process.env.APP_PASSWORD;
  if (!expectedUser || !expectedPassword) {
    return new NextResponse("APP_USER en APP_PASSWORD moeten in Vercel zijn ingesteld.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const [user, password] = Buffer.from(authorization.slice(6), "base64").toString("utf8").split(":");
    if (user === expectedUser && password === expectedPassword) return NextResponse.next();
  } catch {}
  return unauthorized();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon-192.png|icon-512.png|app-icon.svg|sw.js|manifest.webmanifest).*)"],
};
