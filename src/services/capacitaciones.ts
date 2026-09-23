import { supabase } from './supabaseClient';
import type { SubSede, Profile, Area } from '../types/legajo';

export interface SolicitudCapacitacion {
  id: string;
  sub_sede_id: string;
  solicitado_por: string;
  tema: string;
  descripcion: string | null;
  cantidad_participantes: number | null;
  fecha_propuesta: string | null;
  justificacion: string | null;
  estado:
    | 'enviada'
    | 'en_coordinacion'
    | 'derivada_area'
    | 'aprobada_area'
    | 'aprobada'
    | 'postergada'
    | 'suspendida'
    | 'cancelada';
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
  observaciones_estado: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  sub_sedes?: SubSede;
  solicitante?: Profile;
  area_asignada?: Area;
  revisor?: Profile;
}

export interface CapacitacionesMetricas {
  totalDemandas: number;
  enRevision: number;
  aprobadas: number;
  observadas: number;
  realizadas: number;
}

/**
 * Obtiene todas las solicitudes de capacitación con joins y estadísticas
 */
export async function getSolicitudesCapacitacion(): Promise<{
  solicitudes: SolicitudCapacitacion[];
  metricas: CapacitacionesMetricas;
  docentesDisponibles: Profile[];
  subSedes: SubSede[];
  areas: Area[];
}> {
  const [
    { data: solicitudesData, error: errSol },
    { data: realizadasData },
    { data: perfilesData },
    { data: subSedesData },
    { data: areasData },
  ] = await Promise.all([
    supabase
      .from('solicitudes_capacitacion')
      .select(`
        *,
        sub_sedes:sub_sede_id ( id, nombre, localidad ),
        solicitante:solicitado_por ( id, nombre, apellido, cargo, email ),
        area_asignada:area_asignada_id ( id, nombre ),
        revisor:revisado_por ( id, nombre, apellido )
      `)
      .order('created_at', { ascending: false }),
    supabase.from('capacitaciones_realizadas').select('id'),
    supabase
      .from('profiles')
      .select('id, nombre, apellido, cargo, email, rol, area_id')
      .order('apellido', { ascending: true }),
    supabase.from('sub_sedes').select('*').order('nombre', { ascending: true }),
    supabase.from('areas').select('*').order('nombre', { ascending: true }),
  ]);

  if (errSol) throw errSol;

  const solicitudes = (solicitudesData || []) as SolicitudCapacitacion[];
  const totalRealizadas = (realizadasData || []).length;

  const enRevision = solicitudes.filter(
    (s) => s.estado === 'enviada' || s.estado === 'en_coordinacion' || s.estado === 'derivada_area'
  ).length;

  const aprobadas = solicitudes.filter(
    (s) => s.estado === 'aprobada' || s.estado === 'aprobada_area'
  ).length;

  const observadas = solicitudes.filter(
    (s) => s.estado === 'postergada' || s.estado === 'suspendida' || s.estado === 'cancelada'
  ).length;

  return {
    solicitudes,
    metricas: {
      totalDemandas: solicitudes.length,
      enRevision,
      aprobadas,
      observadas,
      realizadas: totalRealizadas,
    },
    docentesDisponibles: (perfilesData || []) as Profile[],
    subSedes: (subSedesData || []) as SubSede[],
    areas: (areasData || []) as Area[],
  };
}

/**
 * Dictamina o actualiza una solicitud de capacitación
 */
export async function dictaminarSolicitud(
  solicitudId: string,
  datos: {
    estado: 'aprobada' | 'postergada' | 'suspendida';
    revisado_por?: string;
    comentario_revision: string;
    area_asignada_id?: string | null;
    fecha_confirmada?: string;
    carga_horaria?: number;
    docente_nombre?: string;
  }
): Promise<SolicitudCapacitacion> {
  const { data, error } = await supabase
    .from('solicitudes_capacitacion')
    .update({
      estado: datos.estado,
      comentario_revision: datos.comentario_revision,
      revisado_por: datos.revisado_por || null,
      fecha_revision: new Date().toISOString(),
      area_asignada_id: datos.area_asignada_id || null,
    })
    .eq('id', solicitudId)
    .select(`
      *,
      sub_sedes:sub_sede_id ( id, nombre, localidad ),
      solicitante:solicitado_por ( id, nombre, apellido, cargo ),
      area_asignada:area_asignada_id ( id, nombre )
    `)
    .single();

  if (error) throw error;

  // Si se aprueba, registrar en capacitaciones_realizadas si se confirmó docente y fecha
  if (datos.estado === 'aprobada' && data) {
    try {
      await supabase.from('capacitaciones_realizadas').insert({
        solicitud_id: data.id,
        nombre: data.tema,
        fecha: datos.fecha_confirmada || data.fecha_propuesta || new Date().toISOString().split('T')[0],
        modalidad: 'Presencial Territorial',
        capacitador: datos.docente_nombre || 'Equipo Central DDNNA',
        sub_sede_id: data.sub_sede_id,
        area_id: data.area_asignada_id,
        cantidad_participantes: data.cantidad_participantes || 30,
        carga_horaria: datos.carga_horaria || 6,
        entidad_dictante: 'Defensoría de los Derechos de Niñas, Niños y Adolescentes',
      });
    } catch {
      // Si ya existía o RLS restringe
    }
  }

  return data as SolicitudCapacitacion;
}

/**
 * Crea una nueva solicitud de capacitación desde una sub-sede
 */
export async function crearSolicitudCapacitacion(datos: {
  sub_sede_id: string;
  solicitado_por: string;
  tema: string;
  descripcion?: string;
  cantidad_participantes?: number;
  fecha_propuesta?: string;
  justificacion?: string;
}): Promise<SolicitudCapacitacion> {
  const { data, error } = await supabase
    .from('solicitudes_capacitacion')
    .insert({
      ...datos,
      estado: 'enviada',
    })
    .select(`
      *,
      sub_sedes:sub_sede_id ( id, nombre, localidad ),
      solicitante:solicitado_por ( id, nombre, apellido )
    `)
    .single();

  if (error) throw error;
  return data as SolicitudCapacitacion;
}
