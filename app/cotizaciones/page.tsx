"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { fmt, ESTADO_COLOR, type Cotizacion } from "@/lib/supabase";
import { getUsuario } from "@/lib/usuario";

const SUPABASE_URL = "https://gamnenyakraafruvbkin.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbW5lbnlha3JhYWZydXZia2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzU4NDQsImV4cCI6MjA4NTU1MTg0NH0.UpolMRzWNfd4hqBeYvnTrrvDu1C1rmrNXKvnO82y_OQ";

const ESTADOS = ["todos", "borrador", "enviada", "aprobada", "rechazada"] as const;

const COLS = [
  { key: "borrador",  label: "Borrador",  border: "border-slate-500", header: "bg-slate-700",  dot: "bg-slate-400" },
  { key: "enviada",   label: "Enviada",   border: "border-blue-500",  header: "bg-blue-800",   dot: "bg-blue-400"  },
  { key: "aprobada",  label: "Aprobada",  border: "border-green-500", header: "bg-green-800",  dot: "bg-green-400" },
  { key: "rechazada", label: "Rechazada", border: "border-red-500",   header: "bg-red-900",    dot: "bg-red-400"   },
] as const;

type BadgeMap = Record<number, "nuevo" | "actualizado">;
type ViewMode = "lista" | "kanban";

const BADGE_MS = 5 * 60 * 1000;

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading]           = useState(true);
  const [realtimeOk, setRealtimeOk]     = useState<boolean | null>(null);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [search, setSearch]             = useState("");
  const [badges, setBadges]             = useState<BadgeMap>({});
  const [view, setView]                 = useState<ViewMode>("lista");
  const [draggingId, setDraggingId]     = useState<number | null>(null);
  const [dragOverCol, setDragOverCol]   = useState<string | null>(null);
  const sbRef = useRef(createClient(SUPABASE_URL, SUPABASE_ANON));

  function addBadge(id: number, tipo: "nuevo" | "actualizado") {
    setBadges((prev) => ({ ...prev, [id]: tipo }));
    setTimeout(
      () => setBadges((prev) => { const n = { ...prev }; delete n[id]; return n; }),
      BADGE_MS
    );
  }

  async function loadAll() {
    const sb = sbRef.current;
    const { data } = await sb
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
            const { data: full } = await sb
              .from("env_cotizaciones")
              .select("*, env_clientes(nombre,empresa)")
              .eq("id", (payload.new as { id: number }).id)
              .single();
            if (!full) return;
            setCotizaciones((prev) => [full as Cotizacion, ...prev]);
            addBadge((full as Cotizacion).id, "nuevo");
          } else if (payload.eventType === "UPDATE") {
            const { data: full } = await sb
              .from("env_cotizaciones")
              .select("*, env_clientes(nombre,empresa)")
              .eq("id", (payload.new as { id: number }).id)
              .single();
            if (!full) return;
            setCotizaciones((prev) =>
              prev.map((c) => (c.id === (full as Cotizacion).id ? (full as Cotizacion) : c))
            );
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
    // Optimistic update
    setCotizaciones((prev) =>
      prev.map((c) => c.id === id ? { ...c, estado: estado as Cotizacion["estado"] } : c)
    );
    await sbRef.current.from("env_cotizaciones").update({ estado }).eq("id", id);
    if (anterior && anterior !== estado) {
      await sbRef.current.from("env_actividad").insert({
        cotizacion_id: id,
        usuario: getUsuario(),
        tipo: "estado",
        descripcion: "Estado actualizado",
        dato_anterior: anterior,
        dato_nuevo: estado,
      });
    }
  }

  // ── Drag & drop handlers ──────────────────────────────────────
  function onDragStart(e: React.DragEvent, id: number) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent, col: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(col);
  }
  function onDrop(e: React.DragEvent, estado: string) {
    e.preventDefault();
    if (draggingId == null) return;
    const cot = cotizaciones.find((c) => c.id === draggingId);
    if (cot && cot.estado !== estado) cambiarEstado(draggingId, estado);
    setDraggingId(null);
    setDragOverCol(null);
  }
  function onDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  // ── Filtered list ─────────────────────────────────────────────
  const filtradas = cotizaciones
    .filter((c) => filtroEstado === "todos" || c.estado === filtroEstado)
    .filter((c) =>
      `${c.numero} ${c.env_clientes?.empresa ?? ""} ${c.env_clientes?.nombre ?? ""}`
        .toLowerCase().includes(search.toLowerCase())
    );

  const totalFiltradas = filtradas.reduce((s, c) => s + Number(c.total), 0);

  // ── Kanban card ───────────────────────────────────────────────
  function KanbanCard({ c }: { c: Cotizacion }) {
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
          <Link
            href={`/cotizaciones/${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-blue-400 hover:underline font-mono text-xs font-bold"
          >
            {c.numero}
          </Link>
          <div className="flex flex-col items-end gap-1">
            {badge === "nuevo" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-600 text-white font-bold animate-pulse">NUEVO</span>
            )}
            {badge === "actualizado" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white font-bold">ACTUALIZADO</span>
            )}
          </div>
        </div>
        <p className="text-white text-sm font-medium truncate">{c.env_clientes?.empresa ?? "—"}</p>
        {c.env_clientes?.nombre && (
          <p className="text-slate-400 text-xs truncate">{c.env_clientes.nombre}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="font-mono text-blue-300 text-xs font-bold">S/ {fmt(Number(c.total))}</span>
          <span className="text-slate-500 text-[10px]">
            {new Date(c.created_at).toLocaleDateString("es-PE")}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-2">
          <Link href={`/cotizaciones/${c.id}/imprimir`} onClick={(e) => e.stopPropagation()} className="text-[10px] text-slate-500 hover:text-white">PDF</Link>
          {c.estado === "borrador" && (
            <button onClick={() => cambiarEstado(c.id, "enviada")} className="text-[10px] text-yellow-400 hover:underline ml-auto">Enviar →</button>
          )}
          {c.estado === "enviada" && (
            <>
              <button onClick={() => cambiarEstado(c.id, "aprobada")} className="text-[10px] text-green-400 hover:underline ml-auto">✓ Aprobar</button>
              <button onClick={() => cambiarEstado(c.id, "rechazada")} className="text-[10px] text-red-400 hover:underline">✕</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Cotizaciones</h1>
          {realtimeOk === true && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-mono">● En vivo</span>
          )}
          {realtimeOk === false && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 font-mono">✕ Sin conexión</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              onClick={() => setView("lista")}
              className={`px-3 py-1.5 text-xs transition-colors ${view === "lista" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
              title="Vista lista"
            >
              ☰ Lista
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs transition-colors ${view === "kanban" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-400 hover:bg-slate-800"}`}
              title="Vista kanban"
            >
              ⊞ Tablero
            </button>
          </div>
          <Link
            href="/cotizaciones/nueva"
            className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            + Nueva
          </Link>
        </div>
      </div>

      {/* Filters (list only) */}
      {view === "lista" && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {ESTADOS.map((e) => (
            <button
              key={e}
              onClick={() => setFiltroEstado(e)}
              className={`text-xs px-3 py-1.5 rounded-full capitalize transition-colors ${
                filtroEstado === e ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {e}
            </button>
          ))}
          <input
            className="ml-auto bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 w-52"
            placeholder="Buscar número, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Search (kanban) */}
      {view === "kanban" && (
        <div className="mb-4">
          <input
            className="bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 w-64"
            placeholder="Buscar número, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ── LISTA ── */}
      {view === "lista" && (
        <>
          {filtradas.length > 0 && (
            <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
              <span>{filtradas.length} cotizaciones</span>
              <span>Total: <b className="text-blue-300 font-mono">S/ {fmt(totalFiltradas)}</b></span>
            </div>
          )}
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
                ) : filtradas.map((c) => {
                  const badge = badges[c.id];
                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors duration-700 ${
                        badge === "nuevo" ? "bg-green-950/40"
                        : badge === "actualizado" ? "bg-amber-950/40"
                        : "hover:bg-slate-700/40"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link href={`/cotizaciones/${c.id}`} className="text-blue-400 hover:underline font-mono font-medium">
                          {c.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white">{c.env_clientes?.empresa ?? "—"}</p>
                        <p className="text-slate-500 text-xs">{c.env_clientes?.nombre ?? ""}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(c.created_at).toLocaleDateString("es-PE")}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-blue-300">
                        S/ {fmt(Number(c.total))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
                          {badge === "nuevo" && (
                            <span className="text-xs px-2 py-0.5 rounded bg-green-600 text-white font-bold animate-pulse">NUEVO</span>
                          )}
                          {badge === "actualizado" && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-600 text-white font-bold">ACTUALIZADO</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <Link href={`/cotizaciones/${c.id}`} className="text-xs text-blue-400 hover:underline">Ver</Link>
                          <span className="text-slate-600">|</span>
                          <Link href={`/cotizaciones/${c.id}/imprimir`} className="text-xs text-slate-400 hover:text-white">Imprimir</Link>
                          {c.estado === "borrador" && (
                            <><span className="text-slate-600">|</span>
                            <button onClick={() => cambiarEstado(c.id, "enviada")} className="text-xs text-yellow-400 hover:underline">Enviar</button></>
                          )}
                          {c.estado === "enviada" && (
                            <><span className="text-slate-600">|</span>
                            <button onClick={() => cambiarEstado(c.id, "aprobada")} className="text-xs text-green-400 hover:underline">Aprobar</button>
                            <span className="text-slate-600">|</span>
                            <button onClick={() => cambiarEstado(c.id, "rechazada")} className="text-xs text-red-400 hover:underline">Rechazar</button></>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── KANBAN ── */}
      {view === "kanban" && (
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4 min-h-0">
          {COLS.map((col) => {
            const cards = cotizaciones.filter((c) =>
              c.estado === col.key &&
              `${c.numero} ${c.env_clientes?.empresa ?? ""} ${c.env_clientes?.nombre ?? ""}`
                .toLowerCase().includes(search.toLowerCase())
            );
            const colTotal = cards.reduce((s, c) => s + Number(c.total), 0);
            const isOver = dragOverCol === col.key;

            return (
              <div
                key={col.key}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDrop={(e) => onDrop(e, col.key)}
                onDragLeave={() => setDragOverCol(null)}
                className={`flex flex-col w-72 shrink-0 rounded-xl border-2 transition-colors ${col.border} ${isOver ? "bg-slate-700/60" : "bg-slate-800/50"}`}
              >
                {/* Column header */}
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

                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto">
                  {loading ? (
                    <p className="text-slate-500 text-xs text-center py-4">Cargando...</p>
                  ) : cards.length === 0 ? (
                    <div className={`flex-1 rounded-lg border-2 border-dashed ${isOver ? "border-slate-400" : "border-slate-700"} flex items-center justify-center min-h-20`}>
                      <p className="text-slate-600 text-xs">Arrastra aquí</p>
                    </div>
                  ) : (
                    cards.map((c) => <KanbanCard key={c.id} c={c} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
