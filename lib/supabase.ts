import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://gamnenyakraafruvbkin.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbW5lbnlha3JhYWZydXZia2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5NzU4NDQsImV4cCI6MjA4NTU1MTg0NH0.UpolMRzWNfd4hqBeYvnTrrvDu1C1rmrNXKvnO82y_OQ"
);

export const IGV = 0.18;

export type Cliente = {
  id: number;
  nombre: string;
  empresa: string;
  ruc: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  created_at: string;
};

export type Envase = {
  id: number;
  nombre: string;
  categoria: string;
  material: string | null;
  capacidad: string | null;
  unidad: string;
  precio_unitario: number;
  stock: number;
  descripcion: string | null;
  activo: boolean;
};

export type CotizacionItem = {
  id: number;
  cotizacion_id: number;
  envase_id: number | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento: number;
  subtotal: number;
  env_envases?: Envase;
};

export type Cotizacion = {
  id: number;
  numero: string;
  cliente_id: number;
  estado: "borrador" | "enviada" | "aprobada" | "rechazada";
  subtotal: number;
  igv: number;
  total: number;
  descuento_global: number;
  notas: string | null;
  vigencia_dias: number;
  created_at: string;
  env_clientes?: Cliente;
  env_cotizacion_items?: CotizacionItem[];
};

export function fmt(n: number) {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function nextNumero(count: number) {
  const year = new Date().getFullYear();
  return `COT-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const ESTADO_COLOR: Record<string, string> = {
  borrador:  "bg-slate-700 text-slate-300",
  enviada:   "bg-blue-900 text-blue-300",
  aprobada:  "bg-green-900 text-green-300",
  rechazada: "bg-red-900 text-red-300",
};

export const CAT_COLOR: Record<string, string> = {
  "Big Bag":         "bg-orange-900/60 text-orange-300",
  "Bulk Bag":        "bg-amber-900/60 text-amber-300",
  "Bolsas de papel": "bg-yellow-900/60 text-yellow-300",
  "Bolsas Mixtas":   "bg-purple-900/60 text-purple-300",
  "Otros":           "bg-slate-700 text-slate-300",
};
