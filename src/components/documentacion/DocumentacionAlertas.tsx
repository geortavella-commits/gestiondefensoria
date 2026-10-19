import React, { useEffect, useState, useMemo } from 'react';
import {
  getDocumentacionAlertas,
  type DocumentacionAlertasData,
  type AlertaDocumentoItem,
} from '../../services/documentacionAlertas';
import { validarDocumento } from '../../services/legajo';
import type { Profile } from '../../types/legajo';

interface Props {
  onVerLegajo: (profileId: string) => void;
  currentUserId?: string;
  perfilActual?: Profile | null;
}

type TabType = 'enRevision' | 'vencidos' | 'porVencer' | 'rechazados' | 'todos';

export const DocumentacionAlertas: React.FC<Props> = ({
  onVerLegajo,
  currentUserId,
  perfilActual,
}) => {
  const [data, setData] = useState<DocumentacionAlertasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pestaña activa
  const [activeTab, setActiveTab] = useState<TabType>('enRevision');

  // Filtros client-side
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [filtroTipoDoc, setFiltroTipoDoc] = useState('all');

  // Estados de validación / rechazo
  const [validandoId, setValidandoId] = useState<string | null>(null);
  const [rechazoTarget, setRechazoTarget] = useState<AlertaDocumentoItem | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [toastMsg, setToastMsg] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const revisorIdEfectivo = currentUserId || perfilActual?.id || '';

  const showToast = (texto: string, tipo: 'success' | 'error' = 'success') => {
    setToastMsg({ tipo, texto });
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDocumentacionAlertas();
      setData(res);
    } catch (err: any) {
      console.error('Error al cargar alertas de documentación:', err);
      setError(err.message || 'Error al cargar documentación y alertas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Lista de tipos de documento únicos para el selector de filtro
  const tiposDocumentoDisponibles = useMemo(() => {
    if (!data) return [];
    const setTipos = new Set<string>();
    const todos = [
      ...data.enRevision,
      ...data.vencidos,
      ...data.porVencer,
      ...data.rechazados,
    ];
    todos.forEach((item) => {
      if (item.documentoTipo) setTipos.add(item.documentoTipo);
    });
    return Array.from(setTipos).sort();
  }, [data]);

  // Contadores totales
  const counts = useMemo(() => {
    if (!data) return { enRevision: 0, vencidos: 0, porVencer: 0, rechazados: 0, total: 0 };
    return {
      enRevision: data.enRevision.length,
      vencidos: data.vencidos.length,
      porVencer: data.porVencer.length,
      rechazados: data.rechazados.length,
      total:
        data.enRevision.length +
        data.vencidos.length +
        data.porVencer.length +
        data.rechazados.length,
    };
  }, [data]);

  // Función de filtrado por item
  const filtrarItem = (item: AlertaDocumentoItem): boolean => {
    if (busquedaTexto.trim()) {
      const q = busquedaTexto.toLowerCase();
      const coincide =
        item.agenteNombre.toLowerCase().includes(q) ||
        (item.cargo && item.cargo.toLowerCase().includes(q)) ||
        (item.areaNombre && item.areaNombre.toLowerCase().includes(q)) ||
        (item.subSedeNombre && item.subSedeNombre.toLowerCase().includes(q)) ||
        item.documentoTipo.toLowerCase().includes(q);
      if (!coincide) return false;
    }

    if (filtroTipoDoc !== 'all' && item.documentoTipo !== filtroTipoDoc) {
      return false;
    }

    return true;
  };

  // Listas filtradas client-side
  const enRevisionFiltrados = useMemo(() => (data?.enRevision || []).filter(filtrarItem), [data, busquedaTexto, filtroTipoDoc]);
  const vencidosFiltrados = useMemo(() => (data?.vencidos || []).filter(filtrarItem), [data, busquedaTexto, filtroTipoDoc]);
  const porVencerFiltrados = useMemo(() => (data?.porVencer || []).filter(filtrarItem), [data, busquedaTexto, filtroTipoDoc]);
  const rechazadosFiltrados = useMemo(() => (data?.rechazados || []).filter(filtrarItem), [data, busquedaTexto, filtroTipoDoc]);

  const itemsTabActual = useMemo(() => {
    if (activeTab === 'enRevision') return enRevisionFiltrados;
    if (activeTab === 'vencidos') return vencidosFiltrados;
    if (activeTab === 'porVencer') return porVencerFiltrados;
    if (activeTab === 'rechazados') return rechazadosFiltrados;
    return [
      ...enRevisionFiltrados,
      ...vencidosFiltrados,
      ...porVencerFiltrados,
      ...rechazadosFiltrados,
    ];
  }, [activeTab, enRevisionFiltrados, vencidosFiltrados, porVencerFiltrados, rechazadosFiltrados]);

  // Acciones de validación
  const handleAprobar = async (e: React.MouseEvent, item: AlertaDocumentoItem) => {
    e.stopPropagation();
    try {
      setValidandoId(item.id);
      await validarDocumento(item.id, revisorIdEfectivo, 'aprobado');
      showToast(`Documento "${item.documentoTipo}" de ${item.agenteNombre} aprobado correctamente.`);
      await cargarDatos();
    } catch (err: any) {
      console.error('Error al aprobar documento:', err);
      showToast(`No se pudo aprobar el documento: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setValidandoId(null);
    }
  };

  const handleAbrirRechazo = (e: React.MouseEvent, item: AlertaDocumentoItem) => {
    e.stopPropagation();
    setMotivoRechazo('');
    setRechazoTarget(item);
  };

  const handleConfirmarRechazo = async () => {
    if (!rechazoTarget) return;
    if (!motivoRechazo.trim()) {
      showToast('El motivo de rechazo es obligatorio.', 'error');
      return;
    }

    try {
      setValidandoId(rechazoTarget.id);
      await validarDocumento(
        rechazoTarget.id,
        revisorIdEfectivo,
        'rechazado',
        motivoRechazo.trim()
      );
      showToast(`Documento "${rechazoTarget.documentoTipo}" rechazado.`);
      setRechazoTarget(null);
      setMotivoRechazo('');
      await cargarDatos();
    } catch (err: any) {
      console.error('Error al rechazar documento:', err);
      showToast(`No se pudo rechazar el documento: ${err.message || 'Error desconocido'}`, 'error');
    } finally {
      setValidandoId(null);
    }
  };

  const handleLimpiarFiltros = () => {
    setBusquedaTexto('');
    setFiltroTipoDoc('all');
  };

  // Helper para renderizar el chip de estado
  const renderBadgeEstado = (item: AlertaDocumentoItem) => {
    const estado = item.estadoAlerta;
    let estilo = '';
    let icono = '';

    switch (estado) {
      case 'vencido':
        estilo = 'bg-error-container text-on-error-container border border-error/20';
        icono = 'error';
        break;
      case 'por_vencer':
        estilo = 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300/40';
        icono = 'warning';
        break;
      case 'cargado':
        estilo = 'bg-secondary-container/30 text-secondary dark:text-secondary-fixed border border-secondary-container/50';
        icono = 'pending_actions';
        break;
      case 'rechazado':
        estilo = 'bg-surface-container-high text-on-surface-variant border border-outline-variant';
        icono = 'cancel';
        break;
    }

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold tracking-wide ${estilo}`}>
        <span className="material-symbols-outlined text-[15px]">{icono}</span>
        <span>{item.badgeTexto}</span>
      </span>
    );
  };

  // Renderizar estado vacío contextual
  const renderEmptyState = (tab: TabType) => {
    let titulo = '';
    let descripcion = '';
    let icono = '';

    if (busquedaTexto.trim() || filtroTipoDoc !== 'all') {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-3">
            <span className="material-symbols-outlined text-3xl">search_off</span>
          </div>
          <h3 className="text-headline-sm font-headline-sm text-primary mb-1">
            Sin resultados para el filtro aplicado
          </h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mb-4">
            No encontramos documentos que coincidan con los criterios de búsqueda actuales.
          </p>
          <button
            onClick={handleLimpiarFiltros}
            className="px-4 py-2 text-label-md font-semibold text-secondary hover:bg-secondary-fixed/30 rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
            Restablecer filtros
          </button>
        </div>
      );
    }

    switch (tab) {
      case 'enRevision':
        titulo = 'No hay documentos en revisión';
        descripcion = 'Todos los documentos enviados por el personal ya han sido revisados y procesados.';
        icono = 'task_alt';
        break;
      case 'vencidos':
        titulo = 'No hay documentos vencidos';
        descripcion = 'Excelente noticia: toda la documentación activa se encuentra al día y vigente.';
        icono = 'verified';
        break;
      case 'porVencer':
        titulo = 'No hay documentos próximos a vencer';
        descripcion = 'No se registran vencimientos de documentación dentro de los próximos 30 días.';
        icono = 'event_available';
        break;
      case 'rechazados':
        titulo = 'No hay documentos rechazados';
        descripcion = 'No hay solicitudes rechazadas que requieran nueva carga por parte del personal.';
        icono = 'assignment_turned_in';
        break;
      case 'todos':
        titulo = 'Sin alertas documentales';
        descripcion = 'No se encontraron documentos pendientes de revisión, vencidos ni observados.';
        icono = 'folder_supervised';
        break;
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary mb-3 shadow-inner">
          <span className="material-symbols-outlined text-4xl">{icono}</span>
        </div>
        <h3 className="text-headline-sm font-headline-sm text-primary mb-1">{titulo}</h3>
        <p className="text-body-sm text-on-surface-variant max-w-md">{descripcion}</p>
      </div>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto px-gutter pt-6 text-on-surface font-body-md">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-label-md font-label-md text-on-surface-variant mb-1">
            <span>Gestión Territorial DDNNA</span>
            <span className="material-symbols-outlined text-[16px] text-outline">chevron_right</span>
            <span className="text-primary font-semibold">Documentación &amp; Alertas</span>
          </nav>
          <h1 className="text-headline-lg font-headline-lg text-primary flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-[28px]">warning</span>
            Tablero de Auditoría Documental
          </h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Supervisión integral de legajos: documentos pendientes de revisión, vencimientos y solicitudes rechazadas.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          disabled={loading}
          className="self-start md:self-auto px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest dark:bg-surface hover:bg-surface-container text-primary font-semibold text-label-md flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
          title="Actualizar datos"
        >
          <span className={`material-symbols-outlined text-[18px] text-secondary ${loading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          <span>Actualizar</span>
        </button>
      </div>

      {/* TOAST FLOTANTE */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border transition-all animate-bounce duration-300 ${
            toastMsg.tipo === 'success'
              ? 'bg-surface-container-lowest dark:bg-inverse-surface text-primary dark:text-inverse-on-surface border-secondary'
              : 'bg-error-container text-on-error-container border-error'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {toastMsg.tipo === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="text-label-md font-semibold">{toastMsg.texto}</span>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl border border-error/30 flex items-start gap-3">
          <span className="material-symbols-outlined text-2xl mt-0.5">error</span>
          <div className="flex-1">
            <h4 className="font-bold text-headline-sm">Error al cargar auditoría documental</h4>
            <p className="text-body-sm mt-0.5">{error}</p>
            <button
              onClick={cargarDatos}
              className="mt-3 px-3 py-1.5 bg-on-error-container text-surface-container-lowest rounded-lg text-label-sm font-semibold hover:opacity-90"
            >
              Reintentar carga
            </button>
          </div>
        </div>
      )}

      {/* TARJETAS RESUMEN / KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* 1. En Revisión */}
        <div
          onClick={() => setActiveTab('enRevision')}
          className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${
            activeTab === 'enRevision'
              ? 'bg-secondary-fixed/40 border-secondary shadow-md ring-2 ring-secondary/20'
              : 'bg-surface-container-lowest dark:bg-surface border-outline-variant hover:border-secondary/50 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-semibold text-on-surface-variant">En Revisión</span>
            <div className="w-8 h-8 rounded-lg bg-secondary-container/40 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-display-lg font-bold text-primary font-headline-lg">
              {loading ? '-' : counts.enRevision}
            </span>
            <span className="text-body-sm text-on-surface-variant">doc{counts.enRevision === 1 ? '' : 's'}</span>
          </div>
          <p className="text-label-sm text-on-surface-variant mt-1">Esperando aprobación o rechazo</p>
        </div>

        {/* 2. Vencidos */}
        <div
          onClick={() => setActiveTab('vencidos')}
          className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${
            activeTab === 'vencidos'
              ? 'bg-error-container/40 border-error shadow-md ring-2 ring-error/20'
              : 'bg-surface-container-lowest dark:bg-surface border-outline-variant hover:border-error/50 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-semibold text-on-surface-variant">Vencidos</span>
            <div className="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-display-lg font-bold text-error font-headline-lg">
              {loading ? '-' : counts.vencidos}
            </span>
            <span className="text-body-sm text-on-surface-variant">doc{counts.vencidos === 1 ? '' : 's'}</span>
          </div>
          <p className="text-label-sm text-on-surface-variant mt-1">Plazo de validez caducado</p>
        </div>

        {/* 3. Por Vencer */}
        <div
          onClick={() => setActiveTab('porVencer')}
          className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${
            activeTab === 'porVencer'
              ? 'bg-amber-100/50 dark:bg-amber-950/40 border-amber-500 shadow-md ring-2 ring-amber-500/20'
              : 'bg-surface-container-lowest dark:bg-surface border-outline-variant hover:border-amber-500/50 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-semibold text-on-surface-variant">Por Vencer</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">alarm</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-display-lg font-bold text-amber-800 dark:text-amber-300 font-headline-lg">
              {loading ? '-' : counts.porVencer}
            </span>
            <span className="text-body-sm text-on-surface-variant">doc{counts.porVencer === 1 ? '' : 's'}</span>
          </div>
          <p className="text-label-sm text-on-surface-variant mt-1">Vencimiento en ≤ 30 días</p>
        </div>

        {/* 4. Rechazados */}
        <div
          onClick={() => setActiveTab('rechazados')}
          className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border ${
            activeTab === 'rechazados'
              ? 'bg-surface-container-high border-outline shadow-md ring-2 ring-outline/20'
              : 'bg-surface-container-lowest dark:bg-surface border-outline-variant hover:border-outline shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-label-md font-semibold text-on-surface-variant">Rechazados</span>
            <div className="w-8 h-8 rounded-lg bg-surface-container-highest text-on-surface-variant flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">assignment_late</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-display-lg font-bold text-on-surface font-headline-lg">
              {loading ? '-' : counts.rechazados}
            </span>
            <span className="text-body-sm text-on-surface-variant">doc{counts.rechazados === 1 ? '' : 's'}</span>
          </div>
          <p className="text-label-sm text-on-surface-variant mt-1">Pendientes de nueva carga</p>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL: TABS + FILTROS + TABLA */}
      <div className="bg-surface-container-lowest dark:bg-surface rounded-2xl border border-outline-variant shadow-sm overflow-hidden mb-8">
        {/* BARRA DE NAVEGACIÓN POR PESTAÑAS */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant px-4 pt-3 bg-surface-container-low/50">
          <div className="flex items-center gap-1 overflow-x-auto pb-[-1px]">
            <button
              onClick={() => setActiveTab('enRevision')}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'enRevision'
                  ? 'border-secondary text-secondary bg-surface-container-lowest dark:bg-surface rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50 rounded-t-lg'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
              <span>En Revisión</span>
              <span
                className={`px-2 py-0.5 rounded-full text-label-sm ${
                  activeTab === 'enRevision'
                    ? 'bg-secondary-fixed text-on-secondary-fixed-variant font-bold'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {counts.enRevision}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('vencidos')}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'vencidos'
                  ? 'border-error text-error bg-surface-container-lowest dark:bg-surface rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50 rounded-t-lg'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">event_busy</span>
              <span>Vencidos</span>
              <span
                className={`px-2 py-0.5 rounded-full text-label-sm ${
                  activeTab === 'vencidos'
                    ? 'bg-error-container text-on-error-container font-bold'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {counts.vencidos}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('porVencer')}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'porVencer'
                  ? 'border-amber-600 text-amber-800 dark:text-amber-300 bg-surface-container-lowest dark:bg-surface rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50 rounded-t-lg'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">alarm</span>
              <span>Por Vencer</span>
              <span
                className={`px-2 py-0.5 rounded-full text-label-sm ${
                  activeTab === 'porVencer'
                    ? 'bg-amber-200 text-amber-900 font-bold'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {counts.porVencer}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('rechazados')}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'rechazados'
                  ? 'border-on-surface text-primary bg-surface-container-lowest dark:bg-surface rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50 rounded-t-lg'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">assignment_late</span>
              <span>Rechazados</span>
              <span
                className={`px-2 py-0.5 rounded-full text-label-sm ${
                  activeTab === 'rechazados'
                    ? 'bg-surface-container-highest text-on-surface font-bold'
                    : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                {counts.rechazados}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('todos')}
              className={`flex items-center gap-2 px-4 py-2.5 text-label-md font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'todos'
                  ? 'border-primary text-primary bg-surface-container-lowest dark:bg-surface rounded-t-lg'
                  : 'border-transparent text-on-surface-variant hover:text-primary hover:bg-surface-container/50 rounded-t-lg'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">folder_open</span>
              <span>Ver Todos</span>
              <span className="px-2 py-0.5 rounded-full text-label-sm bg-surface-container text-on-surface-variant">
                {counts.total}
              </span>
            </button>
          </div>
        </div>

        {/* FILTROS CLIENT-SIDE */}
        <div className="p-4 bg-surface-container-lowest dark:bg-surface border-b border-outline-variant flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
            {/* Input búsqueda */}
            <div className="relative w-full sm:w-80">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar por agente, cargo, área o sub-sede..."
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-outline-variant bg-surface text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all"
              />
              {busquedaTexto && (
                <button
                  onClick={() => setBusquedaTexto('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-primary"
                  title="Limpiar búsqueda"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>

            {/* Selector por tipo de documento */}
            <div className="w-full sm:w-64">
              <select
                value={filtroTipoDoc}
                onChange={(e) => setFiltroTipoDoc(e.target.value)}
                className="w-full py-2 px-3 rounded-lg border border-outline-variant bg-surface text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary transition-all"
              >
                <option value="all">Todos los tipos de documento</option>
                {tiposDocumentoDisponibles.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contador de resultados filtrados */}
          {(busquedaTexto.trim() || filtroTipoDoc !== 'all') && (
            <div className="flex items-center gap-2">
              <span className="text-label-sm text-on-surface-variant">
                Mostrando <strong>{itemsTabActual.length}</strong> de {counts.total}
              </span>
              <button
                onClick={handleLimpiarFiltros}
                className="text-label-sm text-secondary hover:underline font-semibold"
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>

        {/* CONTENIDO DE TABLA / CARDS */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-label-md text-on-surface-variant font-medium">Cargando tablero documental...</p>
          </div>
        ) : itemsTabActual.length === 0 ? (
          renderEmptyState(activeTab)
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant text-label-sm uppercase tracking-wider border-b border-outline-variant">
                  <th className="py-3 px-4 font-semibold">Agente / Cargo</th>
                  <th className="py-3 px-4 font-semibold">Área / Sub-Sede</th>
                  <th className="py-3 px-4 font-semibold">Tipo de Documento</th>
                  <th className="py-3 px-4 font-semibold">Estado / Plazo</th>
                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/60">
                {itemsTabActual.map((item) => {
                  const esEnRevision = item.estadoAlerta === 'cargado';
                  const esRechazado = item.estadoAlerta === 'rechazado';
                  const isValidando = validandoId === item.id;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onVerLegajo(item.profileId)}
                      className="hover:bg-surface-container-low/70 cursor-pointer transition-colors group"
                      title="Hacé clic para ver el legajo digital del agente"
                    >
                      {/* Agente y Cargo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-secondary-container/40 text-secondary font-bold flex items-center justify-center text-label-md shrink-0 uppercase">
                            {item.agenteNombre
                              .split(' ')
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div className="min-w-0">
                            <div className="text-label-lg font-semibold text-primary group-hover:text-secondary transition-colors truncate">
                              {item.agenteNombre}
                            </div>
                            <div className="text-body-sm text-on-surface-variant truncate">
                              {item.cargo}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Área / Sub-sede */}
                      <td className="py-3.5 px-4 text-body-sm">
                        <div className="flex flex-col gap-0.5">
                          {item.areaNombre ? (
                            <span className="text-on-surface font-medium truncate max-w-[200px]">
                              {item.areaNombre}
                            </span>
                          ) : (
                            <span className="text-outline text-label-sm italic">Sin área asignada</span>
                          )}
                          {item.subSedeNombre && (
                            <span className="text-label-sm text-on-surface-variant flex items-center gap-1 truncate">
                              <span className="material-symbols-outlined text-[13px] text-outline">
                                location_on
                              </span>
                              {item.subSedeNombre}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tipo de Documento */}
                      <td className="py-3.5 px-4">
                        <div className="text-body-md font-semibold text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px] text-secondary">
                            description
                          </span>
                          <span>{item.documentoTipo}</span>
                        </div>
                        {item.fechaVencimiento && (
                          <div className="text-label-sm text-on-surface-variant mt-0.5">
                            Vence:{' '}
                            <span className="font-mono">
                              {new Date(item.fechaVencimiento).toLocaleDateString('es-AR')}
                            </span>
                          </div>
                        )}
                        {/* Si es rechazado y tiene comentarios, mostrar motivo */}
                        {esRechazado && item.comentarios && (
                          <div className="mt-1.5 p-2 bg-error-container/40 rounded-lg border border-error/20 text-body-sm text-on-error-container flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-[16px] text-error shrink-0 mt-0.5">
                              comment
                            </span>
                            <div>
                              <strong className="text-label-sm font-semibold">Motivo de rechazo:</strong>{' '}
                              <span>{item.comentarios}</span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Estado / Plazo Badge */}
                      <td className="py-3.5 px-4">
                        {renderBadgeEstado(item)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* Acciones directas para documentos en revisión */}
                          {esEnRevision && (
                            <>
                              <button
                                onClick={(e) => handleAprobar(e, item)}
                                disabled={isValidando}
                                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-label-sm font-semibold flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                                title="Aprobar documento"
                              >
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                <span className="hidden sm:inline">Aprobar</span>
                              </button>

                              <button
                                onClick={(e) => handleAbrirRechazo(e, item)}
                                disabled={isValidando}
                                className="px-2.5 py-1.5 rounded-lg bg-error-container hover:bg-error-container/80 text-on-error-container text-label-sm font-semibold flex items-center gap-1 transition-colors border border-error/30 disabled:opacity-50"
                                title="Rechazar documento con motivo obligatorio"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                                <span className="hidden sm:inline">Rechazar</span>
                              </button>
                            </>
                          )}

                          {/* Botón Ver Legajo */}
                          <button
                            onClick={() => onVerLegajo(item.profileId)}
                            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-secondary transition-colors"
                            title="Ver Legajo Digital del Agente"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              arrow_forward
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
        )}

        {/* FOOTER DE LA TABLA */}
        <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between gap-2 text-label-sm text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">info</span>
            <span>Hacé clic en cualquier fila para acceder a la ficha y legajo completo del agente.</span>
          </div>
          <span className="font-semibold text-primary">
            Total en vista: {itemsTabActual.length}
          </span>
        </div>
      </div>

      {/* MODAL DE RECHAZO — motivo obligatorio */}
      {rechazoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
          onClick={() => setRechazoTarget(null)}
        >
          <div
            className="bg-surface-container-lowest dark:bg-surface rounded-2xl border border-outline-variant max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-[24px]">assignment_late</span>
                <h3 className="text-headline-sm font-headline-sm font-bold text-primary">
                  Rechazar Documento
                </h3>
              </div>
              <button
                onClick={() => setRechazoTarget(null)}
                className="p-1 rounded-lg text-outline hover:text-primary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant mb-4">
              Estás por rechazar <strong>"{rechazoTarget.documentoTipo}"</strong> de <strong>{rechazoTarget.agenteNombre}</strong>.
              Indicá el motivo para que el agente pueda corregirlo y volver a subir el archivo.
            </p>

            <div className="mb-4">
              <label className="block text-label-sm font-semibold text-primary mb-1">
                Motivo del rechazo <span className="text-error">*</span>
              </label>
              <textarea
                autoFocus
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={3}
                placeholder="Ej: Archivo ilegible, certificado sin firma o fecha de emisión vencida..."
                className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 focus:border-secondary"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
              <button
                onClick={() => setRechazoTarget(null)}
                className="px-4 py-2 rounded-lg text-label-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarRechazo}
                disabled={!motivoRechazo.trim() || validandoId === rechazoTarget.id}
                className="px-4 py-2 rounded-lg bg-error text-on-error text-label-md font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
              >
                {validandoId === rechazoTarget.id ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    <span>Rechazando...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                    <span>Confirmar Rechazo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER INSTITUCIONAL */}
      <footer className="mt-8 mb-4 text-center text-label-sm font-label-sm text-outline">
        Sistema Integral de Gestión Territorial DDNNA — Tablero Oficial de Auditoría y Control Documental • República Argentina
      </footer>
    </div>
  );
};
