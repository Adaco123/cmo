/**
 * Igual que examenesComplementarios.ts: las recetas se crean únicamente
 * como parte del payload combinado en POST /historial_clinico/registro-completo.
 * Este archivo define los tipos que usa ese payload y lo que el backend
 * devuelve. Agrega funciones de lectura/descarga cuando tengas las
 * rutas reales del módulo de recetas.
 */

// --- Ítems que el frontend arma para cada bloque de receta ---

export interface RecetaMedicamentoItemPayload {
  medicamento: string;
  dosis: string;
  via_administracion?: string | null;
  frecuencia: string;
  duracion?: string | null;
  cantidad?: string | null;
  indicaciones?: string | null;
}

export interface RecetaFormulaMagistralItemPayload {
  nombre_formula: string;
  ingredientes: string;
  forma_farmaceutica?: string | null;
  cantidad_preparar?: string | null;
  via_administracion?: string | null;
  indicaciones?: string | null;
}

export interface RecetaExamenItemPayload {
  nombre_examen: string;
  tipo_examen: string;
  urgencia?: string; // load_default="Rutina" en el backend
  indicaciones_previas?: string | null;
}

/** Un bloque de receta: mismas indicaciones generales para todos sus ítems. */
export interface RecetaBloquePayload<T> {
  indicaciones_generales?: string | null;
  items: T[];
}

/**
 * Cada clave es un ARRAY de bloques: cada bloque del array genera su
 * propia fila `Receta` en el backend. Esto permite que, por ejemplo,
 * el doctor agregue una receta de medicamentos (diclofenaco + paracetamol)
 * y después otra receta de medicamentos aparte (ibuprofeno), en vez de
 * que todo caiga en la misma receta.
 *
 * (El backend también acepta un único bloque suelto por compatibilidad
 * hacia atrás, pero el frontend siempre manda el array.)
 */
export interface RecetasPayload {
  medicamentos?: RecetaBloquePayload<RecetaMedicamentoItemPayload>[];
  examenes?: RecetaBloquePayload<RecetaExamenItemPayload>[];
  formulas?: RecetaBloquePayload<RecetaFormulaMagistralItemPayload>[];
}

// --- Lo que devuelve el backend al leer una receta ya guardada ---

export interface RecetaMedicamento extends RecetaMedicamentoItemPayload {
  id: number;
  receta_id: number;
}
export interface RecetaFormulaMagistral extends RecetaFormulaMagistralItemPayload {
  id: number;
  receta_id: number;
}
export interface RecetaExamen extends Omit<RecetaExamenItemPayload, 'urgencia'> {
  id: number;
  receta_id: number;
  urgencia: string; // el backend siempre la devuelve rellena (default "Rutina")
}

export interface Receta {
  id: number;
  registro_clinico_id: number;
  tipo_receta_id: number;
  medico_id: number;
  seguimiento_control_id?: number | null;
  fecha: string;
  indicaciones_generales?: string | null;
  estado: boolean;
  medicamentos: RecetaMedicamento[];
  formulas_magistrales: RecetaFormulaMagistral[];
  examenes: RecetaExamen[];
  created_at?: string;
  updated_at?: string;
}