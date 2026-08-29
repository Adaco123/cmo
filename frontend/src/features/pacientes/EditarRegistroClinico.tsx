import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { Paciente as ApiPaciente } from '../../api/pacientes';
import {
  getRegistroClinicoCompleto,
  updateRegistroCompleto,
} from '../../api/historialClinico';
import type { RegistroCompletoUpdateResponse } from '../../api/historialClinico';
import styles from './EditarRegistroClinico.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faSpinner } from '@fortawesome/free-solid-svg-icons';

interface EditarRegistroClinicoProps {
  /** Id del registro clínico ya existente que se va a editar. */
  registroId: number;
  paciente?: ApiPaciente | null;
  onClose?: () => void;
  /** Se llama con la respuesta del backend tras guardar exitosamente. */
  onSaved?: (resultado: RegistroCompletoUpdateResponse) => void | Promise<void>;
}

type VitalKey = 'pa_sys' | 'pa_dia' | 'fc' | 'fr' | 'sat' | 'temp' | 'peso' | 'talla' | 'glu';

// NOTA: a diferencia de RegistroClinico.tsx (creación), acá "tratamiento"
// SÍ es editable a mano — no hay un Receta.tsx montado en este flujo que
// lo sincronice automáticamente (las recetas se editan aparte, con sus
// propios endpoints). Si el registro ya tenía texto de tratamiento
// generado desde una receta, se puede seguir ajustando manualmente acá.
//
// NOTA 2: este formulario edita únicamente "consulta" (motivo,
// diagnostico) y "registro" (signos vitales + secciones clínicas),
// que es exactamente lo que acepta RegistroClinicoCompletoUpdate_Resource.
// fecha, hora y medico_id ya no se muestran ni se envían porque ese
// endpoint los ignora igual que a exámenes y recetas: no forman parte
// de lo editable desde acá.
const SECTIONS = [
  { key: 'motivo', label: 'Motivo de consulta', icon: 'fa-question-circle' },
  { key: 'enfermedad_actual', label: 'Enfermedad actual', icon: 'fa-history' },
  { key: 'examen_fisico', label: 'Examen físico', icon: 'fa-stethoscope' },
  { key: 'hallazgos_ecograficos', label: 'Hallazgos ecográficos', icon: 'fa-wave-square' },
  { key: 'diagnostico', label: 'Diagnóstico', icon: 'fa-diagnoses' },
  { key: 'tratamiento', label: 'Tratamiento', icon: 'fa-prescription-bottle-alt' },
  { key: 'observaciones', label: 'Observaciones', icon: 'fa-comment-medical' },
  { key: 'consulta_control', label: 'Consulta control', icon: 'fa-calendar-check' },
] as const;
type SectionKey = typeof SECTIONS[number]['key'];

const EditarRegistroClinico: React.FC<EditarRegistroClinicoProps> = ({
  registroId,
  paciente,
  onClose,
  onSaved,
}) => {
  const pageRef = useRef<HTMLDivElement | null>(null);

  const nombrePaciente = paciente ? `${paciente.nombres || ''} ${paciente.apellidos || ''}`.trim() : '—';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [vitales, setVitales] = useState<Record<VitalKey, string>>({
    pa_sys: '', pa_dia: '', fc: '', fr: '', sat: '', temp: '', peso: '', talla: '', glu: '',
  });
  const [alergiasRegistro, setAlergiasRegistro] = useState('');
  const [secciones, setSecciones] = useState<Record<SectionKey, string>>({
    motivo: '', enfermedad_actual: '', examen_fisico: '', hallazgos_ecograficos: '',
    diagnostico: '', tratamiento: '', observaciones: '', consulta_control: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- Carga inicial: trae el registro ya existente y precarga todo ---
  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const detalle = await getRegistroClinicoCompleto(registroId);
        if (cancelado) return;
        const r = detalle.registro;

        const [pa_sys, pa_dia] = (r.presion_arterial || '').split('/');
        setVitales({
          pa_sys: pa_sys || '',
          pa_dia: pa_dia || '',
          fc: r.frecuencia_cardiaca != null ? String(r.frecuencia_cardiaca) : '',
          fr: r.frecuencia_respiratoria != null ? String(r.frecuencia_respiratoria) : '',
          sat: r.saturacion_oxigeno != null ? String(r.saturacion_oxigeno) : '',
          temp: r.temperatura != null ? String(r.temperatura) : '',
          peso: r.peso != null ? String(r.peso) : '',
          talla: r.talla != null ? String(r.talla) : '',
          glu: r.glicemia != null ? String(r.glicemia) : '',
        });
        setAlergiasRegistro(r.alergias || '');
        setSecciones({
          motivo: r.motivo_consulta || '',
          enfermedad_actual: r.enfermedad_actual || '',
          examen_fisico: r.examen_fisico || '',
          hallazgos_ecograficos: r.hallazgos_ecograficos || '',
          diagnostico: r.diagnostico || '',
          tratamiento: r.tratamiento || '',
          observaciones: r.observaciones || '',
          consulta_control: r.consulta_control || '',
        });
      } catch {
        if (!cancelado) setLoadError('No se pudo cargar el registro clínico. Intenta de nuevo.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [registroId]);

  const setVital = (key: VitalKey, raw: string, numeric = true) => {
    const clean = numeric ? raw.replace(/[^0-9]/g, '') : raw.replace(/[^0-9.,]/g, '');
    setVitales((prev) => ({ ...prev, [key]: clean }));
  };

  const handleGuardar = async () => {
    setSaveError(null);

    setSaving(true);
    try {
      const num = (v: string) => (v.trim() !== '' ? parseFloat(v.replace(',', '.')) : 0);
      const pa = vitales.pa_sys && vitales.pa_dia ? `${vitales.pa_sys}/${vitales.pa_dia}` : '';

      const resultado = await updateRegistroCompleto(registroId, {
        consulta: {
          motivo: secciones.motivo.trim() || null,
          diagnostico: secciones.diagnostico.trim() || null,
        },
        registro: {
          presion_arterial: pa,
          frecuencia_cardiaca: parseInt(vitales.fc, 10) || 0,
          frecuencia_respiratoria: parseInt(vitales.fr, 10) || 0,
          saturacion_oxigeno: parseInt(vitales.sat, 10) || 0,
          glicemia: num(vitales.glu),
          temperatura: num(vitales.temp),
          peso: num(vitales.peso),
          talla: num(vitales.talla),
          hallazgos_ecograficos: secciones.hallazgos_ecograficos.trim() || '',
          enfermedad_actual: secciones.enfermedad_actual.trim() || null,
          examen_fisico: secciones.examen_fisico.trim() || null,
          tratamiento: secciones.tratamiento.trim() || null,
          alergias: alergiasRegistro.trim() || null,
          observaciones: secciones.observaciones.trim() || null,
          consulta_control: secciones.consulta_control.trim() || null,
        },
      });

      if (pageRef.current) {
        await new Promise<void>((resolve) => {
          gsap.to(pageRef.current, {
            opacity: 0,
            scale: 0.96,
            duration: 0.3,
            ease: 'power2.out',
            onComplete: resolve,
          });
        });
      }

      await onSaved?.(resultado);
    } catch {
      setSaveError('No se pudo guardar la edición. Revisa los datos e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGuardar();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vitales, secciones, alergiasRegistro]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <FontAwesomeIcon icon={faSpinner} spin />
          <p>Cargando registro clínico...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <p>{loadError}</p>
          {onClose && (
            <button type="button" className={styles.btnSaveModern} onClick={onClose}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.mark}>
            <FontAwesomeIcon icon={faUser} />
          </div>
          <div>
            <h1>Editar registro clínico</h1>
            <span>Registro #{registroId}</span>
          </div>
        </div>
      </div>

      <div className={`${styles.card} ${styles.pacienteCard}`}>
        <div className={styles.pinfoGrid}>
          <div className={styles.pinfoItem}>
            <div className={styles.pk}>
              <i className={`fas fa-user ${styles.ficon}`}></i> Paciente
            </div>
            <div className={styles.pv}>{nombrePaciente}</div>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.field}>
            <div className={styles.flabel}>
              <i className={`fas fa-heartbeat ${styles.ficon}`}></i> Signos vitales
            </div>
            <div className={styles.vitalsRow}>
              <div className={styles.vslot}>
                <label>Presión arterial</label>
                <div className={styles.vinputs}>
                  <input value={vitales.pa_sys} onChange={(e) => setVital('pa_sys', e.target.value)} placeholder="120" inputMode="numeric" maxLength={3} />
                  <span className={styles.sep}>/</span>
                  <input value={vitales.pa_dia} onChange={(e) => setVital('pa_dia', e.target.value)} placeholder="80" inputMode="numeric" maxLength={3} />
                  <span className={styles.unit}>mmHg</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Frec. cardíaca</label>
                <div className={styles.vinputs}>
                  <input value={vitales.fc} onChange={(e) => setVital('fc', e.target.value)} placeholder="78" inputMode="numeric" maxLength={3} />
                  <span className={styles.unit}>lpm</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Frec. respiratoria</label>
                <div className={styles.vinputs}>
                  <input value={vitales.fr} onChange={(e) => setVital('fr', e.target.value)} placeholder="16" inputMode="numeric" maxLength={2} />
                  <span className={styles.unit}>rpm</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Saturación O2</label>
                <div className={styles.vinputs}>
                  <input value={vitales.sat} onChange={(e) => setVital('sat', e.target.value)} placeholder="97" inputMode="numeric" maxLength={3} />
                  <span className={styles.unit}>%</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Temperatura</label>
                <div className={styles.vinputs}>
                  <input className={styles.wide} value={vitales.temp} onChange={(e) => setVital('temp', e.target.value, false)} placeholder="36.5" inputMode="decimal" />
                  <span className={styles.unit}>°C</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Peso</label>
                <div className={styles.vinputs}>
                  <input className={styles.wide} value={vitales.peso} onChange={(e) => setVital('peso', e.target.value, false)} placeholder="70" inputMode="decimal" />
                  <span className={styles.unit}>kg</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Talla</label>
                <div className={styles.vinputs}>
                  <input className={styles.wide} value={vitales.talla} onChange={(e) => setVital('talla', e.target.value, false)} placeholder="1.70" inputMode="decimal" />
                  <span className={styles.unit}>m</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Glicemia</label>
                <div className={styles.vinputs}>
                  <input className={styles.wide} value={vitales.glu} onChange={(e) => setVital('glu', e.target.value, false)} placeholder="95" inputMode="decimal" />
                  <span className={styles.unit}>mg/dL</span>
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.field} ${styles.fieldAlert}`}>
            <div className={`${styles.flabel} ${styles.flabelAlert}`}>
              <i className={`fas fa-allergies ${styles.ficon}`}></i> Alergias
            </div>
            <input
              type="text"
              value={alergiasRegistro}
              onChange={(e) => setAlergiasRegistro(e.target.value)}
              placeholder="Ninguna conocida..."
            />
          </div>

          {SECTIONS.map((s) => (
            <div className={`${styles.field} ${styles.fieldPlain}`} key={s.key}>
              <div className={styles.flabel}>
                <i className={`fas ${s.icon} ${styles.ficon}`}></i> {s.label}
              </div>
              <textarea
                rows={2}
                value={secciones[s.key]}
                onChange={(e) => setSecciones((prev) => ({ ...prev, [s.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      {saveError && (
        <div style={{ color: 'var(--status-inactive)', marginBottom: 8, fontSize: 13 }}>
          {saveError}
        </div>
      )}

      <div className={styles.savebar}>
        <div className={styles.status}>Los campos vacíos se guardan como vacío, no se pierde nada más.</div>
        <button className={styles.btnSaveModern} disabled={saving} onClick={handleGuardar}>
          <i className="fas fa-save"></i> {saving ? 'Guardando...' : 'Guardar cambios'} <kbd>Ctrl + Enter</kbd>
        </button>
      </div>
    </div>
  );
};

export default EditarRegistroClinico;