"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CalendarDays, KeyRound, LogOut, Plus, Save, Trash2, Truck, UserRoundCog } from "lucide-react";

type Depot = { id: string; name: string; sortOrder: number; active: boolean };
type Responder = { id: string; name: string; depotId: string; vehicleNumber: string | null; sortOrder: number; active: boolean };
type Standby = { date: string; name: string; updatedAt: string | null; updatedBy: string | null };
type AdminTab = "standby" | "responders" | "depots" | "settings";

const DEFAULT_STANDBY_NAMES = ["Wessel", "Nick", "Bob", "Stijn", "Olaf"];
const TABS: Array<{ id: AdminTab; label: string; icon: typeof CalendarDays }> = [
  { id: "standby", label: "Achterwacht", icon: CalendarDays },
  { id: "responders", label: "Chauffeurs", icon: Truck },
  { id: "depots", label: "Vestigingen", icon: Building2 },
  { id: "settings", label: "Instellingen", icon: KeyRound },
];

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("standby");
  const [pin, setPin] = useState("");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [standby, setStandby] = useState<Standby[]>([]);
  const [standbyMonth, setStandbyMonth] = useState("");
  const [standbyDate, setStandbyDate] = useState("");
  const [standbyName, setStandbyName] = useState("Wessel");
  const [newDepot, setNewDepot] = useState("");
  const [newName, setNewName] = useState("");
  const [newDepotId, setNewDepotId] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    const data = await response.json() as { depots: Depot[]; responders: Responder[]; standby: Standby[] };
    setDepots(data.depots); setResponders(data.responders); setStandby(data.standby ?? []);
    setNewDepotId((current) => current || data.depots.find((depot) => depot.active)?.id || "");
    setStandbyMonth((current) => {
      if (current) return current;
      const thisMonth = new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit" });
      return data.standby?.some((item) => item.date.startsWith(thisMonth)) ? thisMonth : data.standby?.[0]?.date.slice(0, 7) ?? thisMonth;
    });
    setAuthenticated(true);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function action(body: Record<string, unknown>, success: string) {
    setBusy(true); setMessage("");
    const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json() as { error?: string };
    if (!response.ok) setMessage(data.error || "Opslaan mislukt");
    else { setMessage(success); await load(); }
    setBusy(false);
  }

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pin }) });
    if (response.ok) { setPin(""); await load(); } else setMessage("Onjuiste pincode");
    setBusy(false);
  }

  const standbyNames = useMemo(() => Array.from(new Set([...DEFAULT_STANDBY_NAMES, ...standby.map((item) => item.name)])), [standby]);
  const visibleStandby = standby.filter((item) => !standbyMonth || item.date.startsWith(standbyMonth));

  if (authenticated === null) return <main className="grid min-h-screen place-items-center bg-[#eef1f4] text-sm font-semibold text-slate-500">Beheer laden…</main>;
  if (!authenticated) return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f4] p-4">
      <form onSubmit={login} className="w-full max-w-sm border-t-4 border-[#f9b233] bg-white p-7 shadow-xl">
        <div className="mb-5 grid size-11 place-items-center bg-[#101820] text-[#f9b233]"><KeyRound /></div>
        <h1 className="text-xl font-bold text-[#17212b]">Beheer Plusdiensten</h1><p className="mt-1 text-sm text-slate-500">Voer de beheerpincode in.</p>
        <input autoFocus inputMode="numeric" pattern="[0-9]*" type="password" value={pin} onChange={(event) => setPin(event.target.value)} className="mt-6 w-full border border-slate-300 px-4 py-3 text-lg tracking-[0.3em] outline-none focus:border-[#f9b233]" aria-label="Beheerpincode" />
        {message ? <p className="mt-3 text-sm font-semibold text-red-600">{message}</p> : null}
        <button disabled={busy || pin.length < 4} className="mt-4 w-full bg-[#101820] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Inloggen</button>
        <Link href="/" className="mt-4 block text-center text-xs font-semibold text-slate-500 hover:text-slate-800">Terug naar dashboard</Link>
      </form>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#eef1f4] text-[#17212b]">
      <header className="border-b border-[#24313d] bg-[#101820] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><UserRoundCog className="shrink-0 text-[#f9b233]" /><div className="min-w-0"><h1 className="truncate font-bold">Beheer Plusdiensten</h1><p className="text-xs text-white/55">Planning en instellingen</p></div></div>
          <div className="flex shrink-0 gap-2"><Link href="/" className="flex items-center gap-2 border border-white/20 px-3 py-2 text-xs font-bold"><ArrowLeft className="size-4" /><span className="hidden sm:inline">Dashboard</span></Link><button onClick={async () => { await fetch("/api/admin/session", { method: "DELETE" }); setAuthenticated(false); }} className="border border-white/20 p-2" aria-label="Uitloggen"><LogOut className="size-4" /></button></div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl overflow-x-auto px-4 sm:px-6" role="tablist" aria-label="Beheeronderdelen">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => { setActiveTab(tab.id); setMessage(""); }} className={`flex shrink-0 items-center gap-2 border-b-3 px-4 py-4 text-sm font-bold transition ${selected ? "border-[#f9b233] text-[#101820]" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"}`}><Icon className={`size-4 ${selected ? "text-[#f9b233]" : "text-slate-400"}`} />{tab.label}</button>;
          })}
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {message ? <div className="mb-5 border-l-4 border-[#f9b233] bg-white px-4 py-3 text-sm font-semibold shadow-sm">{message}</div> : null}

        {activeTab === "standby" ? (
          <section className="bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid size-9 place-items-center bg-[#fff4d8] text-[#d18b00]"><CalendarDays className="size-5"/></div><div><h2 className="font-bold">Achterwacht</h2><p className="text-xs text-slate-500">Plan of wijzig de achterwacht per datum.</p></div></div><input type="month" value={standbyMonth} onChange={(e) => setStandbyMonth(e.target.value)} className="border px-3 py-2 text-sm" aria-label="Maand achterwacht" /></div>
            <form onSubmit={(event) => { event.preventDefault(); void action({ action: "set-standby", date: standbyDate, personName: standbyName }, "Achterwacht opgeslagen").then(() => setStandbyDate("")); }} className="grid gap-2 border-b bg-[#fff9eb] p-4 sm:grid-cols-[180px_1fr_auto]">
              <input type="date" value={standbyDate} onChange={(e) => setStandbyDate(e.target.value)} className="border px-3 py-2 text-sm" aria-label="Datum achterwacht" />
              <select value={standbyName} onChange={(e) => setStandbyName(e.target.value)} className="border px-3 py-2 text-sm" aria-label="Naam achterwacht">{standbyNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>
              <button disabled={busy || !standbyDate || !standbyName} className="flex items-center justify-center gap-2 bg-[#101820] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="size-4"/> Inplannen</button>
            </form>
            <div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
              {visibleStandby.length ? visibleStandby.map((item) => <StandbyRow key={item.date} item={item} names={standbyNames} busy={busy} save={(name) => void action({ action: "set-standby", date: item.date, personName: name }, "Achterwacht gewijzigd")} remove={() => void action({ action: "delete-standby", date: item.date }, "Achterwacht verwijderd")} />) : <div className="p-5 text-sm text-slate-500 md:col-span-2">Geen achterwacht ingepland voor deze maand.</div>}
            </div>
          </section>
        ) : null}

        {activeTab === "responders" ? (
          <section className="bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b px-5 py-4"><div className="grid size-9 place-items-center bg-slate-100 text-slate-600"><Truck className="size-5"/></div><div><h2 className="font-bold">Chauffeurs</h2><p className="text-xs text-slate-500">Beheer naam, vestiging, wagennummer en actieve status.</p></div></div>
            <div className="divide-y">
              {responders.map((responder) => <ResponderRow key={responder.id} responder={responder} depots={depots} busy={busy} save={(name, depotId, vehicleNumber, active) => void action({ action: "update-responder", id: responder.id, name, depotId, vehicleNumber, active }, "Chauffeur opgeslagen")} />)}
              <form onSubmit={(event) => { event.preventDefault(); void action({ action: "add-responder", name: newName, depotId: newDepotId }, "Chauffeur toegevoegd").then(() => setNewName("")); }} className="grid gap-2 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto]"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Voornaam" className="border bg-white px-3 py-2 text-sm"/><select value={newDepotId} onChange={(event) => setNewDepotId(event.target.value)} className="border bg-white px-3 py-2 text-sm">{depots.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button disabled={busy || !newName.trim() || !newDepotId} className="flex items-center justify-center gap-2 bg-[#101820] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="size-4"/> Toevoegen</button></form>
            </div>
          </section>
        ) : null}

        {activeTab === "depots" ? (
          <section className="bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b px-5 py-4"><div className="grid size-9 place-items-center bg-slate-100 text-slate-600"><Building2 className="size-5"/></div><div><h2 className="font-bold">Vestigingen</h2><p className="text-xs text-slate-500">Beheer welke vestigingen zichtbaar en actief zijn.</p></div></div>
            <div className="divide-y">
              {depots.map((depot) => <DepotRow key={depot.id} depot={depot} busy={busy} save={(name, active) => void action({ action: "update-depot", id: depot.id, name, active }, "Vestiging opgeslagen")} />)}
              <form onSubmit={(event) => { event.preventDefault(); void action({ action: "add-depot", name: newDepot }, "Vestiging toegevoegd").then(() => setNewDepot("")); }} className="flex gap-2 bg-slate-50 p-4"><input value={newDepot} onChange={(event) => setNewDepot(event.target.value)} placeholder="Nieuwe vestiging" className="min-w-0 flex-1 border bg-white px-3 py-2 text-sm"/><button disabled={busy || !newDepot.trim()} className="flex items-center gap-2 bg-[#101820] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="size-4"/> Toevoegen</button></form>
            </div>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b px-5 py-4"><div className="grid size-9 place-items-center bg-slate-100 text-slate-600"><KeyRound className="size-5"/></div><div><h2 className="font-bold">Instellingen</h2><p className="text-xs text-slate-500">Beveiliging van het beheergedeelte.</p></div></div>
            <div className="p-5"><h3 className="text-sm font-bold">Beheerpincode wijzigen</h3><p className="mt-1 text-xs text-slate-500">Na wijzigen word je automatisch uitgelogd.</p><form onSubmit={(event) => { event.preventDefault(); void action({ action: "change-pin", pin: newPin }, "Pincode gewijzigd — log opnieuw in").then(() => { setNewPin(""); setAuthenticated(false); }); }} className="mt-4 flex max-w-md gap-2"><input type="password" inputMode="numeric" pattern="[0-9]{4,12}" value={newPin} onChange={(event) => setNewPin(event.target.value)} placeholder="Nieuwe pincode (4–12 cijfers)" className="min-w-0 flex-1 border px-3 py-2 text-sm"/><button disabled={busy || !/^\d{4,12}$/.test(newPin)} className="flex items-center gap-2 bg-[#101820] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><Save className="size-4"/> Wijzigen</button></form></div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StandbyRow({ item, names, busy, save, remove }: { item: Standby; names: string[]; busy: boolean; save: (name: string) => void; remove: () => void }) {
  const [name, setName] = useState(item.name);
  useEffect(() => setName(item.name), [item.name]);
  const label = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${item.date}T12:00:00`));
  return <div className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-2 px-4 py-2.5"><div><p className="text-xs font-bold capitalize">{label}</p><p className="font-mono text-[10px] text-slate-400">{item.date}</p></div><select value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 border px-2.5 py-2 text-sm">{names.map((option) => <option key={option} value={option}>{option}</option>)}</select><button disabled={busy || name === item.name} onClick={() => save(name)} className="p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-25" aria-label={`${item.date} opslaan`}><Save className="size-4"/></button><button disabled={busy} onClick={remove} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`${item.date} verwijderen`}><Trash2 className="size-4"/></button></div>;
}

function DepotRow({ depot, busy, save }: { depot: Depot; busy: boolean; save: (name: string, active: boolean) => void }) {
  const [name, setName] = useState(depot.name); const [active, setActive] = useState(depot.active);
  return <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-4"><input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 border px-3 py-2 text-sm"/><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Actief</label><button disabled={busy || !name.trim()} onClick={() => save(name, active)} className="p-2 text-slate-500 hover:bg-slate-100" aria-label={`${depot.name} opslaan`}><Save className="size-4"/></button></div>;
}

function ResponderRow({ responder, depots, busy, save }: { responder: Responder; depots: Depot[]; busy: boolean; save: (name: string, depotId: string, vehicleNumber: string, active: boolean) => void }) {
  const [name, setName] = useState(responder.name); const [depotId, setDepotId] = useState(responder.depotId); const [vehicleNumber, setVehicleNumber] = useState(responder.vehicleNumber ?? ""); const [active, setActive] = useState(responder.active);
  return <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_110px_auto_auto] sm:items-center"><input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 border px-3 py-2 text-sm" aria-label="Naam chauffeur"/><select value={depotId} onChange={(e) => setDepotId(e.target.value)} className="border px-3 py-2 text-sm" aria-label="Vestiging">{depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.slice(0, 20))} placeholder="Wagennr." className="min-w-0 border px-3 py-2 font-mono text-sm" aria-label={`Wagennummer van ${responder.name}`}/><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Actief</label><button disabled={busy || !name.trim()} onClick={() => save(name, depotId, vehicleNumber, active)} className="p-2 text-slate-500 hover:bg-slate-100" aria-label={`${responder.name} opslaan`}><Save className="size-4"/></button></div>;
}