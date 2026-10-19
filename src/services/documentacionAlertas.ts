import { supabase } from './supabaseClient';
import { calcularEstadoDocumento } from '../utils/legajoCalculations';
import type { DocumentoPersonal, TipoDocumento } from '../types/legajo';

export type EstadoAlertaDocumento = 'vencido' | 'por_vencer' | 'cargado' | 'rechazado';

export interface AlertaDocumentoItem {
  id: string; // id del documento (documentos_personal.id)
  profileId: string;
  agenteNombre: string;
  cargo: string;
  areaNombre: string | null;
  subSedeNombre: string | null;
  documentoTipo: string;
  estadoAlerta: EstadoAlertaDocumento;
  diasDiferencia: number | null;
  badgeTexto: string;
  fechaVencimiento: string | null;
  comentarios: string | null; // motivo, cuando estadoAlerta = 'rechazado'
}

export interface DocumentacionAlertasData {
  enRevision: AlertaDocumentoItem[];
  vencidos: AlertaDocumentoItem[];
  porVencer: AlertaDocumentoItem[];
  rechazados: AlertaDocumentoItem[];
}

/**
 * Trae, de una sola pasada, todos los documentos cargados que necesitan
 * atención (en revisión, vencidos, por vencer o rechazados) de todo el
 * personal visible para quien consulta. El recorte por área/sub-sede lo hace
 * la policy `documentos_select` en la base (gestión ve todo, jefe de área
 * las suyas, referente de sub-sede la suya) — acá no se repite esa lógica.
 */
export async function getDocumentacionAlertas(): Promise<DocumentacionAlertasData> {
  const { data, error } = await supabase
    .from('documentos_personal')
    .select(`
      *,
      tipos_documento (*),
      profiles:profile_id (
        id, nombre, apellido, cargo,
        areas:area_id ( nombre ),
        sub_sedes:sub_sede_id ( nombre )
      )
    `)
    .not('archivo_path', 'is', null);

  if (error) throw error;

  const resultado: DocumentacionAlertasData = {
    enRevision: [],
    vencidos: [],
    porVencer: [],
    rechazados: [],
  };

  for (const row of (data || []) as any[]) {
    const tipo = row.tipos_documento as TipoDocumento;
    const doc = row as DocumentoPersonal;
    if (!tipo) continue;

    const derivado = calcularEstadoDocumento(tipo, doc);
    if (
      derivado.estadoDerivado !== 'vencido' &&
      derivado.estadoDerivado !== 'por_vencer' &&
      derivado.estadoDerivado !== 'cargado' &&
      derivado.estadoDerivado !== 'rechazado'
    ) {
      continue; // 'aprobado' y 'pendiente' no son alertas
    }

    const perfil = row.profiles;
    const item: AlertaDocumentoItem = {
      id: doc.id,
      profileId: perfil?.id ?? row.profile_id,
      agenteNombre: perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Agente desconocido',
      cargo: perfil?.cargo || 'Sin cargo asignado',
      areaNombre: perfil?.areas?.nombre ?? null,
      subSedeNombre: perfil?.sub_sedes?.nombre ?? null,
      documentoTipo: tipo.nombre,
      estadoAlerta: derivado.estadoDerivado,
      diasDiferencia: derivado.diasDiferencia,
      badgeTexto: derivado.badgeTexto,
      fechaVencimiento: doc.fecha_vencimiento,
      comentarios: doc.comentarios,
    };

    if (derivado.estadoDerivado === 'vencido') resultado.vencidos.push(item);
    else if (derivado.estadoDerivado === 'por_vencer') resultado.porVencer.push(item);
    else if (derivado.estadoDerivado === 'cargado') resultado.enRevision.push(item);
    else resultado.rechazados.push(item);
  }

  return resultado;
}
