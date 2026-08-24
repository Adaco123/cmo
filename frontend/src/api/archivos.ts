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