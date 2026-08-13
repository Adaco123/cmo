import React from 'react';
import { type Paciente } from '../../../api/pacientes';

interface ResultadosBusquedaProps {
  resultados: Paciente[];
  onSeleccionar: (paciente: Paciente) => void;
}

/**
 * Saca de CMODashboard.tsx el bloque "new-attention-results"
 * (busquedaEstado === 'encontrado').
 */
const ResultadosBusqueda: React.FC<ResultadosBusquedaProps> = ({ resultados, onSeleccionar }) => (
  <div className="new-attention-results">
    {resultados.map((p) => {
      const fullName = `${p.nombres} ${p.apellidos}`.trim();
      const iniciales = `${p.nombres?.[0] || ''}${p.apellidos?.[0] || ''}`.toUpperCase();
      const origenClass = p.origen_id === 2 ? 'patient-result-card-blue' : 'patient-result-card-red';

      return (
        <div
          key={p.id}
          className={`patient-result-card ${origenClass}`}
          onClick={() => onSeleccionar(p)}
        >
          <div className="patient-result-avatar">{iniciales}</div>
          <div className="patient-result-info">
            <div className="patient-result-name">{fullName}</div>
            <div className="patient-result-meta">
              Doc. {p.documento}{p.telefono ? ` · ${p.telefono}` : ''}
            </div>
          </div>
          <svg className="patient-result-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );
    })}
  </div>
);

export default ResultadosBusqueda;