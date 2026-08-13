import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRefresh } from '@fortawesome/free-solid-svg-icons';
import { type Paciente } from '../../../api/pacientes';
import { type Cita } from '../../../api/citas';

interface InicioTabProps {
  active: boolean;
  pacientes: Paciente[];
  citasHoy: Cita[];
  loadingCitas: boolean;
  citasError: string | null;
  finalizandoId: number | null;
  onRefreshCitas: () => void;
  onAtender: (paciente: Paciente) => void;
  onFinalizar: (cita: Cita) => void;
}

/**
 * Reemplaza el bloque <div className="tab-content ... 'inicio'"> de
 * CMODashboard.tsx: stats-grid + tarjeta "Citas de hoy".
 */
const InicioTab: React.FC<InicioTabProps> = ({
  active,
  pacientes,
  citasHoy,
  loadingCitas,
  citasError,
  finalizandoId,
  onRefreshCitas,
  onAtender,
  onFinalizar,
}) => {
  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <section className="stats-grid">
        <div className="stat-card scroll-animated">
          <div className="stat-label">Pacientes atendidos hoy</div>
          <div className="stat-value">18</div>
          <div className="stat-change positive">↑ 8% vs ayer</div>
        </div>
        <div className="stat-card scroll-animated">
          <div className="stat-label">Pagos recibidos hoy</div>
          <div className="stat-value">Bs 16.450</div>
          <div className="stat-change positive">↑ 18% vs ayer</div>
        </div>
      </section>

      <div className="table-card scroll-animated" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3>Citas de hoy</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', opacity: 0.7, fontSize: '0.8rem' }}>
              {new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
            </span>
            <button
              type="button"
              className="today-refresh-btn"
              onClick={onRefreshCitas}
              title="Actualizar citas"
              disabled={loadingCitas}
            >
              <FontAwesomeIcon icon={faRefresh} className={loadingCitas ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {loadingCitas ? (
          <div className="today-appointments-empty">Cargando citas...</div>
        ) : citasError ? (
          <div className="today-appointments-empty">{citasError}</div>
        ) : citasHoy.length === 0 ? (
          <div className="today-appointments-empty">No hay citas programadas para hoy.</div>
        ) : (
          <div className="today-appointments-list">
            {citasHoy.map((cita) => {
              const paciente = pacientes.find((p) => p.id === cita.paciente_id);
              const fullName = paciente
                ? `${paciente.nombres} ${paciente.apellidos}`.trim()
                : `Paciente #${cita.paciente_id}`;
              const hora = cita.hora_inicio ? String(cita.hora_inicio).slice(0, 5) : '—';

              return (
                <div key={cita.id} className="today-appointment-item">
                  <div className="today-appointment-time">{hora}</div>
                  <div className="today-appointment-content">
                    <div className="today-appointment-name">{fullName}</div>
                    <div className="today-appointment-meta">
                      {cita.motivo || 'Sin motivo registrado'}
                    </div>
                  </div>
                  {paciente ? (
                    <div className="today-appointment-actions">
                      <button
                        type="button"
                        className="glow-btn today-appointment-action-btn"
                        onClick={() => onAtender(paciente)}
                      >
                        Atender
                      </button>
                      <button
                        type="button"
                        className="glow-btn today-appointment-action-btn today-appointment-action-btn-danger"
                        onClick={() => onFinalizar(cita)}
                        disabled={finalizandoId === cita.id}
                      >
                        {finalizandoId === cita.id ? 'Finalizando...' : 'Finalizar'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InicioTab;