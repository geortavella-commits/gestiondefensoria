import { Sidebar, type MainNavSection } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LegajoDigital } from './components/legajo/LegajoDigital';
import { NominaPersonal } from './components/personal/NominaPersonal';
import { GestionUsuarios } from './components/usuarios/GestionUsuarios';
import { SubSedesTerritoriales } from './components/subsedes/SubSedesTerritoriales';
import { CapacitacionesTerritoriales } from './components/capacitaciones/CapacitacionesTerritoriales';
import { ReportesInstitucionales } from './components/reportes/ReportesInstitucionales';
import { TableroControl } from './components/tablero/TableroControl';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { logoutUser } from './services/auth';
import { useAuthSession } from './hooks/useAuthSession';
import { useState } from 'react';

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
            />
          ) : activeSection === 'capacitaciones' ? (
            <CapacitacionesTerritoriales currentUserId={currentUserId || selectedProfileId} perfilActual={perfilSeleccionado} />
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
                currentUserRole={currentUserRole}
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
