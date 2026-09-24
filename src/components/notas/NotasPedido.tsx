import React, { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIAS,
  aprobarNota,
  cancelarNota,
  eliminarBorrador,
  enviarNota,
  formatearMonto,
  listarNotas,
  obtenerNota,
  observarNota,
  recibirNota,
  totalItems,
  type EstadoNota,
  type NotaPedido,
} from '../../services/notasPedido';
import { esRolGestion } from '../../services/legajo';
import { formatearFecha } from '../../utils/legajoCalculations';
import { generarNotaPedidoPDF } from '../../utils/notaPedidoPdf';
import { NotaPedidoForm } from './NotaPedidoForm';
import type { Area, Profile } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
}

type Filtro = 'todas' | 'mias' | 'resolver' | 'observadas' | 'aprobadas';

const ETIQUETA: Record<EstadoNota, { texto: string; cls: string }> = {
  borrador: { texto: 'Borrador', cls: 'bg-surface-container text-on-surface-variant' },
  enviada: { texto: 'En Administración', cls: 'bg-amber-100 text-amber-900' },
  recibida: { texto: 'Recibida', cls: 'bg-sky-100 text-sky-900' },
  observada: { texto: 'Observada', cls: 'bg-error-container text-on-error-container' },
  aprobada: { texto: 'Aprobada', cls: 'bg-teal-100 text-teal-900' },
  cancelada: { texto: 'Cancelada', cls: 'bg-surface-container text-on-surface-variant' },
};

type StepStatus = 'done' | 'current' | 'pending' | 'paused';
const ESTILO_PASO: Record<StepStatus, string> = {
  done: 'bg-secondary text-on-secondary',
  current: 'bg-primary text-on-primary ring-4 ring-secondary-container/40',
  pending: 'bg-surface-container text-on-surface-variant',
  paused: 'bg-amber-400 text-on-surface',
};

function pasos(n: NotaPedido) {
  let actual: number;
  if (n.estado === 'borrador' || n.estado === 'observada') actual = 1;
  else if (n.estado === 'enviada') actual = 2;
  else if (n.estado === 'recibida') actual = 3;
  else if (n.estado === 'aprobada') actual = 4;
  else actual = n.recibida_at ? 3 : n.enviada_at ? 2 : 1;

  const pausada = n.estado === 'observada' || n.estado === 'cancelada';
  const st = (i: number): StepStatus => (i < actual ? 'done' : i === actual ? (pausada ? 'paused' : 'current') : 'pending');

  return [
    {
      titulo: n.estado === 'observada' ? 'Área: corregir y reenviar' : 'Área envía la nota',
      detalle: n.enviada_at ? formatearFecha(n.enviada_at) : 'Sin enviar',
      status: st(1),
    },
    {
      titulo: 'Administración recibe',
      detalle: n.recibida_at ? `${n.receptor?.nombre ?? ''} ${n.receptor?.apellido ?? ''} · ${formatearFecha(n.recibida_at)}` : undefined,
      status: st(2),
    },
    {
      titulo: 'Aprobación',
      detalle: n.estado === 'aprobada' && n.revisado_at ? `${n.revisor?.nombre ?? ''} ${n.revisor?.apellido ?? ''} · ${formatearFecha(n.revisado_at)}` : undefined,
      status: st(3),
    },
  ];
}

export const NotasPedido: React.FC<Props> = ({ perfilActual }) => {
  const [notas, setNotas] = useState<NotaPedido[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<NotaPedido | null>(null);
  const [vista, setVista] = useState<'lista' | 'form'>('lista');
  const [editandoId, setEditandoId] = useState<string | undefined>();
  const [comentario, setComentario] = useState('');
  const [busy, setBusy] = useState(false);

  const gestion = esRolGestion(perfilActual?.rol);
  const esAdministracion =
    gestion || (!!perfilActual?.area_id && areas.some((a) => a.id === perfilActual.area_id && a.recibe_notas_pedido));
  const areaPropia = areas.find((a) => a.id === perfilActual?.area_id);

  const cargar = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listarNotas();
      setNotas(res.notas);
      setAreas(res.areas);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las notas');
    } finally {
      setLoading(false);
    }
  };

  const cargarDetalle = async (id: string) => {
    try {
      setDetalle(await obtenerNota(id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    setComentario('');
    if (seleccionadaId) cargarDetalle(seleccionadaId);
    else setDetalle(null);
  }, [seleccionadaId]);

  const filtradas = useMemo(
    () =>
      notas.filter((n) => {
        if (filtro === 'mias') return n.solicitado_por === perfilActual?.id;
        if (filtro === 'resolver') return n.estado === 'enviada' || n.estado === 'recibida';
        if (filtro === 'observadas') return n.estado === 'observada';
        if (filtro === 'aprobadas') return n.estado === 'aprobada';
        return true;
      }),
    [notas, filtro, perfilActual]
  );

  const ejecutar = async (fn: () => Promise<unknown>, alTerminar?: () => void) => {
    try {
      setBusy(true);
      setError(null);
      await fn();
      setComentario('');
      await cargar();
      if (alTerminar) alTerminar();
      else if (seleccionadaId) await cargarDetalle(seleccionadaId);
    } catch (err: any) {
      setError(err.message || 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  if (vista === 'form' && perfilActual?.area_id) {
    return (
      <NotaPedidoForm
        perfilActual={perfilActual}
        areaNombre={areaPropia?.nombre || '—'}
        notaId={editandoId}
        onVolver={() => setVista('lista')}
        onGuardada={async (id) => {
          setVista('lista');
          setEditandoId(undefined);
          await cargar();
          setSeleccionadaId(id);
          await cargarDetalle(id);
        }}
      />
    );
  }

  const d = detalle;
  const esDueno = !!d && d.solicitado_por === perfilActual?.id;
  const puedeResolver = !!d && esAdministracion && !(esDueno && !gestion);
  const chip = (id: Filtro, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFiltro(id)}
      className={`px-3 py-1.5 rounded-lg text-label-md font-semibold border ${
        filtro === id ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
      }`}
    >
      {label}
    </button>
  );
  const btnPrimary =
    'w-full h-10 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2';

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg text-on-surface font-body-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant pb-space-md">
        <div>
          <h1 className="text-headline-lg font-bold text-primary tracking-tight">Notas de Pedido</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Circuito: el área envía la nota con su presupuesto → Administración la recibe → aprueba u observa.
          </p>
        </div>
        {perfilActual?.area_id ? (
          <button
            onClick={() => {
              setEditandoId(undefined);
              setVista('form');
            }}
            className="inline-flex items-center gap-1.5 px-space-md h-10 bg-primary text-on-primary rounded-xl font-label-md hover:bg-primary/90 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Nueva nota
          </button>
        ) : (
          <span className="text-label-sm text-on-surface-variant">Para crear notas tu usuario necesita un área asignada.</span>
        )}
      </div>

      {error && <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {chip('todas', 'Todas')}
        {chip('mias', 'Mis notas')}
        {esAdministracion && chip('resolver', 'Por resolver')}
        {chip('observadas', 'Observadas')}
        {chip('aprobadas', 'Aprobadas')}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className="xl:col-span-5 flex flex-col gap-space-sm">
          {loading ? (
            <div className="p-12 text-center text-outline">Cargando notas...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-outline bg-surface-container-lowest rounded-xl border border-outline-variant">
              No hay notas para mostrar.
            </div>
          ) : (
            filtradas.map((n) => {
              const et = ETIQUETA[n.estado];
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSeleccionadaId(n.id)}
                  className={`text-left bg-surface-container-lowest rounded-xl p-space-md border transition-all ${
                    n.id === seleccionadaId ? 'border-2 border-secondary ring-4 ring-secondary-container/20' : 'border-outline-variant hover:border-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-label-md font-semibold text-primary">{n.numero || 'Borrador'}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-label-sm font-semibold ${et.cls}`}>{et.texto}</span>
                  </div>
                  <div className="text-body-md font-semibold text-primary mt-1">{n.area?.nombre}</div>
                  <div className="text-label-sm text-on-surface-variant truncate">{n.descripcion || 'Sin descripción'}</div>
                  <div className="flex justify-between mt-2 text-label-sm text-outline">
                    <span>
                      {n.solicitante?.nombre} {n.solicitante?.apellido} · {formatearFecha(n.fecha)}
                    </span>
                    <strong className="text-primary">{formatearMonto(totalItems(n.items))}</strong>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <aside className="xl:col-span-7 bg-surface-container-lowest border-2 border-primary-container rounded-2xl shadow-xl overflow-hidden">
          {!d ? (
            <div className="p-8 text-center text-outline">Seleccioná una nota para ver su seguimiento.</div>
          ) : (
            <>
              <div className="bg-primary-container p-space-md text-on-primary flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-headline-sm font-bold">{d.numero || 'Borrador'} · {d.area?.nombre}</h2>
                  <p className="text-label-sm text-primary-fixed">
                    Solicita {d.solicitante?.nombre} {d.solicitante?.apellido} · {formatearFecha(d.fecha)}
                  </p>
                </div>
                <button
                  onClick={() => generarNotaPedidoPDF(d)}
                  className="px-3 py-1.5 bg-surface-container-lowest text-primary rounded-lg text-label-md font-semibold flex items-center gap-1.5 hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  PDF
                </button>
              </div>

              <div className="p-space-lg flex flex-col gap-space-md">
                <ol className="grid grid-cols-3 gap-2">
                  {pasos(d).map((p, i) => (
                    <li key={i} className="flex flex-col items-center text-center gap-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-label-md ${ESTILO_PASO[p.status]}`}>
                        {p.status === 'done' ? <span className="material-symbols-outlined text-[18px]">check</span> : p.status === 'paused' ? <span className="material-symbols-outlined text-[18px]">pause</span> : i + 1}
                      </div>
                      <div className={`text-label-md font-bold ${p.status === 'pending' ? 'text-outline' : 'text-primary'}`}>{p.titulo}</div>
                      {p.detalle && <div className="text-label-sm text-secondary">{p.detalle}</div>}
                    </li>
                  ))}
                </ol>

                {d.estado === 'observada' && d.comentario_revision && (
                  <div className="p-3 rounded-xl bg-error-container text-on-error-container text-body-sm">
                    <strong>Observación de Administración:</strong> {d.comentario_revision}
                  </div>
                )}
                {d.estado === 'aprobada' && d.comentario_revision && (
                  <div className="p-3 rounded-xl bg-teal-50 text-teal-900 text-body-sm">{d.comentario_revision}</div>
                )}

                {d.descripcion && <p className="text-body-sm text-on-surface-variant">{d.descripcion}</p>}

                {CATEGORIAS.map((cat) => {
                  const deCat = (d.items || []).filter((it) => it.categoria === cat.id);
                  if (!deCat.length) return null;
                  return (
                    <div key={cat.id} className="border border-outline-variant rounded-xl overflow-hidden">
                      <div className="px-3 py-1.5 bg-surface-container text-label-md font-bold text-primary uppercase flex justify-between">
                        <span>{cat.label}</span>
                        <span>{formatearMonto(totalItems(deCat))}</span>
                      </div>
                      <table className="w-full text-body-sm">
                        <tbody>
                          {deCat.map((it) => (
                            <tr key={it.id} className="border-t border-outline-variant/50 align-top">
                              <td className="px-3 py-2">
                                <div className="font-medium text-primary">{it.descripcion}</div>
                                {it.observacion && <div className="text-label-sm text-outline">Obs.: {it.observacion}</div>}
                                {(it.proveedor_nombre || it.proveedor_apellido || it.proveedor_cuit) && (
                                  <div className="text-label-sm text-secondary">
                                    Proveedor: {[it.proveedor_nombre, it.proveedor_apellido].filter(Boolean).join(' ')}
                                    {it.proveedor_cuit ? ` · CUIT ${it.proveedor_cuit}` : ''}
                                    {it.proveedor_contacto ? ` · ${it.proveedor_contacto}` : ''}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2 text-right whitespace-nowrap">
                                {it.cantidad} × {it.precio_unitario != null ? formatearMonto(Number(it.precio_unitario)) : '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                                {formatearMonto(Number(it.cantidad) * Number(it.precio_unitario || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                <div className="text-right text-headline-sm font-bold text-primary">Total estimado: {formatearMonto(totalItems(d.items))}</div>

                {/* ACCIONES */}
                {esDueno && (d.estado === 'borrador' || d.estado === 'observada') && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setEditandoId(d.id);
                        setVista('form');
                      }}
                      className="h-10 border border-outline-variant rounded-xl text-label-md font-semibold text-primary hover:bg-surface-container"
                    >
                      Editar
                    </button>
                    <button disabled={busy} onClick={() => ejecutar(() => enviarNota(d.id))} className={btnPrimary}>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      {d.estado === 'observada' ? 'Reenviar' : 'Enviar'}
                    </button>
                  </div>
                )}

                {puedeResolver && d.estado === 'enviada' && (
                  <button disabled={busy} onClick={() => ejecutar(() => recibirNota(d.id))} className={btnPrimary}>
                    <span className="material-symbols-outlined text-[18px]">inbox</span>
                    Marcar como recibida
                  </button>
                )}

                {puedeResolver && d.estado === 'recibida' && (
                  <div className="flex flex-col gap-2 p-3 rounded-xl border border-outline-variant bg-surface-container-low">
                    <label className="text-label-md font-semibold text-primary">Comentario (obligatorio para observar)</label>
                    <textarea
                      rows={2}
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-secondary"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={busy || !comentario.trim()}
                        onClick={() => ejecutar(() => observarNota(d.id, comentario))}
                        className="h-10 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30 disabled:opacity-50"
                      >
                        Observar
                      </button>
                      <button disabled={busy} onClick={() => ejecutar(() => aprobarNota(d.id, comentario))} className={btnPrimary}>
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        Aprobar
                      </button>
                    </div>
                  </div>
                )}

                {esDueno && d.estado === 'borrador' && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      confirm('¿Eliminar este borrador?') &&
                      ejecutar(() => eliminarBorrador(d.id), () => setSeleccionadaId(null))
                    }
                    className="h-9 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30 disabled:opacity-50"
                  >
                    Eliminar borrador
                  </button>
                )}
                {esDueno && (d.estado === 'observada' || d.estado === 'enviada') && (
                  <button
                    disabled={busy}
                    onClick={() => confirm('¿Cancelar esta nota?') && ejecutar(() => cancelarNota(d.id))}
                    className="h-9 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30 disabled:opacity-50"
                  >
                    Cancelar nota
                  </button>
                )}

                {(d.historial || []).length > 0 && (
                  <div className="pt-2 border-t border-outline-variant">
                    <div className="text-label-md font-semibold text-primary mb-1">Historial</div>
                    <ul className="flex flex-col gap-1 text-label-sm text-on-surface-variant">
                      {(d.historial || []).map((h) => (
                        <li key={h.id}>
                          <span className="text-outline">{formatearFecha(h.created_at)}</span> ·{' '}
                          <strong className="capitalize">{h.estado}</strong>
                          {h.profile ? ` — ${h.profile.nombre} ${h.profile.apellido}` : ''}
                          {h.comentario ? `: ${h.comentario}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};
