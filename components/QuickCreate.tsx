"use client";
import { useState } from "react";
import { supabase, type Cliente, type Envase } from "@/lib/supabase";

const CATEGORIAS = ["Big Bag", "Bulk Bag", "Bolsas de papel", "Bolsas Mixtas", "Otros"];
const UNIDADES   = ["unidad", "bolsa", "saco", "rollo", "paquete"];

export function Modal({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ModalNuevoCliente({ onClose, onCreado }: {
  onClose: () => void;
  onCreado: (c: Cliente) => void;
}) {
  const [form, setForm] = useState({ empresa: "", nombre: "", ruc: "", email: "", telefono: "", direccion: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.empresa.trim() || !form.nombre.trim()) { setError("Empresa y nombre son requeridos."); return; }
    setSaving(true);
    const { data, error: err } = await supabase.from("env_clientes").insert(form).select().single();
    if (err) { setError("Error al guardar. Intenta de nuevo."); setSaving(false); return; }
    onCreado(data as Cliente);
    onClose();
  }

  const inp = "w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500";

  return (
    <form onSubmit={guardar} className="space-y-3">
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Empresa *</label>
          <input className={inp} placeholder="Agroindustrias SAC" value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} autoFocus />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nombre contacto *</label>
          <input className={inp} placeholder="Juan Pérez" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">RUC</label>
          <input className={inp} placeholder="20123456789" value={form.ruc} onChange={(e) => setForm((f) => ({ ...f, ruc: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Email</label>
          <input className={inp} type="email" placeholder="contacto@empresa.pe" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Teléfono</label>
          <input className={inp} placeholder="999 123 456" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Dirección</label>
          <input className={inp} placeholder="Av. Principal 123" value={form.direccion} onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-medium">
          {saving ? "Guardando..." : "Crear cliente"}
        </button>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm px-4">Cancelar</button>
      </div>
    </form>
  );
}

export function ModalNuevoEnvase({ onClose, onCreado }: {
  onClose: () => void;
  onCreado: (e: Envase) => void;
}) {
  const [form, setForm] = useState({ nombre: "", categoria: "Big Bag", precio_unitario: 0, unidad: "unidad", material: "", capacidad: "", descripcion: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { setError("El nombre es requerido."); return; }
    setSaving(true);
    const { data, error: err } = await supabase.from("env_envases").insert({ ...form, activo: true, stock: 0 }).select().single();
    if (err) { setError("Error al guardar. Intenta de nuevo."); setSaving(false); return; }
    onCreado(data as Envase);
    onClose();
  }

  const inp = "w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500";
  const sel = "w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-green-500";

  return (
    <form onSubmit={guardar} className="space-y-3">
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-400 mb-1">Nombre del producto *</label>
          <input className={inp} placeholder="Saco PP 50 kg" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} autoFocus />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Categoría</label>
          <select className={sel} value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Unidad</label>
          <select className={sel} value={form.unidad} onChange={(e) => setForm((f) => ({ ...f, unidad: e.target.value }))}>
            {UNIDADES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Precio unitario (S/)</label>
          <input type="number" min="0" step="0.01" className={inp} value={form.precio_unitario} onChange={(e) => setForm((f) => ({ ...f, precio_unitario: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Material</label>
          <input className={inp} placeholder="Polipropileno, papel kraft..." value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Capacidad</label>
          <input className={inp} placeholder="50 kg, 500 L..." value={form.capacidad} onChange={(e) => setForm((f) => ({ ...f, capacidad: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Descripción</label>
          <input className={inp} placeholder="Descripción opcional..." value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm py-2 rounded-lg font-medium">
          {saving ? "Guardando..." : "Crear producto"}
        </button>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white text-sm px-4">Cancelar</button>
      </div>
    </form>
  );
}
