import api from '../api';

export interface EstadoCita {
  id: number;
  nombre: string;
}

/**
 * Catálogo de estados de cita (Programada, Cancelada, No asistió...).
 * Los ids de este catálogo pueden cambiar en la base de datos (ej. "No
 * asistió" no siempre tuvo el mismo id) — por eso nunca se debe hardcodear
 * un número en el frontend, siempre buscar por `nombre` sobre esta lista.
 */
export async function getEstadosCita(): Promise<EstadoCita[]> {
  const { data } = await api.get<EstadoCita[]>('/api/estados_cita/');
  return data;
}