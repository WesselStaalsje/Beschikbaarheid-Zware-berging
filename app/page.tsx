import { headers } from "next/headers";
import { AvailabilityDashboard } from "./availability-dashboard";

export default async function Home() {
  const authorization = (await headers()).get("authorization");
  let currentUser = "Meldkamer";
  if (authorization?.startsWith("Basic ")) {
    try {
      currentUser = Buffer.from(authorization.slice(6), "base64").toString("utf8").split(":", 1)[0] || currentUser;
    } catch {}
  }
  return <AvailabilityDashboard currentUser={currentUser} />;
}
