"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Building2, CalendarClock, Check, CircleMinus, Clock3, Radio, RefreshCw, Save, Settings, ShieldCheck, Wrench } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { NotificationControl } from "./notification-control";

type Depot = { id: string; name: string };
type Standby = { date: string; name: string; updatedAt: string | null; updatedBy: string | null };

type Responder = {
  id: string;
  name: string;
  vehicleNumber: string | null;
  depot: string;
  status: "off-duty" | "available" | "busy";
  activityNote: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

const STALE_AFTER_MS = 90 * 60 * 1000;

function formatTime(value: string | null) {
  if (!value) return "Nog niet gewijzigd";
  return new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function isResponderStale(responder: Responder, now: Date) {
  if (responder.status === "off-duty" || !responder.updatedAt) return false;
  return now.getTime() - new Date(responder.updatedAt).getTime() >= STALE_AFTER_MS;
}

function formatStatusAge(value: string | null, now: Date) {
  if (!value) return "";
  const totalMinutes = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return `${hours}u${minutes ? ` ${minutes}m` : ""}`;
}

export function AvailabilityDashboard() {
  const [depots, setDepots] = useState<Depot[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [standby, setStandby] = useState<Standby | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());

  const loadAvailability = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/availability", { cache: "no-store" });
      if (!response.ok) throw new Error("Status kon niet worden opgehaald");
      const payload = (await response.json()) as { depots: Depot[]; responders: Responder[]; standby: Standby | null };
      setDepots(payload.depots);
      setResponders(payload.responders);
      setStandby(payload.standby ?? null);
      setError(null);
    } catch {
      setError("Synchronisatie tijdelijk onderbroken");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAvailability();
    const poller = window.setInterval(() => void loadAvailability(true), 4000);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearInterval(poller);
      window.clearInterval(timer);
    };
  }, [loadAvailability]);

  const availableCount = responders.filter((responder) => responder.status === "available").length;
  const busyCount = responders.filter((responder) => responder.status === "busy").length;
  const onDutyCount = availableCount + busyCount;
  const staleResponders = responders.filter((responder) => isResponderStale(responder, clock));
  const staleCount = staleResponders.length;
  const latestUpdate = useMemo(
    () => responders.map((responder) => responder.updatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
    [responders],
  );

  async function updateResponder(responder: Responder, status: Responder["status"], note = responder.activityNote) {
    const previous = responders;
    const statusChanged = responder.status !== status;
    const updatedAt = statusChanged ? new Date().toISOString() : responder.updatedAt;
    const activityNote = status === "busy" ? note : null;
    setResponders((items) => items.map((item) => item.id === responder.id ? { ...item, status, activityNote, updatedAt, updatedBy: "Meldkamer" } : item));
    setSyncing(true);
    try {
      const response = await fetch("/api/availability", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: responder.id, status, activityNote }),
      });
      if (!response.ok) throw new Error("Opslaan mislukt");
      const payload = (await response.json()) as { responder: Responder };
      setResponders((items) => items.map((item) => item.id === responder.id ? payload.responder : item));
      setError(null);
    } catch {
      setResponders(previous);
      setError("Wijziging niet opgeslagen — probeer opnieuw");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#eef1f4] text-[#17212b]">
      <header className="safe-top sticky top-0 z-20 border-b border-[#24313d] bg-[#101820] text-white shadow-sm">
        <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center bg-[#f9b233] text-[#101820]"><Activity className="size-5" strokeWidth={2.4} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-bold tracking-[0.04em] sm:text-base">ZWARE BERGING</h1>
                <span className="hidden border-l border-white/20 pl-2 text-xs font-medium text-white/55 sm:inline">PLUSDiensten</span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/55">Actuele beschikbaarheid per vestiging</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 text-xs text-white/65 sm:flex">
              <span className={`size-2 rounded-full ${error ? "bg-red-400" : "bg-emerald-400 animate-pulse"}`} />
              {error ? "Verbinding verbroken" : "Live verbonden"}
            </div>
            <div className="flex items-center gap-2 border-l border-white/15 pl-4 font-mono text-sm font-semibold tabular-nums">
              <Clock3 className="size-4 text-[#f9b233]" />
              {clock.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <NotificationControl />
            <Link href="/beheer" className="grid size-8 place-items-center border border-white/15 text-white/60 transition hover:border-white/30 hover:text-white" aria-label="Beheer openen"><Settings className="size-4" /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
        <section className="mb-4 flex items-center justify-between gap-4 border-l-4 border-[#f9b233] bg-[#101820] px-4 py-3.5 text-white shadow-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center bg-[#f9b233] text-[#101820]"><CalendarClock className="size-5" /></div>
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Achterwacht vandaag</p><p className="mt-0.5 truncate text-xl font-bold sm:text-2xl">{standby?.name ?? "Niet ingepland"}</p></div>
          </div>
          <div className="hidden text-right sm:block"><p className="text-xs font-semibold capitalize">{clock.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}</p><p className="mt-0.5 text-[10px] text-white/45">Wijzigbaar via Beheer</p></div>
        </section>

        <section className="mb-4 grid grid-cols-3 gap-2 sm:mb-5 sm:gap-3 lg:grid-cols-[160px_160px_160px_1fr]">
          <div className="border-l-4 border-emerald-500 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Beschikbaar</p>
            <div className="mt-1 flex items-end gap-1.5"><strong className="text-2xl leading-none tabular-nums text-emerald-600 sm:text-3xl">{availableCount}</strong><span className="hidden pb-0.5 text-xs text-slate-500 sm:inline">van {responders.length}</span></div>
          </div>
          <div className="border-l-4 border-amber-500 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Bezig</p>
            <div className="mt-1 flex items-end gap-1.5"><strong className="text-2xl leading-none tabular-nums text-amber-600 sm:text-3xl">{busyCount}</strong><span className="hidden pb-0.5 text-xs text-slate-500 sm:inline">ingezet</span></div>
          </div>
          <div className="border-l-4 border-[#263746] bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">In dienst</p>
            <div className="mt-1 flex items-end gap-1.5"><strong className="text-2xl leading-none tabular-nums sm:text-3xl">{onDutyCount}</strong><span className="hidden pb-0.5 text-xs text-slate-500 sm:inline">van {responders.length}</span></div>
          </div>
          <div className="col-span-3 flex min-h-[58px] items-center justify-between bg-white px-4 py-3 shadow-sm lg:col-span-1">
            <div className="flex items-center gap-3">
              <Radio className={`size-5 ${syncing ? "animate-spin text-amber-500" : "text-emerald-500"}`} />
              <div><p className="text-xs font-semibold">{error ?? (syncing ? "Wijziging opslaan…" : "Alle wijzigingen zijn gesynchroniseerd")}</p><p className="mt-1 text-[11px] text-slate-500">Laatste wijziging {formatTime(latestUpdate)}</p></div>
            </div>
            <button className="grid size-8 place-items-center text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" onClick={() => void loadAvailability(true)} aria-label="Overzicht vernieuwen"><RefreshCw className="size-4" /></button>
          </div>
        </section>

        {staleCount > 0 ? (
          <div className="mb-4 flex items-center gap-3 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 shadow-sm">
            <AlertTriangle className="size-5 shrink-0" />
            <div><strong>{staleCount} {staleCount === 1 ? "status is" : "statussen zijn"} langer dan 1,5 uur ongewijzigd.</strong><span className="ml-1 font-normal">Controleer of deze chauffeurs nog correct staan.</span></div>
          </div>
        ) : null}

        {error && <div className="mb-4 border-l-4 border-red-500 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800">{error}</div>}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy={loading}>
          {depots.map((depot) => {
            const depotResponders = responders.filter((responder) => responder.depot === depot.name);
            const depotAvailable = depotResponders.filter((responder) => responder.status === "available").length;
            const depotBusy = depotResponders.filter((responder) => responder.status === "busy").length;
            const depotStale = depotResponders.filter((responder) => isResponderStale(responder, clock)).length;
            return (
              <article key={depot.id} className={`overflow-hidden bg-white shadow-sm ${depotStale ? "border-2 border-red-400" : "border border-slate-200"}`}>
                <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8f9fa] px-4 py-3">
                  <div className="flex items-center gap-2.5"><Building2 className="size-4 text-slate-500" /><h2 className="text-sm font-bold uppercase tracking-[0.04em]">{depot.name}</h2></div>
                  {depotStale ? <span className="bg-red-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-red-700">{depotStale} controle</span> : <span className={`min-w-8 px-2 py-1 text-center text-[10px] font-bold ${depotAvailable ? "bg-emerald-100 text-emerald-800" : depotBusy ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600"}`}>{depotResponders.length ? `${depotAvailable} vrij · ${depotBusy} bezig` : "0"}</span>}
                </div>
                <div className="divide-y divide-slate-100">
                  {depotResponders.length === 0 && (
                    <div className="flex min-h-[64px] items-center gap-3 px-4 py-3 text-slate-400">
                      <ShieldCheck className="size-5" />
                      <div><p className="text-sm font-semibold text-slate-500">Geen vaste Plusberger</p><p className="mt-0.5 text-[10px]">Voor deze vestiging is niemand ingedeeld</p></div>
                    </div>
                  )}
                  {depotResponders.map((responder) => {
                    const stale = isResponderStale(responder, clock);
                    return (
                      <div key={responder.id} className={`px-4 py-3 transition ${stale ? "bg-red-50 ring-2 ring-inset ring-red-400" : responder.status === "available" ? "bg-emerald-50/45" : responder.status === "busy" ? "bg-amber-50/55" : "bg-white"}`}>
                        <div className="mb-2.5 flex items-center gap-3">
                          <div className={`grid size-8 shrink-0 place-items-center rounded-full ${stale ? "bg-red-500 text-white" : responder.status === "available" ? "bg-emerald-500 text-white" : responder.status === "busy" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-400"}`}>{stale ? <AlertTriangle className="size-4" strokeWidth={2.5} /> : responder.status === "available" ? <Check className="size-4" strokeWidth={3} /> : responder.status === "busy" ? <Wrench className="size-4" /> : <CircleMinus className="size-4" />}</div>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2"><p className="truncate text-sm font-semibold">{responder.name}{responder.vehicleNumber ? <span className="ml-1.5 font-mono text-xs font-bold text-slate-500">· {responder.vehicleNumber}</span> : null}</p>{stale ? <span className="shrink-0 bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-red-700">Status oud</span> : null}</div>
                            <p className={`mt-0.5 truncate text-[10px] ${stale ? "font-bold text-red-700" : "text-slate-500"}`}>{stale ? `Al ${formatStatusAge(responder.updatedAt, clock)} ongewijzigd · controleer status` : responder.updatedAt ? `${formatTime(responder.updatedAt)} · ${responder.updatedBy ?? "Meldkamer"}` : "Niet in dienst"}</p>
                          </div>
                        </div>
                        <RadioGroup value={responder.status} onValueChange={(value) => void updateResponder(responder, value as Responder["status"])} disabled={syncing} className="grid grid-cols-3 gap-1" aria-label={`Status van ${responder.name}`}>
                          <label className={`cursor-pointer border px-2 py-1.5 text-center text-[10px] font-bold transition ${responder.status === "off-duty" ? "border-slate-500 bg-slate-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}><RadioGroupItem value="off-duty" className="sr-only" />Niet in dienst</label>
                          <label className={`cursor-pointer border px-2 py-1.5 text-center text-[10px] font-bold transition ${responder.status === "available" ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-emerald-50"}`}><RadioGroupItem value="available" className="sr-only" />Beschikbaar</label>
                          <label className={`cursor-pointer border px-2 py-1.5 text-center text-[10px] font-bold transition ${responder.status === "busy" ? "border-amber-500 bg-amber-500 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-amber-50"}`}><RadioGroupItem value="busy" className="sr-only" />Bezig</label>
                        </RadioGroup>
                        {responder.status === "busy" ? <BusyNote responder={responder} disabled={syncing} onSave={(note) => updateResponder(responder, "busy", note)} /> : null}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </section>
        <footer className="mt-4 flex flex-col justify-between gap-1 border-t border-slate-300 pt-3 text-[10px] uppercase tracking-[0.08em] text-slate-400 sm:flex-row"><span>Plusdiensten · automatisch vernieuwd om de 4 seconden</span><span>Openbaar dashboard</span></footer>
      </div>
    </main>
  );
}

function BusyNote({ responder, disabled, onSave }: { responder: Responder; disabled: boolean; onSave: (note: string) => Promise<void> }) {
  const [note, setNote] = useState(responder.activityNote ?? "");
  useEffect(() => { setNote(responder.activityNote ?? ""); }, [responder.activityNote]);
  const changed = note.trim() !== (responder.activityNote ?? "");

  return (
    <form onSubmit={(event) => { event.preventDefault(); void onSave(note.trim()); }} className="mt-2 flex gap-1.5">
      <input autoFocus={!responder.activityNote} value={note} onChange={(event) => setNote(event.target.value.slice(0, 100))} placeholder="Waar is deze chauffeur mee bezig?" aria-label={`Werkzaamheden van ${responder.name}`} className="min-w-0 flex-1 border border-amber-300 bg-white px-2.5 py-2 text-xs outline-none placeholder:text-slate-400 focus:border-amber-500" />
      <button disabled={disabled || !changed} className="grid w-9 place-items-center bg-amber-500 text-white transition hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400" aria-label="Werkzaamheden opslaan"><Save className="size-4" /></button>
    </form>
  );
}
