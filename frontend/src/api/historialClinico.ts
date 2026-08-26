import api from '../api';
import type { ConsultaPayload, Consulta } from './consultas';
import type {
  ExamenComplementarioItemPayload,
  ExamenComplementarioUpdateItemPayload,
  ExamenComplementario,
} from './examenesComplementarios';
import type { RecetasPayload, Receta } from './recetas';
import type { SeguimientoControlPayload, SeguimientoControl } from './seguimientoControl';
export interface RegistroClinicoCompletoDetalle {
  registro: RegistroClinico;
  examenes_complementarios: ExamenComplementario[];
  recetas: Receta[];
  seguimientos_control: SeguimientoControl[];
}

export async function getRegistroClinicoCompleto(registroId: number): Promise<RegistroClinicoCompletoDetalle> {
  const { data } = await api.get<RegistroClinicoCompletoDetalle>(
    `/api/historial_clinico/registros/${registroId}/completo`,
  );
  return data;
}
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
  // Nota clínica en texto libre (ya no es una fecha). La fecha real del
  // próximo control va en seguimiento_control.proxima_fecha_control.
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
 * médico haya pedido, una Receta independiente por cada tipo
 * (medicamentos / exámenes / fórmulas) que tenga al menos un ítem, y
 * opcionalmente el primer SeguimientoControl (con su propia receta).
 * `registro` va sin `consulta_id` porque el backend lo asigna
 * automáticamente con el id de la Consulta recién creada.
 */
export interface RegistroCompletoPayload {
  consulta: Pick<ConsultaPayload, 'paciente_id' | 'medico_id' | 'fecha' | 'hora' | 'motivo' | 'diagnostico'>;
  registro: Omit<RegistroClinicoPayload, 'consulta_id'>;
  examenes_complementarios?: ExamenComplementarioItemPayload[];
  recetas?: RecetasPayload;
  // Opcional: si el doctor ya sabe el día 1 cuándo debe volver el paciente.
  // No lleva medico_id porque el backend usa el mismo consulta.medico_id.
  seguimiento_control?: SeguimientoControlPayload;
}

export interface RegistroCompletoResponse {
  consulta: Consulta;
  registro: RegistroClinico;
  examenes_complementarios: ExamenComplementario[];
  recetas: Receta[];
  // Solo viene si se mandó seguimiento_control en el payload.
  seguimiento_control?: SeguimientoControl;
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

/**
 * Payload para PUT /registro-completo/<registro_id>: edita la Consulta
 * (solo motivo, diagnostico, fecha, hora, medico_id — paciente_id y
 * cita_id quedan fijos, el backend los ignora aunque los mandes) y el
 * RegistroClinico. Todo es parcial: solo mandas lo que quieres cambiar.
 *
 * Si mandas `examenes_complementarios`, cada ítem con "id" actualiza ese
 * examen existente y cada ítem sin "id" crea uno nuevo. Un examen que ya
 * existía y no incluyas en la lista queda intacto — este endpoint nunca
 * borra un examen por omisión.
 *
 * Las recetas NO se tocan acá: se editan con sus propios endpoints
 * (updateReceta, etc. en api/recetas.ts).
 */
export interface RegistroCompletoUpdatePayload {
  consulta?: Partial<Pick<ConsultaPayload, 'medico_id' | 'fecha' | 'hora' | 'motivo' | 'diagnostico'>>;
  registro?: Partial<Omit<RegistroClinicoPayload, 'consulta_id'>>;
  examenes_complementarios?: ExamenComplementarioUpdateItemPayload[];
}

export interface RegistroCompletoUpdateResponse {
  consulta: Consulta;
  registro: RegistroClinico;
  examenes_complementarios: ExamenComplementario[];
}

export async function updateRegistroCompleto(
  registroId: number,
  payload: RegistroCompletoUpdatePayload,
): Promise<RegistroCompletoUpdateResponse> {
  const { data } = await api.put<RegistroCompletoUpdateResponse>(
    `/api/historial_clinico/registro-completo/${registroId}`,
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