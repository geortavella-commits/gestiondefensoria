export type RolUsuario =
  | 'coordinacion_general'
  | 'administrador'
  | 'jefe_area'
  | 'referente_subsede'
  | 'personal';

export type EstadoUsuario = 'activo' | 'inactivo' | 'licencia' | 'baja';

export type EstadoDocumento =
  | 'pendiente'
  | 'cargado'
  | 'aprobado'
  | 'rechazado'
  | 'vencido';

export interface SubSede {
  id: string;
  nombre: string;
  direccion?: string | null;
  localidad?: string | null;
  telefono?: string | null;
  activo: boolean;
}

export interface Area {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  es_coordinadora_subsedes?: boolean;
  atiende_capacitaciones?: boolean;
  recibe_notas_pedido?: boolean;
  recibe_derivaciones_pedido?: boolean;
}

export interface Profile {
  id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  email: string;
  telefono: string | null;
  cargo: string | null;
  legajo: string | null;
  rol: RolUsuario;
  area_id: string | null;
  sub_sede_id: string | null;
  fecha_ingreso: string | null;
  estado: EstadoUsuario;
  avatar_url: string | null;
  perfil_completo: boolean;
  observaciones_legajo: string | null;
  dias_vacaciones_anuales: number | null;
  created_at: string;
  updated_at: string;
  // Joins
  sub_sedes?: SubSede | null;
  areas?: Area | null;
}

export interface TipoDocumento {
  id: string;
  nombre: string;
  descripcion: string | null;
  obligatorio: boolean;
  vigencia_meses: number | null;
  activo: boolean;
}

export interface DocumentoPersonal {
  id: string;
  profile_id: string;
  tipo_documento_id: string;
  archivo_path: string | null; // path dentro del bucket privado, no una URL pública
  archivo_nombre: string | null;
  fecha_carga: string | null;
  fecha_vencimiento: string | null;
  estado: EstadoDocumento;
  revisado_por: string | null;
  fecha_revision: string | null;
  comentarios: string | null;
  created_at: string;
  tipos_documento?: TipoDocumento;
}

export interface DocumentoConCatalogo {
  tipo: TipoDocumento;
  documento: DocumentoPersonal | null;
  estadoDerivado: 'vencido' | 'por_vencer' | 'aprobado' | 'cargado' | 'pendiente' | 'rechazado';
  diasDiferencia: number | null;
  badgeTexto: string;
}

export type Parentesco = 'conyuge_conviviente' | 'hijo_a' | 'otro';

export interface FamiliarPersonal {
  id: string;
  profile_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  parentesco: Parentesco;
  foto_dni_frente_path: string | null; // path en el bucket privado documentos-familiares, no una URL
  foto_dni_dorso_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CapacitacionAgente {
  capacitacion_id: string;
  nombre: string;
  fecha: string;
  modalidad: string | null;
  capacitador: string | null;
  entidad_dictante: string | null;
  carga_horaria: number | null;
  asistio: boolean;
  certificado_url: string | null;
  codigo_acreditacion: string | null;
}
