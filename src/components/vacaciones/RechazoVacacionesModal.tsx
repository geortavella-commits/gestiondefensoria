import React, { useState, useEffect } from 'react';
import { rechazarSolicitud, type VacacionSolicitud } from '../../services/vacaciones';
import { formatearFecha } from '../../utils/legajoCalculations';

interface Props {
  solicitud: VacacionSolicitud | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RechazoVacacionesModal: React.FC<Props> = ({
  solicitud,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMotivo('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !solicitud) return null;

  const handleRechazar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setError('El motivo de rechazo es obligatorio según las reglas institucionales.');
      return;
    }

    try {
      setGuardando(true);
      setError(null);
      await rechazarSolicitud(solicitud.id, motivo);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo registrar el rechazo de la solicitud.');
    } finally {
      setGuardando(false);
    }
  };

  const nombreSolicitante = solicitud.solicitante
    ? `${solicitud.solicitante.nombre} ${solicitud.solicitante.apellido}`
    : 'Agente';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
          <div className="flex items-center gap-2 text-error">
            <span className="material-symbols-outlined text-2xl">cancel</span>
            <h2 className="text-headline-sm font-bold tracking-tight">Rechazar Solicitud</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Resumen de solicitud */}
        <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-body-sm flex flex-col gap-1">
          <div className="font-semibold text-primary">Solicitante: {nombreSolicitante}</div>
          <div className="text-on-surface-variant">
            Período: {formatearFecha(solicitud.fecha_desde)} al {formatearFecha(solicitud.fecha_hasta)}
          </div>
          {solicitud.dias_habiles != null && (
            <div className="text-secondary font-medium">
              Días solicitados: {solicitud.dias_habiles} {solicitud.dias_habiles === 1 ? 'día hábil' : 'días hábiles'}
            </div>
          )}
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="bg-error-container text-on-error-container p-3 rounded-xl border border-error text-body-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleRechazar} className="flex flex-col gap-space-md">
          <div>
            <label className="block text-label-md font-semibold text-primary mb-1">
              Motivo o Fundamento del Rechazo <span className="text-error">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Explicá las razones institucionales u operativas del rechazo (obligatorio)..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-error focus:ring-2 focus:ring-error/20 transition-all placeholder:text-outline"
            />
            <p className="text-label-sm text-outline mt-1">
              Este motivo será visible para el solicitante y habilitará el derecho de arrastre de saldo no usado para el siguiente ciclo.
            </p>
          </div>

          {/* Acciones */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={guardando || !motivo.trim()}
              className="px-5 h-10 bg-error text-on-error font-label-md rounded-xl hover:bg-error/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">block</span>
                  <span>Confirmar Rechazo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
