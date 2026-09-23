import React, { useState } from 'react';
import type { Profile, RolUsuario, EstadoUsuario } from '../../types/legajo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  perfil: Profile;
  esGestion: boolean;
  onSave: (datosActualizados: Partial<Profile>) => Promise<void>;
}

export const EditarPerfilModal: React.FC<Props> = ({
  isOpen,
  onClose,
  perfil,
  esGestion,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    nombre: perfil.nombre || '',
    apellido: perfil.apellido || '',
    email: perfil.email || '',
    telefono: perfil.telefono || '',
    cargo: perfil.cargo || '',
    observaciones_legajo: perfil.observaciones_legajo || '',
    dni: perfil.dni || '',
    legajo: perfil.legajo || '',
    rol: perfil.rol,
    estado: perfil.estado,
    fecha_ingreso: perfil.fecha_ingreso || '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest dark:bg-surface rounded-xl border border-outline-variant max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
          <h2 className="text-headline-md font-headline-md text-primary">
            Editar Datos del Agente
          </h2>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-error-container text-on-error-container text-body-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Nombre
              </label>
              <input
                type="text"
                required
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Apellido
              </label>
              <input
                type="text"
                required
                value={formData.apellido}
                onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Cargo / Función Territorial
            </label>
            <input
              type="text"
              value={formData.cargo}
              onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              placeholder="Ej: Lic. en Trabajo Social - Equipo Técnico"
            />
          </div>

          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Observaciones del Legajo
            </label>
            <textarea
              rows={3}
              value={formData.observaciones_legajo}
              onChange={(e) => setFormData({ ...formData, observaciones_legajo: e.target.value })}
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
            />
          </div>

          {/* CAMPOS SENSIBLES: Visibles ÚNICAMENTE si es rol de gestión */}
          {esGestion && (
            <div className="p-4 bg-surface-container rounded-lg space-y-4 border border-outline-variant/40 mt-6">
              <h3 className="text-label-lg font-label-lg text-primary flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
                Gestión Institucional (Privilegiado)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1">DNI</label>
                  <input
                    type="text"
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm"
                  />
                </div>
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1">Legajo N°</label>
                  <input
                    type="text"
                    value={formData.legajo}
                    onChange={(e) => setFormData({ ...formData, legajo: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm"
                  />
                </div>
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    value={formData.fecha_ingreso}
                    onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1">Rol de Usuario</label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as RolUsuario })}
                    className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm"
                  >
                    <option value="personal">Personal</option>
                    <option value="referente_subsede">Referente Sub-Sede</option>
                    <option value="jefe_area">Jefe de Área</option>
                    <option value="administrador">Administrador</option>
                    <option value="coordinacion_general">Coordinación General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1">Estado</label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as EstadoUsuario })}
                    className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="licencia">Licencia</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-outline-variant text-primary text-label-md hover:bg-surface-container"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-label-md hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
