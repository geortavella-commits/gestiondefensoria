import React, { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIAS,
  cancelarNota,
  eliminarBorrador,
  enviarNota,
  formatearMonto,
  listarNotas,
  obtenerNota,
  recibirNota,
  totalItems,
  aprobarItem,
  rechazarItem,
  anularItem,
  aprobarTodosLosItems,
  marcarItemEntregado,
  editarItemNota,
  type CategoriaItem,
  type EstadoItem,
  type EstadoNota,
  type ItemNota,
  type NotaPedido,
} from '../../services/notasPedido';
import { esRolGestion } from '../../services/legajo';
import { formatearFecha } from '../../utils/legajoCalculations';
import { generarNotaPedidoPDF } from '../../utils/notaPedidoPdf';
import { NotaPedidoForm } from './NotaPedidoForm';
import { DerivacionesPedido } from './DerivacionesPedido';
import { tomarDerivacionPedido, type DerivacionNotaPedido } from '../../services/derivacionesPedido';
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
  aprobada_parcial: { texto: 'Aprobación Parcial', cls: 'bg-amber-100 text-amber-900' },
  cancelada: { texto: 'Cancelada', cls: 'bg-surface-container text-on-surface-variant' },
};

type StepStatus = 'done' | 'current' | 'pending' | 'paused' | 'partial';
const ESTILO_PASO: Record<StepStatus, string> = {
  done: 'bg-secondary text-on-secondary',
  current: 'bg-primary text-on-primary ring-4 ring-secondary-container/40',
  pending: 'bg-surface-container text-on-surface-variant',
  paused: 'bg-error text-on-error',
  partial: 'bg-amber-400 text-on-surface',
};

function pasos(n: NotaPedido) {
  let actual: number;
  if (n.estado === 'borrador' || n.estado === 'observada' || n.estado === 'aprobada_parcial') actual = 1;
  else if (n.estado === 'enviada') actual = 2;
  else if (n.estado === 'recibida') actual = 3;
  else if (n.estado === 'aprobada') actual = 4;
  else actual = n.recibida_at ? 3 : n.enviada_at ? 2 : 1;

  const pausada = n.estado === 'observada' || n.estado === 'cancelada';
  const parcial = n.estado === 'aprobada_parcial';
  const st = (i: number): StepStatus =>
    i < actual ? 'done' : i === actual ? (parcial ? 'partial' : pausada ? 'paused' : 'current') : 'pending';

  return [
    {
      titulo:
        n.estado === 'observada' || n.estado === 'aprobada_parcial'
          ? 'Área: corregir y reenviar'
          : 'Área envía la nota',
      detalle: n.enviada_at ? formatearFecha(n.enviada_at) : 'Sin enviar',
      status: st(1),
    },
    {
      titulo: 'Administración recibe',
      detalle: n.recibida_at
        ? `${n.receptor?.nombre ?? ''} ${n.receptor?.apellido ?? ''} · ${formatearFecha(n.recibida_at)}`
        : undefined,
      status: st(2),
    },
    {
      titulo: n.estado === 'aprobada_parcial' ? 'Aprobación parcial' : 'Aprobación',
      detalle:
        (n.estado === 'aprobada' || n.estado === 'aprobada_parcial') && n.revisado_at
          ? `${n.revisor?.nombre ?? ''} ${n.revisor?.apellido ?? ''} · ${formatearFecha(n.revisado_at)}`
          : undefined,
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
  const [seccionActual, setSeccionActual] = useState<'notas' | 'derivaciones'>('notas');
  const [derivacionTomando, setDerivacionTomando] = useState<DerivacionNotaPedido | null>(null);
  const [editandoId, setEditandoId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  // Modales de resolución por ítem
  const [itemRechazo, setItemRechazo] = useState<ItemNota | null>(null);
  const [motivoItemRechazo, setMotivoItemRechazo] = useState('');

  // Modal para corregir ítem rechazado
  const [itemCorregir, setItemCorregir] = useState<ItemNota | null>(null);
  const [formCorregir, setFormCorregir] = useState<{
    categoria: CategoriaItem;
    descripcion: string;
    cantidad: number;
    precio_unitario: string | number;
    observacion: string;
  }>({
    categoria: 'material',
    descripcion: '',
    cantidad: 1,
    precio_unitario: '',
    observacion: '',
  });

  const gestion = esRolGestion(perfilActual?.rol);
  const esAdministracion =
    gestion || (!!perfilActual?.area_id && areas.some((a) => a.id === perfilActual.area_id && a.recibe_notas_pedido));
  const esCoordinadoraSubsedes =
    !!perfilActual?.area_id && areas.some((a) => a.id === perfilActual.area_id && a.es_coordinadora_subsedes);
  const recibeDerivaciones =
    !!perfilActual?.area_id && areas.some((a) => a.id === perfilActual.area_id && a.recibe_derivaciones_pedido);
  const puedeVerDerivaciones = gestion || esCoordinadoraSubsedes || recibeDerivaciones;
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
    if (seleccionadaId) cargarDetalle(seleccionadaId);
    else setDetalle(null);
  }, [seleccionadaId]);

  const filtradas = useMemo(
    () =>
      notas.filter((n) => {
        if (filtro === 'mias') return n.solicitado_por === perfilActual?.id;
        if (filtro === 'resolver') return n.estado === 'enviada' || n.estado === 'recibida';
        if (filtro === 'observadas') return n.estado === 'observada' || n.estado === 'aprobada_parcial';
        if (filtro === 'aprobadas') return n.estado === 'aprobada' || n.estado === 'aprobada_parcial';
        return true;
      }),
    [notas, filtro, perfilActual]
  );

  const ejecutar = async (fn: () => Promise<unknown>, alTerminar?: () => void) => {
    try {
      setBusy(true);
      setError(null);
      await fn();
      await cargar();
      if (alTerminar) alTerminar();
      else if (seleccionadaId) await cargarDetalle(seleccionadaId);
    } catch (err: any) {
      setError(err.message || 'No se pudo completar la acción');
    } finally {
      setBusy(false);
    }
  };

  const abrirCorregirItem = (it: ItemNota) => {
    setItemCorregir(it);
    setFormCorregir({
      categoria: it.categoria || 'material',
      descripcion: it.descripcion || '',
      cantidad: it.cantidad || 1,
      precio_unitario: it.precio_unitario != null ? it.precio_unitario : '',
      observacion: it.observacion || '',
    });
  };

  if (vista === 'form' && perfilActual?.area_id) {
    return (
      <NotaPedidoForm
        perfilActual={perfilActual}
        areaNombre={areaPropia?.nombre || '—'}
        notaId={editandoId}
        descripcionInicial={derivacionTomando?.descripcion}
        onVolver={() => {
          setVista('lista');
          setDerivacionTomando(null);
        }}
        onGuardada={async (id) => {
          if (derivacionTomando) {
            try {
              await tomarDerivacionPedido(derivacionTomando.id, id);
            } catch (err: any) {
              console.error('Error al vincular derivación con la nota:', err);
            }
            setDerivacionTomando(null);
            setSeccionActual('derivaciones');
            setVista('lista');
            await cargar();
          } else {
            setVista('lista');
            setEditandoId(undefined);
            await cargar();
            setSeleccionadaId(id);
            await cargarDetalle(id);
          }
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

  // Verifica si hay ítems pendientes de resolver
  const hayPendientes = !!d && (d.items || []).some((it) => (it.estado_item || 'pendiente') === 'pendiente');

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg text-on-surface font-body-md">
      {/* TOGGLE PRINCIPAL: Notas de Pedido / Derivaciones de Sub-Sedes */}
      {puedeVerDerivaciones && (
        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-outline-variant/60">
          <button
            type="button"
            onClick={() => setSeccionActual('notas')}
            className={`px-4 py-2 rounded-xl font-label-md font-bold transition-all flex items-center gap-2 ${
              seccionActual === 'notas'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Notas de Pedido</span>
          </button>

          <button
            type="button"
            onClick={() => setSeccionActual('derivaciones')}
            className={`px-4 py-2 rounded-xl font-label-md font-bold transition-all flex items-center gap-2 ${
              seccionActual === 'derivaciones'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">alt_route</span>
            <span>Derivaciones de Sub-Sedes</span>
          </button>
        </div>
      )}

      {seccionActual === 'derivaciones' && puedeVerDerivaciones ? (
        <DerivacionesPedido
          perfilActual={perfilActual}
          onTomarDerivacion={(derivacion) => {
            setDerivacionTomando(derivacion);
            setEditandoId(undefined);
            setVista('form');
          }}
          onVerNota={(notaId) => {
            setSeccionActual('notas');
            setSeleccionadaId(notaId);
          }}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant pb-space-md">
        <div>
          <h1 className="text-headline-lg font-bold text-primary tracking-tight">Notas de Pedido</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Circuito: el área envía la nota con su presupuesto → Administración la recibe → aprueba o rechaza cada ítem.
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
                        {p.status === 'done' ? (
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        ) : p.status === 'paused' ? (
                          <span className="material-symbols-outlined text-[18px]">pause</span>
                        ) : p.status === 'partial' ? (
                          <span className="material-symbols-outlined text-[18px]">warning</span>
                        ) : (
                          i + 1
                        )}
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
                {d.estado === 'aprobada_parcial' && (
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-body-sm">
                    <strong>Aprobación Parcial:</strong> Algunos ítems fueron aprobados y otros rechazados. El área solicitante puede corregir los ítems rechazados para enviarlos nuevamente a revisión.
                    {d.comentario_revision && <div className="mt-1">{d.comentario_revision}</div>}
                  </div>
                )}
                {d.estado === 'aprobada' && d.comentario_revision && (
                  <div className="p-3 rounded-xl bg-teal-50 text-teal-900 text-body-sm">{d.comentario_revision}</div>
                )}

                {d.descripcion && <p className="text-body-sm text-on-surface-variant">{d.descripcion}</p>}

                {/* BOTÓN: APROBAR TODOS LOS ÍTEMS PENDIENTES */}
                {puedeResolver && d.estado === 'recibida' && hayPendientes && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                    <span className="text-body-sm text-on-surface-variant">
                      Podés resolver los ítems uno a uno o aprobar todos de una vez:
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => ejecutar(() => aprobarTodosLosItems(d.id))}
                      className="px-3.5 py-1.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm text-label-sm shrink-0 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">done_all</span>
                      <span>Aprobar todos los ítems pendientes</span>
                    </button>
                  </div>
                )}

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
                          {deCat.map((it) => {
                            const estadoItem: EstadoItem = it.estado_item || 'pendiente';
                            const esItemRechazado = estadoItem === 'rechazado';
                            const esItemAprobado = estadoItem === 'aprobado';
                            const esItemAnulado = estadoItem === 'anulado';
                            const esItemPendiente = estadoItem === 'pendiente';

                            return (
                              <tr key={it.id || it.descripcion} className="border-t border-outline-variant/50 align-top">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div className="font-medium text-primary">{it.descripcion}</div>

                                    {/* Chips de estado y entrega */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {esItemAprobado && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#CCFBF1] text-[#0F766E] border border-teal-200 flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                          Aprobado
                                        </span>
                                      )}
                                      {esItemRechazado && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-error-container text-on-error-container border border-error/30 flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">cancel</span>
                                          Rechazado
                                        </span>
                                      )}
                                      {esItemAnulado && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface-variant border border-outline-variant flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">block</span>
                                          Anulado
                                        </span>
                                      )}
                                      {esItemPendiente && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-surface-container text-on-surface-variant border border-outline-variant/60 flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                                          Pendiente de revisión
                                        </span>
                                      )}

                                      {/* Marcar entregado (disponible para quien puede resolver cuando el ítem está aprobado, en cualquier estado de la nota) */}
                                      {esItemAprobado && (
                                        puedeResolver ? (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => it.id && ejecutar(() => marcarItemEntregado(it.id!, !it.entregado))}
                                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                                              it.entregado
                                                ? 'bg-teal-100 text-teal-800 border border-teal-300 hover:bg-teal-200'
                                                : 'bg-surface-container-low text-on-surface-variant border border-outline-variant hover:bg-surface-container'
                                            }`}
                                            title={it.entregado ? 'Hacé clic para desmarcar entrega' : 'Hacé clic para marcar como entregado'}
                                          >
                                            <span className="material-symbols-outlined text-[13px]">
                                              {it.entregado ? 'check_box' : 'check_box_outline_blank'}
                                            </span>
                                            <span>{it.entregado ? 'Entregado ✓' : 'Marcar entregado'}</span>
                                          </button>
                                        ) : it.entregado ? (
                                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[13px]">check</span>
                                            Entregado
                                          </span>
                                        ) : null
                                      )}
                                    </div>
                                  </div>

                                  {/* Motivo de rechazo en rojo */}
                                  {esItemRechazado && it.motivo_rechazo && (
                                    <div className="text-label-sm font-semibold text-error mt-1 flex items-start gap-1">
                                      <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0">error</span>
                                      <span>Motivo de rechazo: {it.motivo_rechazo}</span>
                                    </div>
                                  )}

                                  {it.observacion && <div className="text-label-sm text-outline mt-0.5">Obs.: {it.observacion}</div>}
                                  {(it.proveedor_nombre || it.proveedor_apellido || it.proveedor_cuit) && (
                                    <div className="text-label-sm text-secondary mt-0.5">
                                      Proveedor: {[it.proveedor_nombre, it.proveedor_apellido].filter(Boolean).join(' ')}
                                      {it.proveedor_cuit ? ` · CUIT ${it.proveedor_cuit}` : ''}
                                      {it.proveedor_contacto ? ` · ${it.proveedor_contacto}` : ''}
                                    </div>
                                  )}

                                  {/* Botones de acción en fila */}
                                  {/* 1. Aprobar / Rechazar individual (Administración / gestión cuando nota está recibida y el ítem está pendiente) */}
                                  {puedeResolver && d.estado === 'recibida' && esItemPendiente && it.id && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => ejecutar(() => aprobarItem(it.id!))}
                                        className="px-2.5 py-1 bg-[#CCFBF1] text-[#0F766E] hover:bg-teal-200 rounded-lg text-label-xs font-bold transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
                                        title="Aprobar este ítem"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">check</span>
                                        <span>Aprobar</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          setItemRechazo(it);
                                          setMotivoItemRechazo('');
                                        }}
                                        className="px-2.5 py-1 bg-error-container text-on-error-container hover:bg-error-container/80 rounded-lg text-label-xs font-bold transition-colors flex items-center gap-1 shadow-xs disabled:opacity-50"
                                        title="Rechazar este ítem con motivo"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                        <span>Rechazar</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* 2. Corregir o Anular ítem rechazado por el área solicitante */}
                                  {esDueno && (d.estado === 'observada' || d.estado === 'aprobada_parcial') && esItemRechazado && it.id && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => abrirCorregirItem(it)}
                                        className="px-2.5 py-1 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-label-xs font-semibold flex items-center gap-1 shadow-xs transition-colors disabled:opacity-50"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">edit</span>
                                        <span>Corregir ítem</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          if (confirm('¿Anular este ítem? No se puede deshacer.')) {
                                            ejecutar(() => anularItem(it.id!));
                                          }
                                        }}
                                        className="px-2.5 py-1 border border-error/40 text-error hover:bg-error-container/30 rounded-lg text-label-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                                        title="Dar de baja este ítem definitivamente"
                                      >
                                        <span className="material-symbols-outlined text-[14px]">block</span>
                                        <span>Anular ítem</span>
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="px-2 py-2.5 text-right whitespace-nowrap">
                                  {it.cantidad} × {it.precio_unitario != null ? formatearMonto(Number(it.precio_unitario)) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                                  {formatearMonto(Number(it.cantidad) * Number(it.precio_unitario || 0))}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
                <div className="text-right text-headline-sm font-bold text-primary">Total estimado: {formatearMonto(totalItems(d.items))}</div>

                {/* ACCIONES GENERALES DE LA NOTA */}
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

      {/* MODAL: RECHAZAR ÍTEM CON MOTIVO OBLIGATORIO */}
      {itemRechazo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={() => setItemRechazo(null)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-on-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-2xl">cancel</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Rechazar Ítem</h2>
              </div>
              <button
                type="button"
                onClick={() => setItemRechazo(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-body-sm">
              <div className="font-semibold text-primary">{itemRechazo.descripcion}</div>
              <div className="text-label-sm text-outline mt-0.5">
                Cantidad: {itemRechazo.cantidad} · {itemRechazo.categoria}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!motivoItemRechazo.trim()) return;
                const targetId = itemRechazo.id!;
                const motivo = motivoItemRechazo.trim();
                setItemRechazo(null);
                ejecutar(() => rechazarItem(targetId, motivo));
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Motivo del Rechazo <span className="text-error">* (Obligatorio)</span>
                </label>
                <textarea
                  required
                  autoFocus
                  rows={3}
                  placeholder="Detallá por qué se rechaza este ítem para que el área lo corrija..."
                  value={motivoItemRechazo}
                  onChange={(e) => setMotivoItemRechazo(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setItemRechazo(null)}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!motivoItemRechazo.trim() || busy}
                  className="px-5 h-10 bg-error text-on-error font-label-md rounded-xl hover:bg-error/90 flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">cancel</span>
                  <span>Confirmar Rechazo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CORREGIR ÍTEM RECHAZADO */}
      {itemCorregir && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
          onClick={() => setItemCorregir(null)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 text-on-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-secondary">edit_note</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Corregir Ítem Rechazado</h2>
              </div>
              <button
                type="button"
                onClick={() => setItemCorregir(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {itemCorregir.motivo_rechazo && (
              <div className="p-3 bg-error-container text-on-error-container rounded-xl border border-error text-body-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] text-error shrink-0 mt-0.5">error</span>
                <div>
                  <strong className="block font-semibold">Observación de Administración:</strong>
                  <span>{itemCorregir.motivo_rechazo}</span>
                </div>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!formCorregir.descripcion.trim()) return;
                const targetId = itemCorregir.id!;
                const payload = {
                  categoria: formCorregir.categoria,
                  descripcion: formCorregir.descripcion.trim(),
                  cantidad: Number(formCorregir.cantidad) || 1,
                  precio_unitario: formCorregir.precio_unitario !== '' ? Number(formCorregir.precio_unitario) : null,
                  observacion: formCorregir.observacion.trim() || null,
                };
                setItemCorregir(null);
                await ejecutar(() => editarItemNota(targetId, payload));
              }}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCorregir.categoria}
                    onChange={(e) => setFormCorregir({ ...formCorregir, categoria: e.target.value as CategoriaItem })}
                    className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all"
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Cantidad <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formCorregir.cantidad}
                    onChange={(e) => setFormCorregir({ ...formCorregir, cantidad: Number(e.target.value) || 1 })}
                    className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Descripción <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formCorregir.descripcion}
                  onChange={(e) => setFormCorregir({ ...formCorregir, descripcion: e.target.value })}
                  className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all"
                />
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Precio Unitario Estimado (ARS) <span className="text-label-sm font-normal text-outline">(opcional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formCorregir.precio_unitario}
                  onChange={(e) => setFormCorregir({ ...formCorregir, precio_unitario: e.target.value })}
                  className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all"
                />
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Observación <span className="text-label-sm font-normal text-outline">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formCorregir.observacion}
                  onChange={(e) => setFormCorregir({ ...formCorregir, observacion: e.target.value })}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setItemCorregir(null)}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!formCorregir.descripcion.trim() || busy}
                  className="px-5 h-10 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  <span>Guardar Corrección</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
