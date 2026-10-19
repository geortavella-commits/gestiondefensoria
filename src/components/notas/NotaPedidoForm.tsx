import React, { useEffect, useState } from 'react';
import {
  CATEGORIAS,
  enviarNota,
  formatearMonto,
  guardarNota,
  obtenerNota,
  totalItems,
  type CategoriaItem,
  type ItemNota,
} from '../../services/notasPedido';
import type { Profile } from '../../types/legajo';

interface Props {
  perfilActual: Profile;
  areaNombre: string;
  notaId?: string;
  descripcionInicial?: string; // precarga (ej. al crear la nota a partir de una derivación de sub-sede)
  onVolver: () => void;
  onGuardada: (id: string) => void;
}

type ItemForm = ItemNota & { _k: string };

const nuevoItem = (categoria: CategoriaItem): ItemForm => ({
  _k: crypto.randomUUID(),
  categoria,
  descripcion: '',
  cantidad: 1,
  precio_unitario: null,
  observacion: null,
  proveedor_nombre: null,
  proveedor_apellido: null,
  proveedor_cuit: null,
  proveedor_contacto: null,
});

const formatCuit = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 10) return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
  if (d.length > 2) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return d;
};

const tieneProveedor = (it: ItemNota) =>
  !!(it.proveedor_nombre || it.proveedor_apellido || it.proveedor_cuit || it.proveedor_contacto);

const inputCls =
  'w-full px-2.5 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-body-sm focus:outline-none focus:border-secondary';

export const NotaPedidoForm: React.FC<Props> = ({
  perfilActual,
  areaNombre,
  notaId,
  descripcionInicial,
  onVolver,
  onGuardada,
}) => {
  const [idActual, setIdActual] = useState<string | undefined>(notaId);
  const [descripcion, setDescripcion] = useState(descripcionInicial || '');
  const [items, setItems] = useState<ItemForm[]>([]);
  const [conProveedor, setConProveedor] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!!notaId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!notaId) {
      setItems(CATEGORIAS.map((c) => nuevoItem(c.id)));
      return;
    }
    obtenerNota(notaId)
      .then((n) => {
        setDescripcion(n.descripcion || '');
        const cargados = (n.items || []).map((it) => ({ ...it, _k: crypto.randomUUID() }));
        setItems(cargados);
        setConProveedor(new Set(cargados.filter(tieneProveedor).map((it) => it._k)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [notaId]);

  const cambiar = (k: string, patch: Partial<ItemNota>) =>
    setItems((prev) => prev.map((it) => (it._k === k ? { ...it, ...patch } : it)));

  const quitar = (k: string) => setItems((prev) => prev.filter((it) => it._k !== k));

  const toggleProveedor = (k: string) =>
    setConProveedor((prev) => {
      const s = new Set(prev);
      if (s.has(k)) {
        s.delete(k);
        cambiar(k, { proveedor_nombre: null, proveedor_apellido: null, proveedor_cuit: null, proveedor_contacto: null });
      } else s.add(k);
      return s;
    });

  const completos = items.filter((it) => it.descripcion.trim());

  const guardar = async (enviar: boolean) => {
    setError(null);
    if (completos.length === 0) {
      setError('Agregá al menos un ítem con descripción.');
      return;
    }
    if (enviar && completos.some((it) => it.precio_unitario === null)) {
      setError('Para enviar, todos los ítems necesitan un precio estimado.');
      return;
    }
    try {
      setSaving(true);
      const id = await guardarNota({
        id: idActual,
        area_id: perfilActual.area_id as string,
        solicitado_por: perfilActual.id,
        descripcion,
        items: completos,
      });
      setIdActual(id);
      if (enviar) await enviarNota(id);
      onGuardada(id);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar la nota');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-outline">Cargando nota...</div>;

  return (
    <div className="max-w-[1000px] mx-auto p-gutter flex flex-col gap-space-lg text-on-surface font-body-md">
      <div className="flex items-center justify-between border-b border-outline-variant pb-space-md">
        <div>
          <h1 className="text-headline-lg font-bold text-primary">{notaId ? 'Editar nota de pedido' : 'Nueva nota de pedido'}</h1>
          <p className="text-body-sm text-on-surface-variant">
            Área: <strong>{areaNombre}</strong> · Solicita: {perfilActual.nombre} {perfilActual.apellido}
          </p>
        </div>
        <button onClick={onVolver} className="px-3 py-1.5 border border-outline-variant rounded-lg text-label-md text-primary hover:bg-surface-container">
          ← Volver
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-error-container text-on-error-container text-body-sm">{error}</div>}

      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg flex flex-col gap-2">
        <label className="text-label-md font-semibold text-primary">Descripción / justificación del pedido</label>
        <textarea
          rows={3}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Describí brevemente el motivo del pedido..."
          className={inputCls}
        />
      </section>

      {CATEGORIAS.map((cat) => {
        const deCat = items.filter((it) => it.categoria === cat.id);
        return (
          <section key={cat.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-space-md py-2 bg-surface-container">
              <h2 className="text-label-lg font-bold text-primary uppercase tracking-wide">{cat.label}</h2>
              <span className="text-label-sm text-on-surface-variant">Subtotal {formatearMonto(totalItems(deCat))}</span>
            </div>
            <div className="p-space-md flex flex-col gap-3">
              {deCat.map((it) => (
                <div key={it._k} className="flex flex-col gap-2 pb-3 border-b border-outline-variant/50 last:border-0">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className={`${inputCls} col-span-12 md:col-span-5`}
                      placeholder="Descripción del ítem"
                      value={it.descripcion}
                      onChange={(e) => cambiar(it._k, { descripcion: e.target.value })}
                    />
                    <input
                      className={`${inputCls} col-span-4 md:col-span-2`}
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="Cant."
                      value={it.cantidad}
                      onChange={(e) => cambiar(it._k, { cantidad: Number(e.target.value) })}
                    />
                    <input
                      className={`${inputCls} col-span-5 md:col-span-3`}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Precio unitario"
                      value={it.precio_unitario ?? ''}
                      onChange={(e) => cambiar(it._k, { precio_unitario: e.target.value === '' ? null : Number(e.target.value) })}
                    />
                    <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => quitar(it._k)}
                        className="p-1 text-outline hover:text-error"
                        title="Quitar ítem"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className={`${inputCls} flex-1 min-w-[200px]`}
                      placeholder="Observación (opcional)"
                      value={it.observacion ?? ''}
                      onChange={(e) => cambiar(it._k, { observacion: e.target.value })}
                    />
                    <span className="text-label-sm text-on-surface-variant min-w-[110px] text-right">
                      {formatearMonto(Number(it.cantidad || 0) * Number(it.precio_unitario || 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleProveedor(it._k)}
                      className={`px-2.5 py-1 rounded-lg border text-label-sm font-semibold ${
                        conProveedor.has(it._k)
                          ? 'border-secondary text-secondary bg-secondary-fixed/40'
                          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {conProveedor.has(it._k) ? 'Quitar proveedor' : 'Proveedor'}
                    </button>
                  </div>
                  {conProveedor.has(it._k) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 rounded-lg bg-surface-container-low">
                      <input className={inputCls} placeholder="Nombre" value={it.proveedor_nombre ?? ''} onChange={(e) => cambiar(it._k, { proveedor_nombre: e.target.value })} />
                      <input className={inputCls} placeholder="Apellido" value={it.proveedor_apellido ?? ''} onChange={(e) => cambiar(it._k, { proveedor_apellido: e.target.value })} />
                      <input className={inputCls} placeholder="CUIT 20-12345678-9" value={it.proveedor_cuit ?? ''} onChange={(e) => cambiar(it._k, { proveedor_cuit: formatCuit(e.target.value) })} />
                      <input className={inputCls} placeholder="Contacto" value={it.proveedor_contacto ?? ''} onChange={(e) => cambiar(it._k, { proveedor_contacto: e.target.value })} />
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setItems((prev) => [...prev, nuevoItem(cat.id)])}
                className="w-full py-2 border border-dashed border-outline-variant rounded-lg text-label-md text-on-surface-variant hover:border-secondary hover:text-secondary"
              >
                + Agregar {cat.label.toLowerCase()}
              </button>
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-space-md shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-body-md">
          Total estimado: <strong className="text-primary">{formatearMonto(totalItems(completos))}</strong>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            disabled={saving}
            onClick={() => guardar(false)}
            className="flex-1 sm:flex-none h-10 px-4 border border-outline-variant rounded-lg text-label-md font-semibold text-primary hover:bg-surface-container disabled:opacity-50"
          >
            Guardar borrador
          </button>
          <button
            disabled={saving}
            onClick={() => guardar(true)}
            className="flex-1 sm:flex-none h-10 px-4 bg-primary text-on-primary rounded-lg text-label-md font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            Enviar a Administración
          </button>
        </div>
      </div>
    </div>
  );
};
