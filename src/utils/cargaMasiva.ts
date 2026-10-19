// Utilidades para la carga masiva de usuarios: parseo de texto pegado desde
// Excel/Sheets (separado por tabs) o CSV (separado por comas), y generación
// de contraseñas temporales legibles (sin 0/O/1/l/I para evitar confusiones
// al tipearlas a mano).

export function parseTablaPegada(texto: string): string[][] {
  const lineas = texto
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lineas.length === 0) return [];
  const delimitador = lineas[0].includes('\t') ? '\t' : ',';
  return lineas.map((l) => l.split(delimitador).map((c) => c.trim().replace(/^"(.*)"$/, '$1')));
}

const ALFABETO_PASSWORD = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

export function generarPasswordTemporal(largo = 10): string {
  let out = '';
  for (let i = 0; i < largo; i++) {
    out += ALFABETO_PASSWORD[Math.floor(Math.random() * ALFABETO_PASSWORD.length)];
  }
  return out;
}

export const PLANTILLA_CSV =
  'Nombre,Apellido,DNI,Email,Cargo,Legajo,Area,Sub-Sede,Rol\n' +
  'Ana,Gomez,30123456,ana.gomez@ddnna.gob.ar,Trabajadora Social,1092,Legales,,personal\n';

export function descargarPlantilla() {
  const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_carga_usuarios.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function descargarCsv(nombreArchivo: string, filas: string[][]) {
  const contenido = filas.map((f) => f.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
