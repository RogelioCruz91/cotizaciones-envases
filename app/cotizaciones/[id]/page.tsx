"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { fmt, ESTADO_COLOR, type Cotizacion, type Actividad } from "@/lib/supabase";
import { getUsuario, setUsuario, hayUsuario } from "@/lib/usuario";

const SUPABASE_URL = "https://gamnenyakraafruvbkin.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbW5lbnlha3JhYWZydXZia2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzU4NDQsImV4cCI6MjA4NTU1MTg0NH0.UpolMRzWNfd4hqBeYvnTrrvDu1C1rmrNXKvnO82y_OQ";

function tiempoRelativo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ayer";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

function diaGrupo(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
}

function Avatar({ nombre }: { nombre: string }) {
  const letra = nombre.trim()[0]?.toUpperCase() ?? "?";
  const colores = [
    "bg-purple-700", "bg-blue-700", "bg-green-700",
    "bg-amber-700", "bg-rose-700", "bg-teal-700",
  ];
  const color = colores[letra.charCodeAt(0) % colores.length];
  return (
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
      {letra}
    </div>
  );
}

export default function DetalleCotizacion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cot, setCot] = useState<Cotizacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [nombreInput, setNombreInput] = useState("");
  const [showNombre, setShowNombre] = useState(false);
  const sbRef = useRef(createClient(SUPABASE_URL, SUPABASE_ANON));

  useEffect(() => {
    if (!hayUsuario()) setShowNombre(true);
  }, []);

  async function cargarActividad() {
    const { data } = await sbRef.current
      .from("env_actividad")
      .select("*")
      .eq("cotizacion_id", id)
      .order("created_at", { ascending: false });
    setActividad((data ?? []) as Actividad[]);
  }

  useEffect(() => {
    const sb = sbRef.current;

    sb.from("env_cotizaciones")
      .select("*, env_clientes(*), env_cotizacion_items(*, env_envases(nombre,categoria))")
      .eq("id", id)
      .single()
      .then(({ data }) => { setCot(data as Cotizacion); setLoading(false); });

    cargarActividad();

    // Realtime on actividad for this cotizacion
    const channel = sb
      .channel(`actividad_${id}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "env_actividad", filter: `cotizacion_id=eq.${id}` },
        (payload) => {
          setActividad((prev) => [payload.new as Actividad, ...prev]);
        }
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function registrarActividad(tipo: string, descripcion: string, anterior?: string, nuevo?: string) {
    await sbRef.current.from("env_actividad").insert({
      cotizacion_id: Number(id),
      usuario: getUsuario(),
      tipo,
      descripcion,
      dato_anterior: anterior ?? null,
      dato_nuevo: nuevo ?? null,
    });
  }

  async function cambiarEstado(estado: string) {
    if (!cot) return;
    const anterior = cot.estado;
    await sbRef.current.from("env_cotizaciones").update({ estado }).eq("id", id);
    setCot((prev) => prev ? { ...prev, estado: estado as Cotizacion["estado"] } : prev);
    await registrarActividad(
      "estado",
      "Estado actualizado",
      anterior,
      estado
    );
  }

  function guardarNombre() {
    if (nombreInput.trim()) {
      setUsuario(nombreInput.trim().toUpperCase());
      setShowNombre(false);
    }
  }

  if (loading) return <div className="text-slate-400 py-10 text-center">Cargando...</div>;
  if (!cot) return <div className="text-slate-400 py-10 text-center">Cotización no encontrada.</div>;

  const cl = cot.env_clientes;
  const items = cot.env_cotizacion_items ?? [];

  // Group actividad by day
  const grupos: { dia: string; items: Actividad[] }[] = [];
  for (const a of actividad) {
    const dia = diaGrupo(a.created_at);
    const g = grupos.find((x) => x.dia === dia);
    if (g) g.items.push(a);
    else grupos.push({ dia, items: [a] });
  }

  return (
    <div className="max-w-3xl">

      {/* Nombre modal */}
      {showNombre && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl">
            <p className="text-white font-semibold mb-1">¿Cómo te llamas?</p>
            <p className="text-slate-400 text-xs mb-4">Tu nombre aparecerá en el registro de actividad.</p>
            <input
              autoFocus
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-blue-500"
              placeholder="Tu nombre completo"
              value={nombreInput}
              onChange={(e) => setNombreInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && guardarNombre()}
            />
            <button
              onClick={guardarNombre}
              disabled={!nombreInput.trim()}
              className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}

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
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Link href={`/cotizaciones/${id}/imprimir`} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          🖨️ Imprimir / PDF
        </Link>
        <Link href={`/cotizaciones/${id}/editar`} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          ✏️ Editar
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
        <button
          onClick={() => setShowNombre(true)}
          className="ml-auto text-xs text-slate-500 hover:text-slate-300"
          title="Cambiar tu nombre"
        >
          👤 {getUsuario()}
        </button>
      </div>

      {/* ── Actividad ── */}
      <div className="border-t border-slate-700 pt-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Actividad</h2>

        {actividad.length === 0 ? (
          <p className="text-slate-600 text-sm">Sin registros de actividad aún.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {grupos.map((grupo) => (
              <div key={grupo.dia}>
                {/* Day divider */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-500 font-medium">{grupo.dia}</span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>

                <div className="flex flex-col gap-3">
                  {grupo.items.map((a) => (
                    <div key={a.id} className="flex items-start gap-3">
                      <Avatar nombre={a.usuario} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-white text-sm font-semibold">{a.usuario}</span>
                          <span className="text-slate-500 text-xs">{tiempoRelativo(a.created_at)}</span>
                        </div>
                        {a.dato_anterior && a.dato_nuevo ? (
                          <p className="text-sm mt-0.5">
                            <span className="text-slate-400">{a.descripcion}: </span>
                            <span className="text-slate-300">{a.dato_anterior}</span>
                            <span className="text-slate-500 mx-1">→</span>
                            <span className="text-blue-300 font-medium">{a.dato_nuevo}</span>
                          </p>
                        ) : (
                          <p className="text-slate-300 text-sm mt-0.5">{a.descripcion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
