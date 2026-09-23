import React, { useState, useEffect } from 'react';
import {
  getTableroControlData,
  type TableroData,
  type SolicitudRecienteItem,
  type AlertaCriticaItem,
} from '../../services/tablero';

interface Props {
  onNavigateToPersonal?: () => void;
  onNavigateToSubSedes?: () => void;
  onNavigateToCapacitaciones?: (solicitudId?: string) => void;
  onNavigateToDocumentacion?: () => void;
  onNavigateToReportes?: () => void;
  onNuevoAgente?: () => void;
}

export const TableroControl: React.FC<Props> = ({
  onNavigateToPersonal,
  onNavigateToSubSedes,
  onNavigateToCapacitaciones,
  onNavigateToDocumentacion,
  onNavigateToReportes,
  onNuevoAgente,
}) => {
  const [data, setData] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [solicitudDetalle, setSolicitudDetalle] = useState<SolicitudRecienteItem | null>(null);
  const [alertaNotificar, setAlertaNotificar] = useState<AlertaCriticaItem | null>(null);
  const [mostrarInstructivo, setMostrarInstructivo] = useState(false);
  const [mostrarCargaMasiva, setMostrarCargaMasiva] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTableroControlData();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos del tablero');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3500);
  };

  const handleEnviarNotificacion = () => {
    if (!alertaNotificar) return;
    triggerToast(
      `Notificación formal enviada a ${alertaNotificar.agenteNombre} (${alertaNotificar.email || 'correo institucional'}).`
    );
    setAlertaNotificar(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
        <div className="font-label-md text-label-md text-primary font-bold">
          Sincronizando Tablero de Control DDNNA...
        </div>
        <p className="font-body-sm text-body-sm text-outline">
          Consolidando indicadores en tiempo real de sedes territoriales y legajos
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-space-lg bg-error-container text-on-error-container rounded-xl border border-error max-w-2xl mx-auto my-8">
        <h3 className="font-headline-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          Error al cargar el tablero de control
        </h3>
        <p className="font-body-md mt-2">{error || 'No se pudieron recuperar los indicadores.'}</p>
        <button
          onClick={cargarDatos}
          className="mt-4 px-4 py-2 bg-error text-white rounded-lg font-label-md font-semibold hover:bg-opacity-90 transition-colors"
        >
          Reintentar Carga
        </button>
      </div>
    );
  }

  const { kpis, coberturaSubSedes, solicitudesRecientes, alertasCriticas } = data;

  const fechaHoyStr = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const fechaCapitalizada = fechaHoyStr.charAt(0).toUpperCase() + fechaHoyStr.slice(1);

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg font-body-md text-on-surface">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-8 z-50 p-4 bg-[#CCFBF1] text-[#0F766E] border border-teal-300 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <span className="material-symbols-outlined text-xl">verified</span>
          <span className="font-label-md font-bold">{toastMsg}</span>
        </div>
      )}

      {/* HEADER DEL DASHBOARD */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1 border-b border-outline-variant pb-space-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
              Tablero de Control Institucional
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-container text-secondary font-semibold">
              Ciclo Activo 2024
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Monitoreo en tiempo real de legajos, personal activo y capacitaciones territoriales •{' '}
            <span className="font-medium text-primary">{fechaCapitalizada}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateToCapacitaciones && onNavigateToCapacitaciones()}
            className="inline-flex items-center gap-2 h-10 px-4 bg-surface-container-lowest border border-outline-variant rounded-lg text-primary font-label-md text-label-md hover:bg-surface-container-low transition-colors shadow-sm font-semibold"
          >
            <span className="material-symbols-outlined text-secondary text-[20px]">school</span>
            <span>Solicitar Capacitación Territorial</span>
          </button>
          <button
            onClick={() => {
              if (onNuevoAgente) onNuevoAgente();
              else if (onNavigateToPersonal) onNavigateToPersonal();
            }}
            className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm font-bold"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Nuevo Registro de Agente</span>
          </button>
        </div>
      </div>

      {/* BANNER INFORMATIVO / ALERTA INSTITUCIONAL ACCESIBLE */}
      <div className="rounded-xl border border-secondary/30 bg-surface-container-low p-4 shadow-sm flex items-start gap-4">
        <div className="p-2 rounded-lg bg-secondary text-on-secondary flex-shrink-0 mt-0.5">
          <span
            className="material-symbols-outlined text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            info
          </span>
        </div>
        <div className="flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
              Actualización Trimestral Obligatoria de Legajos
            </h2>
            <span className="text-label-sm font-label-sm px-2 py-0.5 rounded bg-surface text-secondary border border-outline-variant font-medium self-start sm:self-auto">
              Vencimiento: 15 de Noviembre
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            De acuerdo con la Resolución DDNNA N° 108/24, se encuentra habilitado el periodo de validación de certificados de antecedentes penales y aptos psicofísicos de agentes con trato directo con infancias y adolescencias. Asegúrese de revisar los legajos en estado de alerta antes del cierre de liquidación.
          </p>
        </div>
        <button
          onClick={() => setMostrarInstructivo(true)}
          className="text-secondary font-label-md text-label-md hover:underline flex items-center gap-1 self-center ml-2 flex-shrink-0 font-semibold"
        >
          <span>Ver Instructivo</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
        </button>
      </div>

      {/* 4 TARJETAS DE MÉTRICAS (KPIs) */}
      <section aria-label="Indicadores Clave de Desempeño" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Personal Activo */}
        <div
          onClick={onNavigateToPersonal}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-secondary transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Personal Activo Registrado</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary">
              <span className="material-symbols-outlined text-[20px]">groups</span>
            </span>
          </div>
          <div className="my-2">
            <span className="font-headline-lg text-headline-lg font-bold text-primary">
              {kpis.personalActivo}
            </span>
            <span className="font-body-sm text-body-sm text-outline ml-1">agentes</span>
          </div>
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-tertiary-container">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span className="font-semibold">+{kpis.nuevasIncorporacionesMes} nuevas incorporaciones</span>
            <span className="text-outline">este mes</span>
          </div>
        </div>

        {/* KPI 2: Documentación Pendiente */}
        <div
          onClick={onNavigateToPersonal}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-secondary transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Documentación Pendiente</span>
            <span className="p-1.5 rounded-lg bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">pending_actions</span>
            </span>
          </div>
          <div className="my-2">
            <span className="font-headline-lg text-headline-lg font-bold text-primary">
              {kpis.documentacionPendiente}
            </span>
            <span className="font-body-sm text-body-sm text-outline ml-1">legajos</span>
          </div>
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-secondary-container">
            <span className="material-symbols-outlined text-sm">rule</span>
            <span>Trámites en revisión técnica</span>
          </div>
        </div>

        {/* KPI 3: Alertas de Vencimiento */}
        <div
          onClick={onNavigateToDocumentacion}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-error transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Alertas de Vencimiento (30d)</span>
            <span className="p-1.5 rounded-lg bg-error-container text-error">
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                warning
              </span>
            </span>
          </div>
          <div className="my-2">
            <span className="font-headline-lg text-headline-lg font-bold text-error">
              {kpis.alertasVencimiento30d}
            </span>
            <span className="font-body-sm text-body-sm text-outline ml-1">documentos críticos</span>
          </div>
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-error">
            <span className="material-symbols-outlined text-sm">schedule</span>
            <span>Aptos médicos y antecedentes</span>
          </div>
        </div>

        {/* KPI 4: Talleres y Capacitaciones */}
        <div
          onClick={() => onNavigateToCapacitaciones && onNavigateToCapacitaciones()}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-secondary transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Talleres &amp; Capacitaciones</span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary">
              <span className="material-symbols-outlined text-[20px]">school</span>
            </span>
          </div>
          <div className="my-2">
            <span className="font-headline-lg text-headline-lg font-bold text-primary">
              {kpis.talleresRealizados}
            </span>
            <span className="font-body-sm text-body-sm text-outline ml-1">realizadas</span>
          </div>
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-secondary">
            <span className="material-symbols-outlined text-sm">domain</span>
            <span>{kpis.solicitudesEnCurso} solicitudes en curso</span>
          </div>
        </div>
      </section>

      {/* SECCIÓN PRINCIPAL: 2 COLUMNAS (2/3 Izquierda, 1/3 Derecha) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg">
        {/* COLUMNA IZQUIERDA (2/3): Gráficos y Tablas Operativas */}
        <div className="lg:col-span-2 flex flex-col gap-space-lg">
          {/* Visualizador de Cobertura y Cumplimiento por Sub-Sede */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm border-b border-outline-variant mb-space-md gap-2">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Distribución y Cobertura de Personal por Sub-Sedes
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Porcentaje de legajos completos e idoneidad ética verificada
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-label-sm font-label-sm text-outline">
                  <span className="h-2.5 w-2.5 rounded-full bg-secondary"></span> Legajos Validados
                </span>
                <span className="inline-flex items-center gap-1 text-label-sm font-label-sm text-outline ml-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-surface-container-high"></span> Pendiente / Trámite
                </span>
              </div>
            </div>

            {/* Barras de completitud por sede */}
            <div className="space-y-4">
              {coberturaSubSedes.map((sede) => (
                <div key={sede.id} className="cursor-pointer hover:opacity-90" onClick={onNavigateToSubSedes}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-label-md text-label-md text-primary font-bold">{sede.nombre}</span>
                      <span className="text-label-sm font-label-sm px-2 py-0.5 rounded bg-surface-container text-on-surface font-normal">
                        {sede.agentesCount} Agentes
                      </span>
                    </div>
                    <span
                      className={`font-label-md text-label-md font-bold ${
                        sede.esCritico ? 'text-error' : 'text-primary'
                      }`}
                    >
                      {sede.porcentajeCompletitud}%
                    </span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-3 overflow-hidden flex">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${
                        sede.esCritico ? 'bg-error' : 'bg-secondary'
                      }`}
                      style={{ width: `${sede.porcentajeCompletitud}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Solicitudes Recientes de Capacitación Territorial */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
            <div className="p-space-md border-b border-outline-variant flex items-center justify-between">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Solicitudes Recientes de Capacitación
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Demandas pedagógicas territoriales bajo Ley 26.061
                </p>
              </div>
              <button
                onClick={() => onNavigateToCapacitaciones && onNavigateToCapacitaciones()}
                className="text-secondary font-label-md text-label-md hover:underline flex items-center gap-1 font-semibold"
              >
                <span>Ver todas</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant">
                    <th className="px-4 py-3 font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Sub-Sede
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Temática / Taller
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Fecha Estimada
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-outline uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-4 py-3 font-label-sm text-label-sm text-outline uppercase tracking-wider text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-body-sm font-body-sm">
                  {solicitudesRecientes.map((sol) => {
                    const badgeClass =
                      sol.estado === 'aprobada'
                        ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
                        : sol.estado === 'en_revision'
                        ? 'bg-surface-container text-on-surface border border-outline-variant'
                        : 'bg-error-container text-on-error-container';

                    const iconName =
                      sol.estado === 'aprobada'
                        ? 'check_circle'
                        : sol.estado === 'en_revision'
                        ? 'schedule'
                        : 'pending';

                    const labelEstado =
                      sol.estado === 'aprobada'
                        ? 'Aprobada'
                        : sol.estado === 'en_revision'
                        ? 'En Revisión'
                        : 'Pendiente';

                    return (
                      <tr key={sol.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-outline text-base">domain</span>
                            <span>{sol.subSedeNombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-on-surface font-semibold max-w-xs truncate">
                          {sol.tematica}
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                          {sol.fechaEstimada}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-medium ${badgeClass}`}>
                            <span className="material-symbols-outlined text-xs">{iconName}</span>
                            {labelEstado}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => setSolicitudDetalle(sol)}
                            className="px-3 py-1 bg-surface-container border border-outline-variant rounded text-secondary font-label-sm text-label-sm hover:bg-secondary hover:text-on-secondary transition-colors font-semibold"
                          >
                            Ver Detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (1/3): Alertas Críticas & Accesos Rápidos */}
        <div className="flex flex-col gap-space-lg">
          {/* Card: Alertas Críticas y Documentación Vencida */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm">
            <div className="flex items-center justify-between pb-space-sm border-b border-outline-variant mb-space-md">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-error text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  error
                </span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">Alertas Críticas</h2>
              </div>
              <span className="font-label-sm text-label-sm bg-error-container text-on-error-container font-bold px-2 py-0.5 rounded-full">
                {alertasCriticas.length} Urgentes
              </span>
            </div>

            {/* List of critical agent notifications */}
            <div className="space-y-3">
              {alertasCriticas.map((alerta) => (
                <div
                  key={alerta.id}
                  className="p-3 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-label-md text-label-md text-primary font-bold">{alerta.agenteNombre}</h3>
                      <p className="font-label-sm text-label-sm text-outline">
                        {alerta.sedeNombre} • {alerta.cargo}
                      </p>
                    </div>
                    <span
                      className={`text-label-sm font-label-sm px-1.5 py-0.5 rounded font-semibold ${
                        alerta.estadoAlerta === 'Vencido' || alerta.estadoAlerta === 'Rechazado'
                          ? 'bg-error-container text-error'
                          : 'bg-surface-container text-on-surface'
                      }`}
                    >
                      {alerta.estadoAlerta}
                    </span>
                  </div>

                  <div className="mt-2 text-body-sm font-body-sm text-on-surface flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-sm ${
                        alerta.tipoColor === 'error' ? 'text-error' : 'text-secondary'
                      }`}
                    >
                      {alerta.estadoAlerta === 'Vencido' ? 'cancel' : alerta.estadoAlerta === 'Rechazado' ? 'gavel' : 'schedule'}
                    </span>
                    <span>{alerta.documentoTipo}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-outline-variant pt-2">
                    <span className="font-label-sm text-label-sm text-outline">{alerta.diasTexto}</span>
                    <button
                      onClick={() => setAlertaNotificar(alerta)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container-lowest border border-outline-variant text-secondary font-label-sm text-label-sm hover:bg-secondary hover:text-on-secondary transition-colors font-semibold"
                    >
                      <span className="material-symbols-outlined text-xs">mail</span>
                      <span>Notificar Agente</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Accesos Rápidos Directos */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-primary font-bold pb-space-sm border-b border-outline-variant mb-space-md">
              Accesos Rápidos
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={onNavigateToSubSedes}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-surface-container-low text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">domain_add</span>
                  </div>
                  <div>
                    <span className="font-label-md text-label-md text-primary font-bold block">
                      Gestionar Sub-Sedes
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">
                      Altas, bajas y referentes regionales
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                  chevron_right
                </span>
              </button>

              <button
                onClick={() => setMostrarCargaMasiva(true)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-surface-container-low text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">upload_file</span>
                  </div>
                  <div>
                    <span className="font-label-md text-label-md text-primary font-bold block">
                      Cargar Certificados Masivos
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">
                      Importación ZIP de antecedentes y cursos
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                  chevron_right
                </span>
              </button>

              <button
                onClick={onNavigateToReportes}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-surface-container-low text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                    <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                  </div>
                  <div>
                    <span className="font-label-md text-label-md text-primary font-bold block">
                      Descargar Reporte Mensual PDF
                    </span>
                    <span className="font-label-sm text-label-sm text-outline">
                      Auditoría institucional consolidada
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">
                  download
                </span>
              </button>
            </div>
          </div>

          {/* Personnel Dossier Insignia Widget (Institutional Compliance) */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span
                className="material-symbols-outlined text-secondary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified_user
              </span>
              <span className="font-label-md text-label-md text-primary font-bold">
                Protocolo de Idoneidad y Protección
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              El {kpis.antecedentesAlDiaPct}% de los agentes activos tienen el Certificado de Antecedentes Penales aprobado y vigente.
            </p>
            <div className="mt-3 flex items-center justify-between text-label-sm font-label-sm text-outline">
              <span>Auditoría DDNNA</span>
              <span>Datos en vivo</span>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: VER DETALLE DE SOLICITUD */}
      {solicitudDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-xl w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">school</span>
                Detalle de Demanda Pedagógica
              </h3>
              <button
                onClick={() => setSolicitudDetalle(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-2 text-body-sm">
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-label-sm text-outline block">Sub-Sede Territorial</span>
                <span className="font-bold text-primary text-body-md">{solicitudDetalle.subSedeNombre}</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl">
                <span className="text-label-sm text-outline block">Temática Requerida</span>
                <span className="font-bold text-primary">{solicitudDetalle.tematica}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-container rounded-xl">
                <div>
                  <span className="text-label-sm text-outline block">Fecha Estimada</span>
                  <span className="font-semibold text-primary">{solicitudDetalle.fechaEstimada}</span>
                </div>
                <div>
                  <span className="text-label-sm text-outline block">Estado Actual</span>
                  <span className="font-bold uppercase text-secondary">{solicitudDetalle.estado}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                onClick={() => setSolicitudDetalle(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container font-semibold"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  setSolicitudDetalle(null);
                  if (onNavigateToCapacitaciones) onNavigateToCapacitaciones(solicitudDetalle.id);
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:bg-primary-container"
              >
                Abrir en Dictamen Pedagógico
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NOTIFICAR AGENTE POR ALERTA CRÍTICA */}
      {alertaNotificar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-error">notification_important</span>
                Notificación Formal de Auditoría
              </h3>
              <button
                onClick={() => setAlertaNotificar(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Se remitirá una notificación fehaciente al correo institucional de{' '}
              <strong>{alertaNotificar.agenteNombre}</strong> ({alertaNotificar.sedeNombre}) con copia a la
              Coordinación Territorial.
            </p>

            <div className="p-3.5 bg-error-container/20 border border-error-container rounded-xl text-body-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-outline">Documento Observado:</span>
                <span className="font-bold text-primary">{alertaNotificar.documentoTipo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">Situación:</span>
                <span className="font-bold text-error">{alertaNotificar.diasTexto}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                onClick={() => setAlertaNotificar(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleEnviarNotificacion}
                className="px-4 py-2 bg-error text-white rounded-lg font-label-md font-bold hover:bg-opacity-90 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                Confirmar y Enviar Aviso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INSTRUCTIVO RESOLUCIÓN DDNNA 108/24 */}
      {mostrarInstructivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-2xl w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">gavel</span>
                Resolución DDNNA N° 108/24 • Instructivo
              </h3>
              <button
                onClick={() => setMostrarInstructivo(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3 text-body-sm text-on-surface-variant max-h-[60vh] overflow-y-auto pr-2">
              <p>
                <strong>Artículo 1°:</strong> Establécese la obligación periódica para todos los agentes, profesionales y personal de planta o contratados con desempeño en sedes y dispositivos territoriales de la DDNNA de revalidar semestralmente los antecedentes penales específicos en materia de delitos contra la integridad sexual y protección de infancias.
              </p>
              <p>
                <strong>Artículo 2°:</strong> El plazo máximo para la presentación de los certificados en formato digital ante la Dirección de Recursos Humanos y Auditoría vence el 15 de Noviembre del ciclo en curso.
              </p>
              <p>
                <strong>Artículo 3°:</strong> Aquellos legajos que no cuenten con la debida acreditación serán pasibles de suspensión cautelar de funciones operativas directas con NNA.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-outline-variant">
              <button
                onClick={() => setMostrarInstructivo(false)}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:bg-primary-container"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CARGA MASIVA DE CERTIFICADOS */}
      {mostrarCargaMasiva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">upload_file</span>
                Importación Masiva de Certificados (ZIP)
              </h3>
              <button
                onClick={() => setMostrarCargaMasiva(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center space-y-2 bg-surface-container-low">
              <span className="material-symbols-outlined text-4xl text-secondary">cloud_upload</span>
              <p className="font-label-md text-primary font-bold">
                Arrastrá y soltá un paquete ZIP con los certificados nombrados por DNI
              </p>
              <p className="text-label-sm text-outline">Ejemplo: <code className="font-mono">32111222_antecedentes.pdf</code></p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                onClick={() => setMostrarCargaMasiva(false)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setMostrarCargaMasiva(false);
                  triggerToast('Procesamiento de paquete ZIP iniciado en segundo plano.');
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:bg-primary-container"
              >
                Comenzar Importación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
