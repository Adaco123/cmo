import React from 'react';

interface ReportesTabProps {
  active: boolean;
}

/**
 * Reemplaza el bloque <div className="tab-content ... 'reportes'">.
 * Todo el contenido era estático en el original (124, 86, Bs 8.200, etc.),
 * así que se mueve tal cual. Cuando conectes datos reales de reportes,
 * esto pasa a recibir props o a tener su propio hook useReportes().
 */
const ReportesTab: React.FC<ReportesTabProps> = ({ active }) => {
  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <div className="report-grid">
        <div className="report-card scroll-animated">
          <div className="label">Reporte general</div>
          <div className="value">124</div>
          <div className="sub">Total pacientes (mes)</div>
        </div>
        <div className="report-card scroll-animated">
          <div className="label">Mis pacientes</div>
          <div className="value">86</div>
          <div className="sub">69% del total</div>
        </div>
        <div className="report-card scroll-animated">
          <div className="label">Monto mensual diario</div>
          <div className="value">Bs 8.200</div>
          <div className="sub">Promedio diario</div>
        </div>
        <div className="report-card scroll-animated">
          <div className="label">Cantidad de pacientes / mes</div>
          <div className="value">124</div>
          <div className="sub">↑ 12% vs mes anterior</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="scroll-animated">
          <div className="report-section-title">📋 Mis pacientes</div>
          <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="report-card">
              <div className="label">Frecuentes</div>
              <div className="value">23</div>
              <div className="sub">+4 este mes</div>
            </div>
            <div className="report-card">
              <div className="label">Nuevos</div>
              <div className="value">12</div>
              <div className="sub">últimos 30 días</div>
            </div>
          </div>
        </div>
        <div className="scroll-animated">
          <div className="report-section-title">📋 Pacientes externos</div>
          <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="report-card">
              <div className="label">Frecuentes</div>
              <div className="value">11</div>
              <div className="sub">+2 este mes</div>
            </div>
            <div className="report-card">
              <div className="label">Nuevos</div>
              <div className="value">8</div>
              <div className="sub">últimos 30 días</div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-card mt-20 scroll-animated">
        <div className="card-header">
          <h3>Pacientes más frecuentes</h3>
          <span style={{ color: 'var(--text-muted)', opacity: 0.7, fontSize: '0.8rem' }}>últimos 30 días</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Total consultas</th>
              <th>Última visita</th>
              <th>Tipo</th>
            </tr>
          </thead>
          <tbody>
            <tr><td className="patient-name">María Fernández</td><td>7</td><td>18/07/2026</td><td>Mis pacientes</td></tr>
            <tr><td className="patient-name">Carlos López</td><td>5</td><td>17/07/2026</td><td>Mis pacientes</td></tr>
            <tr><td className="patient-name">Roberto Díaz</td><td>4</td><td>16/07/2026</td><td>Externo</td></tr>
            <tr><td className="patient-name">Sofía Torres</td><td>4</td><td>15/07/2026</td><td>Externo</td></tr>
            <tr><td className="patient-name">Ana Martínez</td><td>3</td><td>14/07/2026</td><td>Mis pacientes</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportesTab;