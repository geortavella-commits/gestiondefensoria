import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  listarActividadesTerritoriales,
  crearActividadTerritorial,
  actualizarActividadTerritorial,
  anularActividadTerritorial,
  agregarFotoActividad,
  getSignedUrlFotoActividad,
  TIPOS_ACTIVIDAD,
  type ActividadTerritorial,
  type TipoActividad,
} from '../../services/actividadesTerritoriales';
import { esRolGestion } from '../../services/legajo';
import { listarNotasDeArea } from '../../services/notasPedido';
import { formatearFecha } from '../../utils/legajoCalculations';
import type { Area, Profile } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
}

const MAPA_TIPOS: Record<TipoActividad, { label: string; icon: string; cls: string }> = {
  taller: { label: 'Taller', icon: 'handshake', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  capacitacion: { label: 'Capacitación', icon: 'school', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  jornada_charla: { label: 'Jornada / Charla', icon: 'record_voice_over', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  relevamiento_visita: { label: 'Relevamiento / Visita', icon: 'explore', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  otro: { label: 'Otro', icon: 'category', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

interface VisorState {
  url: string;
  titulo: string;
  actividadId: string;
  fotoIndex: number;
  paths: string[];
  areaId: string;
}

export const ActividadesTerritoriales: React.FC<Props> = ({ perfilActual }) => {
  const [actividades, setActividades] = useState<ActividadTerritorial[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filtroArea, setFiltroArea] = useState<string>('todas');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState<string>('');

  // Modal de registro
  const [modalCrear, setModalCrear] = useState(false);
  const [formAreaId, setFormAreaId] = useState<string>('');
  const [formFecha, setFormFecha] = useState<string>('');
  const [formLocalidad, setFormLocalidad] = useState<string>('');
  const [formTipo, setFormTipo] = useState<TipoActividad>('taller');
  const [formDescripcion, setFormDescripcion] = useState<string>('');
  const [formParticipantes, setFormParticipantes] = useState<number | ''>('');
  const [formNotaPedidoId, setFormNotaPedidoId] = useState<string>('');
  const [formFotos, setFormFotos] = useState<File[]>([]);
  const [notasPedidoArea, setNotasPedidoArea] = useState<Array<{ id: string; numero: string | null; descripcion: string | null }>>([]);
  const [loadingNotas, setLoadingNotas] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [progresoSubida, setProgresoSubida] = useState<string>('');

  // Modal de edición
  const [actividadEditar, setActividadEditar] = useState<ActividadTerritorial | null>(null);
  const [formEditLocalidad, setFormEditLocalidad] = useState('');
  const [formEditFecha, setFormEditFecha] = useState('');
  const [formEditTipo, setFormEditTipo] = useState<TipoActividad>('taller');
  const [formEditDescripcion, setFormEditDescripcion] = useState('');
  const [formEditParticipantes, setFormEditParticipantes] = useState<number | ''>('');
  const [formEditNotaPedidoId, setFormEditNotaPedidoId] = useState('');
  const [notasPedidoAreaEditar, setNotasPedidoAreaEditar] = useState<Array<{ id: string; numero: string | null; descripcion: string | null }>>([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  // Modal de anulación
  const [actividadAnular, setActividadAnular] = useState<ActividadTerritorial | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState<string>('');
  const [anulando, setAnulando] = useState(false);

  // Subida de fotos posterior
  const [actividadParaFoto, setActividadParaFoto] = useState<ActividadTerritorial | null>(null);
  const [subiendoFotoCardId, setSubiendoFotoCardId] = useState<string | null>(null);
  const fileInputPosteriorRef = useRef<HTMLInputElement | null>(null);

  // Visor de foto a pantalla completa
  const [visor, setVisor] = useState<VisorState | null>(null);
  const [cargandoVisor, setCargandoVisor] = useState(false);

  const esGestion = esRolGestion(perfilActual?.rol);
  const puedeRegistrar = esGestion || !!perfilActual?.area_id;

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listarActividadesTerritoriales();
      setActividades(res.actividades || []);
      setAreas(res.areas || []);
    } catch (err: any) {
      setError(err.message || 'Error al cargar las actividades territoriales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Cargar notas de pedido vinculables para el área seleccionada en el formulario
  const cargarNotasDeArea = async (areaId: string) => {
    if (!areaId) {
      setNotasPedidoArea([]);
      return;
    }
    try {
      setLoadingNotas(true);
      const data = await listarNotasDeArea(areaId);
      setNotasPedidoArea(data);
    } catch (err: any) {
      console.error('Error al cargar notas de pedido del área:', err);
      setNotasPedidoArea([]);
    } finally {
      setLoadingNotas(false);
    }
  };

  // Apertura del modal con valores iniciales limpios
  const abrirModalCrear = () => {
    const areaInicial = perfilActual?.area_id || (areas.length > 0 ? areas[0].id : '');
    setFormAreaId(areaInicial);
    setFormFecha(new Date().toISOString().slice(0, 10));
    setFormLocalidad('');
    setFormTipo('taller');
    setFormDescripcion('');
    setFormParticipantes('');
    setFormNotaPedidoId('');
    setFormFotos([]);
    setProgresoSubida('');
    setError(null);
    setModalCrear(true);

    if (areaInicial) {
      cargarNotasDeArea(areaInicial);
    }
  };

  const handleCambioAreaForm = (nuevaAreaId: string) => {
    setFormAreaId(nuevaAreaId);
    setFormNotaPedidoId('');
    cargarNotasDeArea(nuevaAreaId);
  };

  const handleFileChangeModal = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const nuevos = Array.from(e.target.files);
    setFormFotos((prev) => [...prev, ...nuevos]);
    e.target.value = '';
  };

  const removerFotoModal = (index: number) => {
    setFormFotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Envío del formulario de registro
  const handleSubmitCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAreaId) {
      alert('Por favor seleccioná un área');
      return;
    }
    if (!formFecha) {
      alert('Por favor seleccioná la fecha');
      return;
    }
    if (!formLocalidad.trim()) {
      alert('Por favor ingresá la localidad');
      return;
    }
    if (!formDescripcion.trim()) {
      alert('Por favor ingresá una descripción de la actividad');
      return;
    }
    if (formParticipantes === '' || Number(formParticipantes) < 0) {
      alert('Por favor indicá una cantidad válida de participantes');
      return;
    }

    try {
      setGuardando(true);
      setProgresoSubida('Creando registro de actividad...');

      const nueva = await crearActividadTerritorial({
        area_id: formAreaId,
        fecha: formFecha,
        localidad: formLocalidad.trim(),
        tipo_actividad: formTipo,
        descripcion: formDescripcion.trim(),
        cantidad_participantes: Number(formParticipantes),
        nota_pedido_id: formNotaPedidoId || null,
      });

      // Subir fotos seleccionadas en secuencia
      if (formFotos.length > 0) {
        for (let i = 0; i < formFotos.length; i++) {
          setProgresoSubida(`Subiendo foto ${i + 1} de ${formFotos.length}...`);
          await agregarFotoActividad(nueva.id, formAreaId, formFotos[i]);
        }
      }

      setModalCrear(false);
      await cargarDatos();
    } catch (err: any) {
      alert('No se pudo registrar la actividad: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardando(false);
      setProgresoSubida('');
    }
  };

  // Subir foto posterior en una tarjeta
  const triggerAgregarFotoPosterior = (actividad: ActividadTerritorial) => {
    setActividadParaFoto(actividad);
    if (fileInputPosteriorRef.current) {
      fileInputPosteriorRef.current.value = '';
      fileInputPosteriorRef.current.click();
    }
  };

  const handleFileChangePosterior = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const act = actividadParaFoto;
    if (!files || files.length === 0 || !act) return;

    try {
      setSubiendoFotoCardId(act.id);
      for (let i = 0; i < files.length; i++) {
        await agregarFotoActividad(act.id, act.area_id, files[i]);
      }
      await cargarDatos();
    } catch (err: any) {
      alert('Error al subir la foto: ' + (err.message || 'Error desconocido'));
    } finally {
      setSubiendoFotoCardId(null);
      setActividadParaFoto(null);
      if (fileInputPosteriorRef.current) fileInputPosteriorRef.current.value = '';
    }
  };

  // Abrir visor de fotos
  const handleAbrirVisor = async (act: ActividadTerritorial, index: number) => {
    const path = act.fotos_paths[index];
    if (!path) return;
    try {
      setCargandoVisor(true);
      const url = await getSignedUrlFotoActividad(path, 300);
      setVisor({
        url,
        titulo: `${act.localidad} · Foto ${index + 1} de ${act.fotos_paths.length}`,
        actividadId: act.id,
        fotoIndex: index,
        paths: act.fotos_paths,
        areaId: act.area_id,
      });
    } catch (err: any) {
      alert('No se pudo cargar la imagen: ' + (err.message || 'Error desconocido'));
    } finally {
      setCargandoVisor(false);
    }
  };

  const cambiarFotoVisor = async (nuevoIndex: number) => {
    if (!visor) return;
    const path = visor.paths[nuevoIndex];
    if (!path) return;
    try {
      setCargandoVisor(true);
      const url = await getSignedUrlFotoActividad(path, 300);
      setVisor({
        ...visor,
        url,
        titulo: `${visor.titulo.split('·')[0].trim()} · Foto ${nuevoIndex + 1} de ${visor.paths.length}`,
        fotoIndex: nuevoIndex,
      });
    } catch (err: any) {
      alert('No se pudo cargar la imagen: ' + (err.message || 'Error desconocido'));
    } finally {
      setCargandoVisor(false);
    }
  };

  // Edición de actividad
  const abrirModalEditar = (act: ActividadTerritorial) => {
    setActividadEditar(act);
    setFormEditLocalidad(act.localidad);
    setFormEditFecha(act.fecha);
    setFormEditTipo(act.tipo_actividad);
    setFormEditDescripcion(act.descripcion);
    setFormEditParticipantes(act.cantidad_participantes);
    setFormEditNotaPedidoId(act.nota_pedido_id || '');
    setNotasPedidoAreaEditar([]);
    listarNotasDeArea(act.area_id)
      .then(setNotasPedidoAreaEditar)
      .catch((err) => console.error('Error al cargar notas de pedido del área:', err));
  };

  const handleSubmitEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actividadEditar) return;
    if (!formEditLocalidad.trim() || !formEditFecha || !formEditDescripcion.trim() || formEditParticipantes === '') {
      alert('Completá todos los campos obligatorios.');
      return;
    }
    try {
      setGuardandoEdicion(true);
      await actualizarActividadTerritorial(actividadEditar.id, {
        fecha: formEditFecha,
        localidad: formEditLocalidad.trim(),
        tipo_actividad: formEditTipo,
        descripcion: formEditDescripcion.trim(),
        cantidad_participantes: Number(formEditParticipantes),
        nota_pedido_id: formEditNotaPedidoId || null,
      });
      setActividadEditar(null);
      await cargarDatos();
    } catch (err: any) {
      alert('No se pudo guardar la edición: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardandoEdicion(false);
    }
  };

  // Anulación de actividad
  const abrirModalAnular = (act: ActividadTerritorial) => {
    setActividadAnular(act);
    setMotivoAnulacion('');
  };

  const handleConfirmarAnular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actividadAnular) return;
    if (!motivoAnulacion.trim()) {
      alert('El motivo de anulación es obligatorio.');
      return;
    }
    try {
      setAnulando(true);
      await anularActividadTerritorial(actividadAnular.id, motivoAnulacion.trim());
      setActividadAnular(null);
      await cargarDatos();
    } catch (err: any) {
      alert('No se pudo anular la actividad: ' + (err.message || 'Error desconocido'));
    } finally {
      setAnulando(false);
    }
  };

  // Filtros aplicados
  const actividadesFiltradas = useMemo(() => {
    return actividades.filter((act) => {
      if (filtroArea !== 'todas' && act.area_id !== filtroArea) return false;
      if (filtroTipo !== 'todos' && act.tipo_actividad !== filtroTipo) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const coincideLocalidad = act.localidad?.toLowerCase().includes(q);
        const coincideDesc = act.descripcion?.toLowerCase().includes(q);
        const coincideRegistrador =
          `${act.registrador?.nombre || ''} ${act.registrador?.apellido || ''}`.toLowerCase().includes(q);
        const coincideNota = act.nota_pedido?.numero?.toLowerCase().includes(q);
        if (!coincideLocalidad && !coincideDesc && !coincideRegistrador && !coincideNota) {
          return false;
        }
      }
      return true;
    });
  }, [actividades, filtroArea, filtroTipo, busqueda]);

  return (
    <div className="max-w-[1440px] mx-auto px-gutter py-6 flex flex-col gap-6">
      {/* HEADER DE LA SECCIÓN */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">groups</span>
            <h1 className="text-headline-md font-bold tracking-tight text-primary">Actividades Territoriales</h1>
            <span className="px-2.5 py-0.5 rounded-full text-label-sm font-semibold bg-primary-container text-on-primary-container">
              {actividades.length}
            </span>
          </div>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Registro institucional de intervenciones, talleres, capacitaciones y actividades en territorio por área.
          </p>
        </div>

        {puedeRegistrar ? (
          <button
            type="button"
            onClick={abrirModalCrear}
            className="h-10 px-4 bg-primary text-on-primary font-label-md font-semibold rounded-xl hover:bg-primary/90 flex items-center justify-center gap-2 shadow-sm transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Registrar Actividad</span>
          </button>
        ) : (
          <span className="text-label-sm text-on-surface-variant">
            Para registrar actividades tu usuario necesita un área asignada.
          </span>
        )}
      </header>

      {/* INPUT FILE OCULTO PARA AGREGAR FOTOS POSTERIORES */}
      <input
        type="file"
        ref={fileInputPosteriorRef}
        onChange={handleFileChangePosterior}
        accept="image/*"
        multiple
        className="hidden"
      />

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
              placeholder="Buscar por localidad, descripción o agente..."
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

          {/* Filtro por Área */}
          <div className="sm:w-64">
            <select
              value={filtroArea}
              onChange={(e) => setFiltroArea(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
            >
              <option value="todas">Todas las áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Tipo */}
          <div className="sm:w-56">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full h-10 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
            >
              <option value="todos">Todos los tipos</option>
              {TIPOS_ACTIVIDAD.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Indicador de resultados */}
        {(filtroArea !== 'todas' || filtroTipo !== 'todos' || busqueda) && (
          <div className="flex items-center gap-2 text-label-sm text-outline shrink-0 justify-end">
            <span>
              {actividadesFiltradas.length} de {actividades.length} encontradas
            </span>
            <button
              type="button"
              onClick={() => {
                setFiltroArea('todas');
                setFiltroTipo('todos');
                setBusqueda('');
              }}
              className="text-secondary hover:underline font-semibold"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* MENSAJE DE ERROR */}
      {error && (
        <div className="p-4 bg-error-container text-on-error-container rounded-xl border border-error flex items-start gap-3">
          <span className="material-symbols-outlined text-error shrink-0">error</span>
          <div className="flex-1 text-body-sm">
            <strong>Error:</strong> {error}
          </div>
          <button
            type="button"
            onClick={cargarDatos}
            className="text-label-sm underline font-semibold hover:opacity-80"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ESTADO DE CARGA */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-outline">
          <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-body-md font-medium">Cargando actividades territoriales...</span>
        </div>
      ) : actividadesFiltradas.length === 0 ? (
        /* ESTADO VACÍO REAL (NUNCA DATOS DE EJEMPLO) */
        <div className="bg-surface-container-lowest border-2 border-dashed border-outline-variant rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[36px]">travel_explore</span>
          </div>
          <h2 className="text-title-lg font-bold text-primary">No hay actividades territoriales</h2>
          <p className="text-body-md text-on-surface-variant max-w-md">
            {actividades.length === 0
              ? 'Aún no se registraron actividades en territorio. Podés cargar la primera con el botón de registro.'
              : 'No se encontraron actividades que coincidan con los filtros seleccionados.'}
          </p>
          {actividades.length === 0 && puedeRegistrar && (
            <button
              type="button"
              onClick={abrirModalCrear}
              className="mt-2 h-10 px-5 bg-primary text-on-primary font-label-md font-semibold rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Registrar primera actividad</span>
            </button>
          )}
        </div>
      ) : (
        /* LISTADO DE TARJETAS */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {actividadesFiltradas.map((act) => {
            const metaTipo = MAPA_TIPOS[act.tipo_actividad] || MAPA_TIPOS.otro;
            const esAnulada = act.estado === 'anulada';

            // Permisos de anulación: registrador, gestión o jefe de área de esa área
            const esRegistrador = perfilActual?.id === act.registrado_por;
            const esJefeDeEstaArea = perfilActual?.rol === 'jefe_area' && perfilActual?.area_id === act.area_id;
            const puedeAnular = (esGestion || esRegistrador || esJefeDeEstaArea) && !esAnulada;

            const tieneFotos = act.fotos_paths && act.fotos_paths.length > 0;
            const subiendoEnEstaCard = subiendoFotoCardId === act.id;

            return (
              <article
                key={act.id}
                className={`bg-surface-container-lowest rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  esAnulada ? 'border-outline-variant/60 opacity-80' : 'border-outline-variant hover:border-secondary/40'
                }`}
              >
                {/* PARTE SUPERIOR DE LA TARJETA */}
                <div className="p-5 flex flex-col gap-3.5">
                  {/* Encabezado: Tipo de actividad, fecha y chip de anulación */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-xs font-bold border ${metaTipo.cls}`}
                    >
                      <span className="material-symbols-outlined text-[15px]">{metaTipo.icon}</span>
                      <span>{metaTipo.label}</span>
                    </span>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {esAnulada && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-xs font-bold bg-surface-container text-on-surface-variant border border-outline-variant">
                          <span className="material-symbols-outlined text-[13px]">block</span>
                          <span>Anulada</span>
                        </span>
                      )}
                      <span className="text-label-sm font-medium text-outline flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                        <span>{formatearFecha(act.fecha)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Localidad y Área */}
                  <div>
                    <h3 className="text-title-md font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-[20px] shrink-0">location_on</span>
                      <span className="truncate">{act.localidad}</span>
                    </h3>
                    <div className="text-label-sm font-semibold text-secondary flex items-center gap-1 mt-0.5">
                      <span className="material-symbols-outlined text-[16px] text-outline">apartment</span>
                      <span>{act.area?.nombre || 'Área no informada'}</span>
                    </div>
                  </div>

                  {/* Participantes y Nota de Pedido vinculada */}
                  <div className="flex items-center gap-3 flex-wrap text-label-sm">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-semibold border border-outline-variant/50">
                      <span className="material-symbols-outlined text-primary text-[16px]">groups</span>
                      <span>{act.cantidad_participantes} participantes</span>
                    </span>

                    {act.nota_pedido && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary-container/40 text-secondary font-bold border border-secondary/20"
                        title="Actividad vinculada a Nota de Pedido"
                      >
                        <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                        <span>{act.nota_pedido.numero || 'Nota de pedido'}</span>
                      </span>
                    )}
                  </div>

                  {/* Descripción */}
                  <p className="text-body-sm text-on-surface-variant line-clamp-4 leading-relaxed whitespace-pre-line bg-surface-container-low/40 p-3 rounded-xl border border-outline-variant/40">
                    {act.descripcion}
                  </p>

                  {/* Si está anulada: mostrar motivo */}
                  {esAnulada && act.motivo_anulacion && (
                    <div className="p-3 bg-surface-container rounded-xl border border-outline-variant text-label-sm text-on-surface-variant flex items-start gap-2">
                      <span className="material-symbols-outlined text-[16px] text-outline mt-0.5 shrink-0">info</span>
                      <div>
                        <strong className="text-on-surface">Motivo de anulación:</strong> {act.motivo_anulacion}
                      </div>
                    </div>
                  )}

                  {/* FOTOS / GALERÍA */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-label-sm font-bold text-primary flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-secondary">photo_camera</span>
                        <span>Fotos ({act.fotos_paths?.length || 0})</span>
                      </span>

                      {!esAnulada && (
                        <button
                          type="button"
                          disabled={subiendoEnEstaCard}
                          onClick={() => triggerAgregarFotoPosterior(act)}
                          className="text-label-xs font-bold text-secondary hover:text-primary flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
                          title="Sumar fotos a esta actividad"
                        >
                          {subiendoEnEstaCard ? (
                            <>
                              <div className="w-3 h-3 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                              <span>Subiendo...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>
                              <span>Agregar foto</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {tieneFotos ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        {act.fotos_paths.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={cargandoVisor}
                            onClick={() => handleAbrirVisor(act, idx)}
                            className="group flex items-center gap-1.5 px-2.5 py-1 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-label-xs font-medium text-on-surface transition-all disabled:opacity-50"
                            title="Hacé clic para ver la foto a pantalla completa"
                          >
                            <span className="material-symbols-outlined text-[15px] text-secondary group-hover:scale-110 transition-transform">
                              image
                            </span>
                            <span>Foto {idx + 1}</span>
                            <span className="material-symbols-outlined text-[13px] text-outline group-hover:text-primary">
                              visibility
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-label-xs text-outline italic py-1">Sin fotos adjuntas</div>
                    )}
                  </div>
                </div>

                {/* PIE DE TARJETA: Registrador y botón Anular */}
                <div className="px-5 py-3 bg-surface-container-low border-t border-outline-variant flex items-center justify-between gap-3 text-label-sm">
                  <div className="flex items-center gap-1.5 text-outline truncate">
                    <span className="material-symbols-outlined text-[16px] shrink-0">person</span>
                    <span className="truncate">
                      {act.registrador?.nombre
                        ? `${act.registrador.nombre} ${act.registrador.apellido}`
                        : 'Registrado'}
                    </span>
                  </div>

                  {puedeAnular && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => abrirModalEditar(act)}
                        className="px-2.5 py-1 text-label-xs font-semibold text-primary hover:bg-surface-container border border-outline-variant rounded-lg flex items-center gap-1 transition-colors"
                        title="Editar los datos de esta actividad"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirModalAnular(act)}
                        className="px-2.5 py-1 text-label-xs font-semibold text-error hover:bg-error-container/30 border border-error/30 rounded-lg flex items-center gap-1 transition-colors"
                        title="Dar de baja esta actividad con motivo"
                      >
                        <span className="material-symbols-outlined text-[14px]">cancel</span>
                        <span>Anular</span>
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR ACTIVIDAD TERRITORIAL */}
      {/* ========================================================================= */}
      {modalCrear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !guardando && setModalCrear(false)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 text-on-surface max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-secondary">add_circle</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Registrar Actividad Territorial</h2>
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
              {/* FILA 1: Área y Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Área <span className="text-error">*</span>
                  </label>
                  <select
                    required
                    value={formAreaId}
                    disabled={!esGestion && !!perfilActual?.area_id}
                    onChange={(e) => handleCambioAreaForm(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all disabled:opacity-75 disabled:bg-surface-container-low"
                  >
                    <option value="">Seleccioná un área</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                  {!esGestion && perfilActual?.area_id && (
                    <span className="text-label-xs text-outline mt-1 block">
                      Asignada a tu área de pertenencia.
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Fecha de la Actividad <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formFecha}
                    onChange={(e) => setFormFecha(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              {/* FILA 2: Localidad y Tipo de Actividad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Localidad / Municipio <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: La Plata, Quilmes, San Martín..."
                    value={formLocalidad}
                    onChange={(e) => setFormLocalidad(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                  />
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Tipo de Actividad <span className="text-error">*</span>
                  </label>
                  <select
                    required
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as TipoActividad)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  >
                    {TIPOS_ACTIVIDAD.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FILA 3: Participantes y Vinculación con Nota de Pedido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Cantidad de Participantes <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    placeholder="Ej: 25"
                    value={formParticipantes}
                    onChange={(e) => setFormParticipantes(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>

                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    ¿Se vinculó a alguna nota de pedido? <span className="text-outline text-label-xs">(Opcional)</span>
                  </label>
                  <select
                    value={formNotaPedidoId}
                    onChange={(e) => setFormNotaPedidoId(e.target.value)}
                    disabled={loadingNotas}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all disabled:opacity-50"
                  >
                    <option value="">Sin vincular a nota de pedido</option>
                    {notasPedidoArea.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.numero || 'Nota sin número'} {n.descripcion ? `— ${n.descripcion}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FILA 4: Descripción */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Descripción de la Actividad <span className="text-error">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Detallá los objetivos, temática desarrollada, dinámicas del encuentro y actores comunitarios involucrados..."
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              {/* FILA 5: Fotos de la Actividad (Opcional, una o varias) */}
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Fotos de la Actividad <span className="text-outline text-label-xs">(Opcional)</span>
                </label>
                <div className="border border-dashed border-outline-variant rounded-xl p-4 bg-surface-container-low flex flex-col items-center justify-center gap-2 text-center">
                  <span className="material-symbols-outlined text-secondary text-[28px]">add_photo_alternate</span>
                  <div className="text-body-sm text-on-surface">
                    <label className="text-secondary font-bold hover:underline cursor-pointer">
                      Seleccioná fotos desde tu equipo
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChangeModal}
                        className="hidden"
                      />
                    </label>
                    <span className="text-outline"> o arrastralas aquí</span>
                  </div>
                  <span className="text-label-xs text-outline">JPG, PNG o WEBP. Podés seleccionar varias fotos a la vez.</span>
                </div>

                {/* Miniaturas de fotos seleccionadas para subir */}
                {formFotos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formFotos.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high rounded-lg text-label-xs font-semibold text-on-surface border border-outline-variant"
                      >
                        <span className="material-symbols-outlined text-[15px] text-secondary">image</span>
                        <span className="max-w-[150px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removerFotoModal(i)}
                          className="text-outline hover:text-error ml-1"
                          title="Quitar foto"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Estado de progreso */}
              {progresoSubida && (
                <div className="p-3 bg-secondary-container text-on-secondary-container rounded-xl text-label-sm font-semibold flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin shrink-0"></div>
                  <span>{progresoSubida}</span>
                </div>
              )}

              {/* Botones de acción */}
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
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      <span>Guardar Registro</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR ACTIVIDAD TERRITORIAL */}
      {/* ========================================================================= */}
      {actividadEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !guardandoEdicion && setActividadEditar(null)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-5 text-on-surface max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined text-2xl text-secondary">edit</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Editar Actividad Territorial</h2>
              </div>
              <button
                type="button"
                disabled={guardandoEdicion}
                onClick={() => setActividadEditar(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-label-sm text-outline -mt-2">
              Área: <strong className="text-primary">{actividadEditar.area?.nombre}</strong> (no se puede cambiar de área al editar).
            </p>

            <form onSubmit={handleSubmitEditar} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Fecha de la Actividad <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formEditFecha}
                    onChange={(e) => setFormEditFecha(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Localidad / Municipio <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formEditLocalidad}
                    onChange={(e) => setFormEditLocalidad(e.target.value)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Tipo de Actividad <span className="text-error">*</span>
                  </label>
                  <select
                    required
                    value={formEditTipo}
                    onChange={(e) => setFormEditTipo(e.target.value as TipoActividad)}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  >
                    {TIPOS_ACTIVIDAD.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label-md font-semibold text-primary mb-1">
                    Cantidad de Participantes <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formEditParticipantes}
                    onChange={(e) => setFormEditParticipantes(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  ¿Se vinculó a alguna nota de pedido? <span className="text-outline text-label-xs">(Opcional)</span>
                </label>
                <select
                  value={formEditNotaPedidoId}
                  onChange={(e) => setFormEditNotaPedidoId(e.target.value)}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                >
                  <option value="">Sin vincular a nota de pedido</option>
                  {notasPedidoAreaEditar.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.numero || 'Nota sin número'} {n.descripcion ? `— ${n.descripcion}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Descripción de la Actividad <span className="text-error">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={formEditDescripcion}
                  onChange={(e) => setFormEditDescripcion(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-sm text-on-surface focus:outline-none focus:border-secondary transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  disabled={guardandoEdicion}
                  onClick={() => setActividadEditar(null)}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdicion}
                  className="px-5 h-10 bg-primary text-on-primary font-label-md font-semibold rounded-xl hover:bg-primary/90 flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                >
                  {guardandoEdicion ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check</span>
                      <span>Guardar Cambios</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ANULAR ACTIVIDAD TERRITORIAL (CON MOTIVO OBLIGATORIO) */}
      {/* ========================================================================= */}
      {actividadAnular && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !anulando && setActividadAnular(null)}
        >
          <div
            className="bg-surface-container-lowest border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 text-on-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 text-error">
                <span className="material-symbols-outlined text-2xl">cancel</span>
                <h2 className="text-headline-sm font-bold tracking-tight">Anular Actividad</h2>
              </div>
              <button
                type="button"
                disabled={anulando}
                onClick={() => setActividadAnular(null)}
                className="text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant text-body-sm">
              <div className="font-semibold text-primary">{actividadAnular.localidad}</div>
              <div className="text-label-sm text-outline mt-0.5">
                {formatearFecha(actividadAnular.fecha)} · {actividadAnular.area?.nombre}
              </div>
            </div>

            <form onSubmit={handleConfirmarAnular} className="flex flex-col gap-4">
              <div>
                <label className="block text-label-md font-semibold text-primary mb-1">
                  Motivo de la anulación <span className="text-error">* (Obligatorio)</span>
                </label>
                <textarea
                  required
                  autoFocus
                  rows={3}
                  placeholder="Detallá el motivo por el cual se anula este registro..."
                  value={motivoAnulacion}
                  onChange={(e) => setMotivoAnulacion(e.target.value)}
                  className="w-full p-3 bg-surface border border-outline-variant rounded-xl text-body-sm focus:outline-none focus:border-secondary transition-all placeholder:text-outline"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant">
                <button
                  type="button"
                  disabled={anulando}
                  onClick={() => setActividadAnular(null)}
                  className="px-4 h-10 border border-outline-variant text-on-surface-variant font-label-md rounded-xl hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={!motivoAnulacion.trim() || anulando}
                  className="px-5 h-10 bg-error text-on-error font-label-md rounded-xl hover:bg-error/90 flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {anulando ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-error border-t-transparent rounded-full animate-spin"></div>
                      <span>Anulando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                      <span>Confirmar Anulación</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: VISOR DE FOTO A PANTALLA COMPLETA */}
      {/* ========================================================================= */}
      {visor && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn"
          onClick={() => setVisor(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden border border-outline-variant"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del visor */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-outline-variant bg-surface-container-low shrink-0">
              <div className="flex items-center gap-2 truncate">
                <span className="material-symbols-outlined text-secondary text-[22px]">photo_camera</span>
                <span className="text-label-md font-bold text-primary truncate">{visor.titulo}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={visor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-label-sm font-semibold text-secondary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Abrir en pestaña nueva</span>
                </a>
                <button
                  type="button"
                  onClick={() => setVisor(null)}
                  className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                  title="Cerrar"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Contenido de la imagen con navegación */}
            <div className="relative flex-1 bg-black/90 overflow-hidden flex items-center justify-center p-4">
              {cargandoVisor ? (
                <div className="flex flex-col items-center gap-2 text-white/80">
                  <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-body-sm">Cargando imagen...</span>
                </div>
              ) : (
                <img
                  src={visor.url}
                  alt={visor.titulo}
                  className="max-w-full max-h-full object-contain rounded-lg select-none"
                />
              )}

              {/* Botón Foto Anterior */}
              {visor.paths.length > 1 && visor.fotoIndex > 0 && (
                <button
                  type="button"
                  onClick={() => cambiarFotoVisor(visor.fotoIndex - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                  title="Foto anterior"
                >
                  <span className="material-symbols-outlined text-[24px]">chevron_left</span>
                </button>
              )}

              {/* Botón Foto Siguiente */}
              {visor.paths.length > 1 && visor.fotoIndex < visor.paths.length - 1 && (
                <button
                  type="button"
                  onClick={() => cambiarFotoVisor(visor.fotoIndex + 1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                  title="Foto siguiente"
                >
                  <span className="material-symbols-outlined text-[24px]">chevron_right</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
