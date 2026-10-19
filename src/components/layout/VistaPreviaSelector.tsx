import React from 'react';
import type { Area, RolUsuario, SubSede } from '../../types/legajo';

export interface VistaPreviaEstado {
  rol: RolUsuario;
  areaId: string | null;
  subSedeId: string | null;
}

interface Props {
  areas: Area[];
  subSedes: SubSede[];
  activo: VistaPreviaEstado | null;
  onCambiar: (estado: VistaPreviaEstado | null) => void;
}

const ROLES: { value: RolUsuario; label: string }[] = [
  { value: 'jefe_area', label: 'Jefe de Área' },
  { value: 'referente_subsede', label: 'Referente de Sub-Sede' },
  { value: 'personal', label: 'Personal' },
];

/**
 * Simulador de rol para gestión: cambia qué secciones del menú y qué
 * permisos de pantalla (aprobar/rechazar, editar, etc.) se ven para un rol +
 * área/sub-sede elegidos, sin tocar la sesión real. Las consultas a Supabase
 * siguen corriendo con los permisos reales de quien está logueado — esto
 * solo previsualiza la interfaz, no reemplaza probar con una cuenta real.
 */
export const VistaPreviaSelector: React.FC<Props> = ({ areas, subSedes, activo, onCambiar }) => {
  const handleRolChange = (rol: string) => {
    if (!rol) {
      onCambiar(null);
      return;
    }
    onCambiar({ rol: rol as RolUsuario, areaId: null, subSedeId: null });
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-2 px-4 py-2 text-label-sm font-label-sm border-b ${
        activo
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-surface-container-low border-outline-variant/60 text-on-surface-variant'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">visibility</span>
      <span className="font-bold">Vista previa de rol:</span>

      <select
        value={activo?.rol ?? ''}
        onChange={(e) => handleRolChange(e.target.value)}
        className="px-2 py-1 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-label-sm"
      >
        <option value="">Mi vista real (Gestión)</option>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {activo?.rol === 'jefe_area' && (
        <select
          value={activo.areaId ?? ''}
          onChange={(e) => onCambiar({ ...activo, areaId: e.target.value || null })}
          className="px-2 py-1 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-label-sm"
        >
          <option value="">Elegí un área...</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      )}

      {activo?.rol === 'referente_subsede' && (
        <select
          value={activo.subSedeId ?? ''}
          onChange={(e) => onCambiar({ ...activo, subSedeId: e.target.value || null })}
          className="px-2 py-1 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-label-sm"
        >
          <option value="">Elegí una sub-sede...</option>
          {subSedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      )}

      {activo && (
        <>
          <span className="text-amber-800">
            Viendo la app como la vería ese rol. Las acciones reales igual corren con tus permisos de gestión.
          </span>
          <button
            onClick={() => onCambiar(null)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-200 text-amber-900 font-bold hover:bg-amber-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Salir de vista previa
          </button>
        </>
      )}
    </div>
  );
};
