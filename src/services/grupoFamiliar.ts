import { supabase } from './supabaseClient';
import type { FamiliarPersonal, Parentesco } from '../types/legajo';

const BUCKET = 'documentos-familiares';

/**
 * Lista el grupo familiar de un agente. RLS (`grupo_familiar_select`) ya
 * filtra: el propio dueño del legajo, gestión, o el área Administración.
 */
export async function getGrupoFamiliar(profileId: string): Promise<FamiliarPersonal[]> {
  const { data, error } = await supabase
    .from('grupo_familiar')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as FamiliarPersonal[];
}

export async function agregarFamiliar(datos: {
  profileId: string;
  nombre: string;
  apellido: string;
  dni?: string | null;
  parentesco: Parentesco;
}): Promise<FamiliarPersonal> {
  const { data, error } = await supabase
    .from('grupo_familiar')
    .insert({
      profile_id: datos.profileId,
      nombre: datos.nombre.trim(),
      apellido: datos.apellido.trim(),
      dni: datos.dni?.trim() || null,
      parentesco: datos.parentesco,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as FamiliarPersonal;
}

export async function actualizarFamiliar(
  id: string,
  datos: { nombre?: string; apellido?: string; dni?: string | null; parentesco?: Parentesco }
): Promise<FamiliarPersonal> {
  const payload: Record<string, any> = {};
  if (datos.nombre !== undefined) payload.nombre = datos.nombre.trim();
  if (datos.apellido !== undefined) payload.apellido = datos.apellido.trim();
  if (datos.dni !== undefined) payload.dni = datos.dni?.trim() || null;
  if (datos.parentesco !== undefined) payload.parentesco = datos.parentesco;

  const { data, error } = await supabase
    .from('grupo_familiar')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as FamiliarPersonal;
}

export async function eliminarFamiliar(id: string): Promise<void> {
  const { error } = await supabase.from('grupo_familiar').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Sube la foto del DNI (frente o dorso) de un familiar al bucket privado
 * `documentos-familiares` y guarda el path en la fila correspondiente.
 * Separado de `documentos-personal` a propósito: jefe de área/referente de
 * sub-sede no deben poder ver estas fotos, y comparten bucket solo si
 * comparten policies.
 */
export async function subirFotoDniFamiliar(
  profileId: string,
  familiarId: string,
  lado: 'frente' | 'dorso',
  file: File
): Promise<FamiliarPersonal> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${profileId}/${familiarId}_${lado}_${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { upsert: true });
  if (uploadError) {
    throw new Error(`No se pudo subir la foto del DNI: ${uploadError.message}`);
  }

  const columna = lado === 'frente' ? 'foto_dni_frente_path' : 'foto_dni_dorso_path';
  const { data, error } = await supabase
    .from('grupo_familiar')
    .update({ [columna]: filePath })
    .eq('id', familiarId)
    .select('*')
    .single();

  if (error) throw error;
  return data as FamiliarPersonal;
}

/**
 * URL firmada de corta duración para ver la foto del DNI de un familiar.
 */
export async function getSignedUrlFotoFamiliar(path: string, expiresInSeconds = 60): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
