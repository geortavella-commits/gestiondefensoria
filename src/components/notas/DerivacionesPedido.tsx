import React, { useEffect, useMemo, useState } from 'react';
import {
  listarDerivacionesPedido,
  crearDerivacionPedido,
  cancelarDerivacionPedido,
  marcarAvisadoSubsede,
  subirArchivoDerivacion,
  getSignedUrlArchivoDerivacion,
  type DerivacionNotaPedido,
  type EstadoDerivacion,
} from '../../services/derivacionesPedido';
import { getAreasYSubSedes } from '../../services/organizacion';
import { esRolGestion } from '../../services/legajo';
import { formatearFecha } from '../../utils/legajoCalculations';
import type { Area, Profile, SubSede } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
  onTomarDerivacion?: (derivacion: DerivacionNotaPedido) => void;
  onVerNota?: (notaPedidoId: string) => void;
}

type FiltroEstado = 'todas' | EstadoDerivacion;

const BADGE_ESTADO_DERIVACION: Record<EstadoDerivacion, { label: string; cls: string; icon: string }> = {
  enviada: {
    label: 'Enviada',
    cls: 'bg-amber-100 text-amber-900 border border-amber-200',
    icon: 'schedule',
  },
  tomada: {
    label: 'Tomada',
    cls: 'bg-[#CCFBF1] text-[#0F766E] border border-teal-200',
    icon: 'check_circle',
  },
  cancelada: {
    label: 'Cancelada',
    cls: 'bg-surface-container text-on-surface-variant border border-outline-variant',
    icon: 'block',
  },
};

const BADGE_ESTADO_NOTA: Record<string, { label: string; cls: string }> = {
  borrador: { label: 'Borrador', cls: 'bg-surface-container text-on-surface-variant' },
  enviada: { label: 'En Administración', cls: 'bg-amber-100 text-amber-900' },
  recibida: { label: 'Recibida', cls: 'bg-sky-100 text-sky-900' },
  observada: { label: 'Observada', cls: 'bg-error-container text-on-error-container' },
  aprobada: { label: 'Aprobada', cls: 'bg-teal-100 text-teal-900' },
  aprobada_parcial: { label: 'Aprobación Parcial', cls: 'bg-amber-100 text-amber-900' },
  cancelada: { label: 'Cancelada', cls: 'bg-surface-container text-on-surface-variant' },
};

export const DerivacionesPedido: React.FC<Props> = ({
  perfilActual,
  onTomarDerivacion,
  onVerNota,
}) => {
  const [derivaciones, setDerivaciones] = useState<DerivacionNotaPedido[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subSedes, setSubSedes] = useState<SubSede[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [filtroAreaDestino, setFiltroAreaDestino] = useState<string>('todas');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modal nueva derivación
  const [modalCrear, setModalCrear] = useState(false);
  const [formSubSedeId, setFormSubSedeId] = useState('');
  const [formAreaDestinoId, setFormAreaDestinoId] = useState('');
  const [formFecha, setFormFecha] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formArchivo, setFormArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Modal cancelar derivación
  const [derivacionCancelar, setDerivacionCancelar] = useState<DerivacionNotaPedido | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [cancelando, setCancelando] = useState(false);

  // Adjuntar/ver archivo
  const [subiendoArchivoId, setSubiendoArchivoId] = useState<string | null>(null);
  const [visor, setVisor] = useState<{ url: string; nombre: string; esImagen: boolean } | null>(null);

  const esGestion = esRolGestion(perfilActual?.rol);
  const esCoordinadoraSubsedes =
    !!perfilActual?.area_id && areas.some((a) => a.id === perfilActual.area_id && a.es_coordinadora_subsedes);
  const puedeCrearYCancelar = esGestion || esCoordinadoraSubsedes;

  // Solo áreas que reciben derivaciones para el select de destino
  const areasDestinoDisponibles = useMemo(
    () => areas.filter((a) => a.recibe_derivaciones_pedido),
    [areas]
  );

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [listado, catalogo] = await Promise.all([
        listarDerivacionesPedido(),
        getAreasYSubSedes(),
      ]);
      setDerivaciones(listado);
      setAreas(catalogo.areas || []);
      setSubSedes(catalogo.subSedes || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las derivaciones de sub-sedes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Abrir modal de creación
  const abrirModalCrear = () => {
    setFormSubSedeId(subSedes.length > 0 ? subSedes[0].id : '');
    setFormAreaDestinoId(areasDestinoDisponibles.length > 0 ? areasDestinoDisponibles[0].id : '');
    setFormFecha(new Date().toISOString().slice(0, 10));
    setFormDescripcion('');
    setFormArchivo(null);
    setModalCrear(true);
  };

  const handleSubmitCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubSedeId) {
      alert('Por favor seleccioná una sub-sede de origen');
      return;
    }
    if (!formAreaDestinoId) {
      alert('Por favor seleccioná el área destino');
      return;
    }
    if (!formFecha) {
      alert('Por favor indicá la fecha');
      return;
    }
    if (!formDescripcion.trim()) {
      alert('Por favor detallá la descripción o requerimiento de la sub-sede');
      return;
    }

    try {
      setGuardando(true);
      const nueva = await crearDerivacionPedido({
        sub_sede_origen_id: formSubSedeId,
        area_destino_id: formAreaDestinoId,
        fecha: formFecha,
        descripcion: formDescripcion.trim(),
      });
      if (formArchivo) {
        try {
          await subirArchivoDerivacion(nueva.id, formArchivo);
        } catch (err: any) {
          alert('La derivación se registró, pero no se pudo subir el archivo adjunto: ' + (err.message || 'Error desconocido'));
        }
      }
      setModalCrear(false);
      await cargarDatos();
    } catch (err: any) {
      alert('Error al registrar la derivación: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardando(false);
    }
  };

  // Adjuntar archivo a una derivación ya creada (ej. si no se adjuntó al cargarla)
  const handleAdjuntarArchivoExistente = async (derivacionId: string, file: File) => {
    try {
      setSubiendoArchivoId(derivacionId);
      await subirArchivoDerivacion(derivacionId, file);
      await cargarDatos();
    } catch (err: any) {
      alert('No se pudo subir el archivo: ' + (err.message || 'Error desconocido'));
    } finally {
      setSubiendoArchivoId(null);
    }
  };

  const handleVerArchivo = async (d: DerivacionNotaPedido) => {
    if (!d.archivo_path) return;
    try {
      const url = await getSignedUrlArchivoDerivacion(d.archivo_path, 300);
      const esImagen = /\.(jpe?g|png|gif|webp)$/i.test(d.archivo_nombre || d.archivo_path);
      setVisor({ url, nombre: d.archivo_nombre || 'Archivo adjunto', esImagen });
    } catch (err: any) {
      alert('No se pudo abrir el archivo: ' + (err.message || 'Error desconocido'));
    }
  };

  // Marcar avisado a la sub-sede
  const handleAvisarSubsede = async (id: string) => {
    try {
      setBusy(true);
      await marcarAvisadoSubsede(id);
      await cargarDatos();
    } catch (err: any) {
      alert('No se pudo marcar como avisado: ' + (err.message || 'Error desconocido'));
    } finally {
      setBusy(false);
    }
  };

  // Cancelar derivación con motivo obligatorio
  const abrirModalCancelar = (d: DerivacionNotaPedido) => {
    setDerivacionCancelar(d);
    setMotivoCancelacion('');
  };

  const handleConfirmarCancelar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!derivacionCancelar) return;
    if (!motivoCancelacion.trim()) {
      alert('El motivo de la cancelación es obligatorio.');
      return;
    }
    try {
      setCancelando(true);
      await cancelarDerivacionPedido(derivacionCancelar.id, motivoCancelacion.trim());
      setDerivacionCancelar(null);
      await cargarDatos();
    } catch (err: any) {
      alert('Error al cancelar la derivación: ' + (err.message || 'Error desconocido'));
    } finally {
      setCancelando(false);
    }
  };

  // Filtrado de derivaciones
  const derivacionesFiltradas = useMemo(() => {
    return derivaciones.filter((d) => {
      if (filtroEstado !== 'todas' && d.estado !== filtroEstado) return false;
      if (filtroAreaDestino !== 'todas' && d.area_destino_id !== filtroAreaDestino) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const coincideDesc = d.descripcion.toLowerCase().includes(q);
        const coincideSede = d.sub_sede?.nombre.toLowerCase().includes(q);
        const coincideArea = d.area_destino?.nombre.toLowerCase().includes(q);
        const coincideNota = d.nota_pedido?.numero?.toLowerCase().includes(q);
        if (!coincideDesc && !coincideSede && !coincideArea && !coincideNota) {
          return false;
        }
      }
      return true;
    });
  }, [derivaciones, filtroEstado, filtroAreaDestino, busqueda]);

  return (
    <div className="flex flex-col gap-6">
      {/* HEADER DE DERIVACIONES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-headline-md font-bold text-primary tracking-tight">
            Derivaciones de Sub-Sedes
          </h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            Canal de articulación: Coordinación de Subsedes recepciona pedidos territoriales y los deriva a las áreas correspondientes para generar las Notas de Pedido.
          </p>
        </div>

        {puedeCrearYCancelar && (
          <button
            type="button"
            onClick={abrirModalCrear}
            className="inline-flex items-center gap-1.5 px-4 h-10 bg-primary text-on-primary rounded-xl font-label-md font-semibold hover:bg-primary/90 shadow-sm transition-all shrink-0 self-start md:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Nueva Derivación</span>
          </button>
        )}
      </div>

      {/* MENSAJE DE ERROR */}
      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm flex items-start gap-2">
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Búsqueda por texto */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined text-outline text-[20px] absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por sub-sede, requerimiento o nota..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 h-10 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary transition-all"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface p-1 rounded-md"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Filtro por Estado */}
          <div className="sm:w-48">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
              className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
            >
              <option value="todas">Todos los estados</option>
              <option value="enviada">Enviadas</option>
              <option value="tomada">Tomadas</option>
              <option value="cancelada">Canceladas</option>
            </select>
          </div>

          {/* Filtro por Área Destino */}
          <div className="sm:w-56">
            <select
              value={filtroAreaDestino}
              onChange={(e) => setFiltroAreaDestino(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
            >
              <option value="todas">Todas las áreas destino</option>
              {areasDestinoDisponibles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Indicador de resultados */}
        {(filtroEstado !== 'todas' || filtroAreaDestino !== 'todas' || busqueda) && (
          <div className="flex items-center gap-2 text-label-sm text-outline shrink-0 justify-end">
            <span>
              {derivacionesFiltradas.length} de {derivaciones.length} encontradas
            </span>
            <button
              type="button"
              onClick={() => {
                setFiltroEstado('todas');
                setFiltroAreaDestino('todas');
                setBusqueda('');
              }}
              className="text-secondary hover:underline font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* LISTADO DE TARJETAS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-outline">
          <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-body-md font-medium">Cargando derivaciones de sub-sedes...</span>
        </div>
      ) : derivacionesFiltradas.length === 0 ? (
        /* ESTADO VACÍO REAL (NUNCA DATOS DE EJEMPLO) */
        <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[36px]">alt_route</span>
          </div>
          <h3 className="text-title-lg font-bold text-primary">No hay derivaciones de sub-sedes</h3>
          <p className="text-body-md text-on-surface-variant max-w-md">
            {derivaciones.length === 0
              ? 'Todavía no se registraron derivaciones de sub-sedes en el sistema.'
              : 'No se encontraron derivaciones que coincidan con los filtros seleccionados.'}
          </p>
          {derivaciones.length === 0 && puedeCrearYCancelar && (
            <button
              type="button"
              onClick={abrirModalCrear}
              className="mt-2 h-10 px-5 bg-primary text-on-primary font-label-md font-semibold rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Registrar primera derivación</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {derivacionesFiltradas.map((d) => {
            const metaEstado = BADGE_ESTADO_DERIVACION[d.estado] || BADGE_ESTADO_DERIVACION.enviada;
            const esCancelada = d.estado === 'cancelada';
            const esTomada = d.estado === 'tomada';
            const esEnviada = d.estado === 'enviada';

            // El usuario pertenece al área destino (o es gestión, que puede tomar cualquier derivación)
            const esDelAreaDestino = !!perfilActual?.area_id && perfilActual.area_id === d.area_destino_id;
            const puedeTomar = (esDelAreaDestino || esGestion) && esEnviada;

            // Coordinación o gestión pueden cancelar si está enviada
            const puedeCancelar = puedeCrearYCancelar && esEnviada;

            // Avisar a sub-sede: Coordinación o gestión, si está tomada y la nota ya está resuelta
            const estadoNota = d.nota_pedido?.estado;
            const notaResuelta =
              !!estadoNota && ['aprobada', 'aprobada_parcial', 'observada'].includes(estadoNota);
            const puedeAvisarSubsede = puedeCrearYCancelar && esTomada && notaResuelta;

            const notaBadge = estadoNota ? BADGE_ESTADO_NOTA[estadoNota] : null;

            return (
              <article
                key={d.id}
                className={`bg-surface-container-lowest rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  esCancelada
                    ? 'border-outline-variant/60 opacity-80'
                    : 'border-outline-variant hover:border-secondary/40'
                }`}
              >
                {/* PARTE PRINCIPAL */}
                <div className="p-5 flex flex-col gap-3.5">
                  {/* Encabezado: Estado y Fecha */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-xs font-bold ${metaEstado.cls}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{metaEstado.icon}</span>
                      <span>{metaEstado.label}</span>
                    </span>

                    <span className="text-label-sm font-medium text-outline flex items-center gap-1 ml-auto">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      <span>{formatearFecha(d.fecha)}</span>
                    </span>
                  </div>

                  {/* Origen y Destino */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-container-low/60 rounded-xl border border-outline-variant/40">
                    <div>
                      <span className="text-label-xs text-outline font-semibold block uppercase">
                        Sub-Sede Origen
                      </span>
                      <div className="font-bold text-primary flex items-center gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">
                          domain
                        </span>
                        <span className="truncate">{d.sub_sede?.nombre || 'Sub-Sede no informada'}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-label-xs text-outline font-semibold block uppercase">
                        Área Destino
                      </span>
                      <div className="font-bold text-primary flex items-center gap-1.5 mt-0.5">
                        <span className="material-symbols-outlined text-secondary text-[18px] shrink-0">
                          apartment
                        </span>
                        <span className="truncate">{d.area_destino?.nombre || 'Área no informada'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Descripción / Contenido del pedido */}
                  <div>
                    <span className="text-label-xs text-outline font-semibold block mb-1 uppercase">
                      Requerimiento de la Sub-Sede
                    </span>
                    <p className="text-body-sm text-on-surface leading-relaxed whitespace-pre-line bg-surface p-3.5 rounded-xl border border-outline-variant">
                      {d.descripcion}
                    </p>
                  </div>

                  {/* Archivo adjunto */}
                  {d.archivo_path ? (
                    <button
                      type="button"
                      onClick={() => handleVerArchivo(d)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-container/50 text-secondary border border-secondary/30 text-label-xs font-bold hover:bg-secondary-container self-start transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">attach_file</span>
                      <span className="truncate max-w-[220px]">{d.archivo_nombre || 'Ver archivo adjunto'}</span>
                    </button>
                  ) : (
                    puedeCrearYCancelar &&
                    !esCancelada && (
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-outline-variant text-label-xs font-semibold text-on-surface-variant hover:border-secondary hover:text-secondary cursor-pointer self-start transition-colors">
                        {subiendoArchivoId === d.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                            <span>Subiendo...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">attach_file</span>
                            <span>Adjuntar archivo</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          disabled={subiendoArchivoId === d.id}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) handleAdjuntarArchivoExistente(d.id, file);
                          }}
                        />
                      </label>
                    )
                  )}

                  {/* Si está tomada: Nota de Pedido vinculada */}
                  {esTomada && d.nota_pedido && (
                    <div className="p-3 bg-[#F0FDFA] rounded-xl border border-teal-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="material-symbols-outlined text-[#0F766E] text-[20px]">
                          receipt_long
                        </span>
                        <span className="text-label-sm font-semibold text-primary">Nota generada:</span>
                        {onVerNota ? (
                          <button
                            type="button"
                            onClick={() => onVerNota(d.nota_pedido_id!)}
                            className="font-bold text-secondary hover:underline flex items-center gap-1 text-label-sm"
                            title="Hacé clic para ver el detalle de la nota"
                          >
                            <span>{d.nota_pedido.numero || 'Nota sin número'}</span>
                            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                          </button>
                        ) : (
                          <span className="font-bold text-secondary text-label-sm">
                            {d.nota_pedido.numero || 'Nota sin número'}
                          </span>
                        )}
                      </div>

                      {notaBadge && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-label-xs font-bold shrink-0 ${notaBadge.cls}`}
                        >
                          {notaBadge.label}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Si ya se le avisó a la sub-sede */}
                  {d.avisado_subsede_at && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-label-xs font-bold">
                      <span className="material-symbols-outlined text-[16px]">task_alt</span>
                      <span>Avisado a la sub-sede el {formatearFecha(d.avisado_subsede_at)}</span>
                    </div>
                  )}

                  {/* Si está cancelada: mostrar motivo */}
                  {esCancelada && d.motivo_cancelacion && (
                    <div className="p-3 bg-surface-container rounded-xl border border-outline-variant text-label-sm text-on-surface-variant flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">info</span>
                      <div>
                        <strong className="text-on-surface">Motivo de cancelación:</strong> {d.motivo_cancelacion}
                      </div>
                    </div>
                  )}
                </div>

                {/* PIE DE TARJETA CON ACCIONES */}
                <div className="px-5 py-3.5 bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-label-sm">
                  {/* Creador de la derivación */}
                  <div className="flex items-center gap-1.5 text-outline truncate">
                    <span className="material-symbols-outlined text-[16px] shrink-0">person</span>
                    <span className="truncate">
                      {d.creador ? `${d.creador.nombre} ${d.creador.apellido}` : 'Coordinación de Subsedes'}
                    </span>
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Botón Tomar y crear Nota de Pedido */}
                    {puedeTomar && onTomarDerivacion && (
                      <button
                        type="button"
                        onClick={() => onTomarDerivacion(d)}
                        className="px-3.5 py-1.5 bg-primary text-on-primary font-semibold text-label-xs rounded-xl hover:bg-primary/90 flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-[16px]">post_add</span>
                        <span>Tomar y crear Nota de Pedido</span>
                      </button>
                    )}

                    {/* Botón Marcar avisado a la sub-sede (solo si no fue avisado aún) */}
                    {puedeAvisarSubsede && !d.avisado_subsede_at && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleAvisarSubsede(d.id)}
                        className="px-3 py-1.5 bg-[#CCFBF1] text-[#0F766E] hover:bg-teal-200 rounded-xl text-label-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 shrink-0"
                        title="Confirmar que se informó a la sub-sede la resolución de la nota"
                      >
                        <span className="material-symbols-outlined text-[16px]">campaign</span>
                        <span>Marcar avisado a la sub-sede</span>
                      </button>
                    )}

                    {/* Botón Cancelar (solo si enviada) */}
                    {puedeCancelar && (
                      <button
                        type="button"
                        onClick={() => abrirModalCancelar(d)}
                        className="px-2.5 py-1.5 text-label-xs font-semibold text-error hover:bg-error-container/30 border border-error/30 rounded-xl flex items-center gap-1 transition-colors shrink-0"
                        title="Cancelar esta derivación con motivo"
                      >
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        <span>Cancelar</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR NUEVA DERIVACIÓN */}
      {/* ========================================================================= */}
      {modalCrear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !guardando && setModalCrear(false)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 text-on-surface max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-secondary">alt_route</span>
                <h3 className="text-headline-sm font-bold tracking-tight">Nueva Derivación de Sub-Sede</h3>
              </div>
              <button
                type="button"
                disabled={guardando}
                onClick={() => setModalCrear(false)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCrear} className="flex flex-col gap-4">
              {/* Sub-Sede de origen */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Sub-Sede de Origen <span className="text-error">*</span>
                </label>
                <select
                  required
                  value={formSubSedeId}
                  onChange={(e) => setFormSubSedeId(e.target.value)}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                >
                  <option value="">Seleccioná una sub-sede</option>
                  {subSedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} {s.localidad ? `(${s.localidad})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Área destino */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Área Destino <span className="text-error">*</span>
                </label>
                <select
                  required
                  value={formAreaDestinoId}
                  onChange={(e) => setFormAreaDestinoId(e.target.value)}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                >
                  <option value="">Seleccioná el área receptora</option>
                  {areasDestinoDisponibles.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
                <span className="text-label-xs text-outline mt-1 block">
                  Solo se listan las áreas habilitadas para recibir y gestionar derivaciones (Prensa, Promoción, etc.).
                </span>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Fecha de Recepción <span className="text-error">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                />
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Descripción del Pedido <span className="text-error">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Pegá o transcribí el requerimiento enviado por la sub-sede (materiales, impresiones, traslados, insumos, etc.)..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              {/* Archivo adjunto (opcional) */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Archivo adjunto (opcional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setFormArchivo(e.target.files?.[0] || null)}
                  className="w-full text-body-sm text-on-surface-variant file:mr-3 file:px-3 file:h-9 file:border-0 file:rounded-lg file:bg-secondary-container file:text-on-secondary-container file:font-label-md file:font-semibold file:cursor-pointer"
                />
                <span className="text-label-xs text-outline mt-1 block">
                  Foto o PDF de la nota original que mandó la sub-sede, si la tenés a mano.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setModalCrear(false)}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-5 h-10 bg-primary text-on-primary font-label-md font-semibold rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {guardando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Registrando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      <span>Registrar Derivación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CANCELAR DERIVACIÓN (CON MOTIVO OBLIGATORIO) */}
      {/* ========================================================================= */}
      {derivacionCancelar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !cancelando && setDerivacionCancelar(null)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-on-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-2xl">cancel</span>
                <h3 className="text-headline-sm font-bold tracking-tight">Cancelar Derivación</h3>
              </div>
              <button
                type="button"
                disabled={cancelando}
                onClick={() => setDerivacionCancelar(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-body-sm">
              <div className="font-semibold text-primary">
                {derivacionCancelar.sub_sede?.nombre} → {derivacionCancelar.area_destino?.nombre}
              </div>
              <div className="text-label-sm text-outline mt-0.5 line-clamp-2">
                {derivacionCancelar.descripcion}
              </div>
            </div>

            <form onSubmit={handleConfirmarCancelar} className="flex flex-col gap-4">
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Motivo de la cancelación <span className="text-error">* (Obligatorio)</span>
                </label>
                <textarea
                  required
                  autoFocus
                  rows={3}
                  placeholder="Detallá por qué se da de baja esta derivación..."
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-sm focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  disabled={cancelando}
                  onClick={() => setDerivacionCancelar(null)}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={!motivoCancelacion.trim() || cancelando}
                  className="px-5 h-10 bg-error text-on-error font-label-md rounded-xl hover:bg-error/90 flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {cancelando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin"></div>
                      <span>Cancelando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      <span>Confirmar Cancelación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VER ARCHIVO ADJUNTO */}
      {/* ========================================================================= */}
      {visor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn"
          onClick={() => setVisor(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
              <span className="text-label-md font-bold text-primary truncate">{visor.nombre}</span>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={visor.url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-outline hover:text-primary rounded-lg hover:bg-surface-container transition-colors"
                  title="Abrir en una pestaña nueva"
                >
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                </a>
                <button
                  type="button"
                  onClick={() => setVisor(null)}
                  className="p-1.5 text-outline hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-surface-container p-2 overflow-auto">
              {visor.esImagen ? (
                <img src={visor.url} alt={visor.nombre} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={visor.url} title={visor.nombre} className="w-full h-full border-0 rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
