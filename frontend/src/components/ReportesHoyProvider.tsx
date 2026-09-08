import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  pagosHoy,
  getPacientesAtendidosHoy,
  type PagosResumenHoy,
  type PacientesAtendidosHoy,
} from '../api/reportes';

const REFRESH_MS = 60000;

interface ReportesHoyContextValue {
  pagosHoyData: PagosResumenHoy | null;
  pacientesAtendidosHoy: PacientesAtendidosHoy | null;
  loading: boolean;
  error: string | null;
  /** Fuerza una recarga inmediata, sin esperar al próximo ciclo de 60s. */
  refrescar: () => void;
}

const ReportesHoyContext = createContext<ReportesHoyContextValue | null>(null);

/**
 * Provider global de "hoy": pagos recibidos hoy y pacientes atendidos hoy.
 *
 * Antes esto se pedía por separado en 3 lugares:
 *  - PagosHoyWidget.tsx: pedía pagosHoy() cada 60s con su propio setInterval.
 *  - Iniciotab.tsx: pedía pagosHoy() + getPacientesAtendidosHoy() UNA sola
 *    vez al montar, sin ningún refresco automático.
 *  - Reportestab.tsx: pedía pagosHoy() de nuevo, junto a otros reportes,
 *    cada vez que esa pestaña se activaba.
 *
 * Resultado: el widget flotante ("Caja de hoy") se actualizaba solo cada
 * minuto, pero la tarjeta "Pagos recibidos hoy" de Iniciotab se quedaba
 * congelada con el valor de cuando se abrió el dashboard — dos números
 * de la misma plata, desincronizados en pantalla al mismo tiempo.
 *
 * Este Provider centraliza el fetch y el polling de 60s en un solo lugar;
 * PagosHoyWidget e Iniciotab leen del mismo estado vía useReportesHoy().
 * Reportestab.tsx no se tocó: pide un conjunto de reportes más grande
 * (mensuales, pacientes frecuentes, etc.) que son propios de esa pantalla
 * y no hace falta compartir.
 */
export const ReportesHoyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pagosHoyData, setPagosHoyData] = useState<PagosResumenHoy | null>(null);
  const [pacientesAtendidosHoy, setPacientesAtendidosHoy] = useState<PacientesAtendidosHoy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const [pagos, pacientes] = await Promise.all([pagosHoy(), getPacientesAtendidosHoy()]);
      setPagosHoyData(pagos);
      setPacientesAtendidosHoy(pacientes);
    } catch {
      setError('No se pudo cargar el reporte de hoy.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
    const interval = setInterval(() => void cargar(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [cargar]);

  return (
    <ReportesHoyContext.Provider
      value={{ pagosHoyData, pacientesAtendidosHoy, loading, error, refrescar: cargar }}
    >
      {children}
    </ReportesHoyContext.Provider>
  );
};

/** Hook para leer los datos de "hoy" (pagos, pacientes atendidos) desde cualquier componente. */
export function useReportesHoy(): ReportesHoyContextValue {
  const ctx = useContext(ReportesHoyContext);
  if (!ctx) {
    throw new Error('useReportesHoy debe usarse dentro de <ReportesHoyProvider>');
  }
  return ctx;
}