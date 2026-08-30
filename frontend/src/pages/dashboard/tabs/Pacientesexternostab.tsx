import React from 'react';
import { type Paciente } from '../../../api/pacientes';
import PacienteTable from '../../../features/pacientes/components/PacienteTable';

interface PacientesExternosTabProps {
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

const PacientesExternosTab: React.FC<PacientesExternosTabProps> = (props) => {
  const { active, ...tableProps } = props;
  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <PacienteTable
        titulo="Pacientes Externos"
        searchPlaceholder="Buscar en pacientes externos..."
        emptyMessage="No hay pacientes externos."
        {...tableProps}
      />
    </div>
  );
};

export default PacientesExternosTab;