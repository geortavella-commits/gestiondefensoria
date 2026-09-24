import { jsPDF } from 'jspdf';
import { CATEGORIAS, formatearMonto, totalItems, type ItemNota, type NotaPedido } from '../services/notasPedido';

type RGB = [number, number, number];
const DARK: RGB = [26, 26, 24];
const ACCENT: RGB = [42, 92, 69];
const GRAY: RGB = [107, 100, 86];
const LGRAY: RGB = [220, 214, 204];
const CREAM: RGB = [245, 242, 236];
const COLOR_CATEGORIA: Record<string, RGB> = {
  material: [42, 92, 69],
  servicio: [44, 82, 130],
  infraestructura: [120, 70, 20],
};

const fecha = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const nombre = (p?: { nombre: string; apellido: string } | null) => (p ? `${p.nombre} ${p.apellido}` : '—');

/** Genera la Nota de Pedido en PDF a partir de la nota ya guardada (con ítems). */
export function generarNotaPedidoPDF(nota: NotaPedido) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 20;
  const cw = W - M * 2;
  let y = 30;

  const salto = (alto: number) => {
    if (y + alto > 268) {
      doc.addPage();
      y = 20;
    }
  };
  const etiqueta = (txt: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(txt, x, yy);
  };

  // Encabezado
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('DEFENSORÍA DE LAS NIÑAS, NIÑOS Y ADOLESCENTES — CÓRDOBA', M, 11);

  doc.setTextColor(...DARK);
  doc.setFontSize(22);
  doc.text('Nota de Pedido', M, y);
  y += 4;
  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(0.8);
  doc.line(M, y, M + cw, y);
  y += 8;

  // Metadatos
  const meta: [string, string][] = [
    ['FECHA', fecha(nota.fecha)],
    ['N.° NOTA', nota.numero || 'Borrador'],
    ['ÁREA', nota.area?.nombre || '—'],
  ];
  doc.setFillColor(...CREAM);
  doc.roundedRect(M, y, cw, 22, 2, 2, 'F');
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, cw, 22, 2, 2, 'S');
  meta.forEach(([lbl, val], i) => {
    const x = M + (cw / meta.length) * i + 6;
    etiqueta(lbl, x, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(val, x, y + 15);
  });
  y += 30;

  // Solicitante
  etiqueta('SOLICITADO POR', M, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`${nombre(nota.solicitante)}${nota.solicitante?.cargo ? ` — ${nota.solicitante.cargo}` : ''}`, M, y);
  y += 8;

  if (nota.descripcion) {
    etiqueta('DESCRIPCIÓN / JUSTIFICACIÓN', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    const lineas = doc.splitTextToSize(nota.descripcion, cw);
    doc.text(lineas, M, y);
    y += lineas.length * 5 + 6;
  }

  // Detalle por categoría
  const items = nota.items || [];
  if (items.length) {
    etiqueta('DETALLE DEL PEDIDO Y PRESUPUESTO', M, y);
    y += 6;
  }

  const xCant = M + cw * 0.58;
  const xUnit = M + cw * 0.78;
  const xSub = M + cw - 3;

  CATEGORIAS.forEach((cat) => {
    const deCategoria = items.filter((it: ItemNota) => it.categoria === cat.id);
    if (!deCategoria.length) return;

    salto(24);
    doc.setFillColor(...COLOR_CATEGORIA[cat.id]);
    doc.rect(M, y, cw, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(cat.label.toUpperCase(), M + 4, y + 5);
    y += 7;

    doc.setFillColor(240, 240, 238);
    doc.rect(M, y, cw, 6, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...GRAY);
    doc.text('DESCRIPCIÓN', M + 3, y + 4.5);
    doc.text('CANT.', xCant, y + 4.5, { align: 'right' });
    doc.text('P. UNIT.', xUnit, y + 4.5, { align: 'right' });
    doc.text('SUBTOTAL', xSub, y + 4.5, { align: 'right' });
    y += 6;

    deCategoria.forEach((it, idx) => {
      const lineasDesc = doc.splitTextToSize(it.descripcion, cw * 0.52) as string[];
      const proveedor = [
        [it.proveedor_nombre, it.proveedor_apellido].filter(Boolean).join(' '),
        it.proveedor_cuit ? `CUIT: ${it.proveedor_cuit}` : '',
        it.proveedor_contacto ? `Contacto: ${it.proveedor_contacto}` : '',
      ]
        .filter(Boolean)
        .join('  ·  ');

      const alto = 4 + lineasDesc.length * 4 + (it.observacion ? 4 : 0) + (proveedor ? 4 : 0);
      salto(alto);

      if (idx % 2 === 0) {
        doc.setFillColor(...CREAM);
        doc.rect(M, y, cw, alto, 'F');
      }
      doc.setDrawColor(...LGRAY);
      doc.setLineWidth(0.2);
      doc.rect(M, y, cw, alto, 'S');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(lineasDesc, M + 3, y + 5);
      doc.text(String(it.cantidad), xCant, y + 5, { align: 'right' });
      doc.text(it.precio_unitario != null ? formatearMonto(Number(it.precio_unitario)) : '—', xUnit, y + 5, { align: 'right' });
      doc.text(formatearMonto(Number(it.cantidad) * Number(it.precio_unitario || 0)), xSub, y + 5, { align: 'right' });

      let yy = y + 5 + lineasDesc.length * 4 - 4 + 4;
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY);
      if (it.observacion) {
        doc.text(`Obs.: ${it.observacion}`, M + 3, yy);
        yy += 4;
      }
      if (proveedor) {
        doc.setTextColor(...ACCENT);
        doc.text(`Proveedor: ${proveedor}`, M + 3, yy);
      }
      y += alto;
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text(`Subtotal ${cat.label.toLowerCase()}: ${formatearMonto(totalItems(deCategoria))}`, xSub, y + 5, { align: 'right' });
    y += 10;
  });

  if (items.length) {
    salto(14);
    doc.setFillColor(...DARK);
    doc.roundedRect(M + cw * 0.5, y, cw * 0.5, 10, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL ESTIMADO', M + cw * 0.5 + 4, y + 6.5);
    doc.text(formatearMonto(totalItems(items)), xSub, y + 6.5, { align: 'right' });
    y += 18;
  }

  // Trámite en Administración
  const tramite: string[] = [];
  if (nota.enviada_at) tramite.push(`Enviada el ${fecha(nota.enviada_at)}`);
  if (nota.recibida_at) tramite.push(`Recibida por ${nombre(nota.receptor)} el ${fecha(nota.recibida_at)}`);
  if (nota.estado === 'aprobada' && nota.revisado_at) tramite.push(`Aprobada por ${nombre(nota.revisor)} el ${fecha(nota.revisado_at)}`);
  if (tramite.length) {
    salto(10 + tramite.length * 5);
    etiqueta('TRÁMITE', M, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    tramite.forEach((t) => {
      doc.text(t, M, y);
      y += 5;
    });
    if (nota.estado === 'aprobada' && nota.comentario_revision) {
      doc.setTextColor(...GRAY);
      doc.text(`Observaciones: ${nota.comentario_revision}`, M, y);
      y += 5;
    }
    y += 6;
  }

  // Firmas
  salto(36);
  const fw = 60;
  const firmas: [string, string][] = [
    ['Solicitante', nombre(nota.solicitante)],
    ['Área responsable', ''],
    ['Autorización', nota.estado === 'aprobada' ? nombre(nota.revisor) : ''],
  ];
  const xs = [M, M + (cw - fw) / 2, M + cw - fw];
  doc.setDrawColor(...LGRAY);
  doc.setLineWidth(0.3);
  firmas.forEach(([lbl, quien], i) => {
    doc.line(xs[i], y + 18, xs[i] + fw, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(lbl, xs[i] + fw / 2, y + 23, { align: 'center' });
    if (quien && quien !== '—') {
      doc.setTextColor(...DARK);
      doc.text(quien, xs[i] + fw / 2, y + 27, { align: 'center' });
    }
  });

  // Pie en todas las páginas
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(...DARK);
    doc.rect(0, h - 10, W, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 175, 165);
    doc.text(
      `${nota.numero || 'Borrador'} · generada el ${new Date().toLocaleDateString('es-AR')} · Defensoría de NNyA Córdoba · Página ${p}/${paginas}`,
      W / 2,
      h - 4,
      { align: 'center' }
    );
  }

  const area = (nota.area?.nombre || 'sin_area').toLowerCase().replace(/\s+/g, '_');
  doc.save(`nota_pedido_${nota.numero || 'borrador'}_${area}.pdf`);
}
