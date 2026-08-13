import { useState, useCallback, useEffect } from 'react';
import { getCitas, updateCita, type Cita } from '../../../api/citas';

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Saca de CMODashboard.tsx: citasHoy, loadingCitas, citasError,
 * finalizandoId, loadCitas y finalizarCita.
 *
 * Uso en CMODashboard.tsx:
 *   const { citasHoy, loading, error, finalizandoId, reload, finalizar } = useCitasHoy();
 */
export function useCitasHoy() {
  const [citasHoy, setCitasHoy] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalizandoId, setFinalizandoId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCitas();
      const todayKey = formatDateKey(new Date());
      const citasDelDia = data.filter((cita) => {
        const fechaCita = String(cita.fecha || '').slice(0, 10);
        return fechaCita === todayKey && Number(cita.estado_id) !== 2;
      });

      citasDelDia.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
      setCitasHoy(citasDelDia);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudieron cargar las citas.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const finalizar = async (cita: Cita) => {
    try {
      setFinalizandoId(cita.id);
      await updateCita(cita.id, { estado_id: 2 });
      await reload();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo finalizar la cita.';
      setError(message);
    } finally {
      setFinalizandoId(null);
    }
  };

  useEffect(() => {
    void reload();
  }, [reload]);

  return { citasHoy, loading, error, finalizandoId, reload, finalizar };
}