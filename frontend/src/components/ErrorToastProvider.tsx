import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import styles from './ErrorToast.module.css';
import { extractErrorMessage } from '../utils/errors';

interface ToastState {
  mensaje: string;
  tipo: 'error' | 'success' | 'confirm';
  /** Solo para tipo 'confirm': textos de los botones (opcionales). */
  textoAceptar?: string;
  textoCancelar?: string;
}

interface ConfirmOpciones {
  /** Texto del botón de aceptar. Por defecto: "Sí, cerrar". */
  textoAceptar?: string;
  /** Texto del botón de cancelar. Por defecto: "Cancelar". */
  textoCancelar?: string;
}

interface ErrorToastContextValue {
  /** Muestra un error ya como texto plano. */
  showError: (msg: string) => void;
  /** Extrae el mensaje de un error de axios/backend y lo muestra. */
  showErrorFrom: (err: unknown, fallback: string) => void;
  /** Muestra un mensaje de éxito (ej. tras un 200/201) como texto plano. */
  showSuccess: (msg: string) => void;
  /**
   * Pregunta algo con botones "Sí, cerrar" / "Cancelar" (o los textos que
   * se pasen en `opciones`) en vez del window.confirm nativo del navegador.
   * No se autocierra: espera a que el usuario elija. Devuelve una promesa
   * que resuelve `true` si aceptó.
   */
  confirm: (mensaje: string, opciones?: ConfirmOpciones) => Promise<boolean>;
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

  // Si había una confirmación abierta y sale otro toast (o se abre otra
  // confirmación) encima, la pendiente se resuelve como "cancelada" en vez de
  // quedar colgada para siempre (el usuario ya no vería sus botones).
  const cancelarConfirmPendiente = useCallback(() => {
    confirmResolverRef.current?.(false);
    confirmResolverRef.current = null;
  }, []);

  const mostrar = useCallback((mensaje: string, tipo: ToastState['tipo'], duracion: number) => {
    cancelarConfirmPendiente();
    setToast({ mensaje, tipo });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), duracion);
  }, [cancelarConfirmPendiente]);

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

  const confirm = useCallback((mensaje: string, opciones?: ConfirmOpciones) => {
    return new Promise<boolean>((resolve) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelarConfirmPendiente();
      confirmResolverRef.current = resolve;
      setToast({
        mensaje,
        tipo: 'confirm',
        textoAceptar: opciones?.textoAceptar,
        textoCancelar: opciones?.textoCancelar,
      });
    });
  }, [cancelarConfirmPendiente]);

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
                {toast.textoCancelar ?? 'Cancelar'}
              </button>
              <button type="button" className={styles.btnConfirmAceptar} onClick={() => resolverConfirm(true)}>
                {toast.textoAceptar ?? 'Sí, cerrar'}
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