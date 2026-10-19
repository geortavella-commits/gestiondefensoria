import { supabase } from './supabaseClient';
import type { Area } from '../types/legajo';

const BUCKET = 'actividades-territoriales';

export type TipoActividad = 'taller' | 'capacitacion' | 'jornada_charla' | 'relevamiento_visita' | 'otro';
export type EstadoActividad = 'registrada' | 'anulada';

export const TIPOS_ACTIVIDAD: { id: TipoActividad; label: string }[] = [
  { id: 'taller', label: 'Taller' },
  { id: 'capacitacion', label: 'Capacitación' },
  { id: 'jornada_charla', label: 'Jornada / Charla' },
  { id: 'relevamiento_visita', label: 'Relevamiento / Visita' },
  { id: 'otro', label: 'Otro' },
];

export interface ActividadTerritorial {
  id: string;
  area_id: string;
  registrado_por: string;
  fecha: string; // YYYY-MM-DD
  localidad: string;
  tipo_actividad: TipoActividad;
  descripcion: string;
  cantidad_participantes: number;
  nota_pedido_id: string | null;
  fotos_paths: string[];
  estado: EstadoActividad;
  anulado_por: string | null;
  anulado_at: string | null;
  motivo_anulacion: string | null;
  created_at: string;
  updated_at: string;
  area?: { id: string; nombre: string } | null;
  registrador?: { id: string; nombre: string; apellido: string } | null;
  nota_pedido?: { id: string; numero: string | null } | null;
}

const SELECT_LISTA = `
  *,
  area:area_id ( id, nombre ),
  registrador:registrado_por ( id, nombre, apellido ),
  nota_pedido:nota_pedido_id ( id, numero )
`;

/**
 * Lista actividades visibles según RLS: gestión ve todas; cualquiera ve las
 * de su propia área; jefe de área ve además las que supervisa.
 */
export async function listarActividadesTerritoriales(): Promise<{ actividades: ActividadTerritorial[]; areas: Area[] }> {
  const [{ data, error }, { data: areas, error: errAreas }] = await Promise.all([
    supabase.from('actividades_territoriales').select(SELECT_LISTA).order('fecha', { ascending: false }),
    supabase.from('areas').select('*').order('nombre', { ascending: true }),
  ]);
  if (error) throw error;
  if (errAreas) throw errAreas;
  return {
    actividades: (data || []) as unknown as ActividadTerritorial[],
    areas: (areas || []) as Area[],
  };
}

export async function crearActividadTerritorial(datos: {
  area_id: string;
  fecha: string;
  localidad: string;
  tipo_actividad: TipoActividad;
  descripcion: string;
  cantidad_participantes: number;
  nota_pedido_id?: string | null;
}): Promise<ActividadTerritorial> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('No hay una sesión de usuario activa');

  const { data, error } = await supabase
    .from('actividades_territoriales')
    .insert({
      area_id: datos.area_id,
      registrado_por: user.id,
      fecha: datos.fecha,
      localidad: datos.localidad.trim(),
      tipo_actividad: datos.tipo_actividad,
      descripcion: datos.descripcion.trim(),
      cantidad_participantes: datos.cantidad_participantes,
      nota_pedido_id: datos.nota_pedido_id || null,
    })
    .select(SELECT_LISTA)
    .single();

  if (error) throw error;
  return data as unknown as ActividadTerritorial;
}

/**
 * Edita el contenido de una actividad (dueño, gestión, o jefe del área). El
 * trigger de la base bloquea esto solo si la actividad ya está `anulada`.
 */
export async function actualizarActividadTerritorial(
  id: string,
  datos: Partial<{
    fecha: string;
    localidad: string;
    tipo_actividad: TipoActividad;
    descripcion: string;
    cantidad_participantes: number;
    nota_pedido_id: string | null;
  }>
): Promise<ActividadTerritorial> {
  const payload: Record<string, any> = { ...datos };
  if (payload.localidad !== undefined) payload.localidad = payload.localidad.trim();
  if (payload.descripcion !== undefined) payload.descripcion = payload.descripcion.trim();
  if (payload.nota_pedido_id !== undefined) payload.nota_pedido_id = payload.nota_pedido_id || null;

  const { data, error } = await supabase
    .from('actividades_territoriales')
    .update(payload)
    .eq('id', id)
    .select(SELECT_LISTA)
    .single();

  if (error) throw error;
  return data as unknown as ActividadTerritorial;
}

export async function anularActividadTerritorial(id: string, motivo: string): Promise<void> {
  if (!motivo || !motivo.trim()) throw new Error('El motivo de la anulación es obligatorio');
  const { error } = await supabase
    .from('actividades_territoriales')
    .update({ estado: 'anulada', motivo_anulacion: motivo.trim() })
    .eq('id', id);
  if (error) throw error;
}

/** Sube una foto y la agrega al array `fotos_paths` de la actividad. */
export async function agregarFotoActividad(actividadId: string, areaId: string, file: File): Promise<ActividadTerritorial> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${areaId}/${actividadId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
  if (uploadError) throw new Error(`No se pudo subir la foto: ${uploadError.message}`);

  const { data: actual, error: errActual } = await supabase
    .from('actividades_territoriales')
    .select('fotos_paths')
    .eq('id', actividadId)
    .single();
  if (errActual) throw errActual;

  const nuevasFotos = [...((actual?.fotos_paths as string[]) || []), filePath];

  const { data, error } = await supabase
    .from('actividades_territoriales')
    .update({ fotos_paths: nuevasFotos })
    .eq('id', actividadId)
    .select(SELECT_LISTA)
    .single();

  if (error) throw error;
  return data as unknown as ActividadTerritorial;
}

export async function getSignedUrlFotoActividad(path: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
