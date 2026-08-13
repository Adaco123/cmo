import React from 'react';
import StatusBadge from '../../../components/ui/StatusBadge';
import ViewButton from '../../../components/ui/ViewButton';

interface Modelo {
  type: string;
  date: string;
  activo: boolean;
}

const modelosData: Modelo[] = [
  { type: 'Abdominal', date: '22/07/2026', activo: true },
  { type: 'Doppler', date: '21/07/2026', activo: true },
  { type: 'Obstétrica', date: '21/07/2026', activo: false },
  { type: 'Ecocardiograma', date: '20/07/2026', activo: true },
];

interface ModelosTabProps {
  active: boolean;
  searchValue: string;
}

/**
 * Reemplaza el bloque <div className="tab-content ... 'modelos'">.
 * modelosData sigue siendo estático como en el original; cuando conectes
 * un endpoint real de plantillas, esto se vuelve un hook useModelos()
 * igual que usePacientes.
 */
const ModelosTab: React.FC<ModelosTabProps> = ({ active, searchValue }) => {
  const filtered = modelosData.filter((m) =>
    m.type.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <div className="table-card scroll-animated">
        <div className="card-header">
          <h3>Modelos Recientes</h3>
          <button className="glow-btn" onClick={() => alert('Agregar nuevo modelo')}>
            Agregar Modelo
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Ver</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m, idx) => (
              <tr key={idx}>
                <td className="patient-name">{m.type}</td>
                <td>{m.date}</td>
                <td><StatusBadge activo={m.activo} /></td>
                <td><ViewButton name={m.type} onClick={() => {}} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModelosTab;