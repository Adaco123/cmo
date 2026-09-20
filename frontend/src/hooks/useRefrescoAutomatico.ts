import { useEffect, useRef } from 'react';

interface OpcionesRefrescoAutomatico {
  /** Cada cuánto se vuelve a pedir el dato mientras la pestaña está visible. */
  intervaloMs: number;
  /** false = no hace nada (ej. sin sesión, o el dato todavía no se cargó). */
  habilitado?: boolean;
  /**
   * Tiempo mínimo entre un refresco y el siguiente disparado por
   * "volví a la pestaña" / "volvió internet". Evita pedir dos veces seguidas
   * si el usuario cambia de ventana rápido. Default: 5 s.
   */
  minEntreRefrescosMs?: number;
}

/**
 * Mantiene un dato del servidor al día cuando OTRA persona (u otro
 * dispositivo) lo cambia — algo que el propio frontend no puede enterarse
 * por sí solo:
 *
 *  - Cada `intervaloMs` llama a `refrescar`, pero SOLO si la pestaña está
 *    visible y hay conexión (una pestaña en segundo plano no gasta
 *    peticiones).
 *  - Al volver a la pestaña (visibilitychange), enfocar la ventana o
 *    recuperar internet, refresca en el acto en vez de esperar al próximo
 *    ciclo — así, al volver de otra ventana ya ves lo último.
 *
 * `refrescar` debe ser silenciosa (sin spinner ni errores en pantalla): se
 * dispara sola, sin que el usuario haya hecho nada.
 */
export function useRefrescoAutomatico(
  refrescar: () => void,
  { intervaloMs, habilitado = true, minEntreRefrescosMs = 5000 }: OpcionesRefrescoAutomatico
): void {
  // Siempre se llama a la versión más reciente de `refrescar` sin tener que
  // reiniciar el intervalo cada vez que cambia su identidad.
  const refrescarRef = useRef(refrescar);
  useEffect(() => {
    refrescarRef.current = refrescar;
  });

  useEffect(() => {
    if (!habilitado) return;

    let ultimoRefresco = Date.now();

    const ejecutar = () => {
      if (document.visibilityState !== 'visible') return;
      if (navigator.onLine === false) return;
      ultimoRefresco = Date.now();
      refrescarRef.current();
    };

    const alVolver = () => {
      if (Date.now() - ultimoRefresco >= minEntreRefrescosMs) ejecutar();
    };

    const intervalo = setInterval(ejecutar, intervaloMs);
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    window.addEventListener('online', alVolver);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('online', alVolver);
    };
  }, [habilitado, intervaloMs, minEntreRefrescosMs]);
}