"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, fmt, ESTADO_COLOR, type Cotizacion } from "@/lib/supabase";

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, envases: 0, cots: 0, aprobadas: 0 });
  const [recientes, setRecientes] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: clientes },
        { count: envases },
        { count: cots },
        { count: aprobadas },
        { data: rec },
      ] = await Promise.all([
        supabase.from("env_clientes").select("*", { count: "exact", head: true }),
        supabase.from("env_envases").select("*", { count: "exact", head: true }).eq("activo", true),
        supabase.from("env_cotizaciones").select("*", { count: "exact", head: true }),
        supabase.from("env_cotizaciones").select("*", { count: "exact", head: true }).eq("estado", "aprobada"),
        supabase.from("env_cotizaciones")
          .select("*, env_clientes(nombre,empresa)")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      setStats({ clientes: clientes ?? 0, envases: envases ?? 0, cots: cots ?? 0, aprobadas: aprobadas ?? 0 });
      setRecientes((rec ?? []) as Cotizacion[]);
      setLoading(false);
    }
    load();
  }, []);

  const KPIS = [
    { label: "Clientes",      value: stats.clientes,  icon: "👥", color: "text-blue-400",   href: "/clientes"     },
    { label: "Envases",       value: stats.envases,   icon: "📦", color: "text-orange-400",  href: "/envases"      },
    { label: "Cotizaciones",  value: stats.cots,      icon: "📋", color: "text-purple-400",  href: "/cotizaciones" },
    { label: "Aprobadas",     value: stats.aprobadas, icon: "✅", color: "text-green-400",   href: "/cotizaciones" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Cotizaciones de Envases para Alimentos</p>
        </div>
        <Link
          href="/cotizaciones/nueva"
          className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          + Nueva Cotización
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {KPIS.map((k) => (
          <Link key={k.label} href={k.href} className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-500 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide">{k.label}</p>
                <p className={`text-3xl font-bold mt-1 ${k.color}`}>{loading ? "—" : k.value}</p>
              </div>
              <span className="text-2xl">{k.icon}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Cotizaciones recientes */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-5">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="font-semibold text-sm">Cotizaciones recientes</h2>
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
                <p className="text-white text-sm font-medium group-hover:text-blue-300">{c.numero}</p>
                <p className="text-slate-400 text-xs">{c.env_clientes?.empresa ?? "—"}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-blue-300 font-mono text-sm font-bold">S/ {fmt(c.total)}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[c.estado]}`}>{c.estado}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/cotizaciones/nueva", icon: "📋", label: "Nueva Cotización", color: "hover:border-blue-600"   },
          { href: "/clientes",           icon: "👥", label: "Ver Clientes",     color: "hover:border-purple-600" },
          { href: "/envases",            icon: "📦", label: "Ver Envases",      color: "hover:border-orange-600" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className={`bg-slate-800 border border-slate-700 ${a.color} rounded-xl p-4 flex items-center gap-3 transition-colors group`}>
            <span className="text-2xl">{a.icon}</span>
            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
