import { supabase } from './supabaseClient';
import type { PersonaVacacionRef } from './vacaciones';

const BUCKET = 'documentos-licencias';

export type EstadoLicencia = 'enviada' | 'aprobada' | 'rechazada' | 'cancelada';

export interface LicenciaParticular {
  id: string;
  profile_id: string;
  fecha_desde: string; // YYYY-MM-DD
  fecha_hasta: string; // YYYY-MM-DD
  dias_habiles: number | null; // calculado en el servidor, máx. 2 por solicitud
  motivo: string | null;
  adjunto_path: string | null;
  adjunto_nombre: string | null;
  estado: EstadoLicencia;
  revisado_por: string | null;
  revisado_at: string | null;
  comentario_revision: string | null;
  created_at: string;
  updated_at: string;
  solicitante?: PersonaVacacionRef | null;
  revisor?: { id: string; nombre: string; apellido: string } | null;
}

export interface SaldoLicenciaParticular {
  diasUsadosMes: number;
  diasUsadosAnio: number;
  topeMensual: number; // 2
  topeAnual: number; // 10
  disponibleMes: number;
  disponibleAnio: number;
}

const SELECT_LICENCIAS = `
  id,
  profile_id,
  fecha_desde,
  fecha_hasta,
  dias_habiles,
  motivo,
  adjunto_path,
  adjunto_nombre,
  estado,
  revisado_por,
  revisado_at,
  comentario_revision,
  created_at,
  updated_at,
  solicitante:profile_id (
    id,
    nombre,
    apellido,
    cargo,
    legajo,
    area:area_id ( nombre ),
    sub_sedes:sub_sede_id ( nombre )
  ),
  revisor:revisado_por (
    id,
    nombre,
    apellido
  )
`;

/**
 * Tope: hasta 2 días hábiles por solicitud, 2 días/mes y 10 días/año
 * (sumando días hábiles aprobados, no cantidad de solicitudes). Lo valida
 * el trigger `validar_licencia_particular` — acá no se repite esa lógica.
 */
export async function saldoLicenciaParticular(
  profileId: string,
  anio: number,
  mes: number
): Promise<SaldoLicenciaParticular> {
  const { data, error } = await supabase.rpc('saldo_licencia_particular', {
    p_profile_id: profileId,
    p_anio: anio,
    p_mes: mes,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return { diasUsadosMes: 0, diasUsadosAnio: 0, topeMensual: 2, topeAnual: 10, disponibleMes: 2, disponibleAnio: 10 };
  }

  return {
    diasUsadosMes: Number(row.dias_usados_mes ?? 0),
    diasUsadosAnio: Number(row.dias_usados_anio ?? 0),
    topeMensual: Number(row.tope_mensual ?? 2),
    topeAnual: Number(row.tope_anual ?? 10),
    disponibleMes: Number(row.disponible_mes ?? 0),
    disponibleAnio: Number(row.disponible_anio ?? 0),
  };
}

/**
 * Lista las licencias visibles para quien consulta según RLS (propias;
 * gestión y Administración ven todas; jefe de área/referente de sub-sede
 * ven las de su alcance).
 */
export async function listarLicenciasParticulares(): Promise<LicenciaParticular[]> {
  const { data, error } = await supabase
    .from('licencias_particulares')
    .select(SELECT_LICENCIAS)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as LicenciaParticular[];
}

/**
 * Crea una solicitud de licencia por razones particulares. Por defecto a
 * nombre de quien está logueado; con `profileId` se registra a nombre de
 * otra persona dentro del alcance de quien llama (mismo criterio que
 * `crearSolicitudVacaciones`).
 */
export async function crearLicenciaParticular(datos: {
  fecha_desde: string;
  fecha_hasta: string;
  motivo?: string | null;
  profileId?: string;
}): Promise<LicenciaParticular> {
  let profileId = datos.profileId;

  if (!profileId) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('No hay una sesión de usuario activa');
    profileId = user.id;
  }

  const { data, error } = await supabase
    .from('licencias_particulares')
    .insert({
      profile_id: profileId,
      fecha_desde: datos.fecha_desde,
      fecha_hasta: datos.fecha_hasta,
      motivo: datos.motivo?.trim() || null,
      estado: 'enviada',
    })
    .select(SELECT_LICENCIAS)
    .single();

  if (error) throw error;
  return data as unknown as LicenciaParticular;
}

export async function cancelarLicenciaPropia(id: string): Promise<void> {
  const { error } = await supabase.from('licencias_particulares').update({ estado: 'cancelada' }).eq('id', id);
  if (error) throw error;
}

export async function aprobarLicencia(id: string, comentarioRevision?: string | null): Promise<void> {
  const { error } = await supabase
    .from('licencias_particulares')
    .update({ estado: 'aprobada', comentario_revision: comentarioRevision?.trim() || null })
    .eq('id', id);
  if (error) throw error;
}

export async function rechazarLicencia(id: string, comentarioRevision: string): Promise<void> {
  if (!comentarioRevision || !comentarioRevision.trim()) {
    throw new Error('El motivo de rechazo es obligatorio');
  }
  const { error } = await supabase
    .from('licencias_particulares')
    .update({ estado: 'rechazada', comentario_revision: comentarioRevision.trim() })
    .eq('id', id);
  if (error) throw error;
}

export async function cancelarLicenciaAprobada(id: string, comentarioRevision?: string | null): Promise<void> {
  const { error } = await supabase
    .from('licencias_particulares')
    .update({ estado: 'cancelada', comentario_revision: comentarioRevision?.trim() || null })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Sube el justificativo (opcional) al bucket privado `documentos-licencias`
 * y guarda el path en la solicitud.
 */
export async function subirAdjuntoLicencia(
  licenciaId: string,
  profileId: string,
  file: File
): Promise<LicenciaParticular> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${profileId}/${licenciaId}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
  if (uploadError) {
    throw new Error(`No se pudo subir el adjunto: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from('licencias_particulares')
    .update({ adjunto_path: filePath, adjunto_nombre: file.name })
    .eq('id', licenciaId)
    .select(SELECT_LICENCIAS)
    .single();

  if (error) throw error;
  return data as unknown as LicenciaParticular;
}

export async function getSignedUrlAdjuntoLicencia(path: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
