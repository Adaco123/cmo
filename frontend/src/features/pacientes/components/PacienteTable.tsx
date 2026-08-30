import React, { useMemo, useState } from 'react';
import { type Paciente } from '../../../api/pacientes';
import StatusBadge from '../../../components/ui/StatusBadge';
import ViewButton from '../../../components/ui/ViewButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPen,
  faToggleOn,
  faToggleOff,
  faSort,
  faSortUp,
  faSortDown,
} from '@fortawesome/free-solid-svg-icons';

type OrdenEstado = 'activos_primero' | 'inactivos_primero' | null;

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
  /** "Mis Pacientes" muestra el último diagnóstico en vez de correo;
   *  "Pacientes Externos" no tiene diagnóstico, así que esa columna
   *  no se muestra en absoluto (no solo vacía). */
  mostrarDiagnostico?: boolean;
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
  mostrarDiagnostico = false,
}) => {
  const [ordenEstado, setOrdenEstado] = useState<OrdenEstado>(null);

  const handleEditar = (p: Paciente) => {
    if (onEditar) onEditar(p);
    else console.warn('PacienteTable: falta conectar onEditar');
  };

  const handleCambiarEstado = (p: Paciente) => {
    if (onCambiarEstado) onCambiarEstado(p);
    else console.warn('PacienteTable: falta conectar onCambiarEstado');
  };

  const toggleOrdenEstado = () => {
    setOrdenEstado((prev) =>
      prev === null ? 'activos_primero' : prev === 'activos_primero' ? 'inactivos_primero' : null,
    );
  };

  const pacientesOrdenados = useMemo(() => {
    if (!ordenEstado) return pacientes;
    const signo = ordenEstado === 'activos_primero' ? -1 : 1;
    return [...pacientes].sort((a, b) => signo * (Number(a.estado) - Number(b.estado)));
  }, [pacientes, ordenEstado]);

  const iconoOrden =
    ordenEstado === 'activos_primero' ? faSortDown : ordenEstado === 'inactivos_primero' ? faSortUp : faSort;

  const columnas = mostrarDiagnostico ? 5 : 4;

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
            <th>Teléfono</th>
            {mostrarDiagnostico && <th>Último diagnóstico</th>}
            <th>
              <button
                type="button"
                onClick={toggleOrdenEstado}
                title={
                  ordenEstado === 'activos_primero'
                    ? 'Ordenado: activos primero (clic para invertir)'
                    : ordenEstado === 'inactivos_primero'
                    ? 'Ordenado: inactivos primero (clic para quitar orden)'
                    : 'Ordenar por estado'
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Estado <FontAwesomeIcon icon={iconoOrden} />
              </button>
            </th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columnas}>Cargando pacientes...</td></tr>
          ) : error ? (
            <tr><td colSpan={columnas}>{error}</td></tr>
          ) : pacientesOrdenados.length === 0 ? (
            <tr><td colSpan={columnas}>{emptyMessage}</td></tr>
          ) : (
            pacientesOrdenados.map((p) => {
              const fullName = `${p.nombres} ${p.apellidos}`.trim();
              const activo = Boolean(p.estado);
              return (
                <tr key={p.id}>
                  <td className="patient-name">{fullName}</td>
                  <td>{p.telefono || '—'}</td>
                  {mostrarDiagnostico && (
                    <td className="diagnostico-cell" title={p.diagnostico || undefined}>
                      {p.diagnostico || '—'}
                    </td>
                  )}
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