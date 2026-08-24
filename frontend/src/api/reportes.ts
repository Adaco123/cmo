import api from '../api';
import type { Paciente } from './pacientes';

export interface EstadisticasPacientesMes {
  total_mes_actual: number;
  total_mes_anterior: number;
  variacion_absoluta: number;
  variacion_porcentual: number;
}

export interface PacienteFrecuente {
  id: number;
  nombre: string;
  total_consultas: number;
  ultima_visita: string | null;
  tipo: 'Mis pacientes' | 'Externo' | 'Otro';
}

export interface PacientesNuevosResponse {
  total: number;
  pacientes: Paciente[];
}

export interface PagosResumenHoy {
  total_pagado_hoy: string;
  cantidad_pagos: number;
}

export interface PagosReporteMensualDiario {
  fecha: string;
  total_pagado: string;
  cantidad_pagos: number;
}

export interface PagosReporteMensual {
  total_pagado_mes: string;
  cantidad_pagos: number;
}

export async function getEstadisticasPacientesMes(): Promise<EstadisticasPacientesMes> {
  const { data } = await api.get<EstadisticasPacientesMes>('/api/pacientes/estadisticas/mes');
  return data;
}

export async function getPacientesFrecuentes(limit?: number): Promise<PacienteFrecuente[]> {
  const { data } = await api.get<PacienteFrecuente[]>('/api/pacientes/frecuentes', {
    params: limit === undefined ? undefined : { limit },
  });
  return data;
}

export async function getPacientesNuevos(dias?: number): Promise<PacientesNuevosResponse> {
  const { data } = await api.get<PacientesNuevosResponse>('/api/pacientes/nuevos', {
    params: dias === undefined ? undefined : { dias },
  });
  return data;
}

export async function pagosHoy(): Promise<PagosResumenHoy> {
  const { data } = await api.get<PagosResumenHoy>('/api/pagos/resumenHoy');
  return data;
}

export async function getReporteMensualDiario(): Promise<PagosReporteMensualDiario[]> {
  const { data } = await api.get<PagosReporteMensualDiario[]>('/api/pagos/reporteMensualDiario');
  return data;
}

export async function getReporteMensual(): Promise<PagosReporteMensual> {
  const { data } = await api.get<PagosReporteMensual>('/api/pagos/reporteMensual');
  return data;
}
