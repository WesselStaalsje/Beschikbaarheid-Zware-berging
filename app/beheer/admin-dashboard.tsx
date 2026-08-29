"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Building2, KeyRound, LogOut, Plus, Save, Truck, UserRoundCog } from "lucide-react";

type Depot = { id: string; name: string; sortOrder: number; active: boolean };
type Responder = { id: string; name: string; depotId: string; vehicleNumber: string | null; sortOrder: number; active: boolean };

export function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [depots, setDepots] = useState<Depot[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [newDepot, setNewDepot] = useState("");
  const [newName, setNewName] = useState("");
  const [newDepotId, setNewDepotId] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (response.status === 401) { setAuthenticated(false); return; }
    const data = await response.json() as { depots: Depot[]; responders: Responder[] };
    setDepots(data.depots); setResponders(data.responders); setNewDepotId((current) => current || data.depots.find((depot) => depot.active)?.id || ""); setAuthenticated(true);
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
      <header className="border-b border-[#24313d] bg-[#101820] text-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><UserRoundCog className="text-[#f9b233]" /><div><h1 className="font-bold">Beheer Plusdiensten</h1><p className="text-xs text-white/55">Vestigingen en chauffeurs</p></div></div><div className="flex gap-2"><Link href="/" className="flex items-center gap-2 border border-white/20 px-3 py-2 text-xs font-bold"><ArrowLeft className="size-4" /> Dashboard</Link><button onClick={async () => { await fetch("/api/admin/session", { method: "DELETE" }); setAuthenticated(false); }} className="border border-white/20 p-2" aria-label="Uitloggen"><LogOut className="size-4" /></button></div></div></header>
      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-2">
        {message ? <div className="border-l-4 border-[#f9b233] bg-white px-4 py-3 text-sm font-semibold lg:col-span-2">{message}</div> : null}
        <section className="bg-white shadow-sm"><div className="flex items-center gap-2 border-b px-5 py-4"><Building2 className="size-5 text-slate-500"/><h2 className="font-bold">Vestigingen</h2></div><div className="divide-y">
          {depots.map((depot) => <DepotRow key={depot.id} depot={depot} busy={busy} save={(name, active) => void action({ action: "update-depot", id: depot.id, name, active }, "Vestiging opgeslagen")} />)}
          <form onSubmit={(event) => { event.preventDefault(); void action({ action: "add-depot", name: newDepot }, "Vestiging toegevoegd").then(() => setNewDepot("")); }} className="flex gap-2 p-4"><input value={newDepot} onChange={(event) => setNewDepot(event.target.value)} placeholder="Nieuwe vestiging" className="min-w-0 flex-1 border px-3 py-2 text-sm"/><button disabled={busy || !newDepot.trim()} className="flex items-center gap-2 bg-[#101820] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="size-4"/> Toevoegen</button></form>
        </div></section>
        <section className="bg-white shadow-sm"><div className="flex items-center gap-2 border-b px-5 py-4"><Truck className="size-5 text-slate-500"/><h2 className="font-bold">Chauffeurs</h2></div><div className="divide-y">
          {responders.map((responder) => <ResponderRow key={responder.id} responder={responder} depots={depots} busy={busy} save={(name, depotId, vehicleNumber, active) => void action({ action: "update-responder", id: responder.id, name, depotId, vehicleNumber, active }, "Chauffeur opgeslagen")} />)}
          <form onSubmit={(event) => { event.preventDefault(); void action({ action: "add-responder", name: newName, depotId: newDepotId }, "Chauffeur toegevoegd").then(() => setNewName("")); }} className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_auto]"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Voornaam" className="border px-3 py-2 text-sm"/><select value={newDepotId} onChange={(event) => setNewDepotId(event.target.value)} className="border px-3 py-2 text-sm">{depots.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><button disabled={busy || !newName.trim() || !newDepotId} className="flex items-center justify-center gap-2 bg-[#101820] px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Plus className="size-4"/> Toevoegen</button></form>
        </div></section>
        <section className="bg-white p-5 shadow-sm lg:col-span-2"><div className="flex items-center gap-2"><KeyRound className="size-5 text-slate-500"/><h2 className="font-bold">Pincode wijzigen</h2></div><form onSubmit={(event) => { event.preventDefault(); void action({ action: "change-pin", pin: newPin }, "Pincode gewijzigd — log opnieuw in").then(() => { setNewPin(""); setAuthenticated(false); }); }} className="mt-4 flex max-w-md gap-2"><input type="password" inputMode="numeric" pattern="[0-9]{4,12}" value={newPin} onChange={(event) => setNewPin(event.target.value)} placeholder="Nieuwe pincode (4–12 cijfers)" className="min-w-0 flex-1 border px-3 py-2 text-sm"/><button disabled={busy || !/^\d{4,12}$/.test(newPin)} className="flex items-center gap-2 bg-[#101820] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"><Save className="size-4"/> Wijzigen</button></form></section>
      </div>
    </main>
  );
}

function DepotRow({ depot, busy, save }: { depot: Depot; busy: boolean; save: (name: string, active: boolean) => void }) {
  const [name, setName] = useState(depot.name); const [active, setActive] = useState(depot.active);
  return <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 p-4"><input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 border px-3 py-2 text-sm"/><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Actief</label><button disabled={busy || !name.trim()} onClick={() => save(name, active)} className="p-2 text-slate-500 hover:bg-slate-100" aria-label={`${depot.name} opslaan`}><Save className="size-4"/></button></div>;
}

function ResponderRow({ responder, depots, busy, save }: { responder: Responder; depots: Depot[]; busy: boolean; save: (name: string, depotId: string, vehicleNumber: string, active: boolean) => void }) {
  const [name, setName] = useState(responder.name); const [depotId, setDepotId] = useState(responder.depotId); const [vehicleNumber, setVehicleNumber] = useState(responder.vehicleNumber ?? ""); const [active, setActive] = useState(responder.active);
  return <div className="grid gap-2 p-4 sm:grid-cols-[1fr_1fr_110px_auto_auto] sm:items-center"><input value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 border px-3 py-2 text-sm" aria-label="Naam chauffeur"/><select value={depotId} onChange={(e) => setDepotId(e.target.value)} className="border px-3 py-2 text-sm" aria-label="Vestiging">{depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select><input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.slice(0, 20))} placeholder="Wagennr." className="min-w-0 border px-3 py-2 font-mono text-sm" aria-label={`Wagennummer van ${responder.name}`}/><label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Actief</label><button disabled={busy || !name.trim()} onClick={() => save(name, depotId, vehicleNumber, active)} className="p-2 text-slate-500 hover:bg-slate-100" aria-label={`${responder.name} opslaan`}><Save className="size-4"/></button></div>;
}
