"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase, fmt, IGV, type Cliente, type Envase } from "@/lib/supabase";
import { getUsuario } from "@/lib/usuario";

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

// Snapshot of original values for change comparison
type Original = {
  clienteId: number;
  clienteEmpresa: string;
  vigencia: number;
  descGlobal: number;
  notas: string;
  itemsHash: string;
};

export default function EditarCotizacion() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [envases,  setEnvases]  = useState<Envase[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const [clienteId,  setClienteId]  = useState<number | "">("");
  const [notas,      setNotas]      = useState("");
  const [vigencia,   setVigencia]   = useState(30);
  const [descGlobal, setDescGlobal] = useState(0);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [numero, setNumero] = useState("");
  const originalRef  = useRef<Original | null>(null);
  const itemsTouched = useRef(false);

  useEffect(() => {
    Promise.all([
      supabase.from("env_clientes").select("*").order("empresa"),
      supabase.from("env_envases").select("*").eq("activo", true).order("categoria").order("nombre"),
      supabase.from("env_cotizaciones")
        .select("*, env_cotizacion_items(*)")
        .eq("id", id)
        .single(),
    ]).then(([{ data: c }, { data: e }, { data: cot }]) => {
      const clientesList = (c ?? []) as Cliente[];
      setClientes(clientesList);
      setEnvases((e ?? []) as Envase[]);
      if (cot) {
        const itemsLoaded = (cot.env_cotizacion_items ?? []).map((it: {
          envase_id: number | null;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          descuento: number;
        }) => ({
          envase_id: it.envase_id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: Number(it.precio_unitario),
          descuento: Number(it.descuento),
        }));

        setClienteId(cot.cliente_id);
        setNotas(cot.notas ?? "");
        setVigencia(cot.vigencia_dias);
        setDescGlobal(Number(cot.descuento_global));
        setNumero(cot.numero);
        setItems(itemsLoaded);

        const empresa = clientesList.find((cl) => cl.id === cot.cliente_id)?.empresa ?? String(cot.cliente_id);
        originalRef.current = {
          clienteId:      cot.cliente_id,
          clienteEmpresa: empresa,
          vigencia:       cot.vigencia_dias,
          descGlobal:     Number(cot.descuento_global),
          notas:          cot.notas ?? "",
          // Store raw items so guardar() can compare with normalize()
          itemsHash:      JSON.stringify(itemsLoaded),
        };
      }
      setLoading(false);
    });
  }, [id]);

  const addItem = () => {
    itemsTouched.current = true;
    setItems((prev) => [...prev, { envase_id: null, descripcion: "", cantidad: 1, precio_unitario: 0, descuento: 0 }]);
  };

  const removeItem = (i: number) => {
    itemsTouched.current = true;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateItem = useCallback((i: number, field: keyof ItemRow, value: string | number) => {
    itemsTouched.current = true;
    setItems((prev) => {
      const next = [...prev];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (next[i] as any)[field] = value;
      if (field === "envase_id" && value) {
        const env = envases.find((e) => e.id === Number(value));
        if (env) {
          next[i].precio_unitario = env.precio_unitario;
          next[i].descripcion = env.nombre;
        }
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

    await supabase.from("env_cotizaciones").update({
      cliente_id:       clienteId,
      subtotal:         subtotalConDesc,
      igv:              igvMonto,
      total,
      descuento_global: descGlobal,
      notas,
      vigencia_dias:    vigencia,
    }).eq("id", id);

    // Replace items
    await supabase.from("env_cotizacion_items").delete().eq("cotizacion_id", id);
    await supabase.from("env_cotizacion_items").insert(
      items
        .filter((it) => it.descripcion)
        .map((it) => ({
          cotizacion_id:   Number(id),
          envase_id:       it.envase_id || null,
          descripcion:     it.descripcion,
          cantidad:        it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento:       it.descuento,
          subtotal:        calcItem(it),
        }))
    );

    // Build one activity record per changed field
    const orig = originalRef.current;
    const usuario = getUsuario();
    const logs: object[] = [];

    if (orig) {
      if (Number(clienteId) !== orig.clienteId) {
        const nuevaEmpresa = clientes.find((cl) => cl.id === Number(clienteId))?.empresa ?? String(clienteId);
        logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Cliente", dato_anterior: orig.clienteEmpresa, dato_nuevo: nuevaEmpresa });
      }
      if (vigencia !== orig.vigencia) {
        logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Vigencia", dato_anterior: `${orig.vigencia} días`, dato_nuevo: `${vigencia} días` });
      }
      if (descGlobal !== orig.descGlobal) {
        logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Descuento global", dato_anterior: `${orig.descGlobal}%`, dato_nuevo: `${descGlobal}%` });
      }
      if (notas.trim() !== orig.notas.trim()) {
        logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Notas", dato_anterior: orig.notas || "(vacío)", dato_nuevo: notas.trim() || "(vacío)" });
      }
      if (itemsTouched.current) {
        const origItems = (JSON.parse(orig.itemsHash) as ItemRow[]).filter((it) => it.descripcion);
        const newItems  = items.filter((it) => it.descripcion);
        const maxLen    = Math.max(origItems.length, newItems.length);

        for (let i = 0; i < maxLen; i++) {
          const o = origItems[i];
          const n = newItems[i];
          const label = n?.descripcion || o?.descripcion || `Línea ${i + 1}`;

          if (!o && n) {
            logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Producto agregado", dato_anterior: null, dato_nuevo: n.descripcion });
          } else if (o && !n) {
            logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Producto eliminado", dato_anterior: o.descripcion, dato_nuevo: null });
          } else if (o && n) {
            if (o.descripcion.trim() !== n.descripcion.trim()) {
              logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: "Descripción", dato_anterior: o.descripcion, dato_nuevo: n.descripcion });
            }
            if (Number(o.cantidad) !== Number(n.cantidad)) {
              logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: `Cantidad (${label})`, dato_anterior: String(Number(o.cantidad)), dato_nuevo: String(Number(n.cantidad)) });
            }
            if (Number(o.precio_unitario).toFixed(2) !== Number(n.precio_unitario).toFixed(2)) {
              logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: `Precio unitario (${label})`, dato_anterior: `S/ ${Number(o.precio_unitario).toFixed(2)}`, dato_nuevo: `S/ ${Number(n.precio_unitario).toFixed(2)}` });
            }
            if (Number(o.descuento).toFixed(2) !== Number(n.descuento).toFixed(2)) {
              logs.push({ cotizacion_id: Number(id), usuario, tipo: "campo", descripcion: `Descuento (${label})`, dato_anterior: `${Number(o.descuento).toFixed(2)}%`, dato_nuevo: `${Number(n.descuento).toFixed(2)}%` });
            }
          }
        }
      }
    }

    if (logs.length === 0) {
      // No fields changed — still record the edit action
      logs.push({ cotizacion_id: Number(id), usuario, tipo: "edicion", descripcion: "Cotización editada (sin cambios)" });
    }

    await supabase.from("env_actividad").insert(logs);

    router.push(`/cotizaciones/${id}`);
  }

  if (loading) return <div className="text-slate-400 py-10 text-center">Cargando...</div>;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">← Volver</button>
        <h1 className="text-2xl font-bold">Editar {numero}</h1>
      </div>

      {/* Header */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Cliente *</label>
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
              <input type="number" min="1"
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                value={vigencia} onChange={(e) => setVigencia(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Descuento global (%)</label>
              <input type="number" min="0" max="100" step="0.5"
                className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                value={descGlobal} onChange={(e) => setDescGlobal(Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-sm">Productos / Items</h2>
          <button onClick={addItem} className="text-xs text-blue-400 hover:text-blue-300">+ Agregar línea</button>
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
                    <select
                      className="w-full bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                      value={item.envase_id ?? ""}
                      onChange={(e) => updateItem(i, "envase_id", e.target.value ? Number(e.target.value) : null as unknown as number)}
                    >
                      <option value="">— Libre —</option>
                      {envases.map((e) => (
                        <option key={e.id} value={e.id}>[{e.categoria}] {e.nombre}</option>
                      ))}
                    </select>
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
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">Cancelar</button>
      </div>
    </div>
  );
}
