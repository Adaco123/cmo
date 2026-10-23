import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Paciente } from '../../api/pacientes';
import {
  crearAtencionExterna,
  descargarArchivoBlob,
  descartarSesionCaptura,
  eliminarArchivo as eliminarArchivoApi,
  subirArchivoAtencion,
} from '../../api/archivos';
import { getTiposArchivo, type TipoArchivo } from '../../api/tiposarchivo';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { useReportesHoy } from '../../components/ReportesHoyProvider';
import { extractErrorMessage } from '../../utils/errors';
import CapturaQrModal from './CapturaQrModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faCloudUploadAlt,
  faFilePdf,
  faFileImage,
  faTimes,
  faFileMedicalAlt,
  faFloppyDisk,
  faCamera,
} from '@fortawesome/free-solid-svg-icons';
// Mismo aspecto que el modal "Nueva atención" de pacientes externos: se
// reutilizan sus estilos en vez de duplicarlos.
import styles from './PacienteExterno.module.css';

// Mismo criterio que PacienteExterno.tsx y RegistroClinico.tsx: el id real
// del tipo de archivo se resuelve contra el catálogo del backend, nunca
// hardcodeado.
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

/** Archivo en espera de subirse, con un id local para poder quitarlo de la lista. */
interface ArchivoPendiente {
  localId: string;
  file: File;
}

interface AdjuntarArchivosProps {
  paciente: Paciente;
  onClose: () => void;
  /** Se llama después de guardar con la cantidad de archivos subidos. */
  onGuardado?: (cantidad: number) => void;
}

/**
 * Modal para subir archivos sueltos (PDF, JPG, PNG) o tomar fotos con la
 * cámara del celular (QR) a un paciente PROPIO, sin pasar por un registro
 * clínico. Es el mismo flujo que "Nueva atención" de los pacientes externos:
 * al guardar se crea una atención (Consulta mínima, sin motivo ni
 * diagnóstico) y los archivos quedan ligados a ella.
 *
 * Es autocontenido: trae su propio backdrop y botón de cerrar, así que
 * quien lo use solo lo monta condicionalmente.
 */
const AdjuntarArchivos: React.FC<AdjuntarArchivosProps> = ({ paciente, onClose, onGuardado }) => {
  const { showError, showSuccess } = useErrorToast();
  // La atención creada cuenta en "Pacientes atendidos hoy", igual que al
  // guardar un registro clínico: se refresca ese reporte al terminar.
  const { refrescar: refrescarReportesHoy } = useReportesHoy();

  const [archivosPendientes, setArchivosPendientes] = useState<ArchivoPendiente[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [tiposArchivo, setTiposArchivo] = useState<TipoArchivo[]>([]);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const qrSidActualRef = useRef<string | null>(null);
  // Atención ya creada en un intento que falló a mitad: al reintentar se
  // reutiliza en vez de crear otra y dejar una atención vacía de más.
  const atencionIdRef = useRef<number | null>(null);

  const inputFileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTiposArchivo()
      .then(setTiposArchivo)
      .catch((err: unknown) => console.error('No se pudo cargar el catálogo de tipos de archivo', err));
  }, []);

  const nombrePaciente = `${paciente.nombres} ${paciente.apellidos}`.trim();

  /** Agrega archivos elegidos (input o drag&drop) a la lista de pendientes, sin subirlos aún. */
  const agregarPendientes = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nuevos: ArchivoPendiente[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!EXTENSIONES_VALIDAS.includes(ext)) {
        showError(`"${file.name}" no es un formato válido (solo PDF, JPG o PNG).`);
        continue;
      }
      nuevos.push({ localId: `${file.name}-${file.lastModified}-${file.size}`, file });
    }
    if (nuevos.length === 0) return;

    setArchivosPendientes((prev) => {
      const existentes = new Set(prev.map((p) => p.localId));
      return [...prev, ...nuevos.filter((n) => !existentes.has(n.localId))];
    });
  }, [showError]);

  /** Foto nueva tomada con el celular (sesión QR): se descarga del servidor,
   *  entra a la lista de pendientes como un archivo más y se borra la copia
   *  transitoria del servidor. */
  const handleFotoQrNueva = useCallback((archivoId: number) => {
    (async () => {
      try {
        const blob = await descargarArchivoBlob(archivoId);
        const file = new File([blob], `foto-qr-${archivoId}.jpg`, { type: blob.type || 'image/jpeg' });
        setArchivosPendientes((prev) => [...prev, { localId: `qr-${archivoId}`, file }]);
      } catch {
        showError('No se pudo importar una fotografía tomada por el celular.');
      } finally {
        eliminarArchivoApi(archivoId).catch(() => {
          // Best-effort: si no se pudo borrar la copia transitoria no se bloquea el flujo.
        });
      }
    })();
  }, [showError]);

  const quitarPendiente = (localId: string) => {
    setArchivosPendientes((prev) => prev.filter((p) => p.localId !== localId));
  };

  /** Cierra el modal del QR y descarta la sesión: cualquier foto que llegó
   *  pero no se alcanzó a bajar se borra del servidor para que no quede huérfana. */
  const cerrarModalQr = useCallback(() => {
    const sid = qrSidActualRef.current;
    qrSidActualRef.current = null;
    setQrModalOpen(false);
    if (sid) descartarSesionCaptura(sid).catch(() => {});
  }, []);

  const cerrarTodo = useCallback(() => {
    if (subiendo) return;
    cerrarModalQr();
    onClose();
  }, [subiendo, cerrarModalQr, onClose]);

  const handleGuardar = async () => {
    if (subiendo || archivosPendientes.length === 0) return;
    setSubiendo(true);
    let subidos = 0;
    try {
      if (atencionIdRef.current === null) {
        const atencion = await crearAtencionExterna(paciente.id);
        atencionIdRef.current = atencion.id;
        // La atención ya existe (cuenta en "Pacientes atendidos hoy").
        refrescarReportesHoy();
      }
      const atencionId = atencionIdRef.current;
      for (const pendiente of archivosPendientes) {
        const ext = pendiente.file.name.split('.').pop()?.toLowerCase() ?? '';
        const tipoArchivoId = idTipoArchivoPorExt(ext, tiposArchivo);
        await subirArchivoAtencion(atencionId, pendiente.file, tipoArchivoId);
        subidos += 1;
        // Lo que ya se subió sale de la lista: si algo falla a mitad, al
        // reintentar no se duplican los archivos que sí llegaron.
        setArchivosPendientes((prev) => prev.filter((p) => p.localId !== pendiente.localId));
      }
      showSuccess(
        subidos === 1 ? 'Archivo guardado correctamente' : `${subidos} archivos guardados correctamente`,
      );
      onGuardado?.(subidos);
      cerrarModalQr();
      onClose();
    } catch (error: unknown) {
      showError(extractErrorMessage(error, 'No se pudieron guardar los archivos.'));
    } finally {
      setSubiendo(false);
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

  return (
    <>
      <div className={styles.backdrop} onClick={cerrarTodo}>
        <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.modalCloseBtn} onClick={cerrarTodo} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>

          <div className={styles.sectionTitle}>
            <FontAwesomeIcon icon={faFileMedicalAlt} /> Subir archivos — {nombrePaciente}
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
            <button type="button" className={styles.btnSecundario} onClick={cerrarTodo} disabled={subiendo}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnPrimario}
              onClick={() => void handleGuardar()}
              disabled={subiendo || archivosPendientes.length === 0}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />{' '}
              {subiendo ? 'Guardando...' : `Guardar archivos (${archivosPendientes.length})`}
            </button>
          </div>
        </div>
      </div>

      {/* Portal a <body>: si no, el modal del QR queda atrapado dentro del
          backdrop de este modal en vez de cubrir toda la pantalla. */}
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
    </>
  );
};

export default AdjuntarArchivos;