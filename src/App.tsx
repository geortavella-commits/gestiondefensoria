import { Sidebar, type MainNavSection } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { VistaPreviaSelector, type VistaPreviaEstado } from './components/layout/VistaPreviaSelector';
import { LegajoDigital } from './components/legajo/LegajoDigital';
import { DocumentacionAlertas } from './components/documentacion/DocumentacionAlertas';
import { ActividadesTerritoriales } from './components/actividades/ActividadesTerritoriales';
import { NominaPersonal } from './components/personal/NominaPersonal';
import { GestionUsuarios } from './components/usuarios/GestionUsuarios';
import { SubSedesTerritoriales } from './components/subsedes/SubSedesTerritoriales';
import { CapacitacionesTerritoriales } from './components/capacitaciones/CapacitacionesTerritoriales';
import { ReportesInstitucionales } from './components/reportes/ReportesInstitucionales';
import { NotasPedido } from './components/notas/NotasPedido';
import { Vacaciones } from './components/vacaciones/Vacaciones';
import { TableroControl } from './components/tablero/TableroControl';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { logoutUser } from './services/auth';
import { esRolGestion } from './services/legajo';
import { getAreasYSubSedes } from './services/organizacion';
import { useAuthSession } from './hooks/useAuthSession';
import { seccionesVisibles, seccionPorDefecto } from './utils/permisos';
import type { Area, SubSede } from './types/legajo';
import { useEffect, useMemo, useState } from 'react';

export function App() {
  const {
    authView,
    setAuthView,
    listaPerfiles,
    selectedProfileId,
    selectProfile,
    currentUserId,
    currentUserRole,
    loading,
    error: dbError,
  } = useAuthSession();

  const [activeSection, setActiveSection] = useState<MainNavSection>('tablero');
  const [personalSubView, setPersonalSubView] = useState<'nomina' | 'legajo'>('nomina');

  const [vistaPrevia, setVistaPrevia] = useState<VistaPreviaEstado | null>(null);
  const [catalogoOrganizacion, setCatalogoOrganizacion] = useState<{ areas: Area[]; subSedes: SubSede[] }>({
    areas: [],
    subSedes: [],
  });

  const esGestionReal = esRolGestion(currentUserRole);

  // Catálogo de áreas/sub-sedes para el selector de vista previa. Solo hace
  // falta para gestión, que es quien puede usarlo.
  useEffect(() => {
    if (!esGestionReal) return;
    getAreasYSubSedes()
      .then(setCatalogoOrganizacion)
      .catch((err) => console.error('No se pudo cargar el catálogo de áreas/sub-sedes:', err));
  }, [esGestionReal]);

  // Rol/perfil "efectivo": el real, salvo que gestión esté simulando otro
  // rol para revisar visibilidades. Las consultas a Supabase siguen yendo
  // con la sesión real — esto solo decide qué se muestra en pantalla.
  const rolEfectivo = vistaPrevia?.rol ?? currentUserRole;

  const perfilReal = listaPerfiles.find((p) => p.id === currentUserId) ?? null;

  const perfilEfectivo = useMemo(() => {
    if (!vistaPrevia || !perfilReal) return perfilReal;
    const areaSimulada = vistaPrevia.areaId
      ? catalogoOrganizacion.areas.find((a) => a.id === vistaPrevia.areaId) ?? null
      : null;
    const subSedeSimulada = vistaPrevia.subSedeId
      ? catalogoOrganizacion.subSedes.find((s) => s.id === vistaPrevia.subSedeId) ?? null
      : null;
    return {
      ...perfilReal,
      rol: vistaPrevia.rol,
      area_id: vistaPrevia.areaId,
      sub_sede_id: vistaPrevia.subSedeId,
      areas: areaSimulada,
      sub_sedes: subSedeSimulada,
    };
  }, [vistaPrevia, perfilReal, catalogoOrganizacion]);

  const seccionesVisiblesActuales = useMemo(() => seccionesVisibles(rolEfectivo), [rolEfectivo]);

  // Nómina de Personal filtra por nombre de área o id de sub-sede (no por
  // rol), así que la vista previa tiene que fijar esos mismos valores para
  // que el listado quede acotado a lo que ese rol vería de verdad.
  const filtroNominaVistaPrevia = useMemo(() => {
    if (!vistaPrevia) return null;
    if (vistaPrevia.rol === 'jefe_area' && vistaPrevia.areaId) {
      const area = catalogoOrganizacion.areas.find((a) => a.id === vistaPrevia.areaId);
      if (!area) return null;
      return { areaNombre: area.nombre, subSedeId: null, etiqueta: `Jefe de Área — ${area.nombre}` };
    }
    if (vistaPrevia.rol === 'referente_subsede' && vistaPrevia.subSedeId) {
      const subSede = catalogoOrganizacion.subSedes.find((s) => s.id === vistaPrevia.subSedeId);
      if (!subSede) return null;
      return { areaNombre: null, subSedeId: vistaPrevia.subSedeId, etiqueta: `Referente de Sub-Sede — ${subSede.nombre}` };
    }
    return null;
  }, [vistaPrevia, catalogoOrganizacion]);

  // Si al cambiar de rol (real o simulado) la sección activa deja de ser
  // visible para ese rol, volvemos a una sección permitida en vez de dejar
  // la pantalla en blanco.
  useEffect(() => {
    if (!seccionesVisiblesActuales.includes(activeSection)) {
      setActiveSection(seccionPorDefecto(rolEfectivo));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccionesVisiblesActuales]);

  // Sin esto, si un archivo se suelta fuera de una zona de carga válida (o un
  // pixel afuera de la tarjeta), el navegador lo abre como página propia y se
  // pierde todo el estado de la app. Las zonas de carga (LegajoDigital) igual
  // manejan su propio preventDefault para procesar el archivo.
  useEffect(() => {
    const prevenirAperturaDeArchivo = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', prevenirAperturaDeArchivo);
    window.addEventListener('drop', prevenirAperturaDeArchivo);
    return () => {
      window.removeEventListener('dragover', prevenirAperturaDeArchivo);
      window.removeEventListener('drop', prevenirAperturaDeArchivo);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setAuthView('login');
    } catch (err: any) {
      alert('Error al cerrar sesión: ' + err.message);
    }
  };

  const handleVerLegajoDesdeUsuarios = (profileId: string) => {
    selectProfile(profileId);
    setPersonalSubView('legajo');
    setActiveSection('personal');
  };

  const perfilSeleccionado = listaPerfiles.find((p) => p.id === selectedProfileId);

  // Pantalla de carga inicial
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-on-surface">
        <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-headline-sm font-semibold text-primary">Iniciando Portal DDNNA...</h2>
        <p className="text-body-sm text-on-surface-variant mt-1">Verificando credenciales institucionales</p>
      </div>
    );
  }

  // Vista 1: Login
  if (authView === 'login') {
    return (
      <LoginPage
        onSuccess={() => setAuthView('app')}
        onNavigateToRegister={() => setAuthView('register')}
        onBypassDemo={() => setAuthView('app')}
      />
    );
  }

  // Vista 2: Registro
  if (authView === 'register') {
    return (
      <RegisterPage
        onSuccess={() => setAuthView('app')}
        onNavigateToLogin={() => setAuthView('login')}
      />
    );
  }

  // Vista 3: Aplicación Principal
  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md flex">
      {/* SIDEBAR INSTITUCIONAL */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={(sec) => setActiveSection(sec)}
        onLogout={handleLogout}
        visibleSections={seccionesVisiblesActuales}
      />

      {/* ÁREA PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR */}
        <Header
          perfilActual={perfilSeleccionado}
          listaPerfiles={listaPerfiles}
          selectedId={selectedProfileId}
          onLogout={handleLogout}
          onSelectAgente={(id) => selectProfile(id)}
        />

        {esGestionReal && (
          <div className="pl-64">
            <VistaPreviaSelector
              areas={catalogoOrganizacion.areas}
              subSedes={catalogoOrganizacion.subSedes}
              activo={vistaPrevia}
              onCambiar={setVistaPrevia}
            />
          </div>
        )}

        {/* WORKSPACE CANVAS */}
        <main className="pl-64 flex-1 pb-16">
          {dbError ? (
            <div className="max-w-[1440px] mx-auto px-gutter pt-6">
              <div className="bg-error-container text-on-error-container p-6 rounded-xl border border-error">
                <h2 className="text-headline-md font-bold mb-2">Error de Conexión a Base de Datos</h2>
                <p className="text-body-md">{dbError}</p>
                <p className="text-label-sm mt-3 text-on-surface-variant">
                  Verificá que las tablas de la migración estén aplicadas en Supabase y que <code className="font-mono">.env.local</code> esté configurado.
                </p>
              </div>
            </div>
          ) : activeSection === 'tablero' ? (
            <TableroControl
              onNavigateToPersonal={() => setActiveSection('personal')}
              onNavigateToSubSedes={() => setActiveSection('subsedes')}
              onNavigateToCapacitaciones={() => setActiveSection('capacitaciones')}
              onNavigateToDocumentacion={() => setActiveSection('documentacion')}
              onNavigateToReportes={() => setActiveSection('reportes')}
              onNuevoAgente={() => setActiveSection('configuracion')}
              onNavigateToActividades={() => setActiveSection('actividades')}
            />
          ) : activeSection === 'capacitaciones' ? (
            <CapacitacionesTerritoriales perfilActual={perfilEfectivo} />
          ) : activeSection === 'actividades' ? (
            <ActividadesTerritoriales perfilActual={perfilEfectivo} />
          ) : activeSection === 'notas' ? (
            <NotasPedido perfilActual={perfilEfectivo} />
          ) : activeSection === 'vacaciones' ? (
            <Vacaciones perfilActual={perfilEfectivo} />
          ) : activeSection === 'documentacion' ? (
            <DocumentacionAlertas
              currentUserId={currentUserId}
              perfilActual={perfilEfectivo}
              onVerLegajo={(id) => {
                selectProfile(id);
                setPersonalSubView('legajo');
                setActiveSection('personal');
              }}
            />
          ) : activeSection === 'reportes' ? (
            <ReportesInstitucionales
              onVerLegajos={() => setActiveSection('personal')}
              onVerCapacitaciones={() => setActiveSection('capacitaciones')}
              onVerSubSedes={() => setActiveSection('subsedes')}
              onVerAlertas={() => setActiveSection('documentacion')}
            />
          ) : activeSection === 'subsedes' ? (
            <SubSedesTerritoriales
              onVerPersonalSede={(subSedeId) => {
                const match = listaPerfiles.find((p) => p.sub_sede_id === subSedeId);
                if (match) {
                  selectProfile(match.id);
                  setActiveSection('personal');
                } else {
                  setActiveSection('configuracion');
                }
              }}
            />
          ) : activeSection === 'configuracion' ? (
            <GestionUsuarios onVerLegajo={handleVerLegajoDesdeUsuarios} />
          ) : activeSection === 'personal' ? (
            personalSubView === 'legajo' && selectedProfileId ? (
              <LegajoDigital
                profileId={selectedProfileId}
                currentUserId={currentUserId || selectedProfileId}
                currentUserRole={rolEfectivo}
                onVolverNomina={() => setPersonalSubView('nomina')}
              />
            ) : (
              <NominaPersonal
                onVerLegajo={(id) => {
                  selectProfile(id);
                  setPersonalSubView('legajo');
                }}
                onCrearAgente={() => setActiveSection('configuracion')}
                onEditarAgente={(id) => {
                  selectProfile(id);
                  setPersonalSubView('legajo');
                }}
                filtroForzado={filtroNominaVistaPrevia}
              />
            )
          ) : (
            <div className="max-w-[1440px] mx-auto px-gutter pt-12 text-center text-outline">
              <span className="material-symbols-outlined text-4xl mb-2 text-secondary">construction</span>
              <h2 className="text-headline-md font-bold text-primary">Sección en Construcción</h2>
              <p className="text-body-md text-on-surface-variant mt-1">
                Seleccioná una sección activa en el menú lateral.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
