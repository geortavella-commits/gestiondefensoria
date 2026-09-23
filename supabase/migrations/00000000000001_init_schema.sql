-- ============================================================================
-- ESQUEMA DE BASE DE DATOS — GESTIÓN INTERNA DDNA
-- Defensoría de Niños, Niñas y Adolescentes
-- Sistema de gestión de personal, documentación, sub-sedes y capacitaciones
-- Motor: Supabase (Postgres + Auth + Storage)
-- ============================================================================

-- ============================================================================
-- 1. TIPOS ENUM
-- ============================================================================

create type rol_usuario as enum (
  'coordinacion_general',   -- máxima autoridad, ve y aprueba todo
  'administrador',          -- gestión operativa del sistema
  'jefe_area',              -- gestiona personal/procesos de su área (todas las sedes)
  'referente_subsede',      -- gestiona personal/procesos de su sede (todas las áreas)
  'personal'                -- agente de base, gestiona su propio perfil
);

create type estado_usuario as enum (
  'activo',
  'inactivo',
  'licencia',
  'baja'
);

create type estado_documento as enum (
  'pendiente',    -- aún no cargado
  'cargado',      -- cargado, esperando revisión
  'aprobado',
  'rechazado',
  'vencido'
);

-- Flujo de solicitudes de capacitación:
-- subsede carga nota -> Coordinación de Subsedes deriva -> área específica evalúa
-- -> Coordinación cierra el proceso y envía el Google Form a la subsede.
-- No existe "rechazo": una capacitación se posterga (cambia de fecha) o se suspende.
-- Tanto Coordinación de Subsedes como el área derivada pueden suspenderla.
create type estado_solicitud as enum (
  'enviada',
  'en_coordinacion',
  'derivada_area',
  'aprobada_area',
  'aprobada',
  'postergada',
  'suspendida',
  'cancelada'
);

create type tipo_bien as enum ('insumo', 'bien_mueble');

create type estado_solicitud_bien as enum (
  'enviada', 'en_revision', 'aprobada', 'entregada', 'rechazada', 'cancelada'
);

-- ============================================================================
-- 2. TABLAS DE ESTRUCTURA ORGANIZACIONAL
-- ============================================================================

-- Áreas funcionales (Legal, Social, Psicología, Protección, Prensa,
-- Coordinación de Subsedes, Administración, etc.)
create table areas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  jefe_area_id uuid,  -- FK a profiles, se agrega luego de crear profiles
  es_coordinadora_subsedes boolean not null default false,  -- marca el área que deriva/cierra solicitudes de capacitación
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sub-sedes / delegaciones territoriales
create table sub_sedes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  direccion text,
  localidad text,
  telefono text,
  referente_id uuid,  -- FK a profiles, se agrega luego de crear profiles
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. PERFILES (extiende auth.users)
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  dni text unique,
  email text not null,
  telefono text,
  cargo text,
  legajo text unique,
  rol rol_usuario not null default 'personal',
  area_id uuid references areas(id) on delete set null,
  sub_sede_id uuid references sub_sedes(id) on delete set null,
  fecha_ingreso date,
  estado estado_usuario not null default 'activo',
  avatar_url text,
  perfil_completo boolean not null default false,
  observaciones_legajo text,  -- notas generales del legajo (columna "Observa" del control físico)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ahora sí, agregamos las FKs circulares
alter table areas
  add constraint fk_areas_jefe foreign key (jefe_area_id) references profiles(id) on delete set null;

alter table sub_sedes
  add constraint fk_subsedes_referente foreign key (referente_id) references profiles(id) on delete set null;

create index idx_profiles_rol on profiles(rol);
create index idx_profiles_area on profiles(area_id);
create index idx_profiles_subsede on profiles(sub_sede_id);

-- Trigger: crear perfil automáticamente al registrarse en auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre, apellido, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger: updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

-- Trigger: evita que un usuario se auto-ascienda o cambie datos sensibles de su
-- propio legajo (rol, área, sub-sede, estado, legajo) sin ser gestión.
-- RLS filtra FILAS, no columnas: sin esto, "profiles_update_propio" permitiría
-- que cualquier "personal" se asigne rol='coordinacion_general' a sí mismo.
create or replace function public.prevent_privilege_escalation()
returns trigger language plpgsql as $$
begin
  if not es_gestion() then
    if new.rol is distinct from old.rol
       or new.area_id is distinct from old.area_id
       or new.sub_sede_id is distinct from old.sub_sede_id
       or new.estado is distinct from old.estado
       or new.legajo is distinct from old.legajo
    then
      raise exception 'No tenés permiso para modificar esos campos';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_profiles_no_escalation
  before update on profiles
  for each row execute function public.prevent_privilege_escalation();

-- ============================================================================
-- 4. DOCUMENTACIÓN DEL PERSONAL
-- ============================================================================

-- Catálogo de tipos de documento requeridos (DNI, título, antecedentes, apto psicofísico...)
create table tipos_documento (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  obligatorio boolean not null default true,
  vigencia_meses int,  -- null = no vence. ej: antecedentes penales cada 12 meses
  activo boolean not null default true
);

-- Documentos cargados por cada agente
create table documentos_personal (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  tipo_documento_id uuid not null references tipos_documento(id),
  archivo_url text,          -- path en Supabase Storage
  archivo_nombre text,
  fecha_carga timestamptz,
  fecha_vencimiento date,
  estado estado_documento not null default 'pendiente',
  revisado_por uuid references profiles(id),
  fecha_revision timestamptz,
  comentarios text,
  created_at timestamptz not null default now(),
  unique (profile_id, tipo_documento_id)
);

create index idx_documentos_profile on documentos_personal(profile_id);
create index idx_documentos_estado on documentos_personal(estado);
create index idx_documentos_tipo on documentos_personal(tipo_documento_id);
create index idx_documentos_vencimiento on documentos_personal(fecha_vencimiento);

-- ============================================================================
-- 5. CAPACITACIONES Y TALLERES
-- ============================================================================

-- Solicitudes que hacen las sub-sedes.
-- Flujo: enviada (subsede) -> en_coordinacion (Coordinación de Subsedes deriva)
-- -> derivada_area (área específica evalúa) -> aprobada_area -> aprobada
-- (Coordinación cierra y envía el Google Form) | postergada | suspendida | cancelada
create table solicitudes_capacitacion (
  id uuid primary key default gen_random_uuid(),
  sub_sede_id uuid not null references sub_sedes(id),
  solicitado_por uuid not null references profiles(id),
  tema text not null,
  descripcion text,
  cantidad_participantes int,
  fecha_propuesta date,
  justificacion text,
  estado estado_solicitud not null default 'enviada',

  -- Paso: nota formal generada a partir del formulario
  nota_generada_url text,

  -- Paso: Coordinación de Subsedes deriva a un área específica
  area_asignada_id uuid references areas(id),
  coordinacion_revisado_por uuid references profiles(id),
  coordinacion_revision_fecha timestamptz,

  -- Paso: el área derivada (Protección, Prensa, etc.) evalúa
  area_revisado_por uuid references profiles(id),
  area_revision_comentario text,
  area_revision_fecha timestamptz,

  -- Paso final: Coordinación cierra el proceso y envía el link del Google Form
  revisado_por uuid references profiles(id),
  comentario_revision text,
  fecha_revision timestamptz,
  google_form_url text,

  -- Motivo cuando estado = postergada | suspendida
  observaciones_estado text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_solicitudes_updated_at
  before update on solicitudes_capacitacion
  for each row execute function public.set_updated_at();

create index idx_solicitudes_subsede on solicitudes_capacitacion(sub_sede_id);
create index idx_solicitudes_estado on solicitudes_capacitacion(estado);
create index idx_solicitudes_area_asignada on solicitudes_capacitacion(area_asignada_id);

-- Capacitaciones efectivamente realizadas (puede o no originarse en una solicitud).
-- La registra quien la organizó: Coordinación de Subsedes, la subsede o el área
-- que la dictó.
create table capacitaciones_realizadas (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid references solicitudes_capacitacion(id),
  nombre text not null,
  fecha date not null,
  modalidad text,  -- presencial / virtual
  capacitador text,
  sub_sede_id uuid references sub_sedes(id),
  area_id uuid references areas(id),

  -- Resultado de la capacitación
  cantidad_participantes int,
  calificacion smallint check (calificacion between 1 and 5),
  observaciones text,
  registrado_por uuid references profiles(id),

  -- Metadata de acreditación (legajo digital)
  carga_horaria int,       -- duración en horas
  entidad_dictante text,   -- institución que dictó la capacitación (puede diferir de `capacitador`, que es la persona)

  created_at timestamptz not null default now()
);

create index idx_capacitaciones_subsede on capacitaciones_realizadas(sub_sede_id);
create index idx_capacitaciones_area on capacitaciones_realizadas(area_id);

-- Asistentes y certificados
create table asistentes_capacitacion (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null references capacitaciones_realizadas(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  asistio boolean default false,
  certificado_url text,
  codigo_acreditacion text,  -- código de verificación del certificado emitido a este agente
  unique (capacitacion_id, profile_id)
);

-- ============================================================================
-- 6. INSUMOS Y BIENES MUEBLES
-- ============================================================================

-- Solicitudes de insumos o bienes muebles, hechas por una subsede o por un área.
create table solicitudes_insumos (
  id uuid primary key default gen_random_uuid(),
  sub_sede_id uuid references sub_sedes(id),
  area_id uuid references areas(id),
  solicitado_por uuid not null references profiles(id),
  tipo tipo_bien not null,
  descripcion text not null,
  cantidad int not null default 1,
  justificacion text,
  estado estado_solicitud_bien not null default 'enviada',
  revisado_por uuid references profiles(id),
  comentario_revision text,
  fecha_revision timestamptz,
  fecha_entrega timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sub_sede_id is not null or area_id is not null)
);

create trigger trg_insumos_updated_at
  before update on solicitudes_insumos
  for each row execute function public.set_updated_at();

create index idx_insumos_subsede on solicitudes_insumos(sub_sede_id);
create index idx_insumos_area on solicitudes_insumos(area_id);
create index idx_insumos_estado on solicitudes_insumos(estado);

-- ============================================================================
-- 7. NOTIFICACIONES Y AUDITORÍA
-- ============================================================================

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  tipo text not null,        -- 'documento_vencido', 'solicitud_aprobada', etc.
  mensaje text not null,
  link text,
  leido boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notificaciones_profile on notificaciones(profile_id, leido);

create table auditoria (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id),
  accion text not null,
  tabla_afectada text,
  registro_id uuid,
  detalle jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. FUNCIONES AUXILIARES PARA RLS (security definer, evitan recursión)
-- ============================================================================

create or replace function public.mi_rol()
returns rol_usuario
language sql security definer stable set search_path = public
as $$ select rol from profiles where id = auth.uid() $$;

create or replace function public.mi_area()
returns uuid
language sql security definer stable set search_path = public
as $$ select area_id from profiles where id = auth.uid() $$;

create or replace function public.mi_subsede()
returns uuid
language sql security definer stable set search_path = public
as $$ select sub_sede_id from profiles where id = auth.uid() $$;

create or replace function public.es_gestion()
returns boolean
language sql security definer stable set search_path = public
as $$ select mi_rol() in ('coordinacion_general','administrador') $$;

create or replace function public.es_coordinador_subsedes()
returns boolean
language sql security definer stable set search_path = public
as $$
  select mi_rol() = 'jefe_area'
    and mi_area() in (select id from areas where es_coordinadora_subsedes)
$$;

-- ============================================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================================

alter table profiles enable row level security;
alter table areas enable row level security;
alter table sub_sedes enable row level security;
alter table tipos_documento enable row level security;
alter table documentos_personal enable row level security;
alter table solicitudes_capacitacion enable row level security;
alter table capacitaciones_realizadas enable row level security;
alter table asistentes_capacitacion enable row level security;
alter table solicitudes_insumos enable row level security;
alter table notificaciones enable row level security;
alter table auditoria enable row level security;

-- ---- PROFILES ----
create policy "profiles_select" on profiles for select
using (
  es_gestion()
  or id = auth.uid()
  or (mi_rol() = 'jefe_area' and area_id = mi_area())
  or (mi_rol() = 'referente_subsede' and sub_sede_id = mi_subsede())
);

create policy "profiles_update_propio" on profiles for update
using (id = auth.uid() or es_gestion())
with check (id = auth.uid() or es_gestion());

create policy "profiles_insert_gestion" on profiles for insert
with check (es_gestion());

-- ---- AREAS / SUB_SEDES (catálogo, lectura amplia, escritura restringida) ----
create policy "areas_select_todos" on areas for select using (true);
create policy "areas_write_gestion" on areas for all
using (es_gestion()) with check (es_gestion());

create policy "subsedes_select_todos" on sub_sedes for select using (true);
create policy "subsedes_write_gestion" on sub_sedes for all
using (es_gestion()) with check (es_gestion());

-- ---- TIPOS_DOCUMENTO (catálogo) ----
create policy "tipos_doc_select_todos" on tipos_documento for select using (true);
create policy "tipos_doc_write_gestion" on tipos_documento for all
using (es_gestion()) with check (es_gestion());

-- ---- DOCUMENTOS_PERSONAL ----
create policy "documentos_select" on documentos_personal for select
using (
  es_gestion()
  or profile_id = auth.uid()
  or (mi_rol() = 'jefe_area' and profile_id in (select id from profiles where area_id = mi_area()))
  or (mi_rol() = 'referente_subsede' and profile_id in (select id from profiles where sub_sede_id = mi_subsede()))
);

create policy "documentos_insert" on documentos_personal for insert
with check (profile_id = auth.uid() or es_gestion());

create policy "documentos_update" on documentos_personal for update
using (
  es_gestion()
  or (mi_rol() = 'jefe_area' and profile_id in (select id from profiles where area_id = mi_area()))
  or (mi_rol() = 'referente_subsede' and profile_id in (select id from profiles where sub_sede_id = mi_subsede()))
  or (profile_id = auth.uid() and estado in ('pendiente','rechazado'))
);

-- ---- SOLICITUDES_CAPACITACION ----
create policy "solicitudes_select" on solicitudes_capacitacion for select
using (
  es_gestion()
  or sub_sede_id = mi_subsede()
  or solicitado_por = auth.uid()
  or (mi_rol() = 'jefe_area' and area_asignada_id = mi_area())
  or es_coordinador_subsedes()
);

create policy "solicitudes_insert" on solicitudes_capacitacion for insert
with check (
  es_gestion()
  or (mi_rol() = 'referente_subsede' and sub_sede_id = mi_subsede())
);

create policy "solicitudes_update" on solicitudes_capacitacion for update
using (
  es_gestion()
  or (solicitado_por = auth.uid() and estado = 'enviada')
  or (mi_rol() = 'jefe_area' and area_asignada_id = mi_area())
  or es_coordinador_subsedes()
);

-- ---- CAPACITACIONES_REALIZADAS ----
-- Además de gestión, puede registrar/editar quien la organizó: la subsede o el área.
create policy "capacitaciones_select_todos" on capacitaciones_realizadas for select using (true);

create policy "capacitaciones_insert" on capacitaciones_realizadas for insert
with check (
  es_gestion()
  or (mi_rol() = 'referente_subsede' and sub_sede_id = mi_subsede())
  or (mi_rol() = 'jefe_area' and area_id = mi_area())
);

create policy "capacitaciones_update" on capacitaciones_realizadas for update
using (
  es_gestion()
  or (mi_rol() = 'referente_subsede' and sub_sede_id = mi_subsede())
  or (mi_rol() = 'jefe_area' and area_id = mi_area())
);

-- ---- ASISTENTES_CAPACITACION ----
create policy "asistentes_select" on asistentes_capacitacion for select
using (es_gestion() or profile_id = auth.uid());

create policy "asistentes_write" on asistentes_capacitacion for all
using (
  es_gestion()
  or exists (
    select 1 from capacitaciones_realizadas c
    where c.id = capacitacion_id
      and (
        (mi_rol() = 'referente_subsede' and c.sub_sede_id = mi_subsede())
        or (mi_rol() = 'jefe_area' and c.area_id = mi_area())
      )
  )
)
with check (
  es_gestion()
  or exists (
    select 1 from capacitaciones_realizadas c
    where c.id = capacitacion_id
      and (
        (mi_rol() = 'referente_subsede' and c.sub_sede_id = mi_subsede())
        or (mi_rol() = 'jefe_area' and c.area_id = mi_area())
      )
  )
);

-- ---- SOLICITUDES_INSUMOS ----
create policy "insumos_select" on solicitudes_insumos for select
using (
  es_gestion()
  or solicitado_por = auth.uid()
  or (sub_sede_id is not null and sub_sede_id = mi_subsede())
  or (area_id is not null and area_id = mi_area())
);

create policy "insumos_insert" on solicitudes_insumos for insert
with check (
  solicitado_por = auth.uid()
  and (
    (mi_rol() = 'referente_subsede' and sub_sede_id = mi_subsede())
    or (mi_rol() = 'jefe_area' and area_id = mi_area())
    or es_gestion()
  )
);

create policy "insumos_update" on solicitudes_insumos for update
using (
  es_gestion()
  or (solicitado_por = auth.uid() and estado = 'enviada')
);

-- ---- NOTIFICACIONES ----
create policy "notificaciones_select_propias" on notificaciones for select
using (profile_id = auth.uid() or es_gestion());
create policy "notificaciones_update_propias" on notificaciones for update
using (profile_id = auth.uid());
-- Las notificaciones se generan solo server-side (triggers/Edge Functions con
-- security definer, que bypassean RLS). Ningún cliente puede insertarlas directo:
-- si esto quedara en `true`, cualquier usuario podría crear notificaciones falsas
-- para otros perfiles (phishing interno).
create policy "notificaciones_insert_sistema" on notificaciones for insert
with check (false);

-- ---- AUDITORIA (solo lectura para gestión, sin escritura directa desde cliente) ----
create policy "auditoria_select_gestion" on auditoria for select using (es_gestion());

-- ============================================================================
-- 10. DATOS INICIALES DE EJEMPLO (opcional, comentar si no se desea)
-- ============================================================================

insert into tipos_documento (nombre, obligatorio, vigencia_meses) values
  ('DDJJ de Incompatibilidad Ética', true, 12),
  ('DNI', true, null),
  ('Certificado de domicilio', true, 12),
  ('CUIL', true, null),
  ('Foto carnet', true, null),
  ('Certificado de estudios / título', true, null),
  ('CV', true, null),
  ('Certificado de antecedentes penales', true, 12),
  ('Apto psicofísico', true, 12),
  ('Seguro de vida', true, 12),
  ('Certificado de no deudor alimentario', true, 6),
  ('Registro de Agresores Sexuales', true, 12),
  ('Designación Funcional y Contrato', true, null);

-- Nota: "Observa" de la planilla de control NO es un tipo de documento,
-- se resuelve con el campo profiles.observaciones_legajo (texto libre).

-- ============================================================================
-- 11. NOTA SOBRE STORAGE
-- ============================================================================
-- Crear un bucket privado "documentos-personal" en Supabase Storage.
-- Sugerencia de path: documentos-personal/{profile_id}/{tipo_documento_id}.pdf
-- Las políticas de Storage deben replicar la misma lógica de mi_rol()/mi_area()/mi_subsede()
-- usando storage.foldername(name) para extraer el profile_id del path.
--
-- La "nota formal" generada por el sistema (solicitudes_capacitacion.nota_generada_url)
-- y los certificados (asistentes_capacitacion.certificado_url) van en buckets propios
-- con la misma lógica de acceso.
