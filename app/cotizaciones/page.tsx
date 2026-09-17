"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { fmt, ESTADO_COLOR, type Cotizacion } from "@/lib/supabase";
import { getUsuario } from "@/lib/usuario";

const SUPABASE_URL = "https://gamnenyakraafruvbkin.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbW5lbnlha3JhYWZydXZia2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzU4NDQsImV4cCI6MjA4NTU1MTg0NH0.UpolMRzWNfd4hqBeYvnTrrvDu1C1rmrNXKvnO82y_OQ";

const COLS = [
  { key: "borrador",  label: "Borrador",  border: "border-slate-500", header: "bg-slate-700",  dot: "bg-slate-400" },
  { key: "enviada",   label: "Enviada",   border: "border-blue-500",  header: "bg-blue-800",   dot: "bg-blue-400"  },
  { key: "aprobada",  label: "Aprobada",  border: "border-green-500", header: "bg-green-800",  dot: "bg-green-400" },
  { key: "rechazada", label: "Rechazada", border: "border-red-500",   header: "bg-red-900",    dot: "bg-red-400"   },
] as const;

type BadgeMap = Record<number, "nuevo" | "actualizado">;
type ViewMode = "lista" | "kanban";
type AgruparPor = "" | "cliente" | "mes";

type Favorito = {
  id: string;
  nombre: string;
  estados: string[];
  vencida: boolean;
  fechaDesde: string;
  fechaHasta: string;
  agruparPor: AgruparPor;
};

const FAV_KEY = "env_cot_favoritos";
const BADGE_MS = 5 * 60 * 1000;

const ESTADO_OPTS = ["borrador", "enviada", "aprobada", "rechazada"] as const;

function isVencida(c: Cotizacion) {
  const v = new Date(c.created_at);
  v.setDate(v.getDate() + (c.vigencia_dias ?? 30));
  return v < new Date() && c.estado !== "aprobada" && c.estado !== "rechazada";
}

function mesLabel(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", { month: "long", year: "numeric" });
}

function mesKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function loadFavoritos(): Favorito[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"); } catch { return []; }
}
function saveFavoritos(favs: Favorito[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); } catch {}
}

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [realtimeOk, setRealtimeOk]     = useState<boolean | null>(null);
  const [badges, setBadges]             = useState<BadgeMap>({});
  const [view, setView]                 = useState<ViewMode>("lista");
  const [draggingId, setDraggingId]     = useState<number | null>(null);
  const [dragOverCol, setDragOverCol]   = useState<string | null>(null);
  const sbRef = useRef(createClient(SUPABASE_URL, SUPABASE_ANON));

  // ── Search & filter state ──────────────────────────────────────
  const [search,       setSearch]       = useState("");
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [estadosActivos, setEstadosActivos] = useState<string[]>([]);
  const [filtroVencida,  setFiltroVencida]  = useState(false);
  const [fechaDesde,   setFechaDesde]   = useState("");
  const [fechaHasta,   setFechaHasta]   = useState("");
  const [agruparPor,   setAgruparPor]   = useState<AgruparPor>("");
  const [favoritos,    setFavoritos]    = useState<Favorito[]>([]);
  const [nomFav,       setNomFav]       = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { setFavoritos(loadFavoritos()); }, []);

  function addBadge(id: number, tipo: "nuevo" | "actualizado") {
    setBadges((prev) => ({ ...prev, [id]: tipo }));
    setTimeout(
      () => setBadges((prev) => { const n = { ...prev }; delete n[id]; return n; }),
      BADGE_MS
    );
  }

  async function loadAll() {
    const { data } = await sbRef.current
      .from("env_cotizaciones")
      .select("*, env_clientes(nombre,empresa)")
      .order("created_at", { ascending: false });
    setCotizaciones((data ?? []) as Cotizacion[]);
    setLoading(false);
  }

  useEffect(() => {
    const sb = sbRef.current;
    loadAll();
    const channel = sb
      .channel(`cotizaciones_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "env_cotizaciones" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const { data: full } = await sb.from("env_cotizaciones").select("*, env_clientes(nombre,empresa)").eq("id", (payload.new as { id: number }).id).single();
            if (!full) return;
            setCotizaciones((prev) => [full as Cotizacion, ...prev]);
            addBadge((full as Cotizacion).id, "nuevo");
          } else if (payload.eventType === "UPDATE") {
            const { data: full } = await sb.from("env_cotizaciones").select("*, env_clientes(nombre,empresa)").eq("id", (payload.new as { id: number }).id).single();
            if (!full) return;
            setCotizaciones((prev) => prev.map((c) => c.id === (full as Cotizacion).id ? (full as Cotizacion) : c));
            addBadge((full as Cotizacion).id, "actualizado");
          }
        }
      )
      .subscribe((status) => setRealtimeOk(status === "SUBSCRIBED"));
    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cambiarEstado(id: number, estado: string) {
    const anterior = cotizaciones.find((c) => c.id === id)?.estado;
    setCotizaciones((prev) => prev.map((c) => c.id === id ? { ...c, estado: estado as Cotizacion["estado"] } : c));
    await sbRef.current.from("env_cotizaciones").update({ estado }).eq("id", id);
    if (anterior && anterior !== estado) {
      await sbRef.current.from("env_actividad").insert({
        cotizacion_id: id, usuario: getUsuario(), tipo: "estado",
        descripcion: "Estado actualizado", dato_anterior: anterior, dato_nuevo: estado,
      });
    }
  }

  // ── Drag & drop ────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, id: number) { setDraggingId(id); e.dataTransfer.effectAllowed = "move"; }
  function onDragOver(e: React.DragEvent, col: string) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(col); }
  function onDrop(e: React.DragEvent, estado: string) {
    e.preventDefault();
    if (draggingId == null) return;
    const cot = cotizaciones.find((c) => c.id === draggingId);
    if (cot && cot.estado !== estado) cambiarEstado(draggingId, estado);
    setDraggingId(null); setDragOverCol(null);
  }
  function onDragEnd() { setDraggingId(null); setDragOverCol(null); }

  // ── Filter helpers ─────────────────────────────────────────────
  function toggleEstado(e: string) {
    setEstadosActivos((prev) => prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]);
  }

  function setAtajo(estados: string[]) {
    setEstadosActivos(estados);
    setFiltroVencida(false);
  }

  function clearAll() {
    setEstadosActivos([]); setFiltroVencida(false);
    setFechaDesde(""); setFechaHasta(""); setSearch("");
  }

  function applyFavorito(fav: Favorito) {
    setEstadosActivos(fav.estados);
    setFiltroVencida(fav.vencida);
    setFechaDesde(fav.fechaDesde);
    setFechaHasta(fav.fechaHasta);
    setAgruparPor(fav.agruparPor);
    setPanelOpen(false);
  }

  function guardarFavorito() {
    if (!nomFav.trim()) return;
    const fav: Favorito = {
      id: Date.now().toString(),
      nombre: nomFav.trim(),
      estados: estadosActivos,
      vencida: filtroVencida,
      fechaDesde,
      fechaHasta,
      agruparPor,
    };
    const nuevos = [...favoritos, fav];
    setFavoritos(nuevos);
    saveFavoritos(nuevos);
    setNomFav("");
  }

  function deleteFavorito(id: string) {
    const nuevos = favoritos.filter((f) => f.id !== id);
    setFavoritos(nuevos);
    saveFavoritos(nuevos);
  }

  // ── Compute chips (active filters) ────────────────────────────
  const chips: { label: string; onRemove: () => void }[] = [];
  for (const e of estadosActivos) chips.push({ label: e, onRemove: () => toggleEstado(e) });
  if (filtroVencida) chips.push({ label: "Vigencia vencida", onRemove: () => setFiltroVencida(false) });
  if (fechaDesde) chips.push({ label: `Desde ${fechaDesde}`, onRemove: () => setFechaDesde("") });
  if (fechaHasta) chips.push({ label: `Hasta ${fechaHasta}`, onRemove: () => setFechaHasta("") });
  if (agruparPor) chips.push({ label: `Agrupado: ${agruparPor === "cliente" ? "Cliente" : "Mes"}`, onRemove: () => setAgruparPor("") });

  // ── Filtered list ──────────────────────────────────────────────
  const filtradas = cotizaciones
    .filter((c) => estadosActivos.length === 0 || estadosActivos.includes(c.estado))
    .filter((c) => !filtroVencida || isVencida(c))
    .filter((c) => !fechaDesde || c.created_at >= fechaDesde)
    .filter((c) => !fechaHasta || c.created_at <= fechaHasta + "T23:59:59")
    .filter((c) => `${c.numero} ${c.env_clientes?.empresa ?? ""} ${c.env_clientes?.nombre ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const totalFiltradas = filtradas.reduce((s, c) => s + Number(c.total), 0);

  // ── Grouping ───────────────────────────────────────────────────
  type Group = { key: string; label: string; items: Cotizacion[] };
  const grupos: Group[] = [];
  if (agruparPor === "cliente") {
    const map: Record<string, Cotizacion[]> = {};
    for (const c of filtradas) {
      const k = c.env_clientes?.empresa ?? "Sin cliente";
      (map[k] ??= []).push(c);
    }
    for (const [k, items] of Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))) {
      grupos.push({ key: k, label: k, items });
    }
  } else if (agruparPor === "mes") {
    const map: Record<string, Cotizacion[]> = {};
    for (const c of filtradas) {
      const k = mesKey(c.created_at);
      (map[k] ??= []).push(c);
    }
    for (const [k, items] of Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))) {
      grupos.push({ key: k, label: mesLabel(items[0].created_at), items });
    }
  }

  // ── Kanban card ────────────────────────────────────────────────
  const KanbanCard = useCallback(({ c }: { c: Cotizacion }) => {
    const badge = badges[c.id];
    const isDragging = draggingId === c.id;
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, c.id)}
        onDragEnd={onDragEnd}
        className={`bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing select-none transition-opacity ${isDragging ? "opacity-40" : "hover:border-slate-500"}`}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <Link href={`/cotizaciones/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-blue-400 hover:underline font-mono text-xs font-bold">{c.numero}</Link>
          <div className="flex flex-col items-end gap-1">
            {badge === "nuevo" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600 text-white font-bold animate-pulse">NUEVO</span>}
            {badge === "actualizado" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-bold">ACTUALIZADO</span>}
          </div>
        </div>
        <p className="text-white text-sm font-medium truncate">{c.env_clientes?.empresa ?? "—"}</p>
        {c.env_clientes?.nombre && <p className="text-slate-400 text-xs truncate">{c.env_clientes.nombre}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-blue-300 text-xs font-bold">S/ {fmt(Number(c.total))}</span>
          <span className="text-slate-500 text-[10px]">{new Date(c.created_at).toLocaleDateString("es-PE")}</span>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <Link href={`/cotizaciones/${c.id}/imprimir`} onClick={(e) => e.stopPropagation()} className="text-[10px] text-slate-500 hover:text-white">PDF</Link>
          {c.estado === "borrador" && <button onClick={() => cambiarEstado(c.id, "enviada")} className="text-[10px] text-yellow-400 hover:underline ml-auto">Enviar →</button>}
          {c.estado === "enviada" && (
            <>
              <button onClick={() => cambiarEstado(c.id, "aprobada")} className="text-[10px] text-green-400 hover:underline ml-auto">✓ Aprobar</button>
              <button onClick={() => cambiarEstado(c.id, "rechazada")} className="text-[10px] text-red-400 hover:underline">✕</button>
            </>
          )}
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badges, draggingId]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          {realtimeOk === true  && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-mono">● En vivo</span>}
          {realtimeOk === false && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 font-mono">✕ Sin conexión</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button onClick={() => setView("lista")}  className={`px-3 py-1.5 text-xs transition-colors ${view === "lista"  ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}>☰ Lista</button>
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-xs transition-colors ${view === "kanban" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}>⊞ Tablero</button>
          </div>
          <Link href="/cotizaciones/nueva" className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">+ Nueva</Link>
        </div>
      </div>

      {/* ── Search bar + filter panel ── */}
      <div ref={searchRef} className="relative mb-2">
        <div className="flex items-center gap-0 border border-slate-600 rounded-lg overflow-hidden bg-slate-900 focus-within:border-blue-500">
          <span className="pl-3 text-slate-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </span>
          <input
            className="flex-1 bg-transparent text-white text-sm px-3 py-2 focus:outline-none placeholder-slate-500"
            placeholder="Buscar número, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {(chips.length > 0 || search) && (
            <button onClick={clearAll} className="text-slate-500 hover:text-white px-2 text-lg leading-none" title="Limpiar filtros">×</button>
          )}
          <button
            onClick={() => setPanelOpen((p) => !p)}
            className={`flex items-center gap-1 px-3 py-2 border-l border-slate-600 text-sm transition-colors ${panelOpen ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}
          >
            <svg className={`w-4 h-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>

        {/* ── Dropdown panel ── */}
        {panelOpen && (
          <div ref={panelRef} className="absolute top-full left-0 right-0 z-50 mt-1 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-700">

              {/* FILTROS */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L13 10.414V17a1 1 0 01-.553.894l-4 2A1 1 0 017 19v-8.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd"/></svg>
                  <span className="text-sm font-bold text-white">Filtros</span>
                </div>
                <div className="space-y-0.5 text-sm">
                  {/* Estado checkboxes */}
                  <p className="text-slate-500 text-xs uppercase tracking-wide pt-1 pb-1">Estado</p>
                  {ESTADO_OPTS.map((e) => (
                    <label key={e} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-700 cursor-pointer">
                      <input type="checkbox" className="accent-blue-500" checked={estadosActivos.includes(e)} onChange={() => toggleEstado(e)} />
                      <span className="capitalize text-slate-300">{e}</span>
                    </label>
                  ))}
                  {/* Atajos */}
                  <p className="text-slate-500 text-xs uppercase tracking-wide pt-3 pb-1">Atajos</p>
                  <button onClick={() => setAtajo(["aprobada"])} className="block w-full text-left px-1 py-1 rounded hover:bg-slate-700 text-slate-300">Ganadas</button>
                  <button onClick={() => setAtajo(["rechazada"])} className="block w-full text-left px-1 py-1 rounded hover:bg-slate-700 text-slate-300">Perdidas</button>
                  <button onClick={() => setAtajo(["borrador", "enviada"])} className="block w-full text-left px-1 py-1 rounded hover:bg-slate-700 text-slate-300">Abiertas</button>
                  <label className="flex items-center gap-2 px-1 py-1 rounded hover:bg-slate-700 cursor-pointer">
                    <input type="checkbox" className="accent-amber-500" checked={filtroVencida} onChange={(e) => setFiltroVencida(e.target.checked)} />
                    <span className="text-slate-300">Vigencia vencida</span>
                  </label>
                  {/* Fecha de creación */}
                  <p className="text-slate-500 text-xs uppercase tracking-wide pt-3 pb-1">Fecha de creación</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs w-10">Desde</span>
                      <input type="date" className="flex-1 bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-xs w-10">Hasta</span>
                      <input type="date" className="flex-1 bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>

              {/* AGRUPAR POR */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h7"/></svg>
                  <span className="text-sm font-bold text-white">Agrupar por</span>
                </div>
                <div className="space-y-0.5 text-sm">
                  {([["", "Sin agrupar"], ["cliente", "Cliente"], ["mes", "Mes de creación"]] as [AgruparPor, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setAgruparPor(val)}
                      className={`block w-full text-left px-2 py-1.5 rounded transition-colors ${agruparPor === val ? "bg-teal-900/60 text-teal-300 font-medium" : "text-slate-300 hover:bg-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                  {view === "kanban" && (
                    <p className="text-slate-600 text-xs pt-3 italic">En Tablero siempre agrupa por Estado</p>
                  )}
                </div>
              </div>

              {/* FAVORITOS */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  <span className="text-sm font-bold text-white">Favoritos</span>
                </div>
                <div className="space-y-0.5 text-sm mb-3">
                  {favoritos.length === 0 ? (
                    <p className="text-slate-600 text-xs italic">Sin búsquedas guardadas.</p>
                  ) : favoritos.map((fav) => (
                    <div key={fav.id} className="flex items-center justify-between px-1 py-1 rounded hover:bg-slate-700 group">
                      <button onClick={() => applyFavorito(fav)} className="flex-1 text-left text-slate-300 hover:text-white truncate">{fav.nombre}</button>
                      <button onClick={() => deleteFavorito(fav.id)} className="text-slate-600 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-base leading-none">×</button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-slate-500 text-xs mb-1.5">Guardar búsqueda actual</p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-yellow-500 placeholder-slate-600"
                      placeholder="Nombre del favorito..."
                      value={nomFav}
                      onChange={(e) => setNomFav(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && guardarFavorito()}
                    />
                    <button onClick={guardarFavorito} disabled={!nomFav.trim()} className="text-xs bg-yellow-700 hover:bg-yellow-600 disabled:opacity-40 text-white px-2 py-1.5 rounded transition-colors">
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-700 flex items-center justify-between">
              <button onClick={clearAll} className="text-xs text-slate-500 hover:text-white transition-colors">Limpiar todo</button>
              <button onClick={() => setPanelOpen(false)} className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors">Aplicar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((chip) => (
            <span key={chip.label} className="inline-flex items-center gap-1 text-xs bg-blue-900/60 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full capitalize">
              {chip.label}
              <button onClick={chip.onRemove} className="hover:text-white ml-0.5 leading-none">×</button>
            </span>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && filtradas.length > 0 && view === "lista" && (
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
          <span>{filtradas.length} cotizaciones</span>
          <span>Total: <b className="text-blue-300 font-mono">S/ {fmt(totalFiltradas)}</b></span>
        </div>
      )}

      {/* ── LISTA ── */}
      {view === "lista" && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                <th className="text-left px-4 py-3">N° Cotización</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="text-center text-slate-500 py-10">Cargando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-slate-500 py-10">Sin cotizaciones.</td></tr>
              ) : agruparPor ? (
                /* Grouped rows */
                grupos.map((g) => (
                  <>
                    <tr key={`hdr-${g.key}`} className="bg-slate-700/50">
                      <td colSpan={6} className="px-4 py-2 text-xs font-bold text-slate-300 uppercase tracking-wide">
                        {g.label}
                        <span className="ml-2 text-slate-500 font-normal normal-case">({g.items.length})</span>
                        <span className="ml-3 font-mono text-blue-300 font-normal">S/ {fmt(g.items.reduce((s, c) => s + Number(c.total), 0))}</span>
                      </td>
                    </tr>
                    {g.items.map((c) => <ListRow key={c.id} c={c} badge={badges[c.id]} cambiarEstado={cambiarEstado} />)}
                  </>
                ))
              ) : (
                filtradas.map((c) => <ListRow key={c.id} c={c} badge={badges[c.id]} cambiarEstado={cambiarEstado} />)
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── KANBAN ── */}
      {view === "kanban" && (
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4 min-h-0">
          {COLS.map((col) => {
            const cards = cotizaciones.filter((c) =>
              c.estado === col.key &&
              `${c.numero} ${c.env_clientes?.empresa ?? ""} ${c.env_clientes?.nombre ?? ""}`.toLowerCase().includes(search.toLowerCase())
            );
            const colTotal = cards.reduce((s, c) => s + Number(c.total), 0);
            const isOver = dragOverCol === col.key;
            return (
              <div key={col.key} onDragOver={(e) => onDragOver(e, col.key)} onDrop={(e) => onDrop(e, col.key)} onDragLeave={() => setDragOverCol(null)}
                className={`flex flex-col w-72 shrink-0 rounded-xl border-2 transition-colors ${col.border} ${isOver ? "bg-slate-700/60" : "bg-slate-800/50"}`}>
                <div className={`${col.header} rounded-t-lg px-3 py-2.5 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className="font-semibold text-sm text-white capitalize">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/60 font-mono">S/ {fmt(colTotal)}</span>
                    <span className="text-xs bg-black/30 text-white px-1.5 py-0.5 rounded-full font-bold">{cards.length}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
                  {loading ? (
                    <p className="text-slate-500 text-xs text-center py-4">Cargando...</p>
                  ) : cards.length === 0 ? (
                    <div className={`flex-1 rounded-lg border-2 border-dashed ${isOver ? "border-slate-400" : "border-slate-700"} flex items-center justify-center min-h-20`}>
                      <p className="text-slate-600 text-xs">Arrastra aquí</p>
                    </div>
                  ) : cards.map((c) => <KanbanCard key={c.id} c={c} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ListRow({ c, badge, cambiarEstado }: {
  c: Cotizacion;
  badge: "nuevo" | "actualizado" | undefined;
  cambiarEstado: (id: number, estado: string) => void;
}) {
  return (
    <tr className={`transition-colors duration-700 ${badge === "nuevo" ? "bg-green-950/40" : badge === "actualizado" ? "bg-amber-950/40" : "hover:bg-slate-700/40"}`}>
      <td className="px-4 py-3">
        <Link href={`/cotizaciones/${c.id}`} className="text-blue-400 hover:underline font-mono font-medium">{c.numero}</Link>
      </td>
      <td className="px-4 py-3">
        <p className="text-white">{c.env_clientes?.empresa ?? "—"}</p>
        <p className="text-slate-500 text-xs">{c.env_clientes?.nombre ?? ""}</p>
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString("es-PE")}</td>
      <td className="px-4 py-3 text-right font-mono font-bold text-blue-300">S/ {fmt(Number(c.total))}</td>
      <td className="px-4 py-3 text-center">
        <div className="flex flex-col items-center gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
          {badge === "nuevo"       && <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white font-bold animate-pulse">NUEVO</span>}
          {badge === "actualizado" && <span className="text-xs px-2 py-0.5 rounded bg-amber-600 text-white font-bold">ACTUALIZADO</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1 flex-wrap">
          <Link href={`/cotizaciones/${c.id}`}         className="text-xs text-blue-400 hover:underline">Ver</Link>
          <span className="text-slate-600">|</span>
          <Link href={`/cotizaciones/${c.id}/editar`}  className="text-xs text-slate-400 hover:text-white">Editar</Link>
          <span className="text-slate-600">|</span>
          <Link href={`/cotizaciones/${c.id}/imprimir`} className="text-xs text-slate-400 hover:text-white">Imprimir</Link>
          {c.estado === "borrador" && (<><span className="text-slate-600">|</span><button onClick={() => cambiarEstado(c.id, "enviada")} className="text-xs text-yellow-400 hover:underline">Enviar</button></>)}
          {c.estado === "enviada"  && (<>
            <span className="text-slate-600">|</span>
            <button onClick={() => cambiarEstado(c.id, "aprobada")}  className="text-xs text-green-400 hover:underline">Aprobar</button>
            <span className="text-slate-600">|</span>
            <button onClick={() => cambiarEstado(c.id, "rechazada")} className="text-xs text-red-400 hover:underline">Rechazar</button>
          </>)}
        </div>
      </td>
    </tr>
  );
}
