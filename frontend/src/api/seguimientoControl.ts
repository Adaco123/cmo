import api from '../api';
import type { RecetasPayload, Receta } from './recetas';

/**
 * Payload para crear un seguimiento de control (día 15, 22...) o el
 * seguimiento inicial embebido en registro-completo. `recetas` es
 * opcional: si el doctor no da medicamentos nuevos en esa visita,
 * se manda vacío `{}`.
 */
export interface SeguimientoControlPayload {
  evolucion: string;
  proxima_fecha_control?: string | null;
  recetas?: RecetasPayload;
}

/**
 * Payload para POST /api/seguimiento_control/registros/:id/seguimientos.
 * Es igual a SeguimientoControlPayload pero además lleva medico_id,
 * porque en ese endpoint no viene de una Consulta recién creada.
 */
export interface SeguimientoControlCreatePayload extends SeguimientoControlPayload {
  medico_id: number;
}

export interface SeguimientoControl {
  id: number;
  registro_clinico_id: number;
  medico_id: number;
  fecha: string;
  evolucion: string;
  proxima_fecha_control?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SeguimientoControlResponse {
  seguimiento: SeguimientoControl;
  recetas: Receta[];
}

export async function createSeguimientoControl(
  registroId: number,
  payload: SeguimientoControlCreatePayload,
): Promise<SeguimientoControlResponse> {
  const { data } = await api.post<SeguimientoControlResponse>(
    `/api/historial_clinico/registros/${registroId}/seguimientos`,
    payload,
  );
  return data;
}

export async function getSeguimientosPorRegistro(registroId: number): Promise<SeguimientoControl[]> {
  const { data } = await api.get<SeguimientoControl[]>(
    `/api/historial_clinico/registros/${registroId}/seguimientos`,
  );
  return data;
}