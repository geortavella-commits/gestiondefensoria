import React, { useState } from 'react';
import { crearSolicitudCapacitacion } from '../../services/capacitaciones';
import type { SubSede } from '../../types/legajo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subSedes: SubSede[];
  currentUserId: string;
  onSolicitudCreated: () => void;
}

export const CrearSolicitudModal: React.FC<Props> = ({
  isOpen,
  onClose,
  subSedes,
  currentUserId,
  onSolicitudCreated,
}) => {
  const [tema, setTema] = useState('');
  const [subSedeId, setSubSedeId] = useState(subSedes[0]?.id || '');
  const [descripcion, setDescripcion] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [cantidadParticipantes, setCantidadParticipantes] = useState<number>(30);
  const [fechaPropuesta, setFechaPropuesta] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await crearSolicitudCapacitacion({
        tema,
        sub_sede_id: subSedeId,
        solicitado_por: currentUserId,
        descripcion,
        justificacion,
        cantidad_participantes: cantidadParticipantes,
        fecha_propuesta: fechaPropuesta || undefined,
      });

      onSolicitudCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest dark:bg-surface rounded-xl border border-outline-variant max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">school</span>
            <h2 className="text-headline-md font-headline-md text-primary">
              Nueva Solicitud de Capacitación Territorial
            </h2>
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
              Tema / Título de la Capacitación <span className="text-error">*</span>
            </label>
            <input
              type="text"
              required
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Ej. Protocolo de Actuación Judicial en Niñez y Abuso Sexual Digital"
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Sub-Sede Solicitante <span className="text-error">*</span>
              </label>
              <select
                required
                value={subSedeId}
                onChange={(e) => setSubSedeId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              >
                {subSedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.localidad || 'Territorio'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Cupo Estimado
              </label>
              <input
                type="number"
                min="5"
                max="200"
                value={cantidadParticipantes}
                onChange={(e) => setCantidadParticipantes(Number(e.target.value))}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Fecha Propuesta
              </label>
              <input
                type="date"
                value={fechaPropuesta}
                onChange={(e) => setFechaPropuesta(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Descripción de la Demanda
            </label>
            <textarea
              rows={2}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describa el contexto o la necesidad del equipo en territorio..."
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
            />
          </div>

          <div>
            <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
              Justificación e Impacto Territorial
            </label>
            <textarea
              rows={3}
              value={justificacion}
              onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Fundamente la relevancia de la capacitación bajo la Ley 26.061..."
              className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
            />
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
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
