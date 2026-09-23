import React, { useState } from 'react';
import { loginUser } from '../../services/auth';

interface Props {
  onSuccess: () => void;
  onNavigateToRegister: () => void;
  onBypassDemo?: () => void;
}

export const LoginPage: React.FC<Props> = ({
  onSuccess,
  onNavigateToRegister,
  onBypassDemo,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginUser(identifier, password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface antialiased flex flex-col lg:flex-row">
      {/* PANEL LATERAL IZQUIERDO: Área Institucional & Garantías Éticas */}
      <aside className="lg:w-5/12 xl:w-4/12 bg-primary-container text-on-primary flex flex-col justify-between p-space-lg lg:p-space-xl border-r border-outline-variant relative overflow-hidden">
        {/* Decoración sutil de fondo */}
        <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-secondary opacity-10 pointer-events-none blur-3xl"></div>
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-secondary-container opacity-10 pointer-events-none blur-2xl"></div>

        <div className="relative z-10">
          {/* Badge Superior de Seguridad Institucional */}
          <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-lowest/10 border border-surface-container-lowest/20 mb-space-lg backdrop-blur-sm">
            <span className="material-symbols-outlined text-secondary-fixed text-sm">lock</span>
            <span className="font-label-sm text-label-sm text-secondary-fixed tracking-wide">
              CANAL SEGURO TLS 1.3 • DATOS SENSIBLES CIFRADOS
            </span>
          </div>

          {/* Escudo / Imagotipo Oficial DDNNA */}
          <div className="mb-space-lg bg-surface-container-lowest rounded-xl p-space-md inline-block shadow-sm">
            <img
              alt="Imagotipo Institucional Defensoría de los Derechos de Niñas, Niños y Adolescentes"
              className="h-16 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1XzmwK3oHXTnMexeB1oHHMYEbLSNj_kpoNBvYdlFVbGkEu4MjLiw92L_q9cTz3QPQ50iQ3rhOHxhg0qfqJRTHP3jsxAxVRlnVCXPxfQch79yEcG_wRW3sU7aJzIVNceLXoIDR8E3RG-NE35jX1XrqNYIe4P0enrxCxkQte7ZeOZ0KS6-Sf66ZMAiTLtb6ze9JuECQM_AiHcbdMkOUABU7Bnfh83gjS4_U3X431zo0tUxnOVsB6F-JIOF6Uq"
            />
          </div>

          {/* Título y Mensaje de Bienvenida Institucional */}
          <h1 className="font-display-lg text-display-lg text-on-primary mb-space-sm font-bold tracking-tight">
            Portal Integral de Gestión Territorial
          </h1>
          <p className="font-headline-sm text-headline-sm text-secondary-fixed mb-space-md font-medium">
            Defensoría DDNNA • Sistema Institucional
          </p>
          <p className="font-body-md text-body-md text-on-primary-container leading-relaxed mb-space-lg text-justify">
            Plataforma centralizada de registro, seguimiento territorial y tutela activa de los derechos fundamentales de niñas, niños y adolescentes en concordancia con el marco legal nacional de protección integral.
          </p>

          {/* Bloque de Compromiso Legal y Auditoría */}
          <div className="bg-surface-container-lowest/5 border border-surface-container-lowest/15 rounded-xl p-space-md mb-space-lg">
            <div className="flex items-start gap-space-sm">
              <span className="material-symbols-outlined text-secondary-container text-xl mt-0.5">verified_user</span>
              <div>
                <h2 className="font-label-lg text-label-lg text-on-primary">Protocolo de Confidencialidad Reforzado</h2>
                <p className="font-body-sm text-body-sm text-on-primary-container mt-1">
                  Toda consulta de legajos, denuncias o actuaciones territoriales queda registrada en libros digitales inmutables con trazabilidad horaria por agente interviniente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del Panel: Mesa de Ayuda y Soporte */}
        <div className="relative z-10 border-t border-surface-container-lowest/15 pt-space-md mt-space-lg">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm text-on-primary-container font-label-md text-label-md">
              <span className="material-symbols-outlined text-secondary-fixed text-base">support_agent</span>
              <span>Mesa de Ayuda Técnica Central: <strong>0800-333-DDNNA (3366)</strong></span>
            </div>
            <div className="flex items-center gap-space-sm text-on-primary-container font-label-md text-label-md">
              <span className="material-symbols-outlined text-secondary-fixed text-base">mail</span>
              <span>soporte.sistemas@defensorianna.gob.ar</span>
            </div>
            <div className="flex items-center gap-space-sm text-on-primary-container font-label-sm text-label-sm mt-1">
              <span className="material-symbols-outlined text-error text-base">emergency</span>
              <span className="text-error-container">Guardia Pasiva Legal Permanente 24/7 (Sede Central y Sub-Sedes)</span>
            </div>
          </div>
        </div>
      </aside>

      {/* PANEL PRINCIPAL DERECHO: Formulario de Acceso */}
      <main className="lg:w-7/12 xl:w-8/12 flex items-center justify-center p-space-md md:p-space-lg lg:p-space-xl bg-background">
        <div className="w-full max-w-xl">
          {/* Encabezado de la Tarjeta */}
          <div className="mb-space-lg">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm px-space-sm py-1 bg-surface-container-high text-secondary font-semibold rounded">
                CONTROL DE IDENTIDAD • ACCESO SEGURO
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-on-tertiary-container inline-block animate-pulse"></span>
                Servidores Operativos
              </span>
            </div>
            <h2 className="font-display-lg text-display-lg text-primary mt-space-sm font-bold">
              Iniciar Sesión
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              Ingresá con tus credenciales habituales para acceder a tus gestiones y territorio asignado.
            </p>
          </div>

          {/* Tarjeta del Formulario */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-space-lg md:p-space-xl">
            {error && (
              <div className="mb-4 p-3.5 bg-error-container text-on-error-container text-body-sm rounded-lg flex items-start gap-2 border border-error/30">
                <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-space-md" onSubmit={handleSubmit}>
              <div className="p-space-sm bg-surface-container-low border border-outline-variant/60 rounded-lg flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-secondary text-base">info</span>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Una vez que ingreses, podrás completar tu legajo y documentación en tu perfil.
                </p>
              </div>

              <div>
                <label className="block font-label-md text-label-md text-primary font-semibold mb-space-xs" htmlFor="username">
                  Correo electrónico o DNI
                </label>
                <div className="relative">
                  <input
                    className="w-full h-10 pl-10 pr-3 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-colors duration-150"
                    id="username"
                    name="username"
                    placeholder="ej. tu.nombre@defensorianna.gob.ar o DNI"
                    required
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-xl">mail</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-space-xs">
                  <label className="block font-label-md text-label-md text-primary font-semibold" htmlFor="password">
                    Contraseña
                  </label>
                  <a className="font-label-md text-label-md text-secondary hover:underline" href="#recuperar-clave">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative">
                  <input
                    className="w-full h-10 pl-10 pr-10 bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline-variant focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-colors duration-150"
                    id="password"
                    name="password"
                    placeholder="••••••••••••"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-xl">key</span>
                  <button
                    aria-label="Mostrar u ocultar contraseña"
                    className="absolute right-2.5 top-2 text-on-surface-variant hover:text-primary transition-colors p-0.5 rounded"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input
                    className="w-4 h-4 rounded text-secondary border-outline-variant focus:ring-secondary focus:ring-offset-0"
                    name="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="font-body-sm text-body-sm text-on-surface">Recordarme</span>
                </label>
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-secondary">lock</span> Acceso Cifrado
                </span>
              </div>

              <button
                className="w-full h-11 bg-primary-container hover:bg-primary text-on-primary rounded-lg font-label-lg text-label-lg font-semibold flex items-center justify-center gap-space-sm shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">login</span>
                    <span>Iniciar Sesión</span>
                  </>
                )}
              </button>
            </form>

            <div className="relative my-space-lg">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-outline-variant"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-container-lowest px-space-md font-label-sm text-label-sm text-on-surface-variant">
                  ¿NO TENÉS CUENTA?
                </span>
              </div>
            </div>

            <div className="text-center space-y-3">
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="inline-flex items-center justify-center gap-space-xs w-full py-2.5 px-space-md rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors duration-150 font-label-md text-label-md text-primary font-semibold"
              >
                <span className="material-symbols-outlined text-secondary text-lg">person_add</span>
                <span>Registrate aquí / Crear cuenta simple</span>
              </button>

              {onBypassDemo && (
                <button
                  type="button"
                  onClick={onBypassDemo}
                  className="text-label-sm font-label-sm text-secondary hover:underline block w-full text-center"
                >
                  Continuar en Modo Exploración (Ver Legajo Territorial)
                </button>
              )}
            </div>
          </div>

          {/* Advertencia Legal */}
          <div className="mt-space-lg bg-surface-container-low border border-outline-variant rounded-lg p-space-md flex items-start gap-space-sm">
            <span className="material-symbols-outlined text-error text-xl shrink-0 mt-0.5">gavel</span>
            <div className="space-y-1">
              <p className="font-label-md text-label-md font-semibold text-primary">
                Advertencia Legal y Confidencialidad Restringida
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                Acceso exclusivo para funcionarios y personal autorizado. Toda la documentación, legajos e historiales de intervención están amparados por la <strong>Ley N° 26.061 de Protección Integral de los Derechos de las Niñas, Niños y Adolescentes</strong> y la <strong>Ley de Protección de Datos Personales N° 25.326</strong>. La divulgación no autorizada constituye falta grave y delito penal.
              </p>
            </div>
          </div>

          {/* Pie de página */}
          <footer className="mt-space-md text-center">
            <p className="font-label-sm text-label-sm text-outline">
              Defensoría de los Derechos de Niñas, Niños y Adolescentes • Versión 4.12.0-ST
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
};
