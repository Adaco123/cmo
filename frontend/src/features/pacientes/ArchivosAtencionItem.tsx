import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  descargarArchivoBlob,
  descargarArchivoComoAdjunto,
  eliminarArchivo,
  type ArchivoResponse,
} from '../../api/archivos';
import { crearRecetasConsulta, type Receta as RecetaGuardada, type RecetasPayload } from '../../api/recetas';
import type { Paciente } from '../../api/pacientes';
import { useAuth } from '../../components/AuthProvider';
import { nombreCompleto } from '../../auth';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../utils/errors';
import Receta from './Receta';
import type { RecetaHandle } from './Receta';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faDownload,
  faEllipsisVertical,
  faExpand,
  faFileImage,
  faFilePdf,
  faFilePrescription,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
// Tarjeta del timeline: mismos estilos que las tarjetas de registro clínico.
import timeline from './VerPaciente.module.css';
// Lista de archivos y visor: mismos estilos que la ficha de pacientes externos.
import styles from './PacienteExterno.module.css';

const esPdf = (nombre: string) => nombre.toLowerCase().endsWith('.pdf');

// Lupa del lightbox: mismos valores que PacienteExterno.tsx y RegistroClinicoDetalle.tsx.
const LUPA_ZOOM = 2.6;
const LUPA_DIAMETRO = 180;

function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  const fecha = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  const hora = d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${fecha} · ${hora}`;
}

interface Props {
  /** Consulta (atención) a la que pertenecen los archivos y las recetas. */
  consultaId: number;
  paciente: Paciente;
  alergias: string[];
  archivos: ArchivoResponse[];
  /** Recetas ya guardadas en esta atención. */
  recetas: RecetaGuardada[];
  /** Fecha ISO de la atención (la del archivo o receta más reciente del grupo). */
  fecha: string;
  /** Se llama tras eliminar un archivo para que el padre lo saque de su lista. */
  onEliminado: (archivoId: number) => void;
  /** Se llama con las recetas recién guardadas para que el padre las agregue a su lista. */
  onRecetasCreadas: (recetas: RecetaGuardada[]) => void;
}

/**
 * Tarjeta del historial clínico para una atención sin registro clínico:
 * archivos adjuntos (PDF/JPG/PNG subidos con "Subir archivos") y, si el
 * médico las pone, recetas. Se muestra mezclada en el timeline por fecha,
 * junto a las consultas con registro clínico. Al abrirla, descarga las
 * miniaturas de sus imágenes (no antes, para no bajar todas las fotos del
 * paciente al abrir la ficha).
 */
const ArchivosAtencionItem: React.FC<Props> = ({
  consultaId, paciente, alergias, archivos, recetas, fecha, onEliminado, onRecetasCreadas,
}) => {
  const { showError, showSuccess, confirm } = useErrorToast();
  const { user } = useAuth();
  const [expandido, setExpandido] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null);

  // Miniaturas (solo imágenes), descargadas al expandir la tarjeta.
  const [miniaturas, setMiniaturas] = useState<Record<number, string>>({});
  const urlsRef = useRef<string[]>([]);

  // Visor: PDF en drawer lateral, imagen en lightbox.
  const [visor, setVisor] = useState<{ archivo: ArchivoResponse; url: string } | null>(null);
  const [cargandoVisor, setCargandoVisor] = useState(false);

  // Receta: el panel (Receta.tsx) solo se monta la primera vez que se pide,
  // para no cargar uno por cada tarjeta del historial; después se queda
  // montado, así el borrador no se pierde al cerrar el panel.
  const recetaRef = useRef<RecetaHandle>(null);
  const [recetaMontada, setRecetaMontada] = useState(false);
  const [recetaAbierta, setRecetaAbierta] = useState(false);
  const [tieneBorrador, setTieneBorrador] = useState(false);
  const [guardandoReceta, setGuardandoReceta] = useState(false);

  const abrirReceta = () => {
    setExpandido(true);
    setRecetaMontada(true);
    setRecetaAbierta(true);
  };

  const cerrarReceta = () => {
    setRecetaAbierta(false);
    setTieneBorrador(!!recetaRef.current?.getPayload());
  };

  const guardarReceta = async () => {
    const payload = recetaRef.current?.getPayload();
    if (!payload) {
      setTieneBorrador(false);
      showError('La receta está vacía: agrega al menos un medicamento, examen o fórmula.');
      return;
    }
    setGuardandoReceta(true);
    try {
      const nuevas = await crearRecetasConsulta(consultaId, payload as RecetasPayload);
      onRecetasCreadas(nuevas);
      recetaRef.current?.reset();
      setTieneBorrador(false);
      showSuccess(nuevas.length === 1 ? 'Receta guardada correctamente' : `${nuevas.length} recetas guardadas correctamente`);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, 'No se pudo guardar la receta.'));
    } finally {
      setGuardandoReceta(false);
    }
  };

  const descartarBorrador = async () => {
    const aceptar = await confirm('¿Descartar la receta sin guardar?', {
      textoAceptar: 'Descartar',
      textoCancelar: 'Cancelar',
    });
    if (!aceptar) return;
    recetaRef.current?.reset();
    setTieneBorrador(false);
  };

  // Lupa dentro del lightbox: mover el mouse (o el dedo) sobre la imagen
  // amplía la zona bajo el cursor, sin perder de vista la foto completa.
  const [lupaPos, setLupaPos] = useState({ x: 0, y: 0, wrapW: 0, wrapH: 0 });
  const [lupaVisible, setLupaVisible] = useState(false);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);

  const moverLupa = (clientX: number, clientY: number) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - r.left, r.width));
    const y = Math.max(0, Math.min(clientY - r.top, r.height));
    setLupaPos({ x, y, wrapW: r.width, wrapH: r.height });
    setLupaVisible(true);
  };

  // Libera todas las URLs de blob al desmontar.
  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, []);

  // Descarga las miniaturas de las imágenes que aún no tengan, al expandir.
  useEffect(() => {
    if (!expandido) return;
    let cancelado = false;
    (async () => {
      for (const a of archivos) {
        if (esPdf(a.nombre_archivo) || miniaturas[a.id]) continue;
        try {
          const blob = await descargarArchivoBlob(a.id);
          if (cancelado) return;
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          setMiniaturas((prev) => ({ ...prev, [a.id]: url }));
        } catch {
          // Sin miniatura: la fila igual se puede abrir y descargar.
        }
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandido, archivos]);

  const abrirArchivo = useCallback(async (archivo: ArchivoResponse) => {
    setMenuAbiertoId(null);
    setLupaVisible(false);
    if (!esPdf(archivo.nombre_archivo) && miniaturas[archivo.id]) {
      setVisor({ archivo, url: miniaturas[archivo.id] });
      return;
    }
    try {
      setCargandoVisor(true);
      const blob = await descargarArchivoBlob(archivo.id);
      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);
      setVisor({ archivo, url });
    } catch {
      showError('No se pudo abrir el archivo.');
    } finally {
      setCargandoVisor(false);
    }
  }, [miniaturas, showError]);

  const cerrarVisor = useCallback(() => setVisor(null), []);

  // Escape cierra el visor.
  useEffect(() => {
    if (!visor) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisor(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visor]);

  const descargar = useCallback(async (a: ArchivoResponse) => {
    setMenuAbiertoId(null);
    try {
      await descargarArchivoComoAdjunto(a.id, a.nombre_archivo);
    } catch {
      showError('No se pudo descargar el archivo.');
    }
  }, [showError]);

  const eliminar = useCallback(async (a: ArchivoResponse) => {
    setMenuAbiertoId(null);
    const aceptar = await confirm(
      `¿Eliminar el archivo "${a.nombre_archivo}"? Esta acción no se puede deshacer.`,
      { textoAceptar: 'Aceptar', textoCancelar: 'Cancelar' },
    );
    if (!aceptar) return;
    try {
      await eliminarArchivo(a.id);
      onEliminado(a.id);
      showSuccess('Archivo eliminado correctamente');
    } catch (err: unknown) {
      showError(extractErrorMessage(err, 'No se pudo eliminar el archivo.'));
    }
  }, [confirm, onEliminado, showError, showSuccess]);

  const cantidad = archivos.length;
  const resumen = [
    cantidad > 0 ? `${cantidad} ${cantidad === 1 ? 'archivo' : 'archivos'}` : null,
    recetas.length > 0 ? `${recetas.length} ${recetas.length === 1 ? 'receta' : 'recetas'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={timeline.timelineItem}>
      <div className={timeline.timelineRail}>
        <div className={`${timeline.dot} ${expandido ? timeline.dotActive : ''}`} />
        <div className={timeline.railLine} />
      </div>

      <div className={`${timeline.card} ${expandido ? timeline.cardExpanded : ''}`}>
        <div className={timeline.cardHead} onClick={() => setExpandido((v) => !v)}>
          <div className={timeline.cardHeadMain}>
            <span className={timeline.cardFecha}>{formatearFechaHora(fecha)}</span>
            <span className={timeline.cardTitulo}>{cantidad > 0 ? 'Archivos adjuntos' : 'Receta'}</span>
            {resumen && <span className={timeline.cardSub}>{resumen}</span>}
          </div>
          <div className={timeline.cardHeadActions}>
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`${timeline.chevron} ${expandido ? timeline.chevronOpen : ''}`}
            />
          </div>
        </div>

        {expandido && (
          <div className={timeline.cardBody} onClick={() => setMenuAbiertoId(null)}>
            {cantidad > 0 && (
            <ul className={styles.listaArchivos}>
              {archivos.map((a) => (
                <li key={a.id}>
                  <button type="button" className={styles.archivoRowBtn} onClick={() => void abrirArchivo(a)}>
                    {esPdf(a.nombre_archivo) ? (
                      <FontAwesomeIcon icon={faFilePdf} />
                    ) : miniaturas[a.id] ? (
                      <span className={styles.archivoThumbWrap}>
                        <img src={miniaturas[a.id]} alt={a.nombre_archivo} className={styles.archivoThumb} loading="lazy" />
                        <span className={styles.archivoThumbExpand}><FontAwesomeIcon icon={faExpand} /></span>
                      </span>
                    ) : (
                      <FontAwesomeIcon icon={faFileImage} />
                    )}
                    <span>{a.nombre_archivo}</span>
                  </button>

                  <div className={styles.archivoAcciones}>
                    <button
                      type="button"
                      className={styles.menuBtn}
                      onClick={(e) => { e.stopPropagation(); setMenuAbiertoId((p) => (p === a.id ? null : a.id)); }}
                      aria-label="Más acciones"
                    >
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                    {menuAbiertoId === a.id && (
                      <div className={styles.menuDropdown} onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => void descargar(a)}>
                          <FontAwesomeIcon icon={faDownload} /> Descargar
                        </button>
                        <button type="button" className={styles.menuDanger} onClick={() => void eliminar(a)}>
                          <FontAwesomeIcon icon={faTrash} /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            )}
            {cargandoVisor && <p className={styles.uploadingText}>Abriendo archivo...</p>}

            {/* ---- Recetas de esta atención ---- */}
            {recetas.length > 0 && (
              <div style={{ marginTop: cantidad > 0 ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recetas.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13,
                      display: 'flex', flexDirection: 'column', gap: 8,
                    }}
                  >
                    <b style={{ color: 'var(--accent)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      <FontAwesomeIcon icon={faFilePrescription} /> Receta
                    </b>
                    {r.indicaciones_generales && <p style={{ margin: 0, color: 'var(--text-muted)' }}>{r.indicaciones_generales}</p>}
                    {r.medicamentos.map((m) => (
                      <div key={`m${m.id}`}>
                        <b>{m.medicamento}</b> — {m.dosis}
                        {m.via_administracion && ` · ${m.via_administracion}`}
                        {m.frecuencia && ` · ${m.frecuencia}`}
                        {m.duracion && ` · ${m.duracion}`}
                        {m.indicaciones && <div style={{ color: 'var(--text-muted)' }}>{m.indicaciones}</div>}
                      </div>
                    ))}
                    {r.formulas_magistrales.map((f) => (
                      <div key={`f${f.id}`}>
                        <b>{f.nombre_formula}</b>
                        <div style={{ color: 'var(--text-muted)' }}>{f.ingredientes}</div>
                        {(f.forma_farmaceutica || f.via_administracion) && (
                          <div style={{ color: 'var(--text-muted)' }}>
                            {[f.forma_farmaceutica, f.cantidad_preparar, f.via_administracion].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    ))}
                    {r.examenes.map((e) => (
                      <div key={`e${e.id}`}>
                        <b>{e.nombre_examen}</b>{e.urgencia === 'Urgente' && ' · Urgente'}
                        <span style={{ color: 'var(--text-muted)' }}> (examen solicitado)</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Borrador sin guardar: el panel de receta ya se cerró pero aún no se guardó. */}
            {tieneBorrador && (
              <div
                style={{
                  marginTop: 14, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--accent-border)', background: 'var(--accent-bg)',
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13,
                }}
              >
                <span style={{ flex: 1, minWidth: 160, fontWeight: 600 }}>Receta sin guardar</span>
                <button type="button" className={styles.btnSecundario} onClick={abrirReceta} disabled={guardandoReceta}>
                  Editar
                </button>
                <button type="button" className={styles.btnSecundario} onClick={() => void descartarBorrador()} disabled={guardandoReceta}>
                  Descartar
                </button>
                <button type="button" className={styles.btnPrimario} onClick={() => void guardarReceta()} disabled={guardandoReceta}>
                  {guardandoReceta ? 'Guardando...' : 'Guardar receta'}
                </button>
              </div>
            )}

            {!tieneBorrador && (
              <div style={{ marginTop: cantidad > 0 || recetas.length > 0 ? 14 : 0 }}>
                <button type="button" className={styles.btnSecundario} onClick={abrirReceta}>
                  <FontAwesomeIcon icon={faFilePrescription} /> Recetar en esta atención
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel de receta: portal a <body> para que su capa fija cubra toda la
          pantalla y no dependa de la tarjeta. Mismo componente que usa el
          registro clínico, así que también permite imprimir. */}
      {recetaMontada &&
        createPortal(
          <Receta
            ref={recetaRef}
            isOpen={recetaAbierta}
            onClose={cerrarReceta}
            pacienteNombre={`${paciente.nombres} ${paciente.apellidos}`.trim()}
            pacienteEdad={paciente.edad != null ? String(paciente.edad) : '—'}
            pacienteCi={paciente.documento || '—'}
            alergias={alergias.join(', ')}
            medicoNombre={nombreCompleto(user)}
          />,
          document.body,
        )}

      {/* Portal a <body>: así "position: fixed" usa la pantalla completa y no
          queda recortado dentro de la ficha. */}
      {visor && esPdf(visor.archivo.nombre_archivo) &&
        createPortal(
          <div className={styles.backdrop} onClick={cerrarVisor}>
            <div className={styles.drawerRight} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.modalCloseBtn} onClick={cerrarVisor} aria-label="Cerrar">
                <FontAwesomeIcon icon={faXmark} />
              </button>
              <div className={styles.visorHead}>
                <FontAwesomeIcon icon={faFilePdf} />
                <span>{visor.archivo.nombre_archivo}</span>
              </div>
              <div className={styles.visorBody}>
                <iframe src={visor.url} title={visor.archivo.nombre_archivo} className={styles.visorFrame} />
              </div>
              <a href={visor.url} download={visor.archivo.nombre_archivo} className={styles.visorDescargar}>
                <FontAwesomeIcon icon={faDownload} /> Descargar
              </a>
            </div>
          </div>,
          document.body,
        )}

      {visor && !esPdf(visor.archivo.nombre_archivo) &&
        createPortal(
          <div className={styles.lightboxOverlay} onClick={cerrarVisor} role="dialog" aria-modal="true">
            <button type="button" className={styles.lightboxClose} onClick={cerrarVisor} aria-label="Cerrar">
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
              <img src={visor.url} alt={visor.archivo.nombre_archivo} className={styles.lightboxImg} draggable={false} />
              {lupaVisible && (
                <div
                  className={styles.lightboxLupa}
                  style={{
                    width: LUPA_DIAMETRO,
                    height: LUPA_DIAMETRO,
                    left: lupaPos.x - LUPA_DIAMETRO / 2,
                    top: lupaPos.y - LUPA_DIAMETRO / 2,
                    backgroundImage: `url(${visor.url})`,
                    backgroundSize: `${lupaPos.wrapW * LUPA_ZOOM}px ${lupaPos.wrapH * LUPA_ZOOM}px`,
                    backgroundPosition: `${-(lupaPos.x * LUPA_ZOOM - LUPA_DIAMETRO / 2)}px ${-(lupaPos.y * LUPA_ZOOM - LUPA_DIAMETRO / 2)}px`,
                  }}
                />
              )}
            </div>
            <div className={styles.lightboxCaption} onClick={(e) => e.stopPropagation()}>
              <span>{visor.archivo.nombre_archivo}</span>
              <a href={visor.url} download={visor.archivo.nombre_archivo} className={styles.lightboxDownload}>
                <FontAwesomeIcon icon={faDownload} /> Descargar
              </a>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ArchivosAtencionItem;