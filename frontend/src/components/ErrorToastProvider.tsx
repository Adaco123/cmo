import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './ErrorToast.module.css';
import { extractErrorMessage } from '../utils/errors';

interface ToastState {
  mensaje: string;
  tipo: 'error' | 'success' | 'confirm';
}

interface ErrorToastContextValue {
  /** Muestra un error ya como texto plano. */
  showError: (msg: string) => void;
  /** Extrae el mensaje de un error de axios/backend y lo muestra. */
  showErrorFrom: (err: unknown, fallback: string) => void;
  /** Muestra un mensaje de éxito (ej. tras un 200/201) como texto plano. */
  showSuccess: (msg: string) => void;
  /**
   * Pregunta algo con botones "Sí, cerrar" / "Cancelar" en vez del
   * window.confirm nativo del navegador. No se autocierra: espera a que
   * el usuario elija. Devuelve una promesa que resuelve `true` si aceptó.
   */
  confirm: (mensaje: string) => Promise<boolean>;
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
  const confirmResolverRef = useRef<((valor: boolean) => void) | null>(null);

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

  const resolverConfirm = useCallback((valor: boolean) => {
    confirmResolverRef.current?.(valor);
    confirmResolverRef.current = null;
    setToast(null);
  }, []);

  const confirm = useCallback((mensaje: string) => {
    return new Promise<boolean>((resolve) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      confirmResolverRef.current = resolve;
      setToast({ mensaje, tipo: 'confirm' });
    });
  }, []);

  return (
    <ErrorToastContext.Provider value={{ showError, showErrorFrom, showSuccess, confirm }}>
      {children}
      {toast && (
        <div
          className={`${styles.toast} ${toast.tipo === 'success' ? styles.success : ''} ${toast.tipo === 'confirm' ? styles.confirm : ''}`}
          role={toast.tipo === 'confirm' ? 'alertdialog' : 'alert'}
        >
          <span>{toast.mensaje}</span>
          {toast.tipo === 'confirm' ? (
            <div className={styles.confirmActions}>
              <button type="button" className={styles.btnConfirmCancelar} onClick={() => resolverConfirm(false)}>
                Cancelar
              </button>
              <button type="button" className={styles.btnConfirmAceptar} onClick={() => resolverConfirm(true)}>
                Sí, cerrar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (timerRef.current) clearTimeout(timerRef.current);
                setToast(null);
              }}
            >
              Cerrar
            </button>
          )}
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