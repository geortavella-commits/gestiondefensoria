import { supabase } from './supabaseClient';
import type { SubSede, Profile } from '../types/legajo';

export interface TableroKpis {
  personalActivo: number;
  nuevasIncorporacionesMes: number;
  documentacionPendiente: number;
  alertasVencimiento30d: number;
  talleresRealizados: number;
  solicitudesEnCurso: number;
  antecedentesAlDiaPct: number;
}

export interface CoberturaSedeItem {
  id: string;
  nombre: string;
  agentesCount: number;
  porcentajeCompletitud: number;
  esCritico: boolean;
}

export interface SolicitudRecienteItem {
  id: string;
  subSedeNombre: string;
  tematica: string;
  fechaEstimada: string;
  estado: string;
  solicitadoPorNombre?: string;
}

export interface AlertaCriticaItem {
  id: string;
  agenteNombre: string;
  sedeNombre: string;
  cargo: string;
  documentoTipo: string;
  estadoAlerta: 'Vencido' | 'Vence pronto' | 'Rechazado';
  diasTexto: string;
  tipoColor: 'error' | 'warning';
  profileId: string;
  email: string;
}

export interface TableroData {
  kpis: TableroKpis;
  coberturaSubSedes: CoberturaSedeItem[];
  solicitudesRecientes: SolicitudRecienteItem[];
  alertasCriticas: AlertaCriticaItem[];
  subSedes: SubSede[];
  perfiles: Profile[];
}

export async function getTableroControlData(): Promise<TableroData> {
  const [
    { data: perfilesData, error: errPerfiles },
    { data: subsedesData },
    { data: docsData },
    { data: solicitudesData },
    { data: capRealizadasData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nombre, apellido, cargo, estado, sub_sede_id, email, fecha_ingreso, sub_sedes:sub_sede_id(nombre, localidad)')
      .order('apellido', { ascending: true }),
    supabase.from('sub_sedes').select('*').order('nombre', { ascending: true }),
    supabase
      .from('documentos_personal')
      .select(
        'id, profile_id, estado, fecha_vencimiento, profiles:profile_id(nombre, apellido, cargo, email, sub_sedes:sub_sede_id(nombre)), tipos_documento(nombre)'
      ),
    supabase
      .from('solicitudes_capacitacion')
      .select('id, sub_sede_id, tema, estado, fecha_propuesta, sub_sedes(nombre), profiles:solicitado_por(nombre, apellido)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase.from('capacitaciones_realizadas').select('id'),
  ]);

  if (errPerfiles) {
    console.error('Error al consultar profiles para el tablero:', errPerfiles);
    throw new Error(`No se pudo cargar el tablero: ${errPerfiles.message}`);
  }

  const perfiles: any[] = perfilesData || [];
  const subsedes: SubSede[] = subsedesData || [];
  const documentos: any[] = docsData || [];
  const solicitudes: any[] = solicitudesData || [];
  const capRealizadas: any[] = capRealizadasData || [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diasHasta = (fecha: string) => {
    const f = new Date(fecha);
    f.setHours(0, 0, 0, 0);
    return Math.ceil((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  };

  // ================= KPIs =================
  const documentacionPendiente = documentos.filter(
    (d) => d.estado === 'pendiente' || d.estado === 'cargado'
  ).length;

  const alertasVencimiento30d = documentos.filter((d) => {
    if (!d.fecha_vencimiento) return false;
    return diasHasta(d.fecha_vencimiento) <= 30;
  }).length;

  const nuevasIncorporacionesMes = perfiles.filter((p) => {
    if (!p.fecha_ingreso) return false;
    const f = new Date(p.fecha_ingreso);
    return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
  }).length;

  const activosCount = perfiles.filter((p) => p.estado === 'activo').length;
  const antecedentesAlDia = documentos.filter(
    (d) =>
      d.tipos_documento?.nombre === 'Certificado de antecedentes penales' &&
      d.estado === 'aprobado' &&
      (!d.fecha_vencimiento || diasHasta(d.fecha_vencimiento) >= 0)
  ).length;

  const kpis: TableroKpis = {
    personalActivo: activosCount,
    nuevasIncorporacionesMes,
    documentacionPendiente,
    alertasVencimiento30d,
    talleresRealizados: capRealizadas.length,
    solicitudesEnCurso: solicitudes.filter((s) =>
      ['enviada', 'en_coordinacion', 'derivada_area', 'aprobada_area'].includes(s.estado)
    ).length,
    antecedentesAlDiaPct: activosCount > 0 ? Math.round((antecedentesAlDia / activosCount) * 100) : 0,
  };

  // ================= Cobertura por Sub-Sede =================
  // % real de documentos obligatorios validados sobre el total esperado
  // (agentes de la sede × 13 tipos). Sin agentes, no hay base de cálculo: 0.
  const coberturaSubSedes: CoberturaSedeItem[] = subsedes.map((sede) => {
    const agentesSede = perfiles.filter((p) => p.sub_sede_id === sede.id);
    const agenteIds = new Set(agentesSede.map((a) => a.id));
    const docsSede = documentos.filter((d) => agenteIds.has(d.profile_id));
    const docsValidados = docsSede.filter(
      (d) => d.estado === 'aprobado' && (!d.fecha_vencimiento || diasHasta(d.fecha_vencimiento) >= 0)
    ).length;

    const totalEsperado = agentesSede.length * 13;
    const pct = totalEsperado > 0 ? Math.min(100, Math.round((docsValidados / totalEsperado) * 100)) : 0;

    return {
      id: sede.id,
      nombre: sede.nombre,
      agentesCount: agentesSede.length,
      porcentajeCompletitud: pct,
      esCritico: pct < 70,
    };
  });

  // ================= Solicitudes Recientes =================
  const solicitudesRecientes: SolicitudRecienteItem[] = solicitudes.map((s) => ({
    id: s.id,
    subSedeNombre: s.sub_sedes?.nombre || 'Sub-Sede Territorial',
    tematica: s.tema,
    fechaEstimada: s.fecha_propuesta
      ? new Date(s.fecha_propuesta).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Sin fecha propuesta',
    estado: s.estado,
    solicitadoPorNombre: s.profiles ? `${s.profiles.nombre} ${s.profiles.apellido}` : undefined,
  }));

  // ================= Alertas Críticas =================
  // Documentos vencidos, por vencer en <=30 días, o rechazados. Se arman a
  // partir de datos reales de documentos_personal — nunca inventados.
  const alertasCriticas: AlertaCriticaItem[] = documentos
    .filter((d) => {
      if (d.estado === 'rechazado') return true;
      if (!d.fecha_vencimiento) return false;
      return diasHasta(d.fecha_vencimiento) <= 30;
    })
    .map((d) => {
      const dias = d.fecha_vencimiento ? diasHasta(d.fecha_vencimiento) : null;
      let estadoAlerta: AlertaCriticaItem['estadoAlerta'];
      let diasTexto: string;
      let tipoColor: AlertaCriticaItem['tipoColor'];

      if (d.estado === 'rechazado') {
        estadoAlerta = 'Rechazado';
        diasTexto = 'Documento rechazado, requiere reenvío';
        tipoColor = 'error';
      } else if (dias !== null && dias < 0) {
        estadoAlerta = 'Vencido';
        diasTexto = `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`;
        tipoColor = 'error';
      } else {
        estadoAlerta = 'Vence pronto';
        diasTexto = `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
        tipoColor = 'warning';
      }

      return {
        id: d.id,
        agenteNombre: d.profiles ? `${d.profiles.nombre} ${d.profiles.apellido}` : 'Agente sin datos',
        sedeNombre: d.profiles?.sub_sedes?.nombre || 'Sede Central',
        cargo: d.profiles?.cargo || 'Agente',
        documentoTipo: d.tipos_documento?.nombre || 'Documento',
        estadoAlerta,
        diasTexto,
        tipoColor,
        profileId: d.profile_id,
        email: d.profiles?.email || '',
      };
    })
    .sort((a, b) => (a.estadoAlerta === 'Vencido' ? -1 : 1) - (b.estadoAlerta === 'Vencido' ? -1 : 1))
    .slice(0, 8);

  return {
    kpis,
    coberturaSubSedes,
    solicitudesRecientes,
    alertasCriticas,
    subSedes: subsedes,
    perfiles: perfiles as Profile[],
  };
}
