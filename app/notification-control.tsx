"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";

type PushState = "loading" | "unsupported" | "off" | "on" | "denied";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function NotificationControl() {
  const [state, setState] = useState<PushState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setState("unsupported"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setState(subscription ? "on" : "off")).catch(() => setState("unsupported"));
  }, []);

  async function toggle() {
    setMessage("");
    if (state === "unsupported") { setMessage("Open de app via het icoon op je beginscherm."); return; }
    if (state === "denied") { setMessage("Sta meldingen toe via de iPhone-instellingen."); return; }
    setState("loading");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: current.endpoint }) });
        await current.unsubscribe();
        setState("off"); setMessage("Meldingen zijn uitgeschakeld."); return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
      const keyResponse = await fetch("/api/push", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("Pushconfiguratie niet beschikbaar");
      const { publicKey } = await keyResponse.json() as { publicKey: string };
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const saveResponse = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(subscription) });
      if (!saveResponse.ok) throw new Error("Registratie mislukt");
      setState("on"); setMessage("Pushmeldingen staan aan.");
    } catch {
      setState("off"); setMessage("Inschakelen is niet gelukt. Probeer het opnieuw.");
    }
  }

  const label = state === "on" ? "Meldingen aan" : state === "loading" ? "Even wachten…" : "Meldingen inschakelen";
  return (
    <div className="relative">
      <button onClick={() => void toggle()} disabled={state === "loading"} className={`flex h-8 items-center gap-2 border px-2.5 text-[11px] font-bold transition disabled:opacity-60 ${state === "on" ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300" : "border-white/15 text-white/65 hover:border-white/30 hover:text-white"}`} title={message || label}>
        {state === "on" ? <BellRing className="size-4" /> : state === "denied" || state === "unsupported" ? <BellOff className="size-4" /> : <Bell className="size-4" />}
        <span className="hidden lg:inline">{label}</span>
      </button>
      {message ? <div className="absolute right-0 top-10 z-50 w-64 border border-slate-200 bg-white p-3 text-xs font-medium text-slate-700 shadow-xl">{message}</div> : null}
    </div>
  );
}
