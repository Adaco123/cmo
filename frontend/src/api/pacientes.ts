import api from '../api';

export interface PacientePayload {
  nombres: string;
  apellidos: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: 'M' | 'F' | 'O';
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  contacto_emergencia_nombre?: string | null;
  contacto_emergencia_telefono?: string | null;
  origen_id: number;
  medico_referente_id?: number | null;
  medico_referente_externo?: string | null;
  consultorio_id?: number | null;
  estado?: boolean;
}

export interface Paciente extends PacientePayload {
  id: number;
  edad?: number;
  alergias?: string[];
  diagnostico?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getPacientes(): Promise<Paciente[]> {
  const { data } = await api.get<Paciente[]>('/api/pacientes/');
  return data;
}

export async function getPacienteById(id: number): Promise<Paciente> {
  const { data } = await api.get<Paciente>(`/api/pacientes/${id}`);
  return data;
}

export async function createPaciente(payload: PacientePayload): Promise<Paciente> {
  const { data } = await api.post<Paciente>('/api/pacientes/', payload);
  return data;
}

export async function updatePaciente(id: number, payload: Partial<PacientePayload>): Promise<Paciente> {
  const { data } = await api.put<Paciente>(`/api/pacientes/${id}`, payload);
  return data;
}

export async function deletePaciente(id: number): Promise<void> {
  await api.delete(`/api/pacientes/${id}`);
}