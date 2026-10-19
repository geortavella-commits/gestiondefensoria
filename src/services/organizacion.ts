import { supabase } from './supabaseClient';
import type { Area, SubSede } from '../types/legajo';

/**
 * Catálogo de áreas y sub-sedes activas. Ambas tablas tienen SELECT abierto
 * a cualquier usuario autenticado (son catálogos, no datos sensibles).
 */
export async function getAreasYSubSedes(): Promise<{ areas: Area[]; subSedes: SubSede[] }> {
  const [{ data: areas, error: errAreas }, { data: subSedes, error: errSubSedes }] = await Promise.all([
    supabase
      .from('areas')
      .select('id, nombre, descripcion, activo, es_coordinadora_subsedes, atiende_capacitaciones, recibe_notas_pedido, recibe_derivaciones_pedido')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
    supabase
      .from('sub_sedes')
      .select('id, nombre, direccion, localidad, telefono, activo')
      .eq('activo', true)
      .order('nombre', { ascending: true }),
  ]);

  if (errAreas) throw errAreas;
  if (errSubSedes) throw errSubSedes;

  return {
    areas: (areas || []) as Area[],
    subSedes: (subSedes || []) as SubSede[],
  };
}
