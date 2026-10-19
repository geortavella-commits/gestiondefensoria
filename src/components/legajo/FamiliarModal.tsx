import React, { useState, useEffect } from 'react';
import type { FamiliarPersonal, Parentesco } from '../../types/legajo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  familiar?: FamiliarPersonal | null;
  onSave: (datos: {
    nombre: string;
    apellido: string;
    dni?: string | null;
    parentesco: Parentesco;
  }) => Promise<void>;
}

export const FamiliarModal: React.FC<Props> = ({
  isOpen,
  onClose,
  familiar,
  onSave,
}) => {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [parentesco, setParentesco] = useState<Parentesco>('conyuge_conviviente');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (familiar) {
      setNombre(familiar.nombre || '');
      setApellido(familiar.apellido || '');
      setDni(familiar.dni || '');
      setParentesco(familiar.parentesco || 'conyuge_conviviente');
    } else {
      setNombre('');
      setApellido('');
      setDni('');
      setParentesco('conyuge_conviviente');
    }
    setError(null);
  }, [familiar, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim()) {
      setError('El nombre y el apellido son obligatorios.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim() || null,
        parentesco,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el familiar');
    } finally {
      setSaving(false);
    }
  };

  const esEdicion = !!familiar;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-container-lowest dark:bg-surface rounded-xl border border-outline-variant max-w-lg w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">
              {esEdicion ? 'edit' : 'person_add'}
            </span>
            <h2 className="text-headline-md font-headline-md text-primary">
              {esEdicion ? 'Editar Familiar' : 'Agregar Familiar'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-container text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-error-container text-on-error-container text-body-sm rounded-lg flex items-start gap-2">
            <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Nombre <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: María"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Apellido <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Ej: Pérez"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                DNI <span className="text-outline text-label-sm font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej: 38123456"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Parentesco <span className="text-error">*</span>
              </label>
              <select
                value={parentesco}
                onChange={(e) => setParentesco(e.target.value as Parentesco)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              >
                <option value="conyuge_conviviente">Cónyuge/Conviviente</option>
                <option value="hijo_a">Hijo/a</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/60">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-outline-variant text-primary hover:bg-surface-container text-label-md font-label-md rounded-lg transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary text-on-primary hover:opacity-95 text-label-md font-label-md rounded-lg flex items-center gap-1.5 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{esEdicion ? 'Guardar Cambios' : 'Agregar Familiar'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
