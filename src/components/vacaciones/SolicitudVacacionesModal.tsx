import React, { useState, useEffect } from 'react';
import {
  crearSolicitudVacaciones,
  estimarDiasHabiles,
  type Feriado,
} from '../../services/vacaciones';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  feriados: Feriado[];
  profileId?: string;
  nombreAgente?: string;
}

export const SolicitudVacacionesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  feriados,
  profileId,
  nombreAgente,
}) => {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [comentario, setComentario] = useState('');
  const [estimacionDias, setEstimacionDias] = useState<number>(0);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFechaDesde('');
      setFechaHasta('');
      setComentario('');
      setEstimacionDias(0);
      setErrorServidor(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (fechaDesde && fechaHasta) {
      if (fechaHasta < fechaDesde) {
        setEstimacionDias(0);
      } else {
        const dias = estimarDiasHabiles(fechaDesde, fechaHasta, feriados);
        setEstimacionDias(dias);
      }
    } else {
      setEstimacionDias(0);
    }
  }, [fechaDesde, fechaHasta, feriados]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaDesde || !fechaHasta) {
      setErrorServidor('Por favor completá la fecha de inicio y de fin.');
      return;
    }

    if (fechaHasta < fechaDesde) {
      setErrorServidor('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    try {
      setGuardando(true);
      setErrorServidor(null);
      await crearSolicitudVacaciones({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        comentario: comentario.trim() || undefined,
        profileId: profileId || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      // Mostrar el mensaje de error del servidor tal cual (ej: validación de saldo o triggers)
      setErrorServidor(err.message || 'Error al enviar la solicitud de vacaciones.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-lg w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined text-2xl text-secondary">beach_access</span>
            <h2 className="text-headline-sm font-bold tracking-tight">
              {nombreAgente ? `Registrar vacaciones de ${nombreAgente}` : 'Nueva Solicitud de Vacaciones'}
            </h2>
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

        {/* Alerta de Error del Servidor */}
        {errorServidor && (
          <div className="bg-error-container text-on-error-container p-3 rounded-xl border border-error text-body-sm flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0 mt-0.5">
              error
            </span>
            <div className="flex-1 font-medium">{errorServidor}</div>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-space-md">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Fecha Desde <span className="text-error">*</span>
              </label>
              <input
                type="date"
                required
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-container/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Fecha Hasta <span className="text-error">*</span>
              </label>
              <input
                type="date"
                required
                min={fechaDesde || undefined}
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-container/30 transition-all"
              />
            </div>
          </div>

          {/* Previsualización aproximada de días hábiles */}
          {fechaDesde && fechaHasta && fechaHasta >= fechaDesde && (
            <div className="p-3 bg-secondary-container/30 border border-secondary/20 rounded-xl text-body-sm flex flex-col gap-1">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <span className="material-symbols-outlined text-[20px] text-secondary">calculate</span>
                <span>Estimación: ~{estimacionDias} {estimacionDias === 1 ? 'día hábil' : 'días hábiles'}</span>
              </div>
              <p className="text-label-sm text-on-surface-variant italic">
                * Estimación aproximada descontando fines de semana y feriados. El cómputo oficial y definitivo lo determina el servidor al registrar la solicitud.
              </p>
            </div>
          )}

          {/* Comentario / Motivo */}
          <div>
            <label className="block text-label-md font-semibold text-primary mb-1">
              Comentario / Observaciones <span className="text-label-sm font-normal text-outline">(opcional)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Detalle o motivo adicional que desees informar..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-container/30 transition-all placeholder:text-outline"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !fechaDesde || !fechaHasta}
              className="px-5 h-10 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">
                    {profileId ? 'how_to_reg' : 'send'}
                  </span>
                  <span>{profileId ? 'Registrar Vacación' : 'Enviar Solicitud'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
