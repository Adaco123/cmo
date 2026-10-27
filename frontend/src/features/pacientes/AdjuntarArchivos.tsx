import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Paciente } from '../../api/pacientes';
import {
  crearAtencionExterna,
  descargarArchivoBlob,
  descartarSesionCaptura,
  eliminarArchivo as eliminarArchivoApi,
  subirArchivoAtencion,
  subirArchivoExamen,
} from '../../api/archivos';
import { getTiposArchivo, type TipoArchivo } from '../../api/tiposarchivo';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { useReportesHoy } from '../../components/ReportesHoyProvider';
import { useAuth } from '../../components/AuthProvider';
import { nombreCompleto } from '../../auth';
import { crearRecetasConsulta, type RecetasPayload } from '../../api/recetas';
import { extractErrorMessage } from '../../utils/errors';
import CapturaQrModal from './CapturaQrModal';
import Receta from './Receta';
import type { RecetaHandle } from './Receta';
import Examenes from './Examenes';
import type { ExamenesHandle } from './Examenes';
import type { ExamenComplementarioItemPayload } from '../../api/examenesComplementarios';
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
  faFilePrescription,
  faVials,
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

const CATEGORIA_LABEL = {
  laboratorio: 'Laboratorio',
  imagenologia: 'Imagenología',
  otros: 'Otro',
} as const;

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
 * Antes de guardar también se puede armar una receta (medicamentos,
 * exámenes solicitados y fórmulas) y registrar exámenes complementarios,
 * con los mismos paneles del registro clínico: archivos, receta y exámenes
 * se guardan juntos, en la misma atención. Una vez guardada, la atención ya
 * no se receta ni se le piden exámenes (regla clínica): las recetas solo se
 * ven y se envían por WhatsApp, y los exámenes pendientes se completan
 * (observaciones, fotos) desde el historial.
 *
 * Es autocontenido: trae su propio backdrop y botón de cerrar, así que
 * quien lo use solo lo monta condicionalmente.
 */
const AdjuntarArchivos: React.FC<AdjuntarArchivosProps> = ({ paciente, onClose, onGuardado }) => {
  const { showError, showSuccess, confirm } = useErrorToast();
  const { user } = useAuth();
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

  // Receta armada antes de guardar. El panel (Receta.tsx) queda montado todo
  // el tiempo, así que el borrador no se pierde al cerrarlo; solo se lee al
  // guardar (getPayload). `tieneBorrador` se actualiza al cerrar el panel.
  const recetaRef = useRef<RecetaHandle>(null);
  const [recetaAbierta, setRecetaAbierta] = useState(false);
  const [tieneBorrador, setTieneBorrador] = useState(false);
  // Si los archivos se guardaron pero la receta falló (o al revés), al
  // reintentar no se vuelve a crear la que ya quedó guardada.
  const recetaGuardadaRef = useRef(false);

  // Exámenes complementarios (drawer Examenes.tsx, igual que en el registro
  // clínico): también montado siempre para conservar el borrador.
  const examenesRef = useRef<ExamenesHandle>(null);
  const [examenesAbierto, setExamenesAbierto] = useState(false);
  const [examCount, setExamCount] = useState(0);

  const inputFileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTiposArchivo()
      .then(setTiposArchivo)
      .catch((err: unknown) => console.error('No se pudo cargar el catálogo de tipos de archivo', err));
  }, []);

  const nombrePaciente = `${paciente.nombres} ${paciente.apellidos}`.trim();
  const alergiasTexto = Array.isArray(paciente.alergias) ? paciente.alergias.join(', ') : '';

  const abrirReceta = () => setRecetaAbierta(true);
  const cerrarReceta = useCallback(() => {
    setRecetaAbierta(false);
    setTieneBorrador(!!recetaRef.current?.getPayload());
  }, []);

  // Escape cierra primero el panel de receta / exámenes (no todo el modal).
  useEffect(() => {
    if (!recetaAbierta && !examenesAbierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (recetaAbierta) cerrarReceta();
        else setExamenesAbierto(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recetaAbierta, examenesAbierto, cerrarReceta]);

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

  const cerrarTodo = useCallback(async () => {
    if (subiendo) return;
    const hayDatosSinGuardar =
      archivosPendientes.length > 0 ||
      (!recetaGuardadaRef.current && (!!recetaRef.current?.getPayload() || examCount > 0));
    if (hayDatosSinGuardar) {
      const aceptar = await confirm('Tienes archivos, receta o exámenes sin guardar. ¿Seguro que quieres cerrar?');
      if (!aceptar) return;
    }
    // Sesiones QR de fotos de exámenes que quedaron abiertas: se descartan.
    (examenesRef.current?.getSidsCapturaPendientes() ?? []).forEach((sid) => {
      descartarSesionCaptura(sid).catch(() => {});
    });
    cerrarModalQr();
    onClose();
  }, [subiendo, archivosPendientes.length, examCount, confirm, cerrarModalQr, onClose]);

  /** Aplana los exámenes del drawer conservando los File[] de cada uno
   *  (el endpoint no recibe binarios: se suben después de crear el examen). */
  const getExamenesFlat = () => {
    const payload = examenesRef.current?.getPayload();
    if (!payload) return [];
    const flat: (ExamenComplementarioItemPayload & { archivos: File[] })[] = [];
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

  const handleGuardar = async () => {
    // Receta y exámenes se guardan UNA sola vez (si ya se guardaron en un
    // intento anterior que falló a mitad, no se repiten).
    const yaGuardado = recetaGuardadaRef.current;
    const recetaPayload = yaGuardado ? null : (recetaRef.current?.getPayload() ?? null);
    const examenesFlat = yaGuardado ? [] : getExamenesFlat();
    const hayClinico = !!recetaPayload || examenesFlat.length > 0;
    if (subiendo || (archivosPendientes.length === 0 && !hayClinico)) return;
    setSubiendo(true);
    let subidos = 0;
    let recetasCreadas = 0;
    let examenesCreados = 0;
    const archivosFallidos: string[] = [];
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
      if (hayClinico) {
        const resultado = await crearRecetasConsulta(atencionId, {
          recetas: recetaPayload as RecetasPayload | null,
          examenes_complementarios: examenesFlat.map(
            ({ categoria, nombre_examen, resultado: res, observaciones }) => ({
              categoria, nombre_examen, resultado: res, observaciones,
            }),
          ),
        });
        recetasCreadas = resultado.recetas.length;
        examenesCreados = resultado.examenes_complementarios.length;
        recetaGuardadaRef.current = true;

        // Fotos/PDF de los exámenes: se suben ya con el examen creado.
        for (let i = 0; i < examenesFlat.length; i++) {
          const examenCreado = resultado.examenes_complementarios[i];
          if (!examenCreado) continue;
          for (const archivo of examenesFlat[i].archivos) {
            const ext = archivo.name.split('.').pop()?.toLowerCase() ?? '';
            try {
              await subirArchivoExamen(examenCreado.id, archivo, idTipoArchivoPorExt(ext, tiposArchivo));
            } catch (errArchivo) {
              console.error(`No se pudo subir el archivo "${archivo.name}"`, errArchivo);
              archivosFallidos.push(archivo.name);
            }
          }
        }
        recetaRef.current?.reset();
        examenesRef.current?.reset();
        setExamCount(0);
        setTieneBorrador(false);
      }
      const partes: string[] = [];
      if (subidos > 0) partes.push(subidos === 1 ? '1 archivo' : `${subidos} archivos`);
      if (recetasCreadas > 0) partes.push(recetasCreadas === 1 ? '1 receta' : `${recetasCreadas} recetas`);
      if (examenesCreados > 0) partes.push(examenesCreados === 1 ? '1 examen' : `${examenesCreados} exámenes`);
      showSuccess(`Guardado correctamente: ${partes.join(', ')}`);
      if (archivosFallidos.length > 0) {
        showError(`No se pudieron subir las fotos/archivos de exámenes: ${archivosFallidos.join(', ')}. Súbelos desde el historial.`);
      }
      onGuardado?.(subidos);
      cerrarModalQr();
      onClose();
    } catch (error: unknown) {
      // Si ya se subieron archivos antes del fallo, el historial se refresca
      // igual para que aparezcan (el modal sigue abierto para reintentar el resto).
      if (subidos > 0) onGuardado?.(subidos);
      showError(extractErrorMessage(error, 'No se pudo guardar la atención. Revisa los datos e intenta de nuevo.'));
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

  const partesGuardar: string[] = [];
  if (archivosPendientes.length > 0) {
    partesGuardar.push(`${archivosPendientes.length} ${archivosPendientes.length === 1 ? 'archivo' : 'archivos'}`);
  }
  if (tieneBorrador) partesGuardar.push('receta');
  if (examCount > 0) partesGuardar.push(examCount === 1 ? '1 examen' : `${examCount} exámenes`);
  const etiquetaGuardar = partesGuardar.length > 0
    ? `Guardar consulta (${partesGuardar.join(' + ')})`
    : 'Guardar consulta';

  return (
    <>
      <div className={styles.backdrop} onClick={() => void cerrarTodo()}>
        <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.modalCloseBtn} onClick={() => void cerrarTodo()} aria-label="Cerrar">
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

          <button
            type="button"
            className={styles.btnCapturarQr}
            onClick={abrirReceta}
            disabled={subiendo}
          >
            <FontAwesomeIcon icon={faFilePrescription} /> Recetar (medicamentos, exámenes solicitados, fórmulas)
            {tieneBorrador && ' ✓'}
          </button>

          <button
            type="button"
            className={styles.btnCapturarQr}
            onClick={() => setExamenesAbierto(true)}
            disabled={subiendo}
          >
            <FontAwesomeIcon icon={faVials} /> Exámenes complementarios (resultados que trae el paciente)
            {examCount > 0 && ` ✓ ${examCount}`}
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
            <button type="button" className={styles.btnSecundario} onClick={() => void cerrarTodo()} disabled={subiendo}>
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnPrimario}
              onClick={() => void handleGuardar()}
              disabled={subiendo || (archivosPendientes.length === 0 && !tieneBorrador && examCount === 0)}
            >
              <FontAwesomeIcon icon={faFloppyDisk} />{' '}
              {subiendo ? 'Guardando...' : etiquetaGuardar}
            </button>
          </div>
        </div>
      </div>

      {/* Panel de receta: siempre montado (así el borrador no se pierde al
          cerrarlo). Portal a <body> dentro de un contenedor con capa propia:
          el panel usa z-index 60-61 y el backdrop de este modal es 100, así
          que sin el contenedor quedaría escondido detrás. */}
      {createPortal(
        <div style={{ position: 'relative', zIndex: 150 }}>
          <Receta
            ref={recetaRef}
            isOpen={recetaAbierta}
            onClose={cerrarReceta}
            pacienteNombre={nombrePaciente}
            pacienteEdad={paciente.edad != null ? String(paciente.edad) : '—'}
            pacienteCi={paciente.documento || '—'}
            alergias={alergiasTexto}
            medicoNombre={nombreCompleto(user)}
          />
          <Examenes
            ref={examenesRef}
            isOpen={examenesAbierto}
            onClose={() => setExamenesAbierto(false)}
            contexto={{
              medico_id: user?.medico_id ?? 0,
              paciente_id: paciente.id,
              paciente_nombre: nombrePaciente,
              registro_numero: 'Atención con archivos',
              medico_nombre: nombreCompleto(user),
            }}
            onItemsCountChange={setExamCount}
          />
        </div>,
        document.body,
      )}

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