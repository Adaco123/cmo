import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type Paciente, getPacientes, updatePaciente } from '../api/pacientes';
import { useAuth } from './AuthProvider';
import { useRefrescoAutomatico } from '../hooks/useRefrescoAutomatico';

/** Cada cuánto se revisa si otro usuario creó/editó pacientes (pestaña visible). */
const REFRESCO_PACIENTES_MS = 60_000;

interface PacientesContextValue {
  /** Lista completa de pacientes (propios + externos), sin filtrar. */
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  /**
   * Vuelve a pedir la lista completa. Con `{ silencioso: true }` (y la lista
   * ya cargada) no toca `error`: un fallo de red no borra la tabla de la
   * pantalla. Lo usa el refresco automático.
   */
  reload: (opciones?: { silencioso?: boolean }) => Promise<void>;
  /**
   * Inserta (si es nuevo) o reemplaza (si ya está) un paciente en la lista
   * compartida, sin pedir nada al backend. Usar con lo que devuelve
   * createPaciente / updatePaciente: la lista se actualiza al instante y
   * sin parpadeo, en vez de recargar los cientos de pacientes.
   */
  guardarPacienteLocal: (paciente: Paciente) => void;
  /**
   * Activa/desactiva un paciente (switch). Actualiza la lista compartida
   * al toque (optimista) para que se sienta instantáneo, y revierte si
   * el backend rechaza el cambio.
   */
  cambiarEstado: (paciente: Paciente) => Promise<void>;
}

const PacientesContext = createContext<PacientesContextValue | null>(null);

/**
 * Provider global de la lista completa de pacientes.
 *
 * Antes esto vivía en un hook local (`usePacientes`, usado solo por
 * Dashboardpage.tsx) y, por separado, `CalendarioProvider` pedía su
 * propia copia de `getPacientes()` para mostrar nombres en el picker del
 * calendario. Dos fetches del mismo listado completo, sin relación entre
 * sí: si creabas o desactivabas un paciente desde el dashboard, el picker
 * del calendario (en CrearCita/RegistroClinico/Control) seguía mostrando
 * la lista vieja hasta que algo disparara su propio refetch.
 *
 * Este Provider es ahora la única fuente de la lista completa.
 * `CalendarioProvider` lee de acá (con `usePacientes()`) en vez de pedirla
 * de nuevo — por eso tiene que montarse ARRIBA de `CalendarioProvider` en
 * App.tsx.
 *
 * Los filtros de búsqueda (qué escribiste en "Mis Pacientes" / "Externos")
 * a propósito NO viven acá: son estado de pantalla, no dato compartido de
 * la app, y cada pantalla que los necesite los arma localmente filtrando
 * sobre `pacientes`.
 */
export const PacientesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Control de cargas concurrentes:
  //  - peticionRef: número de la última petición lanzada. Una respuesta que
  //    llega cuando ya salió otra más nueva (o se cerró sesión) se descarta,
  //    así una respuesta vieja nunca pisa a una más reciente.
  //  - enVueloRef: hay una carga en curso (la última lanzada).
  //  - cargadoRef: la lista ya se cargó al menos una vez. Solo la PRIMERA
  //    carga muestra "Cargando pacientes..."; los refrescos posteriores son
  //    silenciosos (la tabla sigue a la vista mientras se actualiza).
  const peticionRef = useRef(0);
  const enVueloRef = useRef(false);
  const cargadoRef = useRef(false);
  // Cuántos cambios (cambiarEstado) están esperando la respuesta del backend.
  const mutacionesRef = useRef(0);

  const reload = useCallback(async (opciones?: { silencioso?: boolean }) => {
    const peticion = ++peticionRef.current;
    enVueloRef.current = true;
    // Silencioso solo si ya hay lista: si nunca cargó, un refresco sí debe
    // mostrar el error (y sirve de reintento).
    const silencioso = opciones?.silencioso === true && cargadoRef.current;
    try {
      if (!cargadoRef.current) setLoading(true);
      if (!silencioso) setError(null);
      const data = await getPacientes();
      if (peticionRef.current !== peticion) return; // llegó una petición más nueva
      cargadoRef.current = true;
      setPacientes(data);
    } catch (err: unknown) {
      if (peticionRef.current !== peticion) return;
      if (silencioso) return; // el refresco automático no muestra errores
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los pacientes.';
      setError(message);
    } finally {
      if (peticionRef.current === peticion) {
        enVueloRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Esperamos a que AuthProvider resuelva la sesión (init() ya
    // terminó) antes de pedir la lista — así no salimos con un fetch
    // sin token apenas arranca la app, que antes chocaba con el login
    // en curso y terminaba en un 401 "fantasma".
    if (authLoading) return;
    if (!isAuthenticated) {
      // Se invalida cualquier carga en vuelo: su respuesta es de la sesión
      // anterior y no debe volver a llenar la lista después del logout.
      peticionRef.current += 1;
      enVueloRef.current = false;
      cargadoRef.current = false;
      setPacientes([]);
      setLoading(false);
      return;
    }
    void reload();
  }, [authLoading, isAuthenticated, reload]);

  const guardarPacienteLocal = useCallback(
    (paciente: Paciente) => {
      setPacientes((prev) =>
        prev.some((p) => p.id === paciente.id)
          ? prev.map((p) => (p.id === paciente.id ? paciente : p))
          : [paciente, ...prev]
      );
      // Si justo hay una carga en vuelo, arrancó antes de este cambio y su
      // respuesta podría no incluirlo: se vuelve a pedir para que la lista
      // final sea consistente (la petición vieja queda descartada).
      if (enVueloRef.current) void reload();
    },
    [reload]
  );

  const cambiarEstado = useCallback(
    async (paciente: Paciente) => {
      const estadoAnterior = paciente.estado;
      const nuevoEstado = !estadoAnterior;

      setPacientes((prev) =>
        prev.map((p) => (p.id === paciente.id ? { ...p, estado: nuevoEstado } : p))
      );

      mutacionesRef.current += 1;
      try {
        await updatePaciente(paciente.id, { estado: nuevoEstado });
        // Una carga que arrancó antes de que el backend guardara el cambio
        // traería el estado viejo y desharía el switch: se vuelve a pedir.
        if (enVueloRef.current) void reload();
      } catch (err) {
        setPacientes((prev) =>
          prev.map((p) => (p.id === paciente.id ? { ...p, estado: estadoAnterior } : p))
        );
        throw err;
      } finally {
        mutacionesRef.current -= 1;
      }
    },
    [reload]
  );

  // Refresco automático: otro usuario (u otro equipo) puede crear o editar
  // pacientes. Se omite el ciclo si ya hay una carga en curso o un cambio
  // esperando al backend (para no pisar el switch optimista).
  const refrescoAutomatico = useCallback(() => {
    if (enVueloRef.current || mutacionesRef.current > 0) return;
    void reload({ silencioso: true });
  }, [reload]);
  useRefrescoAutomatico(refrescoAutomatico, {
    intervaloMs: REFRESCO_PACIENTES_MS,
    habilitado: isAuthenticated && !authLoading,
  });

  return (
    <PacientesContext.Provider
      value={{ pacientes, loading, error, reload, guardarPacienteLocal, cambiarEstado }}
    >
      {children}
    </PacientesContext.Provider>
  );
};

/** Hook para leer/actualizar la lista compartida de pacientes desde cualquier componente. */
export function usePacientes(): PacientesContextValue {
  const ctx = useContext(PacientesContext);
  if (!ctx) {
    throw new Error('usePacientes debe usarse dentro de <PacientesProvider>');
  }
  return ctx;
}