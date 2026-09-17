"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, fmt, ESTADO_COLOR, type Cotizacion, type Actividad } from "@/lib/supabase";

type TopCliente = { empresa: string; total: number; count: number };

type Stats = {
  clientes: number;
  envases: number;
  totalCotizado: number;
  totalAprobado: number;
  totalPipeline: number;
  porEstado: Record<string, { count: number; total: number }>;
  tasaAprobacion: number;
};

function tiempoRelativo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "hace un momento";
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
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

const ESTADO_META = {
  borrador:  { label: "Borrador",  color: "bg-slate-500",  bar: "bg-slate-400"  },
  enviada:   { label: "Enviada",   color: "bg-blue-600",   bar: "bg-blue-400"   },
  aprobada:  { label: "Aprobada",  color: "bg-green-600",  bar: "bg-green-400"  },
  rechazada: { label: "Rechazada", color: "bg-red-700",    bar: "bg-red-500"    },
};

export default function Dashboard() {
  const [stats,    setStats]    = useState<Stats | null>(null);
  const [recientes,setRecientes]= useState<Cotizacion[]>([]);
  const [topCli,   setTopCli]   = useState<TopCliente[]>([]);
  const [actividad,setActividad]= useState<Actividad[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: clientes },
        { count: envases },
        { data: allCots },
        { data: rec },
        { data: act },
      ] = await Promise.all([
        supabase.from("env_clientes").select("*", { count: "exact", head: true }),
        supabase.from("env_envases").select("*",  { count: "exact", head: true }).eq("activo", true),
        supabase.from("env_cotizaciones").select("*, env_clientes(empresa)"),
        supabase.from("env_cotizaciones")
          .select("*, env_clientes(nombre,empresa)")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("env_actividad")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const cots = (allCots ?? []) as (Cotizacion & { env_clientes: { empresa: string } })[];

      // Por estado
      const porEstado: Record<string, { count: number; total: number }> = {
        borrador: { count: 0, total: 0 }, enviada: { count: 0, total: 0 },
        aprobada: { count: 0, total: 0 }, rechazada: { count: 0, total: 0 },
      };
      for (const c of cots) {
        const e = c.estado as string;
        if (porEstado[e]) {
          porEstado[e].count++;
          porEstado[e].total += Number(c.total);
        }
      }

      const totalCotizado  = cots.reduce((s, c) => s + Number(c.total), 0);
      const totalAprobado  = porEstado.aprobada.total;
      const totalPipeline  = porEstado.enviada.total;
      const aprobadas      = porEstado.aprobada.count;
      const rechazadas     = porEstado.rechazada.count;
      const tasaAprobacion = aprobadas + rechazadas > 0 ? Math.round(aprobadas / (aprobadas + rechazadas) * 100) : 0;

      // Top clientes
      const mapaClientes: Record<string, TopCliente> = {};
      for (const c of cots) {
        const empresa = c.env_clientes?.empresa ?? "Sin nombre";
        if (!mapaClientes[empresa]) mapaClientes[empresa] = { empresa, total: 0, count: 0 };
        mapaClientes[empresa].total += Number(c.total);
        mapaClientes[empresa].count++;
      }
      const top = Object.values(mapaClientes).sort((a, b) => b.total - a.total).slice(0, 5);

      setStats({ clientes: clientes ?? 0, envases: envases ?? 0, totalCotizado, totalAprobado, totalPipeline, porEstado, tasaAprobacion });
      setRecientes((rec ?? []) as Cotizacion[]);
      setTopCli(top);
      setActividad((act ?? []) as Actividad[]);
      setLoading(false);
    }
    load();
  }, []);

  const maxBar = stats ? Math.max(...Object.values(stats.porEstado).map((e) => e.total)) || 1 : 1;
  const maxTopCli = topCli[0]?.total || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Gerencial</h1>
          <p className="text-slate-400 text-sm mt-0.5">Resumen ejecutivo · Cotizaciones de Envases</p>
        </div>
        <Link href="/cotizaciones/nueva" className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors">
          + Nueva Cotización
        </Link>
      </div>

      {/* ── Fila 1: KPIs financieros ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Cotizado",    value: stats ? `S/ ${fmt(stats.totalCotizado)}`  : "—", sub: `${stats?.porEstado.borrador.count ?? 0 + (stats?.porEstado.enviada.count ?? 0) + (stats?.porEstado.aprobada.count ?? 0) + (stats?.porEstado.rechazada.count ?? 0)} cotizaciones`, color: "text-blue-400",   border: "border-blue-800",  icon: "💰" },
          { label: "Total Aprobado",    value: stats ? `S/ ${fmt(stats.totalAprobado)}`  : "—", sub: `${stats?.porEstado.aprobada.count ?? 0} aprobadas`,             color: "text-green-400",  border: "border-green-800", icon: "✅" },
          { label: "En Pipeline",       value: stats ? `S/ ${fmt(stats.totalPipeline)}`  : "—", sub: `${stats?.porEstado.enviada.count ?? 0} pendientes de aprobación`, color: "text-amber-400",  border: "border-amber-800", icon: "⏳" },
          { label: "Tasa Aprobación",   value: stats ? `${stats.tasaAprobacion}%`        : "—", sub: `${stats?.porEstado.aprobada.count ?? 0} de ${(stats?.porEstado.aprobada.count ?? 0) + (stats?.porEstado.rechazada.count ?? 0)} resueltas`, color: "text-purple-400", border: "border-purple-800", icon: "📈" },
        ].map((k) => (
          <div key={k.label} className={`bg-slate-800 rounded-xl p-5 border ${k.border}`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide">{k.label}</p>
              <span className="text-xl">{k.icon}</span>
            </div>
            <p className={`text-2xl font-bold font-mono ${k.color}`}>{loading ? "—" : k.value}</p>
            <p className="text-slate-500 text-xs mt-1">{loading ? "" : k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Fila 2: Pipeline + Accesos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pipeline por estado */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wide">Pipeline por Estado</h2>
          {loading ? <p className="text-slate-500 text-sm">Cargando...</p> : (
            <div className="space-y-3">
              {(["borrador","enviada","aprobada","rechazada"] as const).map((estado) => {
                const meta = ESTADO_META[estado];
                const data = stats!.porEstado[estado];
                const pct  = Math.round(data.total / maxBar * 100);
                return (
                  <div key={estado}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${meta.color}`} />
                        <span className="text-slate-300 capitalize">{meta.label}</span>
                        <span className="text-slate-600">({data.count})</span>
                      </div>
                      <span className="font-mono text-slate-300">S/ {fmt(data.total)}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Accesos rápidos */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wide">Accesos Rápidos</h2>
          <div className="flex flex-col gap-2">
            {[
              { href: "/cotizaciones/nueva", icon: "📋", label: "Nueva Cotización",   color: "hover:bg-blue-900/40 hover:border-blue-700"   },
              { href: "/cotizaciones",       icon: "⊞",  label: "Ver Tablero",        color: "hover:bg-purple-900/40 hover:border-purple-700" },
              { href: "/clientes",           icon: "👥", label: "Gestionar Clientes", color: "hover:bg-teal-900/40 hover:border-teal-700"     },
              { href: "/envases",            icon: "📦", label: "Catálogo Envases",   color: "hover:bg-orange-900/40 hover:border-orange-700" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-700 ${a.color} transition-colors group`}>
                <span className="text-lg">{a.icon}</span>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Fila 3: Top clientes + Actividad reciente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top clientes */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wide">Top Clientes por Monto</h2>
          {loading ? <p className="text-slate-500 text-sm">Cargando...</p> : topCli.length === 0 ? (
            <p className="text-slate-500 text-sm">Sin datos.</p>
          ) : (
            <div className="space-y-3">
              {topCli.map((c, i) => {
                const pct = Math.round(c.total / maxTopCli * 100);
                return (
                  <div key={c.empresa}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 w-4 text-right font-bold">{i + 1}</span>
                        <span className="text-white font-medium truncate max-w-40">{c.empresa}</span>
                        <span className="text-slate-600">({c.count} cot.)</span>
                      </div>
                      <span className="font-mono text-blue-300 font-bold">S/ {fmt(c.total)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actividad reciente */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
          <h2 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wide">Actividad Reciente</h2>
          {loading ? <p className="text-slate-500 text-sm">Cargando...</p> : actividad.length === 0 ? (
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

      {/* ── Fila 4: Cotizaciones recientes ── */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
          <h2 className="font-semibold text-sm">Cotizaciones Recientes</h2>
          <Link href="/cotizaciones" className="text-xs text-blue-400 hover:underline">Ver todas →</Link>
        </div>
        <div className="divide-y divide-slate-700">
          {loading ? (
            <p className="text-slate-500 text-sm text-center py-6">Cargando...</p>
          ) : recientes.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Sin cotizaciones aún.</p>
          ) : recientes.map((c) => (
            <Link key={c.id} href={`/cotizaciones/${c.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-700/50 transition-colors group">
              <div>
                <p className="text-white text-sm font-medium group-hover:text-blue-300 font-mono">{c.numero}</p>
                <p className="text-slate-400 text-xs">{c.env_clientes?.empresa ?? "—"}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-slate-500 text-xs hidden sm:block">
                  {new Date(c.created_at).toLocaleDateString("es-PE")}
                </span>
                <span className="text-blue-300 font-mono text-sm font-bold">S/ {fmt(Number(c.total))}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
