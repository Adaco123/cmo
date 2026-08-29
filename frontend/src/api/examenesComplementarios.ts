/**
 * CRUD independiente de exámenes complementarios: por ahora solo existe
 * lectura/borrado (ver ExamenComplementario_Resource en el backend). La
 * creación sigue siendo únicamente como parte del payload combinado en
 * POST /historial_clinico/registro-completo; el PUT de edición de ese
 * mismo endpoint ya NO crea ni edita exámenes, solo los deja tal cual.
 */
import api from '../api';

export type CategoriaExamenNombre = 'Laboratorio' | 'Imagenología' | 'Otro';

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