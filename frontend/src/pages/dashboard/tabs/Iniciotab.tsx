import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRefresh, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { type Paciente } from '../../../api/pacientes';
import { type Cita } from '../../../api/citas';
import { type SeguimientoControl } from '../../../api/seguimientoControl';
import Calendario from '../../../features/citas/Calendario';
import { useCalendario } from '../../../components/CalendarioProvider';
import { useReportesHoy } from '../../../components/ReportesHoyProvider';

/**
 * Una fila de la agenda de hoy: puede ser una cita o un control de
 * seguimiento agendado para hoy (seguimiento.proxima_fecha_control).
 * `hora` es la hora de inicio ("HH:MM[:SS]") o '' si no tiene.
 */
export type AgendaHoyItem =
  | { tipo: 'cita'; key: string; hora: string; cita: Cita }
  | { tipo: 'seguimiento'; key: string; hora: string; seguimiento: SeguimientoControl };

interface InicioTabProps {
  active: boolean;
  pacientes: Paciente[];
  agendaHoy: AgendaHoyItem[];
  loadingCitas: boolean;
  citasError: string | null;
  finalizandoId: number | null;
  onRefreshCitas: () => void;
  onAtender: (paciente: Paciente) => void;
  onFinalizar: (cita: Cita) => void;
  /** Solo oculta el seguimiento de la lista de hoy; no toca el backend. */
  onFinalizarSeguimiento: (seguimiento: SeguimientoControl) => void;
}

function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return 'Bs 0,00';
  return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const InicioTab: React.FC<InicioTabProps> = ({
  active,
  pacientes,
  agendaHoy,
  loadingCitas,
  citasError,
  finalizandoId,
  onRefreshCitas,
  onAtender,
  onFinalizar,
  onFinalizarSeguimiento,
}) => {
  const { pagosHoyData, pacientesAtendidosHoy, loading } = useReportesHoy();

  // Citas y seguimientos para el calendario (todos, no solo los de hoy).
  // Se cargan solo cuando el usuario realmente abre el calendario, así no
  // pesamos el dashboard con fetches que la mayoría de las veces no hacen
  // falta.
  const calendarioControl = useCalendario();

  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <section className="stats-grid">
        <div className="stat-card scroll-animated">
          <div className="stat-label">Pacientes atendidos hoy</div>
          <div className="stat-value">
            {loading ? '--' : pacientesAtendidosHoy?.total_hoy}
          </div>
          <div className={`stat-change ${loading ? '' : (pacientesAtendidosHoy?.variacion_porcentual ?? 0) >= 0 ? 'positive' : 'negative'}`}>
            {loading
              ? '-'
              : `${(pacientesAtendidosHoy?.variacion_porcentual ?? 0) >= 0 ? '↑' : '↓'} ${Math.abs(pacientesAtendidosHoy?.variacion_porcentual ?? 0)}% vs ayer`}
          </div>
        </div>
        <div className="stat-card scroll-animated">
          <div className="stat-label">Pagos recibidos hoy</div>
          <div className="stat-value">
            {loading ? '--':formatMoney(pagosHoyData?.total_pagado_hoy ?? '0')}
          </div>
          <div className={`stat-change ${loading ? '' : (pagosHoyData?.variacion_porcentual ?? 0) >= 0 ? 'positive' : 'negative'}`}>
            {loading
              ? '-'
              : `${(pagosHoyData?.variacion_porcentual ?? 0) >= 0 ? '↑' : '↓'} ${Math.abs(pagosHoyData?.variacion_porcentual ?? 0)}% vs ayer`}
          </div>
        </div>

        <button
          type="button"
          className="mini-calendar-card scroll-animated"
          onClick={calendarioControl.abrir}
        >
          <div className="mini-calendar-icon">
            <FontAwesomeIcon icon={faCalendarDays} />
          </div>
          <div className="mini-calendar-info">
            <span className="mini-calendar-label">Calendario</span>
            <span className="mini-calendar-date">
              {new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long' }).format(new Date())}
            </span>
          </div>
        </button>
      </section>

      <div className="table-card scroll-animated" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3>Citas y controles de hoy</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-muted)', opacity: 0.7, fontSize: 'var(--fs-sm)' }}>
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

        {loadingCitas && !calendarioControl.agendaCargada ? (
          <div className="today-appointments-empty">Cargando citas...</div>
        ) : citasError ? (
          <div className="today-appointments-empty">{citasError}</div>
        ) : agendaHoy.length === 0 ? (
          <div className="today-appointments-empty">No hay citas ni controles programados para hoy.</div>
        ) : (
          <div className="today-appointments-list">
            {agendaHoy.map((item) => {
              const pacienteId = item.tipo === 'cita' ? item.cita.paciente_id : item.seguimiento.paciente_id;
              const paciente = pacientes.find((p) => p.id === pacienteId);
              const fullName = paciente
                ? `${paciente.nombres} ${paciente.apellidos}`.trim()
                : `Paciente #${pacienteId}`;
              const hora = item.hora ? String(item.hora).slice(0, 5) : '—';
              const detalle =
                item.tipo === 'cita'
                  ? item.cita.motivo || 'Sin motivo registrado'
                  : `Control de seguimiento · última evolución: ${
                      item.seguimiento.evolucion.length > 80
                        ? `${item.seguimiento.evolucion.slice(0, 80)}…`
                        : item.seguimiento.evolucion
                    }`;

              return (
                <div key={item.key} className="today-appointment-item">
                  <div className="today-appointment-time">{hora}</div>
                  <div className="today-appointment-content">
                    <div className="today-appointment-name">
                      {fullName}{' '}
                      <span className={`badge-tipo ${item.tipo}`} style={{ marginLeft: 8 }}>
                        {item.tipo === 'cita' ? 'Cita' : 'Seguimiento'}
                      </span>
                    </div>
                    <div className="today-appointment-meta">{detalle}</div>
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
                      {item.tipo === 'cita' ? (
                        <button
                          type="button"
                          className="glow-btn today-appointment-action-btn today-appointment-action-btn-danger"
                          onClick={() => onFinalizar(item.cita)}
                          disabled={finalizandoId === item.cita.id}
                        >
                          {finalizandoId === item.cita.id ? 'Finalizando...' : 'Finalizar'}
                        </button>
                      ) : (
                        // Los seguimientos no tienen estado en el backend: este botón
                        // solo los quita de la lista de hoy (ver Dashboardpage).
                        <button
                          type="button"
                          className="glow-btn today-appointment-action-btn today-appointment-action-btn-danger"
                          title="Quitar de la lista de hoy"
                          onClick={() => onFinalizarSeguimiento(item.seguimiento)}
                        >
                          Finalizar
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {calendarioControl.abierto && (
        <Calendario
          citas={calendarioControl.citas}
          seguimientos={calendarioControl.seguimientos}
          pacientes={pacientes}
          onClose={calendarioControl.cerrar}
        />
      )}
      {calendarioControl.abierto && calendarioControl.loading && (
        <div className="today-appointments-empty" style={{ position: 'fixed', bottom: 16, right: 16 }}>
          Cargando datos del calendario...
        </div>
      )}
      {calendarioControl.abierto && calendarioControl.error && (
        <div className="today-appointments-empty" style={{ position: 'fixed', bottom: 16, right: 16 }}>
          {calendarioControl.error}
        </div>
      )}
    </div>
  );
};

export default InicioTab;