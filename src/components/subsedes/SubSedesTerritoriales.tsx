import React, { useEffect, useState, useMemo } from 'react';
import {
  getSubSedesConMetricas,
  eliminarSubSede,
  type SubSedeConMetricas,
  type SubSedesKPIs,
} from '../../services/subsedes';
import { CrearSubSedeModal } from './CrearSubSedeModal';
import type { Profile } from '../../types/legajo';

interface Props {
  onVerPersonalSede?: (subSedeId: string) => void;
}

export const SubSedesTerritoriales: React.FC<Props> = ({ onVerPersonalSede }) => {
  const [subSedes, setSubSedes] = useState<SubSedeConMetricas[]>([]);
  const [kpis, setKpis] = useState<SubSedesKPIs>({
    totalActivas: 0,
    totalPersonalTerritorio: 0,
    cumplimientoPromedio: 0,
  });
  const [referentesDisponibles, setReferentesDisponibles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<'todas' | 'amba' | 'interior' | 'alerta'>('todas');
  const [orden, setOrden] = useState<'cumplimiento' | 'agentes' | 'alfabetico'>('cumplimiento');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal crear sede
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const handleEliminarSede = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la sub-sede "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      setEliminandoId(id);
      await eliminarSubSede(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar la sub-sede');
    } finally {
      setEliminandoId(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSubSedesConMetricas();
      setSubSedes(res.subSedes);
      setKpis(res.kpis);
      setReferentesDisponibles(res.referentesDisponibles);
    } catch (err: any) {
      setError(err.message || 'Error al cargar sub-sedes territoriales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtrado y ordenamiento
  const sedesFiltradas = useMemo(() => {
    let result = subSedes.filter((sede) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        sede.nombre.toLowerCase().includes(q) ||
        (sede.localidad && sede.localidad.toLowerCase().includes(q)) ||
        (sede.referente &&
          `${sede.referente.nombre} ${sede.referente.apellido}`.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (filtroTipo === 'amba') {
        return sede.nombre.toLowerCase().includes('caba') || (sede.localidad || '').toLowerCase().includes('buenos aires') || (sede.localidad || '').toLowerCase().includes('san martín') || (sede.localidad || '').toLowerCase().includes('conurbano');
      }
      if (filtroTipo === 'interior') {
        return !sede.nombre.toLowerCase().includes('caba') && !(sede.localidad || '').toLowerCase().includes('conurbano');
      }
      if (filtroTipo === 'alerta') {
        return sede.estadoOperativo === 'alerta' || sede.cumplimientoPorcentaje < 70;
      }
      return true;
    });

    result.sort((a, b) => {
      if (orden === 'cumplimiento') return b.cumplimientoPorcentaje - a.cumplimientoPorcentaje;
      if (orden === 'agentes') return b.totalAgentes - a.totalAgentes;
      return a.nombre.localeCompare(b.nombre);
    });

    return result;
  }, [subSedes, filtroTipo, orden, searchTerm]);

  const countAlertas = useMemo(() => {
    return subSedes.filter((s) => s.estadoOperativo === 'alerta' || s.cumplimientoPorcentaje < 70).length;
  }, [subSedes]);

  return (
    <div className="flex-1 p-gutter max-w-[1600px] w-full mx-auto flex flex-col gap-space-lg text-on-surface font-body-md">
      {/* Page Header: Title + Subtitle + Action Buttons */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-1 border-b border-outline-variant/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold">
              Descentralización Territorial DDNNA
            </span>
            <span className="text-outline-variant">•</span>
            <span className="font-label-sm text-label-sm text-outline">Período Operativo 2025</span>
          </div>
          <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tight">
            Red Territorial de Sub-Sedes
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Coordinación descentralizada de delegaciones provinciales y zonales
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => alert('Abriendo visualizador cartográfico de cobertura federal...')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-primary font-label-md text-label-md hover:bg-surface-container-low transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-secondary text-[18px]">map</span>
            <span>Mapa de Cobertura Geográfica</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_business</span>
            <span>+ Registrar Nueva Sub-Sede</span>
          </button>
        </div>
      </section>

      {/* Quick KPI Stats Bar */}
      <section aria-label="Indicadores rápidos territoriales" className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {/* KPI 1 */}
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Total Sub-sedes Activas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg font-bold text-primary">{kpis.totalActivas}</span>
              <span className="font-label-sm text-label-sm font-semibold text-secondary-container px-2 py-0.5 rounded bg-surface-container-low text-secondary">
                operativas
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-outline mt-0.5">
              Distribuidas en macro-regiones federales
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-[26px]">apartment</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Personal asignado en territorio
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg font-bold text-primary">
                {kpis.totalPersonalTerritorio}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold">agentes</span>
            </div>
            <span className="font-body-sm text-body-sm text-outline mt-0.5">
              Equipos técnicos con idoneidad verificada
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary shrink-0">
            <span className="material-symbols-outlined text-[26px]">groups</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="p-space-md rounded-xl bg-surface-container-lowest border border-outline-variant shadow-xs flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Índice de cumplimiento promedio
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg font-bold text-primary">
                {kpis.cumplimientoPromedio}%
              </span>
              <span className="inline-flex items-center gap-1 font-label-sm text-label-sm font-bold text-on-tertiary-container bg-tertiary-fixed/40 px-2 py-0.5 rounded">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +3.4%
              </span>
            </div>
            <span className="font-body-sm text-body-sm text-outline mt-0.5">
              Estándar de salvaguarda y atención institucional
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-on-tertiary-container shrink-0">
            <span className="material-symbols-outlined text-[26px]">verified</span>
          </div>
        </div>
      </section>

      {/* Filter / Search Utility Row */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-surface-container-low rounded-xl border border-outline-variant/70">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[16px]">
              search
            </span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar sede, localidad o referente..."
              type="text"
              className="h-8 pl-8 pr-2.5 rounded-md bg-surface-container-lowest border border-outline-variant text-label-sm font-label-sm text-on-surface focus:outline-none focus:border-secondary"
            />
          </div>
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold pl-1">
            Filtrar por:
          </span>
          <button
            onClick={() => setFiltroTipo('todas')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors ${
              filtroTipo === 'todas'
                ? 'bg-surface-container-lowest border border-outline-variant font-semibold text-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
            type="button"
          >
            Todas ({subSedes.length})
          </button>
          <button
            onClick={() => setFiltroTipo('amba')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors ${
              filtroTipo === 'amba'
                ? 'bg-surface-container-lowest border border-outline-variant font-semibold text-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
            type="button"
          >
            CABA &amp; AMBA
          </button>
          <button
            onClick={() => setFiltroTipo('interior')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors ${
              filtroTipo === 'interior'
                ? 'bg-surface-container-lowest border border-outline-variant font-semibold text-primary shadow-xs'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
            type="button"
          >
            Interior Federal
          </button>
          <button
            onClick={() => setFiltroTipo('alerta')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm transition-colors flex items-center gap-1 ${
              filtroTipo === 'alerta'
                ? 'bg-error-container text-on-error-container font-semibold border border-error/40'
                : 'text-error hover:bg-error-container/30'
            }`}
            type="button"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-error"></span> Alerta de subsanación ({countAlertas})
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Ordenar por:</span>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as any)}
            className="h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant text-label-sm font-label-sm text-primary focus:outline-none focus:border-secondary"
          >
            <option value="cumplimiento">Mayor cumplimiento</option>
            <option value="agentes">Cantidad de agentes</option>
            <option value="alfabetico">Orden alfabético</option>
          </select>
        </div>
      </section>

      {/* Cards Bento Grid */}
      {loading ? (
        <div className="p-12 text-center text-outline flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
          <p>Cargando red territorial de sub-sedes...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-error-container text-on-error-container rounded-xl border border-error">
          <p className="font-bold">Error al cargar delegaciones:</p>
          <p>{error}</p>
        </div>
      ) : (
        <section
          aria-label="Tarjetas de Sub-Sedes Territoriales"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md"
        >
          {sedesFiltradas.map((sede) => {
            const isAlerta = sede.estadoOperativo === 'alerta';
            const is247 = sede.estadoOperativo === 'operativa_247';

            return (
              <article
                key={sede.id}
                className={`bg-surface-container-lowest rounded-xl shadow-xs hover:shadow-md transition-shadow duration-200 flex flex-col justify-between overflow-hidden relative ${
                  isAlerta ? 'border-2 border-error/50' : 'border border-outline-variant'
                }`}
              >
                {isAlerta && <div className="h-1.5 w-full bg-error"></div>}

                <div>
                  {/* Header with Status Chip */}
                  <div className="p-space-md border-b border-outline-variant/60 flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase ${
                            isAlerta
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-secondary-fixed text-on-secondary-fixed-variant'
                          }`}
                        >
                          {sede.regionBadge}
                        </span>
                        <span className="font-label-sm text-label-sm text-outline">ID: {sede.codigoId}</span>
                      </div>
                      <h3 className="font-headline-md text-headline-md font-bold text-primary">
                        {sede.nombre}
                      </h3>
                    </div>

                    {isAlerta ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-bold bg-[#FEE2E2] text-[#B91C1C] shrink-0 border border-[#B91C1C]/20">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        <span>Alerta</span>
                      </span>
                    ) : is247 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-bold bg-[#CCFBF1] text-[#0F766E] shrink-0 border border-[#0F766E]/20">
                        <span className="material-symbols-outlined text-[14px]">bolt</span>
                        <span>Operativa 24/7</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-bold bg-[#E0F2FE] text-[#0369A1] shrink-0 border border-[#0369A1]/20">
                        <span className="material-symbols-outlined text-[14px]">verified</span>
                        <span>Normal</span>
                      </span>
                    )}
                  </div>

                  {/* Body Details */}
                  <div className="p-space-md flex flex-col gap-space-md">
                    {/* Location & Referente */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm text-body-sm font-body-sm">
                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-outline text-[18px] shrink-0 mt-0.5">
                          location_on
                        </span>
                        <div className="flex flex-col">
                          <span className="font-label-sm text-label-sm text-outline">Dirección</span>
                          <span className="text-on-surface font-medium">
                            {sede.direccion || 'Sede Regional'} {sede.localidad ? `(${sede.localidad})` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-outline text-[18px] shrink-0 mt-0.5">
                          badge
                        </span>
                        <div className="flex flex-col">
                          <span className="font-label-sm text-label-sm text-outline">Referente a cargo</span>
                          <span className="text-on-surface font-medium">
                            {sede.referente
                              ? `${sede.referente.nombre} ${sede.referente.apellido}`
                              : 'A designar'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contact Strip */}
                    <div className="flex items-center gap-4 py-2 px-3 rounded-lg bg-surface-container-low text-body-sm font-body-sm text-on-surface-variant flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-outline text-[16px]">call</span>
                        <span>{sede.telefono || '(011) 4340-9200'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-outline text-[16px]">mail</span>
                        <span className="truncate">
                          {sede.nombre.toLowerCase().replace(/\s+/g, '.') + '@ddnna.gob.ar'}
                        </span>
                      </div>
                    </div>

                    {/* Compliance Gauge + Agentes */}
                    <div className="grid grid-cols-2 gap-space-sm items-center pt-1 border-t border-outline-variant/40">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-label-sm text-outline">Total Agentes</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-headline-sm text-headline-sm font-bold text-primary">
                            {sede.totalAgentes}
                          </span>
                          <span className="text-label-sm text-outline font-normal">asignados</span>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center justify-between text-label-sm font-label-sm mb-1">
                          <span className="text-outline">Cumplimiento Legal</span>
                          <span
                            className={`font-bold ${
                              isAlerta ? 'text-error' : 'text-[#0F766E]'
                            }`}
                          >
                            {sede.cumplimientoPorcentaje}%
                          </span>
                        </div>
                        <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isAlerta ? 'bg-error' : 'bg-[#0D9488]'
                            }`}
                            style={{ width: `${sede.cumplimientoPorcentaje}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Interdisciplinary Teams Breakdown */}
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
                        Equipos Interdisciplinarios
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded bg-surface-container-low border border-outline-variant/50">
                          <span className="block font-label-sm text-[11px] text-outline">Legales</span>
                          <span className="font-headline-sm text-headline-sm font-bold text-primary">
                            {sede.equipos.legales}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-surface-container-low border border-outline-variant/50">
                          <span className="block font-label-sm text-[11px] text-outline">Psicosocial</span>
                          <span className="font-headline-sm text-headline-sm font-bold text-primary">
                            {sede.equipos.psicosocial}
                          </span>
                        </div>
                        <div className="p-2 rounded bg-surface-container-low border border-outline-variant/50">
                          <span className="block font-label-sm text-[11px] text-outline">Territoriales</span>
                          <span className="font-headline-sm text-headline-sm font-bold text-primary">
                            {sede.equipos.territoriales}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-space-md bg-surface-container-low border-t border-outline-variant/70 flex items-center gap-2">
                  <button
                    onClick={() => onVerPersonalSede?.(sede.id)}
                    className="flex-1 py-2 px-3 rounded-lg bg-surface-container-lowest border border-outline-variant text-primary font-label-md text-label-md hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">folder_shared</span>
                    <span>Ver Personal Asociado</span>
                  </button>
                  <button
                    onClick={() =>
                      alert(`Iniciando canal seguro con delegación: ${sede.nombre}`)
                    }
                    className="py-2 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    <span>Contactar</span>
                  </button>
                  <button
                    onClick={() => handleEliminarSede(sede.id, sede.nombre)}
                    disabled={eliminandoId === sede.id}
                    className="py-2 px-3 rounded-lg border border-error/40 text-error hover:bg-error-container/30 transition-colors flex items-center justify-center shadow-xs disabled:opacity-50"
                    type="button"
                    title="Eliminar sub-sede"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {eliminandoId === sede.id ? 'hourglass_empty' : 'delete'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}

          {/* Placeholder Action Card: Conectar Nueva Sub-Sede */}
          <div className="border-2 border-dashed border-outline-variant rounded-xl p-space-lg flex flex-col items-center justify-center text-center gap-3 bg-surface-container-low/40 hover:bg-surface-container transition-colors min-h-[360px]">
            <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-secondary shadow-xs">
              <span className="material-symbols-outlined text-[28px]">add_location_alt</span>
            </div>
            <div className="max-w-xs">
              <h4 className="font-headline-sm text-headline-sm font-bold text-primary">
                Habilitar Nueva Delegación
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Incorpore sub-sedes provinciales con verificación de protocolos de protección integral.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary/90 transition-colors shadow-xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Comenzar Registro</span>
            </button>
          </div>
        </section>
      )}

      {/* Modal Crear Sub-Sede */}
      <CrearSubSedeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        referentesDisponibles={referentesDisponibles}
        onSubSedeCreated={loadData}
      />

      {/* Institutional Footer */}
      <footer className="mt-auto py-space-md border-t border-outline-variant flex flex-col sm:flex-row items-center justify-between text-body-sm font-body-sm text-outline gap-2">
        <span>
          Defensoría de los Derechos de Niñas, Niños y Adolescentes — Sistema de Descentralización Territorial
        </span>
        <span>Normativa Ley 26.061 • Auditoría Pública Permanente</span>
      </footer>
    </div>
  );
};
