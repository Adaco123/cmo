/**
 * CRUD independiente de exámenes complementarios. La creación sigue siendo
 * únicamente como parte del payload combinado en
 * POST /historial_clinico/registro-completo (o del seguimiento); acá solo
 * viven las operaciones sueltas sobre un examen ya existente: leer el
 * catálogo de categorías y completar la observación de un resultado
 * pendiente (la solicitud de un examen crea, del lado del backend, un
 * ExamenComplementario espejo en estado "Pendiente" vinculado a
 * receta_examen_id).
 */
import api from '../api';

export type CategoriaExamenNombre = 'Laboratorio' | 'Imagenología' | 'Otro';

export interface CategoriaExamen {
  id: number;
  nombre: string;
}

export async function getCategoriasExamen(): Promise<CategoriaExamen[]> {
  const { data } = await api.get<CategoriaExamen[]>('/api/examenes/categorias');
  return data;
}

export async function updateObservacionesExamen(
  examenId: number,
  observaciones: string,
): Promise<ExamenComplementario> {
  const { data } = await api.put<ExamenComplementario>(
    `/api/examenes/${examenId}/observaciones`,
    { observaciones },
  );
  return data;
}

/** Lo que el frontend arma para cada línea del dock de exámenes. */
export interface ExamenComplementarioItemPayload {
  categoria: CategoriaExamenNombre;
  nombre_examen: string;
  resultado?: string | null;
  observaciones?: string | null;
}

/** Lo que devuelve el backend al leer un examen ya guardado. */
export interface ExamenComplementario {
  id: number;
  registro_clinico_id: number;
  categoria_id: number;
  categoria?: { id: number; nombre: string };
  // Presente cuando este examen es el resultado de un examen solicitado
  // en una receta (nace en null, sin foto/observaciones, como "Pendiente").
  receta_examen_id?: number | null;
  nombre_examen: string;
  resultado?: string | null;
  observaciones?: string | null;
  fecha: string;
  estado: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function deleteExamenComplementario(examenId: number): Promise<void> {
  await api.delete(`/api/examenes/${examenId}`);
}