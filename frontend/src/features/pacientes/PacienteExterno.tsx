import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Paciente } from '../../api/pacientes';
import {
  descargarArchivoBlob,
  descartarSesionCaptura,
  eliminarArchivo as eliminarArchivoApi,
  getArchivosPorPaciente,
  crearAtencionExterna,
  subirArchivoAtencion,
  type ArchivoResponse,
} from '../../api/archivos';
import CapturaQrModal from './CapturaQrModal';
import { getTiposArchivo, type TipoArchivo } from '../../api/tiposarchivo';
import { extractErrorMessage } from '../../utils/errors';
import CrearCita from '../../components/CrearCita';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faCloudUploadAlt,
  faFilePdf,
  faFileImage,
  faTimes,
  faCalendarCheck,
  faFileMedicalAlt,
  faFloppyDisk,
  faDownload,
  faSpinner,
  faExclamationCircle,
  faEllipsisVertical,
  faTrash,
  faCamera,
  faExpand,
} from '@fortawesome/free-solid-svg-icons';
import styles from './PacienteExterno.module.css';

// Mismo criterio que RegistroClinico.tsx: el id real se resuelve contra
// el catálogo tipos_archivo cargado del backend, nunca hardcodeado (ver
// idTipoArchivoPorExt).
const NOMBRE_TIPO_ARCHIVO_POR_EXT: Record<string, string> = {
  jpg: 'Imagen',
  jpeg: 'Imagen',
  png: 'Imagen',
  pdf: 'PDF',
};

function idTipoArchivoPorExt(ext: string, lista: TipoArchivo[]): number {
  const nombreBuscado = NOMBRE_TIPO_ARCHIVO_POR_EXT[ext];
  return lista.find((t) => t.nombre === nombreBuscado)?.id ?? lista[0]?.id ?? 1;
}

const EXTENSIONES_VALIDAS = Object.keys(NOMBRE_TIPO_ARCHIVO_POR_EXT);

const esPdf = (nombreArchivo: string) => nombreArchivo.toLowerCase().endsWith('.pdf');

// Mismo helper que RegistroClinicoDetalle.tsx, para que la fecha de cada
// atención se vea igual en toda la app.
function formatFechaLabel(fecha: string): string {
  const soloFecha = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/)?.[0] ?? fecha;
  return new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${soloFecha}T00:00:00`),
  );
}

interface GrupoAtencion {
  /** Clave de React; agrupa por consulta_id (cada "Nueva atención" es una
   *  fila propia y nunca se reutiliza, así que un consulta_id = una visita). */
  key: string;
  fecha: string;
  archivos: ArchivoResponse[];
}

/** Agrupa la lista plana de archivos por atención (consulta_id), ordenada
 *  de la más reciente a la más antigua — cada grupo es una visita real. */
function agruparPorAtencion(archivos: ArchivoResponse[]): GrupoAtencion[] {
  const mapa = new Map<string, GrupoAtencion>();
  for (const archivo of archivos) {
    const key = archivo.consulta_id != null ? `atencion-${archivo.consulta_id}` : 'sin-atencion';
    let grupo = mapa.get(key);
    if (!grupo) {
      grupo = { key, fecha: archivo.created_at ?? '', archivos: [] };
      mapa.set(key, grupo);
    }
    grupo.archivos.push(archivo);
    if (archivo.created_at && archivo.created_at > grupo.fecha) grupo.fecha = archivo.created_at;
  }
  return Array.from(mapa.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

interface PacienteExternoProps {
  /** Paciente externo (origen='externo') ya seleccionado. La búsqueda y la
   *  creación de pacientes externos se hacen desde PacientesExternosTab
   *  y PacienteForm.tsx respectivamente; este componente solo muestra
   *  la ficha y sus archivos adjuntos. */
  paciente: Paciente;
  onClose?: () => void;
}

/** Archivo en espera de subirse, con un id local para poder quitarlo de la lista. */
interface ArchivoPendiente {
  localId: string;
  file: File;
}

interface ImagenActiva {
  archivo: ArchivoResponse;
  url: string;
}

/**
 * Modal de ficha para un paciente externo (origen='externo') ya seleccionado:
 * layout de dos columnas (ficha + acciones a la izquierda, archivos a la
 * derecha), con "Nueva atención" como modal centrado (crea explícitamente
 * una Consulta mínima —sin signos vitales ni observaciones— y sube los
 * archivos de esa tanda ligados a ella; nunca reutiliza una atención
 * anterior, ni siquiera del mismo día), "Crear cita" como modal
 * autocontenido (trae su propio backdrop). Los PDF se ven en un drawer
 * lateral que entra deslizando de derecha a izquierda (mismo patrón que
 * RegistroClinicoDetalle en VerPaciente); las imágenes se muestran como
 * miniatura ya cargada en la lista y, al hacer clic, abren el mismo
 * lightbox a pantalla completa con lupa de zoom que usa RegistroClinicoDetalle.
 * La lista de archivos se agrupa por atención (consulta_id) y se ordena de
 * la más reciente a la más antigua, cada grupo con su fecha como encabezado.
 * El menú "..." de cada archivo usa el mismo patrón que el timeline de
 * VerPaciente.tsx en vez de un botón de eliminar directo.
 */
const PacienteExterno: React.FC<PacienteExternoProps> = ({ paciente, onClose }) => {
  const [archivosSubidos, setArchivosSubidos] = useState<ArchivoResponse[]>([]);
  const [cargandoArchivos, setCargandoArchivos] = useState(true);
  const [archivosPendientes, setArchivosPendientes] = useState<ArchivoPendiente[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const [showCrearCita, setShowCrearCita] = useState(false);
  const [showAdjuntar, setShowAdjuntar] = useState(false);

  // Captura de fotos por QR: sesión TRANSITORIA en contexto del paciente,
  // mismo patrón que Examenes.tsx. Cada foto se descarga en cuanto llega y
  // entra a archivosPendientes como un File más — no queda ligada a nada en
  // el backend, se sube recién con "Guardar", igual que un archivo arrastrado
  // a mano (y así pasa por guardarPendientes, que crea la atención explícita).
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const qrSidActualRef = useRef<string | null>(null);

  // Menú "..." de cada archivo (Descargar / Eliminar), igual patrón que
  // el menú de 3 puntos de las tarjetas del timeline en VerPaciente.tsx.
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null);

  // ---- Visor de PDF (drawer lateral) ----
  const [archivoEnVisor, setArchivoEnVisor] = useState<ArchivoResponse | null>(null);
  const [visorUrl, setVisorUrl] = useState<string | null>(null);
  const [cargandoVisor, setCargandoVisor] = useState(false);
  const [errorVisor, setErrorVisor] = useState<string | null>(null);
  // Igual que en VerPaciente: primero se dispara la animación de salida
  // (cerrandoVisor = true) y solo al terminar se desmonta el drawer.
  const [cerrandoVisor, setCerrandoVisor] = useState(false);

  // ---- Galería de imágenes + lightbox (mismo patrón que RegistroClinicoDetalle.tsx) ----
  // Las imágenes (a diferencia de los PDF) se descargan todas de una vez al
  // cargar el paciente, para poder mostrar la miniatura ya lista en la lista
  // de archivos; recién al hacer clic sobre esa miniatura se abre el
  // lightbox a pantalla completa, y solo ahí funciona la lupa de zoom.
  const [galeria, setGaleria] = useState<Record<number, string>>({});
  const [imagenActiva, setImagenActiva] = useState<ImagenActiva | null>(null);
  const urlsGaleriaRef = useRef<string[]>([]);

  // Lupa dentro del lightbox: mover el mouse (o el dedo) sobre la imagen
  // amplía la zona bajo el cursor, sin perder de vista la foto completa.
  const [lupaPos, setLupaPos] = useState({ x: 0, y: 0, wrapW: 0, wrapH: 0 });
  const [lupaVisible, setLupaVisible] = useState(false);
  const LUPA_ZOOM = 2.6;
  const LUPA_DIAMETRO = 180;
  const imgWrapRef = useRef<HTMLDivElement | null>(null);

  const inputFileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Catálogo de tipos de archivo (para resolver el id por nombre al subir)
  const [tiposArchivo, setTiposArchivo] = useState<TipoArchivo[]>([]);
  useEffect(() => {
    getTiposArchivo()
      .then(setTiposArchivo)
      .catch((err:unknown) => console.error('No se pudo cargar el catálogo de tipos de archivo', err));
  }, []);

  // Carga los archivos ya subidos del paciente al montar (y de nuevo si
  // el modal se reutilizara para otro paciente sin desmontarse). Las
  // imágenes se descargan todas de una vez acá mismo (mismo patrón que la
  // galería de RegistroClinicoDetalle.tsx) para poder mostrar la miniatura
  // ya lista en la lista de archivos; mientras tanto se muestra "Cargando".
  useEffect(() => {
    let cancelado = false;
    const urlsCreadas: string[] = [];
    setArchivosSubidos([]);
    setArchivosPendientes([]);
    setErrorArchivo(null);
    setMenuAbiertoId(null);
    setGaleria({});
    setCargandoArchivos(true);
    (async () => {
      try {
        const archivos = await getArchivosPorPaciente(paciente.id);
        if (cancelado) return;
        setArchivosSubidos(archivos);

        const nuevaGaleria: Record<number, string> = {};
        for (const archivo of archivos) {
          if (esPdf(archivo.nombre_archivo)) continue;
          const blob = await descargarArchivoBlob(archivo.id);
          if (cancelado) return;
          const url = URL.createObjectURL(blob);
          urlsCreadas.push(url);
          nuevaGaleria[archivo.id] = url;
        }
        if (!cancelado) setGaleria(nuevaGaleria);
      } catch {
        // Si falla la carga de archivos previos igual se puede seguir subiendo.
      } finally {
        if (!cancelado) setCargandoArchivos(false);
      }
    })();
    urlsGaleriaRef.current = urlsCreadas;
    return () => {
      cancelado = true;
      urlsCreadas.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [paciente.id]);

  /** Agrega archivos elegidos (input o drag&drop) a la lista de pendientes, sin subirlos aún. */
  const agregarPendientes = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorArchivo(null);

    const nuevos: ArchivoPendiente[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!EXTENSIONES_VALIDAS.includes(ext)) {
        setErrorArchivo(`"${file.name}" no es un formato válido (solo PDF, JPG o PNG).`);
        continue;
      }
      nuevos.push({ localId: `${file.name}-${file.lastModified}-${file.size}`, file });
    }
    if (nuevos.length === 0) return;

    setArchivosPendientes((prev) => {
      const existentes = new Set(prev.map((p) => p.localId));
      const sinDuplicados = nuevos.filter((n) => !existentes.has(n.localId));
      return [...prev, ...sinDuplicados];
    });
  }, []);

  /** Se llama por cada foto nueva detectada en la sesión de captura QR: la
   *  descarga del servidor, la mete en la misma lista de pendientes que el
   *  drag-and-drop y borra la copia transitoria del servidor. */
  const handleFotoQrNueva = useCallback((archivoId: number) => {
    (async () => {
      try {
        const blob = await descargarArchivoBlob(archivoId);
        const file = new File([blob], `foto-qr-${archivoId}.jpg`, { type: blob.type || 'image/jpeg' });
        setArchivosPendientes((prev) => [...prev, { localId: `qr-${archivoId}`, file }]);
      } catch {
        setErrorArchivo('No se pudo importar una fotografía tomada por el celular.');
      } finally {
        eliminarArchivoApi(archivoId).catch(() => {
          // Best-effort: si no se pudo borrar la copia transitoria no
          // bloqueamos el flujo, mismo riesgo aceptado que en Examenes.tsx.
        });
      }
    })();
  }, []);

  const quitarPendiente = (localId: string) => {
    setArchivosPendientes((prev) => prev.filter((p) => p.localId !== localId));
  };

  /** Crea la atención (una sola vez) y sube todos los archivos pendientes
   *  ligados a ella (botón "Guardar"). A propósito NUNCA reutiliza una
   *  atención anterior, ni siquiera del mismo día — cada "Guardar" es una
   *  atención nueva y distinta. */
  const guardarPendientes = useCallback(async () => {
    if (archivosPendientes.length === 0) return;
    setErrorArchivo(null);
    setSubiendo(true);
    try {
      const atencion = await crearAtencionExterna(paciente.id);
      for (const pendiente of archivosPendientes) {
        const ext = pendiente.file.name.split('.').pop()?.toLowerCase() ?? '';
        const tipoArchivoId = idTipoArchivoPorExt(ext, tiposArchivo);
        const subido = await subirArchivoAtencion(atencion.id, pendiente.file, tipoArchivoId);
        setArchivosSubidos((prev) => [subido, ...prev]);
        if (!esPdf(pendiente.file.name)) {
          const url = URL.createObjectURL(pendiente.file);
          urlsGaleriaRef.current.push(url);
          setGaleria((prev) => ({ ...prev, [subido.id]: url }));
        }
      }
      setArchivosPendientes([]);
      setShowAdjuntar(false);
    } catch (error: unknown) {
      setErrorArchivo(extractErrorMessage(error, 'No se pudo registrar la atención.'));
    } finally {
      setSubiendo(false);
    }
  }, [paciente, archivosPendientes, tiposArchivo]);

  // Abre/cierra el menú "..." de un archivo puntual (mismo patrón que
  // toggleMenu en VerPaciente.tsx: stopPropagation + toggle por id).
  const toggleMenuArchivo = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAbiertoId((prev) => (prev === id ? null : id));
  }, []);

  const handleEliminarArchivo = async (archivoId: number) => {
    try {
      await eliminarArchivoApi(archivoId);
      setArchivosSubidos((prev) => prev.filter((a) => a.id !== archivoId));
      setGaleria((prev) => {
        if (!(archivoId in prev)) return prev;
        const resto = { ...prev };
        delete resto[archivoId];
        return resto;
      });
      setImagenActiva((prev) => (prev?.archivo.id === archivoId ? null : prev));
    } catch {
      setErrorArchivo('No se pudo eliminar el archivo.');
    } finally {
      setMenuAbiertoId(null);
    }
  };

  // Descarga directa desde el menú "...", reutilizando el mismo blob que
  // usa el visor lateral.
  const handleDescargarArchivo = useCallback(async (archivo: ArchivoResponse) => {
    setMenuAbiertoId(null);
    try {
      const blob = await descargarArchivoBlob(archivo.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = archivo.nombre_archivo;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorArchivo('No se pudo descargar el archivo.');
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.add(styles.drag);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove(styles.drag);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove(styles.drag);
    agregarPendientes(e.dataTransfer.files);
  };

  /** Cierra el modal del QR y descarta la sesión: cualquier foto que llegó
   *  pero no se alcanzó a bajar como pendiente (carrera con el polling) se
   *  borra del servidor para que no quede huérfana. */
  const cerrarModalQr = useCallback(() => {
    const sid = qrSidActualRef.current;
    qrSidActualRef.current = null;
    setQrModalOpen(false);
    if (sid) descartarSesionCaptura(sid).catch(() => {});
  }, []);

  const cerrarModalAdjuntar = () => {
    cerrarModalQr();
    setShowAdjuntar(false);
    setArchivosPendientes([]);
    setErrorArchivo(null);
  };

  // ---- Abrir/cerrar el visor de PDF (drawer derecho) ----
  const abrirVisorArchivo = useCallback(async (archivo: ArchivoResponse) => {
    setArchivoEnVisor(archivo);
    setCerrandoVisor(false);
    setErrorVisor(null);
    setVisorUrl(null);
    setCargandoVisor(true);
    try {
      const blob = await descargarArchivoBlob(archivo.id);
      const url = URL.createObjectURL(blob);
      setVisorUrl(url);
    } catch {
      setErrorVisor('No se pudo cargar el archivo.');
    } finally {
      setCargandoVisor(false);
    }
  }, []);

  // Dispara la animación de salida (derecha) y desmonta el drawer al
  // terminar. 280ms coincide con la duración de .drawerRightOut en el CSS.
  const cerrarVisorArchivo = useCallback(() => {
    setCerrandoVisor(true);
    window.setTimeout(() => {
      setArchivoEnVisor(null);
      setErrorVisor(null);
      setCargandoVisor(false);
      setCerrandoVisor(false);
    }, 280);
  }, []);

  // Libera la URL del blob del PDF cada vez que cambia o se desmonta el componente.
  useEffect(() => {
    if (!visorUrl) return;
    return () => URL.revokeObjectURL(visorUrl);
  }, [visorUrl]);

  // Al hacer clic en un archivo: los PDF abren el drawer lateral, las
  // imágenes abren el lightbox a pantalla completa (mismo criterio que
  // RegistroClinicoDetalle.tsx). La miniatura ya está precargada en
  // `galeria`, así que el lightbox abre al instante.
  const handleAbrirArchivo = useCallback(
    (archivo: ArchivoResponse) => {
      if (esPdf(archivo.nombre_archivo)) {
        void abrirVisorArchivo(archivo);
        return;
      }
      const url = galeria[archivo.id];
      if (!url) return;
      setLupaVisible(false);
      setImagenActiva({ archivo, url });
    },
    [abrirVisorArchivo, galeria],
  );

  // Cerrar el lightbox con Escape, como se espera de cualquier visor
  // (mismo patrón que RegistroClinicoDetalle.tsx).
  useEffect(() => {
    if (!imagenActiva) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagenActiva(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imagenActiva]);

  // Sigue el cursor (o el dedo) dentro del recuadro de la imagen y calcula
  // dónde debe apuntar la lupa, igual que en RegistroClinicoDetalle.tsx.
  const moverLupa = (clientX: number, clientY: number) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - r.left, r.width));
    const y = Math.max(0, Math.min(clientY - r.top, r.height));
    setLupaPos({ x, y, wrapW: r.width, wrapH: r.height });
    setLupaVisible(true);
  };

  const nombrePaciente = `${paciente.nombres} ${paciente.apellidos}`.trim();

  return (
    <div
      className={styles.container}
      onClick={(e) => {
        e.stopPropagation();
        setMenuAbiertoId(null);
      }}
    >
      {onClose && (
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}

      <div className={styles.layout}>
        {/* ================= SIDEBAR: FICHA + ACCIONES (igual que VerPaciente) ================= */}
        <aside className={styles.sidebar}>
          <div className={styles.pacienteCard}>
            <div className={styles.avatar}>{nombrePaciente.charAt(0) || '?'}</div>
            <h2 className={styles.pacienteNombre}>{nombrePaciente}</h2>
            <p className={styles.pacienteMeta}>Doc: {paciente.documento}</p>
            {paciente.telefono && (
              <p className={styles.pacienteMeta}>{paciente.telefono}</p>
            )}
          </div>

          <div className={styles.acciones}>
            <button
              type="button"
              className={styles.accionBtn}
              onClick={() => setShowCrearCita(true)}
              title="Crear cita"
            >
              <FontAwesomeIcon icon={faCalendarCheck} />
              <span>Crear cita</span>
            </button>
            <button
              type="button"
              className={styles.accionBtn}
              onClick={() => setShowAdjuntar(true)}
              title="Nueva atención"
            >
              <FontAwesomeIcon icon={faFileMedicalAlt} />
              <span>Nueva atención</span>
            </button>
          </div>
        </aside>

        {/* ================= MAIN: ARCHIVOS ================= */}
        <main className={styles.main}>
          <div className={styles.mainHead}>
            <h1>Archivos adjuntos</h1>
            <span className={styles.contador}>
              {archivosSubidos.length} {archivosSubidos.length === 1 ? 'archivo' : 'archivos'}
            </span>
          </div>

          {errorArchivo && !showAdjuntar && <p className={styles.errorText}>{errorArchivo}</p>}

          {cargandoArchivos ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faSpinner} spin />
              <p>Cargando archivos...</p>
            </div>
          ) : archivosSubidos.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faFileMedicalAlt} />
              <p>No hay archivos adjuntos para este paciente todavía.</p>
            </div>
          ) : (
            <div className={styles.listaAtenciones}>
              {agruparPorAtencion(archivosSubidos).map((grupo) => (
                <section key={grupo.key} className={styles.grupoAtencion}>
                  <h3 className={styles.grupoAtencionFecha}>
                    {grupo.fecha ? `Atención — ${formatFechaLabel(grupo.fecha)}` : 'Atención'}
                  </h3>
                  <ul className={styles.listaArchivos}>
                    {grupo.archivos.map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={styles.archivoRowBtn}
                          onClick={() => handleAbrirArchivo(a)}
                        >
                          {esPdf(a.nombre_archivo) ? (
                            <FontAwesomeIcon icon={faFilePdf} />
                          ) : galeria[a.id] ? (
                            <span className={styles.archivoThumbWrap}>
                              <img
                                src={galeria[a.id]}
                                alt={a.nombre_archivo}
                                className={styles.archivoThumb}
                                loading="lazy"
                              />
                              <span className={styles.archivoThumbExpand}>
                                <FontAwesomeIcon icon={faExpand} />
                              </span>
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
                            onClick={(e) => toggleMenuArchivo(a.id, e)}
                            aria-label="Más acciones"
                          >
                            <FontAwesomeIcon icon={faEllipsisVertical} />
                          </button>
                          {menuAbiertoId === a.id && (
                            <div className={styles.menuDropdown} onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => void handleDescargarArchivo(a)}>
                                <FontAwesomeIcon icon={faDownload} /> Descargar
                              </button>
                              <button
                                type="button"
                                className={styles.menuDanger}
                                onClick={() => handleEliminarArchivo(a.id)}
                              >
                                <FontAwesomeIcon icon={faTrash} /> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* CrearCita es un modal autocontenido: trae su propio backdrop y
          botón de cerrar, así que acá solo se monta condicionalmente. */}
      {showCrearCita && (
        <CrearCita
          paciente={paciente}
          onClose={() => setShowCrearCita(false)}
          onSuccess={() => setShowCrearCita(false)}
        />
      )}

      {/* ================= MODAL: ADJUNTAR ARCHIVO (con Guardar) ================= */}
      {showAdjuntar && (
        <div className={styles.backdrop} onClick={cerrarModalAdjuntar}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalCloseBtn} onClick={cerrarModalAdjuntar}>
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <div className={styles.sectionTitle}>
              <FontAwesomeIcon icon={faFileMedicalAlt} /> Nueva atención
            </div>

            <div
              ref={dropRef}
              className={styles.uploadArea}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputFileRef.current?.click()}
            >
              <FontAwesomeIcon icon={faCloudUploadAlt} />
              <p>Arrastra archivos aquí o haz clic para seleccionar</p>
              <span>PDF, JPG o PNG</span>
              <input
                ref={inputFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                hidden
                onChange={(e) => {
                  agregarPendientes(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            <button
              type="button"
              className={styles.btnCapturarQr}
              onClick={() => setQrModalOpen(true)}
              disabled={subiendo}
            >
              <FontAwesomeIcon icon={faCamera} /> Tomar fotografías con el celular
            </button>

            {errorArchivo && <p className={styles.errorText}>{errorArchivo}</p>}

            {archivosPendientes.length > 0 && (
              <ul className={styles.listaPendientes}>
                {archivosPendientes.map((p) => (
                  <li key={p.localId}>
                    <FontAwesomeIcon icon={esPdf(p.file.name) ? faFilePdf : faFileImage} />
                    <span>{p.file.name}</span>
                    <button
                      type="button"
                      onClick={() => quitarPendiente(p.localId)}
                      aria-label="Quitar archivo"
                      disabled={subiendo}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.modalAcciones}>
              <button
                type="button"
                className={styles.btnSecundario}
                onClick={cerrarModalAdjuntar}
                disabled={subiendo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={styles.btnPrimario}
                onClick={() => void guardarPendientes()}
                disabled={subiendo || archivosPendientes.length === 0}
              >
                <FontAwesomeIcon icon={faFloppyDisk} />{' '}
                {subiendo ? 'Guardando...' : `Registrar atención (${archivosPendientes.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Portal a <body>: si no, el modal del QR queda atrapado dentro del
          backdrop del modal de adjuntar en vez de cubrir toda la pantalla
          (mismo patrón que Examenes.tsx y RegistroClinicoDetalle.tsx). */}
      {qrModalOpen &&
        createPortal(
          <CapturaQrModal
            destino={{ tipo: 'paciente', id: paciente.id }}
            examenNombre={nombrePaciente}
            onClose={cerrarModalQr}
            onFotoNueva={handleFotoQrNueva}
            onSesionIniciada={(sid) => {
              qrSidActualRef.current = sid;
            }}
          />,
          document.body,
        )}

      {/* ================= DRAWER: VER PDF ================= */}
      {/* Igual patrón que el drawer de RegistroClinicoDetalle en VerPaciente:
          entra deslizando de derecha a izquierda y sale deslizando de vuelta
          hacia la derecha antes de desmontarse. Las imágenes ya no pasan por
          acá: abren directo el lightbox de abajo. */}
      {archivoEnVisor && (
        <div className={styles.backdrop} onClick={cerrarVisorArchivo}>
          <div
            className={`${styles.drawerRight} ${cerrandoVisor ? styles.drawerRightClosing : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles.modalCloseBtn} onClick={cerrarVisorArchivo}>
              <FontAwesomeIcon icon={faXmark} />
            </button>

            <div className={styles.visorHead}>
              <FontAwesomeIcon icon={faFilePdf} />
              <span>{archivoEnVisor.nombre_archivo}</span>
            </div>

            {cargandoVisor && (
              <div className={styles.emptyState}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <p>Cargando archivo...</p>
              </div>
            )}

            {!cargandoVisor && errorVisor && (
              <div className={styles.emptyState}>
                <FontAwesomeIcon icon={faExclamationCircle} />
                <p>{errorVisor}</p>
              </div>
            )}

            {!cargandoVisor && !errorVisor && visorUrl && (
              <>
                <div className={styles.visorBody}>
                  <iframe src={visorUrl} title={archivoEnVisor.nombre_archivo} className={styles.visorFrame} />
                </div>
                <a href={visorUrl} download={archivoEnVisor.nombre_archivo} className={styles.visorDescargar}>
                  <FontAwesomeIcon icon={faDownload} /> Descargar
                </a>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= LIGHTBOX: IMAGEN A PANTALLA COMPLETA ================= */}
      {/* Mismo patrón que RegistroClinicoDetalle.tsx: portal a <body> para que
          "position: fixed" tome el viewport real como referencia (si se
          renderizara dentro del backdrop del modal quedaría recortado), y la
          lupa de zoom solo vive acá — nunca sobre la miniatura de la lista. */}
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
                    backgroundSize: `${lupaPos.wrapW * LUPA_ZOOM}px ${lupaPos.wrapH * LUPA_ZOOM}px`,
                    backgroundPosition: `${-(lupaPos.x * LUPA_ZOOM - LUPA_DIAMETRO / 2)}px ${-(lupaPos.y * LUPA_ZOOM - LUPA_DIAMETRO / 2)}px`,
                  }}
                />
              )}
            </div>
            <div className={styles.lightboxCaption} onClick={(e) => e.stopPropagation()}>
              <span>{imagenActiva.archivo.nombre_archivo}</span>
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
    </div>
  );
};

export default PacienteExterno;