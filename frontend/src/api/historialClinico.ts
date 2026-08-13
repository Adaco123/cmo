import api from '../api';
import type { ConsultaPayload, Consulta } from './consultas';
import type { ExamenComplementarioItemPayload, ExamenComplementario } from './examenesComplementarios';
import type { RecetasPayload, Receta } from './recetas';

export interface HistoriaClinicaPayload {
  paciente_id: number;
  estado?: boolean;
}

export interface HistoriaClinica {
  id: number;
  paciente_id: number;
  fecha_apertura?: string | null;
  estado?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Lo único que el cliente puede/debe enviar al crear un registro clínico.
 * paciente_id, medico_id, fecha, hora, motivo_consulta y diagnostico
 * son dump_only en el backend: se derivan de `consulta_id` en el servidor
 * (registro.consulta.paciente / .medico / .fecha / .hora / .motivo / .diagnostico).
 * historia_clinica_id también lo asigna el backend automáticamente.
 */
export interface RegistroClinicoPayload {
  consulta_id: number;

  // Signos vitales — todos obligatorios en el backend (nullable=False)
  presion_arterial: string;
  frecuencia_cardiaca: number;
  frecuencia_respiratoria: number;
  saturacion_oxigeno: number;
  glicemia: number | string;
  temperatura: number | string;
  peso: number | string;
  talla: number | string;
  hallazgos_ecograficos: string;

  // Información clínica — opcional en el backend (allow_none=True)
  enfermedad_actual?: string | null;
  examen_fisico?: string | null;
  tratamiento?: string | null;
  consulta_control?: string | null;
  alergias?: string | null;
  observaciones?: string | null;
}

/**
 * Forma real de lo que devuelve el backend al leer un registro clínico.
 * Incluye los campos dump_only calculados desde la Consulta relacionada.
 */
export interface RegistroClinico {
  id: number;
  historia_clinica_id: number;
  consulta_id: number;

  // Signos vitales
  presion_arterial: string;
  frecuencia_cardiaca: number;
  frecuencia_respiratoria: number;
  saturacion_oxigeno: number;
  glicemia: string;
  temperatura: string;
  peso: string;
  talla: string;
  hallazgos_ecograficos: string;

  // Información clínica
  enfermedad_actual?: string | null;
  examen_fisico?: string | null;
  tratamiento?: string | null;
  consulta_control?: string | null;
  alergias?: string | null;
  observaciones?: string | null;

  // PDF
  pdf_generado?: boolean;
  pdf_ruta?: string | null;

  // Derivados de Consulta (solo lectura)
  fecha: string;
  hora: string;
  medico_id: number;
  diagnostico?: string | null;
  motivo_consulta?: string | null;

  // Auditoría
  created_at?: string;
  updated_at?: string;
}

/**
 * Payload para POST /registro-completo: crea, en una sola transacción,
 * la Consulta, el RegistroClinico, los exámenes complementarios que el
 * médico haya pedido, y una Receta independiente por cada tipo
 * (medicamentos / exámenes / fórmulas) que tenga al menos un ítem.
 * `registro` va sin `consulta_id` porque el backend lo asigna
 * automáticamente con el id de la Consulta recién creada.
 */
export interface RegistroCompletoPayload {
  consulta: Pick<ConsultaPayload, 'paciente_id' | 'medico_id' | 'fecha' | 'hora' | 'motivo' | 'diagnostico'>;
  registro: Omit<RegistroClinicoPayload, 'consulta_id'>;
  examenes_complementarios?: ExamenComplementarioItemPayload[];
  recetas?: RecetasPayload;
}

export interface RegistroCompletoResponse {
  consulta: Consulta;
  registro: RegistroClinico;
  examenes_complementarios: ExamenComplementario[];
  recetas: Receta[];
}

export async function createRegistroCompleto(
  payload: RegistroCompletoPayload,
): Promise<RegistroCompletoResponse> {
  const { data } = await api.post<RegistroCompletoResponse>(
    '/api/historial_clinico/registro-completo',
    payload,
  );
  return data;
}

export async function createHistoriaClinica(payload: HistoriaClinicaPayload): Promise<HistoriaClinica> {
  const { data } = await api.post<HistoriaClinica>('/api/historial_clinico/historias', payload);
  return data;
}

export async function getHistoriaClinicaById(historiaId: number): Promise<HistoriaClinica> {
  const { data } = await api.get<HistoriaClinica>(`/api/historial_clinico/historias/${historiaId}`);
  return data;
}

export async function getHistoriaClinicaPorPaciente(pacienteId: number): Promise<HistoriaClinica> {
  const { data } = await api.get<HistoriaClinica>(`/api/historial_clinico/historias/paciente/${pacienteId}`);
  return data;
}

export async function createRegistroClinico(payload: RegistroClinicoPayload): Promise<RegistroClinico> {
  const { data } = await api.post<RegistroClinico>('/api/historial_clinico/registros', payload);
  return data;
}

export async function getRegistroClinicoById(registroId: number): Promise<RegistroClinico> {
  const { data } = await api.get<RegistroClinico>(`/api/historial_clinico/registros/${registroId}`);
  return data;
}

export async function getRegistrosPorHistoria(historiaId: number): Promise<RegistroClinico[]> {
  const { data } = await api.get<RegistroClinico[]>(`/api/historial_clinico/registros/historia/${historiaId}`);
  return data;
}

export async function getExpedientePaciente(pacienteId: number): Promise<any> {
  const { data } = await api.get(`/api/historial_clinico/paciente/${pacienteId}`);
  return data;
}

export async function downloadRegistroClinicoPdf(registroId: number): Promise<void> {
  const response = await api.get(`/api/historial_clinico/reportes/registro/${registroId}`, {
    responseType: 'blob',
  });

  const contentDisposition = response.headers['content-disposition'] || '';
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)(?:"|$)/i) || [];
  const filename = match[1] || `registro_${registroId}.pdf`;
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}