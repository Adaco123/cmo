import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

import type { Paciente as ApiPaciente } from '../../api/pacientes';
import Receta from './Receta';
import type { RecetaHandle } from './Receta';
import styles from './RegistroClinico.module.css';
import { createRegistroCompleto } from '../../api/historialClinico';
import type { RegistroCompletoPayload, RegistroCompletoResponse } from '../../api/historialClinico';
// Importamos el nuevo componente
import Examenes from './Examenes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faCapsules, faFlaskVial
} from '@fortawesome/free-solid-svg-icons';
/**
 * RegistroClinico
 * Versión React del flujo continuo de registro clínico (signos vitales,
 * antecedentes, diagnóstico/tratamiento, exámenes complementarios y receta).
 *
 * Todo se guarda junto en un solo POST (createRegistroCompleto).
 */

// TODO: reemplazar por el id del médico autenticado cuando exista login real
const MEDICO_ID = 1;

// Definimos el tipo que devuelve el componente Examenes (para tipado fuerte)
interface ExamenItem {
  id: number;
  nombre: string;
  resultado: string;
  observaciones: string;
  estado: boolean;
  archivos: { nombre: string; archivoObj: File }[];
  categoria: 'laboratorio' | 'imagenologia' | 'otros';
}

interface RegistroClinicoProps {
  paciente?: ApiPaciente | null;
  pacienteId?: number;
  consultaId?: number;
  medicoNombre?: string;
  pacienteNombre?: string;        // vendrá del registro clínico anterior
  pacienteEdad?: string;          // vendrá del registro clínico anterior
  diagnosticoPrevio?: string;     // vendrá del registro clínico anterior
  onSave?: (resultado: RegistroCompletoResponse) => void | Promise<void>;
}

type VitalKey = 'pa_sys' | 'pa_dia' | 'fc' | 'fr' | 'sat' | 'temp' | 'peso' | 'talla' | 'glu';

const VITAL_ORDER: VitalKey[] = ['pa_sys', 'pa_dia', 'fc', 'fr', 'sat', 'temp', 'peso', 'talla', 'glu'];

const SECTIONS = [
  { key: 'motivo', label: 'Motivo de consulta', icon: 'fa-question-circle', placeholder: 'Motivo por el que acude el paciente a consulta...' },
  { key: 'enfermedad_actual', label: 'Enfermedad actual', icon: 'fa-history', placeholder: 'Tiempo de evolución, síntomas, características...' },
  { key: 'examen_fisico', label: 'Examen físico', icon: 'fa-stethoscope', placeholder: 'Hallazgos al examen físico por sistemas...' },
  { key: 'hallazgos_ecograficos', label: 'Hallazgos ecográficos', icon: 'fa-wave-square', placeholder: 'Hallazgos observados en la ecografía...' },
  { key: 'diagnostico', label: 'Diagnóstico', icon: 'fa-diagnoses', placeholder: 'Diagnóstico presuntivo o definitivo, CIE-10 si aplica...' },
  { key: 'tratamiento', label: 'Tratamiento', icon: 'fa-prescription-bottle-alt', placeholder: 'Indicaciones, medicación, dosis...' },
  { key: 'observaciones', label: 'Observaciones', icon: 'fa-comment-medical', placeholder: 'Notas adicionales (opcional)...' },
] as const;

type SectionKey = typeof SECTIONS[number]['key'];

const ALERGIA_CHIPS = ['Penicilina', 'AINES', 'Sulfas'];
const CONTROL_CHIPS: { label: string; val: string }[] = [
  { label: '7 días', val: '7' },
  { label: '15 días', val: '15' },
  { label: '1 mes', val: '30' },
  { label: 'Sin control', val: '' },
];

const RegistroClinico: React.FC<RegistroClinicoProps> = ({
  paciente,
  pacienteId,
  consultaId,
  medicoNombre = 'Dr. Miguel',
  pacienteNombre = '—',
  pacienteEdad = '—',
  diagnosticoPrevio,
  onSave,
}) => {
  const nombrePaciente = paciente ? `${paciente.nombres || ''} ${paciente.apellidos || ''}`.trim() : (pacienteNombre || '—');
  const edadPaciente = paciente?.edad;
  const pacienteCi = paciente?.documento ?? '—';
  const pacienteIdFinal = paciente?.id ?? pacienteId;
  const diagnostico_ant = paciente?.diagnostico;

  // ---------- ref de la página completa (para la animación de salida al guardar) ----------
  const pageRef = useRef<HTMLDivElement | null>(null);

  // ---------- signos vitales ----------
  const [vitales, setVitales] = useState<Record<VitalKey, string>>({
    pa_sys: '', pa_dia: '', fc: '', fr: '', sat: '', temp: '', peso: '', talla: '', glu: '',
  });
  const [alergiasRegistro, setAlergiasRegistro] = useState('');
  const [alergias, setAlergias] = useState(
    Array.isArray(paciente?.alergias) ? paciente.alergias.join(', ') : ''
  );
  const [secciones, setSecciones] = useState<Record<SectionKey, string>>({
    motivo: '', enfermedad_actual: '', examen_fisico: '', hallazgos_ecograficos: '',
    diagnostico: '', tratamiento: '', observaciones: '',
  });
  const [controlDias, setControlDias] = useState('');

  // ---------- refs para el auto-avance entre campos ----------
  const vitalRefs = useRef<Record<VitalKey, HTMLInputElement | null>>({
    pa_sys: null, pa_dia: null, fc: null, fr: null, sat: null, temp: null, peso: null, talla: null, glu: null,
  });
  const alergiasRef = useRef<HTMLInputElement | null>(null);
  const controlRef = useRef<HTMLInputElement | null>(null);
  const recetaRef = useRef<RecetaHandle>(null);

  useEffect(() => { vitalRefs.current.pa_sys?.focus(); }, []);

  const setVitalRef = (key: VitalKey) => (el: HTMLInputElement | null): void => {
    vitalRefs.current[key] = el;
  };

  const setVital = (key: VitalKey, raw: string, maxLen: number, numeric = true) => {
    const clean = numeric ? raw.replace(/[^0-9]/g, '') : raw.replace(/[^0-9.,]/g, '');
    setVitales(prev => ({ ...prev, [key]: clean }));
    if (numeric && clean.length >= maxLen) {
      const idx = VITAL_ORDER.indexOf(key);
      const nextKey = VITAL_ORDER[idx + 1];
      if (nextKey) vitalRefs.current[nextKey]?.focus();
      else alergiasRef.current?.focus();
    }
  };

  const handleAlergiaChip = (val: string) => {
  setAlergiasRegistro(val);
  document.getElementById('sec_motivo')?.focus();
};

  const handleControlChip = (val: string) => setControlDias(val);

  // ---------- signos completos / faltantes ----------
  const vitalesCompletos = [
    !!(vitales.pa_sys.trim() && vitales.pa_dia.trim()),
    !!vitales.fc.trim(), !!vitales.fr.trim(), !!vitales.sat.trim(),
    !!vitales.temp.trim(), !!vitales.peso.trim(), !!vitales.talla.trim(), !!vitales.glu.trim(),
  ];
  const faltan = vitalesCompletos.filter(v => !v).length;
  const listoParaGuardar = faltan === 0;

  // ---------- payload / guardado ----------
  const [saving, setSaving] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [shake, setShake] = useState(false);

  // ---------- estado para exámenes complementarios (nuevo componente) ----------
  const [drawerExamOpen, setDrawerExamOpen] = useState(false);
  const [examItems, setExamItems] = useState<ExamenItem[]>([]);

  const buildRegistroCompletoPayload = (): RegistroCompletoPayload => {
    const num = (v: string) => (v.trim() !== '' ? parseFloat(v.replace(',', '.')) : 0);
    const pa = vitales.pa_sys && vitales.pa_dia ? `${vitales.pa_sys}/${vitales.pa_dia}` : '';
    let control: string | null = null;
    if (controlDias.trim()) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(controlDias, 10));
      control = d.toISOString().slice(0, 10);
    }

    const ahora = new Date();
    const fecha = ahora.toISOString().slice(0, 10);   // 'YYYY-MM-DD'
    const hora = ahora.toTimeString().slice(0, 8);     // 'HH:MM:SS'

    const payload: RegistroCompletoPayload = {
      consulta: {
        paciente_id: pacienteIdFinal!,
        medico_id: MEDICO_ID,
        fecha,
        hora,
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
        consulta_control: control,
      },
    };

    // Mapeamos los items del nuevo formato al que espera el backend
    if (examItems.length) {
      payload.examenes_complementarios = examItems.map((it) => ({
        categoria: it.categoria === 'laboratorio' ? 'Laboratorio' : it.categoria === 'imagenologia' ? 'Imagenología' : 'Otro',
        nombre_examen: it.nombre,
        observaciones: it.observaciones || null,
      }));
    }

    const recetaPayload = recetaRef.current?.getPayload();
    if (recetaPayload) {
      payload.recetas = recetaPayload;
    }

    return payload;
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleGuardar = async () => {
    if (!listoParaGuardar) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    if (!pacienteIdFinal) {
      setSaveError('No hay un paciente seleccionado.');
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      const payload = buildRegistroCompletoPayload();
      setPayloadPreview(JSON.stringify(payload, null, 2));

      const resultado = await createRegistroCompleto(payload);

      // Limpia todo tras un guardado exitoso
      setExamItems([]);
      recetaRef.current?.reset();

      // animación de salida (fade + scale) antes de avisarle al padre
      if (pageRef.current) {
        await new Promise<void>(resolve => {
          gsap.to(pageRef.current, {
            opacity: 0,
            scale: 0.96,
            duration: 0.4,
            ease: 'power2.out',
            onComplete: resolve,
          });
        });
      }

      await onSave?.(resultado);
    } catch (err) {
      setSaveError('No se pudo guardar el registro clínico. Revisa los datos e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // Atajo Ctrl+Enter para guardar
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
  }, [vitales, secciones, alergias, controlDias, examItems]);

  // Atajos Alt+E / Alt+R / Escape para los drawers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'e') { e.preventDefault(); setDrawerExamOpen(true); }
      if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); setDrawerRxOpen(true); }
      if (e.key === 'Escape') { setDrawerExamOpen(false); setDrawerRxOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ---------- drawer: receta ----------
  const [drawerRxOpen, setDrawerRxOpen] = useState(false);

  const controlFecha = useMemo(() => {
    if (!controlDias.trim()) return null;
    const d = new Date();
    d.setDate(d.getDate() + parseInt(controlDias, 10));
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [controlDias]);

  return (
    <div className={styles.page} ref={pageRef}>
      {/* ---------- topbar ---------- */}
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.mark}>
              <FontAwesomeIcon icon={faUser}/>
            </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em' }}>Registro clínico</h1>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              {pacienteIdFinal ? `Paciente #${pacienteIdFinal}` : (consultaId ? `Consulta #${consultaId}` : 'Nuevo Registro')}
            </span>
          </div>
        </div>
      </div>

      {/* ---------- ficha del paciente ---------- */}
      <div className={`${styles.card} ${styles.pacienteCard}`}>
        <div
          className={styles.pinfoGrid}
          
        >
          <div className={styles.pinfoItem} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className={styles.pk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`fas fa-user ${styles.ficon}`}></i> Nombre
            </div>
            <div className={styles.pv}>{nombrePaciente}</div>
          </div>
          <div className={styles.pinfoItem} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className={styles.pk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`fas fa-cake-candles ${styles.ficon}`}></i> Edad
            </div>
            <div className={styles.pv}>{edadPaciente}</div>
          </div>
          <div
            className={`${styles.pinfoItem} ${styles.pinfoAlert} ${alergias.trim() ? styles.tiene : ''}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <div className={styles.pk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`fas fa-triangle-exclamation ${styles.ficon}`}></i> Alergias
            </div>
            <div className={styles.pv}>{alergias.trim() || 'No'}</div>
          </div>
          <div className={styles.pinfoItem} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div className={styles.pk} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className={`fas fa-diagnoses ${styles.ficon}`}></i> Diagnóstico principal
            </div>
            <div className={styles.pv}>{diagnostico_ant}</div>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>

          {/* 1. SIGNOS VITALES */}
          <div className={styles.field}>
            <div className={styles.flabel}><i className={`fas fa-heartbeat ${styles.ficon}`}></i> Signos vitales
              {faltan === 0 && <span className={styles.badgeOk}>✓ completo</span>}
            </div>
            <div className={styles.vitalsRow}>
              <div className={styles.vslot}>
                <label>Presión arterial</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('pa_sys')} className={vitales.pa_sys ? styles.ok : ''} value={vitales.pa_sys}
                    onChange={e => setVital('pa_sys', e.target.value, 3)} placeholder="120" inputMode="numeric" maxLength={3} />
                  <span className={styles.sep}>/</span>
                  <input ref={setVitalRef('pa_dia')} className={vitales.pa_dia ? styles.ok : ''} value={vitales.pa_dia}
                    onChange={e => setVital('pa_dia', e.target.value, 3)} placeholder="80" inputMode="numeric" maxLength={3} />
                  <span className={styles.unit}>mmHg</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Frec. cardíaca</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('fc')} className={vitales.fc ? styles.ok : ''} value={vitales.fc}
                    onChange={e => setVital('fc', e.target.value, 3)} placeholder="78" inputMode="numeric" maxLength={3} />
                  <span className={styles.unit}>lpm</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Frec. respiratoria</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('fr')} className={vitales.fr ? styles.ok : ''} value={vitales.fr}
                    onChange={e => setVital('fr', e.target.value, 2)} placeholder="16" inputMode="numeric" maxLength={2} />
                  <span className={styles.unit}>rpm</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Saturación O2</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('sat')} className={vitales.sat ? styles.ok : ''} value={vitales.sat}
                    onChange={e => setVital('sat', e.target.value, 3)} placeholder="97" inputMode="numeric" maxLength={3} />
                  <span className={styles.unit}>%</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Temperatura</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('temp')} className={`${styles.wide} ${vitales.temp ? styles.ok : ''}`} value={vitales.temp}
                    onChange={e => setVital('temp', e.target.value, 99, false)} placeholder="36.5" inputMode="decimal" />
                  <span className={styles.unit}>°C</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Peso</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('peso')} className={`${styles.wide} ${vitales.peso ? styles.ok : ''}`} value={vitales.peso}
                    onChange={e => setVital('peso', e.target.value, 99, false)} placeholder="70" inputMode="decimal" />
                  <span className={styles.unit}>kg</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Talla</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('talla')} className={`${styles.wide} ${vitales.talla ? styles.ok : ''}`} value={vitales.talla}
                    onChange={e => setVital('talla', e.target.value, 99, false)} placeholder="1.70" inputMode="decimal" />
                  <span className={styles.unit}>m</span>
                </div>
              </div>
              <div className={styles.vslot}>
                <label>Glicemia</label>
                <div className={styles.vinputs}>
                  <input ref={setVitalRef('glu')} className={`${styles.wide} ${vitales.glu ? styles.ok : ''}`} value={vitales.glu}
                    onChange={e => setVital('glu', e.target.value, 99, false)} placeholder="95" inputMode="decimal" />
                  <span className={styles.unit}>mg/dL</span>
                </div>
              </div>
            </div>
            <div className={styles.subhint}>Escribe y avanza solo · <kbd>Tab</kbd> también salta al siguiente signo</div>
          </div>

          {/* 2. ALERGIAS */}
          <div className={`${styles.field} ${styles.fieldAlert}`}>
            <div className={`${styles.flabel} ${styles.flabelAlert}`}><i className={`fas fa-allergies ${styles.ficon}`}></i> Alergias
              {alergias.trim() && <span className={styles.badgeOk}>✓</span>}
            </div>
            <input ref={alergiasRef} type="text" value={alergiasRegistro} onChange={e => setAlergiasRegistro(e.target.value)}
              placeholder="Escribe, o elige una opción rápida abajo..." />
            <div className={styles.chips}>
              {ALERGIA_CHIPS.map(val => (
                <div key={val} className={`${styles.chip} ${styles.chipAlert} ${alergias === val ? styles.active : ''}`} onClick={() => handleAlergiaChip(val)}>
                  {val}
                </div>
              ))}
            </div>
            <div className={styles.subhint}><kbd>Tab</kbd> continúa a motivo de consulta</div>
          </div>

          {/* 3–9. CAMPOS COMPACTOS */}
          {SECTIONS.map(s => (
            <div className={`${styles.field} ${styles.fieldPlain}`} key={s.key}>
              <div className={styles.flabel}><i className={`fas ${s.icon} ${styles.ficon}`}></i> {s.label}
                {secciones[s.key].trim() && <span className={styles.badgeOk}>✓</span>}
              </div>
              <textarea
                id={`sec_${s.key}`}
                rows={2}
                value={secciones[s.key]}
                onChange={e => setSecciones(prev => ({ ...prev, [s.key]: e.target.value }))}
                placeholder={s.placeholder}
              />
            </div>
          ))}

          {/* 10. PRÓXIMO CONTROL */}
          <div className={`${styles.field} ${styles.fieldPlain}`}>
            <div className={styles.flabel}><i className={`fas fa-calendar-check ${styles.ficon}`}></i> Próximo control
              {controlDias.trim() && <span className={styles.badgeOk}>✓</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>En</span>
              <input ref={controlRef} type="text" inputMode="numeric" maxLength={3} placeholder="7"
                value={controlDias} onChange={e => setControlDias(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ width: 60, background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 10, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, padding: '8px 4px', color: 'var(--text)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>días</span>
            </div>
            <div className={styles.chips}>
              {CONTROL_CHIPS.map(c => (
                <div key={c.label} className={`${styles.chip} ${controlDias === c.val ? styles.active : ''}`} onClick={() => handleControlChip(c.val)}>
                  {c.label}
                </div>
              ))}
            </div>
            {controlFecha && <div className={styles.subhint}>Próximo control: {controlFecha}</div>}
          </div>

        </div>
      </div>

      {saveError && (
        <div style={{ color: 'var(--danger, #e5484d)', marginBottom: 8, fontSize: 13 }}>
          {saveError}
        </div>
      )}

      <div className={styles.savebar} ref={editorRef}>
        <div className={`${styles.status} ${listoParaGuardar ? styles.ok : ''}`}>
          {listoParaGuardar
            ? <><b>Listo para guardar</b> · todos los signos vitales completos</>
            : <>Faltan <b>{faltan}</b> {faltan === 1 ? 'signo vital obligatorio' : 'signos vitales obligatorios'}</>}
        </div>
        <button className={`${styles.btnSaveModern} ${shake ? styles.shake : ''}`} disabled={!listoParaGuardar || saving} onClick={handleGuardar}>
          <i className="fas fa-save"></i> {saving ? 'Guardando...' : 'Guardar registro clínico'} <kbd>Ctrl + Enter</kbd>
        </button>
      </div>

      {payloadPreview && (
        <div className={`${styles.payload} ${styles.show}`}>
          <div className={styles.payloadHead}>
            <span>Payload enviado a guardar</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent)' }}
              onClick={() => navigator.clipboard.writeText(payloadPreview)}>Copiar JSON</span>
          </div>
          <pre>{payloadPreview}</pre>
        </div>
      )}

      {/* ================= FLOATING DOCK ================= */}
      <div className={styles.dock}>
        {/* --- Diagnóstico principal --- */}
        <div className={styles.diagnosisAlert}>
          <i className={`fas fa-diagnoses ${styles.ficon}`}></i>
          <span>
            Diagnóstico: {diagnostico_ant?.trim() ? diagnostico_ant : <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No especificado</span>}
          </span>
        </div>

        {/* --- Alergias --- */}
        {alergias.trim() && (
          <div className={styles.allergyAlert}>
            <i className={`fas fa-allergies ${styles.ficon}`}></i>
            <span>Alergias: {alergias}</span>
          </div>
        )}

        {/* Botón de exámenes (existente) */}
        <div className={`${styles.dockBtn} ${styles.exam}`} onClick={() => setDrawerExamOpen(true)}>
          <span className={styles.ico}><FontAwesomeIcon icon={faFlaskVial} /></span>
          Exámenes complementarios <kbd>Alt+E</kbd>
          <span className={`${styles.count} ${examItems.length ? styles.show : ''}`}>
            {examItems.length}
          </span>
        </div>

        {/* Botón de receta (existente) */}
        <div className={`${styles.dockBtn} ${styles.rx}`} onClick={() => setDrawerRxOpen(true)}>
          <span className={styles.ico}><FontAwesomeIcon icon={faCapsules} /></span>
          Recetar <kbd>Alt+R</kbd>
        </div>
      </div>
      {/* ================= DRAWER: EXÁMENES (NUEVO COMPONENTE) ================= */}
      {drawerExamOpen && (
        <Examenes
          isOpen={drawerExamOpen}
          onClose={() => setDrawerExamOpen(false)}
          contexto={{
            registro_clinico_id: pacienteIdFinal ?? 0,
            medico_id: MEDICO_ID,
            paciente_nombre: nombrePaciente,
            registro_numero: consultaId ? `#RC-${consultaId}` : '#RC-00128',
            medico_nombre: medicoNombre,
          }}
          onSave={(items) => {
            setExamItems(items);
            // El componente ya llama a onClose internamente, pero podemos asegurarlo
            setDrawerExamOpen(false);
          }}
        />
      )}

      {/* ================= RECETA (componente aparte) ================= */}
      <Receta
        ref={recetaRef}
        isOpen={drawerRxOpen}
        onClose={() => setDrawerRxOpen(false)}
        pacienteNombre={nombrePaciente}
        pacienteEdad={edadPaciente != null ? String(edadPaciente) : pacienteEdad}
        pacienteCi={pacienteCi}
        alergias={alergias}
        medicoNombre={medicoNombre}
      />
    </div>
  );
};

export default RegistroClinico;