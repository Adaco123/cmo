import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { type Paciente } from '../../../api/pacientes';
import { useBuscarPaciente } from '../../../features/pacientes/hooks/Usebuscarpaciente';
import ResultadosBusqueda from '../../../features/pacientes/components/ResultadosBusqueda';
import EstadoNoEncontrado from '../../../features/pacientes/components/EstadoNoEncontrado';

interface NuevaAtencionTabProps {
  active: boolean;
  pacientes: Paciente[];
  onIniciarAtencion: (paciente: Paciente) => void;
  onCrearPaciente: () => void;
}

const NuevaAtencionTab: React.FC<NuevaAtencionTabProps> = ({
  active,
  pacientes,
  onIniciarAtencion,
  onCrearPaciente,
}) => {
  const { searchQuery, setSearchQuery, busquedaEstado, resultados, buscar } =
    useBuscarPaciente(pacientes);

  return (
    <div className={`tab-content ${active ? 'active' : ''} new-attention-panel`}>
      <div className="settings-grid single-action-grid">
        <div className="setting-item scroll-animated new-attention-search-card">
          <h4>Buscar paciente</h4>
          <p>Busca al paciente para iniciar una nueva atención de forma rápida y ordenada.</p>

          <div className="new-attention-search-box">
            <div className="search-input-wrapper">
              <FontAwesomeIcon icon={faSearch} className="search-icon" />
              <input
                type="text"
                placeholder="Ingrese nombre o documento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') buscar();
                }}
              />
            </div>
            <button
              className="action-btn primary"
              type="button"
              onClick={buscar}
              disabled={busquedaEstado === 'buscando'}
            >
              {busquedaEstado === 'buscando' ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className={`vitals-strip ${busquedaEstado}`}>
            <svg viewBox="0 0 700 40" preserveAspectRatio="none">
              <path
                className="vitals-path"
                d="M0,20 L120,20 L140,20 L150,4 L160,36 L170,10 L180,20 L200,20 L560,20 L580,20 L590,4 L600,36 L610,10 L620,20 L700,20"
              />
            </svg>
          </div>

          {busquedaEstado === 'encontrado' && (
            <ResultadosBusqueda resultados={resultados} onSeleccionar={onIniciarAtencion} />
          )}

          {busquedaEstado === 'no_encontrado' && (
            <EstadoNoEncontrado searchQuery={searchQuery} onCrearPaciente={onCrearPaciente} />
          )}
        </div>
      </div>
    </div>
  );
};

export default NuevaAtencionTab;