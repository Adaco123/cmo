import api from '../api';

export interface OrigenPaciente {
  id: number;
  nombre: string;
}

/**
 * Catálogo de orígenes de paciente (Propio, Externo...). Los ids de este
 * catálogo pueden cambiar en la base de datos — por eso nunca se debe
 * hardcodear un número en el frontend, siempre buscar por `nombre` sobre
 * esta lista.
 */
export async function getOrigenesPaciente(): Promise<OrigenPaciente[]> {
  const { data } = await api.get<OrigenPaciente[]>('/api/origenes_paciente/');
  return data;
}