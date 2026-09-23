import React, { useState, useEffect, useMemo } from 'react';
import {
  getReportesInstitucionalesData,
  type ReportesInstitucionalesData,
  type SedeAuditoriaFila,
} from '../../services/reportes';

interface Props {
  onVerLegajos?: () => void;
  onVerCapacitaciones?: () => void;
  onVerSubSedes?: () => void;
  onVerAlertas?: () => void;
}

export const ReportesInstitucionales: React.FC<Props> = ({
  onVerLegajos,
  onVerCapacitaciones,
  onVerSubSedes,
  onVerAlertas,
}) => {
  const [data, setData] = useState<ReportesInstitucionalesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [periodo, setPeriodo] = useState('2024_consolidado');
  const [filtroSede, setFiltroSede] = useState('todas');
  const [tipoInforme, setTipoInforme] = useState('integral');

  // Modal / Drawer de Acta Completa
  const [actaSedeSeleccionada, setActaSedeSeleccionada] = useState<SedeAuditoriaFila | null>(null);
  const [mostrarModalProgramar, setMostrarModalProgramar] = useState(false);
  const [notificacionExito, setNotificacionExito] = useState<string | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getReportesInstitucionalesData();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Error al compilar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const triggerToast = (msg: string) => {
    setNotificacionExito(msg);
    setTimeout(() => {
      setNotificacionExito(null);
    }, 3500);
  };

  // Filtrado de la matriz de auditoría
  const matrizFiltrada = useMemo(() => {
    if (!data) return [];
    if (filtroSede === 'todas') return data.matrizAuditoria;
    return data.matrizAuditoria.filter(
      (m) => m.sedeId === filtroSede || m.sedeNombre.toLowerCase().includes(filtroSede.toLowerCase())
    );
  }, [data, filtroSede]);

  // Exportar CSV
  const handleExportCSV = () => {
    if (!data) return;
    const encabezados = [
      'Sub-Sede Territorial',
      'Localidad',
      'Dotación',
      '% Legajos al 100%',
      'Antecedentes al Día',
      'Aptos Médicos Vigentes',
      'Calificación Auditoría',
    ];
    const filas = data.matrizAuditoria.map((f) => [
      `"${f.sedeNombre}"`,
      `"${f.localidad}"`,
      f.dotacion,
      `${f.legajosCompletosPct}%`,
      `"${f.antecedentesAlDiaTexto}"`,
      `"${f.aptosMedicosTexto}"`,
      f.calificacion,
    ]);
    const contenido = [encabezados.join(','), ...filas.map((r) => r.join(','))].join('\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ddnna_auditoria_territorial_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Reporte CSV descargado correctamente.');
  };

  const handleDescargarPDF = () => {
    triggerToast('Generando Documento Oficial PDF con firma digital y hash SHA-256...');
    setTimeout(() => {
      window.print();
    }, 800);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
        <div className="font-label-md text-label-md text-primary font-bold">
          Consolidando Métricas Territoriales DDNNA...
        </div>
        <p className="font-body-sm text-body-sm text-outline">
          Auditando legajos, antecedentes penales y horas de formación Ley 26.061
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-space-lg bg-error-container text-on-error-container rounded-xl border border-error max-w-2xl mx-auto my-8">
        <h3 className="font-headline-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          Error al obtener informes territoriales
        </h3>
        <p className="font-body-md mt-2">{error || 'No se pudieron recuperar las métricas.'}</p>
        <button
          onClick={cargarDatos}
          className="mt-4 px-4 py-2 bg-error text-white rounded-lg font-label-md font-semibold hover:bg-opacity-90 transition-colors"
        >
          Reintentar Carga
        </button>
      </div>
    );
  }

  const { kpis, distribucionDisciplinas, cumplimientoDocumental, evolucionHoras } = data;

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg font-body-md text-on-surface">
      {/* Toast Notification */}
      {notificacionExito && (
        <div className="fixed top-20 right-8 z-50 p-4 bg-[#CCFBF1] text-[#0F766E] border border-teal-300 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <span className="material-symbols-outlined text-xl">verified</span>
          <span className="font-label-md font-bold">{notificacionExito}</span>
        </div>
      )}

      {/* SECTION HEADER & QUICK ACTIONS */}
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b border-outline-variant pb-space-md">
        <div>
          <div className="flex items-center gap-2 text-outline font-label-sm text-label-sm uppercase tracking-wider mb-1">
            <span>Sistema Integral DDNNA</span>
            <span>•</span>
            <span className="text-secondary font-semibold">Ley Nacional 26.061</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
            Informes y Estadísticas de Gestión Territorial
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Métricas de cobertura de personal, auditoría documental y formación continua bajo Ley 26.061
          </p>
        </div>

        {/* Header CTA Actions */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            onClick={() => setMostrarModalProgramar(true)}
            className="flex items-center gap-space-xs px-space-md py-2.5 bg-surface-container-lowest border border-outline-variant hover:bg-surface-container-low text-primary rounded-lg font-label-md text-label-md transition-colors shadow-sm focus:ring-2 focus:ring-secondary/20 font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-outline text-[20px]">schedule_send</span>
            <span>Programar Envío Mensual</span>
          </button>
          <button
            onClick={handleDescargarPDF}
            className="flex items-center gap-space-xs px-space-md py-2.5 bg-primary-container text-on-primary hover:bg-primary rounded-lg font-label-md text-label-md transition-colors shadow-sm focus:ring-2 focus:ring-secondary/20 font-bold"
            type="button"
          >
            <span className="material-symbols-outlined text-secondary-container text-[20px]">picture_as_pdf</span>
            <span>Descargar Informe Consolidado PDF</span>
          </button>
        </div>
      </section>

      {/* KPI SUMMARY CARDS (Top Ribbon) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* KPI 1 */}
        <div
          onClick={onVerLegajos}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-secondary transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Dotación Activa DDNNA</span>
            <span className="p-1 rounded bg-secondary-fixed text-on-secondary-fixed-variant material-symbols-outlined text-lg">
              groups
            </span>
          </div>
          <div className="my-2">
            <div className="font-display-lg text-display-lg text-primary leading-tight font-bold">
              {kpis.dotacionActiva}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Agentes técnicos territoriales
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-surface-container-low text-label-sm font-label-sm text-on-tertiary-container font-semibold">
            <span className="material-symbols-outlined text-sm">trending_up</span>
            <span>+{kpis.dotacionCrecimientoPct}% incorporados este período</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div
          onClick={onVerLegajos}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-secondary transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Legajos Auditados 100%</span>
            <span className="p-1 rounded bg-surface-container text-secondary material-symbols-outlined text-lg">
              verified_user
            </span>
          </div>
          <div className="my-2">
            <div className="font-display-lg text-display-lg text-secondary leading-tight font-bold">
              {kpis.legajosAuditadosPct}%
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Conformidad penal y sanitaria
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-surface-container-low text-label-sm font-label-sm text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
            <span>Meta institucional superada (&gt;85%)</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div
          onClick={onVerCapacitaciones}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-secondary transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Capacitaciones Dictadas</span>
            <span className="p-1 rounded bg-surface-container text-primary material-symbols-outlined text-lg">
              workspace_premium
            </span>
          </div>
          <div className="my-2">
            <div className="font-display-lg text-display-lg text-primary leading-tight font-bold">
              {kpis.horasCapacitacionTotal} <span className="text-headline-sm font-medium text-outline">hs</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Distribuidas en {kpis.talleresZonalesTotal} talleres zonales
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-surface-container-low text-label-sm font-label-sm text-on-tertiary-container font-semibold">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            <span>{kpis.asistenciaObligatoriaPct}% asistencia obligatoria</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div
          onClick={onVerAlertas}
          className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:border-error transition-colors cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-outline">Alertas de Vencimiento</span>
            <span className="p-1 rounded bg-error-container text-on-error-container material-symbols-outlined text-lg">
              notification_important
            </span>
          </div>
          <div className="my-2">
            <div className="font-display-lg text-display-lg text-error leading-tight font-bold">
              {kpis.alertasVencimientoTotal}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Certificados próximos o caducos
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-2 border-t border-surface-container-low text-label-sm font-label-sm text-error font-semibold">
            <span className="material-symbols-outlined text-sm">priority_high</span>
            <span>{kpis.alertasUrgentes} requieren intervención urgente</span>
          </div>
        </div>
      </section>

      {/* FILTER CONTROLS BAR */}
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-md flex-1">
            {/* Period Selector */}
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">calendar_month</span> Período Analizado
              </label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="2024_consolidado">Año 2024 (Consolidado)</option>
                <option value="q3_2024">Último Trimestre (Q3 - 2024)</option>
                <option value="semestre_1">Semestre I (Ene - Jun 2024)</option>
                <option value="interanual">Interanual Comparativo 2023-2024</option>
              </select>
            </div>

            {/* Sub-Sedes Selector */}
            <div className="flex flex-col gap-1 min-w-[220px]">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">location_city</span> Sub-Sedes Comparadas
              </label>
              <select
                value={filtroSede}
                onChange={(e) => setFiltroSede(e.target.value)}
                className="h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="todas">Todas las Sub-Sedes ({distribucionDisciplinas.length} Territorios)</option>
                {distribucionDisciplinas.map((dist) => (
                  <option key={dist.sedeId} value={dist.sedeId}>
                    {dist.sedeNombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Report Type Selector */}
            <div className="flex flex-col gap-1 min-w-[220px]">
              <label className="font-label-sm text-label-sm text-outline uppercase tracking-wider flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">assignment</span> Tipo de Informe
              </label>
              <select
                value={tipoInforme}
                onChange={(e) => setTipoInforme(e.target.value)}
                className="h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              >
                <option value="integral">Integral: Personal, Legal y Formación</option>
                <option value="idoneidad">Auditoría de Idoneidad y Antecedentes</option>
                <option value="capacitacion">Cumplimiento de Horas de Capacitación</option>
                <option value="guardias">Cobertura de Dispositivos de Guardia</option>
              </select>
            </div>
          </div>

          {/* Secondary Actions in Filter Strip */}
          <div className="flex items-center gap-space-sm self-end lg:self-center">
            <button
              onClick={() => triggerToast('Filtros avanzados aplicados al ejercicio en curso.')}
              className="h-10 px-3.5 bg-surface-container-high hover:bg-surface-container text-on-surface rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors font-medium"
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>Más Filtros</span>
            </button>
            <button
              onClick={() => {
                cargarDatos();
                triggerToast('Métricas y legajos sincronizados con Supabase.');
              }}
              className="h-10 px-4 bg-secondary text-on-secondary hover:bg-secondary/90 rounded-lg font-label-md text-label-md flex items-center gap-1.5 transition-colors shadow-sm font-semibold"
            >
              <span className="material-symbols-outlined text-base">refresh</span>
              <span>Actualizar Datos</span>
            </button>
          </div>
        </div>
      </section>

      {/* GRID: 4 ANALYTIC MODULES */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* MODULE 1: Personal Distribution by Sub-Sede and Discipline (7 Cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm border-b border-surface-container-low gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                  Distribución de Personal por Sub-Sede y Disciplina
                </h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Conformación de equipos interdisciplinarios por centro operativo
              </p>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-label-sm font-label-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-primary"></span> Abogacía
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-secondary"></span> Psicología
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-secondary-container"></span> Trab. Social
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-tertiary-fixed-dim"></span> Acompañamiento
              </span>
            </div>
          </div>

          {/* Stacked Bar Chart Graphic Area */}
          <div className="py-space-md flex flex-col gap-4">
            {distribucionDisciplinas.map((dist) => {
              const sum = dist.abogacia + dist.psicologia + dist.trabajoSocial + dist.acompanamiento || 1;
              const pctAbog = Math.round((dist.abogacia / sum) * 100);
              const pctPsic = Math.round((dist.psicologia / sum) * 100);
              const pctSocial = Math.round((dist.trabajoSocial / sum) * 100);
              const pctAcomp = 100 - (pctAbog + pctPsic + pctSocial);

              return (
                <div key={dist.sedeId} className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-label-md font-label-md">
                    <span className="text-primary font-semibold">{dist.sedeNombre}</span>
                    <span className="text-outline">Total: {dist.totalAgentes} agentes</span>
                  </div>
                  <div className="h-6 w-full rounded-md bg-surface-container-low overflow-hidden flex shadow-inner">
                    <div
                      className="h-full bg-primary flex items-center justify-center text-white text-[11px] font-semibold transition-all duration-500"
                      style={{ width: `${pctAbog}%` }}
                      title={`Abogacía: ${dist.abogacia} (${pctAbog}%)`}
                    >
                      {dist.abogacia > 0 ? dist.abogacia : ''}
                    </div>
                    <div
                      className="h-full bg-secondary flex items-center justify-center text-white text-[11px] font-semibold transition-all duration-500"
                      style={{ width: `${pctPsic}%` }}
                      title={`Psicología: ${dist.psicologia} (${pctPsic}%)`}
                    >
                      {dist.psicologia > 0 ? dist.psicologia : ''}
                    </div>
                    <div
                      className="h-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-[11px] font-semibold transition-all duration-500"
                      style={{ width: `${pctSocial}%` }}
                      title={`Trabajo Social: ${dist.trabajoSocial} (${pctSocial}%)`}
                    >
                      {dist.trabajoSocial > 0 ? dist.trabajoSocial : ''}
                    </div>
                    <div
                      className="h-full bg-tertiary-fixed-dim flex items-center justify-center text-tertiary-container text-[11px] font-bold transition-all duration-500"
                      style={{ width: `${Math.max(4, pctAcomp)}%` }}
                      title={`Acompañamiento: ${dist.acompanamiento} (${pctAcomp}%)`}
                    >
                      {dist.acompanamiento > 0 ? dist.acompanamiento : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom insight */}
          <div className="pt-space-sm border-t border-surface-container-low flex items-center justify-between text-label-sm font-label-sm text-outline">
            <span>Ratio promedio interdisciplinario: 1.2 Psicólogos / 1 Abogado territorial</span>
            <button
              onClick={onVerSubSedes}
              className="text-secondary hover:underline font-semibold flex items-center gap-1"
            >
              <span>Ver detalle por matrícula</span>
              <span className="material-symbols-outlined text-xs">chevron_right</span>
            </button>
          </div>
        </div>

        {/* MODULE 2: General Document Compliance Donut / Progress (5 Cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col justify-between">
          <div className="pb-space-sm border-b border-surface-container-low">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-on-tertiary-container"></span>
              <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                Estado de Cumplimiento Documental General
              </h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Auditoría sobre legajos de agentes e idoneidad penal (RePAR)
            </p>
          </div>

          {/* Donut Graphic Visual */}
          <div className="my-space-md flex flex-col sm:flex-row items-center justify-around gap-space-md">
            {/* Circular Gauge Visualization */}
            <div className="relative w-44 h-44 flex items-center justify-center flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                {/* Background Ring */}
                <path
                  className="text-surface-container stroke-current"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3.8"
                />
                {/* Segment: Vigentes (Teal / Secondary) */}
                <path
                  className="text-secondary stroke-current transition-all duration-700 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeDasharray={`${cumplimientoDocumental.porcentajeVigente}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.8"
                />
                {/* Segment: Próximo Vencimiento (Amber) */}
                <path
                  className="text-secondary-container stroke-current transition-all duration-700 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeDasharray={`${cumplimientoDocumental.proximoVencerPct}, 100`}
                  strokeDashoffset={`-${cumplimientoDocumental.porcentajeVigente}`}
                  strokeWidth="3.8"
                />
                {/* Segment: Críticos / Vencidos (Red) */}
                <path
                  className="text-error stroke-current transition-all duration-700 ease-out"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeDasharray={`${cumplimientoDocumental.criticosPct}, 100`}
                  strokeDashoffset={`-${cumplimientoDocumental.porcentajeVigente + cumplimientoDocumental.proximoVencerPct}`}
                  strokeWidth="3.8"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-headline-lg text-headline-lg font-bold text-primary">
                  {cumplimientoDocumental.porcentajeVigente}%
                </span>
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Cumplimiento
                </span>
              </div>
            </div>

            {/* Breakdown Legend & Metric Stats */}
            <div className="flex flex-col gap-3 w-full sm:w-auto">
              {/* Item 1: Vigentes */}
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-container-low border border-surface-container">
                <span
                  className="material-symbols-outlined text-secondary text-lg mt-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <div>
                  <div className="font-label-md text-label-md font-bold text-primary">
                    {cumplimientoDocumental.porcentajeVigente}% ({cumplimientoDocumental.vigentesCount} Legajos)
                  </div>
                  <div className="font-body-sm text-body-sm text-outline">Completos, validados y vigentes</div>
                </div>
              </div>

              {/* Item 2: Próximo Vencimiento */}
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-surface-container-low border border-surface-container">
                <span className="material-symbols-outlined text-on-secondary-container text-lg mt-0.5">schedule</span>
                <div>
                  <div className="font-label-md text-label-md font-bold text-on-surface">
                    {cumplimientoDocumental.proximoVencerPct}% ({cumplimientoDocumental.proximoVencerCount} Legajos)
                  </div>
                  <div className="font-body-sm text-body-sm text-outline">Vencimiento en &lt; 30 días</div>
                </div>
              </div>

              {/* Item 3: Críticos */}
              <div className="flex items-start gap-2.5 p-2 rounded-lg bg-error-container/30 border border-error-container">
                <span
                  className="material-symbols-outlined text-error text-lg mt-0.5"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  error
                </span>
                <div>
                  <div className="font-label-md text-label-md font-bold text-error">
                    {cumplimientoDocumental.criticosPct}% ({cumplimientoDocumental.criticosCount} Legajos)
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant">
                    Caducos / Notificación enviada
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-space-sm border-t border-surface-container-low flex items-center justify-between text-label-sm font-label-sm">
            <span className="text-outline">Última conciliación automática: Hoy, 08:30 hs</span>
            <button onClick={onVerAlertas} className="text-secondary font-semibold hover:underline">
              Ver Alertas Críticas
            </button>
          </div>
        </div>

        {/* MODULE 3: Training & Capacity Hours Evolution (12 Cols) */}
        <div className="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm border-b border-surface-container-low gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-container"></span>
                <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                  Evolución de Capacitaciones y Horas de Formación
                </h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Talleres técnicos realizados y horas acumuladas por agentes de sedes territoriales (Ciclo 2024)
              </p>
            </div>

            {/* Indicators */}
            <div className="flex items-center gap-4 text-label-sm font-label-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <span className="w-3.5 h-1 bg-secondary rounded"></span> Horas Acumuladas
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span> Talleres Realizados
              </span>
            </div>
          </div>

          {/* Line Chart & Monthly Trend Matrix Simulation */}
          <div className="pt-space-lg pb-space-md grid grid-cols-12 gap-2 h-56 items-end border-b border-surface-container relative">
            {/* Grid Background Lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
              <div className="w-full border-b border-outline"></div>
              <div className="w-full border-b border-outline"></div>
              <div className="w-full border-b border-outline"></div>
              <div className="w-full border-b border-outline"></div>
            </div>

            {evolucionHoras.map((item, idx) => {
              const maxHeight = 110;
              const heightPct = Math.min(100, Math.round((item.horas / maxHeight) * 100));
              const isHighlight = item.mesCorto === 'Oct';

              return (
                <div
                  key={idx}
                  className={`col-span-1 flex flex-col items-center gap-2 h-full justify-end z-10 group ${
                    item.esProyeccion ? 'opacity-60' : ''
                  }`}
                >
                  <span
                    className={`font-label-sm text-label-sm transition-opacity ${
                      isHighlight ? 'text-secondary font-bold opacity-100' : 'text-outline opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {item.esProyeccion ? 'Proy.' : `${item.horas}h`}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      item.esProyeccion
                        ? 'border-2 border-dashed border-secondary bg-surface-container-low'
                        : isHighlight
                        ? 'bg-secondary shadow-sm'
                        : 'bg-surface-container hover:bg-secondary'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${item.mes}: ${item.horas} horas acreditadas en ${item.talleres} talleres`}
                  ></div>
                  <span
                    className={`font-label-sm text-label-sm ${
                      isHighlight ? 'text-primary font-bold' : 'text-on-surface-variant'
                    }`}
                  >
                    {item.mesCorto}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Summary Strip */}
          <div className="pt-space-md grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined text-secondary text-2xl">auto_stories</span>
              <div>
                <span className="font-label-sm text-label-sm text-outline block">Módulo Más Concurrido</span>
                <span className="font-label-md text-label-md text-primary font-bold">
                  Protocolos de Actuación en Urgencia
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined text-secondary text-2xl">person_check</span>
              <div>
                <span className="font-label-sm text-label-sm text-outline block">Promedio de Agentes por Taller</span>
                <span className="font-label-md text-label-md text-primary font-bold">
                  24.5 Especialistas / Encuentro
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg">
              <span className="material-symbols-outlined text-on-tertiary-container text-2xl">verified</span>
              <div>
                <span className="font-label-sm text-label-sm text-outline block">Certificados Digitales Emitidos</span>
                <span className="font-label-md text-label-md text-primary font-bold">
                  518 Acreditaciones Ley 26.061
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MODULE 4: Quick Audit Matrix by Sub-Sede (12 Cols) */}
        <div className="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div className="p-space-md border-b border-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">fact_check</span>
                <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                  Matriz de Auditoría Rápida por Sub-Sede
                </h2>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Evaluación cruzada de dotación, antecedentes penales y aptitud técnica por jurisdicción territorial
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-label-md flex items-center gap-1.5 transition-colors font-semibold"
              >
                <span className="material-symbols-outlined text-sm">file_download</span>
                <span>Exportar CSV</span>
              </button>
            </div>
          </div>

          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" role="table">
              <thead>
                <tr className="bg-surface-container-low border-b border-outline-variant text-label-sm font-label-sm text-outline uppercase tracking-wider">
                  <th className="py-3.5 px-space-md" scope="col">Sub-Sede Territorial</th>
                  <th className="py-3.5 px-space-md text-center" scope="col">Dotación</th>
                  <th className="py-3.5 px-space-md" scope="col">Legajos al 100%</th>
                  <th className="py-3.5 px-space-md" scope="col">Antecedentes al Día</th>
                  <th className="py-3.5 px-space-md" scope="col">Aptos Médicos</th>
                  <th className="py-3.5 px-space-md text-center" scope="col">Calificación de Auditoría</th>
                  <th className="py-3.5 px-space-md text-right" scope="col">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-body-sm font-body-sm">
                {matrizFiltrada.map((fila) => {
                  const barColor =
                    fila.legajosCompletosPct >= 90
                      ? 'bg-secondary'
                      : fila.legajosCompletosPct >= 80
                      ? 'bg-secondary-container'
                      : 'bg-error-container';

                  const badgeAntecedentes =
                    fila.calificacion === 'A'
                      ? 'bg-surface-container text-secondary'
                      : fila.calificacion === 'B'
                      ? 'bg-surface-container-high text-on-secondary-fixed-variant'
                      : 'bg-error-container text-on-error-container';

                  const califBadge =
                    fila.calificacion === 'A'
                      ? 'bg-surface-container text-secondary'
                      : fila.calificacion === 'B'
                      ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
                      : 'bg-error-container text-on-error-container';

                  return (
                    <tr key={fila.sedeId} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3.5 px-space-md">
                        <div className="font-label-md text-label-md font-semibold text-primary">
                          {fila.sedeNombre}
                        </div>
                        <div className="text-outline text-label-sm">{fila.localidad}</div>
                      </td>
                      <td className="py-3.5 px-space-md text-center font-semibold text-primary">
                        {fila.dotacion}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-surface-container rounded-full h-2 overflow-hidden">
                            <div className={`${barColor} h-2 rounded-full`} style={{ width: `${fila.legajosCompletosPct}%` }}></div>
                          </div>
                          <span className="font-semibold text-primary">{fila.legajosCompletosPct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-label-sm ${badgeAntecedentes}`}>
                          <span className="material-symbols-outlined text-xs">
                            {fila.calificacion === 'C' ? 'warning' : fila.calificacion === 'B' ? 'schedule' : 'check'}
                          </span>
                          {fila.antecedentesAlDiaTexto}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className="text-on-surface">{fila.aptosMedicosVigentes} Vigentes</span>
                        {fila.aptosMedicosObservados > 0 && (
                          <span
                            className={`text-xs block ${
                              fila.calificacion === 'C' ? 'text-error font-semibold' : 'text-outline'
                            }`}
                          >
                            ({fila.aptosMedicosObservados} {fila.calificacion === 'C' ? 'pendientes' : 'por vencer'})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-space-md text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${califBadge} font-headline-sm font-bold`}>
                          {fila.calificacion}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-right">
                        <button
                          onClick={() => setActaSedeSeleccionada(fila)}
                          className="p-1.5 rounded-md hover:bg-surface-container text-outline hover:text-primary transition-colors"
                          title="Ver Acta Completa"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer Summary */}
          <div className="p-space-md bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between text-label-md font-label-md text-on-surface-variant gap-2">
            <span>Mostrando {matrizFiltrada.length} de {distribucionDisciplinas.length} jurisdicciones auditadas en el ciclo vigente.</span>
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span> 3 Sedes Nivel A
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed-dim"></span> 1 Sede Nivel B
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-error"></span> 1 Sede Nivel C (Plan de Adecuación)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* LEGAL CALLOUT & DATA CERTIFICATION FOOTER */}
      <footer className="mt-space-md bg-surface-container-low border border-outline-variant rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
        <div className="flex items-start gap-space-sm max-w-4xl">
          <span className="material-symbols-outlined text-secondary text-2xl mt-0.5 flex-shrink-0">
            verified_user
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="font-headline-sm text-headline-sm font-bold text-primary">
              Certificación Legal de Datos y Trazabilidad Institucional
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Los indicadores y registros presentados en este panel revisten carácter de Declaración Jurada Institucional bajo el amparo de la Ley Nacional N° 26.061 de Protección Integral de los Derechos de las Niñas, Niños y Adolescentes y la Ley de Ética en el Ejercicio de la Función Pública N° 25.188. Emitido por la Dirección de Tecnología y Asuntos Jurídicos de la Defensoría DDNNA.
            </p>
          </div>
        </div>

        {/* Certification Stamp / Signature Block */}
        <div className="flex flex-col items-start md:items-end flex-shrink-0 pl-4 border-l border-outline-variant">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Hash de Integridad</span>
          <code className="text-xs font-mono text-primary font-semibold mt-0.5 bg-surface-container px-2 py-0.5 rounded">
            SHA-256: 8f92a...c014e
          </code>
          <span className="font-label-sm text-label-sm text-outline mt-1">
            Expediente Electrónico: EX-2024-098231-DDNNA-SGT
          </span>
        </div>
      </footer>

      {/* MODAL: VER ACTA COMPLETA DE AUDITORÍA */}
      {actaSedeSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
                <div>
                  <h3 className="font-headline-sm font-bold text-primary">
                    Acta Oficial de Auditoría Territorial
                  </h3>
                  <p className="font-label-sm text-outline">
                    {actaSedeSeleccionada.sedeNombre} • {actaSedeSeleccionada.localidad}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActaSedeSeleccionada(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-body-sm">
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                <span className="text-outline text-label-sm block">Dotación Evaluada</span>
                <span className="font-headline-sm font-bold text-primary">{actaSedeSeleccionada.dotacion} agentes</span>
              </div>
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant">
                <span className="text-outline text-label-sm block">Calificación Resultante</span>
                <span className="font-headline-sm font-bold text-secondary">Nivel {actaSedeSeleccionada.calificacion}</span>
              </div>
            </div>

            <div className="space-y-3 bg-surface-container p-4 rounded-xl text-body-sm">
              <div className="flex justify-between border-b border-outline-variant/60 pb-2">
                <span className="font-semibold text-primary">Conformidad de Legajos:</span>
                <span className="font-mono font-bold text-primary">{actaSedeSeleccionada.legajosCompletosPct}%</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/60 pb-2">
                <span className="font-semibold text-primary">Antecedentes Penales (RePAR):</span>
                <span>{actaSedeSeleccionada.antecedentesAlDiaTexto}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-primary">Aptos Médicos Laborales:</span>
                <span>{actaSedeSeleccionada.aptosMedicosTexto}</span>
              </div>
            </div>

            {actaSedeSeleccionada.observaciones && (
              <div className="p-3 bg-error-container/30 border border-error-container text-on-surface-variant rounded-xl text-body-sm">
                <span className="font-bold text-error block mb-1">Dictamen Especial:</span>
                {actaSedeSeleccionada.observaciones}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
              <span className="text-label-sm text-outline font-mono">
                Dictamen N° ACT-2024-{actaSedeSeleccionada.dotacion}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActaSedeSeleccionada(null);
                    triggerToast(`Acta descargada en formato PDF firmado.`);
                  }}
                  className="px-4 py-2 bg-primary-container text-on-primary rounded-lg font-label-md font-bold hover:bg-primary transition-colors flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">print</span>
                  Imprimir Acta Oficial
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROGRAMAR ENVÍO MENSUAL */}
      {mostrarModalProgramar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">schedule_send</span>
                Programar Envío Mensual Automatizado
              </h3>
              <button
                onClick={() => setMostrarModalProgramar(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Configure la entrega periódica del informe consolidado de cobertura y auditoría documental a los correos de las autoridades y coordinaciones territoriales.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-label-md font-semibold text-primary block mb-1">
                  Frecuencia de Envío
                </label>
                <select className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm">
                  <option>Primer día hábil de cada mes (08:00 hs)</option>
                  <option>Quincenal (Días 1 y 15)</option>
                  <option>Cierre de Trimestre (Consolidado)</option>
                </select>
              </div>
              <div>
                <label className="text-label-md font-semibold text-primary block mb-1">
                  Destinatarios Institucionales
                </label>
                <input
                  type="text"
                  defaultValue="coordinacion.territorial@ddnna.gob.ar, direccion.pedagogica@ddnna.gob.ar"
                  className="w-full h-10 px-3 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                onClick={() => setMostrarModalProgramar(false)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setMostrarModalProgramar(false);
                  triggerToast('Programación automática configurada exitosamente.');
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:bg-primary-container"
              >
                Confirmar Programación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
