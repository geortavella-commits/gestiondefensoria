# Gestión Interna DDNA

PWA de gestión interna de la Defensoría de Niñas, Niños y Adolescentes (Córdoba).
Legajo digital del personal, sub-sedes, áreas, capacitaciones y notas de pedido.

- **Tipo:** institucional / municipal (no es multi-tenant de comercio: no usar la skill `supabase-comercio-multitenant`).
- **Supabase:** proyecto `coordinaciondefensoria`, ref `ubzkzjdnajofjfsrhbhu` (us-west-2, Postgres 17).
- **Repo:** https://github.com/darioanzaudo2017/ddnagestion2026 (rama `main`).
- **Estado:** en desarrollo local, sin deploy todavía.
- **Reparto de trabajo:** el frontend lo genera Gemini a partir de Stitch; Claude se ocupa de Supabase (esquema, RLS, Edge Functions) y de revisar lo que entrega Gemini.

## Stack
React 18 + TypeScript 5.5 + Vite 5 + Tailwind 3.4 (tokens de diseño de Stitch en `tailwind.config.js`), `vite-plugin-pwa`, `@supabase/supabase-js` 2, `jspdf` (PDF de notas de pedido). `react-router-dom` está instalado pero no se usa: la navegación es por estado en `App.tsx`.

Comandos: `npm run dev`, `npm run build` (`tsc -b && vite build`). Verificar tipos con `npx tsc -b --noEmit`.

## Estructura
```
src/
  App.tsx                 # solo arma el layout y la navegación por secciones
  hooks/useAuthSession.ts # ÚNICO dueño de sesión, rol real y legajo seleccionado
  services/               # toda llamada a Supabase va acá, nunca desde componentes
  components/<modulo>/    # auth, layout, tablero, personal, legajo, subsedes,
                          # capacitaciones, notas, usuarios, reportes
  types/legajo.ts  utils/legajoCalculations.ts  utils/notaPedidoPdf.ts
supabase/
  migrations/             # OJO: incompleto, ver Pendientes
  functions/admin-create-user/
```

## Base de datos
**Roles** (`rol_usuario`): `coordinacion_general`, `administrador` (ambos = "gestión", ven todo), `jefe_area`, `referente_subsede`, `personal`.

**Núcleo:** `profiles` (extiende `auth.users`; el trigger `handle_new_user` crea la fila con nombre/apellido/dni), `areas`, `sub_sedes`, `tipos_documento` (13 tipos), `documentos_personal`, `notificaciones`, `auditoria`.
**Capacitaciones:** `solicitudes_capacitacion`, `capacitaciones_realizadas`, `asistentes_capacitacion`.
**Notas de pedido:** `notas_pedido`, `notas_pedido_items`, `notas_pedido_historial`, `notas_pedido_contador`.
**Jerarquía:** `area_supervision (area_supervisora_id, area_supervisada_id)`.

**Áreas y sub-sedes son dos ejes distintos** (dónde trabaja alguien vs. a qué equipo pertenece). No mezclarlas en una tabla. Un perfil tiene `area_id` y `sub_sede_id` independientes.

**Flags dinámicos en `areas`** (se editan con datos, no con código): `es_coordinadora_subsedes`, `atiende_capacitaciones` (hoy Prensa y Protección), `recibe_notas_pedido` (hoy Administración).

**Funciones de RLS** (`security definer`, EXECUTE solo a `authenticated`): `mi_rol()`, `mi_area()`, `mi_subsede()`, `es_gestion()`, `es_coordinador_subsedes()`, `es_administracion()`, `areas_visibles()` (área propia + las que supervisa vía `area_supervision`).

### Flujos con etapas (reglas validadas por triggers en la base, no en el front)
- **Capacitaciones** (`validar_transicion_solicitud`): enviada → Coordinación de Subsedes deriva (`derivada_area`) → el área aprueba (`aprobada_area`) → Coordinación carga `google_form_url` (`aprobada`) → la sub-sede marca `form_enviado_at`. Postergada/suspendida (motivo obligatorio) en cualquier etapa; reactivar solo Coordinación. Puede solicitar una sub-sede o un área, más la institución/persona externa.
- **Notas de pedido** (`validar_transicion_nota`): borrador → enviada (asigna `NP-AAAA-NNN`, exige ítems con precio) → recibida (Administración) → aprobada | observada (vuelve al área, motivo obligatorio). Nadie resuelve una nota propia salvo gestión. El historial se registra solo.

## Reglas que no se rompen
- Nunca escribir keys/tokens en el código. `VITE_*` va al bundle: nada secreto ahí. `service_role` solo en Edge Functions.
- Nunca deshabilitar RLS. Toda tabla nueva: RLS + policies + índices en FKs.
- Operaciones privilegiadas (crear usuarios, etc.) van por **Edge Function** con `service_role`. `signUp()` desde el cliente reemplaza la sesión del admin.
- RLS filtra filas, no columnas: los cambios de columnas sensibles se protegen con triggers (`prevent_privilege_escalation`, validadores de transición). Los triggers dejan pasar a `service_role`.
- **Nunca inventar datos.** Sin datos reales se muestra 0 o un estado vacío, jamás relleno, números fijos ni personas de ejemplo. Ya hubo que limpiar esto en 5 módulos generados por Gemini.
- Los componentes no llaman a Supabase directo; los servicios **lanzan** el error en vez de tragarlo (`|| []` sobre un `data` con error oculta fallas).

## Gotchas de Supabase
- **Embeds ambiguos:** `sub_sedes`↔`profiles`, `areas`↔`profiles` y `documentos_personal`→`profiles` tienen más de una FK. Siempre con pista: `sub_sedes:sub_sede_id(...)`, `areas:area_id(...)`, `profiles:profile_id(...)`. Sin pista la consulta falla y devuelve vacío.
- Toda función `security definer` nueva: `revoke execute ... from public, anon` y `grant ... to authenticated` (si no, el advisor la marca).
- Storage: bucket privado `documentos-personal`, path `{profile_id}/archivo`. Se ve/descarga con URL firmada de 60 s (`getSignedUrlDocumento`); `documentos_personal.archivo_path` guarda el path, no una URL.
- Login por DNI: RPC `email_por_dni` (la única accesible para `anon`).
- `execute_sql` del MCP devuelve solo el resultado de la última sentencia. Para probar flujos con rollback: bloque `DO` que termina en `raise exception`.
- Los archivos `.env*` están bloqueados por permisos de Claude Code; el `.env.local` lo crea el usuario. Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Convenciones
- Español rioplatense en la UI. Tokens de Tailwind de Stitch (`primary-container`, `surface-container-lowest`, `label-md`, etc.); íconos Material Symbols.
- Cuando Gemini reescribe un archivo entero puede revertir arreglos previos (pasó 4 veces en `App.tsx`). La lógica de sesión/rol vive en `useAuthSession`, no volver a ponerla inline. El selector de agentes solo cambia el legajo mirado, **nunca** `currentUserRole`.
- Los permisos de UI se calculan con el perfil del usuario **logueado** (`listaPerfiles.find(p => p.id === currentUserId)`), no con el legajo seleccionado.

## Pendientes conocidos
- **Migraciones desactualizadas en el repo:** solo están `..01` y `..02`. Todo lo aplicado después por MCP (bucket y policies de Storage, `email_por_dni`, `archivo_path`, `area_supervision` + `areas_visibles`, flujo de capacitaciones, notas de pedido, seed de áreas) existe en la base pero no en `supabase/migrations`. Exportarlas antes de clonar o reconstruir el proyecto.
- `services/reportes.ts` sigue con datos inventados sin decidir (`dotacionCrecimientoPct`, `evolucionHoras`, `matrizAuditoria`, `asistenciaObligatoriaPct`).
- Falta pantalla para crear/editar **áreas** y para administrar `area_supervision` (hoy se cargan por SQL).
- Notificaciones: el botón "Notificar Agente" del tablero solo muestra un toast, no envía nada. Plan: trigger + Edge Function + proveedor de mail (Resend o SMTP) y registro en `notificaciones`. Requiere URL pública de la app.
- Sin construir: sección "Documentación & Alertas"; carga masiva ZIP; PDF de reporte mensual; generación de la "nota formal" de capacitaciones (`nota_generada_url`). El "Modo Exploración" del login no funciona con RLS real.
- Activar "Leaked password protection" en Supabase Auth (Dashboard, no se puede por SQL).
- Deploy en Vercel (usar la skill `vercel-deploy`) y auditoría de seguridad previa.
- Faltan usuarios de prueba por área/sub-sede para probar los flujos con distintos roles (solo existe el usuario gestión).
