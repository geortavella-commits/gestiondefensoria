import React, { useEffect, useState, useMemo } from 'react';
import {
  listarSolicitudesVacaciones,
  obtenerSaldoVacaciones,
  getPersonalACargoVacaciones,
  obtenerFeriados,
  cancelarSolicitudPropia,
  aprobarSolicitud,
  cancelarSolicitudAprobada,
  type VacacionSolicitud,
  type SaldoVacaciones,
  type PersonalACargoItem,
  type Feriado,
  type EstadoVacacion,
} from '../../services/vacaciones';
import { esRolGestion } from '../../services/legajo';
import { formatearFecha } from '../../utils/legajoCalculations';
import { SolicitudVacacionesModal } from './SolicitudVacacionesModal';
import { RechazoVacacionesModal } from './RechazoVacacionesModal';
import { LicenciasParticulares } from './LicenciasParticulares';
import type { Profile } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
}

type FiltroEstado = 'todas' | 'enviada' | 'aprobada' | 'rechazada' | 'cancelada';
type VistaTab = 'mias' | 'personal_a_cargo' | 'gestion' | 'licencias';

const ETIQUETA_ESTADO: Record<EstadoVacacion, { texto: string; cls: string; icono: string }> = {
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

export const Vacaciones: React.FC<Props> = ({ perfilActual }) => {
  const currentYear = new Date().getFullYear();
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(currentYear);

  const [saldo, setSaldo] = useState<SaldoVacaciones | null>(null);
  const [solicitudes, setSolicitudes] = useState<VacacionSolicitud[]>([]);
  const [feriados, setFeriados] = useState<Feriado[]>([]);

  // Personal a cargo
  const [personalACargo, setPersonalACargo] = useState<PersonalACargoItem[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  const [personaSeleccionada, setPersonaSeleccionada] = useState<PersonalACargoItem | null>(null);
  const [saldoPersonaSeleccionada, setSaldoPersonaSeleccionada] = useState<SaldoVacaciones | null>(null);
  const [loadingSaldoPersona, setLoadingSaldoPersona] = useState(false);
  const [filtroEstadoPersona, setFiltroEstadoPersona] = useState<FiltroEstado>('todas');

  const [loading, setLoading] = useState(true);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const [vistaTab, setVistaTab] = useState<VistaTab>('mias');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas');
  const [busqueda, setBusqueda] = useState('');

  // Modales y acciones
  const [modalSolicitudAbierto, setModalSolicitudAbierto] = useState(false);
  const [solicitudParaAgente, setSolicitudParaAgente] = useState<{ profileId: string; nombre: string } | null>(null);
  const [solicitudParaRechazo, setSolicitudParaRechazo] = useState<VacacionSolicitud | null>(null);
  const [modalAprobacionId, setModalAprobacionId] = useState<string | null>(null);
  const [comentarioAprobacion, setComentarioAprobacion] = useState('');
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [mostrarFeriados, setMostrarFeriados] = useState(false);

  // Verificación de roles
  const esGestion = esRolGestion(perfilActual?.rol);
  const esAreaAdministracion =
    perfilActual?.areas?.recibe_notas_pedido ||
    perfilActual?.areas?.nombre?.toLowerCase().includes('administra') ||
    false;
  const esResponsableDeEquipo = perfilActual?.rol === 'jefe_area' || perfilActual?.rol === 'referente_subsede';
  const puedeGestionar = esGestion || esAreaAdministracion || esResponsableDeEquipo;

  // Carga inicial y recarga
  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);

      const [solicitudesRes, feriadosRes] = await Promise.all([
        listarSolicitudesVacaciones(),
        obtenerFeriados(),
      ]);

      setSolicitudes(solicitudesRes);
      setFeriados(feriadosRes);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las solicitudes de vacaciones.');
    } finally {
      setLoading(false);
    }
  };

  const cargarSaldo = async (anio: number, profileId?: string) => {
    if (!profileId) return;
    try {
      setLoadingSaldo(true);
      const resSaldo = await obtenerSaldoVacaciones(profileId, anio);
      setSaldo(resSaldo);
    } catch (err: any) {
      console.error('Error al cargar saldo:', err);
      setError(err.message || 'No se pudo consultar el saldo de vacaciones.');
    } finally {
      setLoadingSaldo(false);
    }
  };

  const cargarPersonal = async (anio: number) => {
    try {
      setLoadingPersonal(true);
      const data = await getPersonalACargoVacaciones(anio);
      setPersonalACargo(data);
    } catch (err: any) {
      console.error('Error al cargar personal a cargo:', err);
    } finally {
      setLoadingPersonal(false);
    }
  };

  const cargarSaldoPersona = async (profileId: string, anio: number) => {
    try {
      setLoadingSaldoPersona(true);
      const res = await obtenerSaldoVacaciones(profileId, anio);
      setSaldoPersonaSeleccionada(res);
    } catch (err: any) {
      console.error('Error al cargar saldo de la persona seleccionada:', err);
    } finally {
      setLoadingSaldoPersona(false);
    }
  };

  const recargarTodo = async () => {
    const promises: Promise<any>[] = [cargarDatos()];
    if (perfilActual?.id) {
      promises.push(cargarSaldo(anioSeleccionado, perfilActual.id));
    }
    if (puedeGestionar) {
      promises.push(cargarPersonal(anioSeleccionado));
    }
    if (personaSeleccionada?.profileId) {
      promises.push(cargarSaldoPersona(personaSeleccionada.profileId, anioSeleccionado));
    }
    await Promise.all(promises);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (perfilActual?.id) {
      cargarSaldo(anioSeleccionado, perfilActual.id);
    }
    if (puedeGestionar) {
      cargarPersonal(anioSeleccionado);
    }
    if (personaSeleccionada?.profileId) {
      cargarSaldoPersona(personaSeleccionada.profileId, anioSeleccionado);
    }
  }, [perfilActual?.id, anioSeleccionado, puedeGestionar, personaSeleccionada?.profileId]);

  // Helpers y filtrados
  const getSaldoBadge = (saldoFinal: number | null) => {
    if (saldoFinal === null) {
      return {
        texto: 'Sin cupo',
        cls: 'bg-surface-container text-outline border-outline-variant',
        icono: 'help_outline',
      };
    }
    if (saldoFinal <= 0) {
      return {
        texto: `${saldoFinal} días`,
        cls: 'bg-error-container text-on-error-container border-error',
        icono: 'warning',
      };
    }
    if (saldoFinal <= 5) {
      return {
        texto: `${saldoFinal} días`,
        cls: 'bg-amber-100 text-amber-900 border-amber-300',
        icono: 'schedule',
      };
    }
    return {
      texto: `${saldoFinal} días`,
      cls: 'bg-teal-100 text-teal-900 border-teal-300',
      icono: 'check_circle',
    };
  };

  // Solicitudes pendientes totales (para el badge de gestión)
  const totalPendientesGestion = useMemo(
    () => solicitudes.filter((s) => s.estado === 'enviada').length,
    [solicitudes]
  );

  // Filtrado de solicitudes en Mis Vacaciones y Gestión
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((s) => {
      // Filtro de pestaña
      if (vistaTab === 'mias') {
        if (s.profile_id !== perfilActual?.id) return false;
      }

      // Filtro de estado
      if (filtroEstado !== 'todas' && s.estado !== filtroEstado) {
        return false;
      }

      // Filtro de búsqueda (en vista de gestión)
      if (busqueda.trim()) {
        const q = busqueda.trim().toLowerCase();
        const solicitanteNombre = s.solicitante
          ? `${s.solicitante.nombre} ${s.solicitante.apellido}`.toLowerCase()
          : '';
        const legajo = s.solicitante?.legajo?.toLowerCase() || '';
        const area = s.solicitante?.area?.nombre?.toLowerCase() || '';
        const comentario = (s.comentario || '').toLowerCase();

        return (
          solicitanteNombre.includes(q) ||
          legajo.includes(q) ||
          area.includes(q) ||
          comentario.includes(q)
        );
      }

      return true;
    });
  }, [solicitudes, vistaTab, filtroEstado, busqueda, perfilActual?.id]);

  // Filtrado de personal a cargo
  const personalACargoFiltrado = useMemo(() => {
    if (!busquedaEquipo.trim()) return personalACargo;
    const q = busquedaEquipo.trim().toLowerCase();
    return personalACargo.filter((p) => {
      const nombreCompleto = `${p.nombre} ${p.apellido}`.toLowerCase();
      const dni = (p.dni || '').toLowerCase();
      const cargo = (p.cargo || '').toLowerCase();
      const area = (p.areaNombre || '').toLowerCase();
      const subSede = (p.subSedeNombre || '').toLowerCase();
      return (
        nombreCompleto.includes(q) ||
        dni.includes(q) ||
        cargo.includes(q) ||
        area.includes(q) ||
        subSede.includes(q)
      );
    });
  }, [personalACargo, busquedaEquipo]);

  // Solicitudes de la persona seleccionada en Personal a Cargo
  const solicitudesPersonaSeleccionada = useMemo(() => {
    if (!personaSeleccionada) return [];
    return solicitudes.filter((s) => {
      if (s.profile_id !== personaSeleccionada.profileId) return false;
      if (filtroEstadoPersona !== 'todas' && s.estado !== filtroEstadoPersona) return false;
      return true;
    });
  }, [solicitudes, personaSeleccionada, filtroEstadoPersona]);

  // Acciones
  const handleCancelarPropia = async (solicitudId: string) => {
    if (!confirm('¿Estás seguro de que deseás cancelar esta solicitud de vacaciones?')) {
      return;
    }
    try {
      setProcesandoAccion(true);
      setError(null);
      await cancelarSolicitudPropia(solicitudId);
      setMensajeExito('Solicitud cancelada correctamente.');
      setTimeout(() => setMensajeExito(null), 4000);
      await recargarTodo();
    } catch (err: any) {
      setError(err.message || 'No se pudo cancelar la solicitud.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleAprobar = async (solicitudId: string) => {
    try {
      setProcesandoAccion(true);
      setError(null);
      await aprobarSolicitud(solicitudId, comentarioAprobacion);
      setModalAprobacionId(null);
      setComentarioAprobacion('');
      setMensajeExito('Solicitud aprobada con éxito.');
      setTimeout(() => setMensajeExito(null), 4000);
      await recargarTodo();
    } catch (err: any) {
      setError(err.message || 'No se pudo aprobar la solicitud.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleCancelarAprobada = async (solicitudId: string) => {
    const motivo = prompt('Ingresá el motivo institucional para cancelar esta vacación ya aprobada:');
    if (motivo === null) return;

    try {
      setProcesandoAccion(true);
      setError(null);
      await cancelarSolicitudAprobada(solicitudId, motivo);
      setMensajeExito('Se canceló la vacación aprobada.');
      setTimeout(() => setMensajeExito(null), 4000);
      await recargarTodo();
    } catch (err: any) {
      setError(err.message || 'No se pudo cancelar la solicitud aprobada.');
    } finally {
      setProcesandoAccion(false);
    }
  };

  // Renderizador de tarjeta de solicitud
  const renderTarjetaSolicitud = (s: VacacionSolicitud, mostrarSolicitante: boolean = false) => {
    const et = ETIQUETA_ESTADO[s.estado] || ETIQUETA_ESTADO.enviada;
    const esDueno = s.profile_id === perfilActual?.id;
    const nombreSolicitante = s.solicitante
      ? `${s.solicitante.nombre} ${s.solicitante.apellido}`
      : 'Agente DDNNA';

    return (
      <div
        key={s.id}
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-lg shadow-sm hover:border-secondary transition-all flex flex-col gap-space-md"
      >
        {/* Fila Superior: Datos Principales & Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-container/40 text-secondary flex items-center justify-center font-bold text-label-lg flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">date_range</span>
            </div>
            <div>
              {mostrarSolicitante && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-headline-sm text-primary">
                    {nombreSolicitante}
                  </span>
                  {s.solicitante?.legajo && (
                    <span className="text-label-sm font-mono text-outline">
                      · Legajo: {s.solicitante.legajo}
                    </span>
                  )}
                  {s.solicitante?.area?.nombre && (
                    <span className="px-2 py-0.5 bg-surface-container text-primary font-medium text-label-xs rounded-full">
                      {s.solicitante.area.nombre}
                    </span>
                  )}
                  {s.solicitante?.sub_sedes?.nombre && (
                    <span className="text-label-xs text-outline">
                      · {s.solicitante.sub_sedes.nombre}
                    </span>
                  )}
                </div>
              )}
              <div className="text-headline-sm font-bold text-primary">
                {formatearFecha(s.fecha_desde)} al {formatearFecha(s.fecha_hasta)}
              </div>
              <div className="text-label-sm text-outline">
                Registrada el {formatearFecha(s.created_at)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <div className="text-right">
              <div className="text-headline-sm font-bold text-primary font-mono">
                {s.dias_habiles != null ? `${s.dias_habiles} hábiles` : 'Calculando...'}
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

        {/* Detalle / Comentarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {/* Comentario del solicitante */}
          {s.comentario && (
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60 text-body-sm">
              <div className="text-label-xs font-bold text-outline uppercase tracking-wider mb-1">
                Motivo / Observaciones del Solicitante:
              </div>
              <p className="text-primary">{s.comentario}</p>
            </div>
          )}

          {/* Comentario de revisión (Obligatorio mostrar si fue rechazada) */}
          {s.estado === 'rechazada' && (
            <div className="p-3 bg-error-container text-on-error-container rounded-xl border border-error text-body-sm md:col-span-2">
              <div className="flex items-center gap-1.5 font-bold text-label-md mb-1 text-error">
                <span className="material-symbols-outlined text-[18px]">report</span>
                <span>Fundamento del Rechazo Institucional:</span>
              </div>
              <p className="font-medium">{s.comentario_revision || 'Sin motivo detallado.'}</p>
              <div className="text-label-xs mt-2 text-on-error-container/80 flex items-center gap-2">
                {s.revisor && (
                  <span>
                    Resuelto por: <strong>{s.revisor.nombre} {s.revisor.apellido}</strong>
                  </span>
                )}
                {s.revisado_at && <span>· Fecha: {formatearFecha(s.revisado_at)}</span>}
                <span>· Habilita arrastre para el próximo año</span>
              </div>
            </div>
          )}

          {/* Si está aprobada con comentario */}
          {s.estado === 'aprobada' && (s.comentario_revision || s.revisor) && (
            <div className="p-3 bg-teal-50 text-teal-900 rounded-xl border border-teal-200 text-body-sm">
              <div className="text-label-xs font-bold text-teal-800 uppercase tracking-wider mb-1">
                Resolución de Aprobación:
              </div>
              {s.comentario_revision && <p className="font-medium">{s.comentario_revision}</p>}
              <div className="text-label-xs text-teal-700 mt-1">
                {s.revisor && (
                  <span>
                    Aprobado por: {s.revisor.nombre} {s.revisor.apellido}
                  </span>
                )}
                {s.revisado_at && <span> · {formatearFecha(s.revisado_at)}</span>}
              </div>
            </div>
          )}

          {/* Si está cancelada con comentario */}
          {s.estado === 'cancelada' && s.comentario_revision && (
            <div className="p-3 bg-surface-container text-on-surface-variant rounded-xl border border-outline-variant text-body-sm">
              <div className="text-label-xs font-bold text-outline uppercase tracking-wider mb-1">
                Motivo de Cancelación:
              </div>
              <p>{s.comentario_revision}</p>
            </div>
          )}
        </div>

        {/* BARRA DE ACCIONES SEGÚN REGLAS DE NEGOCIO */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-outline-variant/60">
          {/* Acción 1: Dueño cancela solicitud enviada */}
          {esDueno && s.estado === 'enviada' && (
            <button
              type="button"
              disabled={procesandoAccion}
              onClick={() => handleCancelarPropia(s.id)}
              className="px-4 h-9 border border-error/40 text-error rounded-xl text-label-md font-semibold hover:bg-error-container/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              <span>Cancelar mi solicitud</span>
            </button>
          )}

          {/* Acción 2: Gestión/Administración/responsable del área o sub-sede aprueba o
              rechaza una solicitud enviada — pero nadie resuelve la propia salvo gestión
              o Administración (así lo bloquea el trigger validar_solicitud_vacaciones). */}
          {puedeGestionar && s.estado === 'enviada' && (!esDueno || esGestion || esAreaAdministracion) && (
            <>
              <button
                type="button"
                disabled={procesandoAccion}
                onClick={() => setSolicitudParaRechazo(s)}
                className="px-4 h-9 border border-error text-error rounded-xl text-label-md font-semibold hover:bg-error-container/30 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">block</span>
                <span>Rechazar...</span>
              </button>

              <button
                type="button"
                disabled={procesandoAccion}
                onClick={() => setModalAprobacionId(s.id)}
                className="px-4 h-9 bg-primary text-on-primary rounded-xl text-label-md font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Aprobar Solicitud</span>
              </button>
            </>
          )}

          {/* Acción 3: cancelar una vacación YA aprobada es más sensible — el trigger solo
              lo deja a gestión o al área Administración, ni siquiera al jefe de área o
              referente de sub-sede que sí pueden aprobar/rechazar. */}
          {(esGestion || esAreaAdministracion) && s.estado === 'aprobada' && (
            <button
              type="button"
              disabled={procesandoAccion}
              onClick={() => handleCancelarAprobada(s.id)}
              className="px-3 h-9 border border-outline-variant text-on-surface-variant rounded-xl text-label-md font-semibold hover:bg-surface-container transition-colors disabled:opacity-50 flex items-center gap-1.5"
              title="Solo administración o gestión puede cancelar una vacación aprobada"
            >
              <span className="material-symbols-outlined text-[18px]">event_busy</span>
              <span>Cancelar vacación aprobada</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg text-on-surface font-body-md">
      {/* HEADER DE SECCIÓN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant pb-space-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl text-secondary">beach_access</span>
            <h1 className="text-headline-lg font-bold text-primary tracking-tight">
              Módulo de Vacaciones
            </h1>
          </div>
          <p className="text-body-md text-on-surface-variant mt-1">
            Gestión y seguimiento de licencias ordinarias y recesos anuales con cómputo oficial de días hábiles.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Selector de Año Global */}
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant">
            <button
              type="button"
              onClick={() => setAnioSeleccionado((prev) => prev - 1)}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              title="Año anterior"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="px-3 text-label-md font-bold text-primary font-mono">{anioSeleccionado}</span>
            <button
              type="button"
              onClick={() => setAnioSeleccionado((prev) => prev + 1)}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              title="Año siguiente"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMostrarFeriados(!mostrarFeriados)}
            className="inline-flex items-center gap-1.5 px-3 h-10 border border-outline-variant rounded-xl text-label-md font-semibold text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">event</span>
            <span>{mostrarFeriados ? 'Ocultar Feriados' : 'Ver Feriados'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSolicitudParaAgente(null);
              setModalSolicitudAbierto(true);
            }}
            className="inline-flex items-center gap-1.5 px-space-md h-10 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Solicitar Mis Vacaciones</span>
          </button>
        </div>
      </div>

      {/* MENSAJES DE ERROR Y ÉXITO */}
      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm flex items-start justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[20px] text-error flex-shrink-0 mt-0.5">
              error
            </span>
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

      {/* SECCIÓN OPCIONAL COLAPSABLE: FERIADOS OFICIALES */}
      {mostrarFeriados && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md flex flex-col gap-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
            <div className="flex items-center gap-2 text-primary font-bold text-headline-sm">
              <span className="material-symbols-outlined text-secondary text-[20px]">calendar_today</span>
              <span>Feriados y Días No Laborables Registrados</span>
            </div>
            <span className="text-label-sm text-outline">Tabla institucional de solo lectura</span>
          </div>

          {feriados.length === 0 ? (
            <p className="text-label-md text-outline italic">No hay feriados cargados en la base de datos.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {feriados.map((f) => (
                <div
                  key={f.fecha}
                  className="p-2 bg-surface-container-low rounded-lg border border-outline-variant/40 flex items-center justify-between text-body-sm"
                >
                  <span className="font-semibold text-primary">{f.nombre}</span>
                  <span className="text-label-sm font-mono text-outline">{formatearFecha(f.fecha)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑAS PRINCIPALES: MIS VACACIONES vs PERSONAL A CARGO vs GESTIÓN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setVistaTab('mias');
              setPersonaSeleccionada(null);
            }}
            className={`px-4 py-2 rounded-xl font-label-md font-bold transition-all flex items-center gap-2 ${
              vistaTab === 'mias'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            <span>Mis Vacaciones</span>
          </button>

          {puedeGestionar && (
            <button
              type="button"
              onClick={() => {
                setVistaTab('personal_a_cargo');
                setPersonaSeleccionada(null);
              }}
              className={`px-4 py-2 rounded-xl font-label-md font-bold transition-all flex items-center gap-2 ${
                vistaTab === 'personal_a_cargo'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">groups</span>
              <span>Personal a Cargo</span>
              {personalACargo.length > 0 && (
                <span className="px-2 py-0.5 bg-secondary-container text-secondary font-bold text-label-xs rounded-full">
                  {personalACargo.length}
                </span>
              )}
            </button>
          )}

          {puedeGestionar && (
            <button
              type="button"
              onClick={() => {
                setVistaTab('gestion');
                setPersonaSeleccionada(null);
              }}
              className={`px-4 py-2 rounded-xl font-label-md font-bold transition-all flex items-center gap-2 ${
                vistaTab === 'gestion'
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
              <span>Gestión de Solicitudes</span>
              {totalPendientesGestion > 0 && (
                <span className="px-2 py-0.5 bg-amber-400 text-on-surface font-bold text-label-xs rounded-full">
                  {totalPendientesGestion}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setVistaTab('licencias');
              setPersonaSeleccionada(null);
            }}
            className={`px-4 py-2 rounded-xl font-label-md font-bold transition-all flex items-center gap-2 ${
              vistaTab === 'licencias'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">event_busy</span>
            <span>Licencias Particulares</span>
          </button>
        </div>

        {/* Búsqueda en vista de gestión plana */}
        {vistaTab === 'gestion' && (
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar agente, área o motivo..."
              className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-xl text-body-sm focus:outline-none focus:border-secondary transition-all"
            />
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* VISTA 1: MIS VACACIONES (PROPIAS)                        */}
      {/* ======================================================== */}
      {vistaTab === 'mias' && (
        <div className="flex flex-col gap-space-lg">
          {/* TARJETA DE SALDO PROPIO */}
          <div className="bg-surface-container-lowest border-2 border-primary-container rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">account_balance_wallet</span>
                <div>
                  <h2 className="text-headline-sm font-bold text-primary">
                    Mi Saldo de Vacaciones — Ejercicio {anioSeleccionado}
                  </h2>
                  <p className="text-label-sm text-on-surface-variant">
                    Agente: <span className="font-semibold text-primary">{perfilActual ? `${perfilActual.nombre} ${perfilActual.apellido}` : '—'}</span>
                    {perfilActual?.legajo ? ` · Legajo: ${perfilActual.legajo}` : ''}
                  </p>
                </div>
              </div>
            </div>

            {loadingSaldo ? (
              <div className="py-6 text-center text-outline flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                <span>Calculando saldo y arrastres con el servidor...</span>
              </div>
            ) : saldo?.dias_asignados === null ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-2xl flex-shrink-0">
                  info
                </span>
                <div>
                  <h4 className="text-label-lg font-bold">Sin días de vacaciones cargados</h4>
                  <p className="text-body-sm mt-0.5">
                    Tu legajo aún no tiene asignado el cupo anual de vacaciones en el sistema para este período.
                    Comunicate con Administración o Coordinación para que registren tus días correspondientes en tu perfil.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
                  <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
                    <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                      <span>Asignados {anioSeleccionado}</span>
                      <span className="material-symbols-outlined text-[18px] text-outline">event_note</span>
                    </div>
                    <div className="text-display-md font-bold text-primary mt-1">
                      {saldo?.dias_asignados}
                      <span className="text-label-md font-normal text-outline ml-1">días</span>
                    </div>
                    <div className="text-label-sm text-outline mt-auto pt-1">Cupo base institucional</div>
                  </div>

                  <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
                    <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                      <span>Arrastrados de {anioSeleccionado - 1}</span>
                      <span className="material-symbols-outlined text-[18px] text-secondary">history</span>
                    </div>
                    <div className="text-display-md font-bold text-secondary mt-1">
                      +{saldo?.dias_arrastrados ?? 0}
                      <span className="text-label-md font-normal text-outline ml-1">días</span>
                    </div>
                    <div className="text-label-sm text-outline mt-auto pt-1">
                      {saldo && saldo.dias_arrastrados > 0 ? 'Por rechazo previo' : 'Sin remanente acumulable'}
                    </div>
                  </div>

                  <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
                    <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                      <span>Días Aprobados (Usados)</span>
                      <span className="material-symbols-outlined text-[18px] text-outline">done_all</span>
                    </div>
                    <div className="text-display-md font-bold text-on-surface mt-1">
                      -{saldo?.dias_aprobados ?? 0}
                      <span className="text-label-md font-normal text-outline ml-1">días</span>
                    </div>
                    <div className="text-label-sm text-outline mt-auto pt-1">Gozados en {anioSeleccionado}</div>
                  </div>

                  <div className="p-space-md bg-secondary-container/40 rounded-xl border-2 border-secondary/40 flex flex-col">
                    <div className="text-label-sm font-bold text-secondary flex items-center justify-between">
                      <span>Saldo Disponible</span>
                      <span className="material-symbols-outlined text-[20px] text-secondary">check_circle</span>
                    </div>
                    <div className="text-display-lg font-bold text-primary mt-1">
                      {saldo?.saldo_final ?? 0}
                      <span className="text-label-md font-normal text-primary ml-1">días hábiles</span>
                    </div>
                    <div className="text-label-sm text-on-surface-variant font-medium mt-auto pt-1">
                      {saldo?.dias_asignados} + {saldo?.dias_arrastrados} − {saldo?.dias_aprobados} = {saldo?.saldo_final}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-body-sm">
                  <div className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-secondary text-[20px] flex-shrink-0 mt-0.5">
                      info
                    </span>
                    <div>
                      <strong className="text-primary">Regla institucional sobre el arrastre de vacaciones: </strong>
                      <span className="text-on-surface-variant">
                        El saldo no utilizado a fin de año no se acumula de forma automática.
                        <strong> Solo se acumula si tuviste al menos una solicitud rechazada por razones de servicio en el ciclo anterior.</strong>
                      </span>
                    </div>
                  </div>

                  {saldo && saldo.dias_arrastrados > 0 && (
                    <div className="px-3 py-1 bg-teal-50 border border-teal-300 text-teal-900 rounded-lg text-label-sm font-semibold whitespace-nowrap flex items-center gap-1.5 self-start sm:self-center">
                      <span className="material-symbols-outlined text-[16px] text-teal-700">verified</span>
                      <span>{saldo.dias_arrastrados} días sumados por rechazo</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* FILTROS POR ESTADO */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-label-sm font-semibold text-outline mr-1">Filtrar por:</span>
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'enviada', label: 'Enviadas (Por resolver)' },
                { id: 'aprobada', label: 'Aprobadas' },
                { id: 'rechazada', label: 'Rechazadas' },
                { id: 'cancelada', label: 'Canceladas' },
              ] as { id: FiltroEstado; label: string }[]
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFiltroEstado(chip.id)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-semibold border transition-all ${
                  filtroEstado === chip.id
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* LISTADO DE MIS SOLICITUDES */}
          {loading ? (
            <div className="p-12 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
              <span>Cargando mis solicitudes...</span>
            </div>
          ) : solicitudesFiltradas.length === 0 ? (
            <div className="p-12 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl text-outline">beach_access</span>
              <div className="text-headline-sm font-semibold text-primary">No hay solicitudes registradas</div>
              <p className="text-body-sm text-on-surface-variant">
                Todavía no solicitaste vacaciones con tu usuario. Podés generar una nueva solicitud haciendo clic en "Solicitar Mis Vacaciones".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-space-md">
              {solicitudesFiltradas.map((s) => renderTarjetaSolicitud(s, false))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 2: PERSONAL A CARGO                                */}
      {/* ======================================================== */}
      {vistaTab === 'personal_a_cargo' && (
        <div className="flex flex-col gap-space-lg">
          {!personaSeleccionada ? (
            /* SUBVISTA 2.1: LISTADO GENERAL DE PERSONAL A CARGO */
            <div className="flex flex-col gap-space-md">
              {/* Barra de búsqueda y conteo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-2xl border border-outline-variant shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={busquedaEquipo}
                    onChange={(e) => setBusquedaEquipo(e.target.value)}
                    placeholder="Buscar por nombre, DNI, cargo, área o sub-sede..."
                    className="w-full h-10 pl-10 pr-3 bg-surface border border-outline-variant rounded-xl text-body-sm focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div className="text-label-sm text-outline font-medium flex items-center gap-2">
                  <span>Ejercicio: <strong className="text-primary font-mono">{anioSeleccionado}</strong></span>
                  <span>·</span>
                  <span>
                    Total: <strong className="text-primary">{personalACargoFiltrado.length}</strong> {personalACargoFiltrado.length === 1 ? 'persona' : 'personas'}
                  </span>
                </div>
              </div>

              {loadingPersonal ? (
                <div className="p-12 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
                  <span>Cargando personal a cargo...</span>
                </div>
              ) : personalACargo.length === 0 ? (
                <div className="p-12 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-4xl text-outline">group_off</span>
                  <div className="text-headline-sm font-semibold text-primary">Sin personal a cargo asignado</div>
                  <p className="text-body-sm text-on-surface-variant">
                    No se encontraron agentes registrados bajo tu supervisión directa o alcance institucional.
                  </p>
                </div>
              ) : personalACargoFiltrado.length === 0 ? (
                <div className="p-8 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-3xl text-outline">search_off</span>
                  <div className="text-headline-sm font-semibold text-primary">Sin resultados</div>
                  <p className="text-body-sm text-on-surface-variant">
                    No se encontraron personas a cargo que coincidan con "{busquedaEquipo}".
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant bg-surface-container-low/60 text-label-sm font-bold text-outline uppercase tracking-wider">
                        <th className="py-3 px-4">Agente</th>
                        <th className="py-3 px-4">Área / Sub-Sede</th>
                        <th className="py-3 px-4 text-center">Días Asignados ({anioSeleccionado})</th>
                        <th className="py-3 px-4 text-center">Saldo Disponible</th>
                        <th className="py-3 px-4 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/60">
                      {personalACargoFiltrado.map((persona) => {
                        const badge = getSaldoBadge(persona.saldoFinal);
                        return (
                          <tr
                            key={persona.profileId}
                            onClick={() => {
                              setPersonaSeleccionada(persona);
                              cargarSaldoPersona(persona.profileId, anioSeleccionado);
                            }}
                            className="hover:bg-surface-container-low/60 cursor-pointer transition-colors group"
                          >
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-secondary-container/40 text-secondary flex items-center justify-center font-bold text-label-md flex-shrink-0 group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                                  {persona.nombre.charAt(0)}{persona.apellido.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-primary group-hover:text-secondary transition-colors">
                                    {persona.nombre} {persona.apellido}
                                  </div>
                                  <div className="text-label-xs text-outline flex items-center gap-2">
                                    {persona.dni && <span>DNI: {persona.dni}</span>}
                                    {persona.cargo && <span>· {persona.cargo}</span>}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex flex-col gap-0.5">
                                {persona.areaNombre && (
                                  <span className="inline-flex items-center self-start px-2 py-0.5 bg-surface-container text-primary text-label-xs font-semibold rounded-md">
                                    {persona.areaNombre}
                                  </span>
                                )}
                                {persona.subSedeNombre && (
                                  <span className="text-label-xs text-outline">
                                    {persona.subSedeNombre}
                                  </span>
                                )}
                                {!persona.areaNombre && !persona.subSedeNombre && (
                                  <span className="text-label-xs text-outline">—</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="font-bold text-primary font-mono text-body-md">
                                {persona.diasAsignados}
                              </span>
                              <span className="text-label-xs text-outline ml-1">días</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-sm font-bold border shadow-xs ${badge.cls}`}
                              >
                                <span className="material-symbols-outlined text-[16px]">{badge.icono}</span>
                                <span>{badge.texto}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <span className="inline-flex items-center gap-1 text-label-md font-semibold text-secondary group-hover:underline">
                                <span>Ver Detalle</span>
                                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* SUBVISTA 2.2: DETALLE DEL AGENTE SELECCIONADO */
            <div className="flex flex-col gap-space-lg animate-fadeIn">
              {/* Encabezado del Agente con Volver & Registrar Vacación */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-2xl border-2 border-primary-container shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPersonaSeleccionada(null)}
                    className="p-2 border border-outline-variant rounded-xl hover:bg-surface-container text-primary transition-colors flex items-center justify-center"
                    title="Volver al listado de Personal a Cargo"
                  >
                    <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  </button>
                  <div className="w-12 h-12 rounded-2xl bg-secondary-container/50 text-secondary flex items-center justify-center font-bold text-headline-sm flex-shrink-0">
                    {personaSeleccionada.nombre.charAt(0)}{personaSeleccionada.apellido.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-headline-md font-bold text-primary">
                        {personaSeleccionada.nombre} {personaSeleccionada.apellido}
                      </h2>
                      {personaSeleccionada.areaNombre && (
                        <span className="px-2.5 py-0.5 bg-surface-container text-primary font-semibold text-label-xs rounded-full">
                          {personaSeleccionada.areaNombre}
                        </span>
                      )}
                      {personaSeleccionada.subSedeNombre && (
                        <span className="px-2.5 py-0.5 bg-surface-container-low text-on-surface-variant font-medium text-label-xs rounded-full border border-outline-variant">
                          {personaSeleccionada.subSedeNombre}
                        </span>
                      )}
                    </div>
                    <div className="text-label-sm text-on-surface-variant flex items-center gap-3 flex-wrap mt-0.5">
                      {personaSeleccionada.dni && <span>DNI: <strong>{personaSeleccionada.dni}</strong></span>}
                      {personaSeleccionada.cargo && <span>Cargo: <strong>{personaSeleccionada.cargo}</strong></span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSolicitudParaAgente({
                        profileId: personaSeleccionada.profileId,
                        nombre: `${personaSeleccionada.nombre} ${personaSeleccionada.apellido}`,
                      });
                      setModalSolicitudAbierto(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-space-md h-10 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    <span>Registrar Vacación</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta de Saldo del Agente */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
                  <div className="flex items-center gap-2 text-primary font-bold text-headline-sm">
                    <span className="material-symbols-outlined text-secondary text-2xl">account_balance_wallet</span>
                    <span>Saldo de Vacaciones — Ejercicio {anioSeleccionado}</span>
                  </div>
                </div>

                {loadingSaldoPersona ? (
                  <div className="py-6 text-center text-outline flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                    <span>Consultando saldo oficial del agente...</span>
                  </div>
                ) : saldoPersonaSeleccionada?.dias_asignados === null ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-2xl flex-shrink-0">info</span>
                    <div>
                      <h4 className="text-label-lg font-bold">Sin días de vacaciones cargados para este año</h4>
                      <p className="text-body-sm mt-0.5">
                        Este agente aún no tiene asignado el cupo anual en el sistema para el período {anioSeleccionado}.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-space-md">
                    <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
                      <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                        <span>Asignados {anioSeleccionado}</span>
                        <span className="material-symbols-outlined text-[18px] text-outline">event_note</span>
                      </div>
                      <div className="text-display-md font-bold text-primary mt-1">
                        {saldoPersonaSeleccionada?.dias_asignados}
                        <span className="text-label-md font-normal text-outline ml-1">días</span>
                      </div>
                      <div className="text-label-sm text-outline mt-auto pt-1">Cupo base anual</div>
                    </div>

                    <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
                      <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                        <span>Arrastrados de {anioSeleccionado - 1}</span>
                        <span className="material-symbols-outlined text-[18px] text-secondary">history</span>
                      </div>
                      <div className="text-display-md font-bold text-secondary mt-1">
                        +{saldoPersonaSeleccionada?.dias_arrastrados ?? 0}
                        <span className="text-label-md font-normal text-outline ml-1">días</span>
                      </div>
                      <div className="text-label-sm text-outline mt-auto pt-1">
                        {saldoPersonaSeleccionada && saldoPersonaSeleccionada.dias_arrastrados > 0 ? 'Por rechazo previo' : 'Sin remanente'}
                      </div>
                    </div>

                    <div className="p-space-md bg-surface-container-low rounded-xl border border-outline-variant/60 flex flex-col">
                      <div className="text-label-sm font-medium text-on-surface-variant flex items-center justify-between">
                        <span>Días Aprobados (Usados)</span>
                        <span className="material-symbols-outlined text-[18px] text-outline">done_all</span>
                      </div>
                      <div className="text-display-md font-bold text-on-surface mt-1">
                        -{saldoPersonaSeleccionada?.dias_aprobados ?? 0}
                        <span className="text-label-md font-normal text-outline ml-1">días</span>
                      </div>
                      <div className="text-label-sm text-outline mt-auto pt-1">Gozados en {anioSeleccionado}</div>
                    </div>

                    <div className="p-space-md bg-secondary-container/40 rounded-xl border-2 border-secondary/40 flex flex-col">
                      <div className="text-label-sm font-bold text-secondary flex items-center justify-between">
                        <span>Saldo Disponible</span>
                        <span className="material-symbols-outlined text-[20px] text-secondary">check_circle</span>
                      </div>
                      <div className="text-display-lg font-bold text-primary mt-1">
                        {saldoPersonaSeleccionada?.saldo_final ?? 0}
                        <span className="text-label-md font-normal text-primary ml-1">días hábiles</span>
                      </div>
                      <div className="text-label-sm text-on-surface-variant font-medium mt-auto pt-1">
                        {saldoPersonaSeleccionada?.dias_asignados} + {saldoPersonaSeleccionada?.dias_arrastrados} − {saldoPersonaSeleccionada?.dias_aprobados} = {saldoPersonaSeleccionada?.saldo_final}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Historial de Solicitudes del Agente */}
              <div className="flex flex-col gap-space-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[22px]">list_alt</span>
                    <h3 className="text-headline-sm font-bold text-primary">
                      Historial de Solicitudes ({solicitudesPersonaSeleccionada.length})
                    </h3>
                  </div>

                  {/* Filtro por estado de la persona */}
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {(
                      [
                        { id: 'todas', label: 'Todas' },
                        { id: 'enviada', label: 'Enviadas' },
                        { id: 'aprobada', label: 'Aprobadas' },
                        { id: 'rechazada', label: 'Rechazadas' },
                        { id: 'cancelada', label: 'Canceladas' },
                      ] as { id: FiltroEstado; label: string }[]
                    ).map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setFiltroEstadoPersona(chip.id)}
                        className={`px-2.5 py-1 rounded-lg text-label-sm font-semibold border transition-all ${
                          filtroEstadoPersona === chip.id
                            ? 'bg-primary text-on-primary border-primary shadow-xs'
                            : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {solicitudesPersonaSeleccionada.length === 0 ? (
                  <div className="p-8 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-outline">beach_access</span>
                    <div className="text-headline-sm font-semibold text-primary">Sin solicitudes registradas</div>
                    <p className="text-body-sm text-on-surface-variant">
                      Este agente no tiene solicitudes de vacaciones que coincidan con el filtro seleccionado.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-space-md">
                    {solicitudesPersonaSeleccionada.map((s) => renderTarjetaSolicitud(s, false))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 3: GESTIÓN DE SOLICITUDES (TODAS)                  */}
      {/* ======================================================== */}
      {vistaTab === 'gestion' && (
        <div className="flex flex-col gap-space-lg">
          {/* FILTROS POR ESTADO */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-label-sm font-semibold text-outline mr-1">Filtrar por:</span>
            {(
              [
                { id: 'todas', label: 'Todas' },
                { id: 'enviada', label: 'Enviadas (Por resolver)' },
                { id: 'aprobada', label: 'Aprobadas' },
                { id: 'rechazada', label: 'Rechazadas' },
                { id: 'cancelada', label: 'Canceladas' },
              ] as { id: FiltroEstado; label: string }[]
            ).map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFiltroEstado(chip.id)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-semibold border transition-all ${
                  filtroEstado === chip.id
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* LISTADO DE TODAS LAS SOLICITUDES */}
          {loading ? (
            <div className="p-12 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
              <span>Cargando listado general de solicitudes...</span>
            </div>
          ) : solicitudesFiltradas.length === 0 ? (
            <div className="p-12 text-center text-outline bg-surface-container-lowest rounded-2xl border border-outline-variant flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-4xl text-outline">beach_access</span>
              <div className="text-headline-sm font-semibold text-primary">No hay solicitudes registradas</div>
              <p className="text-body-sm text-on-surface-variant">
                No se encontraron solicitudes con los filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-space-md">
              {solicitudesFiltradas.map((s) => renderTarjetaSolicitud(s, true))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* VISTA 4: LICENCIAS PARTICULARES                         */}
      {/* ======================================================== */}
      {vistaTab === 'licencias' && (
        <LicenciasParticulares
          perfilActual={perfilActual}
          puedeGestionar={puedeGestionar}
        />
      )}

      {/* MODAL PARA SOLICITAR VACACIONES (PROPIAS O A NOMBRE DE OTRO) */}
      <SolicitudVacacionesModal
        isOpen={modalSolicitudAbierto}
        feriados={feriados}
        profileId={solicitudParaAgente?.profileId}
        nombreAgente={solicitudParaAgente?.nombre}
        onClose={() => {
          setModalSolicitudAbierto(false);
          setSolicitudParaAgente(null);
        }}
        onSuccess={async () => {
          setMensajeExito(
            solicitudParaAgente
              ? `Solicitud de vacaciones registrada para ${solicitudParaAgente.nombre}.`
              : 'Solicitud de vacaciones enviada exitosamente.'
          );
          setTimeout(() => setMensajeExito(null), 4000);
          await recargarTodo();
        }}
      />

      {/* MODAL PARA RECHAZAR SOLICITUD (COMENTARIO OBLIGATORIO) */}
      <RechazoVacacionesModal
        solicitud={solicitudParaRechazo}
        isOpen={!!solicitudParaRechazo}
        onClose={() => setSolicitudParaRechazo(null)}
        onSuccess={async () => {
          setMensajeExito('Se registró el rechazo de la solicitud.');
          setTimeout(() => setMensajeExito(null), 4000);
          await recargarTodo();
        }}
      />

      {/* MODAL RÁPIDO PARA APROBAR CON COMENTARIO OPCIONAL */}
      {modalAprobacionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-space-lg shadow-2xl flex flex-col gap-space-md text-on-surface">
            <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-teal-600">check_circle</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Aprobar Solicitud</h2>
              </div>
              <button
                type="button"
                onClick={() => setModalAprobacionId(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Al confirmar, los días hábiles quedarán descontados del saldo disponible del agente para este ciclo.
            </p>

            <div>
              <label className="block text-label-md font-semibold text-primary mb-1">
                Comentario de Aprobación <span className="text-label-sm font-normal text-outline">(opcional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="Observación o nota adicional..."
                value={comentarioAprobacion}
                onChange={(e) => setComentarioAprobacion(e.target.value)}
                className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-md focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={() => setModalAprobacionId(null)}
                disabled={procesandoAccion}
                className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoAccion}
                onClick={() => handleAprobar(modalAprobacionId)}
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
    </div>
  );
};
