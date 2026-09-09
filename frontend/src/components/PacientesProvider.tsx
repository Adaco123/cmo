import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type Paciente, getPacientes, updatePaciente } from '../api/pacientes';
import { useAuth } from './AuthProvider';

interface PacientesContextValue {
  /** Lista completa de pacientes (propios + externos), sin filtrar. */
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  /** Vuelve a pedir la lista completa — llamar tras crear/editar un paciente. */
  reload: () => Promise<void>;
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

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPacientes();
      setPacientes(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar los pacientes.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Esperamos a que AuthProvider resuelva la sesión (init() ya
    // terminó) antes de pedir la lista — así no salimos con un fetch
    // sin token apenas arranca la app, que antes chocaba con el login
    // en curso y terminaba en un 401 "fantasma".
    if (authLoading) return;
    if (!isAuthenticated) {
      setPacientes([]);
      setLoading(false);
      return;
    }
    void reload();
  }, [authLoading, isAuthenticated, reload]);

  const cambiarEstado = useCallback(async (paciente: Paciente) => {
    const estadoAnterior = paciente.estado;
    const nuevoEstado = !estadoAnterior;

    setPacientes((prev) =>
      prev.map((p) => (p.id === paciente.id ? { ...p, estado: nuevoEstado } : p))
    );

    try {
      await updatePaciente(paciente.id, { estado: nuevoEstado });
    } catch (err) {
      setPacientes((prev) =>
        prev.map((p) => (p.id === paciente.id ? { ...p, estado: estadoAnterior } : p))
      );
      throw err;
    }
  }, []);

  return (
    <PacientesContext.Provider value={{ pacientes, loading, error, reload, cambiarEstado }}>
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