import api from '../api';

/**
 * Lo que el cliente puede enviar al crear/actualizar una Consulta.
 * id, created_at, updated_at son dump_only en el backend.
 */
export interface ConsultaPayload {
  cita_id?: number | null;
  paciente_id: number;
  medico_id: number;
  fecha: string;   // 'YYYY-MM-DD'
  hora: string;    // 'HH:MM' o 'HH:MM:SS'
  motivo?: string | null;
  diagnostico?: string | null;
  estado?: boolean;
}

export interface Consulta {
  id: number;
  cita_id?: number | null;
  paciente_id: number;
  medico_id: number;
  fecha: string;
  hora: string;
  motivo?: string | null;
  diagnostico?: string | null;
  estado: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function createConsulta(payload: ConsultaPayload): Promise<Consulta> {
  const { data } = await api.post<Consulta>('/api/consultas/', payload);
  return data;
}

export async function getConsultas(): Promise<Consulta[]> {
  const { data } = await api.get<Consulta[]>('/api/consultas/');
  return data;
}

export async function getConsultaById(consultaId: number): Promise<Consulta> {
  const { data } = await api.get<Consulta>(`/api/consultas/${consultaId}`);
  return data;
}

/**
 * El backend actualiza vía PUT pero con `partial=True` en el schema,
 * así que en la práctica se comporta como un update parcial: solo
 * envía las claves que quieres cambiar.
 */
export async function updateConsulta(
  consultaId: number,
  payload: Partial<ConsultaPayload>,
): Promise<Consulta> {
  const { data } = await api.put<Consulta>(`/api/consultas/${consultaId}`, payload);
  return data;
}

export async function deleteConsulta(consultaId: number): Promise<void> {
  await api.delete(`/api/consultas/${consultaId}`);
}