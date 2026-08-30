import { useState, useCallback, useEffect } from 'react';
import { getPacientes, updatePaciente, type Paciente } from '../../../api/pacientes';

interface PacienteFilters {
  misPacientes: string;
  externos: string;
}

export function usePacientes() {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PacienteFilters>({
    misPacientes: '',
    externos: '',
  });

  const handleFilterChange = (key: keyof PacienteFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

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
    void reload();
  }, [reload]);

  const matchesSearch = (p: Paciente, search: string) => {
    const q = search.toLowerCase();
    const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
    return (
      !q ||
      fullName.includes(q) ||
      p.documento.toLowerCase().includes(q) ||
      (p.telefono || '').toLowerCase().includes(q) ||
      (p.correo || '').toLowerCase().includes(q)
    );
  };

  const filteredMisPacientes = pacientes.filter(
    (p) => p.origen_id === 1 && matchesSearch(p, filters.misPacientes)
  );

  const filteredExternos = pacientes.filter(
    (p) => p.origen_id === 2 && matchesSearch(p, filters.externos)
  );

  /**
   * Activa/desactiva un paciente (switch). Actualiza la lista al toque
   * (optimista) para que se sienta instantáneo, y revierte si el
   * backend rechaza el cambio.
   */
  const cambiarEstado = useCallback(async (paciente: Paciente) => {
    const estadoAnterior = paciente.estado;
    const nuevoEstado = !estadoAnterior;

    setPacientes((prev) =>
      prev.map((p) => (p.id === paciente.id ? { ...p, estado: nuevoEstado } : p)),
    );

    try {
      await updatePaciente(paciente.id, { estado: nuevoEstado });
    } catch (err) {
      setPacientes((prev) =>
        prev.map((p) => (p.id === paciente.id ? { ...p, estado: estadoAnterior } : p)),
      );
      throw err;
    }
  }, []);

  return {
    pacientes,
    loading,
    error,
    filters,
    handleFilterChange,
    reload,
    filteredMisPacientes,
    filteredExternos,
    cambiarEstado,
  };
}