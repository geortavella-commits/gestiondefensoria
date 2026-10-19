import { supabase } from './supabaseClient';
import type { Area } from '../types/legajo';

export type EstadoNota = 'borrador' | 'enviada' | 'recibida' | 'observada' | 'aprobada' | 'aprobada_parcial' | 'cancelada';
export type CategoriaItem = 'material' | 'servicio' | 'infraestructura';
export type EstadoItem = 'pendiente' | 'aprobado' | 'rechazado' | 'anulado';

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
  // Aprobación y entrega por ítem (independiente del estado general de la nota)
  estado_item?: EstadoItem;
  motivo_rechazo?: string | null;
  revisado_por?: string | null;
  revisado_at?: string | null;
  entregado?: boolean;
  entregado_at?: string | null;
  entregado_por?: string | null;
  anulado_por?: string | null;
  anulado_at?: string | null;
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

/** Notas de un área puntual, para vincular una actividad territorial a una nota existente. */
export async function listarNotasDeArea(areaId: string): Promise<{ id: string; numero: string | null; descripcion: string | null }[]> {
  const { data, error } = await supabase
    .from('notas_pedido')
    .select('id, numero, descripcion')
    .eq('area_id', areaId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

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
export const cancelarNota = (id: string) => cambiarEstado(id, { estado: 'cancelada' });

export async function eliminarBorrador(id: string) {
  const { error } = await supabase.from('notas_pedido').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Edita el contenido de UN ítem puntual (no borra ni recrea los demás, a
 * diferencia de `guardarNota`). Pensado para que el área corrija un ítem
 * rechazado: el trigger de la base lo vuelve a 'pendiente' solo y la nota
 * vuelve sola a 'recibida' para que Administración lo mire de nuevo. Un
 * ítem ya 'aprobado' no se puede tocar — el trigger lo rechaza.
 */
export async function editarItemNota(
  itemId: string,
  datos: Partial<Pick<ItemNota, 'categoria' | 'descripcion' | 'cantidad' | 'precio_unitario' | 'observacion'>>
): Promise<void> {
  const { error } = await supabase.from('notas_pedido_items').update(datos).eq('id', itemId);
  if (error) throw error;
}

/**
 * Administración/gestión aprueba o rechaza UN ítem (estado 'recibida' de la
 * nota). El estado general de la nota se recalcula solo: todos aprobados ->
 * 'aprobada', todos rechazados -> 'observada', mezcla -> 'aprobada_parcial'.
 */
export async function aprobarItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('notas_pedido_items').update({ estado_item: 'aprobado' }).eq('id', itemId);
  if (error) throw error;
}

export async function rechazarItem(itemId: string, motivo: string): Promise<void> {
  if (!motivo || !motivo.trim()) throw new Error('El motivo de rechazo del ítem es obligatorio');
  const { error } = await supabase
    .from('notas_pedido_items')
    .update({ estado_item: 'rechazado', motivo_rechazo: motivo.trim() })
    .eq('id', itemId);
  if (error) throw error;
}

/**
 * El área da de baja un ítem rechazado en vez de corregirlo (ej: ya no lo
 * necesita, o no tiene forma de ajustarlo al motivo del rechazo). Es
 * terminal: un ítem anulado no se puede volver a editar. La nota avanza
 * considerando solo los ítems no anulados — si eran los únicos pendientes,
 * la nota puede terminar en 'aprobada' (si el resto estaba aprobado) o
 * 'cancelada' (si no queda ningún ítem vigente).
 */
export async function anularItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('notas_pedido_items').update({ estado_item: 'anulado' }).eq('id', itemId);
  if (error) throw error;
}

/** Atajo: aprueba de una todos los ítems pendientes de la nota. */
export async function aprobarTodosLosItems(notaId: string): Promise<void> {
  const { error } = await supabase.rpc('aprobar_todos_los_items_nota', { p_nota_id: notaId });
  if (error) throw error;
}

/** Marcar/desmarcar la entrega de un ítem. Solo sobre un ítem ya aprobado. */
export async function marcarItemEntregado(itemId: string, entregado: boolean): Promise<void> {
  const { error } = await supabase.from('notas_pedido_items').update({ entregado }).eq('id', itemId);
  if (error) throw error;
}
