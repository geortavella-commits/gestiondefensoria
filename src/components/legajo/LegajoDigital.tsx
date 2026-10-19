import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  getPerfilAgente,
  getDocumentosAgente,
  getHistorialCapacitaciones,
  updatePerfilAgente,
  uploadDocumentoPersonal,
  getSignedUrlDocumento,
  validarDocumento,
  esRolGestion,
} from '../../services/legajo';
import {
  getGrupoFamiliar,
  agregarFamiliar,
  actualizarFamiliar,
  eliminarFamiliar,
  subirFotoDniFamiliar,
  getSignedUrlFotoFamiliar,
} from '../../services/grupoFamiliar';
import { calcularEstadoDocumento, formatearFecha } from '../../utils/legajoCalculations';
import { EditarPerfilModal } from './EditarPerfilModal';
import { FamiliarModal } from './FamiliarModal';
import type {
  Profile,
  CapacitacionAgente,
  DocumentoConCatalogo,
  RolUsuario,
  FamiliarPersonal,
  Parentesco,
} from '../../types/legajo';

const PARENTESCO_LABELS: Record<Parentesco, string> = {
  conyuge_conviviente: 'Cónyuge / Conviviente',
  hijo_a: 'Hijo/a',
  otro: 'Otro',
};

interface Props {
  profileId: string;
  currentUserId: string;
  currentUserRole: RolUsuario;
  onVolverNomina?: () => void;
}

export const LegajoDigital: React.FC<Props> = ({
  profileId,
  currentUserId,
  currentUserRole,
  onVolverNomina,
}) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'personal' | 'capacitaciones' | 'familia' | 'auditoria'>('docs');
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [documentosCatalogados, setDocumentosCatalogados] = useState<DocumentoConCatalogo[]>([]);
  const [capacitaciones, setCapacitaciones] = useState<CapacitacionAgente[]>([]);
  const [familiares, setFamiliares] = useState<FamiliarPersonal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isFamiliarModalOpen, setIsFamiliarModalOpen] = useState(false);
  const [familiarAEditar, setFamiliarAEditar] = useState<FamiliarPersonal | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const familiarFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingTipoId, setUploadingTipoId] = useState<string | null>(null);
  const [uploadingFamiliarTarget, setUploadingFamiliarTarget] = useState<{ familiarId: string; lado: 'frente' | 'dorso' } | null>(null);
  const [dragOverTipoId, setDragOverTipoId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);
  const [visor, setVisor] = useState<{ url: string; nombre: string; esImagen: boolean } | null>(null);
  const [validandoId, setValidandoId] = useState<string | null>(null);
  const [rechazoTarget, setRechazoTarget] = useState<{ documentoId: string; tipoNombre: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const esGestion = useMemo(() => esRolGestion(currentUserRole), [currentUserRole]);
  const esPropioPerfil = currentUserId === profileId;
  const puedeEditarPerfil = esPropioPerfil || esGestion;
  // Quién ve los botones de Aprobar/Rechazar. Es solo una ayuda de UI: el
  // permiso real lo decide la policy `documentos_update` (gestión, jefe del
  // área del agente o referente de su sub-sede) — si alguien sin permiso
  // real llega a intentarlo, el UPDATE no afecta filas y se corta con error.
  const puedeValidar =
    !esPropioPerfil &&
    (esGestion || currentUserRole === 'jefe_area' || currentUserRole === 'referente_subsede');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [perfilData, docsData, capData, famData] = await Promise.all([
        getPerfilAgente(profileId),
        getDocumentosAgente(profileId),
        getHistorialCapacitaciones(profileId),
        puedeEditarPerfil
          ? getGrupoFamiliar(profileId).catch((err) => {
              console.error('Error al cargar grupo familiar:', err);
              return [];
            })
          : Promise.resolve([]),
      ]);

      setPerfil(perfilData);
      setCapacitaciones(capData);
      setFamiliares(famData);

      const catalogados = docsData.tipos.map((tipo) => {
        const docEncontrado = docsData.documentos.find((d) => d.tipo_documento_id === tipo.id) || null;
        return calcularEstadoDocumento(tipo, docEncontrado);
      });

      setDocumentosCatalogados(catalogados);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al cargar el legajo del agente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileId) {
      fetchData();
    }
  }, [profileId]);

  const stats = useMemo(() => {
    const total = documentosCatalogados.length;
    // "Validado" = estadoDerivado 'aprobado' de verdad: aprobado, no vencido y no
    // por vencer. Antes contaba como validado un aprobado próximo a vencer,
    // aunque la tarjeta mostrara la alerta ámbar — quedaba inconsistente.
    const validados = documentosCatalogados.filter((d) => d.estadoDerivado === 'aprobado').length;
    const porcentaje = total > 0 ? Math.round((validados / total) * 100) : 0;

    // "Subido" = hay archivo cargado, sin importar si ya fue revisado. El badge
    // de la pestaña usa esto (no "validados") porque si no, un documento recién
    // subido y todavía "En Revisión" sigue contando como 0 y parece que no se
    // adjuntó nada.
    const subidos = documentosCatalogados.filter((d) => d.estadoDerivado !== 'pendiente').length;

    const vencidos = documentosCatalogados.filter((d) => d.estadoDerivado === 'vencido');
    const porVencer = documentosCatalogados.filter((d) => d.estadoDerivado === 'por_vencer');

    return { total, validados, subidos, porcentaje, vencidos, porVencer };
  }, [documentosCatalogados]);

  const triggerUpload = (tipoId: string) => {
    setUploadingTipoId(tipoId);
    fileInputRef.current?.click();
  };

  const subirArchivo = async (tipoId: string, file: File) => {
    try {
      await uploadDocumentoPersonal(profileId, tipoId, file);
      await fetchData();
    } catch (err: any) {
      alert('Error al subir el documento: ' + err.message);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const tipoId = uploadingTipoId;
    e.target.value = '';
    setUploadingTipoId(null);
    if (!file || !tipoId) return;
    await subirArchivo(tipoId, file);
  };

  const handleDropArchivo = (e: React.DragEvent<HTMLDivElement>, tipoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTipoId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) subirArchivo(tipoId, file);
  };

  const handleSavePerfil = async (datosActualizados: Partial<Profile>) => {
    const updated = await updatePerfilAgente(profileId, datosActualizados, esGestion);
    setPerfil(updated);
  };

  const handleAbrirAgregarFamiliar = () => {
    setFamiliarAEditar(null);
    setIsFamiliarModalOpen(true);
  };

  const handleAbrirEditarFamiliar = (familiar: FamiliarPersonal) => {
    setFamiliarAEditar(familiar);
    setIsFamiliarModalOpen(true);
  };

  const handleGuardarFamiliar = async (datos: {
    nombre: string;
    apellido: string;
    dni?: string | null;
    parentesco: Parentesco;
  }) => {
    if (familiarAEditar) {
      const updated = await actualizarFamiliar(familiarAEditar.id, datos);
      setFamiliares((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } else {
      const nuevo = await agregarFamiliar({
        profileId,
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        parentesco: datos.parentesco,
      });
      setFamiliares((prev) => [...prev, nuevo]);
    }
  };

  const handleEliminarFamiliar = async (familiar: FamiliarPersonal) => {
    const confirma = window.confirm(
      `¿Estás seguro de que deseás eliminar a ${familiar.nombre} ${familiar.apellido} del grupo familiar?`
    );
    if (!confirma) return;

    try {
      await eliminarFamiliar(familiar.id);
      setFamiliares((prev) => prev.filter((f) => f.id !== familiar.id));
    } catch (err: any) {
      alert('No se pudo eliminar al familiar: ' + (err.message || 'Error desconocido'));
    }
  };

  const triggerUploadFamiliar = (familiarId: string, lado: 'frente' | 'dorso') => {
    setUploadingFamiliarTarget({ familiarId, lado });
    familiarFileInputRef.current?.click();
  };

  const handleFamiliarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadingFamiliarTarget;
    e.target.value = '';
    setUploadingFamiliarTarget(null);
    if (!file || !target) return;
    await subirFotoFamiliar(target.familiarId, target.lado, file);
  };

  const subirFotoFamiliar = async (familiarId: string, lado: 'frente' | 'dorso', file: File) => {
    const slotKey = `${familiarId}_${lado}`;
    try {
      setUploadingSlotKey(slotKey);
      const updated = await subirFotoDniFamiliar(profileId, familiarId, lado, file);
      setFamiliares((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    } catch (err: any) {
      alert('No se pudo subir la foto del DNI: ' + (err.message || 'Error desconocido'));
    } finally {
      setUploadingSlotKey(null);
    }
  };

  const handleDropFamiliar = async (
    e: React.DragEvent<HTMLDivElement>,
    familiarId: string,
    lado: 'frente' | 'dorso'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlotKey(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await subirFotoFamiliar(familiarId, lado, file);
    }
  };

  const handleVerFotoFamiliar = async (fotoPath: string, titulo: string) => {
    try {
      const url = await getSignedUrlFotoFamiliar(fotoPath, 300);
      const esImagen = !/\.pdf$/i.test(fotoPath.split('?')[0]);
      setVisor({ url, nombre: titulo, esImagen });
    } catch (err: any) {
      alert('No se pudo abrir la foto del DNI: ' + (err.message || 'Error desconocido'));
    }
  };

  const handleVerDocumento = async (archivoPath: string, nombreArchivo: string) => {
    try {
      // Más tiempo que el default (300s) porque acá se queda mirando el visor,
      // no como la descarga que resuelve el pedido al toque.
      const url = await getSignedUrlDocumento(archivoPath, 300);
      const esImagen = /\.(jpe?g|png)$/i.test(nombreArchivo || archivoPath);
      setVisor({ url, nombre: nombreArchivo, esImagen });
    } catch (err: any) {
      alert('No se pudo abrir el documento: ' + err.message);
    }
  };

  const handleDescargarDocumento = async (archivoPath: string, nombreArchivo: string) => {
    try {
      const url = await getSignedUrlDocumento(archivoPath);
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert('No se pudo descargar el documento: ' + err.message);
    }
  };

  const handleAprobar = async (documentoId: string) => {
    try {
      setValidandoId(documentoId);
      await validarDocumento(documentoId, currentUserId, 'aprobado');
      await fetchData();
    } catch (err: any) {
      alert('No se pudo aprobar el documento: ' + err.message);
    } finally {
      setValidandoId(null);
    }
  };

  const abrirRechazo = (documentoId: string, tipoNombre: string) => {
    setMotivoRechazo('');
    setRechazoTarget({ documentoId, tipoNombre });
  };

  const confirmarRechazo = async () => {
    if (!rechazoTarget) return;
    if (!motivoRechazo.trim()) {
      alert('El motivo de rechazo es obligatorio.');
      return;
    }
    try {
      setValidandoId(rechazoTarget.documentoId);
      await validarDocumento(rechazoTarget.documentoId, currentUserId, 'rechazado', motivoRechazo.trim());
      setRechazoTarget(null);
      await fetchData();
    } catch (err: any) {
      alert('No se pudo rechazar el documento: ' + err.message);
    } finally {
      setValidandoId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-label-md text-on-surface-variant">Cargando legajo digital...</p>
      </div>
    );
  }

  if (error || !perfil) {
    return (
      <div className="p-6 bg-error-container text-on-error-container rounded-xl">
        <p className="font-bold">Error al cargar legajo:</p>
        <p>{error || 'Agente no encontrado en la base de datos'}</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-gutter pt-6 text-on-surface font-body-md">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={familiarFileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFamiliarFileChange}
      />

      {/* BREADCRUMBS */}
      <div className="flex items-center justify-between mb-6">
        <nav aria-label="Ruta de navegación" className="flex items-center gap-2 text-label-md font-label-md text-on-surface-variant">
          <button onClick={onVolverNomina} className="hover:text-secondary transition-colors font-medium">
            Personal &amp; Legajos
          </button>
          <span className="material-symbols-outlined text-[16px] text-outline">chevron_right</span>
          <span className="hover:text-secondary transition-colors">Ficha de Agente</span>
          <span className="material-symbols-outlined text-[16px] text-outline">chevron_right</span>
          <span className="text-primary font-semibold">
            {perfil.nombre} {perfil.apellido} (DNI {perfil.dni || 'S/D'})
          </span>
        </nav>
        {onVolverNomina && (
          <button
            onClick={onVolverNomina}
            className="px-3 py-1.5 border border-outline-variant rounded-lg text-primary hover:bg-surface-container text-label-md font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>Volver a la Nómina</span>
          </button>
        )}
      </div>

      {/* AGENT HERO HEADER CARD */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-sm p-6 mb-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left profile info */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative">
              <img
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl object-cover border-2 border-secondary-fixed shadow-sm bg-surface-container"
                src={
                  perfil.avatar_url ||
                  'https://lh3.googleusercontent.com/aida-public/AB6AXuAjTTppIR2F6oW_ulmXo3rGwcDjOacuczfKYtgkNzfK1c_yQgS0V2nOLXfqEPcmUatT3_8DB1qy4nQeddHyqtSZWayEwFr3dksrCPi3Lnespj3sTSefFpNNjZa-vJh-mVG3iczsKDKKrnlEp0QoXWI4mp1dKaAUAZGBufr3XsCgVEfUfuOdsqpZeLBM1VIA5WRf0ZbhxGgOMiTcWgYRAT9js3pz2lNlW27BzBMMe9x6ymvH3tnUuGCNMQ'
                }
                alt={`${perfil.nombre} ${perfil.apellido}`}
              />
              {stats.vencidos.length > 0 && (
                <span
                  className="absolute -bottom-2 -right-2 bg-error-container text-error text-[10px] font-bold p-1 rounded-full border-2 border-surface-container-lowest flex items-center justify-center"
                  title="Legajo con observaciones prioritarias"
                >
                  <span className="material-symbols-outlined text-[14px]">priority_high</span>
                </span>
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-headline-lg font-headline-lg text-primary tracking-tight">
                  {perfil.nombre} {perfil.apellido}
                </h1>
                {stats.vencidos.length > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error_outline</span>
                    <span>Observado con Vencimiento</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-label-sm font-label-sm bg-[#CCFBF1] text-[#0F766E] border border-teal-200 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>Estado: {perfil.estado.toUpperCase()}</span>
                  </span>
                )}
              </div>

              <p className="text-body-md font-body-md text-on-surface font-medium">
                {perfil.cargo || 'Agente Territorial'} —{' '}
                <span className="text-secondary font-semibold">
                  {perfil.areas?.nombre || 'Área General'}
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-5 mt-3 text-label-md font-label-md text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-outline">badge</span>
                  <span>
                    DNI {perfil.dni || 'Sin DNI'} • Legajo DDNNA #{perfil.legajo || 'S/L'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-outline">domain</span>
                  <span>
                    {perfil.sub_sedes
                      ? `${perfil.sub_sedes.nombre} (${perfil.sub_sedes.localidad || 'Territorio'})`
                      : 'Sede Central'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-outline">calendar_today</span>
                  <span>Alta: {formatearFecha(perfil.fecha_ingreso)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto self-end lg:self-center">
            {puedeEditarPerfil && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-primary hover:bg-surface-container-low text-label-md font-label-md transition-colors shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Editar Datos Personales</span>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary hover:opacity-95 text-label-md font-label-md transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Descargar Legajo Certificado en PDF</span>
            </button>
          </div>
        </div>

        {/* Warning Alert Banner */}
        {(stats.vencidos.length > 0 || stats.porVencer.length > 0) && (
          <div className="mt-6 p-3.5 bg-error-container/40 border border-error-container rounded-lg flex items-start gap-3 text-on-surface">
            <span className="material-symbols-outlined text-error text-[22px] shrink-0 mt-0.5">warning</span>
            <div className="flex-1 text-body-sm font-body-sm">
              <span className="font-bold text-on-error-container">Atención Operativa: </span>
              {stats.vencidos.length > 0 && (
                <span>
                  Hay {stats.vencidos.length} documento(s) vencido(s) (
                  {stats.vencidos.map((v) => v.tipo.nombre).join(', ')}).{' '}
                </span>
              )}
              {stats.porVencer.length > 0 && (
                <span>
                  Hay {stats.porVencer.length} documento(s) próximo(s) a vencer (
                  {stats.porVencer.map((p) => p.tipo.nombre).join(', ')}).
                </span>
              )}
              <span className="block mt-0.5 text-outline">
                Es mandatorio adjuntar los comprobantes de renovación según el Protocolo de Idoneidad Funcional Ley 26.061.
              </span>
            </div>
          </div>
        )}
      </section>

      {/* TAB NAVIGATION */}
      <div className="border-b border-outline-variant mb-6">
        <nav aria-label="Pestañas de legajo" className="flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('docs')}
            className={`py-3 px-1 text-label-lg font-label-lg flex items-center gap-2 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'docs'
                ? 'border-secondary text-secondary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">fact_check</span>
            <span>Documentación Obligatoria &amp; Requisitos</span>
            <span className="bg-secondary text-on-secondary text-[11px] px-2 py-0.5 rounded-full font-bold">
              {stats.subidos}/{stats.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('personal')}
            className={`py-3 px-1 text-label-lg font-label-lg flex items-center gap-2 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'personal'
                ? 'border-secondary text-secondary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">person</span>
            <span>Datos Personales y de Contacto</span>
          </button>

          <button
            onClick={() => setActiveTab('capacitaciones')}
            className={`py-3 px-1 text-label-lg font-label-lg flex items-center gap-2 whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'capacitaciones'
                ? 'border-secondary text-secondary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">school</span>
            <span>Historial de Capacitaciones &amp; Talleres</span>
            <span className="bg-surface-container text-on-surface-variant text-[11px] px-2 py-0.5 rounded-full font-bold">
              {capacitaciones.length}
            </span>
          </button>

          {puedeEditarPerfil && (
            <button
              onClick={() => setActiveTab('familia')}
              className={`py-3 px-1 text-label-lg font-label-lg flex items-center gap-2 whitespace-nowrap transition-colors border-b-2 ${
                activeTab === 'familia'
                  ? 'border-secondary text-secondary font-bold'
                  : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">family_restroom</span>
              <span>Grupo Familiar</span>
              <span className="bg-surface-container text-on-surface-variant text-[11px] px-2 py-0.5 rounded-full font-bold">
                {familiares.length}
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* TAB CONTENT: 1. DOCUMENTACIÓN */}
      {activeTab === 'docs' && (
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-headline-md font-headline-md text-primary tracking-tight">
                Documentación Legal e Institucional
              </h2>
              <p className="text-body-sm font-body-sm text-on-surface-variant">
                Archivos probatorios reglamentarios bajo supervisión de Recursos Humanos y Asuntos Jurídicos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-label-sm font-label-sm text-on-surface-variant">Cumplimiento General:</span>
              <div className="w-32 bg-surface-container rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-secondary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${stats.porcentaje}%` }}
                ></div>
              </div>
              <span className="text-label-sm font-label-sm font-bold text-secondary">
                {stats.validados} / {stats.total} Validados
              </span>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-label-sm font-label-sm text-secondary mb-4">
            <span className="material-symbols-outlined text-[16px]">drag_pan</span>
            Podés arrastrar un archivo directo sobre cualquier tarjeta para cargarlo.
          </p>

          {/* Grid de Documentos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documentosCatalogados.map((item) => {
              const { tipo, documento, estadoDerivado, badgeTexto } = item;

              const isVencido = estadoDerivado === 'vencido';
              const isPorVencer = estadoDerivado === 'por_vencer';
              const isAprobado = estadoDerivado === 'aprobado';
              const isPendiente = estadoDerivado === 'pendiente';

              const permiteSubida =
                !documento?.archivo_path ||
                puedeEditarPerfil ||
                documento.estado === 'rechazado' ||
                documento.estado === 'pendiente';
              const arrastrando = dragOverTipoId === tipo.id;

              return (
                <div
                  key={tipo.id}
                  onDragOver={
                    permiteSubida
                      ? (e) => {
                          e.preventDefault();
                          setDragOverTipoId(tipo.id);
                        }
                      : undefined
                  }
                  onDragLeave={
                    permiteSubida
                      ? (e) => {
                          e.preventDefault();
                          setDragOverTipoId((prev) => (prev === tipo.id ? null : prev));
                        }
                      : undefined
                  }
                  onDrop={permiteSubida ? (e) => handleDropArchivo(e, tipo.id) : undefined}
                  className={`bg-surface-container-lowest rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative overflow-hidden ${
                    arrastrando
                      ? 'border-2 border-dashed border-secondary ring-4 ring-secondary-container/30 bg-secondary-fixed/10'
                      : isVencido
                      ? 'border-2 border-error/50'
                      : isPorVencer
                      ? 'border border-amber-300'
                      : 'border border-outline-variant/60'
                  }`}
                >
                  {arrastrando && (
                    // pointer-events-none es clave acá: sin esto, al aparecer este overlay el
                    // mouse queda "sobre" un hijo nuevo en vez de sobre la tarjeta, dispara
                    // dragleave en la tarjeta, el overlay se oculta, vuelve a disparar
                    // dragenter... y titila sin parar — en esa inestabilidad el drop a veces
                    // no llega a tiempo al handler y el navegador abre el archivo solo.
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-surface-container-lowest/95 text-secondary pointer-events-none">
                      <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                      <span className="text-label-md font-label-md font-bold">Soltá el archivo para cargarlo</span>
                    </div>
                  )}
                  {isVencido && <div className="absolute top-0 left-0 right-0 h-1 bg-error"></div>}
                  {isPorVencer && <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400"></div>}

                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isVencido
                            ? 'bg-error-container text-error'
                            : isPorVencer
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-surface-container text-primary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[24px]">
                          {tipo.nombre.toLowerCase().includes('dni')
                            ? 'id_card'
                            : tipo.nombre.toLowerCase().includes('título') ||
                              tipo.nombre.toLowerCase().includes('estudios')
                            ? 'school'
                            : tipo.nombre.toLowerCase().includes('penales')
                            ? 'gavel'
                            : tipo.nombre.toLowerCase().includes('apto')
                            ? 'health_and_safety'
                            : tipo.nombre.toLowerCase().includes('incompatibilidad')
                            ? 'draw'
                            : 'description'}
                        </span>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-label-sm font-label-sm flex items-center gap-1 font-bold ${
                          isVencido
                            ? 'bg-error-container text-on-error-container'
                            : isPorVencer
                            ? 'bg-amber-100 text-amber-800'
                            : isAprobado
                            ? 'bg-[#CCFBF1] text-[#0F766E]'
                            : isPendiente
                            ? 'bg-surface-container text-outline'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isVencido
                            ? 'cancel'
                            : isPorVencer
                            ? 'schedule'
                            : isAprobado
                            ? 'check_circle'
                            : isPendiente
                            ? 'pending'
                            : 'info'}
                        </span>
                        <span>{badgeTexto}</span>
                      </span>
                    </div>

                    <h3 className="text-headline-sm font-headline-sm text-primary mb-1">{tipo.nombre}</h3>
                    <p className="text-body-sm font-body-sm text-on-surface-variant mb-3">
                      {tipo.descripcion || 'Documentación reglamentaria de legajo institucional.'}
                    </p>

                    <div className="text-label-sm font-label-sm text-outline flex items-center gap-1 mb-4">
                      <span className="material-symbols-outlined text-[14px]">
                        {isAprobado ? 'verified' : 'schedule'}
                      </span>
                      <span>
                        {documento?.fecha_vencimiento
                          ? `Vence: ${formatearFecha(documento.fecha_vencimiento)}`
                          : tipo.vigencia_meses
                          ? `Vigencia: Cada ${tipo.vigencia_meses} meses`
                          : 'No requiere renovación periódica'}
                      </span>
                    </div>

                    {estadoDerivado === 'rechazado' && documento?.comentarios && (
                      <p className="text-label-sm font-label-sm text-error bg-error-container/30 rounded-lg px-2.5 py-1.5 mb-4 -mt-2">
                        Motivo del rechazo: {documento.comentarios}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between gap-2">
                    {documento?.archivo_path ? (
                      <>
                        <button
                          onClick={() => handleVerDocumento(documento.archivo_path!, documento.archivo_nombre || tipo.nombre)}
                          className="flex items-center gap-1 text-label-md font-label-md text-secondary hover:underline"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          <span>Ver archivo</span>
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleDescargarDocumento(
                                documento.archivo_path!,
                                documento.archivo_nombre || `${tipo.nombre}.pdf`
                              )
                            }
                            className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant"
                            title="Descargar documento"
                          >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                          </button>
                          {(puedeEditarPerfil || documento.estado === 'rechazado' || documento.estado === 'pendiente') && (
                            <button
                              onClick={() => triggerUpload(tipo.id)}
                              className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant"
                              title="Reemplazar archivo (o arrastrá uno nuevo sobre la tarjeta)"
                            >
                              <span className="material-symbols-outlined text-[18px]">upload_file</span>
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerUpload(tipo.id)}
                        className={`w-full flex flex-col items-center justify-center gap-1 py-4 px-3 rounded-lg border-2 border-dashed transition-colors ${
                          arrastrando
                            ? 'border-secondary bg-secondary-fixed/20'
                            : 'border-outline-variant/70 hover:border-secondary hover:bg-surface-container-low'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[22px] text-secondary pointer-events-none">cloud_upload</span>
                        <span className="text-label-sm font-label-sm font-bold text-primary pointer-events-none">Arrastrá el archivo aquí</span>
                        <span className="text-label-sm font-label-sm text-outline pointer-events-none">o hacé clic para seleccionar</span>
                      </button>
                    )}
                  </div>

                  {puedeValidar && estadoDerivado === 'cargado' && documento && (
                    <div className="pt-3 mt-3 border-t border-outline-variant/40 flex items-center gap-2">
                      <button
                        onClick={() => handleAprobar(documento.id)}
                        disabled={validandoId === documento.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#CCFBF1] text-[#0F766E] hover:opacity-90 text-label-sm font-label-sm font-bold transition-opacity disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Aprobar</span>
                      </button>
                      <button
                        onClick={() => abrirRechazo(documento.id, tipo.nombre)}
                        disabled={validandoId === documento.id}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-error-container text-on-error-container hover:opacity-90 text-label-sm font-label-sm font-bold transition-opacity disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">cancel</span>
                        <span>Rechazar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB CONTENT: 2. DATOS PERSONALES */}
      {activeTab === 'personal' && (
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-sm p-6 mb-10">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/40 mb-6">
            <h2 className="text-headline-md font-headline-md text-primary">Información General del Agente</h2>
            {puedeEditarPerfil && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container text-primary rounded-lg text-label-md font-label-md hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
                <span>Editar Datos</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Nombre y Apellido</p>
              <p className="text-body-md font-semibold text-primary">{perfil.nombre} {perfil.apellido}</p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Documento Nacional de Identidad (DNI)</p>
              <p className="text-body-md font-semibold text-primary">{perfil.dni || 'No registrado'}</p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Correo Electrónico Institucional</p>
              <p className="text-body-md font-semibold text-primary">{perfil.email}</p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Teléfono de Contacto</p>
              <p className="text-body-md font-semibold text-primary">{perfil.telefono || 'No registrado'}</p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Cargo / Función</p>
              <p className="text-body-md font-semibold text-primary">{perfil.cargo || 'No asignado'}</p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Área Orgánica</p>
              <p className="text-body-md font-semibold text-primary">{perfil.areas?.nombre || 'Sede Central'}</p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Sub-Sede Territorial</p>
              <p className="text-body-md font-semibold text-primary">
                {perfil.sub_sedes ? `${perfil.sub_sedes.nombre} (${perfil.sub_sedes.localidad || 'Territorio'})` : 'Sede Central'}
              </p>
            </div>
            <div className="bg-surface-container-low/40 p-4 rounded-xl border border-outline-variant/40">
              <p className="text-label-sm text-outline">Observaciones de Legajo</p>
              <p className="text-body-md font-semibold text-primary">{perfil.observaciones_legajo || 'Sin observaciones'}</p>
            </div>
          </div>
        </section>
      )}

      {/* TAB CONTENT: 3. CAPACITACIONES */}
      {activeTab === 'capacitaciones' && (
        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 shadow-sm p-6 mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-outline-variant/40 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[24px]">history_edu</span>
                <h2 className="text-headline-md font-headline-md text-primary tracking-tight">
                  Historial de Capacitaciones &amp; Formación DDNNA
                </h2>
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
                Créditos de formación obligatorios y talleres de actualización territorial completados.
              </p>
            </div>
          </div>

          {capacitaciones.length === 0 ? (
            <p className="text-on-surface-variant text-body-md py-6 text-center">
              No hay capacitaciones registradas para este agente aún.
            </p>
          ) : (
            <div className="relative pl-6 border-l-2 border-secondary/30 space-y-6">
              {capacitaciones.map((cap) => (
                <div key={cap.capacitacion_id} className="relative group">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-secondary border-4 border-surface-container-lowest shadow-sm"></div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface-container-low/40 hover:bg-surface-container-low p-4 rounded-xl border border-outline-variant/40 transition-colors">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[22px]">verified</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-headline-sm font-headline-sm text-primary">{cap.nombre}</h4>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#CCFBF1] text-[#0F766E]">
                            {cap.asistio ? 'Certificado de Aprobación' : 'Inscripto'}
                          </span>
                        </div>
                        <p className="text-body-sm font-body-sm text-on-surface-variant">
                          Dictado por {cap.entidad_dictante || cap.capacitador || 'DDNNA'}. Modalidad: {cap.modalidad || 'Presencial'}. Carga horaria: {cap.carga_horaria ? `${cap.carga_horaria} hs` : 'S/D'}.
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-label-sm font-label-sm text-outline">
                          <span>Finalizado: {formatearFecha(cap.fecha)}</span>
                          {cap.codigo_acreditacion && (
                            <>
                              <span>•</span>
                              <span>Acreditación Código: #{cap.codigo_acreditacion}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {cap.certificado_url && (
                      <div className="flex items-center gap-2 self-end md:self-center">
                        <a
                          href={cap.certificado_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant text-label-sm font-label-sm text-primary hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">workspace_premium</span>
                          <span>Ver Certificado</span>
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB CONTENT: 4. GRUPO FAMILIAR */}
      {activeTab === 'familia' && puedeEditarPerfil && (
        <section className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/40 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[24px]">family_restroom</span>
                <h2 className="text-headline-md font-headline-md text-primary tracking-tight">
                  Grupo Familiar
                </h2>
              </div>
              <p className="text-body-sm font-body-sm text-on-surface-variant mt-0.5">
                Integrantes del grupo conviviente y familiares a cargo con documentación probatoria de DNI.
              </p>
            </div>

            {puedeEditarPerfil && (
              <button
                type="button"
                onClick={handleAbrirAgregarFamiliar}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg text-label-md font-label-md hover:opacity-95 transition-opacity shadow-sm self-start sm:self-center"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>+ Agregar Familiar</span>
              </button>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-label-sm font-label-sm text-secondary mb-4">
            <span className="material-symbols-outlined text-[16px]">drag_pan</span>
            Podés arrastrar la foto del frente o dorso directo sobre el espacio correspondiente para cargarla.
          </p>

          {familiares.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/60 p-8 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-outline mb-3">
                <span className="material-symbols-outlined text-[36px]">family_restroom</span>
              </div>
              <h3 className="text-headline-sm font-headline-sm text-primary mb-1">
                Todavía no se cargó ningún familiar
              </h3>
              <p className="text-body-sm font-body-sm text-on-surface-variant max-w-md mb-5">
                {puedeEditarPerfil
                  ? 'Podés registrar los integrantes del grupo familiar y cargar las fotos de frente y dorso de sus DNI.'
                  : 'No hay familiares registrados en el legajo de este agente.'}
              </p>
              {puedeEditarPerfil && (
                <button
                  type="button"
                  onClick={handleAbrirAgregarFamiliar}
                  className="flex items-center gap-2 px-4 py-2 bg-secondary text-on-secondary rounded-lg text-label-md font-label-md hover:opacity-95 transition-opacity shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  <span>+ Agregar Familiar</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {familiares.map((familiar) => {
                const renderDniSlot = (lado: 'frente' | 'dorso') => {
                  const fotoPath = lado === 'frente' ? familiar.foto_dni_frente_path : familiar.foto_dni_dorso_path;
                  const slotKey = `${familiar.id}_${lado}`;
                  const arrastrando = dragOverSlotKey === slotKey;
                  const subiendo = uploadingSlotKey === slotKey;
                  const ladoLabel = lado === 'frente' ? 'Frente' : 'Dorso';

                  return (
                    <div
                      key={lado}
                      onDragOver={
                        puedeEditarPerfil
                          ? (e) => {
                              e.preventDefault();
                              setDragOverSlotKey(slotKey);
                            }
                          : undefined
                      }
                      onDragLeave={
                        puedeEditarPerfil
                          ? (e) => {
                              e.preventDefault();
                              setDragOverSlotKey((prev) => (prev === slotKey ? null : prev));
                            }
                          : undefined
                      }
                      onDrop={
                        puedeEditarPerfil
                          ? (e) => handleDropFamiliar(e, familiar.id, lado)
                          : undefined
                      }
                      className={`p-3 rounded-lg border relative overflow-hidden flex flex-col justify-between min-h-[115px] transition-colors ${
                        arrastrando
                          ? 'border-2 border-dashed border-secondary ring-2 ring-secondary-container/30 bg-secondary-fixed/10'
                          : fotoPath
                          ? 'bg-surface-container-lowest border-outline-variant/60'
                          : 'bg-surface-container-low/30 border-outline-variant/40'
                      }`}
                    >
                      {/* Overlay al arrastrar con pointer-events-none */}
                      {arrastrando && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-surface-container-lowest/95 text-secondary pointer-events-none">
                          <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                          <span className="text-label-sm font-label-sm font-bold">Soltá el archivo para cargarlo</span>
                        </div>
                      )}

                      {/* Overlay de subida */}
                      {subiendo && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-surface-container-lowest/95 text-secondary">
                          <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-label-sm font-bold">Subiendo foto...</span>
                        </div>
                      )}

                      {/* Cabecera del espacio */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5 text-label-sm font-label-sm font-bold text-primary">
                          <span className="material-symbols-outlined text-[16px] text-outline">badge</span>
                          <span>DNI — {ladoLabel}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                            fotoPath
                              ? 'bg-[#CCFBF1] text-[#0F766E]'
                              : 'bg-surface-container text-outline'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            {fotoPath ? 'check_circle' : 'pending'}
                          </span>
                          <span>{fotoPath ? 'Cargado' : 'Pendiente'}</span>
                        </span>
                      </div>

                      {/* Contenido / Botón */}
                      {fotoPath ? (
                        <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-outline-variant/30">
                          <button
                            type="button"
                            onClick={() =>
                              handleVerFotoFamiliar(
                                fotoPath,
                                `DNI ${ladoLabel} — ${familiar.nombre} ${familiar.apellido}`
                              )
                            }
                            className="flex items-center gap-1 text-label-sm font-label-sm text-secondary hover:underline font-semibold"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>Ver archivo</span>
                          </button>
                          {puedeEditarPerfil && (
                            <button
                              type="button"
                              onClick={() => triggerUploadFamiliar(familiar.id, lado)}
                              className="p-1 rounded hover:bg-surface-container text-on-surface-variant transition-colors"
                              title="Reemplazar foto (o arrastrá una nueva sobre este espacio)"
                            >
                              <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={puedeEditarPerfil ? () => triggerUploadFamiliar(familiar.id, lado) : undefined}
                          className={`w-full flex flex-col items-center justify-center gap-0.5 py-3 px-2 rounded-lg border-2 border-dashed transition-colors mt-auto ${
                            arrastrando
                              ? 'border-secondary bg-secondary-fixed/20'
                              : puedeEditarPerfil
                              ? 'border-outline-variant/70 hover:border-secondary hover:bg-surface-container-low cursor-pointer'
                              : 'border-outline-variant/40 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[20px] text-secondary pointer-events-none">
                            cloud_upload
                          </span>
                          <span className="text-label-sm font-label-sm font-bold text-primary pointer-events-none">
                            Arrastrá el archivo aquí
                          </span>
                          <span className="text-[11px] text-outline pointer-events-none">
                            o hacé clic para seleccionar
                          </span>
                        </button>
                      )}
                    </div>
                  );
                };

                return (
                  <div
                    key={familiar.id}
                    className="bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/60 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-headline-sm font-headline-sm text-primary">
                            {familiar.nombre} {familiar.apellido}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-label-sm font-label-sm font-bold bg-secondary-fixed/30 text-secondary border border-secondary/20">
                            {PARENTESCO_LABELS[familiar.parentesco] || familiar.parentesco}
                          </span>
                        </div>

                        {puedeEditarPerfil && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAbrirEditarFamiliar(familiar)}
                              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                              title="Editar familiar"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarFamiliar(familiar)}
                              className="p-1.5 rounded-lg hover:bg-error-container text-outline hover:text-error transition-colors"
                              title="Eliminar familiar"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-label-md font-label-md text-on-surface-variant mb-4">
                        <span className="material-symbols-outlined text-[16px] text-outline">badge</span>
                        <span>
                          DNI: <strong className="text-primary">{familiar.dni || 'Sin registrar'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Espacios DNI Frente / Dorso */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-outline-variant/40">
                      {renderDniSlot('frente')}
                      {renderDniSlot('dorso')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* MODAL */}
      {perfil && (
        <EditarPerfilModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          perfil={perfil}
          esGestion={esGestion}
          onSave={handleSavePerfil}
        />
      )}

      {/* MODAL FAMILIAR */}
      <FamiliarModal
        isOpen={isFamiliarModalOpen}
        onClose={() => {
          setIsFamiliarModalOpen(false);
          setFamiliarAEditar(null);
        }}
        familiar={familiarAEditar}
        onSave={handleGuardarFamiliar}
      />

      {/* VISOR DE ARCHIVOS — sin salir de la app */}
      {visor && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setVisor(null)}
        >
          <div
            className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-outline-variant">
              <span className="text-label-md font-label-md font-bold text-primary truncate">{visor.nombre}</span>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={visor.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-label-sm font-label-sm text-secondary hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  Abrir en pestaña nueva
                </a>
                <button
                  onClick={() => setVisor(null)}
                  className="p-1.5 rounded hover:bg-surface-container text-on-surface-variant"
                  title="Cerrar"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-surface-container overflow-auto flex items-center justify-center p-2">
              {visor.esImagen ? (
                <img src={visor.url} alt={visor.nombre} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={visor.url} title={visor.nombre} className="w-full h-full border-0 rounded" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECHAZO — motivo obligatorio, mismo criterio que capacitaciones y notas de pedido */}
      {rechazoTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setRechazoTarget(null)}
        >
          <div
            className="bg-surface-container-lowest dark:bg-surface rounded-xl border border-outline-variant max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-headline-sm font-headline-sm text-primary mb-1">Rechazar documento</h2>
            <p className="text-body-sm font-body-sm text-on-surface-variant mb-4">
              {rechazoTarget.tipoNombre} — indicá por qué se rechaza. El agente verá este motivo y va a poder volver a subir el archivo.
            </p>
            <textarea
              autoFocus
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={3}
              placeholder="Ej: la fecha de emisión no es legible, falta la firma..."
              className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <div className="flex items-center justify-end gap-3 mt-5">
              <button
                onClick={() => setRechazoTarget(null)}
                className="px-4 py-2 rounded-lg text-label-md font-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRechazo}
                disabled={validandoId === rechazoTarget.documentoId}
                className="px-4 py-2 rounded-lg bg-error text-on-error text-label-md font-label-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-8 text-center text-label-sm font-label-sm text-outline">
        Sistema Integral de Gestión Territorial DDNNA — Registro Oficial de Idoneidad Funcional • República Argentina
      </footer>
    </div>
  );
};
