import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { descargarArchivoBlob, getArchivosPorExamen, type ArchivoResponse } from '../../api/archivos';
import { updateObservacionesExamen, type ExamenComplementario } from '../../api/examenesComplementarios';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../utils/errors';
import CapturaQrModal from './CapturaQrModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faExpand, faFilePdf, faPen } from '@fortawesome/free-solid-svg-icons';
// Mismos estilos que las tarjetas de examen de RegistroClinicoDetalle.
import styles from './RegistroClinicoDetalle.module.css';

const esPdf = (nombre: string) => nombre.toLowerCase().endsWith('.pdf');

interface Props {
  examen: ExamenComplementario;
  /** Se llama con el examen actualizado (p. ej. tras guardar observaciones). */
  onActualizado: (examen: ExamenComplementario) => void;
  /** Abre la imagen/PDF en el visor de la tarjeta de la atención. */
  onAbrirArchivo: (archivo: ArchivoResponse, url: string) => void;
}

/**
 * Examen complementario de una atención sin registro clínico. Igual que en
 * RegistroClinicoDetalle: si fue solicitado en una receta nace "Pendiente" y
 * se completa después (observaciones, fotos por QR o galería). Los exámenes
 * se piden al guardar la atención; acá solo se completan.
 */
const ExamenAtencionCard: React.FC<Props> = ({ examen, onActualizado, onAbrirArchivo }) => {
  const { showError } = useErrorToast();
  const [imagenes, setImagenes] = useState<{ archivo: ArchivoResponse; url: string }[]>([]);
  const [cargado, setCargado] = useState(false);
  const [idx, setIdx] = useState(0);
  const [qrAbierto, setQrAbierto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);
  const urlsRef = useRef<string[]>([]);

  const cargarGaleria = useCallback(async () => {
    try {
      const archivos = await getArchivosPorExamen(examen.id);
      const conUrl = await Promise.all(
        archivos.map(async (archivo) => {
          const url = URL.createObjectURL(await descargarArchivoBlob(archivo.id));
          urlsRef.current.push(url);
          return { archivo, url };
        }),
      );
      setImagenes(conUrl);
    } catch {
      // Sin galería: el examen igual se muestra.
    } finally {
      setCargado(true);
    }
  }, [examen.id]);

  useEffect(() => {
    void cargarGaleria();
    const urls = urlsRef;
    return () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    };
  }, [cargarGaleria]);

  const esPendiente =
    examen.receta_examen_id != null && !examen.resultado && !examen.observaciones && cargado && imagenes.length === 0;
  const activa = imagenes[Math.min(idx, Math.max(imagenes.length - 1, 0))];

  const guardarObs = async () => {
    setGuardando(true);
    try {
      const actualizado = await updateObservacionesExamen(examen.id, obs);
      onActualizado({ ...examen, observaciones: actualizado.observaciones });
      setEditando(false);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, 'No se pudieron guardar las observaciones.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.examCard}>
      <div className={styles.examHead}>
        <div className={styles.examHeadInfo}>
          <span className={styles.examNombre}>{examen.nombre_examen}</span>
          {examen.categoria?.nombre && <span className={styles.examCategoria}>{examen.categoria.nombre}</span>}
          {esPendiente && <span className={styles.examPendiente}>Pendiente</span>}
        </div>
        <button type="button" className={styles.btnAgregarFotos} onClick={() => setQrAbierto(true)}>
          <FontAwesomeIcon icon={faCamera} /> Agregar fotografías
        </button>
      </div>
      {examen.resultado && <p className={styles.examResultado}>{examen.resultado}</p>}

      <div className={styles.examObsEdit}>
        {editando ? (
          <>
            <textarea
              className={styles.examObsInput}
              rows={2}
              placeholder="Observaciones del médico..."
              autoFocus
              maxLength={300}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
            <button type="button" className={styles.btnGuardarObs} disabled={guardando} onClick={() => void guardarObs()}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        ) : (
          <>
            <p className={styles.examObsTexto}>{examen.observaciones || 'Sin observaciones'}</p>
            <button
              type="button"
              className={styles.btnEditarObs}
              aria-label="Editar observaciones"
              onClick={() => { setObs(examen.observaciones ?? ''); setEditando(true); }}
            >
              <FontAwesomeIcon icon={faPen} />
            </button>
          </>
        )}
      </div>

      {imagenes.length > 0 && activa && (
        <div className={styles.visor}>
          <button type="button" className={styles.visorMain} onClick={() => onAbrirArchivo(activa.archivo, activa.url)}>
            {esPdf(activa.archivo.nombre_archivo) ? (
              <div className={styles.visorPdfIco}>
                <FontAwesomeIcon icon={faFilePdf} />
                <span>{activa.archivo.nombre_archivo}</span>
              </div>
            ) : (
              <img src={activa.url} alt={activa.archivo.nombre_archivo} />
            )}
            {imagenes.length > 1 && (
              <span className={styles.visorBadge}>{Math.min(idx, imagenes.length - 1) + 1} / {imagenes.length}</span>
            )}
            <span className={styles.visorExpand} aria-hidden="true"><FontAwesomeIcon icon={faExpand} /></span>
          </button>
          {imagenes.length > 1 && (
            <div className={styles.visorThumbs}>
              {imagenes.map(({ archivo, url }, i) => (
                <button
                  key={archivo.id}
                  type="button"
                  className={`${styles.visorThumb} ${i === idx ? styles.active : ''}`}
                  onClick={() => setIdx(i)}
                >
                  {esPdf(archivo.nombre_archivo) ? (
                    <span className={styles.visorThumbPdfIco}><FontAwesomeIcon icon={faFilePdf} /></span>
                  ) : (
                    <img src={url} alt={archivo.nombre_archivo} loading="lazy" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {qrAbierto &&
        createPortal(
          <CapturaQrModal
            destino={{ tipo: 'examen', id: examen.id }}
            examenNombre={examen.nombre_examen}
            onClose={() => setQrAbierto(false)}
            onFotosActualizadas={() => cargarGaleria()}
          />,
          document.body,
        )}
    </div>
  );
};

export default ExamenAtencionCard;