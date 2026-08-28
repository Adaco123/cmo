import React, { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { subirArchivoExamen } from '../../api/archivos';
import type { Paciente as ApiPaciente } from '../../api/pacientes';
import Receta from './Receta';
import type { RecetaHandle } from './Receta';
import styles from './RegistroClinico.module.css';
import { createRegistroCompleto } from '../../api/historialClinico';
import type { RegistroCompletoPayload, RegistroCompletoResponse } from '../../api/historialClinico';
import Examenes from './Examenes';
import type { ExamenesHandle } from './Examenes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser, faCapsules, faFlaskVial, faXmark
} from '@fortawesome/free-solid-svg-icons';

const MEDICO_ID = 1;
const TIPO_ARCHIVO_POR_EXT: Record<string, number> = {
  jpg: 1, jpeg: 1, png: 1,
  pdf: 2,
};

/** "YYYY-MM-DD" en fecha LOCAL, a diferencia de toISOString() que usa UTC
 *  y puede adelantar un día en horas de la noche (Bolivia es UTC-4). */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Forma "aplanada" de un examen ya lista para mandar a la API y para
// iterar en el loop de subida de archivos tras crear el registro.
type ExamenFlat = {
  categoria: 'Laboratorio' | 'Imagenología' | 'Otro';
  nombre_examen: string;
  resultado: string | null;
  observaciones: string | null;
  archivos: File[];
};

const CATEGORIA_LABEL = {
  laboratorio: 'Laboratorio',
  imagenologia: 'Imagenología',
  otros: 'Otro',
} as const;

interface RegistroClinicoProps {
  paciente?: ApiPaciente | null;
  pacienteId?: number;
  consultaId?: number;
  medicoNombre?: string;
  pacienteNombre?: string;
  pacienteEdad?: string;
  diagnosticoPrevio?: string;
  onSave?: (resultado: RegistroCompletoResponse) => void | Promise<void>;
  /** Cierra el modal. Pinta el botón "x" flotante y se dispara también
   *  al hacer click en el fondo (backdrop). */
  onClose?: () => void;
}

type VitalKey = 'pa_sys' | 'pa_dia' | 'fc' | 'fr' | 'sat' | 'temp' | 'peso' | 'talla' | 'glu';

const VITAL_ORDER: VitalKey[] = ['pa_sys', 'pa_dia', 'fc', 'fr', 'sat', 'temp', 'peso', 'talla', 'glu'];

// NOTA: 'tratamiento' se mantiene en esta lista solo como definición de
// metadatos (label/icon/placeholder) para reutilizarlos en el bloque
// especial de solo lectura más abajo. Se filtra explícitamente del
// .map() genérico porque su edición manual está deshabilitada: el
// contenido llega automáticamente desde Receta.tsx (pestaña Medicamentos).
const SECTIONS = [
  { key: 'motivo', label: 'Motivo de consulta', icon: 'fa-question-circle', placeholder: 'Motivo por el que acude el paciente a consulta...' },
  { key: 'enfermedad_actual', label: 'Enfermedad actual', icon: 'fa-history', placeholder: 'Tiempo de evolución, síntomas, características...' },
  { key: 'examen_fisico', label: 'Examen físico', icon: 'fa-stethoscope', placeholder: 'Hallazgos al examen físico por sistemas...' },
  { key: 'hallazgos_ecograficos', label: 'Hallazgos ecográficos', icon: 'fa-wave-square', placeholder: 'Hallazgos observados en la ecografía...' },
  { key: 'diagnostico', label: 'Diagnóstico', icon: 'fa-diagnoses', placeholder: 'Diagnóstico presuntivo o definitivo, CIE-10 si aplica...' },
  { key: 'tratamiento', label: 'Tratamiento', icon: 'fa-prescription-bottle-alt', placeholder: 'Se completa automáticamente al recetar medicamentos, exámenes o fórmulas...' },
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

/**
 * Formulario de "Nueva consulta" / registro clínico. Es autocontenido:
 * renderiza su propio backdrop + wrapper ancho + botón de cerrar, así
 * que el componente que lo usa (VerPaciente.tsx) solo necesita montarlo
 * condicionalmente, sin envolverlo en su propio wrapper de modal:
 *
 *   {showHistoriaClinica && (
 *     <RegistroClinico paciente={...} onClose={...} onSave={...} />
 *   )}
 */
const RegistroClinico: React.FC<RegistroClinicoProps> = ({
  paciente,
  pacienteId,
  consultaId,
  medicoNombre = 'Dr. Miguel',
  pacienteNombre = '—',
  pacienteEdad = '—',
  diagnosticoPrevio,
  onSave,
  onClose,
}) => {
  const nombrePaciente = paciente ? `${paciente.nombres || ''} ${paciente.apellidos || ''}`.trim() : (pacienteNombre || '—');
  const edadPaciente = paciente?.edad;
  const pacienteCi = paciente?.documento ?? '—';
  const pacienteIdFinal = paciente?.id ?? pacienteId;
  const diagnostico_ant = paciente?.diagnostico;

  const pageRef = useRef<HTMLDivElement | null>(null);

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

  const [controlNota, setControlNota] = useState('');
  const [controlDias, setControlDias] = useState('');
  const [controlHoraInicio, setControlHoraInicio] = useState('');
  const [controlHoraFin, setControlHoraFin] = useState('');

  const vitalRefs = useRef<Record<VitalKey, HTMLInputElement | null>>({
    pa_sys: null, pa_dia: null, fc: null, fr: null, sat: null, temp: null, peso: null, talla: null, glu: null,
  });
  const alergiasRef = useRef<HTMLInputElement | null>(null);
  const controlNotaRef = useRef<HTMLTextAreaElement | null>(null);
  const controlRef = useRef<HTMLInputElement | null>(null);
  const recetaRef = useRef<RecetaHandle>(null);
  const examenesRef = useRef<ExamenesHandle>(null);

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

  // Recibe el texto ya armado desde Receta.tsx (medicamentos, exámenes y
  // fórmulas) y lo vuelca en secciones.tratamiento. Este es el ÚNICO lugar
  // donde secciones.tratamiento cambia — el textarea correspondiente es de
  // solo lectura, así que no hay otra vía de escritura para ese campo.
  const handleTratamientoChange = (texto: string) => {
    setSecciones(prev => ({ ...prev, tratamiento: texto }));
  };

  // fr (frec. respiratoria), talla y glu (glicemia) quedan fuera de esta
  // lista a propósito: siguen siendo campos editables, pero no son
  // obligatorios para poder guardar el registro.
  const vitalesCompletos = [
    !!(vitales.pa_sys.trim() && vitales.pa_dia.trim()),
    !!vitales.fc.trim(), !!vitales.sat.trim(),
    !!vitales.temp.trim(), !!vitales.peso.trim(),
  ];
  const faltan = vitalesCompletos.filter(v => !v).length;
  const listoParaGuardar = faltan === 0;

  const [saving, setSaving] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [shake, setShake] = useState(false);

  const [drawerExamOpen, setDrawerExamOpen] = useState(false);
  // Solo el conteo vive en RegistroClinico; los datos reales de cada
  // examen (incluidos los File[]) siguen dentro de Examenes y se leen
  // recién al guardar, vía examenesRef.current.getPayload().
  const [examCount, setExamCount] = useState(0);

  const controlFecha = useMemo(() => {
    if (!controlDias.trim()) return null;
    const d = new Date();
    d.setDate(d.getDate() + parseInt(controlDias, 10));
    return d;
  }, [controlDias]);

  const controlFechaLegible = useMemo(() => {
    if (!controlFecha) return null;
    return controlFecha.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }, [controlFecha]);

  // Aplana el payload agrupado por categoría que devuelve Examenes,
  // conservando los File[] de cada examen para subirlos después de crear
  // el registro (createRegistroCompleto no maneja binarios).
  const getExamenesFlat = (): ExamenFlat[] => {
    const payload = examenesRef.current?.getPayload();
    if (!payload) return [];
    const flat: ExamenFlat[] = [];
    (['laboratorio', 'imagenologia', 'otros'] as const).forEach((cat) => {
      payload[cat]?.items.forEach((item) => {
        flat.push({
          categoria: CATEGORIA_LABEL[cat],
          nombre_examen: item.nombre_examen,
          resultado: item.resultado,
          observaciones: item.observaciones,
          archivos: item.archivos,
        });
      });
    });
    return flat;
  };

  const buildRegistroCompletoPayload = (examenesFlat: ExamenFlat[]): RegistroCompletoPayload => {
    const num = (v: string) => (v.trim() !== '' ? parseFloat(v.replace(',', '.')) : 0);
    const pa = vitales.pa_sys && vitales.pa_dia ? `${vitales.pa_sys}/${vitales.pa_dia}` : '';

    const proximaFechaControl = controlFecha ? toLocalDateString(controlFecha) : null;

    const ahora = new Date();
    const fecha = toLocalDateString(ahora);
    const hora = ahora.toTimeString().slice(0, 8);

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
        consulta_control: controlNota.trim() || null,
      },
    };

    if (examenesFlat.length) {
      payload.examenes_complementarios = examenesFlat.map(
        ({ categoria, nombre_examen, resultado, observaciones }) => ({
          categoria, nombre_examen, resultado, observaciones,
        })
      );
    }

    const recetaPayload = recetaRef.current?.getPayload();
    if (recetaPayload) {
      payload.recetas = recetaPayload;
    }

    if (controlNota.trim()) {
      payload.seguimiento_control = {
        evolucion: controlNota.trim(),
        proxima_fecha_control: proximaFechaControl,
        hora_inicio: controlHoraInicio.trim() || null,
        hora_fin: controlHoraFin.trim() || null,
      };
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
      const examenesFlat = getExamenesFlat();
      const payload = buildRegistroCompletoPayload(examenesFlat);
      setPayloadPreview(JSON.stringify(payload, null, 2));

      const resultado = await createRegistroCompleto(payload);

      for (let i = 0; i < examenesFlat.length; i++) {
        const examenCreado = resultado.examenes_complementarios[i];
        if (!examenCreado) continue;

        for (const archivoObj of examenesFlat[i].archivos) {
          const ext = archivoObj.name.split('.').pop()?.toLowerCase() || '';
          const tipoArchivoId = TIPO_ARCHIVO_POR_EXT[ext] ?? 1;
          try {
            await subirArchivoExamen(examenCreado.id, archivoObj, tipoArchivoId);
          } catch (errArchivo) {
            console.error(`No se pudo subir el archivo "${archivoObj.name}"`, errArchivo);
          }
        }
      }

      examenesRef.current?.reset();
      setExamCount(0);
      recetaRef.current?.reset();

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGuardar();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [vitales, secciones, alergias, controlNota, controlDias, controlHoraInicio, controlHoraFin, examCount]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'e') { e.preventDefault(); setDrawerExamOpen(true); }
      if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); setDrawerRxOpen(true); }
      if (e.key === 'Escape') { setDrawerExamOpen(false); setDrawerRxOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const [drawerRxOpen, setDrawerRxOpen] = useState(false);

  return (
    <div className={styles.backdrop} onClick={() => onClose?.()}>
      <div className={styles.modalWide} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}

        <div className={styles.page} ref={pageRef}>
          <div className={styles.topbar}>
            <div className={styles.brand}>
              <div className={styles.mark}>
                <FontAwesomeIcon icon={faUser} />
              </div>
              <div>
                <h1>Registro clínico</h1>
                <span>
                  {pacienteIdFinal ? `Paciente #${pacienteIdFinal}` : (consultaId ? `Consulta #${consultaId}` : 'Nuevo Registro')}
                </span>
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.pacienteCard}`}>
            <div className={styles.pinfoGrid}>
              <div className={styles.pinfoItem}>
                <div className={styles.pk}>
                  <i className={`fas fa-user ${styles.ficon}`}></i> Nombre
                </div>
                <div className={styles.pv}>{nombrePaciente}</div>
              </div>
              <div className={styles.pinfoItem}>
                <div className={styles.pk}>
                  <i className={`fas fa-cake-candles ${styles.ficon}`}></i> Edad
                </div>
                <div className={styles.pv}>{edadPaciente}</div>
              </div>
              <div className={`${styles.pinfoItem} ${styles.pinfoAlert} ${alergias.trim() ? styles.tiene : ''}`}>
                <div className={styles.pk}>
                  <i className={`fas fa-triangle-exclamation ${styles.ficon}`}></i> Alergias
                </div>
                <div className={styles.pv}>{alergias.trim() || 'No'}</div>
              </div>
              <div className={styles.pinfoItem}>
                <div className={styles.pk}>
                  <i className={`fas fa-diagnoses ${styles.ficon}`}></i> Diagnóstico principal
                </div>
                <div className={styles.pv}>{diagnostico_ant}</div>
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <div className={styles.field}>
                <div className={styles.flabel}>
                  <i className={`fas fa-heartbeat ${styles.ficon}`}></i> Signos vitales
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

              <div className={`${styles.field} ${styles.fieldAlert}`}>
                <div className={`${styles.flabel} ${styles.flabelAlert}`}>
                  <i className={`fas fa-allergies ${styles.ficon}`}></i> Alergias
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

              {SECTIONS.filter(s => s.key !== 'tratamiento').map(s => (
                <div className={`${styles.field} ${styles.fieldPlain}`} key={s.key}>
                  <div className={styles.flabel}>
                    <i className={`fas ${s.icon} ${styles.ficon}`}></i> {s.label}
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

              {/*
                Tratamiento: campo de SOLO LECTURA.
                Su contenido llega automáticamente desde Receta.tsx (pestaña
                Medicamentos) vía handleTratamientoChange. No se debe permitir
                edición manual aquí — por eso readOnly + disabled.
              */}
              <div className={`${styles.field} ${styles.fieldPlain}`}>
                <div className={styles.flabel}>
                  <i className={`fas fa-prescription-bottle-alt ${styles.ficon}`}></i> Tratamiento
                  {secciones.tratamiento.trim() && <span className={styles.badgeOk}>✓</span>}
                </div>
                <textarea
                  id="sec_tratamiento"
                  rows={2}
                  value={secciones.tratamiento}
                  readOnly
                  disabled
                  placeholder="Se completa automáticamente al recetar medicamentos (Alt+R → Medicamentos)..."
                />
                <div className={styles.subhint}>Este campo se llena solo desde “Recetar” → Medicamentos</div>
              </div>

              <div className={`${styles.field} ${styles.fieldPlain}`}>
                <div className={styles.flabel}>
                  <i className={`fas fa-calendar-check ${styles.ficon}`}></i> Consulta control
                  {controlNota.trim() && <span className={styles.badgeOk}>✓</span>}
                </div>
                <textarea
                  ref={controlNotaRef}
                  rows={2}
                  value={controlNota}
                  onChange={e => setControlNota(e.target.value)}
                  placeholder="Ej: Antibiótico por 7 días, control por persistencia de fiebre..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Volver en</span>
                  <input ref={controlRef} type="text" inputMode="numeric" maxLength={3} placeholder="7"
                    value={controlDias} onChange={e => setControlDias(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ width: 60, background: 'var(--bg-input)', border: '1.5px solid var(--border-color)', borderRadius: 10, textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, padding: '8px 4px', color: 'var(--text-main)' }} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>días</span>
                </div>
                <div className={styles.chips}>
                  {CONTROL_CHIPS.map(c => (
                    <div key={c.label} className={`${styles.chip} ${controlDias === c.val ? styles.active : ''}`} onClick={() => handleControlChip(c.val)}>
                      {c.label}
                    </div>
                  ))}
                </div>
                {controlDias.trim() && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Hora</span>
                    <input type="time" value={controlHoraInicio} onChange={e => setControlHoraInicio(e.target.value)}
                      style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-color)', borderRadius: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, padding: '8px 6px', color: 'var(--text-main)' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>a</span>
                    <input type="time" value={controlHoraFin} onChange={e => setControlHoraFin(e.target.value)}
                      style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-color)', borderRadius: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, padding: '8px 6px', color: 'var(--text-main)' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(opcional)</span>
                  </div>
                )}
                {controlFechaLegible && <div className={styles.subhint}>Próximo control: {controlFechaLegible}</div>}
                {!controlNota.trim() && controlDias.trim() && (
                  <div className={styles.subhint} style={{ color: 'var(--warn, #C08A2E)' }}>
                    Elegiste una fecha pero falta la nota — sin nota no se registra el seguimiento
                  </div>
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <div style={{ color: 'var(--status-inactive)', marginBottom: 8, fontSize: 13 }}>
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
                <span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigator.clipboard.writeText(payloadPreview)}>Copiar JSON</span>
              </div>
              <pre>{payloadPreview}</pre>
            </div>
          )}

          <div className={styles.dock}>
            <div className={styles.diagnosisAlert}>
              <i className={`fas fa-diagnoses ${styles.ficon}`}></i>
              <span>
                Diagnóstico: {diagnostico_ant?.trim() ? diagnostico_ant : <span style={{ fontStyle: 'italic', opacity: 0.7 }}>No especificado</span>}
              </span>
            </div>

            {alergias.trim() && (
              <div className={styles.allergyAlert}>
                <i className={`fas fa-allergies ${styles.ficon}`}></i>
                <span>Alergias: {alergias}</span>
              </div>
            )}

            <div className={`${styles.dockBtn} ${styles.exam}`} onClick={() => setDrawerExamOpen(true)}>
              <span className={styles.ico}><FontAwesomeIcon icon={faFlaskVial} /></span>
              Exámenes complementarios <kbd>Alt+E</kbd>
              <span className={`${styles.count} ${examCount ? styles.show : ''}`}>
                {examCount}
              </span>
            </div>

            <div className={`${styles.dockBtn} ${styles.rx}`} onClick={() => setDrawerRxOpen(true)}>
              <span className={styles.ico}><FontAwesomeIcon icon={faCapsules} /></span>
              Recetar <kbd>Alt+R</kbd>
            </div>
          </div>

          {/*
            Examenes SIEMPRE montado (sin `drawerExamOpen && (...)`).
            `isOpen` solo controla si el componente pinta su contenido o
            devuelve null; el estado interno (items, archivos) se conserva
            entre aperturas/cierres porque el componente nunca se desmonta.
          */}
          <Examenes
            ref={examenesRef}
            isOpen={drawerExamOpen}
            onClose={() => setDrawerExamOpen(false)}
            contexto={{
              registro_clinico_id: pacienteIdFinal ?? 0,
              medico_id: MEDICO_ID,
              paciente_nombre: nombrePaciente,
              registro_numero: consultaId ? `#RC-${consultaId}` : '#RC-00128',
              medico_nombre: medicoNombre,
            }}
            onItemsCountChange={setExamCount}
          />

          <Receta
            ref={recetaRef}
            isOpen={drawerRxOpen}
            onClose={() => setDrawerRxOpen(false)}
            pacienteNombre={nombrePaciente}
            pacienteEdad={edadPaciente != null ? String(edadPaciente) : pacienteEdad}
            pacienteCi={pacienteCi}
            alergias={alergias}
            medicoNombre={medicoNombre}
            diagnostico={secciones.diagnostico}
            onTratamientoChange={handleTratamientoChange}
          />
        </div>
      </div>
    </div>
  );
};

export default RegistroClinico;