import api from '../api';

export interface CitaPayload {
  paciente_id: number;
  medico_id: number;
  consultorio_id?: number | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  motivo?: string | null;
  estado_id: number;
}

export interface Cita {
  id: number;
  paciente_id: number;
  medico_id: number;
  consultorio_id?: number | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string | null;
  motivo?: string | null;
  estado_id: number;
  created_at?: string;
  updated_at?: string;
}

export async function getCitas(): Promise<Cita[]> {
  const { data } = await api.get<Cita[]>('/api/citas/');
  return data;
}

export async function getCitaById(citaId: number): Promise<Cita> {
  const { data } = await api.get<Cita>(`/api/citas/${citaId}`);
  return data;
}

export async function createCita(payload: CitaPayload): Promise<Cita> {
  try {
    const { data } = await api.post<Cita>('/api/citas/', payload);
    return data;
  } catch (error: any) {
    const backendMessage = error?.response?.data?.error;
    if (backendMessage) {
      throw new Error(backendMessage);
    }
    throw error;
  }
}

export async function updateCita(citaId: number, payload: Partial<CitaPayload>): Promise<Cita> {
  const { data } = await api.put<Cita>(`/api/citas/${citaId}`, payload);
  return data;
}

export async function deleteCita(citaId: number): Promise<void> {
  await api.delete(`/api/citas/${citaId}`);
}

export async function getCitasPorMedico(medicoId: number): Promise<Cita[]> {
  const { data } = await api.get<Cita[]>(`/api/citas/medico/${medicoId}`);
  return data;
}