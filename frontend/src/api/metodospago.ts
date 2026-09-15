import api from '../api';

export interface MetodoPago {
  id: number;
  nombre: string;
}

/**
 * Catálogo de métodos de pago (Efectivo, QR...). Los ids de este catálogo
 * pueden cambiar en la base de datos — por eso nunca se debe hardcodear
 * un número en el frontend, siempre buscar por `nombre` sobre esta lista.
 */
export async function getMetodosPago(): Promise<MetodoPago[]> {
  const { data } = await api.get<MetodoPago[]>('/api/metodos_pago/');
  return data;
}