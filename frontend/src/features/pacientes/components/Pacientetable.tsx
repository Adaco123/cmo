import React from 'react';
import { type Paciente } from '../../../api/pacientes';
import StatusBadge from '../../../components/ui/StatusBadge';
import ViewButton from '../../../components/ui/ViewButton';

interface PacienteTableProps {
  titulo: string;
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
  onAgregar: () => void;
  onVer: (paciente: Paciente) => void;
  emptyMessage: string;
}

/**
 * Reemplaza las dos tablas casi idénticas de "Mis Pacientes" y
 * "Pacientes Externos" en CMODashboard.tsx. La diferencia entre
 * ambas era solo el filtro (origen_id) y los textos — ya se resuelve
 * pasando la lista `pacientes` ya filtrada desde el hook usePacientes.
 */
const PacienteTable: React.FC<PacienteTableProps> = ({
  titulo,
  pacientes,
  loading,
  error,
  searchValue,
  searchPlaceholder,
  onSearchChange,
  onAgregar,
  onVer,
  emptyMessage,
}) => {
  return (
    <div className="table-card scroll-animated">
      <div className="card-header">
        <h3>{titulo}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div className="search-table">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <button className="glow-btn" type="button" onClick={onAgregar}>
            Agregar
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Documento</th>
            <th>Teléfono</th>
            <th>Correo</th>
            <th>Estado</th>
            <th>Ver</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={6}>Cargando pacientes...</td></tr>
          ) : error ? (
            <tr><td colSpan={6}>{error}</td></tr>
          ) : pacientes.length === 0 ? (
            <tr><td colSpan={6}>{emptyMessage}</td></tr>
          ) : (
            pacientes.map((p) => {
              const fullName = `${p.nombres} ${p.apellidos}`.trim();
              return (
                <tr key={p.id}>
                  <td className="patient-name">{fullName}</td>
                  <td>{p.documento}</td>
                  <td>{p.telefono || '—'}</td>
                  <td>{p.correo || '—'}</td>
                  <td><StatusBadge activo={Boolean(p.estado)} /></td>
                  <td><ViewButton name={fullName} onClick={() => onVer(p)} /></td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default PacienteTable;