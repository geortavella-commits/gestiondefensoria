import React from 'react';
import type { Profile } from '../../types/legajo';

interface Props {
  perfilActual?: Profile | null;
  listaPerfiles?: Profile[];
  onSelectAgente?: (profileId: string) => void;
  selectedId?: string;
  onLogout?: () => void;
}

export const Header: React.FC<Props> = ({
  perfilActual,
  listaPerfiles = [],
  onSelectAgente,
  selectedId,
  onLogout,
}) => {
  return (
    <header className="h-16 px-gutter flex items-center justify-between w-full sticky top-0 z-40 bg-surface-container-lowest dark:bg-surface border-b border-outline-variant dark:border-outline shadow-sm pl-72">
      {/* Left: Search / Agent Selector */}
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {listaPerfiles.length > 0 ? (
          <div className="relative w-full max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
              person_search
            </span>
            <select
              value={selectedId}
              onChange={(e) => onSelectAgente?.(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-body-sm text-on-surface focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            >
              {listaPerfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido}, {p.nombre} ({p.cargo || 'Agente'} - DNI: {p.dni || 'S/D'})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="relative w-full max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
              search
            </span>
            <input
              className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
              placeholder="Buscar por DNI, Apellido o Sub-Sede..."
              type="text"
            />
          </div>
        )}

        <div className="hidden lg:flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface-variant">
          <span className="inline-block w-2 h-2 rounded-full bg-on-tertiary-container"></span>
          <span>
            {perfilActual?.sub_sedes?.nombre || 'Sede Central'} —{' '}
            {perfilActual?.rol ? perfilActual.rol.toUpperCase() : 'Operador'}
          </span>
        </div>
      </div>

      {/* Trailing Actions & Profile */}
      <div className="flex items-center gap-3">
        <button
          aria-label="Notificaciones"
          className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors duration-150"
        >
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full"></span>
        </button>
        <button
          aria-label="Ayuda"
          className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors duration-150"
        >
          <span className="material-symbols-outlined text-[22px]">help</span>
        </button>
        <div className="h-6 w-px bg-outline-variant mx-1"></div>

        {onLogout && (
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-error transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        )}

        <div className="flex items-center gap-2 pl-2">
          <img
            className="w-9 h-9 rounded-full object-cover border border-outline-variant bg-surface-container"
            src={
              perfilActual?.avatar_url ||
              'https://lh3.googleusercontent.com/aida-public/AB6AXuBPcK6P4VlyrgHo0xVZNoyx6c0hKIFWwM4fRd1MQaQ0LE_msAgIHytNu5EIPIJuYRBP1kt67Y0ESnEBY45OdYqHkSjWt7_sGqv9PC5NeGGM6EHX_55IQuPGeyp93uO1EHLCs4ArahB8_xEH8Qa63CBa2EKKnFLtsLHpGVbQLYxAm_qHyIaDtdhMJhPwEAV7dwMrIMkMTvQaZxlbziuzYbhO5esBR7HZX95I9TCHi6C8L0-kRuhNfuTYyw'
            }
            alt="Usuario Logueado"
          />
        </div>
      </div>
    </header>
  );
};
