import { supabase } from './supabaseClient';
import type {
  Profile,
  TipoDocumento,
  DocumentoPersonal,
  CapacitacionAgente,
  RolUsuario,
} from '../types/legajo';

/**
 * Obtiene el perfil completo del agente con joins a sub_sedes y areas
 */
export async function getPerfilAgente(profileId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      sub_sedes:sub_sede_id ( id, nombre, direccion, localidad, telefono, activo ),
      areas:area_id ( id, nombre, descripcion, activo, es_coordinadora_subsedes, atiende_capacitaciones, recibe_notas_pedido )
    `)
    .eq('id', profileId)
    .single();

  if (error) throw error;
  return data as unknown as Profile;
}

/**
 * Obtiene la lista de todos los perfiles para el selector de agentes (en modo demo/gestión)
 */
export async function getListaPerfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      nombre,
      apellido,
      dni,
      legajo,
      cargo,
      email,
      telefono,
      avatar_url,
      fecha_ingreso,
      estado,
      observaciones_legajo,
      perfil_completo,
      rol,
      area_id,
      sub_sede_id,
      created_at,
      updated_at,
      sub_sedes:sub_sede_id ( id, nombre, localidad ),
      areas:area_id ( id, nombre, es_coordinadora_subsedes, atiende_capacitaciones, recibe_notas_pedido )
    `)
    .order('apellido', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as Profile[];
}

/**
 * Obtiene el catálogo de tipos de documento y los documentos cargados por el agente
 */
export async function getDocumentosAgente(profileId: string): Promise<{
  tipos: TipoDocumento[];
  documentos: DocumentoPersonal[];
}> {
  const { data: tipos, error: errTipos } = await supabase
    .from('tipos_documento')
    .select('*')
    .eq('activo', true)
    .order('obligatorio', { ascending: false });

  if (errTipos) throw errTipos;

  const { data: documentos, error: errDocs } = await supabase
    .from('documentos_personal')
    .select('*, tipos_documento (*)')
    .eq('profile_id', profileId);

  if (errDocs) throw errDocs;

  return {
    tipos: (tipos || []) as TipoDocumento[],
    documentos: (documentos || []) as DocumentoPersonal[],
  };
}

/**
 * Obtiene el historial de capacitaciones del agente
 */
export async function getHistorialCapacitaciones(profileId: string): Promise<CapacitacionAgente[]> {
  const { data, error } = await supabase
    .from('asistentes_capacitacion')
    .select(`
      id,
      asistio,
      certificado_url,
      codigo_acreditacion,
      capacitaciones_realizadas:capacitacion_id (
        id,
        nombre,
        fecha,
        modalidad,
        capacitador,
        entidad_dictante,
        carga_horaria
      )
    `)
    .eq('profile_id', profileId);

  if (error) throw error;

  return (data || [])
    .filter((row: any) => row.capacitaciones_realizadas)
    .map((row: any) => ({
      capacitacion_id: row.capacitaciones_realizadas.id,
      nombre: row.capacitaciones_realizadas.nombre,
      fecha: row.capacitaciones_realizadas.fecha,
      modalidad: row.capacitaciones_realizadas.modalidad,
      capacitador: row.capacitaciones_realizadas.capacitador,
      entidad_dictante: row.capacitaciones_realizadas.entidad_dictante,
      carga_horaria: row.capacitaciones_realizadas.carga_horaria,
      asistio: row.asistio ?? false,
      certificado_url: row.certificado_url,
      codigo_acreditacion: row.codigo_acreditacion,
    }));
}

/**
 * Actualiza los datos del agente.
 * Si no es usuario de gestión, no envía campos sensibles bloqueados por el trigger.
 */
export async function updatePerfilAgente(
  profileId: string,
  datos: Partial<Profile>,
  esGestion: boolean
): Promise<Profile> {
  const payload: Record<string, any> = {
    nombre: datos.nombre,
    apellido: datos.apellido,
    telefono: datos.telefono,
    email: datos.email,
    cargo: datos.cargo,
    observaciones_legajo: datos.observaciones_legajo,
  };

  if (esGestion) {
    if (datos.rol !== undefined) payload.rol = datos.rol;
    if (datos.area_id !== undefined) payload.area_id = datos.area_id;
    if (datos.sub_sede_id !== undefined) payload.sub_sede_id = datos.sub_sede_id;
    if (datos.estado !== undefined) payload.estado = datos.estado;
    if (datos.legajo !== undefined) payload.legajo = datos.legajo;
    if (datos.dni !== undefined) payload.dni = datos.dni;
    if (datos.fecha_ingreso !== undefined) payload.fecha_ingreso = datos.fecha_ingreso;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
    .select(`
      *,
      sub_sedes:sub_sede_id ( id, nombre, localidad ),
      areas:area_id ( id, nombre )
    `)
    .single();

  if (error) throw error;
  return data as Profile;
}

/**
 * Sube o reemplaza un archivo de documento en Supabase Storage y actualiza documentos_personal.
 * El bucket "documentos-personal" es privado: guardamos el path, no una URL pública.
 * Si la subida falla (bucket inexistente, sin permiso, etc.) se corta acá y no se
 * guarda un registro "cargado" fantasma sin archivo real detrás.
 */
export async function uploadDocumentoPersonal(
  profileId: string,
  tipoDocumentoId: string,
  file: File,
  fechaVencimiento?: string | null
): Promise<DocumentoPersonal> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${profileId}/${tipoDocumentoId}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('documentos-personal')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from('documentos_personal')
    .upsert(
      {
        profile_id: profileId,
        tipo_documento_id: tipoDocumentoId,
        archivo_path: filePath,
        archivo_nombre: file.name,
        fecha_carga: new Date().toISOString(),
        fecha_vencimiento: fechaVencimiento || null,
        estado: 'cargado',
      },
      {
        onConflict: 'profile_id,tipo_documento_id',
      }
    )
    .select('*, tipos_documento (*)')
    .single();

  if (error) throw error;
  return data as DocumentoPersonal;
}

/**
 * Genera una URL firmada de corta duración para ver/descargar un documento privado.
 * No se guarda: se pide de nuevo cada vez que el usuario quiere abrir el archivo.
 */
export async function getSignedUrlDocumento(archivoPath: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documentos-personal')
    .createSignedUrl(archivoPath, expiresInSeconds);

  if (error) throw error;
  return data.signedUrl;
}

export function esRolGestion(rol?: RolUsuario | null): boolean {
  return rol === 'coordinacion_general' || rol === 'administrador';
}

/**
 * Aprueba o rechaza un documento cargado. Quién puede hacerlo lo decide la
 * policy `documentos_update` en la base (gestión, jefe del área del agente o
 * referente de su sub-sede) — acá no se repite esa lógica, si no tenés
 * permiso el UPDATE no afecta filas y se corta con error.
 */
export async function validarDocumento(
  documentoId: string,
  revisorId: string,
  nuevoEstado: 'aprobado' | 'rechazado',
  comentarios?: string | null
): Promise<DocumentoPersonal> {
  const { data, error } = await supabase
    .from('documentos_personal')
    .update({
      estado: nuevoEstado,
      revisado_por: revisorId,
      fecha_revision: new Date().toISOString(),
      comentarios: comentarios || null,
    })
    .eq('id', documentoId)
    .select('*, tipos_documento (*)')
    .single();

  if (error) throw error;
  return data as DocumentoPersonal;
}
