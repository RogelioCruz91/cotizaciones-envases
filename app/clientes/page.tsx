"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { type Cliente } from "@/lib/supabase";

const SUPABASE_URL  = "https://gamnenyakraafruvbkin.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbW5lbnlha3JhYWZydXZia2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzU4NDQsImV4cCI6MjA4NTU1MTg0NH0.UpolMRzWNfd4hqBeYvnTrrvDu1C1rmrNXKvnO82y_OQ";

export default function ClientesPage() {
  const sbRef    = useRef(createClient(SUPABASE_URL, SUPABASE_ANON));
  const [clientes,    setClientes]    = useState<Cliente[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [realtimeOk,  setRealtimeOk]  = useState<boolean | null>(null);
  const [form,        setForm]        = useState({ nombre: "", empresa: "", ruc: "", email: "", telefono: "", direccion: "" });
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState("");

  useEffect(() => {
    const sb = sbRef.current;

    // Initial load
    sb.from("env_clientes").select("*").order("empresa").then(({ data }) => {
      setClientes((data ?? []) as Cliente[]);
      setLoading(false);
    });

    // Realtime subscription
    const channel = sb
      .channel(`clientes_rt_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "env_clientes" },
        (payload) => {
          const nuevo = payload.new as Cliente;
          setClientes((prev) =>
            [...prev, nuevo].sort((a, b) => a.empresa.localeCompare(b.empresa))
          );
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "env_clientes" },
        (payload) => {
          const updated = payload.new as Cliente;
          setClientes((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        }
      )
      .subscribe((status) => setRealtimeOk(status === "SUBSCRIBED"));

    return () => { sb.removeChannel(channel); };
  }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.empresa) return;
    setSaving(true);
    await sbRef.current.from("env_clientes").insert(form);
    // Realtime will add it to the list — just reset the form
    setForm({ nombre: "", empresa: "", ruc: "", email: "", telefono: "", direccion: "" });
    setSaving(false);
  }

  const filtrados = clientes.filter((c) =>
    `${c.nombre} ${c.empresa} ${c.ruc ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Clientes</h1>
          {realtimeOk === true  && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-mono">● En vivo</span>}
          {realtimeOk === false && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 font-mono">✕ Sin conexión</span>}
        </div>
        <span className="text-slate-400 text-sm">{clientes.length} registrados</span>
      </div>

      {/* Form */}
      <form onSubmit={guardar} className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
        <h2 className="font-semibold text-sm mb-4 text-slate-300">Nuevo cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { key: "nombre",    label: "Nombre contacto *", placeholder: "Juan Pérez" },
            { key: "empresa",   label: "Empresa *",         placeholder: "Agroindustrias SAC" },
            { key: "ruc",       label: "RUC",               placeholder: "20123456789" },
            { key: "email",     label: "Email",             placeholder: "contacto@empresa.pe" },
            { key: "telefono",  label: "Teléfono",          placeholder: "999 123 456" },
            { key: "direccion", label: "Dirección",         placeholder: "Av. Principal 123" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <button
          type="submit"
          disabled={saving || !form.nombre || !form.empresa}
          className="mt-4 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors"
        >
          {saving ? "Guardando..." : "Agregar cliente"}
        </button>
      </form>

      {/* Search + list */}
      <div className="mb-3">
        <input
          className="w-full max-w-sm bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          placeholder="Buscar por nombre, empresa o RUC..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Empresa</th>
              <th className="text-left px-4 py-3">Contacto</th>
              <th className="text-left px-4 py-3">RUC</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Teléfono</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">Cargando...</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">Sin clientes.</td></tr>
            ) : filtrados.map((c) => (
              <tr key={c.id} className="hover:bg-slate-700/40 transition-colors">
                <td className="px-4 py-3 font-medium text-white">{c.empresa}</td>
                <td className="px-4 py-3 text-slate-300">{c.nombre}</td>
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{c.ruc ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{c.telefono ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/clientes/${c.id}`} className="text-xs text-blue-400 hover:underline">Ver perfil →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
