import { supabase } from './supabaseClient';

export type EstadoVacacion = 'enviada' | 'aprobada' | 'rechazada' | 'cancelada';

export interface PersonaVacacionRef {
  id: string;
  nombre: string;
  apellido: string;
  cargo?: string | null;
  legajo?: string | null;
  area?: { nombre: string } | null;
  sub_sedes?: { nombre: string } | null;
}

export interface VacacionSolicitud {
  id: string;
  profile_id: string;
  fecha_desde: string; // YYYY-MM-DD
  fecha_hasta: string; // YYYY-MM-DD
  dias_habiles: number | null; // Calculado en el servidor por un trigger
  estado: EstadoVacacion;
  comentario: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
  comentario_revision: string | null;
  created_at: string;
  updated_at: string;
  solicitante?: PersonaVacacionRef | null;
  revisor?: { id: string; nombre: string; apellido: string } | null;
}

export interface SaldoVacaciones {
  dias_asignados: number | null;
  dias_arrastrados: number;
  dias_aprobados: number;
  tuvo_rechazo: boolean;
  saldo_final: number | null;
}

export interface Feriado {
  fecha: string; // YYYY-MM-DD
  nombre: string;
}

export interface PersonalACargoItem {
  profileId: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  cargo: string | null;
  areaNombre: string | null;
  subSedeNombre: string | null;
  diasAsignados: number;
  saldoFinal: number | null;
}

const SELECT_SOLICITUDES = `
  id,
  profile_id,
  fecha_desde,
  fecha_hasta,
  dias_habiles,
  estado,
  comentario,
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
 * Obtiene el saldo de vacaciones para un agente en un año determinado
 * llamando a la RPC del servidor: saldo_vacaciones(p_profile_id, p_anio)
 */
export async function obtenerSaldoVacaciones(profileId: string, anio: number): Promise<SaldoVacaciones> {
  const { data, error } = await supabase.rpc('saldo_vacaciones', {
    p_profile_id: profileId,
    p_anio: anio,
  });

  if (error) {
    throw error;
  }

  // La RPC puede devolver un objeto o un array de una fila
  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return {
      dias_asignados: null,
      dias_arrastrados: 0,
      dias_aprobados: 0,
      tuvo_rechazo: false,
      saldo_final: null,
    };
  }

  return {
    dias_asignados: row.dias_asignados != null ? Number(row.dias_asignados) : null,
    dias_arrastrados: Number(row.dias_arrastrados ?? 0),
    dias_aprobados: Number(row.dias_aprobados ?? 0),
    tuvo_rechazo: Boolean(row.tuvo_rechazo),
    saldo_final: row.saldo_final != null ? Number(row.saldo_final) : null,
  };
}

/**
 * Personal a cargo de quien consulta (gestión: todos; jefe de área: su área;
 * referente de sub-sede: su sub-sede; Administración: todos), con el saldo
 * de vacaciones ya calculado por la RPC `personal_a_cargo_vacaciones` — evita
 * pedir el saldo persona por persona desde el cliente.
 */
export async function getPersonalACargoVacaciones(anio: number): Promise<PersonalACargoItem[]> {
  const { data, error } = await supabase.rpc('personal_a_cargo_vacaciones', { p_anio: anio });

  if (error) {
    throw error;
  }

  return ((data || []) as any[]).map((row) => ({
    profileId: row.profile_id,
    nombre: row.nombre,
    apellido: row.apellido,
    dni: row.dni,
    cargo: row.cargo,
    areaNombre: row.area_nombre,
    subSedeNombre: row.sub_sede_nombre,
    diasAsignados: Number(row.dias_asignados ?? 0),
    saldoFinal: row.saldo_final != null ? Number(row.saldo_final) : null,
  }));
}

/**
 * Lista las solicitudes de vacaciones visibles para el usuario según RLS.
 * (Usuarios normales ven las propias, Administración y Gestión ven todas).
 */
export async function listarSolicitudesVacaciones(): Promise<VacacionSolicitud[]> {
  const { data, error } = await supabase
    .from('vacaciones_solicitudes')
    .select(SELECT_SOLICITUDES)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as unknown as VacacionSolicitud[];
}

/**
 * Crea una nueva solicitud de vacaciones. Por defecto, a nombre de quien está
 * logueado. Si se pasa `profileId`, la registra a nombre de otra persona
 * (ej. Administración/gestión/jefe de área anotando un pedido que llegó por
 * otro medio) — la policy `vacaciones_insert` es la que realmente decide si
 * eso está permitido según el alcance de quien llama.
 * El servidor calcula los días hábiles y valida saldo mediante triggers.
 */
export async function crearSolicitudVacaciones(datos: {
  fecha_desde: string;
  fecha_hasta: string;
  comentario?: string | null;
  profileId?: string;
}): Promise<VacacionSolicitud> {
  let profileId = datos.profileId;

  if (!profileId) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('No hay una sesión de usuario activa');
    }
    profileId = user.id;
  }

  const { data, error } = await supabase
    .from('vacaciones_solicitudes')
    .insert({
      profile_id: profileId,
      fecha_desde: datos.fecha_desde,
      fecha_hasta: datos.fecha_hasta,
      comentario: datos.comentario?.trim() || null,
      estado: 'enviada',
    })
    .select(SELECT_SOLICITUDES)
    .single();

  if (error) {
    throw error;
  }

  return data as unknown as VacacionSolicitud;
}

/**
 * El dueño de la solicitud cancela su solicitud que estaba en estado 'enviada'.
 */
export async function cancelarSolicitudPropia(id: string): Promise<void> {
  const { error } = await supabase
    .from('vacaciones_solicitudes')
    .update({ estado: 'cancelada' })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

/**
 * Administración o Gestión aprueba una solicitud en estado 'enviada'.
 */
export async function aprobarSolicitud(id: string, comentarioRevision?: string | null): Promise<void> {
  const { error } = await supabase
    .from('vacaciones_solicitudes')
    .update({
      estado: 'aprobada',
      comentario_revision: comentarioRevision?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

/**
 * Administración o Gestión rechaza una solicitud en estado 'enviada'.
 * El comentario_revision es obligatorio.
 */
export async function rechazarSolicitud(id: string, comentarioRevision: string): Promise<void> {
  if (!comentarioRevision || !comentarioRevision.trim()) {
    throw new Error('El motivo de rechazo es obligatorio');
  }

  const { error } = await supabase
    .from('vacaciones_solicitudes')
    .update({
      estado: 'rechazada',
      comentario_revision: comentarioRevision.trim(),
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

/**
 * Solo Administración o Gestión puede cancelar una solicitud previamente 'aprobada'.
 */
export async function cancelarSolicitudAprobada(id: string, comentarioRevision?: string | null): Promise<void> {
  const { error } = await supabase
    .from('vacaciones_solicitudes')
    .update({
      estado: 'cancelada',
      comentario_revision: comentarioRevision?.trim() || null,
    })
    .eq('id', id);

  if (error) {
    throw error;
  }
}

/**
 * Obtiene la lista de feriados (solo lectura).
 */
export async function obtenerFeriados(): Promise<Feriado[]> {
  const { data, error } = await supabase
    .from('feriados')
    .select('fecha, nombre')
    .order('fecha', { ascending: true });

  if (error) {
    // Si la tabla feriados no tiene permisos o falla, no bloqueamos la app
    console.warn('No se pudieron obtener los feriados:', error.message);
    return [];
  }

  return (data || []) as Feriado[];
}

/**
 * Calcula una aproximación visual de días hábiles entre dos fechas para el formulario.
 * Aclara al usuario que el cálculo final exacto lo efectúa el servidor.
 */
export function estimarDiasHabiles(
  fechaDesdeStr: string,
  fechaHastaStr: string,
  feriados: Feriado[] = []
): number {
  if (!fechaDesdeStr || !fechaHastaStr) return 0;

  const [y1, m1, d1] = fechaDesdeStr.split('-').map(Number);
  const [y2, m2, d2] = fechaHastaStr.split('-').map(Number);

  const inicio = new Date(y1, m1 - 1, d1);
  const fin = new Date(y2, m2 - 1, d2);

  if (fin < inicio) return 0;

  const feriadosSet = new Set(feriados.map((f) => f.fecha));

  let diasHabiles = 0;
  const cur = new Date(inicio);

  while (cur <= fin) {
    const diaSemana = cur.getDay(); // 0 = Domingo, 6 = Sábado
    const isoDate = cur.toISOString().slice(0, 10);

    if (diaSemana !== 0 && diaSemana !== 6 && !feriadosSet.has(isoDate)) {
      diasHabiles++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return diasHabiles;
}
