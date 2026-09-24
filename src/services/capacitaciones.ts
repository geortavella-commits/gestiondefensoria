import { supabase } from './supabaseClient';
import type { SubSede, Profile, Area } from '../types/legajo';

export type EstadoSolicitud =
  | 'enviada'
  | 'en_coordinacion'
  | 'derivada_area'
  | 'aprobada_area'
  | 'aprobada'
  | 'postergada'
  | 'suspendida'
  | 'cancelada';

export interface SolicitudCapacitacion {
  id: string;
  sub_sede_id: string | null;
  area_solicitante_id: string | null;
  solicitado_por: string;
  solicitante_externo: string | null;
  solicitante_externo_contacto: string | null;
  tema: string;
  descripcion: string | null;
  cantidad_participantes: number | null;
  fecha_propuesta: string | null;
  justificacion: string | null;
  estado: EstadoSolicitud;
  nota_generada_url: string | null;
  area_asignada_id: string | null;
  coordinacion_revisado_por: string | null;
  coordinacion_revision_fecha: string | null;
  area_revisado_por: string | null;
  area_revision_comentario: string | null;
  area_revision_fecha: string | null;
  revisado_por: string | null;
  comentario_revision: string | null;
  fecha_revision: string | null;
  google_form_url: string | null;
  form_enviado_at: string | null;
  observaciones_estado: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  sub_sedes?: SubSede | null;
  solicitante?: Profile | null;
  area_asignada?: Area | null;
  area_solicitante?: Area | null;
}

export interface CapacitacionesMetricas {
  totalDemandas: number;
  enCurso: number;
  aprobadas: number;
  pausadas: number;
  realizadas: number;
}

const SELECT_SOLICITUD = `
  *,
  sub_sedes:sub_sede_id ( id, nombre, localidad ),
  solicitante:solicitado_por ( id, nombre, apellido, cargo, email ),
  area_asignada:area_asignada_id ( id, nombre ),
  area_solicitante:area_solicitante_id ( id, nombre )
`;

export async function getSolicitudesCapacitacion(): Promise<{
  solicitudes: SolicitudCapacitacion[];
  metricas: CapacitacionesMetricas;
  areas: Area[];
  subSedes: SubSede[];
}> {
  const [
    { data: solicitudesData, error: errSol },
    { data: realizadasData, error: errRealizadas },
    { data: subSedesData },
    { data: areasData },
  ] = await Promise.all([
    supabase.from('solicitudes_capacitacion').select(SELECT_SOLICITUD).order('created_at', { ascending: false }),
    supabase.from('capacitaciones_realizadas').select('id'),
    supabase.from('sub_sedes').select('*').order('nombre', { ascending: true }),
    supabase.from('areas').select('*').order('nombre', { ascending: true }),
  ]);

  if (errSol) throw errSol;
  if (errRealizadas) throw errRealizadas;

  const solicitudes = (solicitudesData || []) as unknown as SolicitudCapacitacion[];

  return {
    solicitudes,
    metricas: {
      totalDemandas: solicitudes.length,
      enCurso: solicitudes.filter((s) => ['enviada', 'derivada_area', 'aprobada_area'].includes(s.estado)).length,
      aprobadas: solicitudes.filter((s) => s.estado === 'aprobada').length,
      pausadas: solicitudes.filter((s) => ['postergada', 'suspendida', 'cancelada'].includes(s.estado)).length,
      realizadas: (realizadasData || []).length,
    },
    areas: (areasData || []) as Area[],
    subSedes: (subSedesData || []) as SubSede[],
  };
}

export async function crearSolicitudCapacitacion(datos: {
  sub_sede_id?: string | null;
  area_solicitante_id?: string | null;
  solicitado_por: string;
  tema: string;
  descripcion?: string;
  cantidad_participantes?: number;
  fecha_propuesta?: string;
  justificacion?: string;
  solicitante_externo?: string;
  solicitante_externo_contacto?: string;
}): Promise<SolicitudCapacitacion> {
  const { data, error } = await supabase
    .from('solicitudes_capacitacion')
    .insert({ ...datos, estado: 'enviada' })
    .select(SELECT_SOLICITUD)
    .single();

  if (error) throw error;
  return data as unknown as SolicitudCapacitacion;
}

// Cada etapa es un UPDATE; las reglas (quién puede, qué campos, qué transiciones)
// las valida el trigger validar_transicion_solicitud en la base.
async function actualizar(id: string, patch: Record<string, unknown>): Promise<SolicitudCapacitacion> {
  const { data, error } = await supabase
    .from('solicitudes_capacitacion')
    .update(patch)
    .eq('id', id)
    .select(SELECT_SOLICITUD)
    .single();

  if (error) throw error;
  return data as unknown as SolicitudCapacitacion;
}

/** Etapa 2: Coordinación de Subsedes aprueba y deriva a Prensa/Protección. */
export const derivarSolicitud = (id: string, areaId: string) =>
  actualizar(id, { estado: 'derivada_area', area_asignada_id: areaId });

/** Etapa 3: el área derivada aprueba. */
export const aprobarPorArea = (id: string, comentario: string) =>
  actualizar(id, { estado: 'aprobada_area', area_revision_comentario: comentario || null });

/** Etapa 4: Coordinación carga el link del formulario y cierra. */
export const cerrarConFormulario = (id: string, googleFormUrl: string, comentario: string) =>
  actualizar(id, {
    estado: 'aprobada',
    google_form_url: googleFormUrl.trim(),
    comentario_revision: comentario || null,
  });

/** Etapa 5: la sub-sede avisa que envió el formulario al solicitante original. */
export const marcarFormularioEnviado = (id: string) =>
  actualizar(id, { form_enviado_at: new Date().toISOString() });

export const postergarSolicitud = (id: string, motivo: string, nuevaFecha?: string | null) =>
  actualizar(id, {
    estado: 'postergada',
    observaciones_estado: motivo,
    ...(nuevaFecha ? { fecha_propuesta: nuevaFecha } : {}),
  });

export const suspenderSolicitud = (id: string, motivo: string) =>
  actualizar(id, { estado: 'suspendida', observaciones_estado: motivo });

export const reactivarSolicitud = (id: string) => actualizar(id, { estado: 'enviada' });

export const cancelarSolicitud = (id: string) => actualizar(id, { estado: 'cancelada' });
