import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useReportesHoy } from './ReportesHoyProvider';
import './PagosHoyWidget.css';

const formatMonto = (valor: number) =>
  new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor);

const STORAGE_KEY = 'pagosHoyWidget:position';

type Posicion = { x: number; y: number };

const clamp = (valor: number, min: number, max: number) => Math.min(Math.max(valor, min), max);

const PagosHoyWidget: React.FC = () => {
  const { pagosHoyData, loading, error } = useReportesHoy();
  const monto = parseFloat(pagosHoyData?.total_pagado_hoy || '0');
  const cantidadPagos = pagosHoyData?.cantidad_pagos;

  const [displayMonto, setDisplayMonto] = useState(0);
  const prevMonto = useRef(0);

  const widgetRef = useRef<HTMLDivElement>(null);
  const [posicion, setPosicion] = useState<Posicion | null>(null);
  const arrastreRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);

  // Cargar posición guardada al montar
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(STORAGE_KEY);
      if (guardada) {
        setPosicion(JSON.parse(guardada));
      }
    } catch {
      // ignorar si no se puede leer
    }
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!arrastreRef.current || !widgetRef.current) return;
    const { offsetX, offsetY } = arrastreRef.current;
    const ancho = widgetRef.current.offsetWidth;
    const alto = widgetRef.current.offsetHeight;
    const nuevaX = clamp(e.clientX - offsetX, 0, window.innerWidth - ancho);
    const nuevaY = clamp(e.clientY - offsetY, 0, window.innerHeight - alto);
    setPosicion({ x: nuevaX, y: nuevaY });
  }, []);

  const onPointerUp = useCallback(() => {
    arrastreRef.current = null;
    setArrastrando(false);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    setPosicion((actual) => {
      if (actual) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(actual));
        } catch {
          // ignorar si no se puede guardar
        }
      }
      return actual;
    });
  }, [onPointerMove]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    arrastreRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    // Fija la posición actual en px para poder moverla libremente desde ahí
    setPosicion({ x: rect.left, y: rect.top });
    setArrastrando(true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Limpieza de listeners si el componente se desmonta mientras se arrastra
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

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

  const estiloPosicion: React.CSSProperties = posicion
    ? { left: posicion.x, top: posicion.y, right: 'auto', bottom: 'auto' }
    : {};

  return (
    <div
      ref={widgetRef}
      className={`pulse-widget${arrastrando ? ' pulse-widget-dragging' : ''}`}
      style={estiloPosicion}
    >
      <div className="pulse-widget-top pulse-widget-drag-handle" onPointerDown={onPointerDown}>
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