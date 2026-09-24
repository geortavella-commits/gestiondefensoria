import { supabase } from './supabaseClient';
import type { Area } from '../types/legajo';

export type EstadoNota = 'borrador' | 'enviada' | 'recibida' | 'observada' | 'aprobada' | 'cancelada';
export type CategoriaItem = 'material' | 'servicio' | 'infraestructura';

export const CATEGORIAS: { id: CategoriaItem; label: string }[] = [
  { id: 'material', label: 'Materiales' },
  { id: 'servicio', label: 'Servicios' },
  { id: 'infraestructura', label: 'Infraestructura' },
];

export interface ItemNota {
  id?: string;
  categoria: CategoriaItem;
  descripcion: string;
  cantidad: number;
  precio_unitario: number | null;
  observacion: string | null;
  proveedor_nombre: string | null;
  proveedor_apellido: string | null;
  proveedor_cuit: string | null;
  proveedor_contacto: string | null;
  orden?: number;
}

export interface HistorialNota {
  id: string;
  estado: EstadoNota;
  comentario: string | null;
  created_at: string;
  profile?: { nombre: string; apellido: string } | null;
}

interface PersonaRef {
  nombre: string;
  apellido: string;
  cargo?: string | null;
}

export interface NotaPedido {
  id: string;
  numero: string | null;
  area_id: string;
  solicitado_por: string;
  fecha: string;
  descripcion: string | null;
  estado: EstadoNota;
  enviada_at: string | null;
  recibida_por: string | null;
  recibida_at: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  comentario_revision: string | null;
  created_at: string;
  area?: { id: string; nombre: string } | null;
  solicitante?: PersonaRef | null;
  receptor?: PersonaRef | null;
  revisor?: PersonaRef | null;
  items?: ItemNota[];
  historial?: HistorialNota[];
}

export const totalItems = (items: Pick<ItemNota, 'cantidad' | 'precio_unitario'>[] = []) =>
  items.reduce((acc, it) => acc + Number(it.cantidad || 0) * Number(it.precio_unitario || 0), 0);

export const formatearMonto = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n).replace(/ /g, ' ');

const SELECT_LISTA = `
  *,
  area:area_id ( id, nombre ),
  solicitante:solicitado_por ( nombre, apellido, cargo ),
  items:notas_pedido_items ( cantidad, precio_unitario )
`;

const SELECT_DETALLE = `
  *,
  area:area_id ( id, nombre ),
  solicitante:solicitado_por ( nombre, apellido, cargo ),
  receptor:recibida_por ( nombre, apellido ),
  revisor:revisado_por ( nombre, apellido ),
  items:notas_pedido_items ( * ),
  historial:notas_pedido_historial ( id, estado, comentario, created_at, profile:profile_id ( nombre, apellido ) )
`;

export async function listarNotas(): Promise<{ notas: NotaPedido[]; areas: Area[] }> {
  const [{ data, error }, { data: areas, error: errAreas }] = await Promise.all([
    supabase.from('notas_pedido').select(SELECT_LISTA).order('created_at', { ascending: false }),
    supabase.from('areas').select('*').order('nombre', { ascending: true }),
  ]);
  if (error) throw error;
  if (errAreas) throw errAreas;
  return { notas: (data || []) as unknown as NotaPedido[], areas: (areas || []) as Area[] };
}

export async function obtenerNota(id: string): Promise<NotaPedido> {
  const { data, error } = await supabase.from('notas_pedido').select(SELECT_DETALLE).eq('id', id).single();
  if (error) throw error;
  const nota = data as unknown as NotaPedido;
  nota.items = [...(nota.items || [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  nota.historial = [...(nota.historial || [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return nota;
}

/** Crea el borrador o actualiza uno existente, reemplazando sus ítems. Devuelve el id. */
export async function guardarNota(datos: {
  id?: string;
  area_id: string;
  solicitado_por: string;
  descripcion: string;
  items: ItemNota[];
}): Promise<string> {
  let id = datos.id;

  if (id) {
    const { error } = await supabase.from('notas_pedido').update({ descripcion: datos.descripcion || null }).eq('id', id);
    if (error) throw error;
    const { error: errDel } = await supabase.from('notas_pedido_items').delete().eq('nota_id', id);
    if (errDel) throw errDel;
  } else {
    const { data, error } = await supabase
      .from('notas_pedido')
      .insert({
        area_id: datos.area_id,
        solicitado_por: datos.solicitado_por,
        descripcion: datos.descripcion || null,
      })
      .select('id')
      .single();
    if (error) throw error;
    id = data.id as string;
  }

  const filas = datos.items
    .filter((it) => it.descripcion.trim())
    .map((it, i) => ({
      nota_id: id,
      categoria: it.categoria,
      descripcion: it.descripcion.trim(),
      cantidad: it.cantidad || 1,
      precio_unitario: it.precio_unitario,
      observacion: it.observacion?.trim() || null,
      proveedor_nombre: it.proveedor_nombre?.trim() || null,
      proveedor_apellido: it.proveedor_apellido?.trim() || null,
      proveedor_cuit: it.proveedor_cuit?.trim() || null,
      proveedor_contacto: it.proveedor_contacto?.trim() || null,
      orden: i,
    }));

  if (filas.length > 0) {
    const { error } = await supabase.from('notas_pedido_items').insert(filas);
    if (error) throw error;
  }
  return id as string;
}

// Las reglas de cada etapa las valida el trigger validar_transicion_nota en la base.
async function cambiarEstado(id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('notas_pedido').update(patch).eq('id', id);
  if (error) throw error;
}

export const enviarNota = (id: string) => cambiarEstado(id, { estado: 'enviada' });
export const recibirNota = (id: string) => cambiarEstado(id, { estado: 'recibida' });
export const aprobarNota = (id: string, comentario: string) =>
  cambiarEstado(id, { estado: 'aprobada', comentario_revision: comentario.trim() || null });
export const observarNota = (id: string, comentario: string) =>
  cambiarEstado(id, { estado: 'observada', comentario_revision: comentario.trim() });
export const cancelarNota = (id: string) => cambiarEstado(id, { estado: 'cancelada' });

export async function eliminarBorrador(id: string) {
  const { error } = await supabase.from('notas_pedido').delete().eq('id', id);
  if (error) throw error;
}
