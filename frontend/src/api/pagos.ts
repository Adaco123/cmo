import api from '../api';

export interface PagoPayload {
  consulta_id?: number | null;
  cobro_id?: number;
  monto: number;
  descuento?: number;
  metodo_pago_id: number;
  monto_pago?: number;
  referencia?: string | null;
  numero_recibo?: string;
  numero_recibo_pago?: string;
  fecha?: string;
}

export interface Pago {
  id: number;
  cobro_id: number;
  monto: string;
  metodo_pago_id: number;
  numero_recibo_pago: string;
  referencia?: string | null;
  usuario_id: number;
  created_at?: string;
  updated_at?: string;
}
export interface PagosResumenHoy{
  total_pagado_hoy:string;
  cantidad_pagos: number;
}

export async function crearPago(payload: PagoPayload): Promise<Pago> {
  const { data } = await api.post<Pago>('/api/pagos/', payload);
  return data;
}

export async function getPagosPorCobro(cobroId: number): Promise<Pago[]> {
  const { data } = await api.get<Pago[]>(`/api/pagos/cobro/${cobroId}`);
  return data;
}

export async function eliminarPago(pagoId: number): Promise<void> {
  await api.delete(`/api/pagos/${pagoId}`);
}

export async function pagosHoy(): Promise <PagosResumenHoy>{
  const {data} =await api.get<PagosResumenHoy>(`/api/pagos/resumenHoy/`);
  return data;
}