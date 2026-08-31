import React, { useCallback, useEffect, useRef, useState } from 'react';
import { type Paciente } from '../../api/pacientes';
import {
  descargarArchivoBlob,
  eliminarArchivo as eliminarArchivoApi,
  getArchivosPorPaciente,
  subirArchivoPaciente,
  type ArchivoResponse,
} from '../../api/archivos';
import CrearCita from '../../components/CrearCita';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faPaperclip,
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
} from '@fortawesome/free-solid-svg-icons';
import styles from './PacienteExterno.module.css';

// Mismo criterio que RegistroClinico.tsx: 1 = imagen, 2 = pdf.
const TIPO_ARCHIVO_POR_EXT: Record<string, number> = {
  jpg: 1,
  jpeg: 1,
  png: 1,
  pdf: 2,
};

const EXTENSIONES_VALIDAS = Object.keys(TIPO_ARCHIVO_POR_EXT);

const esPdf = (nombreArchivo: string) => nombreArchivo.toLowerCase().endsWith('.pdf');

interface PacienteExternoProps {
  /** Paciente externo (origen_id=2) ya seleccionado. La búsqueda y la
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

/**
 * Modal de ficha para un paciente externo (origen_id=2) ya seleccionado:
 * layout de dos columnas (ficha + acciones a la izquierda, archivos a la
 * derecha), con "Adjuntar archivo" como modal centrado, "Crear cita" como
 * modal autocontenido (trae su propio backdrop), y ver un archivo como
 * drawer lateral que entra deslizando de derecha a izquierda (mismo patrón
 * que RegistroClinicoDetalle en VerPaciente). La lista de archivos usa el
 * mismo patrón de menú "..." (3 puntos) que el timeline de VerPaciente.tsx
 * en vez de un botón de eliminar directo.
 */
const PacienteExterno: React.FC<PacienteExternoProps> = ({ paciente, onClose }) => {
  const [archivosSubidos, setArchivosSubidos] = useState<ArchivoResponse[]>([]);
  const [archivosPendientes, setArchivosPendientes] = useState<ArchivoPendiente[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const [showCrearCita, setShowCrearCita] = useState(false);
  const [showAdjuntar, setShowAdjuntar] = useState(false);

  // Menú "..." de cada archivo (Descargar / Eliminar), igual patrón que
  // el menú de 3 puntos de las tarjetas del timeline en VerPaciente.tsx.
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null);

  // ---- Visor de archivo (drawer lateral) ----
  const [archivoEnVisor, setArchivoEnVisor] = useState<ArchivoResponse | null>(null);
  const [visorUrl, setVisorUrl] = useState<string | null>(null);
  const [cargandoVisor, setCargandoVisor] = useState(false);
  const [errorVisor, setErrorVisor] = useState<string | null>(null);
  // Igual que en VerPaciente: primero se dispara la animación de salida
  // (cerrandoVisor = true) y solo al terminar se desmonta el drawer.
  const [cerrandoVisor, setCerrandoVisor] = useState(false);

  const inputFileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Carga los archivos ya subidos del paciente al montar (y de nuevo si
  // el modal se reutilizara para otro paciente sin desmontarse).
  useEffect(() => {
    let cancelado = false;
    setArchivosSubidos([]);
    setArchivosPendientes([]);
    setErrorArchivo(null);
    setMenuAbiertoId(null);
    (async () => {
      try {
        const archivos = await getArchivosPorPaciente(paciente.id);
        if (!cancelado) setArchivosSubidos(archivos);
      } catch {
        // Si falla la carga de archivos previos igual se puede seguir subiendo.
      }
    })();
    return () => {
      cancelado = true;
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

  const quitarPendiente = (localId: string) => {
    setArchivosPendientes((prev) => prev.filter((p) => p.localId !== localId));
  };

  /** Sube al backend todos los archivos pendientes (botón "Guardar"). */
  const guardarPendientes = useCallback(async () => {
    if (archivosPendientes.length === 0) return;
    setErrorArchivo(null);
    setSubiendo(true);
    try {
      for (const pendiente of archivosPendientes) {
        const ext = pendiente.file.name.split('.').pop()?.toLowerCase() ?? '';
        const tipoArchivoId = TIPO_ARCHIVO_POR_EXT[ext] ?? 1;
        const subido = await subirArchivoPaciente(paciente.id, pendiente.file, tipoArchivoId);
        setArchivosSubidos((prev) => [subido, ...prev]);
      }
      setArchivosPendientes([]);
      setShowAdjuntar(false);
    } catch (error: any) {
      const backendMessage = error?.response?.data?.error || error?.message;
      setErrorArchivo(backendMessage || 'No se pudo subir el archivo.');
    } finally {
      setSubiendo(false);
    }
  }, [paciente, archivosPendientes]);

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

  const cerrarModalAdjuntar = () => {
    setShowAdjuntar(false);
    setArchivosPendientes([]);
    setErrorArchivo(null);
  };

  // ---- Abrir/cerrar el visor de archivo (drawer derecho) ----
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

  // Libera la URL del blob cada vez que cambia o se desmonta el componente.
  useEffect(() => {
    if (!visorUrl) return;
    return () => URL.revokeObjectURL(visorUrl);
  }, [visorUrl]);

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
              title="Adjuntar archivo"
            >
              <FontAwesomeIcon icon={faPaperclip} />
              <span>Adjuntar archivo</span>
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

          {archivosSubidos.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faFileMedicalAlt} />
              <p>No hay archivos adjuntos para este paciente todavía.</p>
            </div>
          ) : (
            <ul className={styles.listaArchivos}>
              {archivosSubidos.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={styles.archivoRowBtn}
                    onClick={() => void abrirVisorArchivo(a)}
                  >
                    <FontAwesomeIcon icon={esPdf(a.nombre_archivo) ? faFilePdf : faFileImage} />
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
              <FontAwesomeIcon icon={faPaperclip} /> Adjuntar archivos
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
                {subiendo ? 'Guardando...' : `Guardar (${archivosPendientes.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DRAWER: VER ARCHIVO ================= */}
      {/* Igual patrón que el drawer de RegistroClinicoDetalle en VerPaciente:
          entra deslizando de derecha a izquierda y sale deslizando de vuelta
          hacia la derecha antes de desmontarse. */}
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
              <FontAwesomeIcon icon={esPdf(archivoEnVisor.nombre_archivo) ? faFilePdf : faFileImage} />
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
                  {esPdf(archivoEnVisor.nombre_archivo) ? (
                    <iframe src={visorUrl} title={archivoEnVisor.nombre_archivo} className={styles.visorFrame} />
                  ) : (
                    <img src={visorUrl} alt={archivoEnVisor.nombre_archivo} className={styles.visorImg} />
                  )}
                </div>
                <a href={visorUrl} download={archivoEnVisor.nombre_archivo} className={styles.visorDescargar}>
                  <FontAwesomeIcon icon={faDownload} /> Descargar
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PacienteExterno;