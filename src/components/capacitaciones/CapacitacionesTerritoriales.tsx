import React, { useEffect, useState, useMemo } from 'react';
import {
  getSolicitudesCapacitacion,
  dictaminarSolicitud,
  type SolicitudCapacitacion,
  type CapacitacionesMetricas,
} from '../../services/capacitaciones';
import { SolicitudCapacitacionForm } from './SolicitudCapacitacionForm';
import { formatearFecha } from '../../utils/legajoCalculations';
import type { SubSede, Profile } from '../../types/legajo';

interface Props {
  currentUserId: string;
  perfilActual?: Profile | null;
}

export const CapacitacionesTerritoriales: React.FC<Props> = ({ currentUserId, perfilActual }) => {
  const [solicitudes, setSolicitudes] = useState<SolicitudCapacitacion[]>([]);
  const [metricas, setMetricas] = useState<CapacitacionesMetricas>({
    totalDemandas: 0,
    enRevision: 0,
    aprobadas: 0,
    observadas: 0,
    realizadas: 0,
  });
  const [docentesDisponibles, setDocentesDisponibles] = useState<Profile[]>([]);
  const [subSedes, setSubSedes] = useState<SubSede[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sub-vista: 'list' (dashboard de dictamen) vs 'form' (formulario de 3 pasos)
  const [subView, setSubView] = useState<'list' | 'form'>('list');

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroSubSede, setFiltroSubSede] = useState<string>('');
  const [filtroTematica, setFiltroTematica] = useState<string>('');

  // Solicitud en foco para el Drawer de Dictamen
  const [selectedSolicitud, setSelectedSolicitud] = useState<SolicitudCapacitacion | null>(null);

  // Formulario del Drawer
  const [dictamenTipo, setDictamenTipo] = useState<'aprobar' | 'observar' | 'rechazar'>('aprobar');
  const [docenteSeleccionado, setDocenteSeleccionado] = useState<string>('');
  const [fechaConfirmada, setFechaConfirmada] = useState<string>('');
  const [cargaHoraria, setCargaHoraria] = useState<number>(6);
  const [observacionesDictamen, setObservacionesDictamen] = useState<string>('');
  const [savingDictamen, setSavingDictamen] = useState(false);
  const [dictamenSuccessMsg, setDictamenSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSolicitudesCapacitacion();
      setSolicitudes(res.solicitudes);
      setMetricas(res.metricas);
      setDocentesDisponibles(res.docentesDisponibles);
      setSubSedes(res.subSedes);

      if (res.solicitudes.length > 0 && !selectedSolicitud) {
        selectSolicitudForDrawer(res.solicitudes[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar capacitaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectSolicitudForDrawer = (sol: SolicitudCapacitacion) => {
    setSelectedSolicitud(sol);
    setDictamenSuccessMsg(null);
    setFechaConfirmada(sol.fecha_propuesta || new Date().toISOString().split('T')[0]);
    setObservacionesDictamen(
      sol.comentario_revision ||
        `Se aprueba la solicitud para ${sol.sub_sedes?.nombre || 'la sub-sede'}. Se requiere coordinar el listado de participantes para la emisión de certificaciones oficiales.`
    );
    if (sol.estado === 'postergada' || sol.estado === 'suspendida') {
      setDictamenTipo('observar');
    } else if (sol.estado === 'aprobada' || sol.estado === 'aprobada_area') {
      setDictamenTipo('aprobar');
    } else {
      setDictamenTipo('aprobar');
    }
  };

  const handleConfirmarDictamen = async () => {
    if (!selectedSolicitud) return;

    try {
      setSavingDictamen(true);
      setDictamenSuccessMsg(null);

      const estadoMapped =
        dictamenTipo === 'aprobar'
          ? 'aprobada'
          : dictamenTipo === 'observar'
          ? 'postergada'
          : 'suspendida';

      const docente = docentesDisponibles.find((d) => d.id === docenteSeleccionado);
      const docenteNombre = docente
        ? `${docente.nombre} ${docente.apellido} (${docente.cargo || 'Especialista'})`
        : 'Equipo Central DDNNA';

      const updated = await dictaminarSolicitud(selectedSolicitud.id, {
        estado: estadoMapped,
        comentario_revision: observacionesDictamen,
        revisado_por: currentUserId,
        fecha_confirmada: fechaConfirmada,
        carga_horaria: cargaHoraria,
        docente_nombre: docenteNombre,
        area_asignada_id: selectedSolicitud.area_asignada_id,
      });

      setSelectedSolicitud(updated);
      setSolicitudes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setDictamenSuccessMsg(`¡Dictamen registrado como ${dictamenTipo.toUpperCase()} con éxito!`);
      setTimeout(() => setDictamenSuccessMsg(null), 4000);
    } catch (err: any) {
      alert('Error al dictaminar: ' + err.message);
    } finally {
      setSavingDictamen(false);
    }
  };

  // Filtrado de solicitudes
  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((sol) => {
      if (filtroEstado === 'revision') {
        if (sol.estado !== 'enviada' && sol.estado !== 'en_coordinacion' && sol.estado !== 'derivada_area') return false;
      } else if (filtroEstado === 'aprobadas') {
        if (sol.estado !== 'aprobada' && sol.estado !== 'aprobada_area') return false;
      } else if (filtroEstado === 'observadas') {
        if (sol.estado !== 'postergada' && sol.estado !== 'suspendida' && sol.estado !== 'cancelada') return false;
      }

      if (filtroSubSede && sol.sub_sede_id !== filtroSubSede) return false;

      if (filtroTematica) {
        const q = filtroTematica.toLowerCase();
        if (!sol.tema.toLowerCase().includes(q) && !(sol.descripcion || '').toLowerCase().includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [solicitudes, filtroEstado, filtroSubSede, filtroTematica]);

  // Si está en modo formulario completo de solicitud
  if (subView === 'form') {
    return (
      <SolicitudCapacitacionForm
        subSedes={subSedes}
        perfilActual={perfilActual}
        onVolver={() => setSubView('list')}
        onSolicitudEnviada={() => {
          setSubView('list');
          loadData();
        }}
      />
    );
  }

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg text-on-surface font-body-md">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant pb-space-md">
        <div>
          <div className="flex items-center gap-2 text-label-sm font-label-sm text-outline mb-1">
            <span>DDNNA</span>
            <span>/</span>
            <span>Dirección de Formación Continua</span>
            <span>/</span>
            <span className="text-secondary font-semibold">Aprobaciones Territoriales</span>
          </div>
          <h1 className="text-headline-lg font-headline-lg font-bold text-primary tracking-tight">
            Gestión y Aprobación de Capacitaciones Territoriales
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant mt-0.5">
            Monitoreo, dictamen y asignación de formadores para demandas de sub-sedes.
          </p>
        </div>

        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={() => setSubView('form')}
            className="inline-flex items-center gap-1.5 px-space-md h-10 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ Nueva Solicitud</span>
          </button>
          <button
            onClick={() => alert('Abriendo calendario federal sincronizado...')}
            className="inline-flex items-center gap-1.5 px-space-md h-10 bg-secondary text-on-secondary rounded-xl font-label-md text-label-md hover:bg-secondary/90 transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            <span>Calendario Federal</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm">
          {error}
        </div>
      )}

      {/* Summary Badges & Counters Strip (5 Bento-styled metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-space-md">
        {/* 1. Todas */}
        <div
          onClick={() => setFiltroEstado('todos')}
          className={`border rounded-xl p-space-md flex flex-col justify-between shadow-sm cursor-pointer transition-all ${
            filtroEstado === 'todos'
              ? 'bg-surface-container border-2 border-primary'
              : 'bg-surface-container-lowest border-outline-variant hover:border-secondary'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-label-md text-on-surface-variant">Todas las Demandas</span>
            <span className="material-symbols-outlined text-outline text-[20px]">library_books</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-display-lg font-display-lg text-primary">{metricas.totalDemandas}</span>
            <span className="text-label-sm font-label-sm text-outline">Totales</span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
          </div>
        </div>

        {/* 2. En Revisión */}
        <div
          onClick={() => setFiltroEstado('revision')}
          className={`border rounded-xl p-space-md flex flex-col justify-between shadow-sm cursor-pointer transition-all ${
            filtroEstado === 'revision'
              ? 'bg-amber-50 border-2 border-amber-500'
              : 'bg-surface-container-lowest border-amber-300 hover:border-amber-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-label-md text-amber-800 font-semibold">En Revisión</span>
            <span className="material-symbols-outlined text-amber-600 text-[20px]">pending</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-display-lg font-display-lg text-amber-700">{metricas.enRevision}</span>
            <span className="text-label-sm font-label-sm text-amber-700 font-medium">Urgentes</span>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, metricas.enRevision * 20)}%` }}></div>
          </div>
        </div>

        {/* 3. Aprobadas */}
        <div
          onClick={() => setFiltroEstado('aprobadas')}
          className={`border rounded-xl p-space-md flex flex-col justify-between shadow-sm cursor-pointer transition-all ${
            filtroEstado === 'aprobadas'
              ? 'bg-teal-50 border-2 border-teal-600'
              : 'bg-surface-container-lowest border-outline-variant hover:border-teal-500'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-label-md text-teal-800">Aprobadas</span>
            <span className="material-symbols-outlined text-teal-600 text-[20px]">check_circle</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-display-lg font-display-lg text-teal-800">{metricas.aprobadas}</span>
            <span className="text-label-sm font-label-sm text-teal-600 font-medium">Con docente</span>
          </div>
          <div className="w-full bg-teal-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-teal-600 h-full rounded-full" style={{ width: `${Math.min(100, metricas.aprobadas * 15)}%` }}></div>
          </div>
        </div>

        {/* 4. Observadas */}
        <div
          onClick={() => setFiltroEstado('observadas')}
          className={`border rounded-xl p-space-md flex flex-col justify-between shadow-sm cursor-pointer transition-all ${
            filtroEstado === 'observadas'
              ? 'bg-error-container/40 border-2 border-error'
              : 'bg-surface-container-lowest border-outline-variant hover:border-error'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-label-md text-error">Rechazadas / Obs.</span>
            <span className="material-symbols-outlined text-error text-[20px]">error</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-display-lg font-display-lg text-error">{metricas.observadas}</span>
            <span className="text-label-sm font-label-sm text-error/80">A corregir</span>
          </div>
          <div className="w-full bg-error-container rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: `${Math.min(100, metricas.observadas * 20)}%` }}></div>
          </div>
        </div>

        {/* 5. Realizadas */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-md font-label-md text-on-surface-variant">Realizadas</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">task_alt</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-display-lg font-display-lg text-primary">{metricas.realizadas}</span>
            <span className="text-label-sm font-label-sm text-outline">Concluidas</span>
          </div>
          <div className="w-full bg-surface-container rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: '30%' }}></div>
          </div>
        </div>
      </div>

      {/* Filters Bar Component */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm flex-1">
          {/* Filtro Sub-Sede */}
          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-label-sm text-outline">Sub-Sede solicitante</label>
            <select
              value={filtroSubSede}
              onChange={(e) => setFiltroSubSede(e.target.value)}
              className="w-full h-10 px-3 text-body-sm font-body-sm bg-surface border border-outline-variant rounded-lg focus:ring-1 focus:ring-secondary focus:border-secondary text-on-surface"
            >
              <option value="">Todas las Sub-Sedes</option>
              {subSedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Temática */}
          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-label-sm text-outline">Buscar por temática</label>
            <input
              type="text"
              value={filtroTematica}
              onChange={(e) => setFiltroTematica(e.target.value)}
              placeholder="Ej. Protocolo, Abuso, Micaela..."
              className="w-full h-10 px-3 text-body-sm font-body-sm bg-surface border border-outline-variant rounded-lg focus:ring-1 focus:ring-secondary focus:border-secondary text-on-surface"
            />
          </div>

          {/* Estado Rápido */}
          <div className="flex flex-col gap-1">
            <label className="text-label-sm font-label-sm text-outline">Estado del Proceso</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full h-10 px-3 text-body-sm font-body-sm bg-surface border border-outline-variant rounded-lg focus:ring-1 focus:ring-secondary focus:border-secondary text-on-surface"
            >
              <option value="todos">Todos los Estados</option>
              <option value="revision">En Revisión / Pendientes</option>
              <option value="aprobadas">Aprobadas</option>
              <option value="observadas">Observadas / Rechazadas</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-space-sm pt-2 lg:pt-4">
          <button
            onClick={() => {
              setFiltroEstado('todos');
              setFiltroSubSede('');
              setFiltroTematica('');
            }}
            className="h-10 px-3 text-on-surface-variant hover:text-primary font-label-md text-label-md flex items-center gap-1"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Solicitudes List (Left) + Open Approval Drawer (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Interactive Solicitud Cards List */}
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          <div className="flex items-center justify-between px-1">
            <span className="text-label-lg font-label-lg text-primary">
              Solicitudes Registradas ({solicitudesFiltradas.length} encontradas)
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-outline flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
              <p>Cargando demandas de capacitación...</p>
            </div>
          ) : solicitudesFiltradas.length === 0 ? (
            <div className="p-8 text-center text-outline bg-surface-container-lowest rounded-xl border border-outline-variant">
              No hay solicitudes que coincidan con los filtros seleccionados.
            </div>
          ) : (
            solicitudesFiltradas.map((sol, index) => {
              const isSelected = selectedSolicitud?.id === sol.id;
              const isAprobada = sol.estado === 'aprobada' || sol.estado === 'aprobada_area';
              const isObservada = sol.estado === 'postergada' || sol.estado === 'suspendida' || sol.estado === 'cancelada';

              return (
                <div
                  key={sol.id}
                  onClick={() => selectSolicitudForDrawer(sol)}
                  className={`bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow transition-all relative overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'border-2 border-secondary ring-4 ring-secondary-container/20'
                      : isObservada
                      ? 'border border-error/40'
                      : isAprobada
                      ? 'border border-teal-300'
                      : 'border border-amber-300'
                  }`}
                >
                  {/* Left accent bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                      isAprobada ? 'bg-teal-600' : isObservada ? 'bg-error' : 'bg-amber-500'
                    }`}
                  ></div>

                  <div className="flex flex-col gap-space-md">
                    {/* Top Row: ID, Badges and Territorial Info */}
                    <div className="flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-surface-container font-mono text-label-md font-semibold text-primary">
                          #CAP-2025-0{index + 1}
                        </span>

                        {isAprobada ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 font-label-md text-label-md font-semibold">
                            <span className="material-symbols-outlined text-[16px] text-teal-700">verified</span>
                            <span>Aprobada</span>
                          </span>
                        ) : isObservada ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-semibold">
                            <span className="material-symbols-outlined text-[16px] text-error">report_problem</span>
                            <span>Observada</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-label-md text-label-md font-semibold">
                            <span className="material-symbols-outlined text-[16px] text-amber-700">schedule</span>
                            <span>En Revisión</span>
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface text-outline font-label-sm text-label-sm">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span>{sol.sub_sedes?.nombre || 'Sede Territorial'}</span>
                        </span>
                      </div>

                      <div className="text-label-sm font-label-sm text-outline">
                        Ingreso: {formatearFecha(sol.created_at)}
                      </div>
                    </div>

                    {/* Content Body */}
                    <div>
                      <h3 className="text-headline-sm font-headline-sm font-bold text-primary mb-1.5">
                        {sol.tema}
                      </h3>
                      <p className="text-body-sm font-body-sm text-on-surface-variant">
                        {sol.descripcion || sol.justificacion || 'Demanda formativa para fortalecimiento de equipos.'}
                      </p>
                    </div>

                    {/* Metadata Chips Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm py-2 px-3 bg-surface-container-low rounded-xl border border-outline-variant/50">
                      <div className="flex flex-col">
                        <span className="text-label-sm font-label-sm text-outline">Solicitante</span>
                        <span className="text-label-md font-label-md text-primary font-medium">
                          {sol.solicitante ? `${sol.solicitante.nombre} ${sol.solicitante.apellido}` : 'Referente Zonal'}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">{sol.solicitante?.cargo || 'Coord. Zonal'}</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-label-sm font-label-sm text-outline">Participantes</span>
                        <span className="text-label-md font-label-md text-primary font-bold">
                          {sol.cantidad_participantes || 30} agentes
                        </span>
                        <span className="text-[11px] text-on-surface-variant">Equipos Técnicos</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-label-sm font-label-sm text-outline">Fecha Propuesta</span>
                        <span className="text-label-md font-label-md text-primary font-medium">
                          {formatearFecha(sol.fecha_propuesta)}
                        </span>
                        <span className="text-[11px] text-on-surface-variant">Turno Confirmable</span>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-label-sm font-label-sm text-outline">Modalidad</span>
                        <span className="text-label-md font-label-md text-secondary font-medium">
                          Presencial Territorial
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          {sol.sub_sedes?.localidad || 'En Delegación'}
                        </span>
                      </div>
                    </div>

                    {/* Card Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-space-sm pt-2" onClick={(e) => e.stopPropagation()}>
                      {sol.justificacion ? (
                        <button
                          onClick={() => alert(`Justificación oficial:\n\n${sol.justificacion}`)}
                          className="text-secondary font-label-md text-label-md hover:underline flex items-center gap-1"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">description</span>
                          <span>Ver Justificación Completa</span>
                        </button>
                      ) : (
                        <div></div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => selectSolicitudForDrawer(sol)}
                          className="h-9 px-4 rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 font-label-md text-label-md flex items-center gap-1.5 shadow-sm transition-colors"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">gavel</span>
                          <span>Dictaminar / Resolver</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Persistent Interactive Drawer / Panel de Dictamen */}
        <div className="xl:col-span-5 bg-surface-container-lowest border-2 border-primary-container rounded-2xl shadow-xl overflow-hidden sticky top-20">
          {selectedSolicitud ? (
            <>
              {/* Drawer Header */}
              <div className="bg-primary-container p-space-md text-on-primary flex items-center justify-between">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-lg bg-surface-container-low/20 flex items-center justify-center text-secondary-container">
                    <span className="material-symbols-outlined text-[20px]">edit_document</span>
                  </div>
                  <div>
                    <h2 className="text-headline-sm font-headline-sm font-bold leading-tight">
                      Panel de Dictamen Técnico
                    </h2>
                    <span className="text-label-sm font-label-sm text-primary-fixed">
                      Expediente: {selectedSolicitud.tema.substring(0, 30)}...
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-400 text-on-surface font-label-sm text-label-sm font-bold">
                  Resolución Central
                </span>
              </div>

              {/* Drawer Form Body */}
              <form
                className="p-space-lg flex flex-col gap-space-md"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleConfirmarDictamen();
                }}
              >
                {/* Resumen de Solicitud en foco */}
                <div className="p-space-sm bg-surface-container-low rounded-xl border border-outline-variant flex flex-col gap-1">
                  <span className="text-label-sm font-label-sm text-outline">Capacitación a resolver:</span>
                  <p className="text-label-md font-label-md font-bold text-primary">
                    {selectedSolicitud.tema}
                  </p>
                  <div className="flex items-center gap-3 text-label-sm font-label-sm text-on-surface-variant pt-1 border-t border-outline-variant/40 mt-1">
                    <span>
                      Sub-Sede: <strong>{selectedSolicitud.sub_sedes?.nombre || 'Territorial'}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Cupo: <strong>{selectedSolicitud.cantidad_participantes || 30} personas</strong>
                    </span>
                  </div>
                </div>

                {dictamenSuccessMsg && (
                  <div className="p-3 bg-[#CCFBF1] text-[#0F766E] text-body-sm rounded-lg flex items-center gap-2 border border-teal-300">
                    <span className="material-symbols-outlined text-[20px]">check_circle</span>
                    <span className="font-bold">{dictamenSuccessMsg}</span>
                  </div>
                )}

                {/* Form Field: Tipo de Dictamen */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-primary font-semibold">
                    Resolución del Dictamen
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDictamenTipo('aprobar')}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-lg font-label-md text-label-md font-bold transition-all ${
                        dictamenTipo === 'aprobar'
                          ? 'border-2 border-secondary bg-surface-container-low text-secondary'
                          : 'border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Aprobar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDictamenTipo('observar')}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-lg font-label-md text-label-md font-bold transition-all ${
                        dictamenTipo === 'observar'
                          ? 'border-2 border-amber-500 bg-amber-50 text-amber-800'
                          : 'border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">rate_review</span>
                      <span>Observar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDictamenTipo('rechazar')}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-lg font-label-md text-label-md font-bold transition-all ${
                        dictamenTipo === 'rechazar'
                          ? 'border-2 border-error bg-error-container text-on-error-container'
                          : 'border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      <span>Suspender</span>
                    </button>
                  </div>
                </div>

                {/* Form Field: Formador / Equipo Docente Asignado */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-primary font-semibold" htmlFor="formador_select">
                    Formador / Equipo Docente Asignado <span className="text-error">*</span>
                  </label>
                  <select
                    id="formador_select"
                    value={docenteSeleccionado}
                    onChange={(e) => setDocenteSeleccionado(e.target.value)}
                    className="w-full h-11 px-3 text-body-md font-body-md bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-on-surface"
                  >
                    <option value="">Seleccionar formador del cuerpo docente oficial...</option>
                    {docentesDisponibles.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.apellido}, {doc.nombre} — {doc.cargo || 'Especialista DDNNA'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Form Field: Fecha y Carga Horaria */}
                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="text-label-sm font-label-sm text-outline">Fecha de Realización</label>
                    <input
                      type="date"
                      value={fechaConfirmada}
                      onChange={(e) => setFechaConfirmada(e.target.value)}
                      className="h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm font-body-sm focus:border-secondary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-label-sm font-label-sm text-outline">Carga Horaria (Hs)</label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={cargaHoraria}
                      onChange={(e) => setCargaHoraria(Number(e.target.value))}
                      className="h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm font-body-sm focus:border-secondary"
                    />
                  </div>
                </div>

                {/* Form Field: Observaciones institucionales */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-primary font-semibold" htmlFor="observaciones_textarea">
                    Directrices y Observaciones Institucionales
                  </label>
                  <textarea
                    id="observaciones_textarea"
                    rows={4}
                    value={observacionesDictamen}
                    onChange={(e) => setObservacionesDictamen(e.target.value)}
                    placeholder="Ingrese las directrices pedagógicas, acuerdos con la sub-sede o requerimientos de logística y certificación..."
                    className="w-full p-3 text-body-sm font-body-sm bg-surface-container-lowest border border-outline-variant rounded-xl focus:border-secondary focus:ring-2 focus:ring-secondary/20 text-on-surface"
                  />
                </div>

                {/* Action Buttons in Drawer */}
                <div className="pt-space-sm border-t border-outline-variant flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={savingDictamen}
                    className="w-full h-11 bg-primary text-on-primary font-label-lg text-label-lg rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2 shadow transition-all focus:ring-2 focus:ring-secondary disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">send</span>
                    <span>{savingDictamen ? 'Guardando...' : 'Confirmar Dictamen y Notificar a Sub-Sede'}</span>
                  </button>
                </div>
              </form>

              {/* Audit footer inside drawer */}
              <div className="px-space-md py-2.5 bg-surface-container border-t border-outline-variant flex items-center justify-between text-label-sm font-label-sm text-outline">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">lock</span>
                  <span>Firma digital: Registro Federal</span>
                </span>
                <span>Auditado Ley 26.061</span>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-outline">
              Seleccione una solicitud para dictaminar o revisar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
