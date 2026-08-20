import React, { useEffect, useMemo, useState } from 'react';
import { getRegistroClinicoCompleto } from '../../api/historialClinico';
import type { RegistroClinicoCompletoDetalle } from '../../api/historialClinico';
import type { Receta } from '../../api/recetas';
import { getArchivosPorExamen, descargarArchivoBlob } from '../../api/archivos';
import type { ArchivoResponse } from '../../api/archivos';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSpinner, faExclamationCircle, faFlaskVial, faPills,
  faCalendarCheck, faDownload, faXmark, faExpand, faWaveSquare,
  faNotesMedical, faTriangleExclamation, faStethoscope, faPen,
  faCapsules,
} from '@fortawesome/free-solid-svg-icons';
import styles from './RegistroClinicoDetalle.module.css';

interface Props {
  registroId: number;
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

const RegistroClinicoDetalle: React.FC<Props> = ({ registroId }) => {
  const [detalle, setDetalle] = useState<RegistroClinicoCompletoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galeria, setGaleria] = useState<GaleriaPorExamen>({});
  const [imagenActiva, setImagenActiva] = useState<ImagenActiva | null>(null);
  const [visorIndex, setVisorIndex] = useState<Record<number, number>>({});

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
  const renderReceta = (receta: Receta) => (
    <div key={receta.id} className={styles.recetaCard}>
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

            return (
              <div key={examen.id} className={styles.examCard}>
                <div className={styles.examHead}>
                  <span className={styles.examNombre}>{examen.nombre_examen}</span>
                  {examen.categoria?.nombre && (
                    <span className={styles.examCategoria}>{examen.categoria.nombre}</span>
                  )}
                </div>
                {examen.resultado && <p className={styles.examResultado}>{examen.resultado}</p>}
                {examen.observaciones && <p className={styles.examObs}>{examen.observaciones}</p>}

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
            : recetasIniciales.map(renderReceta)}
        </section>

        {/* ---- Línea de tiempo de seguimientos, cada uno con su propia receta ---- */}
        <section className={styles.section}>
          <div className={styles.eyebrow}><FontAwesomeIcon icon={faCalendarCheck} /> Seguimientos de control</div>
          {seguimientos_control.length === 0 && <p className={styles.vacio}>Sin seguimientos registrados todavía.</p>}
          {seguimientos_control.map((s) => (
            <div key={s.id} className={styles.seguimientoCard}>
              <div className={styles.seguimientoHead}>
                <b>{s.fecha}</b>
                {s.proxima_fecha_control && <span>Próximo: {s.proxima_fecha_control}</span>}
              </div>
              <p>{s.evolucion}</p>
              {(recetasPorSeguimiento.get(s.id) || []).map(renderReceta)}
            </div>
          ))}
        </section>
      </div>

      {/* ---- Lightbox: la imagen del examen a pantalla completa ---- */}
      {imagenActiva && (
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
          <img
            src={imagenActiva.url}
            alt={imagenActiva.archivo.nombre_archivo}
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
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
        </div>
      )}
    </div>
  );
};

export default RegistroClinicoDetalle;