import React, { useState } from 'react';
import {
  derivarSolicitud,
  aprobarPorArea,
  cerrarConFormulario,
  marcarFormularioEnviado,
  postergarSolicitud,
  suspenderSolicitud,
  reactivarSolicitud,
  cancelarSolicitud,
  type SolicitudCapacitacion,
} from '../../services/capacitaciones';
import { formatearFecha } from '../../utils/legajoCalculations';
import { esRolGestion } from '../../services/legajo';
import type { Area, Profile } from '../../types/legajo';

interface Props {
  solicitud: SolicitudCapacitacion;
  areas: Area[];
  perfilActual?: Profile | null;
  onActualizada: (s: SolicitudCapacitacion) => void;
}

type StepStatus = 'done' | 'current' | 'pending' | 'paused';

interface Step {
  n: number;
  titulo: string;
  actor: string;
  detalle?: string;
  status: StepStatus;
}

function calcularPasos(s: SolicitudCapacitacion): Step[] {
  const pausada = ['postergada', 'suspendida', 'cancelada'].includes(s.estado);

  // Etapa actual (1-5). Si está pausada, se deduce por lo que ya se completó.
  let actual: number;
  if (pausada) {
    if (!s.coordinacion_revision_fecha) actual = 2;
    else if (!s.area_revision_fecha) actual = 3;
    else if (!s.fecha_revision) actual = 4;
    else actual = 5;
  } else if (s.estado === 'enviada' || s.estado === 'en_coordinacion') actual = 2;
  else if (s.estado === 'derivada_area') actual = 3;
  else if (s.estado === 'aprobada_area') actual = 4;
  else actual = s.form_enviado_at ? 6 : 5;

  const statusDe = (n: number): StepStatus => {
    if (n < actual) return 'done';
    if (n === actual) return pausada ? 'paused' : 'current';
    return 'pending';
  };

  const areaNombre = s.area_asignada?.nombre || 'Área derivada';

  return [
    {
      n: 1,
      titulo: 'Solicitud enviada',
      actor: s.sub_sedes?.nombre || s.area_solicitante?.nombre || 'Solicitante',
      detalle: formatearFecha(s.created_at),
      status: 'done',
    },
    {
      n: 2,
      titulo: 'Coordinación de Subsedes',
      actor: 'Aprueba y deriva',
      detalle: s.coordinacion_revision_fecha ? `Derivada a ${areaNombre} · ${formatearFecha(s.coordinacion_revision_fecha)}` : undefined,
      status: statusDe(2),
    },
    {
      n: 3,
      titulo: s.area_asignada ? `Área de ${s.area_asignada.nombre}` : 'Área de Prensa / Protección',
      actor: 'Evalúa y aprueba',
      detalle: s.area_revision_fecha ? formatearFecha(s.area_revision_fecha) : undefined,
      status: statusDe(3),
    },
    {
      n: 4,
      titulo: 'Coordinación de Subsedes',
      actor: 'Carga el link del formulario',
      detalle: s.fecha_revision ? formatearFecha(s.fecha_revision) : undefined,
      status: statusDe(4),
    },
    {
      n: 5,
      titulo: 'Sub-sede envía el formulario',
      actor: 'Al solicitante original',
      detalle: s.form_enviado_at ? formatearFecha(s.form_enviado_at) : undefined,
      status: actual === 6 ? 'done' : statusDe(5),
    },
  ];
}

const ESTILO_PASO: Record<StepStatus, string> = {
  done: 'bg-secondary text-on-secondary',
  current: 'bg-primary text-on-primary ring-4 ring-secondary-container/40',
  pending: 'bg-surface-container text-on-surface-variant',
  paused: 'bg-amber-400 text-on-surface',
};

export const SolicitudDetalle: React.FC<Props> = ({ solicitud: s, areas, perfilActual, onActualizada }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [areaDerivar, setAreaDerivar] = useState('');
  const [comentario, setComentario] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [modoPausa, setModoPausa] = useState<'postergar' | 'suspender' | null>(null);
  const [copiado, setCopiado] = useState(false);

  const esGestion = esRolGestion(perfilActual?.rol);
  const esCoordinador =
    esGestion ||
    (!!perfilActual?.area_id && areas.some((a) => a.id === perfilActual.area_id && a.es_coordinadora_subsedes));
  const esAreaAsignada = !!s.area_asignada_id && s.area_asignada_id === perfilActual?.area_id;
  const esSolicitante =
    s.solicitado_por === perfilActual?.id || (!!s.sub_sede_id && s.sub_sede_id === perfilActual?.sub_sede_id);

  const areasDerivables = areas.filter((a) => a.atiende_capacitaciones);
  const pasos = calcularPasos(s);
  const pausada = ['postergada', 'suspendida', 'cancelada'].includes(s.estado);
  const puedePausar =
    !pausada && s.estado !== 'cancelada' && (esCoordinador || (esAreaAsignada && s.estado !== 'enviada'));

  const ejecutar = async (fn: () => Promise<SolicitudCapacitacion>) => {
    try {
      setBusy(true);
      setError(null);
      const actualizada = await fn();
      onActualizada(actualizada);
      setComentario('');
      setMotivo('');
      setNuevaFecha('');
      setModoPausa(null);
    } catch (err: any) {
      setError(err.message || 'No se pudo actualizar la solicitud');
    } finally {
      setBusy(false);
    }
  };

  const copiarLink = async () => {
    if (!s.google_form_url) return;
    await navigator.clipboard.writeText(s.google_form_url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const inputCls =
    'w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-secondary';
  const btnPrimary =
    'w-full h-10 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2';

  return (
    <div className="flex flex-col gap-space-md">
      {/* STEPS */}
      <ol className="flex flex-col gap-3">
        {pasos.map((p, i) => (
          <li key={p.n} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-label-md font-bold ${ESTILO_PASO[p.status]}`}>
                {p.status === 'done' ? (
                  <span className="material-symbols-outlined text-[18px]">check</span>
                ) : p.status === 'paused' ? (
                  <span className="material-symbols-outlined text-[18px]">pause</span>
                ) : (
                  p.n
                )}
              </div>
              {i < pasos.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[16px] ${p.status === 'done' ? 'bg-secondary' : 'bg-outline-variant'}`}></div>
              )}
            </div>
            <div className="pb-2">
              <div className={`text-label-md font-bold ${p.status === 'pending' ? 'text-outline' : 'text-primary'}`}>
                {p.titulo}
              </div>
              <div className="text-label-sm text-on-surface-variant">{p.actor}</div>
              {p.detalle && <div className="text-label-sm text-secondary">{p.detalle}</div>}
            </div>
          </li>
        ))}
      </ol>

      {pausada && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-body-sm text-amber-900">
          <strong className="capitalize">{s.estado}</strong>
          {s.observaciones_estado ? `: ${s.observaciones_estado}` : ''}
          {s.estado === 'postergada' && s.fecha_propuesta ? ` · Nueva fecha: ${formatearFecha(s.fecha_propuesta)}` : ''}
        </div>
      )}

      {error && <div className="p-3 rounded-xl bg-error-container text-on-error-container text-body-sm">{error}</div>}

      {/* ACCIONES SEGÚN ETAPA Y ROL */}
      {s.estado === 'enviada' && esCoordinador && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-low">
          <label className="text-label-md font-semibold text-primary">Derivar a</label>
          <select value={areaDerivar} onChange={(e) => setAreaDerivar(e.target.value)} className={inputCls}>
            <option value="">Seleccionar área...</option>
            {areasDerivables.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
          {areasDerivables.length === 0 && (
            <p className="text-label-sm text-error">
              No hay áreas marcadas para atender capacitaciones (columna atiende_capacitaciones).
            </p>
          )}
          <button disabled={busy || !areaDerivar} onClick={() => ejecutar(() => derivarSolicitud(s.id, areaDerivar))} className={btnPrimary}>
            <span className="material-symbols-outlined text-[18px]">forward_to_inbox</span>
            Aprobar y derivar
          </button>
        </div>
      )}

      {s.estado === 'derivada_area' && (esAreaAsignada || esCoordinador) && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-low">
          <label className="text-label-md font-semibold text-primary">Comentario del área (opcional)</label>
          <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} className={inputCls} />
          <button disabled={busy} onClick={() => ejecutar(() => aprobarPorArea(s.id, comentario))} className={btnPrimary}>
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            Aprobar y devolver a Coordinación
          </button>
        </div>
      )}

      {s.estado === 'aprobada_area' && esCoordinador && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-low">
          {s.area_revision_comentario && (
            <p className="text-label-sm text-on-surface-variant">
              Comentario del área: {s.area_revision_comentario}
            </p>
          )}
          <label className="text-label-md font-semibold text-primary">
            Link del formulario <span className="text-error">*</span>
          </label>
          <input
            type="url"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="https://forms.gle/..."
            className={inputCls}
          />
          <textarea
            rows={2}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Indicaciones para la sub-sede (opcional)"
            className={inputCls}
          />
          <button
            disabled={busy || !/^https?:\/\/\S+$/.test(formUrl.trim())}
            onClick={() => ejecutar(() => cerrarConFormulario(s.id, formUrl, comentario))}
            className={btnPrimary}
          >
            <span className="material-symbols-outlined text-[18px]">link</span>
            Cargar link y aprobar
          </button>
        </div>
      )}

      {s.estado === 'aprobada' && (
        <div className="flex flex-col gap-2 p-3 rounded-xl border border-teal-300 bg-[#CCFBF1]/40">
          <div className="text-label-md font-semibold text-primary">Formulario para el solicitante</div>
          {s.solicitante_externo && (
            <p className="text-label-sm text-on-surface-variant">
              Enviar a: <strong>{s.solicitante_externo}</strong>
              {s.solicitante_externo_contacto ? ` · ${s.solicitante_externo_contacto}` : ''}
            </p>
          )}
          {s.comentario_revision && <p className="text-label-sm text-on-surface-variant">{s.comentario_revision}</p>}
          {s.google_form_url && (
            <div className="flex items-center gap-2">
              <a
                href={s.google_form_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-body-sm text-secondary hover:underline"
              >
                {s.google_form_url}
              </a>
              <button onClick={copiarLink} className="px-3 py-1.5 border border-outline-variant rounded-lg text-label-sm font-semibold text-primary hover:bg-surface-container">
                {copiado ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          )}
          {!s.form_enviado_at && (esSolicitante || esCoordinador) && (
            <button disabled={busy} onClick={() => ejecutar(() => marcarFormularioEnviado(s.id))} className={btnPrimary}>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Ya lo envié al solicitante
            </button>
          )}
        </div>
      )}

      {s.estado === 'enviada' && esSolicitante && !esCoordinador && (
        <button
          disabled={busy}
          onClick={() => confirm('¿Cancelar esta solicitud?') && ejecutar(() => cancelarSolicitud(s.id))}
          className="h-9 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30 disabled:opacity-50"
        >
          Cancelar solicitud
        </button>
      )}

      {pausada && s.estado !== 'cancelada' && esCoordinador && (
        <button disabled={busy} onClick={() => ejecutar(() => reactivarSolicitud(s.id))} className={btnPrimary}>
          <span className="material-symbols-outlined text-[18px]">restart_alt</span>
          Reactivar solicitud
        </button>
      )}

      {puedePausar && (
        <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
          {!modoPausa ? (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModoPausa('postergar')} className="h-9 border border-amber-400 text-amber-800 rounded-xl text-label-md font-semibold hover:bg-amber-50">
                Postergar
              </button>
              <button onClick={() => setModoPausa('suspender')} className="h-9 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30">
                Suspender
              </button>
            </div>
          ) : (
            <>
              <label className="text-label-md font-semibold text-primary capitalize">
                Motivo de la {modoPausa === 'postergar' ? 'postergación' : 'suspensión'} <span className="text-error">*</span>
              </label>
              <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} />
              {modoPausa === 'postergar' && esCoordinador && (
                <input type="date" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} className={inputCls} />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setModoPausa(null)} className="h-9 border border-outline-variant rounded-xl text-label-md font-semibold text-primary hover:bg-surface-container">
                  Volver
                </button>
                <button
                  disabled={busy || !motivo.trim()}
                  onClick={() =>
                    ejecutar(() =>
                      modoPausa === 'postergar' ? postergarSolicitud(s.id, motivo, nuevaFecha) : suspenderSolicitud(s.id, motivo)
                    )
                  }
                  className="h-9 bg-primary text-on-primary rounded-xl text-label-md font-semibold disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
