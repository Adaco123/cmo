import React, { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HistoriaClinica from '../features/pacientes/RegistroClinico';
import PacienteForm from '../features/pacientes/PacienteForm';
import VerPaciente from '../features/pacientes/VerPaciente';
import { getPacientes, type Paciente as ApiPaciente } from '../api/pacientes';
import { getCitas, updateCita, type Cita as ApiCita } from '../api/citas';
import './CMODashboard.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faRefresh, faSearch } from "@fortawesome/free-solid-svg-icons";
import PagosHoyWidget from './PagosHoyWidget';
// ─── Types ───────────────────────────────────────────
interface Modelo {
  type: string;
  date: string;
  activo: boolean;
}

// ─── Data ────────────────────────────────────────────
const modelosData: Modelo[] = [
  { type: 'Abdominal', date: '22/07/2026', activo: true },
  { type: 'Doppler', date: '21/07/2026', activo: true },
  { type: 'Obstétrica', date: '21/07/2026', activo: false },
  { type: 'Ecocardiograma', date: '20/07/2026', activo: true }
];

// ─── Helpers ───────────────────────────────────────
const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const StatusBadge: React.FC<{ activo: boolean }> = ({ activo }) => {
  const clase = activo ? 'active' : 'inactive';
  return (
    <span className="status-indicator">
      <span className={`dot ${clase}`}></span>
      <span className={`label ${clase}`}>{activo ? 'Activo' : 'Inactivo'}</span>
    </span>
  );
};

const ViewButton: React.FC<{ name: string; onClick: () => void }> = ({ name, onClick }) => (
  <button className="view-btn" onClick={onClick} title={`Ver ${name}`}>
    <FontAwesomeIcon icon={faEye} />
  </button>
);

// ─── Main Component ──────────────────────────────
const CMODashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('inicio');
  const [showPacienteForm, setShowPacienteForm] = useState<boolean>(false);
  const [showHistoria, setShowHistoria] = useState<boolean>(false);
  const [selectedPaciente, setSelectedPaciente] = useState<ApiPaciente | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState({
    misPacientes: '',
    externos: '',
    modelos: ''
  });
  const [pacientes, setPacientes] = useState<ApiPaciente[]>([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [pacientesError, setPacientesError] = useState<string | null>(null);
  const [citasHoy, setCitasHoy] = useState<ApiCita[]>([]);
  const [loadingCitas, setLoadingCitas] = useState(false);
  const [citasError, setCitasError] = useState<string | null>(null);
  const [finalizandoId, setFinalizandoId] = useState<number | null>(null);

  // ─── Estado de la búsqueda en "Nueva atención" ───────
  const [busquedaEstado, setBusquedaEstado] = useState<
    'idle' | 'buscando' | 'encontrado' | 'no_encontrado'
  >('idle');
  const [resultadosBusqueda, setResultadosBusqueda] = useState<ApiPaciente[]>([]);

  const mainContentRef = useRef<HTMLDivElement | null>(null);

  // ─── GSAP: Animar imágenes al hacer scroll (scale + opacity) ─────────
  useEffect(() => {
    if (!mainContentRef.current) return;

    const ctx = gsap.context(() => {
      const images = mainContentRef.current?.querySelectorAll('img');

      images?.forEach((img) => {
        gsap.fromTo(
          img,
          { scale: 0.7, opacity: 0 },
          {
            scale: 1.2,
            opacity: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: img,
              scroller: mainContentRef.current,
              start: 'top bottom',
              end: '+=600',
              scrub: true,
              invalidateOnRefresh: true
            }
          }
        );
      });
    }, mainContentRef);

    const timer = setTimeout(() => ScrollTrigger.refresh(), 120);

    return () => {
      clearTimeout(timer);
      ctx.revert();
    };
  }, [activeTab]);

  const handleFilterChange = (key: 'misPacientes' | 'externos' | 'modelos', value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const loadPacientes = useCallback(async () => {
    try {
      setLoadingPacientes(true);
      setPacientesError(null);
      const data = await getPacientes();
      setPacientes(data);
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'No se pudieron cargar los pacientes.';
      setPacientesError(message);
    } finally {
      setLoadingPacientes(false);
    }
  }, []);

  const loadCitas = useCallback(async () => {
    try {
      setLoadingCitas(true);
      setCitasError(null);
      const data = await getCitas();
      const todayKey = formatDateKey(new Date());
      const citasDelDia = data.filter((cita) => {
        const fechaCita = String(cita.fecha || '').slice(0, 10);
        return fechaCita === todayKey && Number(cita.estado_id) !== 2;
      });

      citasDelDia.sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
      setCitasHoy(citasDelDia);
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'No se pudieron cargar las citas.';
      setCitasError(message);
    } finally {
      setLoadingCitas(false);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([loadPacientes(), loadCitas()]);
    };

    void fetchData();
  }, [loadPacientes, loadCitas]);

  const filteredMisPacientes = pacientes.filter((p) => {
    if (p.origen_id !== 1) return false;
    const search = filters.misPacientes.toLowerCase();
    const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
    return !search || fullName.includes(search) || p.documento.toLowerCase().includes(search) || (p.telefono || '').toLowerCase().includes(search) || (p.correo || '').toLowerCase().includes(search);
  });

  const filteredExternos = pacientes.filter((p) => {
    if (p.origen_id !== 2) return false;
    const search = filters.externos.toLowerCase();
    const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
    return !search || fullName.includes(search) || p.documento.toLowerCase().includes(search) || (p.telefono || '').toLowerCase().includes(search) || (p.correo || '').toLowerCase().includes(search);
  });

  const filteredModelos = modelosData.filter(m =>
    m.type.toLowerCase().includes(filters.modelos.toLowerCase())
  );

  // ─── Nueva atención: buscar paciente ───────
  const handleBuscarPaciente = () => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    setBusquedaEstado('buscando');

    window.setTimeout(() => {
      const matches = pacientes.filter((p) => {
        const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
        return fullName.includes(q) || p.documento.toLowerCase().includes(q);
      });
      setResultadosBusqueda(matches);
      setBusquedaEstado(matches.length > 0 ? 'encontrado' : 'no_encontrado');
    }, 650);
  };

  const iniciarAtencion = (paciente: ApiPaciente) => {
    setSelectedPaciente(paciente);
    // Aquí se conecta el flujo real de "iniciar atención" cuando esté definido
  };

  const finalizarCita = async (cita: ApiCita) => {
    try {
      setFinalizandoId(cita.id);
      await updateCita(cita.id, { estado_id: 2 });
      await loadCitas();
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'No se pudo finalizar la cita.';
      setCitasError(message);
    } finally {
      setFinalizandoId(null);
    }
  };

  return (
    <div className="app-layout">
      {/* ─── Ambient ─── */}
      <PagosHoyWidget monto={16450} cantidadPagos={12} loading={false} />
      <div className="ambient-layer">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
        <div className="ambient-orb ambient-orb-3"></div>
      </div>
      <div className="dot-grid"></div>

      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <a href="#" className="sidebar-brand">
          <span className="sidebar-brand-mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="7" height="13" rx="2" />
              <line x1="6.5" y1="3" x2="6.5" y2="7" />
              <circle cx="6.5" cy="11" r="2.5" fill="white" stroke="none" opacity="0.9" />
              <path d="M14 8c2.5 1.5 4 4 4 7s-1.5 5.5-4 7" />
              <path d="M16 6c3 2 5 5.5 5 9s-2 7-5 9" />
            </svg>
          </span>
          <span className="sidebar-brand-text">
            CMO
            <span className="sidebar-brand-sub">Centro Médico Oruro</span>
          </span>
        </a>

        <nav className="sidebar-nav" id="sidebarNav">
          <a href="#" className={activeTab === 'inicio' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('inicio'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Inicio
            <span className="badge">3</span>
          </a>

          <a href="#" className={`sidebar-action-btn ${activeTab === 'nueva_atencion' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('nueva_atencion'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            Nueva atención
          </a>

          <a href="#" className={activeTab === 'mis_pacientes' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('mis_pacientes'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Mis Pacientes
          </a>

          <a href="#" className={activeTab === 'pacientes_externos' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('pacientes_externos'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            Pacientes Externos
          </a>

          <a href="#" className={activeTab === 'modelos' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('modelos'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Modelos
          </a>

          <a href="#" className={activeTab === 'reportes' ? 'active' : ''} onClick={(e) => { e.preventDefault(); setActiveTab('reportes'); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            Reportes
          </a>

        </nav>

        <div className="sidebar-footer">
          <div className="avatar">RG</div>
          <div className="user-info">
            <div className="name">Dr. Miguel</div>
            <div className="role">Radiólogo</div>
          </div>
          <button className="logout" title="Cerrar sesión" onClick={() => alert('Cerrando sesión…')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="main-content" ref={mainContentRef}>
        

        {/* ─── TAB: Inicio ─── */}
        <div className={`tab-content ${activeTab === 'inicio' ? 'active' : ''}`}>
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
                  onClick={() => void loadCitas()}
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
                            onClick={() => setSelectedPaciente(paciente)}
                          >
                            Atender
                          </button>
                          <button
                            type="button"
                            className="glow-btn today-appointment-action-btn today-appointment-action-btn-danger"
                            onClick={() => void finalizarCita(cita)}
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

        {/* ─── TAB: Mis Pacientes ─── */}
        <div className={`tab-content ${activeTab === 'mis_pacientes' ? 'active' : ''}`}>
          <div className="table-card scroll-animated">
            <div className="card-header">
              <h3>Mis Pacientes</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div className="search-table">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar en mis pacientes..."
                    value={filters.misPacientes}
                    onChange={(e) => handleFilterChange('misPacientes', e.target.value)}
                  />
                </div>
                <button className="glow-btn" type="button" onClick={() => setShowPacienteForm(true)}>Agregar</button>
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
                  <th>Ver</th>
                </tr>
              </thead>
              <tbody>
                {loadingPacientes ? (
                  <tr><td colSpan={6}>Cargando pacientes...</td></tr>
                ) : pacientesError ? (
                  <tr><td colSpan={6}>{pacientesError}</td></tr>
                ) : filteredMisPacientes.length === 0 ? (
                  <tr><td colSpan={6}>No hay pacientes de esta categoría.</td></tr>
                ) : filteredMisPacientes.map((p) => {
                  const fullName = `${p.nombres} ${p.apellidos}`.trim();
                  return (
                    <tr key={p.id}>
                      <td className="patient-name">{fullName}</td>
                      <td>{p.documento}</td>
                      <td>{p.telefono || '—'}</td>
                      <td>{p.correo || '—'}</td>
                      <td><StatusBadge activo={Boolean(p.estado)} /></td>
                      <td><ViewButton name={fullName} onClick={() => setSelectedPaciente(p)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── TAB: Pacientes Externos ─── */}
        <div className={`tab-content ${activeTab === 'pacientes_externos' ? 'active' : ''}`}>
          <div className="table-card scroll-animated">
            <div className="card-header">
              <h3>Pacientes Externos</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div className="search-table">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar en pacientes externos..."
                    value={filters.externos}
                    onChange={(e) => handleFilterChange('externos', e.target.value)}
                  />
                </div>
                <a href="#" className="glow-btn" onClick={(e) => { e.preventDefault(); setShowHistoria(true); }}>Agregar</a>
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
                  <th>Ver</th>
                </tr>
              </thead>
              <tbody>
                {loadingPacientes ? (
                  <tr><td colSpan={6}>Cargando pacientes...</td></tr>
                ) : pacientesError ? (
                  <tr><td colSpan={6}>{pacientesError}</td></tr>
                ) : filteredExternos.length === 0 ? (
                  <tr><td colSpan={6}>No hay pacientes externos.</td></tr>
                ) : filteredExternos.map((p) => {
                  const fullName = `${p.nombres} ${p.apellidos}`.trim();
                  return (
                    <tr key={p.id}>
                      <td className="patient-name">{fullName}</td>
                      <td>{p.documento}</td>
                      <td>{p.telefono || '—'}</td>
                      <td>{p.correo || '—'}</td>
                      <td><StatusBadge activo={Boolean(p.estado)} /></td>
                      <td><ViewButton name={fullName} onClick={() => setSelectedPaciente(p)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── TAB: Modelos ─── */}
        <div className={`tab-content ${activeTab === 'modelos' ? 'active' : ''}`}>
          <div className="table-card scroll-animated">
            <div className="card-header">
              <h3>Modelos Recientes</h3>
              <button className="glow-btn" onClick={() => alert('Agregar nuevo modelo')}>Agregar Modelo</button>
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
                {filteredModelos.map((m, idx) => (
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

        {/* ─── TAB: Reportes ─── */}
        <div className={`tab-content ${activeTab === 'reportes' ? 'active' : ''}`}>
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
              <span style={{ color: 'var(--text-secondary)', opacity: 0.7, fontSize: '0.8rem' }}>últimos 30 días</span>
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

        {/* ─── TAB: Nueva atención ─── */}
        <div className={`tab-content ${activeTab === 'nueva_atencion' ? 'active' : ''} new-attention-panel`}>
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
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBuscarPaciente(); }}
                  />
                </div>
                <button
                  className="action-btn primary"
                  type="button"
                  onClick={handleBuscarPaciente}
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
                <div className="new-attention-results">
                  {resultadosBusqueda.map((p) => {
                    const fullName = `${p.nombres} ${p.apellidos}`.trim();
                    const iniciales = `${p.nombres?.[0] || ''}${p.apellidos?.[0] || ''}`.toUpperCase();
                    const origenClass = p.origen_id === 2 ? 'patient-result-card-blue' : 'patient-result-card-red';

                    return (
                      <div key={p.id} className={`patient-result-card ${origenClass}`} onClick={() => iniciarAtencion(p)}>
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
              )}

              {busquedaEstado === 'no_encontrado' && (
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
                  <button className="glow-btn" type="button" onClick={() => setShowPacienteForm(true)}>
                    Crear nuevo paciente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </main>
      {showHistoria && (
        <div className="historia-backdrop" onClick={() => setShowHistoria(false)}>
          <div className="historia-backdrop-content" onClick={(e) => e.stopPropagation()}>
            <HistoriaClinica onClose={() => setShowHistoria(false)} />
          </div>
        </div>
      )}
      {showPacienteForm && (
        <div className="historia-backdrop" onClick={() => setShowPacienteForm(false)}>
          <div className="historia-backdrop-content" onClick={(e) => e.stopPropagation()}>
            <PacienteForm
              onSuccess={() => {
                setShowPacienteForm(false);
                void loadPacientes();
              }}
              onClose={() => setShowPacienteForm(false)}
            />
          </div>
        </div>
      )}
      {selectedPaciente && (
        <div className="historia-backdrop" onClick={() => setSelectedPaciente(null)}>
          <div className="historia-backdrop-content" onClick={(e) => e.stopPropagation()}>
            <VerPaciente paciente={selectedPaciente} onClose={() => setSelectedPaciente(null)} />
            <button className="close-form-btn" onClick={() => setSelectedPaciente(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CMODashboard;