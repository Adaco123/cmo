import { useState } from 'react';
import { type Paciente } from '../../../api/pacientes';

type BusquedaEstado = 'idle' | 'buscando' | 'encontrado' | 'no_encontrado';

/**
 * Saca de CMODashboard.tsx: searchQuery, busquedaEstado, resultadosBusqueda
 * y handleBuscarPaciente (el flujo del tab "Nueva atención").
 *
 * Recibe la lista de pacientes ya cargada (de usePacientes) para buscar
 * sobre ella localmente, igual que hacía el componente original.
 *
 * Uso en CMODashboard.tsx:
 *   const { searchQuery, setSearchQuery, busquedaEstado, resultados, buscar } =
 *     useBuscarPaciente(pacientes);
 */
export function useBuscarPaciente(pacientes: Paciente[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [busquedaEstado, setBusquedaEstado] = useState<BusquedaEstado>('idle');
  const [resultados, setResultados] = useState<Paciente[]>([]);

  const buscar = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    setBusquedaEstado('buscando');

    // Mantiene el mismo delay artificial que tenía el original (feedback visual de "vitals-strip")
    window.setTimeout(() => {
      const matches = pacientes.filter((p) => {
        const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
        return fullName.includes(q) || p.documento.toLowerCase().includes(q);
      });
      setResultados(matches);
      setBusquedaEstado(matches.length > 0 ? 'encontrado' : 'no_encontrado');
    }, 650);
  };

  return {
    searchQuery,
    setSearchQuery,
    busquedaEstado,
    resultados,
    buscar,
  };
}