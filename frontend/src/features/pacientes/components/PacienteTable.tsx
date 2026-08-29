import React from 'react';
import { type Paciente } from '../../../api/pacientes';
import StatusBadge from '../../../components/ui/StatusBadge';
import ViewButton from '../../../components/ui/ViewButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen, faToggleOn, faToggleOff } from '@fortawesome/free-solid-svg-icons';

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
  /** Abre el paciente en modo edición. Opcional: si no se pasa, el botón
   *  igual se muestra pero solo avisa por consola (falta conectar). */
  onEditar?: (paciente: Paciente) => void;
  /** Activa/desactiva al paciente. Opcional por el mismo motivo. */
  onCambiarEstado?: (paciente: Paciente) => void;
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
  onEditar,
  onCambiarEstado,
  emptyMessage,
}) => {
  const handleEditar = (p: Paciente) => {
    if (onEditar) onEditar(p);
    else console.warn('PacienteTable: falta conectar onEditar');
  };

  const handleCambiarEstado = (p: Paciente) => {
    if (onCambiarEstado) onCambiarEstado(p);
    else console.warn('PacienteTable: falta conectar onCambiarEstado');
  };

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
          <button className="glow-btn danger" type="button" onClick={onAgregar}>
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
            <th>Acciones</th>
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
              const activo = Boolean(p.estado);
              return (
                <tr key={p.id}>
                  <td className="patient-name">{fullName}</td>
                  <td>{p.documento}</td>
                  <td>{p.telefono || '—'}</td>
                  <td>{p.correo || '—'}</td>
                  <td><StatusBadge activo={activo} /></td>
                  <td>
                    <div className="row-actions">
                      <ViewButton name={fullName} onClick={() => onVer(p)} />
                      <button
                        type="button"
                        className="icon-action-btn"
                        aria-label={`Editar ${fullName}`}
                        title="Editar"
                        onClick={() => handleEditar(p)}
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                      <button
                        type="button"
                        className={`icon-action-btn ${activo ? 'icon-action-btn-active' : 'icon-action-btn-inactive'}`}
                        aria-label={activo ? `Desactivar ${fullName}` : `Activar ${fullName}`}
                        title={activo ? 'Desactivar' : 'Activar'}
                        onClick={() => handleCambiarEstado(p)}
                      >
                        <FontAwesomeIcon icon={activo ? faToggleOn : faToggleOff} />
                      </button>
                    </div>
                  </td>
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