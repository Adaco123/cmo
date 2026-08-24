import React, { useEffect, useState } from 'react';
import {
  getEstadisticasPacientesMes,
  getPacientesFrecuentes,
  getPacientesNuevos,
  pagosHoy,
  getReporteMensual,
  type EstadisticasPacientesMes,
  type PacienteFrecuente,
  type PagosResumenHoy,
  type PagosReporteMensual,
} from '../../../api/reportes';

interface ReportesTabProps {
  active: boolean;
}

function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return 'Bs 0,00';
  return `Bs ${num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null): string {
  if (!value) return '—';

  // El backend manda fechas "YYYY-MM-DD" (sin hora). Si se las pasamos
  // directo a `new Date()`, el parser ISO las interpreta como UTC
  // medianoche, y luego toLocaleDateString las corre un día para atrás
  // en zonas horarias negativas (como Bolivia, UTC-4). Por eso parseamos
  // los componentes a mano y construimos la fecha en hora local.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  // Fallback para otros formatos (ej. con hora/timezone incluida)
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ReportesTab: React.FC<ReportesTabProps> = ({ active }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [estadisticas, setEstadisticas] = useState<EstadisticasPacientesMes | null>(null);
  const [frecuentes, setFrecuentes] = useState<PacienteFrecuente[]>([]);
  const [nuevosTotal, setNuevosTotal] = useState<number | null>(null);
  const [pagosHoyData, setPagosHoyData] = useState<PagosResumenHoy | null>(null);
  const [reporteMensual, setReporteMensual] = useState<PagosReporteMensual | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      getEstadisticasPacientesMes(),
      getPacientesFrecuentes(50),
      getPacientesNuevos(30),
      pagosHoy(),
      getReporteMensual(),
    ])
      .then(([est, frec, nuevos, hoy, mensual]) => {
        if (cancelled) return;
        setEstadisticas(est);
        setFrecuentes(frec);
        setNuevosTotal(nuevos.total);
        setPagosHoyData(hoy);
        setReporteMensual(mensual);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Error cargando reportes:', err);
        setError('No se pudieron cargar los reportes. Intenta nuevamente.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active]);

  const misPacientesFrecuentes = frecuentes.filter((p) => p.tipo === 'Mis pacientes');
  const externosFrecuentes = frecuentes.filter((p) => p.tipo === 'Externo');
  const otrosFrecuentes = frecuentes.filter((p) => p.tipo === 'Otro');

  const totalFrecuentes = frecuentes.length;
  const porcentajeMisPacientes =
    totalFrecuentes > 0 ? Math.round((misPacientesFrecuentes.length / totalFrecuentes) * 100) : 0;

  const variacionPositiva = (estadisticas?.variacion_porcentual ?? 0) >= 0;

  if (!active) return null;

  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      {error && (
        <div
          className="new-attention-empty"
          style={{ marginBottom: '20px' }}
        >
          <div className="new-attention-empty-text">
            <strong>Error al cargar reportes</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="report-grid">
        <div className="report-card scroll-animated">
          <div className="label" style={{ opacity: 1 }}>Total pacientes (mes)</div>
          <div className="value">
            {loading ? '—' : estadisticas?.total_mes_actual ?? 0}
          </div>
          <div className="sub" style={{ opacity: 1 }}>
            {loading
              ? 'Cargando…'
              : `Mes anterior: ${estadisticas?.total_mes_anterior ?? 0}`}
          </div>
        </div>

        <div className="report-card scroll-animated">
          <div className="label" style={{ opacity: 1 }}>Variación mensual</div>
          <div
            className="value"
            style={{ color: loading ? undefined : variacionPositiva ? 'var(--status-active)' : 'var(--status-inactive)' }}
          >
            {loading
              ? '—'
              : `${variacionPositiva ? '↑' : '↓'} ${Math.abs(estadisticas?.variacion_porcentual ?? 0).toFixed(1)}%`}
          </div>
          <div className="sub" style={{ opacity: 1 }}>vs mes anterior</div>
        </div>

        <div className="report-card scroll-animated">
          <div className="label" style={{ opacity: 1 }}>Pagado hoy</div>
          <div className="value">
            {loading ? '—' : formatMoney(pagosHoyData?.total_pagado_hoy ?? '0')}
          </div>
          <div className="sub" style={{ opacity: 1 }}>
            {loading ? 'Cargando…' : `${pagosHoyData?.cantidad_pagos ?? 0} pagos`}
          </div>
        </div>

        <div className="report-card scroll-animated">
          <div className="label" style={{ opacity: 1 }}>Total pagado (mes)</div>
          <div className="value">
            {loading ? '—' : formatMoney(reporteMensual?.total_pagado_mes ?? '0')}
          </div>
          <div className="sub" style={{ opacity: 1 }}>
            {loading ? 'Cargando…' : `${reporteMensual?.cantidad_pagos ?? 0} pagos en el mes`}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="scroll-animated">
          <div className="report-section-title">Pacientes frecuentes</div>
          <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="report-card">
              <div className="label" style={{ opacity: 1 }}>Mis pacientes</div>
              <div className="value">{loading ? '—' : misPacientesFrecuentes.length}</div>
              <div className="sub" style={{ opacity: 1 }}>
                {loading ? 'Cargando…' : `${porcentajeMisPacientes}% del total`}
              </div>
            </div>
            <div className="report-card">
              <div className="label" style={{ opacity: 1 }}>Externos</div>
              <div className="value">
                {loading ? '—' : externosFrecuentes.length + otrosFrecuentes.length}
              </div>
              <div className="sub" style={{ opacity: 1 }}>
                {loading ? 'Cargando…' : `${100 - porcentajeMisPacientes}% del total`}
              </div>
            </div>
          </div>
        </div>

        <div className="scroll-animated">
          <div className="report-section-title">Pacientes nuevos</div>
          <div className="report-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="report-card">
              <div className="label" style={{ opacity: 1 }}>Últimos 30 días</div>
              <div className="value">{loading ? '—' : nuevosTotal ?? 0}</div>
              <div className="sub" style={{ opacity: 1 }}>total registrados</div>
            </div>
            <div className="report-card">
              <div className="label" style={{ opacity: 1 }}>Frecuentes registrados</div>
              <div className="value">{loading ? '—' : totalFrecuentes}</div>
              <div className="sub" style={{ opacity: 1 }}>con historial de consultas</div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-card mt-20 scroll-animated">
        <div className="card-header">
          <h3>Pacientes más frecuentes</h3>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>top 5</span>
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
            {loading && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0' }}>
                  Cargando…
                </td>
              </tr>
            )}
            {!loading && frecuentes.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No hay datos de pacientes frecuentes todavía.
                </td>
              </tr>
            )}
            {!loading &&
              frecuentes.slice(0, 5).map((p) => (
                <tr key={p.id}>
                  <td className="patient-name">{p.nombre}</td>
                  <td>{p.total_consultas}</td>
                  <td>{formatDate(p.ultima_visita)}</td>
                  <td>{p.tipo}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportesTab;