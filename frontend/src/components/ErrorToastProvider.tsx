import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './ErrorToast.module.css';
import { extractErrorMessage } from '../utils/errors';

interface ToastState {
  mensaje: string;
  tipo: 'error' | 'success';
}

interface ErrorToastContextValue {
  /** Muestra un error ya como texto plano. */
  showError: (msg: string) => void;
  /** Extrae el mensaje de un error de axios/backend y lo muestra. */
  showErrorFrom: (err: unknown, fallback: string) => void;
  /** Muestra un mensaje de éxito (ej. tras un 200/201) como texto plano. */
  showSuccess: (msg: string) => void;
}

const ErrorToastContext = createContext<ErrorToastContextValue | null>(null);

/**
 * Provider global para mostrar mensajes del sistema (éxito o error del
 * backend, de red, etc.) como un toast, en vez de que cada componente
 * reinvente su propio window.alert() o su propio toast local.
 *
 * Se monta una sola vez en App.tsx, envolviendo toda la aplicación.
 */
export const ErrorToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mostrar = useCallback((mensaje: string, tipo: ToastState['tipo'], duracion: number) => {
    setToast({ mensaje, tipo });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), duracion);
  }, []);

  const showError = useCallback((msg: string) => mostrar(msg, 'error', 6000), [mostrar]);

  const showSuccess = useCallback((msg: string) => mostrar(msg, 'success', 4000), [mostrar]);

  const showErrorFrom = useCallback(
    (err: unknown, fallback: string) => {
      showError(extractErrorMessage(err, fallback));
    },
    [showError],
  );

  return (
    <ErrorToastContext.Provider value={{ showError, showErrorFrom, showSuccess }}>
      {children}
      {toast && (
        <div
          className={`${styles.toast} ${toast.tipo === 'success' ? styles.success : ''}`}
          role="alert"
        >
          <span>{toast.mensaje}</span>
          <button
            type="button"
            onClick={() => {
              if (timerRef.current) clearTimeout(timerRef.current);
              setToast(null);
            }}
          >
            Cerrar
          </button>
        </div>
      )}
    </ErrorToastContext.Provider>
  );
};

/** Hook para mostrar mensajes del sistema (éxito o error) desde cualquier componente. */
export function useErrorToast(): ErrorToastContextValue {
  const ctx = useContext(ErrorToastContext);
  if (!ctx) {
    throw new Error('useErrorToast debe usarse dentro de <ErrorToastProvider>');
  }
  return ctx;
}