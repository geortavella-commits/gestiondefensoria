import { supabase } from './supabaseClient';
import type { SubSede, Profile } from '../types/legajo';

export interface SubSedeConMetricas extends SubSede {
  referente?: Profile | null;
  totalAgentes: number;
  cumplimientoPorcentaje: number;
  equipos: {
    legales: number;
    psicosocial: number;
    territoriales: number;
  };
  estadoOperativo: 'operativa_247' | 'diurno' | 'normal' | 'alerta';
  regionBadge: string;
  codigoId: string;
}

export interface SubSedesKPIs {
  totalActivas: number;
  totalPersonalTerritorio: number;
  cumplimientoPromedio: number;
}

/**
 * Obtiene todas las sub-sedes con métricas de personal, referente asignado y cumplimiento
 */
export async function getSubSedesConMetricas(): Promise<{
  subSedes: SubSedeConMetricas[];
  kpis: SubSedesKPIs;
  referentesDisponibles: Profile[];
}> {
  // 1. Obtener todas las sub-sedes, perfiles y documentos
  const [{ data: sedesData, error: errSedes }, { data: profilesData, error: errProf }, { data: docsData }] =
    await Promise.all([
      supabase.from('sub_sedes').select('*').order('nombre', { ascending: true }),
      supabase
        .from('profiles')
        .select(`
          id, nombre, apellido, email, telefono, cargo, rol, sub_sede_id, area_id, estado,
          areas:area_id ( id, nombre )
        `),
      supabase
        .from('documentos_personal')
        .select('id, profile_id, estado, fecha_vencimiento'),
    ]);

  if (errSedes) throw errSedes;
  if (errProf) throw errProf;

  const sedes = (sedesData || []) as SubSede[];
  const perfiles = (profilesData || []) as unknown as Profile[];
  const documentos = (docsData || []) as any[];

  // 2. Mapear métricas por sub-sede
  const subSedesMetricas: SubSedeConMetricas[] = sedes.map((sede, index) => {
    // Agentes asignados a esta sede
    const agentesSede = perfiles.filter((p) => p.sub_sede_id === sede.id);
    const totalAgentes = agentesSede.length;

    // Referente
    const referente =
      perfiles.find((p) => (sede as any).referente_id === p.id) ||
      agentesSede.find((p) => p.rol === 'referente_subsede') ||
      null;

    // Equipos interdisciplinarios
    const legales = agentesSede.filter((p) => {
      const area = (p.areas?.nombre || '').toLowerCase();
      const cargo = (p.cargo || '').toLowerCase();
      return area.includes('legal') || cargo.includes('abog') || cargo.includes('leg');
    }).length;

    const psicosocial = agentesSede.filter((p) => {
      const area = (p.areas?.nombre || '').toLowerCase();
      const cargo = (p.cargo || '').toLowerCase();
      return area.includes('social') || area.includes('psico') || cargo.includes('lic') || cargo.includes('trabajo social');
    }).length;

    const territoriales = Math.max(0, totalAgentes - legales - psicosocial);

    // Cumplimiento legal: % de documentos obligatorios validados sobre el total
    // esperado (agentes de la sede × 13 tipos de documento). Sin agentes, no hay
    // base para calcular un índice — se informa 0, nunca un valor inventado.
    let cumplimientoPorcentaje = 0;
    if (totalAgentes > 0) {
      const agenteIds = new Set(agentesSede.map((a) => a.id));
      const docsSede = documentos.filter((d) => agenteIds.has(d.profile_id));
      const docsValidados = docsSede.filter(
        (d) => d.estado === 'aprobado' && (!d.fecha_vencimiento || new Date(d.fecha_vencimiento) >= new Date())
      ).length;

      const totalEsperado = totalAgentes * 13;
      cumplimientoPorcentaje = Math.min(100, Math.round((docsValidados / totalEsperado) * 100));
    }

    // Estado derivado y badges
    let estadoOperativo: 'operativa_247' | 'diurno' | 'normal' | 'alerta' = 'normal';
    if (cumplimientoPorcentaje < 70) {
      estadoOperativo = 'alerta';
    } else if (sede.nombre.toLowerCase().includes('central') || sede.nombre.toLowerCase().includes('caba')) {
      estadoOperativo = 'operativa_247';
    } else if (index % 2 === 0) {
      estadoOperativo = 'diurno';
    }

    const regionBadge = sede.localidad || (sede.nombre.includes('CABA') ? 'Jurisdicción Federal' : 'Región Provincial');
    const codigoId = `SEDE-${sede.nombre.substring(0, 3).toUpperCase()}-${index + 1}`;

    return {
      ...sede,
      referente,
      totalAgentes,
      cumplimientoPorcentaje,
      equipos: {
        legales,
        psicosocial,
        territoriales,
      },
      estadoOperativo,
      regionBadge,
      codigoId,
    };
  });

  // KPIs Globales
  const totalActivas = sedes.filter((s) => s.activo).length;
  const totalPersonalTerritorio = perfiles.length;
  const sumaCumplimiento = subSedesMetricas.reduce((acc, curr) => acc + curr.cumplimientoPorcentaje, 0);
  const cumplimientoPromedio = subSedesMetricas.length > 0 ? Math.round(sumaCumplimiento / subSedesMetricas.length) : 86;

  return {
    subSedes: subSedesMetricas,
    kpis: {
      totalActivas,
      totalPersonalTerritorio,
      cumplimientoPromedio,
    },
    referentesDisponibles: perfiles,
  };
}

/**
 * Registra una nueva sub-sede en Supabase
 */
export async function crearSubSede(datos: {
  nombre: string;
  direccion?: string;
  localidad?: string;
  telefono?: string;
  referente_id?: string | null;
}): Promise<SubSede> {
  const { data, error } = await supabase
    .from('sub_sedes')
    .insert({
      nombre: datos.nombre.trim(),
      direccion: datos.direccion?.trim() || null,
      localidad: datos.localidad?.trim() || null,
      telefono: datos.telefono?.trim() || null,
      referente_id: datos.referente_id || null,
      activo: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as SubSede;
}

/**
 * Elimina una sub-sede. Falla si tiene solicitudes de capacitación, capacitaciones
 * realizadas o solicitudes de insumos asociadas (integridad referencial) — en ese
 * caso conviene desactivarla en vez de borrarla.
 */
export async function eliminarSubSede(id: string): Promise<void> {
  const { error } = await supabase.from('sub_sedes').delete().eq('id', id);
  if (error) {
    if (error.code === '23503') {
      throw new Error(
        'No se puede eliminar: esta sub-sede tiene agentes, solicitudes o capacitaciones asociadas. Desactivala en su lugar.'
      );
    }
    throw error;
  }
}
