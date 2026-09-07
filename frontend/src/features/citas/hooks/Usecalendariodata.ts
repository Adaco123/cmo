import { useCallback, useState } from 'react';
import { type Cita, getCitas } from '../../../api/citas';
import { type SeguimientoControl, getSeguimientos } from '../../../api/seguimientoControl';
import { type Paciente, getPacientes } from '../../../api/pacientes';

export function useCalendarioData() {
  const [abierto, setAbierto] = useState(false);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [seguimientos, setSeguimientos] = useState<SeguimientoControl[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abrir = useCallback(() => {
    setAbierto(true);
    setLoading(true);
    setError(null);
    Promise.all([getCitas(), getSeguimientos(), getPacientes()])
      .then(([citasData, seguimientosData, pacientesData]) => {
        setCitas(citasData);
        setSeguimientos(seguimientosData);
        setPacientes(pacientesData);
      })
      .catch(() => setError('No se pudieron cargar los datos del calendario.'))
      .finally(() => setLoading(false));
  }, []);

  const cerrar = useCallback(() => setAbierto(false), []);

  return { abierto, citas, seguimientos, pacientes, loading, error, abrir, cerrar };
}