import { supabase } from './supabaseClient';
import type { SubSede, Area } from '../types/legajo';

export interface SemaforoRequisito {
  codigo: 'D' | 'T' | 'P' | 'M' | 'C';
  nombre: string;
  estado: 'ok' | 'alerta' | 'pendiente';
  tooltip: string;
}

export interface AgenteNominaItem {
  id: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  dni: string;
  legajo: string;
  cargo: string;
  areaNombre: string;
  subSedeId: string;
  subSedeNombre: string;
  fechaIngreso: string;
  antiguedadTexto: string;
  avatarUrl: string | null;
  semaforo: SemaforoRequisito[];
  estadoGeneral: 'completo' | 'alerta' | 'pendiente';
  estadoGeneralTexto: string;
}

export interface NominaKpis {
  totalAgentes: number;
  legajosCompletos: number;
  legajosCompletosPct: number;
  docPendiente: number;
  alertasCriticas: number;
}

export interface NominaData {
  agentes: AgenteNominaItem[];
  kpis: NominaKpis;
  subSedes: SubSede[];
  areas: Area[];
}

// Mapeo entre los 5 códigos del semáforo y los tipos de documento reales del catálogo.
const SEMAFORO_TIPOS: { codigo: SemaforoRequisito['codigo']; nombre: string; tipoDocumentoNombre: string }[] = [
  { codigo: 'D', nombre: 'DNI', tipoDocumentoNombre: 'DNI' },
  { codigo: 'T', nombre: 'Título', tipoDocumentoNombre: 'Certificado de estudios / título' },
  { codigo: 'P', nombre: 'Antecedentes', tipoDocumentoNombre: 'Certificado de antecedentes penales' },
  { codigo: 'M', nombre: 'Médico', tipoDocumentoNombre: 'Apto psicofísico' },
  { codigo: 'C', nombre: 'Contrato', tipoDocumentoNombre: 'Designación Funcional y Contrato' },
];

function calcularAntiguedad(fechaIngresoStr: string | null): string {
  if (!fechaIngresoStr) return 'No informada';
  const inicio = new Date(fechaIngresoStr);
  const ahora = new Date();
  let anios = ahora.getFullYear() - inicio.getFullYear();
  let meses = ahora.getMonth() - inicio.getMonth();
  if (meses < 0) {
    anios--;
    meses += 12;
  }
  if (anios <= 0 && meses <= 0) return 'Menos de 1 mes';
  if (anios <= 0) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  return `${anios} ${anios === 1 ? 'año' : 'años'} ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
}

function calcularSemaforo(misDocs: any[], hoy: Date): SemaforoRequisito[] {
  return SEMAFORO_TIPOS.map(({ codigo, nombre, tipoDocumentoNombre }) => {
    const doc = misDocs.find((d) => d.tipos_documento?.nombre === tipoDocumentoNombre);

    if (!doc || doc.estado === 'pendiente') {
      return { codigo, nombre, estado: 'pendiente', tooltip: `${nombre}: pendiente de carga` };
    }
    if (doc.estado === 'rechazado') {
      return { codigo, nombre, estado: 'alerta', tooltip: `${nombre}: documento rechazado` };
    }
    if (doc.fecha_vencimiento) {
      const f = new Date(doc.fecha_vencimiento);
      f.setHours(0, 0, 0, 0);
      if (f.getTime() < hoy.getTime()) {
        return { codigo, nombre, estado: 'alerta', tooltip: `${nombre}: vencido` };
      }
    }
    if (doc.estado === 'cargado') {
      return { codigo, nombre, estado: 'pendiente', tooltip: `${nombre}: cargado, en revisión` };
    }
    return { codigo, nombre, estado: 'ok', tooltip: `${nombre}: vigente` };
  });
}

export async function getNominaPersonalData(): Promise<NominaData> {
  const [{ data: perfilesData, error: errPerfiles }, { data: subsedesData }, { data: areasData }, { data: docsData }] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, nombre, apellido, dni, legajo, cargo, email, telefono, avatar_url, fecha_ingreso, estado, sub_sede_id, area_id, sub_sedes:sub_sede_id(id, nombre, localidad), areas:area_id(id, nombre)'
      )
      .order('apellido', { ascending: true }),
    supabase.from('sub_sedes').select('*').order('nombre', { ascending: true }),
    supabase.from('areas').select('*').order('nombre', { ascending: true }),
    supabase.from('documentos_personal').select('id, profile_id, estado, fecha_vencimiento, tipos_documento(nombre)'),
  ]);

  if (errPerfiles) {
    console.error('Error al consultar profiles para la nómina:', errPerfiles);
    throw new Error(`No se pudo cargar la nómina: ${errPerfiles.message}`);
  }

  const perfiles: any[] = perfilesData || [];
  const subsedes: SubSede[] = subsedesData || [];
  const areas: Area[] = areasData || [];
  const docs: any[] = docsData || [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const agentes: AgenteNominaItem[] = perfiles.map((p) => {
    const misDocs = docs.filter((d) => d.profile_id === p.id);
    const semaforo = calcularSemaforo(misDocs, hoy);

    let estadoGeneral: 'completo' | 'alerta' | 'pendiente' = 'completo';
    let estadoGeneralTexto = 'Legajo Completo';

    if (semaforo.some((s) => s.estado === 'alerta')) {
      estadoGeneral = 'alerta';
      estadoGeneralTexto = 'Alerta Vencimiento';
    } else if (semaforo.some((s) => s.estado === 'pendiente')) {
      estadoGeneral = 'pendiente';
      estadoGeneralTexto = 'Pendiente Subsanación';
    }

    const fechaIngresoFormatted = p.fecha_ingreso
      ? new Date(p.fecha_ingreso).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : 'No informada';

    return {
      id: p.id,
      nombre: p.nombre,
      apellido: p.apellido,
      nombreCompleto: `${p.nombre} ${p.apellido}`,
      dni: p.dni ? `DNI ${p.dni}` : 'Sin DNI registrado',
      legajo: p.legajo ? `Leg. #${p.legajo}` : 'Sin legajo asignado',
      cargo: p.cargo || 'Sin cargo asignado',
      areaNombre: p.areas?.nombre || 'Sin área asignada',
      subSedeId: p.sub_sede_id || '',
      subSedeNombre: p.sub_sedes?.nombre || 'Sede Central',
      fechaIngreso: fechaIngresoFormatted,
      antiguedadTexto: calcularAntiguedad(p.fecha_ingreso),
      avatarUrl: p.avatar_url || null,
      semaforo,
      estadoGeneral,
      estadoGeneralTexto,
    };
  });

  const legajosCompletos = agentes.filter((a) => a.estadoGeneral === 'completo').length;
  const docPendiente = agentes.filter((a) => a.estadoGeneral === 'pendiente').length;
  const alertasCriticas = agentes.filter((a) => a.estadoGeneral === 'alerta').length;

  return {
    agentes,
    kpis: {
      totalAgentes: agentes.length,
      legajosCompletos,
      legajosCompletosPct: agentes.length > 0 ? Math.round((legajosCompletos / agentes.length) * 100) : 0,
      docPendiente,
      alertasCriticas,
    },
    subSedes: subsedes,
    areas,
  };
}
