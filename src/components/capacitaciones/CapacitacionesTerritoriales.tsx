import React, { useEffect, useState, useMemo } from 'react';
import {
  getSolicitudesCapacitacion,
  type SolicitudCapacitacion,
  type CapacitacionesMetricas,
  type EstadoSolicitud,
} from '../../services/capacitaciones';
import { SolicitudCapacitacionForm } from './SolicitudCapacitacionForm';
import { SolicitudDetalle } from './SolicitudDetalle';
import { formatearFecha } from '../../utils/legajoCalculations';
import type { SubSede, Profile, Area } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
}

type Filtro = 'todos' | 'curso' | 'aprobadas' | 'pausadas';

const ETIQUETA_ESTADO: Record<EstadoSolicitud, { texto: string; cls: string }> = {
  enviada: { texto: 'En Coordinación', cls: 'bg-amber-100 text-amber-900' },
  en_coordinacion: { texto: 'En Coordinación', cls: 'bg-amber-100 text-amber-900' },
  derivada_area: { texto: 'En el Área', cls: 'bg-sky-100 text-sky-900' },
  aprobada_area: { texto: 'Falta el Formulario', cls: 'bg-sky-100 text-sky-900' },
  aprobada: { texto: 'Aprobada', cls: 'bg-teal-100 text-teal-900' },
  postergada: { texto: 'Postergada', cls: 'bg-amber-200 text-amber-900' },
  suspendida: { texto: 'Suspendida', cls: 'bg-error-container text-on-error-container' },
  cancelada: { texto: 'Cancelada', cls: 'bg-surface-container text-on-surface-variant' },
};

const CURSO: EstadoSolicitud[] = ['enviada', 'en_coordinacion', 'derivada_area', 'aprobada_area'];
const PAUSADAS: EstadoSolicitud[] = ['postergada', 'suspendida', 'cancelada'];

export const CapacitacionesTerritoriales: React.FC<Props> = ({ perfilActual }) => {
  const [solicitudes, setSolicitudes] = useState<SolicitudCapacitacion[]>([]);
  const [metricas, setMetricas] = useState<CapacitacionesMetricas>({
    totalDemandas: 0,
    enCurso: 0,
    aprobadas: 0,
    pausadas: 0,
    realizadas: 0,
  });
  const [subSedes, setSubSedes] = useState<SubSede[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subView, setSubView] = useState<'list' | 'form'>('list');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSolicitudesCapacitacion();
      setSolicitudes(res.solicitudes);
      setMetricas(res.metricas);
      setSubSedes(res.subSedes);
      setAreas(res.areas);
      setSeleccionadaId((prev) => prev ?? res.solicitudes[0]?.id ?? null);
    } catch (err: any) {
      setError(err.message || 'Error al cargar capacitaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return solicitudes.filter((s) => {
      if (filtro === 'curso' && !CURSO.includes(s.estado)) return false;
      if (filtro === 'aprobadas' && s.estado !== 'aprobada') return false;
      if (filtro === 'pausadas' && !PAUSADAS.includes(s.estado)) return false;
      if (q) {
        const origen = (s.sub_sedes?.nombre || s.area_solicitante?.nombre || '').toLowerCase();
        return s.tema.toLowerCase().includes(q) || origen.includes(q) || (s.solicitante_externo || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [solicitudes, filtro, busqueda]);

  const seleccionada = solicitudes.find((s) => s.id === seleccionadaId) || null;

  const onActualizada = (upd: SolicitudCapacitacion) => {
    setSolicitudes((prev) => prev.map((s) => (s.id === upd.id ? upd : s)));
    loadData();
  };

  if (subView === 'form') {
    return (
      <SolicitudCapacitacionForm
        subSedes={subSedes}
        areas={areas}
        perfilActual={perfilActual}
        onVolver={() => setSubView('list')}
        onSolicitudEnviada={() => {
          setSubView('list');
          loadData();
        }}
      />
    );
  }

  const tarjeta = (id: Filtro, titulo: string, valor: number, cls: string) => (
    <button
      type="button"
      onClick={() => setFiltro(id)}
      className={`text-left border rounded-xl p-space-md shadow-sm transition-all ${cls} ${
        filtro === id ? 'border-2 border-primary' : 'border-outline-variant hover:border-secondary'
      }`}
    >
      <div className="text-label-md text-on-surface-variant">{titulo}</div>
      <div className="text-display-lg font-display-lg text-primary mt-1">{valor}</div>
    </button>
  );

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg text-on-surface font-body-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md border-b border-outline-variant pb-space-md">
        <div>
          <h1 className="text-headline-lg font-headline-lg font-bold text-primary tracking-tight">
            Solicitudes de Talleres y Capacitaciones
          </h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Circuito: solicitud → Coordinación de Subsedes → Prensa/Protección → link de formulario → envío al solicitante.
          </p>
        </div>
        <button
          onClick={() => setSubView('form')}
          className="inline-flex items-center gap-1.5 px-space-md h-10 bg-primary text-on-primary rounded-xl font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Nueva Solicitud</span>
        </button>
      </div>

      {error && <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-space-md">
        {tarjeta('todos', 'Todas las Solicitudes', metricas.totalDemandas, 'bg-surface-container-lowest')}
        {tarjeta('curso', 'En Curso', metricas.enCurso, 'bg-amber-50')}
        {tarjeta('aprobadas', 'Aprobadas', metricas.aprobadas, 'bg-teal-50')}
        {tarjeta('pausadas', 'Postergadas / Suspendidas', metricas.pausadas, 'bg-error-container/30')}
        <div className="border border-outline-variant rounded-xl p-space-md bg-surface-container-lowest shadow-sm">
          <div className="text-label-md text-on-surface-variant">Capacitaciones Realizadas</div>
          <div className="text-display-lg font-display-lg text-primary mt-1">{metricas.realizadas}</div>
        </div>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por tema, sub-sede, área o solicitante..."
        className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-secondary"
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          {loading ? (
            <div className="p-12 text-center text-outline">Cargando solicitudes...</div>
          ) : filtradas.length === 0 ? (
            <div className="p-8 text-center text-outline bg-surface-container-lowest rounded-xl border border-outline-variant">
              No hay solicitudes para mostrar.
            </div>
          ) : (
            filtradas.map((s) => {
              const et = ETIQUETA_ESTADO[s.estado];
              const activa = s.id === seleccionadaId;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSeleccionadaId(s.id)}
                  className={`text-left bg-surface-container-lowest rounded-xl p-space-lg shadow-sm transition-all border ${
                    activa ? 'border-2 border-secondary ring-4 ring-secondary-container/20' : 'border-outline-variant hover:border-secondary'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-outline-variant/60">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-label-sm font-semibold text-primary">
                        #{s.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-label-sm font-semibold ${et.cls}`}>{et.texto}</span>
                    </div>
                    <span className="text-label-sm text-outline">Ingreso: {formatearFecha(s.created_at)}</span>
                  </div>
                  <h3 className="text-headline-sm font-bold text-primary mt-2">{s.tema}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-label-sm">
                    <div>
                      <div className="text-outline">Solicita</div>
                      <div className="font-medium text-primary">{s.sub_sedes?.nombre || s.area_solicitante?.nombre || '—'}</div>
                    </div>
                    <div>
                      <div className="text-outline">Institución / persona</div>
                      <div className="font-medium text-primary">{s.solicitante_externo || '—'}</div>
                    </div>
                    <div>
                      <div className="text-outline">Participantes</div>
                      <div className="font-medium text-primary">{s.cantidad_participantes ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-outline">Fecha propuesta</div>
                      <div className="font-medium text-primary">{s.fecha_propuesta ? formatearFecha(s.fecha_propuesta) : '—'}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <aside className="xl:col-span-5 bg-surface-container-lowest border-2 border-primary-container rounded-2xl shadow-xl overflow-hidden xl:sticky xl:top-20">
          {seleccionada ? (
            <>
              <div className="bg-primary-container p-space-md text-on-primary">
                <h2 className="text-headline-sm font-bold leading-tight">Seguimiento de la solicitud</h2>
                <p className="text-label-sm text-primary-fixed truncate">{seleccionada.tema}</p>
              </div>
              <div className="p-space-lg">
                <SolicitudDetalle
                  key={seleccionada.id}
                  solicitud={seleccionada}
                  areas={areas}
                  perfilActual={perfilActual}
                  onActualizada={onActualizada}
                />
              </div>
              {seleccionada.justificacion && (
                <div className="px-space-lg pb-space-lg text-body-sm text-on-surface-variant">
                  <div className="text-label-sm text-outline">Justificación</div>
                  {seleccionada.justificacion}
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-outline">Seleccioná una solicitud para ver sus etapas.</div>
          )}
        </aside>
      </div>
    </div>
  );
};
