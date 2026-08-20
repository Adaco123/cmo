/**
 * No hay creación/lectura independiente de exámenes complementarios
 * todavía (se crean únicamente como parte del payload combinado en
 * POST /historial_clinico/registro-completo). Este archivo solo
 * define los tipos — agrega funciones cuando tengas las rutas reales
 * de un CRUD independiente, si llegas a necesitarlo.
 */

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