import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPaciente, type Paciente, type PacientePayload } from '../../api/pacientes';
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
  faUserClock,
  faSearch,
  faUserPlus,
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
} from '@fortawesome/free-solid-svg-icons';
import styles from './PacienteExterno.module.css';

const ORIGEN_EXTERNO = 2;
const CONSULTORIO_ID = 1;

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
  /** Lista de pacientes con origen_id=2 ya cargada (usePacientes -> filteredExternos). */
  pacientesExternos: Paciente[];
  onClose?: () => void;
  /** Se llama cuando se crea un paciente externo nuevo, para refrescar la lista del dashboard. */
  onPacienteCreado?: () => void;
  /** Si viene, el modal arranca directo en la vista del paciente (sin pasar por búsqueda/crear). */
  pacienteInicial?: Paciente | null;
}

interface NuevoExternoForm {
  nombres: string;
  apellidos: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: string;
  telefono: string;
}

const formInicial: NuevoExternoForm = {
  nombres: '',
  apellidos: '',
  documento: '',
  fecha_nacimiento: '',
  sexo: '',
  telefono: '',
};

/** Archivo en espera de subirse, con un id local para poder quitarlo de la lista. */
interface ArchivoPendiente {
  localId: string;
  file: File;
}

/**
 * Modal para pacientes externos (origen_id=2). Antes de seleccionar un
 * paciente: buscar o crear rápido. Una vez seleccionado: layout de dos
 * columnas (ficha + acciones a la izquierda, archivos a la derecha), con
 * "Crear cita" y "Adjuntar archivo" como modales centrados, y ver un
 * archivo como drawer lateral que entra deslizando de derecha a
 * izquierda (mismo patrón que RegistroClinicoDetalle en VerPaciente).
 */
const PacienteExterno: React.FC<PacienteExternoProps> = ({
  pacientesExternos,
  onClose,
  onPacienteCreado,
  pacienteInicial = null,
}) => {
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [modoCrear, setModoCrear] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [formData, setFormData] = useState<NuevoExternoForm>(formInicial);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState<string | null>(null);

  const [archivosSubidos, setArchivosSubidos] = useState<ArchivoResponse[]>([]);
  const [archivosPendientes, setArchivosPendientes] = useState<ArchivoPendiente[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const [showCrearCita, setShowCrearCita] = useState(false);
  const [showAdjuntar, setShowAdjuntar] = useState(false);

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

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pacientesExternos;
    return pacientesExternos.filter((p) => {
      const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
      return fullName.includes(q) || p.documento.toLowerCase().includes(q);
    });
  }, [busqueda, pacientesExternos]);

  const seleccionarPaciente = useCallback(async (paciente: Paciente) => {
    setSelectedPaciente(paciente);
    setArchivosSubidos([]);
    setArchivosPendientes([]);
    setErrorArchivo(null);
    try {
      const archivos = await getArchivosPorPaciente(paciente.id);
      setArchivosSubidos(archivos);
    } catch {
      // Si falla la carga de archivos previos igual se puede seguir subiendo.
    }
  }, []);

  // Si llega un pacienteInicial (clic en la tabla de externos), saltamos
  // la búsqueda y vamos directo a la vista de ficha + acciones.
  useEffect(() => {
    if (pacienteInicial) {
      void seleccionarPaciente(pacienteInicial);
    }
  }, [pacienteInicial, seleccionarPaciente]);

  const cambiarPaciente = () => {
    setSelectedPaciente(null);
    setArchivosSubidos([]);
    setArchivosPendientes([]);
    setErrorArchivo(null);
    setShowCrearCita(false);
    setShowAdjuntar(false);
  };

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCrearPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorCrear(null);

    if (
      !formData.nombres.trim() ||
      !formData.apellidos.trim() ||
      !formData.documento.trim() ||
      !formData.fecha_nacimiento ||
      !formData.sexo
    ) {
      setErrorCrear('Completa los campos obligatorios (*).');
      return;
    }

    const sexoMap: Record<string, PacientePayload['sexo']> = {
      masculino: 'M',
      femenino: 'F',
      otro: 'O',
    };

    const payload: PacientePayload = {
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      documento: formData.documento.trim(),
      fecha_nacimiento: formData.fecha_nacimiento,
      sexo: sexoMap[formData.sexo] ?? 'O',
      telefono: formData.telefono.trim() || null,
      origen_id: ORIGEN_EXTERNO,
      consultorio_id: CONSULTORIO_ID,
      estado: true,
    };

    try {
      setCreando(true);
      const nuevoPaciente = await createPaciente(payload);
      onPacienteCreado?.();
      setModoCrear(false);
      setFormData(formInicial);
      await seleccionarPaciente(nuevoPaciente);
    } catch (error: any) {
      const backendMessage =
        error?.response?.data?.error || error?.response?.data?.msg || error?.message;
      setErrorCrear(backendMessage || 'No se pudo crear el paciente.');
    } finally {
      setCreando(false);
    }
  };

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
    if (!selectedPaciente || archivosPendientes.length === 0) return;
    setErrorArchivo(null);
    setSubiendo(true);
    try {
      for (const pendiente of archivosPendientes) {
        const ext = pendiente.file.name.split('.').pop()?.toLowerCase() ?? '';
        const tipoArchivoId = TIPO_ARCHIVO_POR_EXT[ext] ?? 1;
        const subido = await subirArchivoPaciente(selectedPaciente.id, pendiente.file, tipoArchivoId);
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
  }, [selectedPaciente, archivosPendientes]);

  const handleEliminarArchivo = async (archivoId: number) => {
    try {
      await eliminarArchivoApi(archivoId);
      setArchivosSubidos((prev) => prev.filter((a) => a.id !== archivoId));
    } catch {
      setErrorArchivo('No se pudo eliminar el archivo.');
    }
  };

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

  const nombrePaciente = selectedPaciente
    ? `${selectedPaciente.nombres} ${selectedPaciente.apellidos}`.trim()
    : '';

  return (
    <div className={styles.container} onClick={(e) => e.stopPropagation()}>
      {onClose && (
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </button>
      )}

      {!selectedPaciente ? (
        <>
          <div className={styles.header}>
            <FontAwesomeIcon icon={faUserClock} />
            <h1>Paciente Externo</h1>
          </div>

          <div className={styles.section}>
            {!modoCrear ? (
              <>
                <div className={styles.sectionTitle}>
                  <FontAwesomeIcon icon={faSearch} /> Buscar paciente externo
                </div>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Buscar por nombre o documento..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                <div className={styles.listaResultados}>
                  {resultados.length === 0 ? (
                    <p className={styles.emptyText}>No se encontraron pacientes externos.</p>
                  ) : (
                    resultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={styles.resultadoItem}
                        onClick={() => seleccionarPaciente(p)}
                      >
                        <span className={styles.resultadoNombre}>
                          {p.nombres} {p.apellidos}
                        </span>
                        <span className={styles.resultadoDoc}>{p.documento}</span>
                      </button>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  className={styles.btnSecundario}
                  onClick={() => setModoCrear(true)}
                >
                  <FontAwesomeIcon icon={faUserPlus} /> Nuevo paciente externo
                </button>
              </>
            ) : (
              <>
                <div className={styles.sectionTitle}>
                  <FontAwesomeIcon icon={faUserPlus} /> Nuevo paciente externo
                </div>
                <form onSubmit={handleCrearPaciente}>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="nombres">Nombres *</label>
                      <input
                        id="nombres"
                        name="nombres"
                        value={formData.nombres}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="apellidos">Apellidos *</label>
                      <input
                        id="apellidos"
                        name="apellidos"
                        value={formData.apellidos}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="documento">Documento *</label>
                      <input
                        id="documento"
                        name="documento"
                        value={formData.documento}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="fecha_nacimiento">Fecha de nacimiento *</label>
                      <input
                        type="date"
                        id="fecha_nacimiento"
                        name="fecha_nacimiento"
                        value={formData.fecha_nacimiento}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="sexo">Sexo *</label>
                      <select
                        id="sexo"
                        name="sexo"
                        value={formData.sexo}
                        onChange={handleFormChange}
                        required
                      >
                        <option value="">Seleccione</option>
                        <option value="masculino">Masculino</option>
                        <option value="femenino">Femenino</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="telefono">Teléfono</label>
                      <input
                        id="telefono"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>

                  {errorCrear && <p className={styles.errorText}>{errorCrear}</p>}

                  <div className={styles.accionesForm}>
                    <button
                      type="button"
                      className={styles.btnSecundario}
                      onClick={() => setModoCrear(false)}
                    >
                      Volver a buscar
                    </button>
                    <button type="submit" className={styles.btnPrimario} disabled={creando}>
                      {creando ? 'Guardando...' : 'Crear y continuar'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </>
      ) : (
        <div className={styles.layout}>
          {/* ================= SIDEBAR: FICHA + ACCIONES (igual que VerPaciente) ================= */}
          <aside className={styles.sidebar}>
            <div className={styles.pacienteCard}>
              <div className={styles.avatar}>{nombrePaciente.charAt(0) || '?'}</div>
              <h2 className={styles.pacienteNombre}>{nombrePaciente}</h2>
              <p className={styles.pacienteMeta}>Doc: {selectedPaciente.documento}</p>
              {selectedPaciente.telefono && (
                <p className={styles.pacienteMeta}>{selectedPaciente.telefono}</p>
              )}
              <button type="button" className={styles.btnCambiar} onClick={cambiarPaciente}>
                Cambiar paciente
              </button>
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
                    <button
                      type="button"
                      onClick={() => handleEliminarArchivo(a.id)}
                      aria-label="Eliminar archivo"
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </main>
        </div>
      )}

      {/* ================= MODAL: CREAR CITA (igual que VerPaciente) ================= */}
      {showCrearCita && selectedPaciente && (
        <div className={styles.backdrop} onClick={() => setShowCrearCita(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.modalCloseBtn} onClick={() => setShowCrearCita(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <CrearCita
              paciente={selectedPaciente}
              onClose={() => setShowCrearCita(false)}
              onSuccess={() => setShowCrearCita(false)}
            />
          </div>
        </div>
      )}

      {/* ================= MODAL: ADJUNTAR ARCHIVO (con Guardar) ================= */}
      {showAdjuntar && selectedPaciente && (
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