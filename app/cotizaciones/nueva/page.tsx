"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, fmt, IGV, type Cliente, type Envase } from "@/lib/supabase";
import { getUsuario } from "@/lib/usuario";
import { Modal, ModalNuevoCliente, ModalNuevoEnvase } from "@/components/QuickCreate";

type ItemRow = {
  envase_id: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
};

function calcItem(item: ItemRow) {
  return item.cantidad * item.precio_unitario * (1 - item.descuento / 100);
}

// ── Main page ─────────────────────────────────────────────────────
export default function NuevaCotizacion() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [envases,  setEnvases]  = useState<Envase[]>([]);
  const [saving,   setSaving]   = useState(false);

  const [clienteId, setClienteId] = useState<number | "">("");
  const [notas,     setNotas]     = useState("");
  const [vigencia,  setVigencia]  = useState(30);
  const [descGlobal,setDescGlobal]= useState(0);
  const [items, setItems] = useState<ItemRow[]>([
    { envase_id: null, descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 },
  ]);

  // Modal state — which row triggered the envase modal
  const [modalCliente, setModalCliente] = useState(false);
  const [modalEnvase,  setModalEnvase]  = useState(false);
  const pendingRowRef = useRef<number | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("env_clientes").select("*").order("empresa"),
      supabase.from("env_envases").select("*").eq("activo", true).order("categoria").order("nombre"),
    ]).then(([{ data: c }, { data: e }]) => {
      setClientes((c ?? []) as Cliente[]);
      setEnvases((e ?? []) as Envase[]);
    });
  }, []);

  function onClienteCreado(c: Cliente) {
    setClientes((prev) => [...prev, c].sort((a, b) => a.empresa.localeCompare(b.empresa)));
    setClienteId(c.id);
  }

  function onEnvaseCreado(env: Envase) {
    setEnvases((prev) => [...prev, env].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    const row = pendingRowRef.current;
    if (row !== null) {
      setItems((prev) => {
        const next = [...prev];
        next[row] = { ...next[row], envase_id: env.id, descripcion: env.nombre, precio_unitario: env.precio_unitario };
        return next;
      });
      pendingRowRef.current = null;
    }
  }

  const addItem = () =>
    setItems((prev) => [...prev, { envase_id: null, descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 }]);

  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const updateItem = useCallback((i: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next[i] as any)[field] = value;
      if (field === "envase_id" && value) {
        const env = envases.find((e) => e.id === Number(value));
        if (env) { next[i].precio_unitario = env.precio_unitario; next[i].descripcion = env.nombre; }
      }
      return next;
    });
  }, [envases]);

  const subtotalItems   = items.reduce((s, it) => s + calcItem(it), 0);
  const subtotalConDesc = subtotalItems * (1 - descGlobal / 100);
  const igvMonto        = subtotalConDesc * IGV;
  const total           = subtotalConDesc + igvMonto;

  async function guardar() {
    if (!clienteId || items.every((it) => !it.descripcion)) return;
    setSaving(true);

    const { count } = await supabase.from("env_cotizaciones").select("*", { count: "exact", head: true });
    const numero = `COT-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

    const { data: cot } = await supabase.from("env_cotizaciones").insert({
      numero, cliente_id: clienteId, estado: "borrador",
      subtotal: subtotalConDesc, igv: igvMonto, total,
      descuento_global: descGlobal, notas, vigencia_dias: vigencia,
    }).select().single();

    if (cot) {
      await supabase.from("env_cotizacion_items").insert(
        items.filter((it) => it.descripcion).map((it) => ({
          cotizacion_id: cot.id, envase_id: it.envase_id || null,
          descripcion: it.descripcion, cantidad: it.cantidad,
          precio_unitario: it.precio_unitario, descuento: it.descuento, subtotal: calcItem(it),
        }))
      );
      await supabase.from("env_actividad").insert({
        cotizacion_id: cot.id, usuario: getUsuario(), tipo: "creacion", descripcion: "Cotización creada",
      });
      router.push(`/cotizaciones/${cot.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-4xl">

      {/* Modales */}
      {modalCliente && (
        <Modal title="Nuevo Cliente" onClose={() => setModalCliente(false)}>
          <ModalNuevoCliente onClose={() => setModalCliente(false)} onCreado={onClienteCreado} />
        </Modal>
      )}
      {modalEnvase && (
        <Modal title="Nuevo Producto / Envase" onClose={() => setModalEnvase(false)}>
          <ModalNuevoEnvase onClose={() => setModalEnvase(false)} onCreado={onEnvaseCreado} />
        </Modal>
      )}

      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">← Volver</button>
        <h1 className="text-2xl font-bold">Nueva Cotización</h1>
      </div>

      {/* Header */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-400">Cliente *</label>
              <button
                type="button"
                onClick={() => setModalCliente(true)}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                + Nuevo cliente
              </button>
            </div>
            <select
              className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Selecciona un cliente...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.empresa} — {c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Vigencia (días)</label>
              <input type="number" min="1" className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                value={vigencia} onChange={(e) => setVigencia(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Descuento global (%)</label>
              <input type="number" min="0" max="100" step="0.5" className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                value={descGlobal} onChange={(e) => setDescGlobal(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Productos / Items</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { pendingRowRef.current = null; setModalEnvase(true); }}
              className="text-xs text-green-400 hover:text-green-300"
            >
              + Nuevo envase
            </button>
            <button onClick={addItem} className="text-xs text-blue-400 hover:text-blue-300">+ Agregar línea</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                <th className="text-left px-3 py-2 w-44">Envase (catálogo)</th>
                <th className="text-left px-3 py-2">Descripción</th>
                <th className="text-right px-3 py-2 w-20">Cant.</th>
                <th className="text-right px-3 py-2 w-28">P. Unit. (S/)</th>
                <th className="text-right px-3 py-2 w-20">Desc. %</th>
                <th className="text-right px-3 py-2 w-28">Subtotal</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <select
                        className="flex-1 bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                        value={item.envase_id ?? ""}
                        onChange={(e) => updateItem(i, "envase_id", e.target.value ? Number(e.target.value) : null as unknown as number)}
                      >
                        <option value="">— Libre —</option>
                        {envases.map((e) => (
                          <option key={e.id} value={e.id}>[{e.categoria}] {e.nombre}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        title="Crear nuevo envase y asignarlo aquí"
                        onClick={() => { pendingRowRef.current = i; setModalEnvase(true); }}
                        className="text-green-500 hover:text-green-300 text-base leading-none shrink-0"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                      placeholder="Descripción del producto..."
                      value={item.descripcion}
                      onChange={(e) => updateItem(i, "descripcion", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="1"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 text-right focus:outline-none focus:border-blue-500"
                      value={item.cantidad}
                      onChange={(e) => updateItem(i, "cantidad", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 text-right focus:outline-none focus:border-blue-500"
                      value={item.precio_unitario}
                      onChange={(e) => updateItem(i, "precio_unitario", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" max="100"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 text-right focus:outline-none focus:border-blue-500"
                      value={item.descuento}
                      onChange={(e) => updateItem(i, "descuento", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-blue-300 text-xs">S/ {fmt(calcItem(item))}</td>
                  <td className="px-3 py-2 text-center">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-slate-500 hover:text-red-400 text-xs">✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals + Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Notas / Condiciones</label>
          <textarea
            rows={4}
            className="w-full bg-slate-800 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
            placeholder="Condiciones de pago, entrega, observaciones..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Subtotal bruto</span>
            <span className="font-mono">S/ {fmt(subtotalItems)}</span>
          </div>
          {descGlobal > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Descuento ({descGlobal}%)</span>
              <span className="font-mono text-red-400">- S/ {fmt(subtotalItems * descGlobal / 100)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Subtotal neto</span>
            <span className="font-mono">S/ {fmt(subtotalConDesc)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">IGV (18%)</span>
            <span className="font-mono">S/ {fmt(igvMonto)}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-slate-600 pt-2 mt-1">
            <span>TOTAL</span>
            <span className="font-mono text-blue-400 text-lg">S/ {fmt(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={saving || !clienteId || items.every((it) => !it.descripcion)}
          className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? "Guardando..." : "Guardar Cotización"}
        </button>
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
      </div>
    </div>
  );
}
