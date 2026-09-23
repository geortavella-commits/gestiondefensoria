import React, { useState } from 'react';
import type { SubSede, Area, RolUsuario } from '../../types/legajo';
import { supabase } from '../../services/supabaseClient';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subSedes: SubSede[];
  areas: Area[];
  onUserCreated: () => void;
}

export const CrearUsuarioModal: React.FC<Props> = ({
  isOpen,
  onClose,
  subSedes,
  areas,
  onUserCreated,
}) => {
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<RolUsuario>('personal');
  const [subSedeId, setSubSedeId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [cargo, setCargo] = useState('');
  const [legajo, setLegajo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Se crea vía Edge Function con service_role: signUp() en el cliente
      // reemplazaría la sesión del admin logueado por la del usuario nuevo.
      const { data, error: fnError } = await supabase.functions.invoke('admin-create-user', {
        body: {
          nombreCompleto,
          dni,
          email,
          password,
          rol,
          cargo: cargo || null,
          legajo: legajo || null,
          areaId: areaId || null,
          subSedeId: subSedeId || null,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      onUserCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest dark:bg-surface rounded-xl border border-outline-variant max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">person_add</span>
            <h2 className="text-headline-md font-headline-md text-primary">Crear Nuevo Usuario Institucional</h2>
          </div>
          <button onClick={onClose} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-error-container text-on-error-container text-body-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Nombre y Apellido completo <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej. Mariana Soledad Benítez"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                DNI / CUIL <span className="text-error">*</span>
              </label>
              <input
                type="text"
                required
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ej. 33444555"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Correo Electrónico Oficial <span className="text-error">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre.apellido@ddnna.gob.ar"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Contraseña Temporal <span className="text-error">*</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Rol Institucional
              </label>
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as RolUsuario)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              >
                <option value="personal">Personal / Agente Técnico</option>
                <option value="referente_subsede">Referente Territorial</option>
                <option value="jefe_area">Jefe de Área</option>
                <option value="administrador">Administrador</option>
                <option value="coordinacion_general">Coordinación General</option>
              </select>
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Sub-Sede
              </label>
              <select
                value={subSedeId}
                onChange={(e) => setSubSedeId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              >
                <option value="">Sede Central / Sin asignar</option>
                {subSedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.localidad || 'Territorio'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Área Orgánica
              </label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              >
                <option value="">Área General</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                Cargo / Función
              </label>
              <input
                type="text"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                placeholder="Ej. Abogado de Intervención Rápida"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
            <div>
              <label className="block text-label-md font-label-md text-on-surface-variant mb-1">
                N° de Legajo
              </label>
              <input
                type="text"
                value={legajo}
                onChange={(e) => setLegajo(e.target.value)}
                placeholder="Ej. LEG-2024-055"
                className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-md focus:outline-none focus:border-secondary"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-outline-variant text-primary text-label-md hover:bg-surface-container"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-label-md hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
