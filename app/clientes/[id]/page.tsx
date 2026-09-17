"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase, fmt, ESTADO_COLOR, type Cliente, type Cotizacion, type Actividad } from "@/lib/supabase";

type Stats = {
  totalCotizado: number;
  totalAprobado: number;
  totalPipeline: number;
  totalPerdido: number;
  tasaAprobacion: number;
  porEstado: Record<string, { count: number; total: number }>;
};

function tiempoRelativo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "hace un momento";
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ayer";
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function Avatar({ nombre }: { nombre: string }) {
  const letra = nombre.trim()[0]?.toUpperCase() ?? "?";
  const colores = ["bg-purple-700","bg-blue-700","bg-green-700","bg-amber-700","bg-rose-700","bg-teal-700"];
  return (
    <div className={`w-7 h-7 rounded-md ${colores[letra.charCodeAt(0) % colores.length]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {letra}
    </div>
  );
}

const ESTADO_META: Record<string, { label: string; bar: string; dot: string }> = {
  borrador:  { label: "Borrador",  bar: "bg-slate-400",  dot: "bg-slate-400"  },
  enviada:   { label: "Enviada",   bar: "bg-blue-400",   dot: "bg-blue-400"   },
  aprobada:  { label: "Aprobada",  bar: "bg-green-400",  dot: "bg-green-400"  },
  rechazada: { label: "Rechazada", bar: "bg-red-500",    dot: "bg-red-500"    },
};

export default function PerfilCliente() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [cliente,    setCliente]    = useState<Cliente | null>(null);
  const [cots,       setCots]       = useState<Cotizacion[]>([]);
  const [actividad,  setActividad]  = useState<Actividad[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [editando,   setEditando]   = useState(false);
  const [form,       setForm]       = useState<Partial<Cliente>>({});
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    async function load() {
      const [{ data: cl }, { data: cotData }, { data: actData }] = await Promise.all([
        supabase.from("env_clientes").select("*").eq("id", id).single(),
        supabase.from("env_cotizaciones").select("*").eq("cliente_id", id).order("created_at", { ascending: false }),
        supabase.from("env_actividad").select("*").in(
          "cotizacion_id",
          // We'll load activity after getting cot ids
          [0]
        ),
      ]);

      const cliente = cl as Cliente | null;
      const cotizaciones = (cotData ?? []) as Cotizacion[];

      // Load activity for these cotizaciones
      let actividad: Actividad[] = [];
      if (cotizaciones.length > 0) {
        const ids = cotizaciones.map((c) => c.id);
        const { data: actD } = await supabase
          .from("env_actividad")
          .select("*")
          .in("cotizacion_id", ids)
          .order("created_at", { ascending: false })
          .limit(20);
        actividad = (actD ?? []) as Actividad[];
      }

      // Compute stats
      const porEstado: Record<string, { count: number; total: number }> = {
        borrador: { count: 0, total: 0 }, enviada: { count: 0, total: 0 },
        aprobada: { count: 0, total: 0 }, rechazada: { count: 0, total: 0 },
      };
      for (const c of cotizaciones) {
        const e = c.estado as string;
        if (porEstado[e]) { porEstado[e].count++; porEstado[e].total += Number(c.total); }
      }
      const totalCotizado  = cotizaciones.reduce((s, c) => s + Number(c.total), 0);
      const totalAprobado  = porEstado.aprobada.total;
      const totalPipeline  = porEstado.enviada.total;
      const totalPerdido   = porEstado.rechazada.total;
      const ap = porEstado.aprobada.count, re = porEstado.rechazada.count;
      const tasaAprobacion = ap + re > 0 ? Math.round(ap / (ap + re) * 100) : 0;

      setCliente(cliente);
      setForm(cliente ?? {});
      setCots(cotizaciones);
      setActividad(actividad);
      setStats({ totalCotizado, totalAprobado, totalPipeline, totalPerdido, tasaAprobacion, porEstado });
      setLoading(false);
    }
    load();
  }, [id]);

  async function guardarEdicion() {
    setSaving(true);
    await supabase.from("env_clientes").update({
      nombre: form.nombre, empresa: form.empresa, ruc: form.ruc,
      email: form.email, telefono: form.telefono, direccion: form.direccion,
    }).eq("id", id);
    setCliente((prev) => prev ? { ...prev, ...form } : prev);
    setEditando(false);
    setSaving(false);
  }

  const maxBar = stats ? Math.max(...Object.values(stats.porEstado).map((e) => e.total)) || 1 : 1;

  if (loading) return <div className="text-slate-400 py-10 text-center">Cargando...</div>;
  if (!cliente) return <div className="text-slate-400 py-10 text-center">Cliente no encontrado.</div>;

  const iniciales = cliente.empresa.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className="max-w-4xl space-y-5">

      {/* Back */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">← Volver</button>
      </div>

      {/* ── Header del cliente ── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-800 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {iniciales}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{cliente.empresa}</h1>
              <p className="text-slate-400 text-sm">{cliente.nombre}</p>
              {cliente.ruc && <p className="text-slate-500 text-xs font-mono mt-0.5">RUC: {cliente.ruc}</p>}
            </div>
          </div>
          <button
            onClick={() => setEditando((v) => !v)}
            className="text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            {editando ? "Cancelar" : "✏️ Editar"}
          </button>
        </div>

        {editando ? (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ["nombre",    "Nombre contacto"],
              ["empresa",   "Empresa"],
              ["ruc",       "RUC"],
              ["email",     "Email"],
              ["telefono",  "Teléfono"],
              ["direccion", "Dirección"],
            ] as [keyof Cliente, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  value={(form[key] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-2 mt-1">
              <button onClick={guardarEdicion} disabled={saving} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg">
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {cliente.email     && <div><p className="text-slate-500 text-xs">Email</p><p className="text-slate-300">{cliente.email}</p></div>}
            {cliente.telefono  && <div><p className="text-slate-500 text-xs">Teléfono</p><p className="text-slate-300">{cliente.telefono}</p></div>}
            {cliente.direccion && <div className="col-span-2 sm:col-span-1"><p className="text-slate-500 text-xs">Dirección</p><p className="text-slate-300">{cliente.direccion}</p></div>}
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Cotizado",  value: `S/ ${fmt(stats!.totalCotizado)}`,  sub: `${cots.length} cotizaciones`,         color: "text-blue-400",   border: "border-blue-800",   icon: "💰" },
          { label: "Total Aprobado",  value: `S/ ${fmt(stats!.totalAprobado)}`,  sub: `${stats!.porEstado.aprobada.count} aprobadas`,  color: "text-green-400",  border: "border-green-800",  icon: "✅" },
          { label: "En Pipeline",     value: `S/ ${fmt(stats!.totalPipeline)}`,  sub: `${stats!.porEstado.enviada.count} enviadas`,    color: "text-amber-400",  border: "border-amber-800",  icon: "⏳" },
          { label: "Tasa Aprobación", value: `${stats!.tasaAprobacion}%`,        sub: `${stats!.porEstado.aprobada.count} de ${stats!.porEstado.aprobada.count + stats!.porEstado.rechazada.count} resueltas`, color: "text-purple-400", border: "border-purple-800", icon: "📈" },
        ].map((k) => (
          <div key={k.label} className={`bg-slate-800 rounded-xl p-4 border ${k.border}`}>
            <div className="flex items-start justify-between mb-1">
              <p className="text-slate-400 text-xs uppercase tracking-wide">{k.label}</p>
              <span className="text-lg">{k.icon}</span>
            </div>
            <p className={`text-xl font-bold font-mono ${k.color}`}>{k.value}</p>
            <p className="text-slate-500 text-xs mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Pipeline por estado ── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wide">Pipeline por Estado</h2>
        {cots.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin cotizaciones aún.</p>
        ) : (
          <div className="space-y-3">
            {(["borrador","enviada","aprobada","rechazada"] as const).map((estado) => {
              const meta = ESTADO_META[estado];
              const data = stats!.porEstado[estado];
              const pct  = Math.round(data.total / maxBar * 100);
              return (
                <div key={estado}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <span className="text-slate-300">{meta.label}</span>
                      <span className="text-slate-600">({data.count})</span>
                    </div>
                    <span className="font-mono text-slate-300">S/ {fmt(data.total)}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${meta.bar} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Cotizaciones ── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
          <h2 className="font-semibold text-sm">Historial de Cotizaciones</h2>
          <Link href={`/cotizaciones/nueva`} className="text-xs text-blue-400 hover:underline">+ Nueva →</Link>
        </div>
        {cots.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">Sin cotizaciones para este cliente.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                <th className="text-left px-4 py-3">N°</th>
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {cots.map((c) => (
                <tr key={c.id} className="hover:bg-slate-700/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/cotizaciones/${c.id}`} className="text-blue-400 hover:underline font-mono font-medium">{c.numero}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString("es-PE")}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-blue-300">S/ {fmt(Number(c.total))}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link href={`/cotizaciones/${c.id}`}          className="text-xs text-blue-400 hover:underline">Ver</Link>
                      <span className="text-slate-600">|</span>
                      <Link href={`/cotizaciones/${c.id}/editar`}   className="text-xs text-slate-400 hover:text-white">Editar</Link>
                      <span className="text-slate-600">|</span>
                      <Link href={`/cotizaciones/${c.id}/imprimir`} className="text-xs text-slate-400 hover:text-white">PDF</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Actividad reciente ── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wide">Actividad Reciente</h2>
        {actividad.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin actividad registrada.</p>
        ) : (
          <div className="space-y-3">
            {actividad.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5">
                <Avatar nombre={a.usuario} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-white text-xs font-semibold">{a.usuario}</span>
                    <span className="text-slate-500 text-[10px]">{tiempoRelativo(a.created_at)}</span>
                    {/* Link a la cotizacion */}
                    <Link href={`/cotizaciones/${a.cotizacion_id}`} className="text-[10px] text-slate-600 hover:text-blue-400">
                      {cots.find((c) => c.id === a.cotizacion_id)?.numero ?? `#${a.cotizacion_id}`}
                    </Link>
                  </div>
                  {a.dato_anterior && a.dato_nuevo ? (
                    <p className="text-[11px] text-slate-400 truncate">
                      {a.descripcion}: <span className="text-slate-300">{a.dato_anterior}</span>
                      <span className="mx-1 text-slate-600">→</span>
                      <span className="text-blue-300">{a.dato_nuevo}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400 truncate">{a.descripcion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
