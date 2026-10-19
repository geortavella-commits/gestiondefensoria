import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  listarLicenciasParticulares,
  saldoLicenciaParticular,
  crearLicenciaParticular,
  cancelarLicenciaPropia,
  aprobarLicencia,
  rechazarLicencia,
  cancelarLicenciaAprobada,
  subirAdjuntoLicencia,
  getSignedUrlAdjuntoLicencia,
  type LicenciaParticular,
  type SaldoLicenciaParticular,
  type EstadoLicencia,
} from '../../services/licenciasParticulares';
import {
  estimarDiasHabiles,
  obtenerFeriados,
  type Feriado,
} from '../../services/vacaciones';
import { esRolGestion } from '../../services/legajo';
import { formatearFecha } from '../../utils/legajoCalculations';
import type { Profile } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
  puedeGestionar?: boolean;
}

type FiltroEstado = 'todas' | 'enviada' | 'aprobada' | 'rechazada' | 'cancelada';

const ETIQUETA_ESTADO: Record<EstadoLicencia, { texto: string; cls: string; icono: string }> = {
  enviada: {
    texto: 'Enviada (Por resolver)',
    cls: 'bg-amber-100 text-amber-900 border-amber-300',
    icono: 'schedule',
  },
  aprobada: {
    texto: 'Aprobada',
    cls: 'bg-teal-100 text-teal-900 border-teal-300',
    icono: 'check_circle',
  },
  rechazada: {
    texto: 'Rechazada',
    cls: 'bg-error-container text-on-error-container border-error',
    icono: 'cancel',
  },
  cancelada: {
    texto: 'Cancelada',
    cls: 'bg-surface-container text-on-surface-variant border-outline-variant',
    icono: 'block',
  },
};

export const LicenciasParticulares: React.FC<Props> = ({ perfilActual, puedeGestionar: propPuedeGestionar }) => {
  const ahora = new Date();
  const anioActual = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // 1-12
  const nombreMesActual = useMemo(() => {
    const raw = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(ahora);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, []);

  // Roles y permisos
  const esGestion = esRolGestion(perfilActual?.rol);
  const esAreaAdministracion =
    perfilActual?.areas?.recibe_notas_pedido ||
    perfilActual?.areas?.nombre?.toLowerCase().includes('administra') ||
    false;
  const esResponsableDeEquipo = perfilActual?.rol === 'jefe_area' || perfilActual?.rol === 'referente_subsede';
  const puedeGestionar = propPuedeGestionar !== undefined
    ? propPuedeGestionar
    : (esGestion || esAreaAdministracion || esResponsableDeEquipo);

  // Estados de datos
  const [licencias, setLicencias] = useState<LicenciaParticular[]>([]);
  const [saldo, setSaldo] = useState<SaldoLicenciaParticular | null>(null);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Filtros
  const [filtroVista, setFiltroVista] = useState<'todas' | 'mias'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [busqueda, setBusqueda] = useState('');

  // Modales
  const [modalSolicitudAbierto, setModalSolicitudAbierto] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [motivoSolicitud, setMotivoSolicitud] = useState('');
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [estimacionDias, setEstimacionDias] = useState<number>(0);
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);
  const [errorModalSolicitud, setErrorModalSolicitud] = useState<string | null>(null);

  // Acciones en tarjetas
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [solicitudRechazo, setSolicitudRechazo] = useState<LicenciaParticular | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [solicitudAprobacion, setSolicitudAprobacion] = useState<LicenciaParticular | null>(null);
  const [comentarioAprobacion, setComentarioAprobacion] = useState('');
  const [solicitudCancelacionAprobada, setSolicitudCancelacionAprobada] = useState<LicenciaParticular | null>(null);
  const [motivoCancelacionAprobada, setMotivoCancelacionAprobada] = useState('');

  // Subida de adjunto tardía
  const fileInputLaterRef = useRef<HTMLInputElement>(null);
  const [licenciaParaAdjunto, setLicenciaParaAdjunto] = useState<string | null>(null);

  // Visor modal
  const [visor, setVisor] = useState<{ url: string; nombre: string; esImagen: boolean } | null>(null);

  // Carga de datos
  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const [licenciasData, feriadosData] = await Promise.all([
        listarLicenciasParticulares(),
        obtenerFeriados(),
      ]);
      setLicencias(licenciasData);
      setFeriados(feriadosData);
    } catch (err: any) {
      console.error('Error al cargar licencias particulares:', err);
      setError(err.message || 'No se pudieron cargar las licencias particulares.');
    } finally {
      setLoading(false);
    }
  };

  const cargarSaldo = async () => {
    if (!perfilActual?.id) return;
    try {
      setLoadingSaldo(true);
      const data = await saldoLicenciaParticular(perfilActual.id, anioActual, mesActual);
      setSaldo(data);
    } catch (err: any) {
      console.error('Error al cargar saldo de licencias particulares:', err);
    } finally {
      setLoadingSaldo(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (perfilActual?.id) {
      cargarSaldo();
    }
  }, [perfilActual?.id]);

  // Estimación de días hábiles en modal de solicitud
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

  // Manejo de envío de solicitud
  const handleSubmitSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaDesde || !fechaHasta) {
      setErrorModalSolicitud('Por favor completá la fecha de inicio y de fin.');
      return;
    }

    if (fechaHasta < fechaDesde) {
      setErrorModalSolicitud('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    try {
      setGuardandoSolicitud(true);
      setErrorModalSolicitud(null);

      // 1. Crear licencia
      const nuevaLicencia = await crearLicenciaParticular({
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        motivo: motivoSolicitud.trim() || undefined,
        profileId: perfilActual?.id,
      });

      // 2. Si hay adjunto, encadenar subida
      if (archivoAdjunto && nuevaLicencia?.id && perfilActual?.id) {
        await subirAdjuntoLicencia(nuevaLicencia.id, perfilActual.id, archivoAdjunto);
      }

      setMensajeExito('Solicitud de licencia particular enviada exitosamente.');
      setTimeout(() => setMensajeExito(null), 4000);
      setModalSolicitudAbierto(false);
      setFechaDesde('');
      setFechaHasta('');
      setMotivoSolicitud('');
      setArchivoAdjunto(null);
      await Promise.all([cargarDatos(), cargarSaldo()]);
    } catch (err: any) {
      // Mostrar tal cual el error que devuelva el servidor (ej: "Supera el tope mensual...")
      setErrorModalSolicitud(err.message || 'Error al enviar la solicitud de licencia particular.');
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  // Acciones en licencias
  const handleCancelarPropia = async (id: string) => {
    const confirma = window.confirm('¿Estás seguro de que deseás cancelar tu solicitud de licencia?');
    if (!confirma) return;

    try {
      setProcesandoAccion(true);
      setError(null);
      await cancelarLicenciaPropia(id);
      setMensajeExito('Se canceló tu solicitud de licencia.');
      setTimeout(() => setMensajeExito(null), 4000);
      await Promise.all([cargarDatos(), cargarSaldo()]);
    } catch (err: any) {
      setError(err.message || 'No se pudo cancelar la solicitud.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleConfirmarAprobar = async () => {
    if (!solicitudAprobacion) return;
    try {
      setProcesandoAccion(true);
      setError(null);
      await aprobarLicencia(solicitudAprobacion.id, comentarioAprobacion);
      setSolicitudAprobacion(null);
      setComentarioAprobacion('');
      setMensajeExito('Licencia particular aprobada con éxito.');
      setTimeout(() => setMensajeExito(null), 4000);
      await Promise.all([cargarDatos(), cargarSaldo()]);
    } catch (err: any) {
      setError(err.message || 'No se pudo aprobar la licencia.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleConfirmarRechazo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudRechazo) return;
    if (!motivoRechazo.trim()) {
      alert('El motivo de rechazo es obligatorio según las reglas institucionales.');
      return;
    }

    try {
      setProcesandoAccion(true);
      setError(null);
      await rechazarLicencia(solicitudRechazo.id, motivoRechazo);
      setSolicitudRechazo(null);
      setMotivoRechazo('');
      setMensajeExito('Se registró el rechazo de la licencia.');
      setTimeout(() => setMensajeExito(null), 4000);
      await Promise.all([cargarDatos(), cargarSaldo()]);
    } catch (err: any) {
      setError(err.message || 'No se pudo rechazar la solicitud.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleConfirmarCancelarAprobada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!solicitudCancelacionAprobada) return;

    try {
      setProcesandoAccion(true);
      setError(null);
      await cancelarLicenciaAprobada(solicitudCancelacionAprobada.id, motivoCancelacionAprobada);
      setSolicitudCancelacionAprobada(null);
      setMotivoCancelacionAprobada('');
      setMensajeExito('Se canceló la licencia aprobada.');
      setTimeout(() => setMensajeExito(null), 4000);
      await Promise.all([cargarDatos(), cargarSaldo()]);
    } catch (err: any) {
      setError(err.message || 'No se pudo cancelar la licencia aprobada.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Visor de adjunto
  const handleVerAdjunto = async (path: string, nombreArchivo?: string | null) => {
    try {
      const url = await getSignedUrlAdjuntoLicencia(path, 300);
      const nombreFinal = nombreArchivo || 'Justificativo';
      const esImagen = !/\.pdf$/i.test(path.split('?')[0]);
      setVisor({ url, nombre: nombreFinal, esImagen });
    } catch (err: any) {
      alert('No se pudo abrir el archivo adjunto: ' + err.message);
    }
  };

  // Subida de adjunto posterior
  const triggerSubirAdjuntoTardio = (licenciaId: string) => {
    setLicenciaParaAdjunto(licenciaId);
    fileInputLaterRef.current?.click();
  };

  const handleFileChangeTardio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = licenciaParaAdjunto;
    e.target.value = '';
    setLicenciaParaAdjunto(null);
    if (!file || !targetId || !perfilActual?.id) return;

    try {
      setProcesandoAccion(true);
      await subirAdjuntoLicencia(targetId, perfilActual.id, file);
      setMensajeExito('Justificativo adjuntado con éxito.');
      setTimeout(() => setMensajeExito(null), 4000);
      await cargarDatos();
    } catch (err: any) {
      alert('Error al subir el adjunto: ' + err.message);
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Filtrado de la lista
  const licenciasFiltradas = useMemo(() => {
    return licencias.filter((l) => {
      // Filtro de alcance: si puede gestionar y eligió 'mias', solo las propias
      if (puedeGestionar && filtroVista === 'mias') {
        if (l.profile_id !== perfilActual?.id) return false;
      } else if (!puedeGestionar) {
        // Usuario común: solo las propias
        if (l.profile_id !== perfilActual?.id) return false;
      }

      // Filtro por estado
      if (filtroEstado !== 'todas' && l.estado !== filtroEstado) {
        return false;
      }

      // Búsqueda de texto
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        const solicitanteNombre = l.solicitante
          ? `${l.solicitante.nombre} ${l.solicitante.apellido}`.toLowerCase()
          : '';
        const legajo = l.solicitante?.legajo?.toLowerCase() || '';
        const area = l.solicitante?.area?.nombre?.toLowerCase() || '';
        const motivo = (l.motivo || '').toLowerCase();
        if (
          !solicitanteNombre.includes(q) &&
          !legajo.includes(q) &&
          !area.includes(q) &&
          !motivo.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [licencias, puedeGestionar, filtroVista, filtroEstado, busqueda, perfilActual?.id]);

  const totalPendientesGestion = useMemo(() => {
    return licencias.filter((l) => l.estado === 'enviada').length;
  }, [licencias]);

  return (
    <div className="flex flex-col gap-space-lg text-on-surface font-body-md animate-fadeIn">
      {/* INPUT OCULTO PARA ADJUNTAR ARCHIVO DESPUÉS */}
      <input
        type="file"
        ref={fileInputLaterRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChangeTardio}
      />

      {/* MENSAJES DE ALERTA O ÉXITO */}
      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm flex items-start justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0 mt-0.5">error</span>
            <div className="font-medium">{error}</div>
          </div>
          <button onClick={() => setError(null)} className="text-on-error-container hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {mensajeExito && (
        <div className="bg-teal-50 border border-teal-300 text-teal-900 p-4 rounded-xl text-body-sm flex items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 font-medium">
            <span className="material-symbols-outlined text-[20px] text-teal-700">check_circle</span>
            <span>{mensajeExito}</span>
          </div>
          <button onClick={() => setMensajeExito(null)} className="text-teal-900 hover:opacity-70">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* TARJETA DE SALDO (Mismo diseño y tokens que en Vacaciones.tsx) */}
      <div className="bg-surface-container-lowest border-2 border-primary-container rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-2xl">account_balance_wallet</span>
            <div>
              <h2 className="text-headline-sm font-bold text-primary">
                Mi Saldo de Licencias Particulares — {nombreMesActual} {anioActual}
              </h2>
              <p className="text-label-sm text-on-surface-variant">
                Agente: <span className="font-semibold text-primary">{perfilActual ? `${perfilActual.nombre} ${perfilActual.apellido}` : '—'}</span>
                {perfilActual?.legajo ? ` · Legajo: ${perfilActual.legajo}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalSolicitudAbierto(true)}
            className="inline-flex items-center gap-1.5 px-space-md h-10 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm self-start sm:self-center"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Solicitar Licencia</span>
          </button>
        </div>

        {loadingSaldo ? (
          <div className="py-6 text-center text-outline flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <span>Consultando saldo oficial con el servidor...</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
            {/* 1. Usados este mes */}
            <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
              <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                <span>Usados este mes</span>
                <span className="material-symbols-outlined text-[18px] text-outline">calendar_month</span>
              </div>
              <div className="text-display-md font-bold text-primary mt-1">
                {saldo?.diasUsadosMes ?? 0}
                <span className="text-label-md font-normal text-outline ml-1">/ {saldo?.topeMensual ?? 2} días</span>
              </div>
              <div className="text-label-sm text-outline mt-auto pt-1">
                Disponible: <strong className="text-secondary">{saldo?.disponibleMes ?? 2} días hábiles</strong>
              </div>
            </div>

            {/* 2. Usados este año */}
            <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
              <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                <span>Usados este año</span>
                <span className="material-symbols-outlined text-[18px] text-outline">event_repeat</span>
              </div>
              <div className="text-display-md font-bold text-primary mt-1">
                {saldo?.diasUsadosAnio ?? 0}
                <span className="text-label-md font-normal text-outline ml-1">/ {saldo?.topeAnual ?? 10} días</span>
              </div>
              <div className="text-label-sm text-outline mt-auto pt-1">
                Disponible: <strong className="text-secondary">{saldo?.disponibleAnio ?? 10} días en {anioActual}</strong>
              </div>
            </div>

            {/* 3. Límite por solicitud */}
            <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
              <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                <span>Límite por pedido</span>
                <span className="material-symbols-outlined text-[18px] text-outline">timer</span>
              </div>
              <div className="text-display-md font-bold text-primary mt-1">
                Hasta 2
                <span className="text-label-md font-normal text-outline ml-1">días</span>
              </div>
              <div className="text-label-sm text-outline mt-auto pt-1">Días hábiles por solicitud</div>
            </div>

            {/* 4. Justificativo */}
            <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
              <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                <span>Justificativo</span>
                <span className="material-symbols-outlined text-[18px] text-outline">attach_file</span>
              </div>
              <div className="text-display-md font-bold text-primary mt-1">
                Opcional
              </div>
              <div className="text-label-sm text-outline mt-auto pt-1">Se puede adjuntar luego</div>
            </div>
          </div>
        )}
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {puedeGestionar && (
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant mr-2">
              <button
                type="button"
                onClick={() => setFiltroVista('todas')}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-bold transition-colors ${
                  filtroVista === 'todas'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Todas las Solicitudes ({licencias.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroVista('mias')}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-bold transition-colors ${
                  filtroVista === 'mias'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                Mis Licencias ({licencias.filter((l) => l.profile_id === perfilActual?.id).length})
              </button>
            </div>
          )}

          {/* Filtro por estado */}
          <div className="flex flex-wrap items-center gap-1">
            {(['todas', 'enviada', 'aprobada', 'rechazada', 'cancelada'] as FiltroEstado[]).map((est) => {
              const active = filtroEstado === est;
              const labels: Record<FiltroEstado, string> = {
                todas: 'Todas',
                enviada: 'Pendientes',
                aprobada: 'Aprobadas',
                rechazada: 'Rechazadas',
                cancelada: 'Canceladas',
              };
              return (
                <button
                  key={est}
                  type="button"
                  onClick={() => setFiltroEstado(est)}
                  className={`px-3 py-1.5 rounded-xl text-label-sm font-semibold transition-colors ${
                    active
                      ? 'bg-secondary text-on-secondary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  {labels[est]}
                  {est === 'enviada' && totalPendientesGestion > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-400 text-on-surface">
                      {totalPendientesGestion}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input de búsqueda */}
        <div className="w-full sm:w-72">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por agente, legajo o motivo..."
            className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-sm focus:outline-none focus:border-secondary transition-all"
          />
        </div>
      </div>

      {/* LISTADO DE TARJETAS */}
      {loading ? (
        <div className="py-12 text-center text-outline flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-label-md">Cargando solicitudes de licencias particulares...</span>
        </div>
      ) : licenciasFiltradas.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline mb-3">
            <span className="material-symbols-outlined text-[36px]">event_busy</span>
          </div>
          <h3 className="text-headline-sm font-bold text-primary mb-1">
            No se encontraron solicitudes de licencias particulares
          </h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mb-5">
            {busqueda || filtroEstado !== 'todas'
              ? 'No hay solicitudes que coincidan con los filtros seleccionados.'
              : 'Todavía no hay licencias particulares registradas en el sistema.'}
          </p>
          <button
            type="button"
            onClick={() => setModalSolicitudAbierto(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Solicitar Licencia Particular</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-space-md">
          {licenciasFiltradas.map((l) => {
            const et = ETIQUETA_ESTADO[l.estado] || ETIQUETA_ESTADO.enviada;
            const esDueno = l.profile_id === perfilActual?.id;
            const nombreSolicitante = l.solicitante
              ? `${l.solicitante.nombre} ${l.solicitante.apellido}`
              : 'Agente DDNNA';

            return (
              <div
                key={l.id}
                className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-lg shadow-sm hover:border-secondary transition-all flex flex-col gap-space-md"
              >
                {/* Fila Superior: Datos Principales & Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-container/40 text-secondary flex items-center justify-center font-bold text-label-lg flex-shrink-0">
                      <span className="material-symbols-outlined text-[22px]">event_busy</span>
                    </div>
                    <div>
                      {/* Solicitante si puede gestionar o si es de otro agente */}
                      {(puedeGestionar || !esDueno) && (
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-headline-sm text-primary">
                            {nombreSolicitante}
                          </span>
                          {l.solicitante?.legajo && (
                            <span className="text-label-sm font-mono text-outline">
                              · Legajo: {l.solicitante.legajo}
                            </span>
                          )}
                          {l.solicitante?.area?.nombre && (
                            <span className="px-2 py-0.5 bg-surface-container text-primary font-medium text-label-xs rounded-full">
                              {l.solicitante.area.nombre}
                            </span>
                          )}
                          {l.solicitante?.sub_sedes?.nombre && (
                            <span className="text-label-xs text-outline">
                              · {l.solicitante.sub_sedes.nombre}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="text-headline-sm font-bold text-primary">
                        {formatearFecha(l.fecha_desde)} al {formatearFecha(l.fecha_hasta)}
                      </div>
                      <div className="text-label-sm text-outline">
                        Registrada el {formatearFecha(l.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <div className="text-right">
                      <div className="text-headline-sm font-bold text-primary font-mono">
                        {l.dias_habiles != null ? `${l.dias_habiles} hábiles` : 'Calculando...'}
                      </div>
                      <div className="text-label-xs text-outline">Cómputo oficial del servidor</div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full text-label-sm font-bold border flex items-center gap-1.5 shadow-sm ${et.cls}`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{et.icono}</span>
                      <span>{et.texto}</span>
                    </div>
                  </div>
                </div>

                {/* Detalle, Motivos y Adjunto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  {/* Motivo del solicitante */}
                  {l.motivo && (
                    <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 text-body-sm">
                      <div className="text-label-xs font-bold text-outline uppercase tracking-wider mb-1">
                        Motivo / Justificación:
                      </div>
                      <p className="text-primary">{l.motivo}</p>
                    </div>
                  )}

                  {/* Estado del Adjunto */}
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 text-body-sm flex items-center justify-between gap-2">
                    <div>
                      <div className="text-label-xs font-bold text-outline uppercase tracking-wider mb-0.5">
                        Documentación de Respaldo:
                      </div>
                      <div className="text-label-sm text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-outline">
                          {l.adjunto_path ? 'check_circle' : 'info'}
                        </span>
                        <span>{l.adjunto_nombre || (l.adjunto_path ? 'Comprobante adjunto' : 'Sin justificativo adjunto')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {l.adjunto_path ? (
                        <button
                          type="button"
                          onClick={() => handleVerAdjunto(l.adjunto_path!, l.adjunto_nombre)}
                          className="px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-label-sm font-semibold text-secondary hover:bg-surface-container flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Ver adjunto</span>
                        </button>
                      ) : esDueno && l.estado !== 'cancelada' ? (
                        <button
                          type="button"
                          onClick={() => triggerSubirAdjuntoTardio(l.id)}
                          className="px-3 py-1 bg-surface-container-lowest border border-outline-variant rounded-lg text-label-sm font-semibold text-primary hover:bg-surface-container flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">upload_file</span>
                          <span>Adjuntar ahora</span>
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Motivo de rechazo (obligatorio si rechazada) */}
                  {l.estado === 'rechazada' && (
                    <div className="p-3 bg-error-container text-on-error-container rounded-xl border border-error text-body-sm md:col-span-2">
                      <div className="flex items-center gap-1.5 font-bold text-label-md mb-1 text-error">
                        <span className="material-symbols-outlined text-[18px]">report</span>
                        <span>Fundamento del Rechazo Institucional:</span>
                      </div>
                      <p className="font-medium">{l.comentario_revision || 'Sin motivo detallado.'}</p>
                      <div className="text-label-xs mt-2 text-on-error-container/80 flex items-center gap-2">
                        {l.revisor && (
                          <span>
                            Resuelto por: <strong>{l.revisor.nombre} {l.revisor.apellido}</strong>
                          </span>
                        )}
                        {l.revisado_at && <span>· Fecha: {formatearFecha(l.revisado_at)}</span>}
                      </div>
                    </div>
                  )}

                  {/* Aprobada con comentario */}
                  {l.estado === 'aprobada' && (l.comentario_revision || l.revisor) && (
                    <div className="p-3 bg-teal-50 text-teal-900 rounded-xl border border-teal-200 text-body-sm md:col-span-2">
                      <div className="text-label-xs font-bold text-teal-800 uppercase tracking-wider mb-1">
                        Resolución de Aprobación:
                      </div>
                      {l.comentario_revision && <p className="font-medium">{l.comentario_revision}</p>}
                      <div className="text-label-xs text-teal-700 mt-1 flex items-center gap-2">
                        {l.revisor && (
                          <span>
                            Aprobado por: {l.revisor.nombre} {l.revisor.apellido}
                          </span>
                        )}
                        {l.revisado_at && <span> · {formatearFecha(l.revisado_at)}</span>}
                      </div>
                    </div>
                  )}

                  {/* Cancelada con comentario */}
                  {l.estado === 'cancelada' && l.comentario_revision && (
                    <div className="p-3 bg-surface-container text-on-surface-variant rounded-xl border border-outline-variant text-body-sm md:col-span-2">
                      <div className="text-label-xs font-bold text-outline uppercase tracking-wider mb-1">
                        Motivo de Cancelación:
                      </div>
                      <p>{l.comentario_revision}</p>
                    </div>
                  )}
                </div>

                {/* BARRA DE ACCIONES SEGÚN REGLAS DE NEGOCIO */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
                  {/* Acción 1: Dueño cancela solicitud enviada */}
                  {esDueno && l.estado === 'enviada' && (
                    <button
                      type="button"
                      disabled={procesandoAccion}
                      onClick={() => handleCancelarPropia(l.id)}
                      className="px-4 h-9 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      <span>Cancelar mi solicitud</span>
                    </button>
                  )}

                  {/* Acción 2: Gestión/Administración/responsable aprueba o rechaza solicitud enviada.
                      No se muestra para la solicitud propia, salvo que sea gestión o Administración. */}
                  {puedeGestionar && l.estado === 'enviada' && (!esDueno || esGestion || esAreaAdministracion) && (
                    <>
                      <button
                        type="button"
                        disabled={procesandoAccion}
                        onClick={() => {
                          setSolicitudRechazo(l);
                          setMotivoRechazo('');
                        }}
                        className="px-4 h-9 border border-error text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[18px]">block</span>
                        <span>Rechazar...</span>
                      </button>

                      <button
                        type="button"
                        disabled={procesandoAccion}
                        onClick={() => {
                          setSolicitudAprobacion(l);
                          setComentarioAprobacion('');
                        }}
                        className="px-4 h-9 bg-primary text-on-primary rounded-xl text-label-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        <span>Aprobar Solicitud</span>
                      </button>
                    </>
                  )}

                  {/* Acción 3: Cancelar una ya aprobada — SOLO para gestión o Administración */}
                  {(esGestion || esAreaAdministracion) && l.estado === 'aprobada' && (
                    <button
                      type="button"
                      disabled={procesandoAccion}
                      onClick={() => {
                        setSolicitudCancelacionAprobada(l);
                        setMotivoCancelacionAprobada('');
                      }}
                      className="px-3 h-9 border border-outline-variant text-on-surface-variant rounded-xl text-label-md font-semibold hover:bg-surface-container transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      title="Solo Administración o Gestión puede cancelar una licencia aprobada"
                    >
                      <span className="material-symbols-outlined text-[18px]">event_busy</span>
                      <span>Cancelar licencia aprobada</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: SOLICITAR LICENCIA PARTICULAR */}
      {modalSolicitudAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-lg w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-secondary">event_busy</span>
                <h2 className="text-headline-sm font-bold tracking-tight">
                  Nueva Solicitud de Licencia Particular
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setModalSolicitudAbierto(false)}
                disabled={guardandoSolicitud}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Régimen de Licencias por Razones Particulares: hasta <strong>2 días hábiles</strong> por solicitud, con tope de 2 días/mes y 10 días/año.
            </p>

            {/* Error del servidor o validación */}
            {errorModalSolicitud && (
              <div className="bg-error-container text-on-error-container p-3 rounded-xl border border-error text-body-sm flex items-start gap-2">
                <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0 mt-0.5">error</span>
                <div className="flex-1 font-medium">{errorModalSolicitud}</div>
              </div>
            )}

            <form onSubmit={handleSubmitSolicitud} className="flex flex-col gap-space-md">
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
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all"
                  />
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Fecha Hasta <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              {/* Estimación de Días */}
              {fechaDesde && fechaHasta && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-body-sm transition-all ${
                    estimacionDias > 2
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : estimacionDias > 0
                      ? 'bg-secondary-container/40 border-secondary/40 text-on-surface'
                      : 'bg-surface-container-low border-outline-variant text-outline'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-secondary">calculate</span>
                    <span className="font-medium">
                      {estimacionDias > 0
                        ? `Estimación: ${estimacionDias} día(s) hábil(es)`
                        : 'Verificá el rango de fechas seleccionado'}
                    </span>
                  </div>
                  {estimacionDias > 2 && (
                    <span className="text-label-xs font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-full">
                      Máx. 2 días por pedido
                    </span>
                  )}
                </div>
              )}

              {/* Motivo Opcional */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Motivo / Observación <span className="text-label-sm font-normal text-outline">(opcional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Motivo personal, razones de fuerza mayor, etc..."
                  value={motivoSolicitud}
                  onChange={(e) => setMotivoSolicitud(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              {/* Adjunto Opcional */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Justificativo o Comprobante <span className="text-label-sm font-normal text-outline">(opcional)</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setArchivoAdjunto(e.target.files?.[0] || null)}
                  className="w-full text-label-sm text-outline file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-label-sm file:font-semibold file:bg-surface-container file:text-primary hover:file:bg-surface-container-high transition-colors"
                />
                <span className="text-label-xs text-outline mt-1 block">
                  Podés subir un archivo PDF o imagen ahora, o adjuntarlo después de creada la solicitud.
                </span>
              </div>

              {/* Botones del Modal */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setModalSolicitudAbierto(false)}
                  disabled={guardandoSolicitud}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoSolicitud}
                  className="px-5 h-10 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {guardandoSolicitud ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">send</span>
                      <span>Enviar Solicitud</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECHAZAR SOLICITUD (COMENTARIO OBLIGATORIO) */}
      {solicitudRechazo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-2xl">cancel</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Rechazar Licencia Particular</h2>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudRechazo(null)}
                disabled={procesandoAccion}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-body-sm flex flex-col gap-1">
              <div className="font-semibold text-primary">
                Solicitante: {solicitudRechazo.solicitante ? `${solicitudRechazo.solicitante.nombre} ${solicitudRechazo.solicitante.apellido}` : 'Agente'}
              </div>
              <div className="text-on-surface-variant">
                Período: {formatearFecha(solicitudRechazo.fecha_desde)} al {formatearFecha(solicitudRechazo.fecha_hasta)}
              </div>
              {solicitudRechazo.dias_habiles != null && (
                <div className="text-secondary font-medium">
                  Días: {solicitudRechazo.dias_habiles} hábiles
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmarRechazo} className="flex flex-col gap-space-md">
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Fundamento del Rechazo <span className="text-error">* (Obligatorio)</span>
                </label>
                <textarea
                  required
                  rows={3}
                  autoFocus
                  placeholder="Detallá el motivo del rechazo institucional..."
                  value={motivoRechazo}
                  onChange={(e) => setMotivoRechazo(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setSolicitudRechazo(null)}
                  disabled={procesandoAccion}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAccion || !motivoRechazo.trim()}
                  className="px-5 h-10 bg-error text-on-error font-label-md rounded-xl hover:bg-error/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {procesandoAccion ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin"></div>
                      <span>Procesando...</span>
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
      )}

      {/* MODAL: APROBAR SOLICITUD */}
      {solicitudAprobacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-teal-600">check_circle</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Aprobar Licencia Particular</h2>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudAprobacion(null)}
                disabled={procesandoAccion}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Al confirmar, los días hábiles quedarán computados en el saldo del agente para el mes y año correspondiente.
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Comentario de Aprobación <span className="text-label-sm font-normal text-outline">(opcional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Observación o nota resolutiva..."
                value={comentarioAprobacion}
                onChange={(e) => setComentarioAprobacion(e.target.value)}
                className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setSolicitudAprobacion(null)}
                disabled={procesandoAccion}
                className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoAccion}
                onClick={handleConfirmarAprobar}
                className="px-5 h-10 bg-primary text-on-primary font-label-md rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {procesandoAccion ? (
                  <>
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Aprobando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Confirmar Aprobación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCELAR LICENCIA YA APROBADA (SOLO GESTIÓN / ADMINISTRACIÓN) */}
      {solicitudCancelacionAprobada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-secondary">event_busy</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Cancelar Licencia Aprobada</h2>
              </div>
              <button
                type="button"
                onClick={() => setSolicitudCancelacionAprobada(null)}
                disabled={procesandoAccion}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Esta acción solo está reservada para Gestión y Administración. Al cancelar la licencia aprobada, se restablecen los días al saldo del agente.
            </p>

            <form onSubmit={handleConfirmarCancelarAprobada} className="flex flex-col gap-space-md">
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Motivo Institucional de Cancelación <span className="text-label-sm font-normal text-outline">(opcional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Detallá el motivo por el cual se anula la licencia..."
                  value={motivoCancelacionAprobada}
                  onChange={(e) => setMotivoCancelacionAprobada(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setSolicitudCancelacionAprobada(null)}
                  disabled={procesandoAccion}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={procesandoAccion}
                  className="px-5 h-10 bg-error text-on-error font-label-md rounded-xl hover:bg-error/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {procesandoAccion ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin"></div>
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">event_busy</span>
                      <span>Confirmar Cancelación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VISOR DE ARCHIVOS INTEGRADO */}
      {visor && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setVisor(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden border border-outline-variant"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-outline-variant bg-surface-container-low">
              <div className="flex items-center gap-2 truncate">
                <span className="material-symbols-outlined text-secondary text-[20px]">description</span>
                <span className="text-label-md font-bold text-primary truncate">{visor.nombre}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={visor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-label-sm font-semibold text-secondary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Abrir en pestaña nueva
                </a>
                <button
                  onClick={() => setVisor(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                  title="Cerrar"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-surface-container overflow-auto flex items-center justify-center p-3">
              {visor.esImagen ? (
                <img src={visor.url} alt={visor.nombre} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
              ) : (
                <iframe src={visor.url} title={visor.nombre} className="w-full h-full border-0 rounded-lg bg-white shadow-sm" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
