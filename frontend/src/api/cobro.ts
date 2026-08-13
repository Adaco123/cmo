import api from '../api';

export interface CobroPayload {
  consulta_id: number;
  paciente_id: number;
  monto: string | number;
  descuento?: string | number | null;
  numero_recibo?: string;
  fecha?: string;
  estado_id?: number;
}

export interface Cobro {
  id: number;
  consulta_id: number;
  paciente_id: number;
  monto: string;
  descuento?: string | null;
  monto_final: string;
  estado_id: number;
  numero_recibo: string;
  fecha?: string;
  usuario_id: number;
  created_at?: string;
  updated_at?: string;
}

export async function getCobros(): Promise<Cobro[]> {
  const { data } = await api.get<Cobro[]>('/api/cobros/');
  return data;
}

export async function getCobroById(cobroId: number): Promise<Cobro> {
  const { data } = await api.get<Cobro>(`/api/cobros/${cobroId}`);
  return data;
}

export async function createCobro(payload: CobroPayload): Promise<Cobro> {
  const { data } = await api.post<Cobro>('/api/cobros/', payload);
  return data;
}

export async function updateCobro(
  cobroId: number,
  payload: Partial<CobroPayload>,
): Promise<Cobro> {
  const { data } = await api.put<Cobro>(`/api/cobros/${cobroId}`, payload);
  return data;
}

export async function deleteCobro(cobroId: number): Promise<void> {
  await api.delete(`/api/cobros/${cobroId}`);
}
