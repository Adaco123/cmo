import api from '../api';

export interface TipoArchivo {
  id: number;
  nombre: string;
}

/**
 * Catálogo de tipos de archivo (Imagen, PDF...). Los ids de este catálogo
 * pueden cambiar en la base de datos — por eso nunca se debe hardcodear
 * un número en el frontend, siempre buscar por `nombre` sobre esta lista.
 */
export async function getTiposArchivo(): Promise<TipoArchivo[]> {
  const { data } = await api.get<TipoArchivo[]>('/api/tipos_archivo/');
  return data;
}