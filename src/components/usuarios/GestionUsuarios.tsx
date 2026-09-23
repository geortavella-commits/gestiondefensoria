import React, { useEffect, useState, useMemo } from 'react';
import {
  getUsuariosAdmin,
  updateUsuarioAdmin,
  sendPasswordResetEmail,
  type UsuariosStats,
} from '../../services/usuarios';
import { CrearUsuarioModal } from './CrearUsuarioModal';
import type { Profile, SubSede, Area, RolUsuario, EstadoUsuario } from '../../types/legajo';

interface Props {
  onVerLegajo?: (profileId: string) => void;
}

export const GestionUsuarios: React.FC<Props> = ({ onVerLegajo }) => {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [subSedes, setSubSedes] = useState<SubSede[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [stats, setStats] = useState<UsuariosStats>({
    total: 0,
    activos: 0,
    inactivos: 0,
    gestion: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [filtroSubSede, setFiltroSubSede] = useState('');

  // Usuario seleccionado para el Drawer lateral
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  // Formulario del Drawer
  const [drawerEstado, setDrawerEstado] = useState<EstadoUsuario>('activo');
  const [drawerRol, setDrawerRol] = useState<RolUsuario>('personal');
  const [drawerSubSedeId, setDrawerSubSedeId] = useState<string>('');
  const [drawerAreaId, setDrawerAreaId] = useState<string>('');
  const [savingDrawer, setSavingDrawer] = useState(false);
  const [drawerMsg, setDrawerMsg] = useState<string | null>(null);

  // Modal para crear usuario
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getUsuariosAdmin();
      setUsuarios(res.usuarios);
      setSubSedes(res.subSedes);
      setAreas(res.areas);
      setStats(res.stats);

      if (res.usuarios.length > 0 && !selectedUser) {
        selectUserForDrawer(res.usuarios[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectUserForDrawer = (u: Profile) => {
    setSelectedUser(u);
    setDrawerEstado(u.estado);
    setDrawerRol(u.rol);
    setDrawerSubSedeId(u.sub_sede_id || '');
    setDrawerAreaId(u.area_id || '');
    setDrawerMsg(null);
  };

  const handleSaveDrawer = async () => {
    if (!selectedUser) return;
    try {
      setSavingDrawer(true);
      setDrawerMsg(null);
      const updated = await updateUsuarioAdmin(selectedUser.id, {
        estado: drawerEstado,
        rol: drawerRol,
        sub_sede_id: drawerSubSedeId || null,
        area_id: drawerAreaId || null,
      });

      setSelectedUser(updated);
      setUsuarios((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setDrawerMsg('¡Cambios guardados correctamente!');
      setTimeout(() => setDrawerMsg(null), 3500);
    } catch (err: any) {
      alert('Error al guardar cambios: ' + err.message);
    } finally {
      setSavingDrawer(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm(`¿Enviar correo de reseteo de clave a ${email}?`)) return;
    try {
      await sendPasswordResetEmail(email);
      alert('Se envió el correo de reseteo de clave.');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Filtrado de la lista
  const filteredUsers = useMemo(() => {
    return usuarios.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !searchTerm ||
        p.nombre.toLowerCase().includes(q) ||
        p.apellido.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.dni && p.dni.includes(q)) ||
        (p.legajo && p.legajo.toLowerCase().includes(q));

      const matchEstado = !filtroEstado || p.estado === filtroEstado;
      const matchRol = !filtroRol || p.rol === filtroRol;
      const matchSubSede = !filtroSubSede || p.sub_sede_id === filtroSubSede;

      return matchSearch && matchEstado && matchRol && matchSubSede;
    });
  }, [usuarios, searchTerm, filtroEstado, filtroRol, filtroSubSede]);

  // Paginación
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage]);

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFiltroEstado('');
    setFiltroRol('');
    setFiltroSubSede('');
    setCurrentPage(1);
  };

  const getInitials = (nombre: string, apellido: string) => {
    const n = nombre ? nombre[0] : '';
    const a = apellido ? apellido[0] : '';
    return `${n}${a}`.toUpperCase() || 'AG';
  };

  const getRolBadge = (rol: RolUsuario) => {
    switch (rol) {
      case 'coordinacion_general':
      case 'administrador':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-container text-white">
            <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
            <span>{rol === 'coordinacion_general' ? 'Coordinación Gral.' : 'Administrador'}</span>
          </span>
        );
      case 'referente_subsede':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
            <span className="material-symbols-outlined text-[14px]">share_location</span>
            <span>Referente Territorial</span>
          </span>
        );
      case 'jefe_area':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <span className="material-symbols-outlined text-[14px]">policy</span>
            <span>Jefe de Área</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <span className="material-symbols-outlined text-[14px]">assignment_ind</span>
            <span>Agente Técnico</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-margin max-w-[1600px] w-full mx-auto flex flex-col gap-6 text-on-surface font-body-md">
      {/* Breadcrumb & Page Header */}
      <div className="flex flex-col gap-2">
        <nav className="flex items-center gap-1.5 text-outline font-label-sm text-label-sm">
          <span className="hover:text-primary transition-colors cursor-pointer">DDNNA Institucional</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="hover:text-primary transition-colors cursor-pointer">Configuración y Seguridad</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-semibold">Gestión de Usuarios y Permisos</span>
        </nav>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-headline-lg font-headline-lg text-primary tracking-tight">
              Gestión de Usuarios y Control de Accesos
            </h1>
            <p className="text-body-md font-body-md text-on-surface-variant mt-0.5">
              Administración centralizada de credenciales, roles institucionales, sub-sedes asignadas y estado operativo de cuentas bajo Ley 26.061.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => alert('Exportando registro de auditoría en formato CSV...')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-primary font-label-md text-label-md transition-colors duration-150 shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              <span>Exportar Auditoría de Accesos</span>
            </button>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container hover:bg-primary text-white font-label-md text-label-md transition-colors duration-150 shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span>Crear Nuevo Usuario</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-xl border border-error text-body-sm">
          {error}
        </div>
      )}

      {/* KPI Strip: 4 Column Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Total Registrados */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Total Usuarios Registrados
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container text-secondary">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-display-lg font-display-lg text-primary leading-none">{stats.total}</div>
            <div className="mt-2 flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface-variant">
              <span className="inline-flex items-center text-emerald-600 font-semibold">
                <span className="material-symbols-outlined text-[14px]">trending_up</span> +{stats.total}
              </span>
              <span>incorporaciones en padrón</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Activos */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Usuarios Habilitados / Activos
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-display-lg font-display-lg text-emerald-700 leading-none">{stats.activos}</div>
            <div className="mt-2 flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface-variant">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                {stats.total > 0 ? Math.round((stats.activos / stats.total) * 100) : 100}%
              </span>
              <span>del padrón institucional operativo</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Inactivos / Licencias */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Cuentas Inactivas o en Licencia
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-display-lg font-display-lg text-amber-700 leading-none">{stats.inactivos}</div>
            <div className="mt-2 flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface-variant">
              <span className="text-amber-800 font-medium">Bajas temporales o licencias</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Roles Críticos */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant font-medium">
              Roles Críticos / Coordinación
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-secondary">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </span>
          </div>
          <div className="mt-3">
            <div className="text-display-lg font-display-lg text-primary leading-none">{stats.gestion}</div>
            <div className="mt-2 flex items-center gap-1.5 text-label-sm font-label-sm text-on-surface-variant">
              <span className="inline-flex items-center text-secondary font-semibold">
                <span className="material-symbols-outlined text-[14px]">check_circle</span> 100% 2FA
              </span>
              <span>autenticación reforzada</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace: Filters + Table + Detail Drawer Section */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Table Column */}
        <section className="xl:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-outline-variant bg-surface-container-lowest flex flex-col gap-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search filter */}
              <div className="relative md:col-span-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                  search
                </span>
                <input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-outline-variant text-on-surface text-body-sm font-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                  placeholder="Filtrar por texto..."
                  type="text"
                />
              </div>

              {/* State Filter */}
              <div>
                <select
                  value={filtroEstado}
                  onChange={(e) => {
                    setFiltroEstado(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                >
                  <option value="">Estado: Todos</option>
                  <option value="activo">Solo Activos</option>
                  <option value="inactivo">Solo Inactivos</option>
                  <option value="licencia">En Licencia</option>
                  <option value="baja">De Baja</option>
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <select
                  value={filtroRol}
                  onChange={(e) => {
                    setFiltroRol(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                >
                  <option value="">Rol: Todos los niveles</option>
                  <option value="administrador">Administrador Central</option>
                  <option value="coordinacion_general">Coordinación General</option>
                  <option value="jefe_area">Jefe de Área</option>
                  <option value="referente_subsede">Referente Territorial</option>
                  <option value="personal">Agente Técnico</option>
                </select>
              </div>

              {/* Sub-Sede Filter */}
              <div>
                <select
                  value={filtroSubSede}
                  onChange={(e) => {
                    setFiltroSubSede(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full h-9 px-3 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                >
                  <option value="">Sub-Sede: Todas</option>
                  {subSedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.localidad || 'Territorio'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-label-sm font-label-sm text-on-surface-variant">
                Mostrando <strong className="text-primary font-semibold">{paginatedUsers.length}</strong> de{' '}
                <strong>{filteredUsers.length}</strong> cuentas encontradas
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={limpiarFiltros}
                  className="text-label-sm font-label-sm text-secondary hover:underline flex items-center gap-1"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
                  <span>Limpiar Filtros</span>
                </button>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-outline flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin"></div>
                <p>Cargando padrón institucional...</p>
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="p-8 text-center text-outline">
                No se encontraron usuarios con los filtros aplicados.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface border-b border-outline-variant text-on-surface-variant font-label-sm text-label-sm">
                    <th className="py-3 px-4 uppercase tracking-wider font-semibold">Usuario &amp; Correo</th>
                    <th className="py-3 px-3 uppercase tracking-wider font-semibold">Identificación</th>
                    <th className="py-3 px-3 uppercase tracking-wider font-semibold">Rol Asignado</th>
                    <th className="py-3 px-3 uppercase tracking-wider font-semibold">Sub-Sede</th>
                    <th className="py-3 px-3 uppercase tracking-wider font-semibold">Estado</th>
                    <th className="py-3 px-4 uppercase tracking-wider font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 font-body-sm text-body-sm">
                  {paginatedUsers.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    const isActivo = u.estado === 'activo';

                    return (
                      <tr
                        key={u.id}
                        onClick={() => selectUserForDrawer(u)}
                        className={`transition-colors duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-surface-container/70 font-medium'
                            : 'hover:bg-surface-container-low/60'
                        }`}
                      >
                        {/* Usuario & Correo */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {u.avatar_url ? (
                              <img
                                src={u.avatar_url}
                                alt={u.nombre}
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-outline-variant"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center font-label-md font-bold text-xs ring-2 ring-primary/20">
                                {getInitials(u.nombre, u.apellido)}
                              </div>
                            )}
                            <div className="flex flex-col">
                              <span className="font-semibold text-primary">
                                {u.nombre} {u.apellido}
                              </span>
                              <span className="text-xs text-on-surface-variant">{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Identificación */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-primary">DNI {u.dni || 'S/D'}</span>
                            <span className="text-xs text-outline font-mono">
                              LEG-{u.legajo || 'S/L'}
                            </span>
                          </div>
                        </td>

                        {/* Rol */}
                        <td className="py-3 px-3">{getRolBadge(u.rol)}</td>

                        {/* Sub-Sede */}
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container text-primary">
                            {u.sub_sedes?.nombre || 'Sede Central'}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              isActivo
                                ? 'bg-emerald-100 text-emerald-800'
                                : u.estado === 'licencia'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActivo ? 'bg-emerald-600' : u.estado === 'licencia' ? 'bg-amber-600' : 'bg-rose-600'
                              }`}
                            ></span>
                            <span className="capitalize">{u.estado}</span>
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {onVerLegajo && (
                              <button
                                onClick={() => onVerLegajo(u.id)}
                                className="p-1.5 rounded-lg text-secondary hover:bg-surface-container hover:text-primary transition-colors"
                                title="Ver Legajo Digital"
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[18px]">folder_shared</span>
                              </button>
                            )}
                            <button
                              onClick={() => selectUserForDrawer(u)}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                              title="Editar Credenciales"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleResetPassword(u.email)}
                              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                              title="Reiniciar Clave"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-outline-variant flex items-center justify-between bg-surface-container-lowest">
            <span className="font-label-sm text-label-sm text-outline">
              Página {currentPage} de {totalPages} ({filteredUsers.length} cuentas)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-outline-variant text-outline disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, currentPage - 3), currentPage + 2)
                .map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-2.5 py-1 rounded font-label-sm text-label-sm ${
                      page === currentPage
                        ? 'bg-primary text-white font-bold'
                        : 'hover:bg-surface-container text-on-surface'
                    }`}
                  >
                    {page}
                  </button>
                ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-outline-variant text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Side: Contextual Edit Drawer Card */}
        <section className="xl:col-span-4 flex flex-col gap-4">
          {selectedUser ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">manage_accounts</span>
                  <h2 className="text-headline-sm font-headline-sm text-primary">Detalle de Credencial</h2>
                </div>
                <span
                  className={`text-label-sm font-label-sm px-2 py-0.5 rounded-full font-semibold ${
                    drawerEstado === 'activo'
                      ? 'text-emerald-800 bg-emerald-100'
                      : 'text-amber-800 bg-amber-100'
                  }`}
                >
                  {drawerEstado.toUpperCase()}
                </span>
              </div>

              {/* Header Usuario Seleccionado */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/60">
                {selectedUser.avatar_url ? (
                  <img
                    src={selectedUser.avatar_url}
                    alt={selectedUser.nombre}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm">
                    {getInitials(selectedUser.nombre, selectedUser.apellido)}
                  </div>
                )}
                <div className="flex flex-col flex-1 min-w-0">
                  <h3 className="font-headline-sm font-headline-sm text-primary truncate">
                    {selectedUser.nombre} {selectedUser.apellido}
                  </h3>
                  <span className="text-xs text-on-surface-variant font-mono truncate">
                    {selectedUser.email}
                  </span>
                  <span className="text-[11px] text-outline mt-0.5">
                    DNI: {selectedUser.dni || 'S/D'} • Legajo: {selectedUser.legajo || 'S/L'}
                  </span>
                </div>
              </div>

              {drawerMsg && (
                <div className="p-2.5 bg-emerald-100 text-emerald-800 text-body-sm rounded-lg flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  <span>{drawerMsg}</span>
                </div>
              )}

              {/* Formulario de Configuración Rápida */}
              <form
                className="flex flex-col gap-3.5 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveDrawer();
                }}
              >
                {/* Estado Switch */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface">
                  <div className="flex flex-col">
                    <span className="font-label-md text-label-md text-primary font-semibold">
                      Estado de la Cuenta
                    </span>
                    <span className="text-label-sm text-label-sm text-on-surface-variant">
                      Habilita el ingreso al portal
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawerEstado === 'activo'}
                      onChange={(e) => setDrawerEstado(e.target.checked ? 'activo' : 'inactivo')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-outline-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Rol Select */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-primary font-semibold">
                    Nivel de Privilegios / Rol Institucional
                  </label>
                  <select
                    value={drawerRol}
                    onChange={(e) => setDrawerRol(e.target.value as RolUsuario)}
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                  >
                    <option value="coordinacion_general">Coordinación General (Acceso Máximo)</option>
                    <option value="administrador">Administrador Central</option>
                    <option value="jefe_area">Jefe de Área</option>
                    <option value="referente_subsede">Referente Territorial de Sub-Sede</option>
                    <option value="personal">Personal / Agente Técnico</option>
                  </select>
                  <span className="text-[11px] text-outline">Autorizado según Resolución DDNNA N° 412/2023</span>
                </div>

                {/* Área Asignación */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-primary font-semibold">
                    Área Orgánica Asignada
                  </label>
                  <select
                    value={drawerAreaId}
                    onChange={(e) => setDrawerAreaId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                  >
                    <option value="">Sin área asignada</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-outline">
                    Determina qué puede ver un Jefe de Área (su área y las que tenga a cargo)
                  </span>
                </div>

                {/* Sub-Sede Asignación */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-sm text-label-sm text-primary font-semibold">
                    Sub-Sede Territorial Asignada
                  </label>
                  <select
                    value={drawerSubSedeId}
                    onChange={(e) => setDrawerSubSedeId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-surface border border-outline-variant text-on-surface font-body-sm text-body-sm focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none"
                  >
                    <option value="">Sin sub-sede asignada</option>
                    {subSedes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre} ({s.localidad || 'Territorio'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Acciones */}
                <div className="flex flex-col sm:flex-row gap-2 pt-3">
                  <button
                    disabled={savingDrawer}
                    type="submit"
                    className="flex-1 py-2 px-3 rounded-lg bg-primary-container hover:bg-primary text-white font-label-md text-label-md transition-colors duration-150 flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>{savingDrawer ? 'Guardando...' : 'Guardar Cambios'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(selectedUser.email)}
                    className="py-2 px-3 rounded-lg border border-outline-variant hover:bg-surface-container-low text-primary font-label-md text-label-md transition-colors duration-150 flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">key</span>
                    <span>Resetear Clave</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 text-center text-outline">
              Seleccioná un usuario de la tabla para ver y editar sus credenciales.
            </div>
          )}

          {/* Card de Cumplimiento Legal */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex items-start gap-3">
            <span className="material-symbols-outlined text-secondary text-[24px] mt-0.5">verified_user</span>
            <div className="flex flex-col">
              <span className="text-label-md font-label-md text-primary font-semibold">
                Control de Acceso Auditado
              </span>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Toda modificación de privilegios, altas o bloqueos de cuenta genera una entrada inmutable en el registro de auditoría legal conforme a la Ley de Protección Integral de los Derechos de las NNyA.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Modal Crear Usuario */}
      <CrearUsuarioModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        subSedes={subSedes}
        areas={areas}
        onUserCreated={loadData}
      />
    </div>
  );
};
