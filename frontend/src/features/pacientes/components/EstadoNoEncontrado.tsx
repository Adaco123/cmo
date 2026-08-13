import React from 'react';

interface EstadoNoEncontradoProps {
  searchQuery: string;
  onCrearPaciente: () => void;
}

/**
 * Saca de CMODashboard.tsx el bloque "new-attention-empty"
 * (busquedaEstado === 'no_encontrado').
 */
const EstadoNoEncontrado: React.FC<EstadoNoEncontradoProps> = ({ searchQuery, onCrearPaciente }) => (
  <div className="new-attention-empty">
    <div className="new-attention-empty-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </div>
    <div className="new-attention-empty-text">
      <strong>No encontramos a "{searchQuery}"</strong>
      <p>Puedes crear su ficha ahora mismo y continuar con la atención sin salir de esta pantalla.</p>
    </div>
    <button className="glow-btn" type="button" onClick={onCrearPaciente}>
      Crear nuevo paciente
    </button>
  </div>
);

export default EstadoNoEncontrado;