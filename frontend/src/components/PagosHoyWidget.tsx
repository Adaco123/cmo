import React, { useCallback, useEffect, useRef, useState } from 'react';
import { pagosHoy } from '../api/pagos'; // sin "es" extra
import './PagosHoyWidget.css';
const REFRESH_MS = 60000; // definido acá arriba, fuera del componente está OK porque es una constante fija, no un hook

const formatMonto = (valor: number) =>
  new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);

const PagosHoyWidget: React.FC = () => {
  // ── Todos los hooks van AQUÍ DENTRO ──
  const [monto, setMonto] = useState(0);
  const [cantidadPagos, setCantidadPagos] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayMonto, setDisplayMonto] = useState(0);
  const prevMonto = useRef(0);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const data = await pagosHoy();
      setMonto(parseFloat(data.total_pagado_hoy || '0'));
      setCantidadPagos(data.cantidad_pagos);
    } catch (err: unknown) {
      setError('No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch inicial + refresco automático
  useEffect(() => {
    void cargar();
    const interval = setInterval(() => void cargar(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [cargar]);

  // Animación de conteo cuando cambia el monto
  useEffect(() => {
    const inicio = prevMonto.current;
    const destino = monto;
    const duracion = 650;
    const t0 = performance.now();
    let raf: number;

    const paso = (t: number) => {
      const p = Math.min((t - t0) / duracion, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayMonto(inicio + (destino - inicio) * eased);
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    prevMonto.current = destino;

    return () => cancelAnimationFrame(raf);
  }, [monto]);

  return (
    <div className="pulse-widget">
      <div className="pulse-widget-top">
        <span className="pulse-widget-dot" />
        <span className="pulse-widget-label">Caja de hoy</span>
      </div>

      <div className="pulse-widget-strip">
        <svg viewBox="0 0 260 30" preserveAspectRatio="none">
          <path
            className="pulse-widget-path"
            d="M0,15 L60,15 L72,15 L80,2 L88,28 L96,8 L104,15 L120,15 L200,15 L212,15 L220,2 L228,28 L236,8 L244,15 L260,15"
          />
        </svg>
      </div>

      <div className="pulse-widget-amount">
        {loading ? (
          <span className="pulse-widget-loading">cargando…</span>
        ) : error ? (
          <span className="pulse-widget-loading">{error}</span>
        ) : (
          <>
            <span className="pulse-widget-currency">Bs</span>
            <span className="pulse-widget-value">{formatMonto(displayMonto)}</span>
          </>
        )}
      </div>

      {cantidadPagos !== undefined && !loading && !error && (
        <div className="pulse-widget-sub">{cantidadPagos} pagos registrados</div>
      )}
    </div>
  );
};

export default PagosHoyWidget;