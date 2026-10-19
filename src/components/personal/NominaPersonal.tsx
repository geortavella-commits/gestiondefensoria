import React, { useState, useEffect, useMemo } from 'react';
import {
  getNominaPersonalData,
  type NominaData,
  type AgenteNominaItem,
} from '../../services/nomina';

interface FiltroForzado {
  areaNombre?: string | null;
  subSedeId?: string | null;
  etiqueta: string;
}

interface Props {
  onVerLegajo: (profileId: string) => void;
  onCrearAgente: () => void;
  onEditarAgente?: (profileId: string) => void;
  // Cuando viene de la vista previa de rol: bloquea los filtros de área/sub-sede
  // a lo que ese rol vería de verdad, para no mostrar el listado completo.
  filtroForzado?: FiltroForzado | null;
}

export const NominaPersonal: React.FC<Props> = ({
  onVerLegajo,
  onCrearAgente,
  onEditarAgente,
  filtroForzado,
}) => {
  const [data, setData] = useState<NominaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros Paramétricos
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [filtroSubSede, setFiltroSubSede] = useState('all');
  const [filtroArea, setFiltroArea] = useState('all');
  const [filtroEstadoDoc, setFiltroEstadoDoc] = useState('all');
  const [chipFiltroRapido, setChipFiltroRapido] = useState<string>('todos');

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(10);

  useEffect(() => {
    setFiltroSubSede(filtroForzado?.subSedeId || 'all');
    setFiltroArea(filtroForzado?.areaNombre || 'all');
    setPaginaActual(1);
  }, [filtroForzado]);

  // Modales
  const [agenteParaNotificar, setAgenteParaNotificar] = useState<AgenteNominaItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getNominaPersonalData();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Error al cargar nómina de personal');
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

  const handleLimpiarFiltros = () => {
    setBusquedaTexto('');
    setFiltroSubSede('all');
    setFiltroArea('all');
    setFiltroEstadoDoc('all');
    setChipFiltroRapido('todos');
    setPaginaActual(1);
  };

  // Filtrado reactivo
  const agentesFiltrados = useMemo(() => {
    if (!data) return [];

    return data.agentes.filter((ag) => {
      // Búsqueda de texto
      if (busquedaTexto.trim()) {
        const query = busquedaTexto.toLowerCase();
        const coincide =
          ag.nombreCompleto.toLowerCase().includes(query) ||
          ag.dni.toLowerCase().includes(query) ||
          ag.legajo.toLowerCase().includes(query) ||
          ag.cargo.toLowerCase().includes(query);
        if (!coincide) return false;
      }

      // Sub-Sede
      if (filtroSubSede !== 'all') {
        const coincideSede =
          ag.subSedeId === filtroSubSede ||
          ag.subSedeNombre.toLowerCase().includes(filtroSubSede.toLowerCase());
        if (!coincideSede) return false;
      }

      // Área
      if (filtroArea !== 'all') {
        const coincideArea =
          ag.areaNombre.toLowerCase().includes(filtroArea.toLowerCase()) ||
          ag.cargo.toLowerCase().includes(filtroArea.toLowerCase());
        if (!coincideArea) return false;
      }

      // Estado documental selector
      if (filtroEstadoDoc !== 'all') {
        if (filtroEstadoDoc === 'complete' && ag.estadoGeneral !== 'completo') return false;
        if (filtroEstadoDoc === 'pending' && ag.estadoGeneral !== 'pendiente') return false;
        if (filtroEstadoDoc === 'expired' && ag.estadoGeneral !== 'alerta') return false;
      }

      // Chip rápido
      if (chipFiltroRapido === 'al_dia' && ag.estadoGeneral !== 'completo') return false;
      if (chipFiltroRapido === 'pendiente' && ag.estadoGeneral !== 'pendiente') return false;
      if (chipFiltroRapido === 'critico' && ag.estadoGeneral !== 'alerta') return false;
      if (chipFiltroRapido === 'penal_ok') {
        const penal = ag.semaforo.find((s) => s.codigo === 'P');
        if (penal?.estado !== 'ok') return false;
      }

      return true;
    });
  }, [data, busquedaTexto, filtroSubSede, filtroArea, filtroEstadoDoc, chipFiltroRapido]);

  // Paginación
  const totalPaginas = Math.ceil(agentesFiltrados.length / filasPorPagina) || 1;
  const agentesPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * filasPorPagina;
    return agentesFiltrados.slice(inicio, inicio + filasPorPagina);
  }, [agentesFiltrados, paginaActual, filasPorPagina]);

  // Exportar CSV
  const handleExportarCSV = () => {
    if (!agentesFiltrados.length) return;
    const headers = [
      'Nombre y Apellido',
      'DNI',
      'Legajo',
      'Sub-Sede',
      'Cargo',
      'Área',
      'Fecha Ingreso',
      'Antigüedad',
      'Estado General',
    ];
    const rows = agentesFiltrados.map((a) => [
      `"${a.nombreCompleto}"`,
      `"${a.dni}"`,
      `"${a.legajo}"`,
      `"${a.subSedeNombre}"`,
      `"${a.cargo}"`,
      `"${a.areaNombre}"`,
      `"${a.fechaIngreso}"`,
      `"${a.antiguedadTexto}"`,
      `"${a.estadoGeneralTexto}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nomina_personal_ddnna_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast('Nómina de personal exportada exitosamente en formato CSV.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
        <div className="font-label-md text-label-md text-primary font-bold">
          Cargando Nómina de Personal DDNNA...
        </div>
        <p className="font-body-sm text-body-sm text-outline">
          Consultando legajos, auditoría documental y asignaciones territoriales
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-space-lg bg-error-container text-on-error-container rounded-xl border border-error max-w-2xl mx-auto my-8">
        <h3 className="font-headline-sm font-bold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          Error al obtener la nómina
        </h3>
        <p className="font-body-md mt-2">{error || 'No se pudo recuperar la nómina de personal.'}</p>
        <button
          onClick={cargarDatos}
          className="mt-4 px-4 py-2 bg-error text-white rounded-lg font-label-md font-semibold hover:bg-opacity-90 transition-colors"
        >
          Reintentar Carga
        </button>
      </div>
    );
  }

  const { kpis, subSedes, areas } = data;

  return (
    <div className="flex-1 max-w-[1600px] w-full mx-auto space-y-space-md font-body-md text-on-surface">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-8 z-50 p-4 bg-[#CCFBF1] text-[#0F766E] border border-teal-300 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in">
          <span className="material-symbols-outlined text-xl">verified</span>
          <span className="font-label-md font-bold">{toastMsg}</span>
        </div>
      )}

      {/* BREADCRUMB CONTEXT */}
      <nav className="flex items-center gap-2 text-label-sm font-label-sm text-outline">
        <span>DDNNA Territorio</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span>Dirección de Recursos Humanos y Legajos</span>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-primary font-bold">Nómina Territorial Activa</span>
      </nav>

      {/* PAGE HEADER: TITLE + PRIMARY ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-outline-variant">
        <div>
          <h1 className="text-headline-lg font-headline-lg font-bold text-primary tracking-tight">
            Nómina de Personal y Gestión de Legajos
          </h1>
          <p className="text-body-md font-body-md text-on-surface-variant mt-0.5">
            Registro unificado de agentes técnicos, interdisciplinarios y administrativos con auditoría de cumplimiento documental.
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-shrink-0">
          <button
            onClick={handleExportarCSV}
            className="h-10 px-4 rounded-lg bg-surface-container-lowest border border-outline-variant text-primary font-label-md text-label-md hover:bg-surface-container-low flex items-center gap-2 shadow-xs transition-colors font-semibold"
          >
            <span className="material-symbols-outlined text-[20px] text-secondary">download</span>
            <span>Exportar Nómina (Excel / CSV)</span>
          </button>
          <button
            onClick={onCrearAgente}
            className="h-10 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container flex items-center gap-2 shadow-sm transition-all font-bold"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>+ Incorporar Nuevo Agente</span>
          </button>
        </div>
      </div>

      {/* QUICK KPI STATS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Metric 1: Total Registros */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Agentes Activos</span>
            <div className="text-headline-lg font-headline-lg font-bold text-primary mt-1">
              {kpis.totalAgentes}
            </div>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Distribuidos en {subSedes.length || 6} sub-sedes
            </span>
          </div>
          <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-[28px]">groups</span>
          </div>
        </div>

        {/* Metric 2: Legajos 100% Cumplimentados */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Legajos Completos</span>
            <div className="text-headline-lg font-headline-lg font-bold text-teal-700 mt-1">
              {kpis.legajosCompletos}
            </div>
            <span className="font-body-sm text-body-sm text-teal-800 flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {kpis.legajosCompletosPct}% idoneidad total
            </span>
          </div>
          <div className="w-12 h-12 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
        </div>

        {/* Metric 3: Documentación Pendiente */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Doc. Pendiente</span>
            <div className="text-headline-lg font-headline-lg font-bold text-amber-700 mt-1">
              {kpis.docPendiente}
            </div>
            <span className="font-body-sm text-body-sm text-amber-800 flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">schedule</span> Plazo hábil en curso
            </span>
          </div>
          <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
            <span className="material-symbols-outlined text-[28px]">pending_actions</span>
          </div>
        </div>

        {/* Metric 4: Alertas Críticas / Vencidos */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm flex items-center justify-between">
          <div>
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">Alertas / Vencidos</span>
            <div className="text-headline-lg font-headline-lg font-bold text-error mt-1">
              {kpis.alertasCriticas}
            </div>
            <span className="font-body-sm text-body-sm text-error flex items-center gap-1 font-semibold">
              <span className="material-symbols-outlined text-[16px]">error</span> Requiere subsanación
            </span>
          </div>
          <div className="w-12 h-12 rounded-lg bg-error-container flex items-center justify-center text-on-error-container">
            <span className="material-symbols-outlined text-[28px]">report_problem</span>
          </div>
        </div>
      </div>

      {/* ADVANCED FILTERING PANEL */}
      <section className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm space-y-space-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-label-lg text-label-lg">
            <span className="material-symbols-outlined text-[20px] text-secondary">filter_alt</span>
            <span>Filtros Paramétricos de Búsqueda</span>
          </div>
          {filtroForzado ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 text-label-sm font-label-sm font-bold">
              <span className="material-symbols-outlined text-[16px]">visibility</span>
              Vista previa: {filtroForzado.etiqueta}
            </span>
          ) : (
            <button
              onClick={handleLimpiarFiltros}
              className="text-secondary hover:text-primary font-label-md text-label-md flex items-center gap-1 transition-colors font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              <span>Limpiar Filtros</span>
            </button>
          )}
        </div>

        {/* Inputs Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-sm pt-1">
          {/* Filtro 1: Texto / DNI */}
          <div>
            <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">
              Nombre, Apellido o DNI
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={busquedaTexto}
                onChange={(e) => {
                  setBusquedaTexto(e.target.value);
                  setPaginaActual(1);
                }}
                className="w-full h-10 pl-9 pr-3 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                placeholder="Ej: Valenzuela, 32.890..."
              />
            </div>
          </div>

          {/* Filtro 2: Sub-Sede Territorial */}
          <div>
            <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">
              Sub-Sede Territorial
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                domain
              </span>
              <select
                value={filtroSubSede}
                disabled={!!filtroForzado}
                onChange={(e) => {
                  setFiltroSubSede(e.target.value);
                  setPaginaActual(1);
                }}
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="all">Todas las Sedes</option>
                {subSedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Filtro 3: Área / Especialidad */}
          <div>
            <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">
              Área / Cargo Técnico
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                badge
              </span>
              <select
                value={filtroArea}
                disabled={!!filtroForzado}
                onChange={(e) => {
                  setFiltroArea(e.target.value);
                  setPaginaActual(1);
                }}
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="all">Todas las Áreas</option>
                <option value="legal">Equipo Legal</option>
                <option value="social">Trabajo Social</option>
                <option value="psico">Psicología Infanto-Juvenil</option>
                <option value="acompanante">Acompañante Territorial</option>
                <option value="coordinacion">Coordinación Técnica</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>

          {/* Filtro 4: Estado Documental */}
          <div>
            <label className="block font-label-sm text-label-sm text-on-surface-variant mb-1">
              Estado Documental
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                rule
              </span>
              <select
                value={filtroEstadoDoc}
                onChange={(e) => {
                  setFiltroEstadoDoc(e.target.value);
                  setPaginaActual(1);
                }}
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none appearance-none"
              >
                <option value="all">Todos los Estados</option>
                <option value="complete">Completo / Al Día (Verde)</option>
                <option value="pending">Documentación Pendiente (Ámbar)</option>
                <option value="expired">Documento Vencido / Alerta (Rojo)</option>
              </select>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-[18px]">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Quick Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container">
          <span className="font-label-sm text-label-sm text-outline mr-1">Filtro rápido:</span>
          <button
            onClick={() => {
              setChipFiltroRapido('todos');
              setPaginaActual(1);
            }}
            className={`px-2.5 py-1 rounded-full text-label-sm font-label-sm flex items-center gap-1.5 shadow-xs transition-colors ${
              chipFiltroRapido === 'todos'
                ? 'bg-primary text-on-primary font-bold'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] bg-primary-container text-white px-1.5 rounded-full">
              {data.agentes.length}
            </span>
          </button>

          <button
            onClick={() => {
              setChipFiltroRapido('al_dia');
              setPaginaActual(1);
            }}
            className={`px-2.5 py-1 rounded-full text-label-sm font-label-sm flex items-center gap-1.5 border border-outline-variant transition-colors ${
              chipFiltroRapido === 'al_dia'
                ? 'bg-teal-700 text-white font-bold'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            <span>Al Día</span>
            <span className="text-[10px] text-outline font-semibold">{kpis.legajosCompletos}</span>
          </button>

          <button
            onClick={() => {
              setChipFiltroRapido('pendiente');
              setPaginaActual(1);
            }}
            className={`px-2.5 py-1 rounded-full text-label-sm font-label-sm flex items-center gap-1.5 border border-outline-variant transition-colors ${
              chipFiltroRapido === 'pendiente'
                ? 'bg-amber-700 text-white font-bold'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Subsanación Pendiente</span>
            <span className="text-[10px] text-outline font-semibold">{kpis.docPendiente}</span>
          </button>

          <button
            onClick={() => {
              setChipFiltroRapido('critico');
              setPaginaActual(1);
            }}
            className={`px-2.5 py-1 rounded-full text-label-sm font-label-sm flex items-center gap-1.5 border border-outline-variant transition-colors ${
              chipFiltroRapido === 'critico'
                ? 'bg-error text-white font-bold'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-error"></span>
            <span>Vencimientos Críticos</span>
            <span className="text-[10px] text-outline font-semibold">{kpis.alertasCriticas}</span>
          </button>

          <button
            onClick={() => {
              setChipFiltroRapido('penal_ok');
              setPaginaActual(1);
            }}
            className={`px-2.5 py-1 rounded-full text-label-sm font-label-sm flex items-center gap-1.5 border border-outline-variant transition-colors ${
              chipFiltroRapido === 'penal_ok'
                ? 'bg-secondary text-white font-bold'
                : 'bg-surface-container-low text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[14px] text-secondary">verified_user</span>
            <span>Apto Materia Penal Vigente</span>
          </button>
        </div>
      </section>

      {/* HIGH FIDELITY INSTITUTIONAL DATA TABLE */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold" scope="col">
                  Agente &amp; DNI
                </th>
                <th className="py-3.5 px-4 font-semibold" scope="col">
                  Sub-Sede Territorial
                </th>
                <th className="py-3.5 px-4 font-semibold" scope="col">
                  Cargo / Especialidad
                </th>
                <th className="py-3.5 px-4 font-semibold" scope="col">
                  Ingreso / Antigüedad
                </th>
                <th className="py-3.5 px-4 font-semibold" scope="col">
                  <div className="flex items-center gap-1">
                    <span>Semáforo Documental (5)</span>
                    <span
                      className="material-symbols-outlined text-[16px] text-outline cursor-help"
                      title="DNI [D], Título [T], Antecedentes Penales [P], Apto Médico [M], Contrato Territorial [C]"
                    >
                      info
                    </span>
                  </div>
                </th>
                <th className="py-3.5 px-4 font-semibold" scope="col">
                  Estado General
                </th>
                <th className="py-3.5 px-4 font-semibold text-right" scope="col">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm text-on-surface">
              {agentesPaginados.map((agente) => {
                const isAlertRow = agente.estadoGeneral === 'alerta';

                return (
                  <tr
                    key={agente.id}
                    className={`hover:bg-surface-container-low transition-colors duration-150 ${
                      isAlertRow ? 'bg-error/5' : ''
                    }`}
                  >
                    {/* Col 1: Agente & DNI */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          alt={agente.nombreCompleto}
                          className={`w-10 h-10 rounded-full object-cover border ${
                            isAlertRow ? 'border-error' : 'border-outline-variant'
                          }`}
                          src={
                            agente.avatarUrl ||
                            'https://lh3.googleusercontent.com/aida-public/AB6AXuBPcK6P4VlyrgHo0xVZNoyx6c0hKIFWwM4fRd1MQaQ0LE_msAgIHytNu5EIPIJuYRBP1kt67Y0ESnEBY45OdYqHkSjWt7_sGqv9PC5NeGGM6EHX_55IQuPGeyp93uO1EHLCs4ArahB8_xEH8Qa63CBa2EKKnFLtsLHpGVbQLYxAm_qHyIaDtdhMJhPwEAV7dwMrIMkMTvQaZxlbziuzYbhO5esBR7HZX95I9TCHi6C8L0-kRuhNfuTYyw'
                          }
                        />
                        <div>
                          <div className="font-label-md text-label-md font-bold text-primary flex items-center gap-1">
                            <span>{agente.nombreCompleto}</span>
                          </div>
                          <div className="font-body-sm text-body-sm text-outline">
                            {agente.dni} • {agente.legajo}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Sub-Sede Territorial */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-label-sm bg-surface-container text-primary font-medium border border-outline-variant">
                        <span className="material-symbols-outlined text-[14px] text-secondary">
                          {agente.subSedeNombre.includes('Central') ? 'location_city' : 'pin_drop'}
                        </span>
                        {agente.subSedeNombre}
                      </span>
                    </td>

                    {/* Col 3: Cargo / Especialidad */}
                    <td className="py-3 px-4">
                      <div className="font-label-md text-label-md text-primary font-medium">{agente.cargo}</div>
                      <div className="text-outline text-label-sm font-label-sm">{agente.areaNombre}</div>
                    </td>

                    {/* Col 4: Ingreso / Antigüedad */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-primary">{agente.fechaIngreso}</div>
                      <div className="text-outline text-label-sm font-label-sm">{agente.antiguedadTexto}</div>
                    </td>

                    {/* Col 5: Semáforo Documental (5) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {agente.semaforo.map((req) => {
                          const badgeBg =
                            req.estado === 'ok'
                              ? 'bg-teal-100 text-teal-800'
                              : req.estado === 'alerta'
                              ? 'bg-error-container text-error ring-1 ring-error'
                              : 'bg-amber-100 text-amber-800 ring-1 ring-amber-400';

                          return (
                            <span
                              key={req.codigo}
                              className={`w-6 h-6 rounded flex items-center justify-center text-[12px] font-bold ${badgeBg}`}
                              title={`${req.nombre}: ${req.tooltip}`}
                            >
                              {req.codigo}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Col 6: Estado General */}
                    <td className="py-3 px-4">
                      {agente.estadoGeneral === 'completo' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          Legajo Completo
                        </span>
                      )}
                      {agente.estadoGeneral === 'alerta' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-error-container text-on-error-container font-semibold border border-error/30">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            warning
                          </span>
                          Alerta Vencimiento
                        </span>
                      )}
                      {agente.estadoGeneral === 'pendiente' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-label-sm bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                          <span className="material-symbols-outlined text-[14px]">schedule</span>
                          Pendiente Subsanación
                        </span>
                      )}
                    </td>

                    {/* Col 7: Acciones */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onVerLegajo(agente.id)}
                          className="w-8 h-8 rounded flex items-center justify-center text-primary hover:bg-surface-container transition-colors"
                          title="Ver Legajo Completo"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => onEditarAgente && onEditarAgente(agente.id)}
                          className="w-8 h-8 rounded flex items-center justify-center text-outline hover:bg-surface-container transition-colors"
                          title="Editar Datos"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => setAgenteParaNotificar(agente)}
                          className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                            isAlertRow
                              ? 'text-error bg-error-container hover:bg-error hover:text-on-error'
                              : 'text-outline hover:bg-surface-container'
                          }`}
                          title={
                            isAlertRow
                              ? 'Notificar Urgente Subsanación'
                              : 'Solicitar Actualización Documental'
                          }
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {isAlertRow ? 'priority_high' : 'mail'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* INSTITUTIONAL PAGINATION BAR */}
        <div className="px-4 py-3 bg-surface-container-low border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-body-sm font-body-sm text-outline flex items-center gap-2">
            <span>
              Mostrando{' '}
              <span className="font-bold text-primary">
                {agentesFiltrados.length > 0 ? (paginaActual - 1) * filasPorPagina + 1 : 0}-
                {Math.min(paginaActual * filasPorPagina, agentesFiltrados.length)}
              </span>{' '}
              de <span className="font-bold text-primary">{agentesFiltrados.length}</span> agentes
            </span>
            <span className="h-3 w-px bg-outline-variant hidden sm:inline-block"></span>
            <div className="hidden sm:flex items-center gap-1.5 text-label-sm font-label-sm">
              <span>Filas por página:</span>
              <select
                value={filasPorPagina}
                onChange={(e) => {
                  setFilasPorPagina(Number(e.target.value));
                  setPaginaActual(1);
                }}
                className="h-7 px-1.5 rounded border border-outline-variant bg-surface-container-lowest text-primary text-label-sm font-label-sm focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Page Navigation Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPaginaActual(1)}
              disabled={paginaActual === 1}
              className="w-8 h-8 rounded border border-outline-variant bg-surface-container-lowest text-outline hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span>
            </button>
            <button
              onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
              disabled={paginaActual === 1}
              className="w-8 h-8 rounded border border-outline-variant bg-surface-container-lowest text-outline hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .slice(0, 5)
              .map((num) => (
                <button
                  key={num}
                  onClick={() => setPaginaActual(num)}
                  className={`w-8 h-8 rounded font-label-sm text-label-sm transition-colors ${
                    paginaActual === num
                      ? 'bg-primary text-on-primary font-bold shadow-xs'
                      : 'border border-outline-variant bg-surface-container-lowest text-primary hover:bg-surface-container font-medium'
                  }`}
                >
                  {num}
                </button>
              ))}

            {totalPaginas > 5 && <span className="px-1 text-outline text-label-sm">...</span>}

            <button
              onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaActual === totalPaginas}
              className="w-8 h-8 rounded border border-outline-variant bg-surface-container-lowest text-primary hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
            <button
              onClick={() => setPaginaActual(totalPaginas)}
              disabled={paginaActual === totalPaginas}
              className="w-8 h-8 rounded border border-outline-variant bg-surface-container-lowest text-primary hover:bg-surface-container flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_right</span>
            </button>
          </div>
        </div>
      </section>

      {/* INSTITUTIONAL COMPLIANCE & AUDIT FOOTER BANNER */}
      <footer className="p-4 rounded-xl bg-surface-container-low border border-outline-variant flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-body-sm font-body-sm text-outline">
        <div className="flex items-center gap-2 text-primary font-medium">
          <span className="material-symbols-outlined text-[20px] text-secondary">security</span>
          <span>Protocolo de Protección de Datos y Legajos Reservados (Ley N° 26.061)</span>
        </div>
        <div className="text-label-sm font-label-sm text-on-surface-variant flex items-center gap-4">
          <span>Última sincronización territorial: Hoy a las 09:42 hs</span>
          <span className="h-3 w-px bg-outline-variant"></span>
          <span>Hash Auditoría: #409-TX-882B</span>
        </div>
      </footer>

      {/* MODAL: NOTIFICAR AGENTE */}
      {agenteParaNotificar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="font-headline-sm font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">mail</span>
                Requerimiento de Actualización Documental
              </h3>
              <button
                onClick={() => setAgenteParaNotificar(null)}
                className="p-1 rounded-lg hover:bg-surface-container text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Se enviará una notificación oficial a <strong>{agenteParaNotificar.nombreCompleto}</strong> (
              {agenteParaNotificar.subSedeNombre}) para la subsanación de los requisitos observados en su legajo.
            </p>

            <div className="p-3 bg-surface-container rounded-xl text-body-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-outline">Estado del Legajo:</span>
                <span className="font-bold text-primary">{agenteParaNotificar.estadoGeneralTexto}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">Requisitos en Semáforo:</span>
                <span className="font-mono text-xs">
                  {agenteParaNotificar.semaforo.map((s) => `${s.codigo}:${s.estado}`).join(' | ')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
              <button
                onClick={() => setAgenteParaNotificar(null)}
                className="px-4 py-2 border border-outline-variant rounded-lg text-primary font-label-md hover:bg-surface-container font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  triggerToast(`Notificación formal enviada a ${agenteParaNotificar.nombreCompleto}.`);
                  setAgenteParaNotificar(null);
                }}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md font-bold hover:bg-primary-container"
              >
                Enviar Notificación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
