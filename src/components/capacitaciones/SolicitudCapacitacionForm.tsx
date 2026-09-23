import React, { useState, useEffect } from 'react';
import { crearSolicitudCapacitacion } from '../../services/capacitaciones';
import type { SubSede, Profile } from '../../types/legajo';

interface Props {
  subSedes: SubSede[];
  perfilActual?: Profile | null;
  onVolver: () => void;
  onSolicitudEnviada: () => void;
}

export const SolicitudCapacitacionForm: React.FC<Props> = ({
  subSedes,
  perfilActual,
  onVolver,
  onSolicitudEnviada,
}) => {
  // Form State
  const [subSedeId, setSubSedeId] = useState(
    perfilActual?.sub_sede_id || subSedes[0]?.id || ''
  );
  const [telefonoContacto, setTelefonoContacto] = useState(
    perfilActual?.telefono || '+54 (342) 459-8812'
  );
  const [tipoFormacion, setTipoFormacion] = useState('tecnica');

  // Sección 2
  const [tematica, setTematica] = useState(
    'Abordaje Integral en Situaciones de Vulnerabilidad Extrema y Violencia Digital hacia NNA'
  );
  const [justificacion, setJustificacion] = useState(
    'Se ha detectado un incremento en intervenciones vinculadas a ciberacoso y vulneración de identidad digital de adolescentes en centros educativos. Resulta indispensable homologar el marco de denuncia urgente y contención psicosocial de los equipos técnicos locales.'
  );
  const [destinatarios, setDestinatarios] = useState(
    'Equipos de Primera Escucha y Asistentes Sociales'
  );
  const [participantes, setParticipantes] = useState<number>(35);

  // Sección 3
  const [modalidad, setModalidad] = useState('presencial');
  const [fechaPreferente, setFechaPreferente] = useState('2025-04-18');
  const [fechaAlternativa, setFechaAlternativa] = useState('2025-04-25');
  const [recursos, setRecursos] = useState({
    audiovisual: true,
    salon: true,
    conectividad: true,
    refrigerio: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (perfilActual?.sub_sede_id) {
      setSubSedeId(perfilActual.sub_sede_id);
    }
    if (perfilActual?.telefono) {
      setTelefonoContacto(perfilActual.telefono);
    }
  }, [perfilActual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfilActual?.id) {
      setError('Debe haber un usuario autenticado para remitir la solicitud.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const descripcionCompleta = `Tipo: ${tipoFormacion.toUpperCase()} | Destinatarios: ${destinatarios} | Modalidad: ${modalidad.toUpperCase()} | Tel: ${telefonoContacto}`;
      const justificacionCompleta = `${justificacion}\n\nFecha Preferente: ${fechaPreferente} | Fecha Alternativa: ${fechaAlternativa}`;

      await crearSolicitudCapacitacion({
        sub_sede_id: subSedeId,
        solicitado_por: perfilActual.id,
        tema: tematica,
        descripcion: descripcionCompleta,
        justificacion: justificacionCompleta,
        cantidad_participantes: participantes,
        fecha_propuesta: fechaPreferente,
      });

      setSuccessMsg('¡Solicitud enviada exitosamente a la Sede Central!');
      setTimeout(() => {
        onSolicitudEnviada();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const sedeSeleccionada = subSedes.find((s) => s.id === subSedeId);

  return (
    <div className="max-w-[1440px] mx-auto space-y-space-lg text-on-surface font-body-md">
      {/* BREADCRUMBS & CONTEXT BAR */}
      <div className="flex flex-wrap items-center justify-between gap-y-2">
        <nav className="flex items-center gap-2 font-label-md text-label-md text-outline">
          <button onClick={onVolver} className="hover:text-primary transition-colors">
            Capacitaciones
          </button>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <button onClick={onVolver} className="hover:text-primary transition-colors">
            Solicitudes
          </button>
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          <span className="text-secondary font-semibold">Nueva Solicitud Territorial</span>
        </nav>

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container border border-outline-variant rounded-full text-label-sm text-on-surface-variant">
          <span className="material-symbols-outlined text-secondary text-[16px]">verified_user</span>
          <span>
            Sub-Sede Habilitada: <strong>{sedeSeleccionada?.nombre || 'Región Territorial'}</strong>
          </span>
          <span className="text-outline-variant">|</span>
          <span>Expediente: <strong>FOR-2025-089</strong></span>
        </div>
      </div>

      {/* PAGE HEADER */}
      <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-label-sm bg-surface-container-high text-secondary font-bold">
              SOLICITUD OFICIAL
            </span>
            <span className="font-label-sm text-label-sm text-outline">Ejercicio 2025</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
            Nueva Solicitud de Taller o Capacitación Territorial
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            Formulario de articulación pedagógica y actualización técnica con la Sede Central para agentes defensores y equipos interdisciplinarios.
          </p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto shrink-0">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-primary font-label-md text-label-md">
            <span className="material-symbols-outlined text-secondary text-[18px]">schedule</span>
            <span>Plazo estimado: 48-72h</span>
          </span>
          <button
            onClick={onVolver}
            className="px-3 py-1.5 border border-outline-variant rounded-lg text-primary hover:bg-surface-container text-label-md"
          >
            ← Volver al Panel
          </button>
        </div>
      </div>

      {/* STEPPER STATUS TRACKER */}
      <div className="bg-surface-container-lowest px-space-lg py-space-md rounded-xl border border-outline-variant shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-label-lg text-label-lg font-bold shrink-0 shadow-xs">
              1
            </div>
            <div>
              <div className="font-label-md text-label-md font-bold text-primary">Convocatoria &amp; Sede</div>
              <div className="font-label-sm text-label-sm text-secondary">En edición técnica</div>
            </div>
          </div>
          {/* Step 2 */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-outline-variant pt-3 md:pt-0 md:pl-4">
            <div className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-label-md text-label-md shrink-0">
              2
            </div>
            <div>
              <div className="font-label-md text-label-md font-bold text-on-surface-variant">
                Temática &amp; Fundamentación
              </div>
              <div className="font-label-sm text-label-sm text-outline">Definición pedagógica</div>
            </div>
          </div>
          {/* Step 3 */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-outline-variant pt-3 md:pt-0 md:pl-4">
            <div className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center font-label-md text-label-md shrink-0">
              3
            </div>
            <div>
              <div className="font-label-md text-label-md font-bold text-on-surface-variant">Logística &amp; Calendario</div>
              <div className="font-label-sm text-label-sm text-outline">Recursos de sede</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-error-container text-on-error-container rounded-xl border border-error flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-[#CCFBF1] text-[#0F766E] rounded-xl border border-teal-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span className="font-bold">{successMsg}</span>
        </div>
      )}

      {/* MAIN 2-COLUMN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* LEFT 8-COLUMN: STRUCTURED FORM */}
        <form className="lg:col-span-8 space-y-space-lg" onSubmit={handleSubmit}>
          {/* SECCIÓN 1: DATOS DE LA CONVOCATORIA */}
          <section className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant shadow-sm space-y-space-md">
            <div className="flex items-center gap-2 border-b border-outline-variant pb-space-sm">
              <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary font-bold text-label-md">
                1
              </div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                Sección 1 - Datos de la Convocatoria
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {/* Sub-Sede Solicitante */}
              <div className="space-y-1">
                <label className="font-label-md text-label-md font-semibold text-primary flex items-center justify-between" htmlFor="sub-sede">
                  Sub-Sede Solicitante <span className="text-error">*</span>
                </label>
                <select
                  id="sub-sede"
                  value={subSedeId}
                  onChange={(e) => setSubSedeId(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                >
                  {subSedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} ({s.localidad || 'Territorio'})
                    </option>
                  ))}
                </select>
                <p className="font-label-sm text-label-sm text-outline">Sede territorial con personería operativa activa.</p>
              </div>

              {/* Teléfono Directo */}
              <div className="space-y-1">
                <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="phone">
                  Teléfono Directo de Guardia / Contacto <span className="text-error">*</span>
                </label>
                <input
                  id="phone"
                  type="text"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20 font-mono text-body-sm"
                />
                <p className="font-label-sm text-label-sm text-outline">Línea de enlace inmediato para coordinación institucional.</p>
              </div>

              {/* Referente Solicitante */}
              <div className="space-y-1 md:col-span-2">
                <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="referente">
                  Referente Solicitante Responsable
                </label>
                <input
                  id="referente"
                  readOnly
                  type="text"
                  value={
                    perfilActual
                      ? `${perfilActual.nombre} ${perfilActual.apellido} - Legajo DDNNA #${perfilActual.legajo || '4829'} (${perfilActual.cargo || 'Coordinador Territorial'})`
                      : 'Lic. Martín Morales - Legajo DDNNA #4829 (Coordinador Territorial)'
                  }
                  className="w-full h-10 px-3 bg-surface-container border border-outline-variant rounded-lg text-body-md text-on-surface-variant cursor-not-allowed"
                />
              </div>
            </div>

            {/* Tipo de Formación: Radio Selector Matrix */}
            <div className="space-y-2 pt-2">
              <label className="font-label-md text-label-md font-semibold text-primary block">
                Tipo de Formación o Intervención Solicitada <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                <label
                  onClick={() => setTipoFormacion('tecnica')}
                  className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-colors ${
                    tipoFormacion === 'tecnica'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_formacion"
                    checked={tipoFormacion === 'tecnica'}
                    onChange={() => setTipoFormacion('tecnica')}
                    className="mt-1 text-secondary focus:ring-secondary border-outline"
                  />
                  <div>
                    <span className="font-label-md text-label-md font-bold text-primary block">
                      Capacitación Técnica Obligatoria
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Actualización de protocolos estandarizados para personal ingresante o rotativo.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setTipoFormacion('interdisciplinario')}
                  className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-colors ${
                    tipoFormacion === 'interdisciplinario'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_formacion"
                    checked={tipoFormacion === 'interdisciplinario'}
                    onChange={() => setTipoFormacion('interdisciplinario')}
                    className="mt-1 text-secondary focus:ring-secondary border-outline"
                  />
                  <div>
                    <span className="font-label-md text-label-md font-bold text-primary block">
                      Taller Interdisciplinario Territorial
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Articulación práctica entre equipos legales, sociales y de salud comunitaria.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setTipoFormacion('juridica')}
                  className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-colors ${
                    tipoFormacion === 'juridica'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_formacion"
                    checked={tipoFormacion === 'juridica'}
                    onChange={() => setTipoFormacion('juridica')}
                    className="mt-1 text-secondary focus:ring-secondary border-outline"
                  />
                  <div>
                    <span className="font-label-md text-label-md font-bold text-primary block">
                      Actualización Jurídica / Marco Legal
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Reformas en derechos de NNA, jurisprudencia y régimen penal juvenil.
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setTipoFormacion('comunitaria')}
                  className={`flex items-start gap-3 p-3.5 border rounded-lg cursor-pointer transition-colors ${
                    tipoFormacion === 'comunitaria'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo_formacion"
                    checked={tipoFormacion === 'comunitaria'}
                    onChange={() => setTipoFormacion('comunitaria')}
                    className="mt-1 text-secondary focus:ring-secondary border-outline"
                  />
                  <div>
                    <span className="font-label-md text-label-md font-bold text-primary block">
                      Jornada Comunitaria de Prevención
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      Convocatoria con actores territoriales, docentes y organizaciones barriales.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* SECCIÓN 2: TEMÁTICA Y JUSTIFICACIÓN */}
          <section className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant shadow-sm space-y-space-md">
            <div className="flex items-center gap-2 border-b border-outline-variant pb-space-sm">
              <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary font-bold text-label-md">
                2
              </div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                Sección 2 - Temática y Justificación Pedagógica
              </h2>
            </div>

            <div className="space-y-1">
              <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="tematica">
                Temática Específica del Taller <span className="text-error">*</span>
              </label>
              <input
                id="tematica"
                type="text"
                required
                value={tematica}
                onChange={(e) => setTematica(e.target.value)}
                className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
              <p className="font-label-sm text-label-sm text-outline">
                Enuncie con precisión técnica el objeto de aprendizaje o el módulo requerido.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="justificacion">
                Justificación de la Demanda Territorial <span className="text-error">*</span>
              </label>
              <textarea
                id="justificacion"
                rows={4}
                required
                value={justificacion}
                onChange={(e) => setJustificacion(e.target.value)}
                placeholder="Describa el diagnóstico de situación territorial, los casos testigo recientes que fundamentan la necesidad del taller..."
                className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20"
              />
              <div className="flex justify-between items-center text-label-sm text-outline pt-1">
                <span>Mínimo 150 caracteres. Sujeto a dictamen pedagógico.</span>
                <span className="font-mono">{justificacion.length}/1000</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md pt-2">
              <div className="space-y-1">
                <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="destinatarios">
                  Población Destinataria
                </label>
                <select
                  id="destinatarios"
                  value={destinatarios}
                  onChange={(e) => setDestinatarios(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                >
                  <option>Equipos de Primera Escucha y Asistentes Sociales</option>
                  <option>Defensores Públicos y Asesores de Menores</option>
                  <option>Personal Administrativo y Notificadores</option>
                  <option>Red Interdisciplinaria Ampliada (Salud / Educación)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="participantes">
                  Cantidad Estimada de Participantes <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <input
                    id="participantes"
                    type="number"
                    min="5"
                    max="150"
                    value={participantes}
                    onChange={(e) => setParticipantes(Number(e.target.value))}
                    className="w-full h-10 pl-3 pr-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-label-sm text-outline">
                    agentes
                  </span>
                </div>
                <p className="font-label-sm text-label-sm text-outline">
                  Capacidad recomendada para metodología taller: 20 a 45 personas.
                </p>
              </div>
            </div>
          </section>

          {/* SECCIÓN 3: LOGÍSTICA Y FECHAS */}
          <section className="bg-surface-container-lowest p-space-lg rounded-xl border border-outline-variant shadow-sm space-y-space-md">
            <div className="flex items-center gap-2 border-b border-outline-variant pb-space-sm">
              <div className="w-7 h-7 rounded bg-surface-container flex items-center justify-center text-primary font-bold text-label-md">
                3
              </div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                Sección 3 - Logística y Fechas Propuestas
              </h2>
            </div>

            <div className="space-y-2">
              <label className="font-label-md text-label-md font-semibold text-primary block">
                Modalidad Sugerida de Dictado <span className="text-error">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                <label
                  onClick={() => setModalidad('presencial')}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    modalidad === 'presencial'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="modalidad"
                    checked={modalidad === 'presencial'}
                    onChange={() => setModalidad('presencial')}
                    className="text-secondary focus:ring-secondary border-outline"
                  />
                  <span className="material-symbols-outlined text-secondary text-[20px]">apartment</span>
                  <span className="font-label-md text-label-md font-semibold text-primary">Presencial en Sub-Sede</span>
                </label>

                <label
                  onClick={() => setModalidad('virtual')}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    modalidad === 'virtual'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="modalidad"
                    checked={modalidad === 'virtual'}
                    onChange={() => setModalidad('virtual')}
                    className="text-secondary focus:ring-secondary border-outline"
                  />
                  <span className="material-symbols-outlined text-outline text-[20px]">videocam</span>
                  <span className="font-label-md text-label-md font-semibold text-primary">Virtual Sincrónica</span>
                </label>

                <label
                  onClick={() => setModalidad('hibrida')}
                  className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                    modalidad === 'hibrida'
                      ? 'bg-surface-container-low border-secondary'
                      : 'bg-surface-container-lowest border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="modalidad"
                    checked={modalidad === 'hibrida'}
                    onChange={() => setModalidad('hibrida')}
                    className="text-secondary focus:ring-secondary border-outline"
                  />
                  <span className="material-symbols-outlined text-outline text-[20px]">devices</span>
                  <span className="font-label-md text-label-md font-semibold text-primary">Híbrida</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-1">
              <div className="space-y-1">
                <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="fecha_preferente">
                  Fecha Estimada Preferente <span className="text-error">*</span>
                </label>
                <input
                  id="fecha_preferente"
                  type="date"
                  required
                  value={fechaPreferente}
                  onChange={(e) => setFechaPreferente(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
                <p className="font-label-sm text-label-sm text-outline">Antelación mínima sugerida: 20 días hábiles.</p>
              </div>

              <div className="space-y-1">
                <label className="font-label-md text-label-md font-semibold text-primary" htmlFor="fecha_alternativa">
                  Fecha Alternativa de Respaldo <span className="text-error">*</span>
                </label>
                <input
                  id="fecha_alternativa"
                  type="date"
                  required
                  value={fechaAlternativa}
                  onChange={(e) => setFechaAlternativa(e.target.value)}
                  className="w-full h-10 px-3 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-secondary focus:ring-2 focus:ring-secondary/20"
                />
                <p className="font-label-sm text-label-sm text-outline">Para contingencias en la agenda de capacitadores.</p>
              </div>
            </div>

            {/* Checkboxes de recursos */}
            <div className="space-y-2 pt-2 border-t border-outline-variant">
              <label className="font-label-md text-label-md font-semibold text-primary block">
                Recursos y Facilidades Disponibles en la Sub-Sede
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recursos.audiovisual}
                    onChange={(e) => setRecursos({ ...recursos, audiovisual: e.target.checked })}
                    className="rounded text-secondary focus:ring-secondary border-outline"
                  />
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">tv</span>
                    <span className="font-body-md text-body-md text-on-surface">Equipamiento audiovisual (Proyector/Audio)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recursos.salon}
                    onChange={(e) => setRecursos({ ...recursos, salon: e.target.checked })}
                    className="rounded text-secondary focus:ring-secondary border-outline"
                  />
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">groups</span>
                    <span className="font-body-md text-body-md text-on-surface">Salón con capacidad para 40 personas</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recursos.conectividad}
                    onChange={(e) => setRecursos({ ...recursos, conectividad: e.target.checked })}
                    className="rounded text-secondary focus:ring-secondary border-outline"
                  />
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">wifi</span>
                    <span className="font-body-md text-body-md text-on-surface">Conectividad de red de alta velocidad (Fibra)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recursos.refrigerio}
                    onChange={(e) => setRecursos({ ...recursos, refrigerio: e.target.checked })}
                    className="rounded text-secondary focus:ring-secondary border-outline"
                  />
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-[20px]">coffee</span>
                    <span className="font-body-md text-body-md text-on-surface">Espacio para refrigerio / Coffee break</span>
                  </div>
                </label>
              </div>
            </div>
          </section>

          {/* ACTION FOOTER BAR */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm flex flex-col sm:flex-row items-center justify-between gap-space-md sticky bottom-4 z-30">
            <div className="flex items-center gap-2 text-outline font-label-md text-label-md">
              <span className="material-symbols-outlined text-on-tertiary-container text-[18px]">check_circle</span>
              <span>Borrador listo para envío oficial</span>
            </div>
            <div className="flex items-center gap-space-sm w-full sm:w-auto">
              <button
                type="button"
                onClick={onVolver}
                className="flex-1 sm:flex-initial h-10 px-5 rounded-lg border border-outline-variant bg-surface-container-lowest text-primary font-label-md text-label-md hover:bg-surface-container-low transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-initial h-10 px-6 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm flex items-center justify-center gap-2 font-bold disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>{loading ? 'Enviando...' : 'Enviar Solicitud a Sede Central'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* RIGHT 4-COLUMN: GUIDELINES */}
        <aside className="lg:col-span-4 space-y-space-md">
          {/* Criterios Card */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm space-y-space-md">
            <div className="flex items-center gap-2 pb-space-xs border-b border-outline-variant">
              <span className="material-symbols-outlined text-secondary">fact_check</span>
              <h3 className="font-headline-sm text-headline-sm font-bold text-primary">Criterios de Evaluación</h3>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              La Dirección Pedagógica Central pondera las solicitudes territoriales bajo los siguientes estándares:
            </p>
            <ul className="space-y-3 font-body-sm text-body-sm text-on-surface-variant">
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary shrink-0 text-[18px]">check</span>
                <span>
                  <strong>Incidencia de Casos Críticos:</strong> Coherencia entre la fundamentación territorial y los reportes ingresados.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary shrink-0 text-[18px]">check</span>
                <span>
                  <strong>Impacto Multiplicador:</strong> Compromiso de transferir conocimientos a sus mesas barriales.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-secondary shrink-0 text-[18px]">check</span>
                <span>
                  <strong>Viabilidad de Agenda:</strong> Compatibilidad de traslados con los cronogramas docentes.
                </span>
              </li>
            </ul>

            <div className="p-3 bg-surface-container rounded-lg border border-outline-variant flex items-start gap-2.5">
              <span className="material-symbols-outlined text-secondary shrink-0 text-[20px]">info</span>
              <div className="space-y-0.5">
                <span className="font-label-md text-label-md font-bold text-primary block">Tiempos de Respuesta</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Las solicitudes son dictaminadas formalmente en un plazo de <strong>48 a 72 hs hábiles</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* Contacto Card */}
          <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant shadow-sm space-y-space-sm">
            <div className="flex items-center gap-2 pb-space-xs border-b border-outline-variant">
              <span className="material-symbols-outlined text-secondary">school</span>
              <h3 className="font-headline-sm text-headline-sm font-bold text-primary">Área Pedagógica Central</h3>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-label-lg shrink-0">
                  DP
                </div>
                <div>
                  <div className="font-label-md text-label-md font-bold text-primary">Dirección de Formación Continua</div>
                  <div className="font-body-sm text-body-sm text-outline">Sede Central - DDNNA</div>
                </div>
              </div>
              <div className="pt-2 space-y-1.5 font-body-sm text-body-sm text-on-surface-variant border-t border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[16px]">mail</span>
                  <a className="text-secondary hover:underline truncate" href="mailto:capacitacion.central@ddnna.gob.ar">
                    capacitacion.central@ddnna.gob.ar
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[16px]">call</span>
                  <span className="font-mono">Internos: 4102 / 4105</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-outline text-[16px]">pin_drop</span>
                  <span>Av. de Mayo 760, Piso 4, CABA</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
