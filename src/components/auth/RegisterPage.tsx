import React, { useState } from 'react';
import { registerUser } from '../../services/auth';

interface Props {
  onSuccess: () => void;
  onNavigateToLogin: () => void;
}

export const RegisterPage: React.FC<Props> = ({
  onSuccess,
  onNavigateToLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalAgree, setLegalAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (!legalAgree) {
      setError('Debés aceptar los términos de uso institucional y la política de confidencialidad.');
      return;
    }

    setLoading(true);

    try {
      const res = await registerUser({
        nombreCompleto: fullName,
        dni,
        email,
        password,
      });

      if (res.session) {
        onSuccess();
      } else {
        setSuccessMessage('¡Cuenta creada con éxito! Si tu proyecto requiere confirmación por correo, revisá tu casilla antes de ingresar.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al registrar la cuenta institucional.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col font-body-md text-on-surface bg-background antialiased selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      {/* Top Informational Strip */}
      <header className="bg-primary-container text-surface-container-low py-1.5 px-4 text-center border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between font-label-sm text-label-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-secondary-container"></span>
            <span className="tracking-wide">
              PORTAL DE GESTIÓN TERRITORIAL · CANAL OFICIAL DE REGISTRO INSTITUCIONAL
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-outline-variant">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              Cifrado TLS 1.3
            </span>
            <span>Mesa de Ayuda Central: 0800-444-DDNNA</span>
          </div>
        </div>
      </header>

      {/* Main Split Canvas */}
      <main className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto min-h-[calc(100vh-36px)]">
        {/* LEFT PANEL: Institutional Identity & Legal Directives */}
        <aside className="lg:w-[42%] xl:w-[38%] bg-surface-container-low border-b lg:border-b-0 lg:border-r border-outline-variant/50 p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-surface-variant/40 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-8 relative z-10">
            {/* Official Institution Logo & Emblem */}
            <div className="flex items-center gap-4">
              <img
                alt="Escudo oficial de la Defensoría de Niñas, Niños y Adolescentes"
                className="w-16 h-16 object-contain rounded-xl shadow-sm bg-surface-container-lowest p-1 border border-outline-variant/40"
                src="https://lh3.googleusercontent.com/aida/AEtjO1XB-J1k1FR45w_IvnwIbxFMT6U74_p4X3nqn4xN2_V3uTyOUu7T6GyZtYVp5Rb7M6LHBG5hm7SemlmPAEmp25foWHmVSKP_KGQb5Pz11PkRJyrCzyTAyrUFWctin8lzcNlzJ6op3Nh06CnLuagQeskQJ8dMa1hUTJg1VvI8gCioPsKNtwu0CiYGEXI7xGFscKTSTXkXYvFOlsjn5mUROxbcoFxtNNFa8bkG9l_xFOPuR-gsN0t_WMDsJHE"
              />
              <div>
                <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-primary block">DEFENSORÍA</span>
                <span className="font-label-lg text-label-lg font-bold text-secondary tracking-wide block">NIÑAS, NIÑOS Y ADOLESCENTES</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant/90 block">Sistema Integral de Gestión Territorial</span>
              </div>
            </div>

            {/* Institutional Mission Framing */}
            <div className="space-y-3 pt-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[15px]">person_add</span>
                <span>Alta de Usuario Oficial</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
                Crear Cuenta Institucional
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                Registrá tu usuario básico para ingresar al Portal de Gestión. La vinculación a tu Sub-Sede y validación de funciones se gestionarán desde tu perfil tras el ingreso.
              </p>
            </div>

            {/* Validation Sequence Stepper */}
            <div className="space-y-3">
              <h2 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">
                Proceso de Habilitación Ágil
              </h2>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-lowest border-l-4 border-secondary shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-label-sm text-label-sm font-bold shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-primary">Creación de Cuenta</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Datos esenciales de acceso y autenticación.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/40">
                  <div className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center font-label-sm text-label-sm font-semibold shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-label-md text-label-md font-semibold text-primary">Legajo y Territorialidad</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Carga posterior de sub-sede y credenciales en tu panel.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Legal Guardrail Badge */}
            <div className="p-4 rounded-lg bg-surface-container border border-outline-variant/60 flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary shrink-0 mt-0.5">policy</span>
              <div className="space-y-1">
                <p className="font-label-md text-label-md font-semibold text-primary">Marco Normativo Vigente</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-normal">
                  El uso indebido de los accesos institucionales constituye delito tipificado en los términos de la <strong className="font-semibold text-primary">Ley 26.061</strong> (Protección Integral de Derechos) y la <strong className="font-semibold text-primary">Ley 25.326</strong> (Protección de Datos Personales).
                </p>
              </div>
            </div>
          </div>

          {/* Left Bottom Support */}
          <div className="pt-8 border-t border-outline-variant/40 relative z-10 flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">verified</span>
              Dirección de Tecnologías Institucionales
            </span>
            <a className="text-secondary font-label-sm text-label-sm hover:underline flex items-center gap-0.5" href="#ayuda">
              Manual de Agente
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            </a>
          </div>
        </aside>

        {/* RIGHT PANEL: Registration Form Workspace */}
        <section className="flex-1 bg-surface-container-lowest p-6 sm:p-10 lg:p-14 flex flex-col justify-between overflow-y-auto">
          <div className="max-w-2xl mx-auto w-full space-y-8">
            {/* Header of Form */}
            <div className="border-b border-outline-variant/40 pb-6 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-label-sm text-label-sm tracking-wider uppercase font-semibold text-secondary">
                  Portal DDNNA · Registro
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                  <span className="material-symbols-outlined text-[13px] text-secondary">domain</span>
                  Área Técnica y Territorial
                </span>
              </div>
              <h2 className="font-headline-lg text-headline-lg font-bold text-primary">Crear Cuenta</h2>
              <p className="font-body-md text-body-md text-on-surface-variant">
                Ingresá tus datos esenciales para generar tu cuenta de acceso institucional.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-error-container text-on-error-container text-body-sm rounded-lg flex items-start gap-2 border border-error/30">
                <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 bg-[#CCFBF1] text-[#0F766E] text-body-sm rounded-lg flex items-start gap-2 border border-teal-300">
                <span className="material-symbols-outlined text-[20px] shrink-0">check_circle</span>
                <div>
                  <p className="font-bold">{successMessage}</p>
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="mt-2 text-secondary font-bold underline block"
                  >
                    Ir a Iniciar Sesión →
                  </button>
                </div>
              </div>
            )}

            {/* Registration Form */}
            <form className="space-y-8" onSubmit={handleSubmit}>
              {/* Informative Reassuring Banner */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-secondary/30 flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary text-[22px] shrink-0 mt-0.5">info</span>
                <div className="space-y-1">
                  <p className="font-label-md text-label-md font-semibold text-primary">Completá el resto luego</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    El resto de tus datos institucionales, asignación de sub-sede y documentación obligatoria se completarán desde tu Perfil de Legajo Digital una vez creada la cuenta.
                  </p>
                </div>
              </div>

              {/* Essential Inputs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-label-md text-label-md font-medium text-on-surface" htmlFor="full_name">
                    Nombre y Apellido completo <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full h-11 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all"
                      id="full_name"
                      placeholder="Ej. Mariana Soledad Benítez"
                      required
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    <span className="absolute right-3 top-3 text-outline text-[18px] material-symbols-outlined">person</span>
                  </div>
                </div>

                {/* DNI / CUIL */}
                <div className="space-y-1">
                  <label className="block font-label-md text-label-md font-medium text-on-surface" htmlFor="cuil">
                    DNI / CUIL <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full h-11 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all"
                      id="cuil"
                      placeholder="Ej. 27-33444555-4"
                      required
                      type="text"
                      value={dni}
                      onChange={(e) => setDni(e.target.value)}
                    />
                    <span className="absolute right-3 top-3 text-outline text-[18px] material-symbols-outlined">badge</span>
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="block font-label-md text-label-md font-medium text-on-surface" htmlFor="email">
                    Correo electrónico <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full h-11 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all"
                      id="email"
                      placeholder="nombre.apellido@ddnna.gob.ar"
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <span className="absolute right-3 top-3 text-outline text-[18px] material-symbols-outlined">mail</span>
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="block font-label-md text-label-md font-medium text-on-surface" htmlFor="password_field">
                    Contraseña <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full h-11 px-3 pr-10 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all"
                      id="password_field"
                      placeholder="••••••••••••"
                      required
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      className="absolute right-3 top-3 text-outline hover:text-primary"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1">
                  <label className="block font-label-md text-label-md font-medium text-on-surface" htmlFor="confirm_password_field">
                    Confirmar contraseña <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <input
                      className="w-full h-11 px-3 pr-10 rounded-lg border border-outline-variant bg-surface-container-lowest font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/20 focus:outline-none transition-all"
                      id="confirm_password_field"
                      placeholder="••••••••••••"
                      required
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      className="absolute right-3 top-3 text-outline hover:text-primary"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showConfirmPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Terms Check */}
              <div className="flex items-start gap-3 pt-1">
                <input
                  className="mt-1 w-4 h-4 rounded text-secondary border-outline-variant focus:ring-secondary focus:ring-offset-0 transition-colors"
                  id="legal_agree"
                  required
                  type="checkbox"
                  checked={legalAgree}
                  onChange={(e) => setLegalAgree(e.target.checked)}
                />
                <label className="font-body-sm text-body-sm text-on-surface-variant select-none" htmlFor="legal_agree">
                  Acepto los términos de uso institucional y la política de confidencialidad y protección de datos (
                  <strong className="text-primary">Ley 26.061</strong> y <strong className="text-primary">Ley 25.326</strong>).
                </label>
              </div>

              {/* Actions */}
              <div className="pt-2 space-y-4">
                <button
                  className="w-full h-11 px-6 rounded-lg bg-primary-container hover:bg-primary text-on-primary font-label-lg text-label-lg font-semibold flex items-center justify-center gap-2 shadow-sm focus:ring-2 focus:ring-secondary focus:ring-offset-2 transition-all disabled:opacity-60"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">person_add</span>
                      <span>Crear Cuenta</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 pt-2 text-center">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">¿Ya tenés cuenta?</span>
                  <button
                    type="button"
                    onClick={onNavigateToLogin}
                    className="inline-flex items-center gap-1 font-label-lg text-label-lg font-semibold text-secondary hover:underline"
                  >
                    <span>Iniciar sesión</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Institutional Footer */}
          <footer className="mt-12 pt-6 border-t border-outline-variant/40 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4 font-label-sm text-label-sm text-on-surface-variant">
            <div>
              <span>© 2025 Defensoría de los Derechos de Niñas, Niños y Adolescentes.</span>
              <span className="hidden md:inline text-outline-variant"> · República Argentina.</span>
            </div>
            <div className="flex items-center gap-4 text-outline-variant">
              <a className="hover:text-primary transition-colors" href="#terminos">Términos de Operación</a>
              <span className="text-outline-variant">·</span>
              <a className="hover:text-primary transition-colors" href="#politica-privacidad">Protocolo de Privacidad Ley 25.326</a>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
};
