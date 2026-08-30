import React from 'react';
import { type Paciente } from '../../../api/pacientes';
import PacienteTable from '../../../features/pacientes/components/PacienteTable';

interface MisPacientesTabProps {
  active: boolean;
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAgregar: () => void;
  onVer: (paciente: Paciente) => void;
  onEditar: (paciente: Paciente) => void;
  onCambiarEstado: (paciente: Paciente) => void;
}

const MisPacientesTab: React.FC<MisPacientesTabProps> = (props) => {
  const { active, ...tableProps } = props;
  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <PacienteTable
        titulo="Mis Pacientes"
        searchPlaceholder="Buscar en mis pacientes..."
        emptyMessage="No hay pacientes de esta categoría."
        mostrarDiagnostico
        {...tableProps}
      />
    </div>
  );
};

export default MisPacientesTab;