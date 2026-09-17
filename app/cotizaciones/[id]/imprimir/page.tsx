"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, fmt, type Cotizacion } from "@/lib/supabase";

export default function ImprimirCotizacion() {
  const { id } = useParams<{ id: string }>();
  const [cot, setCot] = useState<Cotizacion | null>(null);

  useEffect(() => {
    supabase
      .from("env_cotizaciones")
      .select("*, env_clientes(*), env_cotizacion_items(*, env_envases(nombre,categoria))")
      .eq("id", id)
      .single()
      .then(({ data }) => setCot(data as Cotizacion));
  }, [id]);

  if (!cot) return <div className="flex items-center justify-center h-screen text-slate-400">Cargando...</div>;

  const cl = cot.env_clientes;
  const items = cot.env_cotizacion_items ?? [];
  const fecha = new Date(cot.created_at);
  const vigenciaFecha = new Date(fecha);
  vigenciaFecha.setDate(vigenciaFecha.getDate() + cot.vigencia_dias);

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { box-shadow: none !important; }
        }
        body { background: #e2e8f0; }
      `}</style>

      {/* Print button */}
      <div className="no-print flex justify-center gap-3 py-4 bg-slate-800">
        <button
          onClick={() => window.print()}
          className="bg-blue-700 hover:bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
        >
          🖨️ Imprimir / Guardar PDF
        </button>
        <button
          onClick={() => window.history.back()}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          ← Volver
        </button>
      </div>

      {/* Printable page */}
      <div className="print-page bg-white text-gray-800 max-w-3xl mx-auto my-6 p-10 shadow-lg rounded-lg font-sans">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-blue-700 pb-6 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-blue-800">COTIZACIÓN</h1>
            <p className="text-3xl font-mono font-bold text-gray-700 mt-1">{cot.numero}</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p className="font-bold text-base text-gray-800">Envases para Alimentos S.A.C.</p>
            <p>contacto@envases.pe</p>
            <p>+51 999 000 111</p>
            <p className="mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                cot.estado === "aprobada" ? "bg-green-100 text-green-800"
                : cot.estado === "enviada" ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-600"
              }`}>
                {cot.estado.toUpperCase()}
              </span>
            </p>
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1 font-medium">Fecha de emisión</p>
            <p className="font-medium">{fecha.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1 font-medium">Válida hasta</p>
            <p className="font-medium">{vigenciaFecha.toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Client */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm">
          <p className="text-blue-700 text-xs uppercase font-semibold mb-2">Datos del cliente</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="font-bold text-gray-800">{cl?.empresa}</p>
              <p className="text-gray-600">{cl?.nombre}</p>
            </div>
            <div className="text-right text-gray-600">
              {cl?.ruc && <p>RUC: <span className="font-mono">{cl.ruc}</span></p>}
              {cl?.email && <p>{cl.email}</p>}
              {cl?.telefono && <p>{cl.telefono}</p>}
              {cl?.direccion && <p className="text-xs">{cl.direccion}</p>}
            </div>
          </div>
        </div>

        {/* Items table */}
        <table className="w-full text-sm mb-6 border-collapse">
          <thead>
            <tr className="bg-blue-700 text-white">
              <th className="text-left px-3 py-2 rounded-tl-md">Descripción</th>
              <th className="text-right px-3 py-2 w-16">Cant.</th>
              <th className="text-right px-3 py-2 w-28">P. Unit.</th>
              <th className="text-right px-3 py-2 w-20">Desc.</th>
              <th className="text-right px-3 py-2 w-28 rounded-tr-md">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-3 py-2 border-b border-gray-200">{it.descripcion}</td>
                <td className="px-3 py-2 text-right border-b border-gray-200">{it.cantidad}</td>
                <td className="px-3 py-2 text-right font-mono border-b border-gray-200">S/ {fmt(it.precio_unitario)}</td>
                <td className="px-3 py-2 text-right border-b border-gray-200 text-gray-500">{it.descuento > 0 ? `${it.descuento}%` : "—"}</td>
                <td className="px-3 py-2 text-right font-mono font-medium border-b border-gray-200">S/ {fmt(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-mono">S/ {fmt(Number(cot.subtotal))}</span>
            </div>
            {Number(cot.descuento_global) > 0 && (
              <div className="flex justify-between py-1 border-b border-gray-200">
                <span className="text-gray-600">Descuento ({cot.descuento_global}%)</span>
                <span className="font-mono text-red-600">- S/ {fmt(Number(cot.subtotal) * Number(cot.descuento_global) / 100)}</span>
              </div>
            )}
            <div className="flex justify-between py-1 border-b border-gray-200">
              <span className="text-gray-600">IGV (18%)</span>
              <span className="font-mono">S/ {fmt(Number(cot.igv))}</span>
            </div>
            <div className="flex justify-between py-2 bg-blue-700 text-white px-2 rounded-md mt-2">
              <span className="font-bold text-base">TOTAL</span>
              <span className="font-mono font-bold text-lg">S/ {fmt(Number(cot.total))}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {cot.notas && (
          <div className="border border-gray-200 rounded-lg p-4 mb-6 text-sm">
            <p className="text-gray-500 text-xs uppercase font-semibold mb-2">Notas y condiciones</p>
            <p className="text-gray-700 whitespace-pre-wrap">{cot.notas}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t-2 border-blue-700 pt-4 text-xs text-gray-500 text-center">
          <p>Esta cotización es válida por {cot.vigencia_dias} días desde la fecha de emisión.</p>
          <p className="mt-1">Envases para Alimentos S.A.C. — contacto@envases.pe — Lima, Perú</p>
        </div>
      </div>
    </>
  );
}
