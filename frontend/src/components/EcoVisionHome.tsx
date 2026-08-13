import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCitas } from '../api/citas';
import { getPacientes, type Paciente as ApiPaciente } from '../api/pacientes';
import './EcoVisionHome.css';

/**
 * EcoVisionHome
 * Conversión a React del landing "EcoVision — Ecografía de Alta Precisión".
 * Incluye:
 *  - Navbar con efecto de scroll
 *  - Hero con contadores animados
 *  - Borde eléctrico animado (canvas) alrededor del visual
 *  - Simulación de ecografía animada (canvas)
 *
 * Recuerda agregar las fuentes de Google Fonts en tu index.html:
 * <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700;800&display=swap" rel="stylesheet">
 */
interface CitaVista {
  id: number;
  fecha: string;
  hora: string;
  nombre: string;
  motivo?: string | null;
}

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function EcoVisionHome() {
  const navRef = useRef<HTMLElement | null>(null);
  const heroMetaRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  const studiesRef = useRef<HTMLHeadingElement | null>(null);
  const precisionRef = useRef<HTMLHeadingElement | null>(null);
  const precisionSpanRef = useRef<HTMLSpanElement | null>(null);
  const yearsRef = useRef<HTMLHeadingElement | null>(null);

  const electricContainerRef = useRef<HTMLDivElement | null>(null);
  const [citasVista, setCitasVista] = useState<CitaVista[]>([]);

  // ===== Efecto de scroll en el navbar =====
  useEffect(() => {
    const onScroll = () => {
      if (!navRef.current) return;
      if (window.scrollY > 40) {
        navRef.current.classList.add('nav-scrolled');
      } else {
        navRef.current.classList.remove('nav-scrolled');
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ===== Contadores animados =====
  useEffect(() => {
    const counterConfigs: { el: HTMLElement | null; target: number; suffix: string }[] = [
      { el: studiesRef.current, target: 15287, suffix: '' },
      { el: precisionSpanRef.current ?? precisionRef.current, target: 98, suffix: '%' },
      { el: yearsRef.current, target: 26, suffix: '' },
    ];

    function animateCounter(el: HTMLElement, target: number, suffix: string, duration = 2000) {
      const startTime = performance.now();
      function update(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(target * eased);
        el.textContent = current + suffix;
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = target + suffix;
        }
      }
      requestAnimationFrame(update);
    }

    let animated = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            counterConfigs.forEach((config) => {
              if (config.el) animateCounter(config.el, config.target, config.suffix);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    if (heroMetaRef.current) observer.observe(heroMetaRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cargarCitas = async () => {
      try {
        const [citasData, pacientesData] = await Promise.all([getCitas(), getPacientes()]);
        const pacientesMap = new Map<number, ApiPaciente>(pacientesData.map((paciente) => [paciente.id, paciente]));
        const todayKey = formatDateKey(new Date());

        const pendientes = citasData
          .filter((cita) => Number(cita.estado_id) !== 2)
          .filter((cita) => {
            const fechaCita = String(cita.fecha || '').slice(0, 10);
            return fechaCita >= todayKey;
          })
          .sort((a, b) => {
            const fechaA = String(a.fecha || '').slice(0, 10);
            const fechaB = String(b.fecha || '').slice(0, 10);
            if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
            return (a.hora_inicio || '').localeCompare(b.hora_inicio || '');
          })
          .slice(0, 6)
          .map((cita) => {
            const paciente = pacientesMap.get(cita.paciente_id);
            const nombre = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : `Paciente #${cita.paciente_id}`;
            return {
              id: cita.id,
              fecha: String(cita.fecha || '').slice(0, 10),
              hora: String(cita.hora_inicio || '').slice(0, 5),
              nombre,
              motivo: cita.motivo || 'Sin motivo registrado'
            };
          });

        setCitasVista(pendientes);
      } catch {
        setCitasVista([]);
      }
    };

    void cargarCitas();
  }, []);

  return (
    <div className="ecovision-home">
      {/* Fondo ambiental */}
      <div className="ambient-layer">
        <div className="ambient-orb ambient-orb-1"></div>
        <div className="ambient-orb ambient-orb-2"></div>
      </div>
      <div className="dot-grid"></div>

      <div className="main-wrapper">
        {/* Hero */}
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="hero-eyebrow">Centro de Ecografia</span>
              <h1 className="hero-title">
                <span className="hero-title-accent">CMO</span>
              </h1>
              <p className="hero-desc">
                
              </p>
              <div className="hero-actions">
                <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Iniciar Sesión
                </button>
                <a href="#" className="btn btn-outline">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Conocer Más
                </a>
              </div>
              
            </div>

            {/* Visual con borde eléctrico */}
            <div className="hero-visual electric-border-wrapper" ref={electricContainerRef}>
              <div className="eb-content-inner static-schedule-card">
                <div className="schedule-overlay">
                  <div className="schedule-overlay-header">
                    <span className="schedule-title">Pacientes de hoy</span>
                    <span className="schedule-pill">{citasVista.length} pendientes</span>
                  </div>
                  {citasVista.length === 0 ? (
                    <p className="schedule-empty">No hay citas para hoy.</p>
                  ) : (
                    <ul className="schedule-list">
                      {citasVista.map((cita) => (
                        <li key={cita.id} className="schedule-item">
                          <div className="schedule-item-time">{cita.hora || '—'}</div>
                          <div className="schedule-item-info">
                            <strong>{cita.nombre}</strong>
                            <span>{cita.motivo}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}