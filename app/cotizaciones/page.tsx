"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, fmt, ESTADO_COLOR, type Cotizacion } from "@/lib/supabase";

const ESTADOS = ["todos", "borrador", "enviada", "aprobada", "rechazada"] as const;

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("env_cotizaciones")
      .select("*, env_clientes(nombre,empresa)")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCotizaciones((data ?? []) as Cotizacion[]); setLoading(false); });
  }, []);

  async function cambiarEstado(id: number, estado: string) {
    await supabase.from("env_cotizaciones").update({ estado }).eq("id", id);
    setCotizaciones((prev) => prev.map((c) => c.id === id ? { ...c, estado: estado as Cotizacion["estado"] } : c));
  }

  const filtradas = cotizaciones
    .filter((c) => filtroEstado === "todos" || c.estado === filtroEstado)
    .filter((c) => `${c.numero} ${c.env_clientes?.empresa ?? ""} ${c.env_clientes?.nombre ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  const totalFiltradas = filtradas.reduce((s, c) => s + Number(c.total), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cotizaciones</h1>
        <Link href="/cotizaciones/nueva" className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + Nueva Cotización
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ESTADOS.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`text-xs px-3 py-1.5 rounded-full capitalize transition-colors ${filtroEstado === e ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
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

      {/* Summary */}
      {filtradas.length > 0 && (
        <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
          <span>{filtradas.length} cotizaciones</span>
          <span>Total: <b className="text-blue-300 font-mono">S/ {fmt(totalFiltradas)}</b></span>
        </div>
      )}

      {/* Table */}
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
            ) : filtradas.map((c) => (
              <tr key={c.id} className="hover:bg-slate-700/40 transition-colors">
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
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    <Link href={`/cotizaciones/${c.id}`} className="text-xs text-blue-400 hover:underline">Ver</Link>
                    <span className="text-slate-600">|</span>
                    <Link href={`/cotizaciones/${c.id}/imprimir`} className="text-xs text-slate-400 hover:text-white">Imprimir</Link>
                    {c.estado === "borrador" && (
                      <>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => cambiarEstado(c.id, "enviada")} className="text-xs text-yellow-400 hover:underline">Enviar</button>
                      </>
                    )}
                    {c.estado === "enviada" && (
                      <>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => cambiarEstado(c.id, "aprobada")} className="text-xs text-green-400 hover:underline">Aprobar</button>
                        <span className="text-slate-600">|</span>
                        <button onClick={() => cambiarEstado(c.id, "rechazada")} className="text-xs text-red-400 hover:underline">Rechazar</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
