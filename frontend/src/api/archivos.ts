import api from '../api';

export interface ArchivoResponse {
  id: number;
  registro_clinico_id?: number | null;
  informe_id?: number | null;
  receta_id?: number | null;
  examen_complementario_id?: number | null;
  tipo_archivo_id: number;
  nombre_archivo: string;
  ruta_almacenamiento: string;
  tamano_bytes?: number;
  subido_por_usuario_id: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Sube UN archivo ligado a un examen complementario ya creado.
 * tipoArchivoId depende de tu catálogo tipos_archivo (ej. 1 = imagen, 2 = pdf).
 */
export async function subirArchivoExamen(
  examenComplementarioId: number,
  archivo: File,
  tipoArchivoId: number,
): Promise<ArchivoResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  formData.append('tipo_archivo_id', String(tipoArchivoId));
  formData.append('examen_complementario_id', String(examenComplementarioId));

  const { data } = await api.post<ArchivoResponse>('/api/archivos', formData, {

    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getArchivosPorExamen(examenId: number): Promise<ArchivoResponse[]> {
  const { data } = await api.get<ArchivoResponse[]>(`/api/archivos/examen/${examenId}`);
  return data;
}

export async function getArchivoById(archivoId: number): Promise<ArchivoResponse> {
  const { data } = await api.get<ArchivoResponse>(`/api/archivos/${archivoId}`);
  return data;
}

export async function eliminarArchivo(archivoId: number): Promise<void> {
  await api.delete(`/api/archivos/${archivoId}`);
}

/**
 * Descarga el binario del archivo autenticado (con el token JWT que ya
 * manda `api`), como blob. Úsalo cuando necesites mostrarlo en un <img>
 * o abrirlo — un <img src="..."> directo a la API NO funcionaría porque
 * el navegador no le agrega el header Authorization a esa petición.
 */
export async function descargarArchivoBlob(archivoId: number): Promise<Blob> {
  const { data } = await api.get(`/api/archivos/${archivoId}/descarga`, {
    responseType: 'blob',
  });
  return data;
}


/**
 * Descarga el archivo y dispara la descarga en el navegador (con su
 * nombre original), igual que downloadRegistroClinicoPdf en historialClinico.ts.
 */
export async function descargarArchivoComoAdjunto(archivoId: number, nombreArchivo: string): Promise<void> {
  const blob = await descargarArchivoBlob(archivoId);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
export async function getArchivosPorPaciente(pacienteId: number): Promise<ArchivoResponse[]> {
  // Nota: este resource vive bajo el blueprint de "archivos" (no "pacientes"),
  // por eso el prefijo es /api/archivos y no /api/pacientes.
  const { data } = await api.get<ArchivoResponse[]>(`/api/archivos/${pacienteId}/archivos`);
  return data;
}

/**
 * Sube UN archivo ligado directamente a un paciente (sin pasar por examen,
 * receta o registro clínico). Pensado para pacientes externos (origen_id=2)
 * que aún no tienen historia clínica abierta.
 * tipoArchivoId depende de tu catálogo tipos_archivo (ej. 1 = imagen, 2 = pdf).
 */
export async function subirArchivoPaciente(
  pacienteId: number,
  archivo: File,
  tipoArchivoId: number,

): Promise<ArchivoResponse> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  formData.append('tipo_archivo_id', String(tipoArchivoId));
  formData.append('paciente_id', String(pacienteId));

  const { data } = await api.post<ArchivoResponse>('/api/archivos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/* ============================================================
   Captura de fotografías por QR desde el celular
   ============================================================ */

export interface CapturaQrIniciada {
  token: string;
  sid: string;
  expira_en_segundos: number;
}

/** Llamado desde la PC al pulsar "Agregar fotografías". Requiere sesión (JWT). */
export async function iniciarCapturaQr(examenComplementarioId: number): Promise<CapturaQrIniciada> {
  const { data } = await api.post<CapturaQrIniciada>(`/api/archivos/examen/${examenComplementarioId}/qr-captura`);
  return data;
}

/** Igual que iniciarCapturaQr, pero para una sesión TRANSITORIA de captura
 * en contexto de un paciente (ej. desde Examenes.tsx, cuando el examen
 * todavía no existe): las fotos no quedan ligadas al paciente en BD, solo
 * se suben para que la PC las descargue y las reubique donde corresponda. */
export async function iniciarCapturaQrPaciente(pacienteId: number): Promise<CapturaQrIniciada> {
  const { data } = await api.post<CapturaQrIniciada>(`/api/archivos/paciente/${pacienteId}/qr-captura`);
  return data;
}

export interface CapturaQrEstado {
  conectado: boolean;
  fotos_count: number;
  /** Ids de los Archivo subidos en esta sesión hasta ahora (en orden de llegada). */
  archivo_ids: number[];
  cerrada: boolean;

}

/** Polling desde la PC mientras el modal del QR está abierto. Requiere sesión (JWT). */
export async function getEstadoCapturaQr(examenComplementarioId: number, sid: string): Promise<CapturaQrEstado> {
  const { data } = await api.get<CapturaQrEstado>(
    `/api/archivos/examen/${examenComplementarioId}/qr-captura/${sid}/estado`,
  );
  return data;
}

/** Igual que getEstadoCapturaQr, pero para una sesión transitoria en
 * contexto de un paciente (ver iniciarCapturaQrPaciente). */
export async function getEstadoCapturaQrPaciente(pacienteId: number, sid: string): Promise<CapturaQrEstado> {
  const { data } = await api.get<CapturaQrEstado>(
    `/api/archivos/paciente/${pacienteId}/qr-captura/${sid}/estado`,
  );
  return data;
}

/**
 * Descarta una sesión de captura ya iniciada: borra (fila + archivo físico)
 * todas las fotos que no se hayan usado todavía. Pensado para cuando se
 * cierra el modal de QR o se cancela un registro clínico sin guardar y
 * esas fotos se quedarían huérfanas. Requiere sesión (JWT). Idempotente.
 */
export async function descartarSesionCaptura(sid: string): Promise<void> {
  await api.delete(`/api/archivos/captura-sesion/${sid}`);
}

export interface CapturaQrInfo {
  nombre_examen: string;
  paciente_nombre: string;
  fotos_count: number;
}

/**
 * Las siguientes 4 funciones las usa la página pública del celular
 * (/capturar-fotos/:token). SIN JWT a propósito: el celular no tiene
 * sesión iniciada en el sistema, el propio token (firmado y con
 * expiración) es lo que autoriza estas llamadas.
 */
export async function getInfoCapturaQr(token: string): Promise<CapturaQrInfo> {
  const { data } = await api.get<CapturaQrInfo>(`/api/archivos/captura/${token}/info`);
  return data;
}

export interface FotoCapturadaResponse extends ArchivoResponse {
  fotos_count: number;
}

export async function subirFotoCapturaQr(token: string, foto: File): Promise<FotoCapturadaResponse> {

  const formData = new FormData();
  formData.append('archivo', foto);
  const { data } = await api.post<FotoCapturadaResponse>(`/api/archivos/captura/${token}/foto`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function eliminarFotoCapturaQr(token: string, archivoId: number): Promise<void> {
  await api.delete(`/api/archivos/captura/${token}/foto/${archivoId}`);
}

export async function finalizarCapturaQr(token: string): Promise<{ fotos_count: number }> {
  const { data } = await api.post<{ fotos_count: number }>(`/api/archivos/captura/${token}/finalizar`);
  return data;
}