import { supabase } from './supabaseClient';
import type { Profile, SubSede, Area, RolUsuario, EstadoUsuario } from '../types/legajo';

export interface UsuariosFilter {
  search?: string;
  estado?: string;
  rol?: string;
  subSedeId?: string;
}

export interface UsuariosStats {
  total: number;
  activos: number;
  inactivos: number;
  gestion: number;
}

/**
 * Obtiene la lista completa de perfiles con sus sub-sedes y áreas para el panel de administración
 */
export async function getUsuariosAdmin(filters?: UsuariosFilter): Promise<{
  usuarios: Profile[];
  subSedes: SubSede[];
  areas: Area[];
  stats: UsuariosStats;
}> {
  // 1. Obtener subsedes y áreas para los selectores
  const [{ data: subSedes }, { data: areas }, { data: todosPerfiles }] = await Promise.all([
    supabase.from('sub_sedes').select('*').order('nombre', { ascending: true }),
    supabase.from('areas').select('*').order('nombre', { ascending: true }),
    supabase
      .from('profiles')
      .select(`
        *,
        sub_sedes:sub_sede_id ( id, nombre, localidad ),
        areas:area_id ( id, nombre )
      `)
      .order('apellido', { ascending: true }),
  ]);

  const perfiles = (todosPerfiles || []) as Profile[];

  // 2. Calcular KPIs
  const stats: UsuariosStats = {
    total: perfiles.length,
    activos: perfiles.filter((p) => p.estado === 'activo').length,
    inactivos: perfiles.filter((p) => p.estado !== 'activo').length,
    gestion: perfiles.filter(
      (p) => p.rol === 'coordinacion_general' || p.rol === 'administrador'
    ).length,
  };

  // 3. Filtrar en cliente
  let filtrados = perfiles;

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtrados = filtrados.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.apellido.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.dni && p.dni.includes(q)) ||
        (p.legajo && p.legajo.toLowerCase().includes(q))
    );
  }

  if (filters?.estado) {
    filtrados = filtrados.filter((p) => p.estado === filters.estado);
  }

  if (filters?.rol) {
    filtrados = filtrados.filter((p) => p.rol === filters.rol);
  }

  if (filters?.subSedeId) {
    filtrados = filtrados.filter((p) => p.sub_sede_id === filters.subSedeId);
  }

  return {
    usuarios: filtrados,
    subSedes: (subSedes || []) as SubSede[],
    areas: (areas || []) as Area[],
    stats,
  };
}

/**
 * Actualiza rol, subsede, estado y datos de seguridad de un usuario
 */
export async function updateUsuarioAdmin(
  profileId: string,
  datos: {
    rol?: RolUsuario;
    estado?: EstadoUsuario;
    sub_sede_id?: string | null;
    area_id?: string | null;
    cargo?: string | null;
    dias_vacaciones_anuales?: number | null;
  }
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...datos,
      updated_at: new Date().toISOString(),
    })
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
 * Envía un correo de reseteo de contraseña al usuario
 */
export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
