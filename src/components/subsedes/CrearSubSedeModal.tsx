import React, { useState } from 'react';
import { crearSubSede } from '../../services/subsedes';
import type { Profile } from '../../types/legajo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  referentesDisponibles: Profile[];
  onSubSedeCreated: () => void;
}

export const CrearSubSedeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  referentesDisponibles,
  onSubSedeCreated,
}) => {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [telefono, setTelefono] = useState('');
  const [referenteId, setReferenteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await crearSubSede({
        nombre,
        direccion,
        localidad,
        telefono,
        referente_id: referenteId || null,
      });

      onSubSedeCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear la sub-sede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest dark:bg-surface rounded-xl border border-outline-variant max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">add_business</span>
            <h2 className="text-headline-md font-headline-md text-primary">Registrar Nueva Sub-Sede</h2>
          </div>
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
          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Nombre de la Sub-Sede / Delegación <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Sub-Sede Litoral (Rosario / Santa Fe)"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Dirección Física
              </label>
              <input
                type="text"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Ej. Urquiza 932"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Localidad / Provincia
              </label>
              <input
                type="text"
                value={localidad}
                onChange={(e) => setLocalidad(e.target.value)}
                placeholder="Ej. Santa Fe / Rosario"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej. (0342) 457-8890"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Referente a Cargo
              </label>
              <select
                value={referenteId}
                onChange={(e) => setReferenteId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              >
                <option value="">Seleccionar de personal registrado...</option>
                {referentesDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.apellido}, {p.nombre} ({p.cargo || 'Agente'})
                  </option>
                ))}
              </select>
            </div>
          </div>

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
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-label-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Guardando...' : 'Habilitar Delegación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
