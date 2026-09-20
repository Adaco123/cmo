import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { type Cita, type CitaPayload, getCitas, updateCita } from '../api/citas';
import {
  type SeguimientoControl,
  type SeguimientoControlUpdatePayload,
  getSeguimientos,
  updateSeguimientoControl,
} from '../api/seguimientoControl';
import { type Paciente } from '../api/pacientes';
import { type EstadoCita, getEstadosCita } from '../api/estadosCita';
import { usePacientes } from './PacientesProvider';
import { useAuth } from './AuthProvider';
import { useRefrescoAutomatico } from '../hooks/useRefrescoAutomatico';

/** Cada cuánto se revisa si otro usuario agendó/cambió citas o controles (pestaña visible). */
const REFRESCO_AGENDA_MS = 30_000;

interface CalendarioContextValue {
  abierto: boolean;
  citas: Cita[];
  seguimientos: SeguimientoControl[];
  pacientes: Paciente[];
  estadosCita: EstadoCita[];
  /** true una vez que la agenda se cargó al menos una vez (por abrir()
   *  o por refrescarAgenda()) — sirve para no repetir el fetch inicial
   *  en cada componente que consume el Context. */
  agendaCargada: boolean;
  loading: boolean;
  error: string | null;
  /** Abre el picker de calendario (modal) Y carga los datos si hace falta. */
  abrir: () => void;
  /** Cierra el picker de calendario. No toca los datos cargados. */
  cerrar: () => void;
  /** Recarga citas/seguimientos/pacientes/estadosCita sin abrir el modal —
   *  para pantallas como "Seguimiento y Control" que necesitan los datos
   *  pero no muestran el picker. */
  refrescarAgenda: () => void;
  /**
   * Inserta (o reemplaza, si ya estaba) una cita en el estado compartido
   * sin pedir nada al backend. Usar con lo que devuelve createCita: la
   * agenda se actualiza al instante y sin recargar citas, seguimientos y
   * estados completos.
   */
  agregarCita: (cita: Cita) => void;
  /** Actualiza una cita en el backend y en el estado compartido. */
  actualizarCita: (citaId: number, cambios: Partial<CitaPayload>) => Promise<Cita>;
  /**
   * Marca una cita como "Atendida" — busca ese estado por NOMBRE en
   * estadosCita (nunca por id hardcodeado, ver comentario en
   * api/estadosCita.ts) y llama actualizarCita con su id real.
   */
  finalizarCita: (citaId: number) => Promise<Cita>;
  /** Actualiza un seguimiento de control en el backend y en el estado compartido. */
  actualizarSeguimiento: (
    seguimientoId: number,
    cambios: SeguimientoControlUpdatePayload
  ) => Promise<SeguimientoControl>;
}

const CalendarioContext = createContext<CalendarioContextValue | null>(null);

/**
 * Provider global de los datos de agenda (citas, seguimientos de
 * control, pacientes, estados de cita).
 *
 * Antes cada pantalla que necesitaba estos datos tenía su propio fetch
 * independiente: CrearCita, RegistroClinico, Control e Iniciotab
 * llamaban su propio `useCalendarioData()`; por separado,
 * SeguimientoControlTab (la pestaña "Seguimiento y Control" del
 * dashboard) tenía su PROPIA copia de citas/seguimientos/estadosCita,
 * y encima el modal de edición de esa misma pestaña volvía a pedir
 * estadosCita una cuarta vez. Resultado: hasta 3-4 fetches del mismo
 * catálogo de estados, y si editabas una cita desde una pantalla, las
 * demás no se enteraban hasta volver a abrir su propio picker.
 *
 * Con este Provider hay una sola fuente de verdad para toda la agenda,
 * incluida su edición: `actualizarCita`/`actualizarSeguimiento` pegan al
 * backend y actualizan el array compartido en el mismo paso, así que
 * cualquier pantalla que use `useCalendario()` ve el cambio al instante.
 *
 * `abrir()` y `refrescarAgenda()` comparten la misma lógica de fetch,
 * pero `refrescarAgenda()` NO toca `abierto` — así una pantalla que solo
 * necesita los datos (sin mostrar el picker) no dispara el modal sin
 * querer.
 *
 * `finalizarCita()` reemplaza a la vieja `useCitasHoy().finalizar()`, que
 * hacía `updateCita(id, { estado_id: 2 })` hardcodeado — en el catálogo
 * real (`ESTADOS_CITA_POR_DEFECTO` en el backend) el id 2 es "Cancelada",
 * no "Completada"/"Atendida". O sea, el botón "Finalizar" del dashboard
 * en realidad cancelaba la cita. Se agregó el estado "Atendida" al
 * catálogo del backend, y acá se busca siempre por nombre.
 *
 * La agenda pertenece a la SESIÓN: al cerrar sesión se vacía (citas,
 * seguimientos, estados, picker abierto y `agendaCargada`), así quien
 * inicie sesión después — otra cuenta, o la misma horas más tarde en la
 * misma pestaña — siempre parte de una agenda sin cargar y la pide de
 * nuevo, en vez de ver la de la sesión anterior. Si una carga sigue en
 * vuelo al cerrar sesión, su respuesta se descarta.
 *
 * `pacientes` YA NO se pide acá — se lee de PacientesProvider (que debe
 * montarse arriba de este Provider en App.tsx), para no tener dos copias
 * de la misma lista completa de pacientes en la app.
 */
export const CalendarioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pacientes } = usePacientes();
  const { isAuthenticated } = useAuth();

  const [abierto, setAbierto] = useState(false);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [seguimientos, setSeguimientos] = useState<SeguimientoControl[]>([]);
  const [estadosCita, setEstadosCita] = useState<EstadoCita[]>([]);
  const [agendaCargada, setAgendaCargada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Número de "sesión": sube cada vez que se cierra sesión. Cada carga
  // recuerda el número con el que empezó y, si al terminar ya es otro,
  // descarta su resultado (era de la sesión anterior).
  const sesionRef = useRef(0);
  // Número de la última carga lanzada: si llega una respuesta cuando ya
  // salió otra más nueva, se descarta (una respuesta vieja nunca pisa a una
  // más reciente). enVueloRef indica que esa última carga sigue en curso.
  const peticionRef = useRef(0);
  const enVueloRef = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      sesionRef.current += 1;
      enVueloRef.current = false;
    }
  }, [isAuthenticated]);

  // Al pasar a "sin sesión" se vacía todo. Se hace durante el render (patrón
  // "ajustar estado cuando cambia un valor" de React) y no en un useEffect,
  // para no dejar ni un render con la agenda vieja a la vista.
  const [sesionActiva, setSesionActiva] = useState(isAuthenticated);
  if (sesionActiva !== isAuthenticated) {
    setSesionActiva(isAuthenticated);
    if (!isAuthenticated) {
      setAbierto(false);
      setCitas([]);
      setSeguimientos([]);
      setEstadosCita([]);
      setAgendaCargada(false);
      setLoading(false);
      setError(null);
    }
  }

  // silencioso: refresco automático en segundo plano. No enciende `loading`
  // ni muestra errores (un fallo de red no debe tapar la agenda a la vista)
  // y no vuelve a pedir los estados de cita, que casi nunca cambian.
  const cargarDatos = useCallback((opciones?: { silencioso?: boolean }) => {
    const silencioso = opciones?.silencioso === true;
    const sesion = sesionRef.current;
    const peticion = ++peticionRef.current;
    enVueloRef.current = true;
    if (!silencioso) {
      setLoading(true);
      setError(null);
    }
    Promise.all([
      getCitas(),
      getSeguimientos(),
      silencioso ? Promise.resolve(null) : getEstadosCita(),
    ])
      .then(([citasData, seguimientosData, estadosData]) => {
        if (sesionRef.current !== sesion) return; // se cerró sesión mientras cargaba
        if (peticionRef.current !== peticion) return; // salió una carga más nueva
        setCitas(citasData);
        setSeguimientos(seguimientosData);
        if (estadosData) setEstadosCita(estadosData);
        setAgendaCargada(true);
      })
      .catch(() => {
        if (silencioso) return;
        if (sesionRef.current === sesion && peticionRef.current === peticion) {
          setError('No se pudieron cargar los datos del calendario.');
        }
      })
      .finally(() => {
        if (peticionRef.current !== peticion) return; // la carga más nueva se encarga
        enVueloRef.current = false;
        if (sesionRef.current === sesion) setLoading(false);
      });
  }, []);

  // Un cambio local (cita nueva, cita editada...) puede ocurrir mientras
  // hay una carga en vuelo que arrancó ANTES del cambio: su respuesta no lo
  // incluiría y lo pisaría. En ese caso se vuelve a pedir la agenda (la
  // carga vieja queda descartada por peticionRef).
  const reconciliarSiHayCargaEnVuelo = useCallback(() => {
    if (enVueloRef.current) cargarDatos();
  }, [cargarDatos]);

  const abrir = useCallback(() => {
    setAbierto(true);
    cargarDatos();
  }, [cargarDatos]);

  const cerrar = useCallback(() => setAbierto(false), []);

  const refrescarAgenda = useCallback(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Refresco automático: otro usuario (u otro equipo) puede agendar o
  // cambiar citas y controles. Solo corre cuando la agenda ya se cargó una
  // vez, y se omite si hay una carga en curso.
  const refrescoAutomatico = useCallback(() => {
    if (enVueloRef.current) return;
    cargarDatos({ silencioso: true });
  }, [cargarDatos]);
  useRefrescoAutomatico(refrescoAutomatico, {
    intervaloMs: REFRESCO_AGENDA_MS,
    habilitado: isAuthenticated && agendaCargada,
  });

  const agregarCita = useCallback(
    (cita: Cita) => {
      setCitas((prev) =>
        prev.some((c) => c.id === cita.id)
          ? prev.map((c) => (c.id === cita.id ? cita : c))
          : [...prev, cita]
      );
      reconciliarSiHayCargaEnVuelo();
    },
    [reconciliarSiHayCargaEnVuelo]
  );

  const actualizarCita = useCallback(
    async (citaId: number, cambios: Partial<CitaPayload>) => {
      const citaActualizada = await updateCita(citaId, cambios);
      setCitas((prev) => prev.map((c) => (c.id === citaId ? citaActualizada : c)));
      reconciliarSiHayCargaEnVuelo();
      return citaActualizada;
    },
    [reconciliarSiHayCargaEnVuelo]
  );

  const finalizarCita = useCallback(
    async (citaId: number) => {
      const estadoAtendida = estadosCita.find(
        (e) => e.nombre.trim().toLowerCase() === 'atendida'
      );
      if (!estadoAtendida) {
        throw new Error('No se encontró el estado "Atendida" en el catálogo de estados de cita.');
      }
      return actualizarCita(citaId, { estado_id: estadoAtendida.id });
    },
    [estadosCita, actualizarCita]
  );

  const actualizarSeguimiento = useCallback(
    async (seguimientoId: number, cambios: SeguimientoControlUpdatePayload) => {
      const seguimientoActualizado = await updateSeguimientoControl(seguimientoId, cambios);
      setSeguimientos((prev) =>
        prev.map((s) => (s.id === seguimientoId ? seguimientoActualizado : s))
      );
      reconciliarSiHayCargaEnVuelo();
      return seguimientoActualizado;
    },
    [reconciliarSiHayCargaEnVuelo]
  );

  return (
    <CalendarioContext.Provider
      value={{
        abierto,
        citas,
        seguimientos,
        pacientes,
        estadosCita,
        agendaCargada,
        loading,
        error,
        abrir,
        cerrar,
        refrescarAgenda,
        agregarCita,
        actualizarCita,
        finalizarCita,
        actualizarSeguimiento,
      }}
    >
      {children}
    </CalendarioContext.Provider>
  );
};

/** Hook para leer/controlar la agenda compartida desde cualquier componente. */
export function useCalendario(): CalendarioContextValue {
  const ctx = useContext(CalendarioContext);
  if (!ctx) {
    throw new Error('useCalendario debe usarse dentro de <CalendarioProvider>');
  }
  return ctx;
}