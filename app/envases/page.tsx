"use client";
import { useEffect, useState } from "react";
import { supabase, fmt, CAT_COLOR, type Envase } from "@/lib/supabase";

const CATEGORIAS = ["Big Bag", "Bulk Bag", "Bolsas de papel", "Bolsas Mixtas", "Otros"] as const;

export default function EnvasesPage() {
  const [envases, setEnvases]   = useState<Envase[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cat, setCat]           = useState("Todos");
  const [search, setSearch]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    nombre: "", categoria: "Big Bag", material: "", capacidad: "",
    unidad: "unidad", precio_unitario: "", stock: "", descripcion: "",
  });

  async function cargar() {
    const { data } = await supabase.from("env_envases").select("*").eq("activo", true).order("categoria").order("nombre");
    setEnvases((data ?? []) as Envase[]);
    setLoading(false);
  }
  useEffect(() => { cargar(); }, []);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre || !form.precio_unitario) return;
    setSaving(true);
    await supabase.from("env_envases").insert({
      ...form,
      precio_unitario: parseFloat(form.precio_unitario),
      stock: parseInt(form.stock) || 0,
    });
    setForm({ nombre: "", categoria: "Big Bag", material: "", capacidad: "", unidad: "unidad", precio_unitario: "", stock: "", descripcion: "" });
    setShowForm(false);
    setSaving(false);
    cargar();
  }

  const filtrados = envases
    .filter((e) => cat === "Todos" || e.categoria === cat)
    .filter((e) => `${e.nombre} ${e.material ?? ""} ${e.capacidad ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Catálogo de Envases</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-700 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? "Cancelar" : "+ Agregar envase"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={guardar} className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
          <h2 className="font-semibold text-sm mb-4 text-slate-300">Nuevo envase</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { key: "nombre",         label: "Nombre *",          type: "text",   placeholder: "Big Bag 1000 kg" },
              { key: "material",       label: "Material",          type: "text",   placeholder: "Polipropileno tejido" },
              { key: "capacidad",      label: "Capacidad",         type: "text",   placeholder: "1000 kg" },
              { key: "unidad",         label: "Unidad de venta",   type: "text",   placeholder: "unidad / ciento / millar" },
              { key: "precio_unitario",label: "Precio unitario *", type: "number", placeholder: "0.00" },
              { key: "stock",          label: "Stock",             type: "number", placeholder: "0" },
            ].map(({ key, label, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                <input
                  type={type}
                  min={type === "number" ? "0" : undefined}
                  step={key === "precio_unitario" ? "0.01" : undefined}
                  className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Categoría *</label>
              <select
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                value={form.categoria}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              >
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Descripción</label>
              <input
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder="Descripción, certificaciones..."
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <button type="submit" disabled={saving} className="mt-4 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition-colors">
            {saving ? "Guardando..." : "Guardar envase"}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["Todos", ...CATEGORIAS].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${cat === c ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
          >
            {c}
          </button>
        ))}
        <input
          className="ml-auto bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 w-48"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <p className="col-span-4 text-slate-500 text-sm text-center py-10">Cargando...</p>
        ) : filtrados.length === 0 ? (
          <p className="col-span-4 text-slate-500 text-sm text-center py-10">Sin envases en esta categoría.</p>
        ) : filtrados.map((e) => (
          <div key={e.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-white font-medium text-sm leading-tight">{e.nombre}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${CAT_COLOR[e.categoria]}`}>{e.categoria}</span>
            </div>
            {e.material && <p className="text-slate-500 text-xs">{e.material}</p>}
            {e.capacidad && <p className="text-slate-400 text-xs">Capacidad: {e.capacidad}</p>}
            {e.descripcion && <p className="text-slate-500 text-xs leading-tight">{e.descripcion}</p>}
            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-700">
              <div>
                <p className="text-blue-400 font-bold font-mono">S/ {fmt(e.precio_unitario)}</p>
                <p className="text-slate-500 text-xs">por {e.unidad}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-medium ${e.stock < 50 ? "text-yellow-400" : "text-green-400"}`}>{e.stock}</p>
                <p className="text-slate-500 text-xs">en stock</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
