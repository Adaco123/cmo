import { useState, useCallback, useEffect } from 'react';
import { getPacientes, type Paciente } from '../../../api/pacientes';

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

  return {
    pacientes,
    loading,
    error,
    filters,
    handleFilterChange,
    reload,
    filteredMisPacientes,
    filteredExternos,
  };
}