import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { descargarCsv, descargarPlantilla, generarPasswordTemporal, parseTablaPegada } from '../../utils/cargaMasiva';
import type { Area, RolUsuario, SubSede } from '../../types/legajo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  areas: Area[];
  subSedes: SubSede[];
  onUsuariosCreados: () => void;
}

const ROLES_VALIDOS: RolUsuario[] = ['personal', 'referente_subsede', 'jefe_area', 'administrador', 'coordinacion_general'];

interface FilaParseada {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  cargo: string;
  legajo: string;
  areaNombre: string;
  subSedeNombre: string;
  rol: RolUsuario;
  areaId: string | null;
  subSedeId: string | null;
  errores: string[];
}

interface FilaResultado extends FilaParseada {
  password: string;
  estado: 'pendiente' | 'ok' | 'error';
  mensaje?: string;
}

export const CargaMasivaModal: React.FC<Props> = ({ isOpen, onClose, areas, subSedes, onUsuariosCreados }) => {
  const [paso, setPaso] = useState<'pegar' | 'revisar' | 'resultado'>('pegar');
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<FilaParseada[]>([]);
  const [resultados, setResultados] = useState<FilaResultado[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  if (!isOpen) return null;

  const cerrarYResetear = () => {
    setPaso('pegar');
    setTexto('');
    setFilas([]);
    setResultados([]);
    setErrorGeneral(null);
    onClose();
  };

  const buscarArea = (nombre: string) =>
    areas.find((a) => a.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
  const buscarSubSede = (nombre: string) =>
    subSedes.find((s) => s.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());

  const handleRevisar = () => {
    setErrorGeneral(null);
    const filasTexto = parseTablaPegada(texto);
    if (filasTexto.length === 0) {
      setErrorGeneral('Pegá al menos una fila de datos.');
      return;
    }
    // La primera fila es el encabezado, se ignora su contenido.
    const datos = filasTexto.slice(1);
    if (datos.length === 0) {
      setErrorGeneral('Solo encontré el encabezado, falta cargar filas con datos.');
      return;
    }

    const parseadas: FilaParseada[] = datos.map((cols) => {
      const [
        nombre = '',
        apellido = '',
        dni = '',
        email = '',
        cargo = '',
        legajo = '',
        areaNombre = '',
        subSedeNombre = '',
        rolTexto = '',
      ] = cols;
      const errores: string[] = [];

      if (!nombre.trim()) errores.push('Falta nombre');
      if (!apellido.trim()) errores.push('Falta apellido');
      if (!email.trim() || !email.includes('@')) errores.push('Email inválido o vacío');
      // El DNI es opcional: se puede cargar después desde el legajo de cada persona.

      const rolNormalizado = rolTexto.trim().toLowerCase() as RolUsuario;
      const rol = ROLES_VALIDOS.includes(rolNormalizado) ? rolNormalizado : 'personal';
      if (rolTexto.trim() && !ROLES_VALIDOS.includes(rolNormalizado)) {
        errores.push(`Rol "${rolTexto}" no reconocido (uso "personal")`);
      }

      let areaId: string | null = null;
      if (areaNombre.trim()) {
        const area = buscarArea(areaNombre);
        if (!area) errores.push(`Área "${areaNombre}" no existe`);
        else areaId = area.id;
      }

      let subSedeId: string | null = null;
      if (subSedeNombre.trim()) {
        const sede = buscarSubSede(subSedeNombre);
        if (!sede) errores.push(`Sub-Sede "${subSedeNombre}" no existe`);
        else subSedeId = sede.id;
      }

      return { nombre, apellido, dni, email, cargo, legajo, areaNombre, subSedeNombre, rol, areaId, subSedeId, errores };
    });

    setFilas(parseadas);
    setPaso('revisar');
  };

  const filasValidas = filas.filter((f) => f.errores.length === 0);

  const handleCrearTodos = async () => {
    setProcesando(true);
    const acumulado: FilaResultado[] = filasValidas.map((f) => ({
      ...f,
      password: generarPasswordTemporal(),
      estado: 'pendiente',
    }));
    setResultados(acumulado);
    setPaso('resultado');

    // Secuencial (no en paralelo) para no saturar la Edge Function ni perder el orden de resultados.
    for (let i = 0; i < acumulado.length; i++) {
      const fila = acumulado[i];
      try {
        const { data, error: fnError } = await supabase.functions.invoke('admin-create-user', {
          body: {
            nombre: fila.nombre,
            apellido: fila.apellido,
            dni: fila.dni || null,
            email: fila.email,
            password: fila.password,
            rol: fila.rol,
            cargo: fila.cargo || null,
            legajo: fila.legajo || null,
            areaId: fila.areaId,
            subSedeId: fila.subSedeId,
          },
        });

        if (fnError) throw new Error(fnError.message);
        if (data?.error) throw new Error(data.error);

        acumulado[i] = { ...fila, estado: 'ok' };
      } catch (err: any) {
        acumulado[i] = { ...fila, estado: 'error', mensaje: err.message || 'Error desconocido' };
      }
      setResultados([...acumulado]);
    }

    setProcesando(false);
    onUsuariosCreados();
  };

  const handleDescargarCredenciales = () => {
    const exitosos = resultados.filter((r) => r.estado === 'ok');
    const filas = [
      ['Nombre', 'Apellido', 'Email', 'Contraseña Temporal'],
      ...exitosos.map((r) => [r.nombre, r.apellido, r.email, r.password]),
    ];
    descargarCsv('credenciales_temporales.csv', filas);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant max-w-4xl w-full p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[24px]">group_add</span>
            <h2 className="text-headline-md font-headline-md text-primary">Carga Masiva de Usuarios</h2>
          </div>
          <button onClick={cerrarYResetear} className="text-outline hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* PASO 1: PEGAR DATOS */}
        {paso === 'pegar' && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/60">
              <p className="text-body-sm text-on-surface-variant">
                Subí un archivo .csv, o pegá las filas copiadas de una planilla (Excel/Sheets) directo en el texto de
                abajo. La primera fila tiene que ser el encabezado (se ignora su contenido, pero tiene que estar).
              </p>
              <button
                type="button"
                onClick={descargarPlantilla}
                className="shrink-0 px-3 py-1.5 border border-outline-variant rounded-lg text-label-sm font-semibold text-primary hover:bg-surface-container whitespace-nowrap"
              >
                Descargar plantilla
              </button>
            </div>
            <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-outline-variant rounded-lg text-label-sm text-on-surface-variant hover:border-secondary hover:text-secondary cursor-pointer w-fit">
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Subir archivo .csv</span>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setTexto(String(reader.result || ''));
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="text-label-sm text-outline">
              Columnas esperadas, en este orden: <strong>Nombre, Apellido, DNI, Email, Cargo, Legajo, Área, Sub-Sede, Rol</strong>.
              Nombre, Apellido y Email van separados a propósito (evita adivinar mal apellidos compuestos). DNI, Cargo,
              Legajo, Área y Sub-Sede se pueden dejar vacíos y completarlos después desde el legajo de cada persona — Área
              y Sub-Sede tienen que coincidir exacto con un nombre ya cargado si se completan. Rol:{' '}
              <code className="font-mono">{ROLES_VALIDOS.join(' | ')}</code> (si se deja vacío o mal escrito, entra como "personal").
            </p>
            <textarea
              rows={10}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={'Nombre\tApellido\tDNI\tEmail\tCargo\tLegajo\tÁrea\tSub-Sede\tRol\nAna\tGomez\t30123456\tana.gomez@ddnna.gob.ar\tTrabajadora Social\t1092\tLegales\t\tpersonal'}
              className="w-full p-3 font-mono text-body-sm bg-surface-container-lowest border border-outline-variant rounded-lg focus:outline-none focus:border-secondary"
            />
            {errorGeneral && <div className="p-3 rounded-lg bg-error-container text-on-error-container text-body-sm">{errorGeneral}</div>}
            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/60">
              <button onClick={cerrarYResetear} className="px-4 py-2 rounded-lg border border-outline-variant text-primary text-label-md hover:bg-surface-container">
                Cancelar
              </button>
              <button onClick={handleRevisar} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-label-md hover:opacity-90">
                Revisar datos
              </button>
            </div>
          </div>
        )}

        {/* PASO 2: REVISAR ANTES DE CREAR */}
        {paso === 'revisar' && (
          <div className="mt-6 flex flex-col gap-4">
            <p className="text-body-sm text-on-surface-variant">
              {filasValidas.length} de {filas.length} filas están listas para crear. Las que tienen errores no se van a
              procesar — corregilas en el texto pegado y volvé a revisar si hace falta.
            </p>
            <div className="overflow-x-auto border border-outline-variant rounded-lg">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="bg-surface-container text-label-sm text-on-surface-variant">
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Área / Sub-Sede</th>
                    <th className="px-3 py-2 text-left">Rol</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {filas.map((f, i) => (
                    <tr key={i} className={f.errores.length ? 'bg-error-container/20' : ''}>
                      <td className="px-3 py-2">{f.nombre || f.apellido ? `${f.nombre} ${f.apellido}`.trim() : '—'}</td>
                      <td className="px-3 py-2">{f.email || '—'}</td>
                      <td className="px-3 py-2">
                        {f.areaNombre || '—'} {f.subSedeNombre ? `/ ${f.subSedeNombre}` : ''}
                      </td>
                      <td className="px-3 py-2">{f.rol}</td>
                      <td className="px-3 py-2">
                        {f.errores.length === 0 ? (
                          <span className="text-teal-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span> Lista
                          </span>
                        ) : (
                          <span className="text-error text-label-sm">{f.errores.join(' · ')}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between gap-3 pt-2 border-t border-outline-variant/60">
              <button onClick={() => setPaso('pegar')} className="px-4 py-2 rounded-lg border border-outline-variant text-primary text-label-md hover:bg-surface-container">
                ← Volver a editar
              </button>
              <button
                onClick={handleCrearTodos}
                disabled={filasValidas.length === 0}
                className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-label-md hover:opacity-90 disabled:opacity-50"
              >
                Crear {filasValidas.length} {filasValidas.length === 1 ? 'usuario' : 'usuarios'}
              </button>
            </div>
          </div>
        )}

        {/* PASO 3: RESULTADO */}
        {paso === 'resultado' && (
          <div className="mt-6 flex flex-col gap-4">
            {procesando && (
              <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
                <span className="w-4 h-4 border-2 border-secondary border-t-transparent rounded-full animate-spin"></span>
                Creando usuarios, no cierres esta ventana...
              </div>
            )}
            <div className="overflow-x-auto border border-outline-variant rounded-lg">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="bg-surface-container text-label-sm text-on-surface-variant">
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Contraseña Temporal</th>
                    <th className="px-3 py-2 text-left">Resultado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {resultados.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{r.nombre} {r.apellido}</td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2 font-mono">{r.estado === 'ok' ? r.password : '—'}</td>
                      <td className="px-3 py-2">
                        {r.estado === 'pendiente' && <span className="text-outline">Procesando...</span>}
                        {r.estado === 'ok' && (
                          <span className="text-teal-700 font-semibold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span> Creado
                          </span>
                        )}
                        {r.estado === 'error' && <span className="text-error text-label-sm">{r.mensaje}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!procesando && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-body-sm text-amber-900">
                Guardá o descargá las contraseñas temporales ahora — no se pueden volver a ver después de cerrar esta
                ventana. Comunicáselas a cada persona por un medio seguro.
              </div>
            )}
            <div className="flex justify-between gap-3 pt-2 border-t border-outline-variant/60">
              <button
                onClick={handleDescargarCredenciales}
                disabled={procesando || resultados.every((r) => r.estado !== 'ok')}
                className="px-4 py-2 rounded-lg border border-outline-variant text-primary text-label-md hover:bg-surface-container disabled:opacity-50 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Descargar credenciales (CSV)
              </button>
              <button onClick={cerrarYResetear} disabled={procesando} className="px-4 py-2 rounded-lg bg-primary-container text-on-primary text-label-md hover:opacity-90 disabled:opacity-50">
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
