"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase, fmt, ESTADO_COLOR, type Cotizacion } from "@/lib/supabase";

export default function DetalleCotizacion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("env_cotizaciones")
      .select("*, env_clientes(*), env_cotizacion_items(*, env_envases(nombre,categoria))")
      .eq("id", id)
      .single()
      .then(({ data }) => { setCot(data as Cotizacion); setLoading(false); });
  }, [id]);

  async function cambiarEstado(estado: string) {
    await supabase.from("env_cotizaciones").update({ estado }).eq("id", id);
    setCot((prev) => prev ? { ...prev, estado: estado as Cotizacion["estado"] } : prev);
  }

  if (loading) return <div className="text-slate-400 py-10 text-center">Cargando...</div>;
  if (!cot) return <div className="text-slate-400 py-10 text-center">Cotización no encontrada.</div>;

  const cl = cot.env_clientes;
  const items = cot.env_cotizacion_items ?? [];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">← Volver</button>
        <h1 className="text-2xl font-bold flex-1">{cot.numero}</h1>
        <span className={`text-sm px-3 py-1 rounded-full ${ESTADO_COLOR[cot.estado]}`}>{cot.estado}</span>
      </div>

      {/* Client */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">Cliente</p>
            <p className="text-white font-medium">{cl?.empresa}</p>
            <p className="text-slate-400">{cl?.nombre}</p>
            {cl?.ruc && <p className="text-slate-500 text-xs">RUC: {cl.ruc}</p>}
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs mb-1">Fecha</p>
            <p className="text-white">{new Date(cot.created_at).toLocaleDateString("es-PE")}</p>
            <p className="text-slate-400 text-xs">Vigencia: {cot.vigencia_dias} días</p>
            {cl?.email && <p className="text-slate-500 text-xs">{cl.email}</p>}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Descripción</th>
              <th className="text-right px-4 py-3">Cant.</th>
              <th className="text-right px-4 py-3">P. Unit.</th>
              <th className="text-right px-4 py-3">Desc.</th>
              <th className="text-right px-4 py-3">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {items.map((it) => (
              <tr key={it.id}>
                <td className="px-4 py-3 text-white">{it.descripcion}</td>
                <td className="px-4 py-3 text-right text-slate-300">{it.cantidad}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">S/ {fmt(it.precio_unitario)}</td>
                <td className="px-4 py-3 text-right text-slate-400">{it.descuento > 0 ? `${it.descuento}%` : "—"}</td>
                <td className="px-4 py-3 text-right font-mono font-medium text-blue-300">S/ {fmt(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 min-w-64 flex flex-col gap-2 text-sm">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal</span><span className="font-mono">S/ {fmt(Number(cot.subtotal))}</span>
          </div>
          {Number(cot.descuento_global) > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Descuento ({cot.descuento_global}%)</span>
              <span className="font-mono text-red-400">- S/ {fmt(Number(cot.subtotal) * Number(cot.descuento_global) / 100)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-400">
            <span>IGV (18%)</span><span className="font-mono">S/ {fmt(Number(cot.igv))}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-slate-600 pt-2">
            <span>TOTAL</span><span className="font-mono text-blue-400 text-lg">S/ {fmt(Number(cot.total))}</span>
          </div>
        </div>
      </div>

      {cot.notas && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
          <p className="text-xs text-slate-400 mb-1">Notas / Condiciones</p>
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{cot.notas}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={`/cotizaciones/${id}/imprimir`} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          🖨️ Imprimir / PDF
        </Link>
        {cot.estado === "borrador" && (
          <button onClick={() => cambiarEstado("enviada")} className="bg-yellow-700 hover:bg-yellow-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            Marcar como Enviada
          </button>
        )}
        {cot.estado === "enviada" && (
          <>
            <button onClick={() => cambiarEstado("aprobada")} className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              ✓ Aprobada
            </button>
            <button onClick={() => cambiarEstado("rechazada")} className="bg-red-800 hover:bg-red-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              ✕ Rechazada
            </button>
          </>
        )}
      </div>
    </div>
  );
}
