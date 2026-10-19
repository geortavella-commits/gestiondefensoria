import { supabase } from './supabaseClient';

export type EstadoDerivacion = 'enviada' | 'tomada' | 'cancelada';

export interface DerivacionNotaPedido {
  id: string;
  sub_sede_origen_id: string;
  area_destino_id: string;
  fecha: string; // YYYY-MM-DD
  descripcion: string;
  estado: EstadoDerivacion;
  creado_por: string;
  nota_pedido_id: string | null;
  tomada_por: string | null;
  tomada_at: string | null;
  avisado_subsede_por: string | null;
  avisado_subsede_at: string | null;
  motivo_cancelacion: string | null;
  archivo_path: string | null;
  archivo_nombre: string | null;
  created_at: string;
  updated_at: string;
  sub_sede?: { id: string; nombre: string } | null;
  area_destino?: { id: string; nombre: string } | null;
  creador?: { id: string; nombre: string; apellido: string } | null;
  nota_pedido?: { id: string; numero: string | null; estado: string } | null;
}

const BUCKET = 'documentos-derivaciones';

const SELECT_DERIVACIONES = `
  *,
  sub_sede:sub_sede_origen_id ( id, nombre ),
  area_destino:area_destino_id ( id, nombre ),
  creador:creado_por ( id, nombre, apellido ),
  nota_pedido:nota_pedido_id ( id, numero, estado )
`;

/**
 * Lista las derivaciones visibles según RLS: gestión y Coordinación de
 * Subsedes ven todas; el área destino (Prensa/Promoción) ve las propias.
 */
export async function listarDerivacionesPedido(): Promise<DerivacionNotaPedido[]> {
  const { data, error } = await supabase
    .from('derivaciones_notas_pedido')
    .select(SELECT_DERIVACIONES)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as DerivacionNotaPedido[];
}

/**
 * Coordinación de Subsedes carga lo que le mandó la sub-sede (pegado o
 * resumido) y lo deriva a un área que atienda estas derivaciones.
 */
export async function crearDerivacionPedido(datos: {
  sub_sede_origen_id: string;
  area_destino_id: string;
  fecha: string;
  descripcion: string;
}): Promise<DerivacionNotaPedido> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('No hay una sesión de usuario activa');

  const { data, error } = await supabase
    .from('derivaciones_notas_pedido')
    .insert({
      sub_sede_origen_id: datos.sub_sede_origen_id,
      area_destino_id: datos.area_destino_id,
      fecha: datos.fecha,
      descripcion: datos.descripcion.trim(),
      creado_por: user.id,
    })
    .select(SELECT_DERIVACIONES)
    .single();

  if (error) throw error;
  return data as unknown as DerivacionNotaPedido;
}

/**
 * El área destino la toma: vincula la nota de pedido que ya creó (con
 * `crearNota`/`guardarNota` de `services/notasPedido.ts`) a esta derivación.
 */
export async function tomarDerivacionPedido(derivacionId: string, notaPedidoId: string): Promise<void> {
  const { error } = await supabase
    .from('derivaciones_notas_pedido')
    .update({ estado: 'tomada', nota_pedido_id: notaPedidoId })
    .eq('id', derivacionId);
  if (error) throw error;
}

export async function cancelarDerivacionPedido(id: string, motivo: string): Promise<void> {
  if (!motivo || !motivo.trim()) throw new Error('El motivo de la cancelación es obligatorio');
  const { error } = await supabase
    .from('derivaciones_notas_pedido')
    .update({ estado: 'cancelada', motivo_cancelacion: motivo.trim() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Coordinación de Subsedes confirma que ya le avisó a la sub-sede. Solo
 * funciona si la nota de pedido vinculada ya está resuelta (lo valida el
 * trigger de la base).
 */
export async function marcarAvisadoSubsede(id: string): Promise<void> {
  const { error } = await supabase
    .from('derivaciones_notas_pedido')
    .update({ avisado_subsede_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Sube el archivo que mandó la sub-sede (ej. foto/PDF de la nota original)
 * al bucket privado `documentos-derivaciones` y lo vincula a la derivación.
 * Solo gestión o Coordinación de Subsedes pueden hacerlo (lo valida storage).
 */
export async function subirArchivoDerivacion(derivacionId: string, file: File): Promise<DerivacionNotaPedido> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${derivacionId}/archivo_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
  if (uploadError) throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);

  const { data, error } = await supabase
    .from('derivaciones_notas_pedido')
    .update({ archivo_path: filePath, archivo_nombre: file.name })
    .eq('id', derivacionId)
    .select(SELECT_DERIVACIONES)
    .single();

  if (error) throw error;
  return data as unknown as DerivacionNotaPedido;
}

export async function getSignedUrlArchivoDerivacion(path: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
