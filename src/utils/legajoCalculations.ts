import type { TipoDocumento, DocumentoPersonal, DocumentoConCatalogo } from '../types/legajo';

export function calcularEstadoDocumento(
  tipo: TipoDocumento,
  doc: DocumentoPersonal | null
): DocumentoConCatalogo {
  if (!doc || !doc.archivo_path) {
    return {
      tipo,
      documento: doc,
      estadoDerivado: 'pendiente',
      diasDiferencia: null,
      badgeTexto: 'Pendiente de Carga',
    };
  }

  if (doc.fecha_vencimiento) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = doc.fecha_vencimiento.split('-').map(Number);
    const expDate = new Date(year, month - 1, day);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const diasVencido = Math.abs(diffDays);
      return {
        tipo,
        documento: doc,
        estadoDerivado: 'vencido',
        diasDiferencia: diffDays,
        badgeTexto: `Vencido hace ${diasVencido} ${diasVencido === 1 ? 'día' : 'días'}`,
      };
    }

    if (diffDays <= 30) {
      return {
        tipo,
        documento: doc,
        estadoDerivado: 'por_vencer',
        diasDiferencia: diffDays,
        badgeTexto: `Vence en ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`,
      };
    }
  }

  switch (doc.estado) {
    case 'aprobado':
      return {
        tipo,
        documento: doc,
        estadoDerivado: 'aprobado',
        diasDiferencia: null,
        badgeTexto: 'Aprobado (Validado)',
      };
    case 'cargado':
      return {
        tipo,
        documento: doc,
        estadoDerivado: 'cargado',
        diasDiferencia: null,
        badgeTexto: 'En Revisión',
      };
    case 'rechazado':
      return {
        tipo,
        documento: doc,
        estadoDerivado: 'rechazado',
        diasDiferencia: null,
        badgeTexto: 'Rechazado',
      };
    default:
      return {
        tipo,
        documento: doc,
        estadoDerivado: 'pendiente',
        diasDiferencia: null,
        badgeTexto: 'Pendiente',
      };
  }
}

export function formatearFecha(fechaStr?: string | null): string {
  if (!fechaStr) return 'No informada';
  try {
    const fecha = new Date(fechaStr.includes('T') ? fechaStr : `${fechaStr}T00:00:00`);
    return new Intl.DateTimeFormat('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(fecha);
  } catch {
    return fechaStr;
  }
}
