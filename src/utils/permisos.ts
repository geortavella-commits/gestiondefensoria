import type { RolUsuario } from '../types/legajo';
import type { MainNavSection } from '../components/layout/Sidebar';

/**
 * Qué secciones del menú puede ver cada rol. Punto único de verdad: antes de
 * esto, el Sidebar mostraba las 9 secciones a cualquier rol (incluido
 * "Configuración", que da de alta usuarios) sin ningún filtro.
 * Gestión (coordinacion_general, administrador) ve todo. El resto es un
 * punto de partida razonable — se ajusta acá, no repartido por archivo.
 */
// "capacitaciones" se oculta a propósito (a pedido, temporal) en las 5
// listas de abajo — no se borró el módulo, solo nadie lo ve en el Sidebar.
// Para reactivarlo: agregar 'capacitaciones' de nuevo a cada array.
const SECCIONES_POR_ROL: Record<RolUsuario, MainNavSection[]> = {
  coordinacion_general: [
    'tablero', 'personal', 'subsedes', 'actividades', 'notas',
    'vacaciones', 'documentacion', 'reportes', 'configuracion',
  ],
  administrador: [
    'tablero', 'personal', 'subsedes', 'actividades', 'notas',
    'vacaciones', 'documentacion', 'reportes', 'configuracion',
  ],
  jefe_area: ['tablero', 'personal', 'actividades', 'notas', 'vacaciones', 'documentacion'],
  referente_subsede: ['tablero', 'personal', 'subsedes', 'actividades', 'notas', 'vacaciones', 'documentacion'],
  personal: ['personal', 'actividades', 'notas', 'vacaciones'],
};

export function seccionesVisibles(rol: RolUsuario): MainNavSection[] {
  return SECCIONES_POR_ROL[rol] ?? SECCIONES_POR_ROL.personal;
}

export function seccionPorDefecto(rol: RolUsuario): MainNavSection {
  const visibles = seccionesVisibles(rol);
  return visibles.includes('tablero') ? 'tablero' : visibles[0];
}
