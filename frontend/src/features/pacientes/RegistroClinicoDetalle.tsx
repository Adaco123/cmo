import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getRegistroClinicoCompleto } from '../../api/historialClinico';
import type { RegistroClinicoCompletoDetalle } from '../../api/historialClinico';
import type { Receta } from '../../api/recetas';
import type { Paciente } from '../../api/pacientes';
import { getArchivosPorExamen, descargarArchivoBlob } from '../../api/archivos';
import type { ArchivoResponse } from '../../api/archivos';
import { updateObservacionesExamen } from '../../api/examenesComplementarios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner, faExclamationCircle, faFlaskVial, faPills,
  faCalendarCheck, faDownload, faXmark, faExpand, faWaveSquare,
  faNotesMedical, faTriangleExclamation, faStethoscope, faPen,
  faCapsules, faCamera,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import CapturaQrModal from './CapturaQrModal';
import styles from './RegistroClinicoDetalle.module.css';

interface Props {
  registroId: number;
  /** Paciente dueño del registro. Opcional: si no se pasa, simplemente no se
   *  muestra el botón de "Enviar por WhatsApp" en las recetas. */
  paciente?: Paciente;
}

type GaleriaPorExamen = Record<number, { archivo: ArchivoResponse; url: string }[]>;

interface ImagenActiva {
  archivo: ArchivoResponse;
  url: string;
  examenNombre: string;
}

// ---- Geometría del gauge SVG (radio 34 → mismo valor que el viewBox 0 0 80 80) ----
const GAUGE_R = 34;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

const parseNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

const gaugeOffset = (value: number, min: number, max: number): number => {
  const pct = Math.min(Math.max((value - min) / (max - min), 0), 1);
  return GAUGE_CIRC * (1 - pct);
};

// Rangos clínicos de referencia usados solo para resaltar el gauge (borde/trazo
// en rojo) cuando el valor cae fuera de lo esperado; no son un diagnóstico.
const RANGOS = {
  fc: { min: 0, max: 160, bajo: 60, alto: 100 },
  fr: { min: 0, max: 40, bajo: 12, alto: 20 },
  spo2: { min: 80, max: 100, bajo: 95, alto: 101 },
  temp: { min: 34, max: 41, bajo: 36, alto: 37.5 },
  glicemia: { min: 0, max: 250, bajo: 70, alto: 100 },
};

const fueraDeRango = (valor: number, r: { bajo: number; alto: number }) =>
  valor < r.bajo || valor > r.alto;

// ---- Helpers de WhatsApp (mismo patrón que Calendario.tsx) ----
function toWhatsAppNumber(telefono: string): string {
  const digits = telefono.replace(/\D/g, '');
  return digits.startsWith('591') ? digits : `591${digits}`;
}

function buildWhatsAppUrl(telefono: string, mensaje: string): string {
  return `https://wa.me/${toWhatsAppNumber(telefono)}?text=${encodeURIComponent(mensaje)}`;
}

function formatFechaLabel(fecha: string): string {
  const soloFecha = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] ?? fecha;
  return new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${soloFecha}T00:00:00`)
  );
}

function mensajeReceta(nombrePaciente: string, fechaLabel: string, receta: Receta): string {
  const lineas: string[] = [`Hola ${nombrePaciente}, esta es tu receta de CMO del ${fechaLabel}:`];

  if (receta.indicaciones_generales) {
    lineas.push('', receta.indicaciones_generales);
  }

  if (receta.medicamentos.length > 0) {
    lineas.push('', '*Medicamentos*');
    receta.medicamentos.forEach((m) => {
      const detalle = [m.dosis, m.via_administracion, m.frecuencia, m.duracion].filter(Boolean).join(' · ');
      lineas.push(`- ${m.medicamento}${detalle ? ` — ${detalle}` : ''}`);
      if (m.indicaciones) lineas.push(`  ${m.indicaciones}`);
    });
  }

  if (receta.formulas_magistrales.length > 0) {
    lineas.push('', '*Fórmulas magistrales*');
    receta.formulas_magistrales.forEach((f) => {
      lineas.push(`- ${f.nombre_formula}: ${f.ingredientes}`);
      const detalle = [f.forma_farmaceutica, f.cantidad_preparar, f.via_administracion].filter(Boolean).join(' · ');
      if (detalle) lineas.push(`  ${detalle}`);
    });
  }

  if (receta.examenes.length > 0) {
    lineas.push('', '*Exámenes solicitados*');
    receta.examenes.forEach((e) => {
      lineas.push(`- ${e.nombre_examen}${e.urgencia === 'Urgente' ? ' (Urgente)' : ''}`);
    });
  }

  return lineas.join('\n');
}

const RegistroClinicoDetalle: React.FC<Props> = ({ registroId, paciente }) => {
  const [detalle, setDetalle] = useState<RegistroClinicoCompletoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galeria, setGaleria] = useState<GaleriaPorExamen>({});
  const [imagenActiva, setImagenActiva] = useState<ImagenActiva | null>(null);

  // Lupa dentro del lightbox: mover el mouse (o el dedo) sobre la imagen
  // amplía la zona bajo el cursor, sin perder de vista la foto completa.
  const [lupaPos, setLupaPos] = useState({ x: 0, y: 0 });
  const [lupaVisible, setLupaVisible] = useState(false);
  const LUPA_ZOOM = 2.6;
  const LUPA_DIAMETRO = 180;
  const imgWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLupaVisible(false);
  }, [imagenActiva]);

  const [visorIndex, setVisorIndex] = useState<Record<number, number>>({});
  const [qrModalExamenId, setQrModalExamenId] = useState<number | null>(null);

  // Edición de observaciones de un examen ya existente (ej. completar el
  // resultado del examen "Pendiente" que se creó junto con la solicitud).
  const [obsDrafts, setObsDrafts] = useState<Record<number, string>>({});
  const [guardandoObsId, setGuardandoObsId] = useState<number | null>(null);

  const nombrePacienteCompleto = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : '';

  useEffect(() => {
    let isMounted = true;
    const urlsCreadas: string[] = [];

    const cargar = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getRegistroClinicoCompleto(registroId);
        if (!isMounted) return;
        setDetalle(data);

        const nuevaGaleria: GaleriaPorExamen = {};
        for (const examen of data.examenes_complementarios) {
          const archivos = await getArchivosPorExamen(examen.id);
          const conUrl = await Promise.all(
            archivos.map(async (archivo) => {
              const blob = await descargarArchivoBlob(archivo.id);
              const url = URL.createObjectURL(blob);
              urlsCreadas.push(url);
              return { archivo, url };
            }),
          );
          nuevaGaleria[examen.id] = conUrl;
        }
        if (isMounted) setGaleria(nuevaGaleria);
      } catch {
        if (isMounted) setError('No se pudo cargar el registro clínico completo.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void cargar();

    return () => {
      isMounted = false;
      urlsCreadas.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [registroId]);

  // Cerrar el lightbox con Escape, como se espera de cualquier visor.
  useEffect(() => {
    if (!imagenActiva) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagenActiva(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imagenActiva]);

  // Sigue el cursor (o el dedo) dentro del recuadro de la imagen y calcula
  // dónde debe apuntar la lupa, igual que en la demo.
  const moverLupa = (clientX: number, clientY: number) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - r.left, r.width));
    const y = Math.max(0, Math.min(clientY - r.top, r.height));
    setLupaPos({ x, y });
    setLupaVisible(true);
  };

  const obsValor = (examen: { id: number; observaciones?: string | null }): string =>
    obsDrafts[examen.id] ?? examen.observaciones ?? '';

  const handleGuardarObs = async (examenId: number) => {
    const texto = obsDrafts[examenId] ?? '';
    setGuardandoObsId(examenId);
    try {
      const actualizado = await updateObservacionesExamen(examenId, texto);
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              examenes_complementarios: prev.examenes_complementarios.map((e) =>
                e.id === examenId ? { ...e, observaciones: actualizado.observaciones } : e,
              ),
            }
          : prev,
      );
      setObsDrafts((d) => {
        const { [examenId]: _quitado, ...resto } = d;
        return resto;
      });
    } catch {
      // El input se queda con lo que el médico tipeó para que no lo pierda;
      // puede reintentar tocando "Guardar" de nuevo.
    } finally {
      setGuardandoObsId(null);
    }
  };

  const registro = detalle?.registro ?? null;

  // ---- Signos vitales derivados, solo cuando hay registro cargado ----
  const vitales = useMemo(() => {
    if (!registro) return null;

    const fc = parseNum(registro.frecuencia_cardiaca);
    const fr = parseNum(registro.frecuencia_respiratoria);
    const spo2 = parseNum(registro.saturacion_oxigeno);
    const temp = parseNum(registro.temperatura);
    const glicemia = parseNum(registro.glicemia);
    const peso = parseNum(registro.peso);
    const talla = parseNum(registro.talla);
    const imc = peso && talla && talla > 0 ? peso / (talla * talla) : null;

    const [sistolica, diastolica] = (registro.presion_arterial || '')
      .split('/')
      .map((p) => parseNum(p.trim()));

    return { fc, fr, spo2, temp, glicemia, peso, talla, imc, sistolica, diastolica };
  }, [registro]);

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <FontAwesomeIcon icon={faSpinner} spin /> <p>Cargando registro clínico...</p>
      </div>
    );
  }

  if (error || !detalle || !registro || !vitales) {
    return (
      <div className={styles.emptyState}>
        <FontAwesomeIcon icon={faExclamationCircle} /> <p>{error || 'Sin datos'}</p>
      </div>
    );
  }

  const { examenes_complementarios, recetas, seguimientos_control } = detalle;

  // Agrupa las recetas: las de la consulta inicial (sin seguimiento_control_id)
  // y las de cada seguimiento, por su id.
  const recetasIniciales = recetas.filter((r) => !r.seguimiento_control_id);
  const recetasPorSeguimiento = new Map<number, Receta[]>();
  recetas.forEach((r) => {
    if (r.seguimiento_control_id) {
      const lista = recetasPorSeguimiento.get(r.seguimiento_control_id) || [];
      lista.push(r);
      recetasPorSeguimiento.set(r.seguimiento_control_id, lista);
    }
  });

  // Pinta una receta completa (medicamentos + fórmulas + exámenes pedidos).
  // `fechaContexto` es la fecha de la consulta inicial o del seguimiento al
  // que pertenece esta receta, usada para armar el mensaje de WhatsApp.
  const renderReceta = (receta: Receta, fechaContexto: string) => (
    <div key={receta.id} className={styles.recetaCard}>
      {paciente?.telefono && (
        <div className={styles.recetaHeadRow}>
          <a
            className={styles.whatsappBtn}
            href={buildWhatsAppUrl(
              paciente.telefono,
              mensajeReceta(nombrePacienteCompleto, formatFechaLabel(fechaContexto), receta)
            )}
            target="_blank"
            rel="noopener noreferrer"
            title="Enviar receta por WhatsApp"
          >
            <FontAwesomeIcon icon={faWhatsapp} /> Enviar por WhatsApp
          </a>
        </div>
      )}

      {receta.indicaciones_generales && (
        <p className={styles.indicaciones}>{receta.indicaciones_generales}</p>
      )}

      {receta.medicamentos.length > 0 && (
        <div className={styles.bloqueReceta}>
          <span className={styles.bloqueLabel}>Medicamentos</span>
          {receta.medicamentos.map((m) => (
            <div key={m.id} className={styles.itemReceta}>
              <b>{m.medicamento}</b> — {m.dosis}
              {m.via_administracion && ` · ${m.via_administracion}`}
              {m.frecuencia && ` · ${m.frecuencia}`}
              {m.duracion && ` · ${m.duracion}`}
              {m.indicaciones && <div className={styles.itemIndicaciones}>{m.indicaciones}</div>}
            </div>
          ))}
        </div>
      )}

      {receta.formulas_magistrales.length > 0 && (
        <div className={styles.bloqueReceta}>
          <span className={styles.bloqueLabel}>Fórmulas magistrales</span>
          {receta.formulas_magistrales.map((f) => (
            <div key={f.id} className={styles.itemReceta}>
              <b>{f.nombre_formula}</b>
              <div className={styles.itemIndicaciones}>{f.ingredientes}</div>
              {(f.forma_farmaceutica || f.via_administracion) && (
                <div className={styles.itemIndicaciones}>
                  {[f.forma_farmaceutica, f.cantidad_preparar, f.via_administracion].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {receta.examenes.length > 0 && (
        <div className={styles.bloqueReceta}>
          <span className={styles.bloqueLabel}>Exámenes solicitados</span>
          {receta.examenes.map((e) => (
            <div key={e.id} className={styles.itemReceta}>
              <b>{e.nombre_examen}</b>
              {e.urgencia === 'Urgente' && <span className={styles.tagUrgente}>Urgente</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Un "gauge" circular reutilizable para la franja de signos vitales.
  const renderGauge = (
    value: number | null,
    unit: string,
    label: string,
    rango: { min: number; max: number; bajo: number; alto: number },
  ) => {
    const warn = value !== null && fueraDeRango(value, rango);
    const offset = value !== null ? gaugeOffset(value, rango.min, rango.max) : GAUGE_CIRC;
    return (
      <div className={`${styles.gaugeTile} ${warn ? styles.warn : ''}`}>
        <div className={styles.gaugeWrap}>
          <svg viewBox="0 0 80 80" width="70" height="70">
            <circle className={styles.gaugeTrack} cx="40" cy="40" r={GAUGE_R} />
            <circle
              className={styles.gaugeValue}
              cx="40"
              cy="40"
              r={GAUGE_R}
              strokeDasharray={GAUGE_CIRC}
              strokeDashoffset={offset}
            />
          </svg>
          <div className={styles.gaugeCenter}>
            <span className={styles.gaugeNum}>{value !== null ? value : '—'}</span>
            <span className={styles.gaugeUnit}>{unit}</span>
          </div>
        </div>
        <span className={styles.gaugeLabel}>{label}</span>
      </div>
    );
  };

  const cambiarVisor = (examenId: number, idx: number) => {
    setVisorIndex((prev) => ({ ...prev, [examenId]: idx }));
  };

  /** Refresca solo la galería de un examen (llamado cuando llegan fotos nuevas por QR). */
  const recargarGaleriaDeExamen = async (examenId: number) => {
    const archivos = await getArchivosPorExamen(examenId);
    const conUrl = await Promise.all(
      archivos.map(async (archivo) => {
        const blob = await descargarArchivoBlob(archivo.id);
        return { archivo, url: URL.createObjectURL(blob) };
      }),
    );
    setGaleria((prev) => {
      (prev[examenId] || []).forEach(({ url }) => URL.revokeObjectURL(url));
      return { ...prev, [examenId]: conUrl };
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.hud}>
        <div className={styles.corners}>
          <span className={styles.cTl} />
          <span className={styles.cTr} />
          <span className={styles.cBl} />
          <span className={styles.cBr} />
        </div>

        <div className={styles.topbar}>
          <span className={styles.regId}>
            REG <span className={styles.sep}>/</span> #{String(registro.id).padStart(5, '0')}{' '}
            <span className={styles.sep}>/</span> HISTORIA #{registro.historia_clinica_id}
          </span>
          <span className={styles.liveBadge}>
            <span className={styles.pulseDot} /> Registro clínico
          </span>
        </div>

        {/* ---- Encabezado + signos vitales ---- */}
        <section className={styles.section}>
          <div className={styles.headline}>
            <span className={styles.headlineTitle}>{registro.diagnostico || 'Consulta clínica'}</span>
            <time className={styles.headlineFecha}>{registro.fecha} · {registro.hora}</time>
          </div>
          {registro.motivo_consulta && <p className={styles.motivo}>{registro.motivo_consulta}</p>}

          <div className={styles.eyebrow}><FontAwesomeIcon icon={faWaveSquare} /> Signos vitales</div>
          <div className={styles.vitalsGrid}>
            <div className={styles.paTile}>
              <div className={styles.paHead}>
                <span className={styles.gaugeLabel}>Presión arterial</span>
                <span className={styles.gaugeNum}>{registro.presion_arterial || '—'}</span>
              </div>
              <div className={styles.paBars}>
                <div className={styles.paBar}>
                  <i style={{ width: `${vitales.sistolica ? Math.min((vitales.sistolica / 200) * 100, 100) : 0}%` }} />
                </div>
                <div className={styles.paBar}>
                  <i style={{ width: `${vitales.diastolica ? Math.min((vitales.diastolica / 120) * 100, 100) : 0}%` }} />
                </div>
              </div>
            </div>

            {renderGauge(vitales.fc, 'bpm', 'Frec. cardíaca', RANGOS.fc)}
            {renderGauge(vitales.fr, 'rpm', 'Frec. respiratoria', RANGOS.fr)}
            {renderGauge(vitales.spo2, '% SpO2', 'Saturación O2', RANGOS.spo2)}
            {renderGauge(vitales.temp, '°C', 'Temperatura', RANGOS.temp)}
            {renderGauge(vitales.glicemia, 'mg/dL', 'Glicemia', RANGOS.glicemia)}
          </div>

          <div className={styles.bioStrip}>
            <div className={styles.bioCell}>
              <div className={styles.val}>{vitales.peso !== null ? `${vitales.peso} kg` : '—'}</div>
              <div className={styles.lab}>Peso</div>
            </div>
            <div className={styles.bioCell}>
              <div className={styles.val}>{vitales.talla !== null ? `${vitales.talla} m` : '—'}</div>
              <div className={styles.lab}>Talla</div>
            </div>
            <div className={styles.bioCell}>
              <div className={styles.val}>{vitales.imc !== null ? vitales.imc.toFixed(1) : '—'}</div>
              <div className={styles.lab}>IMC</div>
            </div>
          </div>

          <div className={styles.eyebrow}><FontAwesomeIcon icon={faNotesMedical} /> Notas clínicas</div>
          <div className={styles.notesGrid}>
            {registro.alergias && (
              <div className={`${styles.noteCard} ${styles.alerta}`}>
                <div className={styles.noteHead}><FontAwesomeIcon icon={faTriangleExclamation} /> Alergias</div>
                <div className={styles.noteBody}>{registro.alergias}</div>
              </div>
            )}
            {registro.examen_fisico && (
              <div className={styles.noteCard}>
                <div className={styles.noteHead}><FontAwesomeIcon icon={faStethoscope} /> Examen físico</div>
                <div className={styles.noteBody}>{registro.examen_fisico}</div>
              </div>
            )}
            {registro.enfermedad_actual && (
              <div className={styles.noteCard}>
                <div className={styles.noteHead}><FontAwesomeIcon icon={faPen} /> Enfermedad actual</div>
                <div className={styles.noteBody}>{registro.enfermedad_actual}</div>
              </div>
            )}
            <div className={styles.noteCard}>
              <div className={styles.noteHead}><FontAwesomeIcon icon={faCapsules} /> Tratamiento</div>
              <div className={styles.noteBody}>{registro.tratamiento || '—'}</div>
            </div>
            <div className={styles.noteCard}>
              <div className={styles.noteHead}><FontAwesomeIcon icon={faCalendarCheck} /> Consulta control</div>
              <div className={styles.noteBody}>{registro.consulta_control || '—'}</div>
            </div>
            {registro.observaciones && (
              <div className={styles.noteCard}>
                <div className={styles.noteHead}><FontAwesomeIcon icon={faPen} /> Observaciones</div>
                <div className={styles.noteBody}>{registro.observaciones}</div>
              </div>
            )}
            {registro.hallazgos_ecograficos && (
              <div className={styles.noteCard}>
                <div className={styles.noteHead}><FontAwesomeIcon icon={faStethoscope} /> Hallazgos ecográficos</div>
                <div className={styles.noteBody}>{registro.hallazgos_ecograficos}</div>
              </div>
            )}
          </div>
        </section>

        {/* ---- Exámenes complementarios: visor tipo carrete ---- */}
        <section className={styles.section}>
          <div className={styles.eyebrow}><FontAwesomeIcon icon={faFlaskVial} /> Exámenes complementarios</div>
          {examenes_complementarios.length === 0 && <p className={styles.vacio}>Sin exámenes registrados.</p>}
          {examenes_complementarios.map((examen) => {
            const imagenes = galeria[examen.id] || [];
            const idxActivo = visorIndex[examen.id] ?? 0;
            const activa = imagenes[idxActivo];
            const esPendiente =
              examen.receta_examen_id != null &&
              !examen.resultado &&
              !examen.observaciones &&
              imagenes.length === 0;
            const obsSucia = obsValor(examen) !== (examen.observaciones || '');

            return (
              <div key={examen.id} className={styles.examCard}>
                <div className={styles.examHead}>
                  <div className={styles.examHeadInfo}>
                    <span className={styles.examNombre}>{examen.nombre_examen}</span>
                    {examen.categoria?.nombre && (
                      <span className={styles.examCategoria}>{examen.categoria.nombre}</span>
                    )}
                    {esPendiente && <span className={styles.examPendiente}>Pendiente</span>}
                  </div>
                  <button
                    type="button"
                    className={styles.btnAgregarFotos}
                    onClick={() => setQrModalExamenId(examen.id)}
                  >
                    <FontAwesomeIcon icon={faCamera} /> Agregar fotografías
                  </button>
                </div>
                {examen.resultado && <p className={styles.examResultado}>{examen.resultado}</p>}

                <div className={styles.examObsEdit}>
                  <textarea
                    className={styles.examObsInput}
                    rows={2}
                    placeholder="Observaciones del médico..."
                    value={obsValor(examen)}
                    onChange={(e) =>
                      setObsDrafts((d) => ({ ...d, [examen.id]: e.target.value }))
                    }
                  />
                  {obsSucia && (
                    <button
                      type="button"
                      className={styles.btnGuardarObs}
                      disabled={guardandoObsId === examen.id}
                      onClick={() => handleGuardarObs(examen.id)}
                    >
                      {guardandoObsId === examen.id ? 'Guardando...' : 'Guardar'}
                    </button>
                  )}
                </div>

                {imagenes.length > 0 && activa && (
                  <div className={styles.visor}>
                    <button
                      type="button"
                      className={styles.visorMain}
                      onClick={() =>
                        setImagenActiva({
                          archivo: activa.archivo,
                          url: activa.url,
                          examenNombre: examen.nombre_examen,
                        })
                      }
                    >
                      <img src={activa.url} alt={activa.archivo.nombre_archivo} />
                      {imagenes.length > 1 && (
                        <span className={styles.visorBadge}>{idxActivo + 1} / {imagenes.length}</span>
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        className={styles.visorExpand}
                        aria-label="Ver en pantalla completa"
                        onClick={(e) => {
                          e.stopPropagation();
                          setImagenActiva({
                            archivo: activa.archivo,
                            url: activa.url,
                            examenNombre: examen.nombre_examen,
                          });
                        }}
                      >
                        <FontAwesomeIcon icon={faExpand} />
                      </span>
                    </button>

                    {imagenes.length > 1 && (
                      <div className={styles.visorThumbs}>
                        {imagenes.map(({ archivo, url }, idx) => (
                          <button
                            key={archivo.id}
                            type="button"
                            className={`${styles.visorThumb} ${idx === idxActivo ? styles.active : ''}`}
                            onClick={() => cambiarVisor(examen.id, idx)}
                          >
                            <img src={url} alt={archivo.nombre_archivo} loading="lazy" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ---- Receta de la consulta inicial ---- */}
        <section className={styles.section}>
          <div className={styles.eyebrow}><FontAwesomeIcon icon={faPills} /> Receta inicial</div>
          {recetasIniciales.length === 0
            ? <p className={styles.vacio}>Sin receta en la consulta inicial.</p>
            : recetasIniciales.map((r) => renderReceta(r, registro.fecha))}
        </section>

        {/* ---- Línea de tiempo de seguimientos, cada uno con su propia receta ---- */}
        <section className={styles.section}>
          <div className={styles.eyebrow}><FontAwesomeIcon icon={faCalendarCheck} /> Seguimientos de control</div>
          {seguimientos_control.length === 0 && <p className={styles.vacio}>Sin seguimientos registrados todavía.</p>}
          {seguimientos_control.map((s) => (
            <div key={s.id} className={styles.seguimientoCard}>
              <div className={styles.seguimientoHead}>
                <b>{s.fecha}</b>
                {s.proxima_fecha_control && (
                  <span>
                    Próximo: {s.proxima_fecha_control}
                    {s.hora_inicio && ` · ${s.hora_inicio.slice(0, 5)}`}
                    {s.hora_fin && ` a ${s.hora_fin.slice(0, 5)}`}
                  </span>
                )}
              </div>
              <p>{s.evolucion}</p>
              {(recetasPorSeguimiento.get(s.id) || []).map((r) => renderReceta(r, s.fecha))}
            </div>
          ))}
        </section>
      </div>

      {/* ---- Lightbox: la imagen del examen a pantalla completa ----
         Portal a <body>: si se renderiza en su lugar normal, queda anidado
         dentro del drawer de VerPaciente.tsx (.backdrop con backdrop-filter +
         .backdropContentWide con overflow:auto), y esos dos combinados hacen
         que "position: fixed" deje de tomar el viewport real como referencia
         y el lightbox aparezca recortado/pegado arriba en vez de a pantalla
         completa. Sacándolo a <body> con un portal, igual que ya hace
         Receta.tsx con su área de impresión, se evita el problema de raíz. */}
      {imagenActiva &&
        createPortal(
          <div
            className={styles.lightboxOverlay}
            onClick={() => setImagenActiva(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className={styles.lightboxClose}
              onClick={() => setImagenActiva(null)}
              aria-label="Cerrar"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <div
              ref={imgWrapRef}
              className={styles.lightboxImgWrap}
              onClick={(e) => e.stopPropagation()}
              onMouseMove={(e) => moverLupa(e.clientX, e.clientY)}
              onMouseLeave={() => setLupaVisible(false)}
              onTouchStart={(e) => {
                if (e.touches.length === 1) moverLupa(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 1) moverLupa(e.touches[0].clientX, e.touches[0].clientY);
              }}
              onTouchEnd={() => setLupaVisible(false)}
            >
              <img
                src={imagenActiva.url}
                alt={imagenActiva.archivo.nombre_archivo}
                className={styles.lightboxImg}
                draggable={false}
              />
              {lupaVisible && (
                <div
                  className={styles.lightboxLupa}
                  style={{
                    width: LUPA_DIAMETRO,
                    height: LUPA_DIAMETRO,
                    left: lupaPos.x - LUPA_DIAMETRO / 2,
                    top: lupaPos.y - LUPA_DIAMETRO / 2,
                    backgroundImage: `url(${imagenActiva.url})`,
                    backgroundSize: imgWrapRef.current
                      ? `${imgWrapRef.current.clientWidth * LUPA_ZOOM}px ${imgWrapRef.current.clientHeight * LUPA_ZOOM}px`
                      : undefined,
                    backgroundPosition: `${-(lupaPos.x * LUPA_ZOOM - LUPA_DIAMETRO / 2)}px ${-(lupaPos.y * LUPA_ZOOM - LUPA_DIAMETRO / 2)}px`,
                  }}
                />
              )}
            </div>
            <div className={styles.lightboxCaption} onClick={(e) => e.stopPropagation()}>
              <span>{imagenActiva.examenNombre}</span>
              <a
                href={imagenActiva.url}
                download={imagenActiva.archivo.nombre_archivo}
                className={styles.lightboxDownload}
              >
                <FontAwesomeIcon icon={faDownload} /> Descargar
              </a>
            </div>
          </div>,
          document.body,
        )}

      {/* Mismo motivo que el lightbox de arriba: portal a <body> para que el
         modal del QR quede realmente por encima de todo, y no atrapado
         dentro del drawer. */}
      {qrModalExamenId !== null &&
        createPortal(
          <CapturaQrModal
            destino={{ tipo: 'examen', id: qrModalExamenId }}
            examenNombre={
              examenes_complementarios.find((e) => e.id === qrModalExamenId)?.nombre_examen || ''
            }
            onClose={() => setQrModalExamenId(null)}
            onFotosActualizadas={() => recargarGaleriaDeExamen(qrModalExamenId)}
          />,
          document.body,
        )}
    </div>
  );
};

export default RegistroClinicoDetalle;