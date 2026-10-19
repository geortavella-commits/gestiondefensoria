import React from 'react';

export type MainNavSection = 'tablero' | 'personal' | 'subsedes' | 'capacitaciones' | 'actividades' | 'notas' | 'vacaciones' | 'documentacion' | 'reportes' | 'configuracion';

interface Props {
  activeSection: MainNavSection;
  onNavigate: (section: MainNavSection) => void;
  onLogout?: () => void;
  visibleSections: MainNavSection[];
}

export const Sidebar: React.FC<Props> = ({ activeSection, onNavigate, onLogout, visibleSections }) => {
  const ver = (section: MainNavSection) => visibleSections.includes(section);
  return (
    <aside className="fixed left-0 top-0 h-screen w-64 z-50 flex flex-col justify-between py-space-md px-space-sm bg-surface-container-lowest dark:bg-surface border-r border-outline-variant dark:border-outline shadow-sm">
      <div className="flex flex-col gap-y-4">
        {/* Header / Logo Institucional */}
        <div className="flex items-center gap-3 px-space-sm py-2">
          <img
            alt="Escudo oficial de la Defensoría de Niñas, Niños y Adolescentes"
            className="w-10 h-10 object-contain rounded-lg"
            src="https://lh3.googleusercontent.com/aida/AEtjO1XB-J1k1FR45w_IvnwIbxFMT6U74_p4X3nqn4xN2_V3uTyOUu7T6GyZtYVp5Rb7M6LHBG5hm7SemlmPAEmp25foWHmVSKP_KGQb5Pz11PkRJyrCzyTAyrUFWctin8lzcNlzJ6op3Nh06CnLuagQeskQJ8dMa1hUTJg1VvI8gCioPsKNtwu0CiYGEXI7xGFscKTSTXkXYvFOlsjn5mUROxbcoFxtNNFa8bkG9l_xFOPuR-gsN0t_WMDsJHE"
          />
          <div className="flex flex-col">
            <span className="text-headline-md font-headline-md font-bold text-primary dark:text-primary-fixed leading-tight">DDNNA</span>
            <span className="text-label-sm font-label-sm text-on-surface-variant tracking-wider">Gestión Territorial</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 mt-2">
          {/* 1. Tablero de Control */}
          {ver('tablero') && (
          <button
            onClick={() => onNavigate('tablero')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'tablero'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span>Tablero de Control</span>
          </button>
          )}

          {/* 2. Personal & Legajos */}
          {ver('personal') && (
          <button
            onClick={() => onNavigate('personal')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'personal'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${activeSection === 'personal' ? 'text-secondary' : ''}`}
              style={{ fontVariationSettings: activeSection === 'personal' ? "'FILL' 1" : "'FILL' 0" }}
            >
              folder_shared
            </span>
            <span className={activeSection === 'personal' ? 'font-semibold' : ''}>Personal &amp; Legajos</span>
          </button>
          )}

          {/* 3. Sub-Sedes Territoriales */}
          {ver('subsedes') && (
          <button
            onClick={() => onNavigate('subsedes')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'subsedes'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">domain</span>
            <span>Sub-Sedes Territoriales</span>
          </button>
          )}

          {/* 4. Talleres & Capacitaciones */}
          {ver('capacitaciones') && (
          <button
            onClick={() => onNavigate('capacitaciones')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'capacitaciones'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">school</span>
            <span>Talleres &amp; Capacitaciones</span>
          </button>
          )}

          {/* Actividades Territoriales */}
          {ver('actividades') && (
          <button
            onClick={() => onNavigate('actividades')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'actividades'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">groups</span>
            <span>Actividades Territoriales</span>
          </button>
          )}

          {/* Notas de Pedido */}
          {ver('notas') && (
          <button
            onClick={() => onNavigate('notas')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'notas'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">request_quote</span>
            <span>Notas de Pedido</span>
          </button>
          )}

          {/* Vacaciones */}
          {ver('vacaciones') && (
          <button
            onClick={() => onNavigate('vacaciones')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'vacaciones'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${activeSection === 'vacaciones' ? 'text-secondary' : ''}`}
              style={{ fontVariationSettings: activeSection === 'vacaciones' ? "'FILL' 1" : "'FILL' 0" }}
            >
              beach_access
            </span>
            <span className={activeSection === 'vacaciones' ? 'font-semibold' : ''}>Vacaciones</span>
          </button>
          )}

          {/* 5. Documentación & Alertas */}
          {ver('documentacion') && (
          <button
            onClick={() => onNavigate('documentacion')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'documentacion'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">warning</span>
            <span>Documentación &amp; Alertas</span>
          </button>
          )}

          {/* 6. Reportes Institucionales */}
          {ver('reportes') && (
          <button
            onClick={() => onNavigate('reportes')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'reportes'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            <span>Reportes Institucionales</span>
          </button>
          )}

          {/* 7. Configuración / Gestión de Usuarios */}
          {ver('configuracion') && (
          <button
            onClick={() => onNavigate('configuracion')}
            className={`flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-left transition-colors duration-150 ${
              activeSection === 'configuracion'
                ? 'bg-surface-container text-primary font-label-lg border-l-4 border-secondary'
                : 'text-on-surface-variant hover:bg-surface-container font-label-md'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] ${activeSection === 'configuracion' ? 'text-secondary' : ''}`}
              style={{ fontVariationSettings: activeSection === 'configuracion' ? "'FILL' 1" : "'FILL' 0" }}
            >
              settings
            </span>
            <span className={activeSection === 'configuracion' ? 'font-semibold' : ''}>Configuración</span>
          </button>
          )}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant dark:border-outline">
        <button
          className="w-full flex items-center justify-center gap-2 bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md py-2.5 px-3 rounded-lg transition-colors duration-150"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          <span>Mesa de Ayuda</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-error hover:bg-error-container/20 font-label-md text-label-md transition-colors duration-150 text-left"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};
