import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faCircleCheck, faRotateLeft, faTrash, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { getInfoCapturaQr, subirFotoCapturaQr, eliminarFotoCapturaQr, finalizarCapturaQr } from '../../api/archivos';
import { extractErrorMessage } from '../../utils/errors';
import styles from './CapturarFotos.module.css';

interface FotoTomada {
  archivoId: number;
  previewUrl: string;
}

/**
 * Página pública (sin login) que se abre en el celular al escanear el QR
 * generado desde RegistroClinicoDetalle.tsx. Todo lo que llama a la API
 * aquí usa el `token` de la URL, no un JWT — ver captura_qr.py en el backend.
 */
const CapturarFotos: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cargando, setCargando] = useState(!!token);
  const [errorInicial, setErrorInicial] = useState<string | null>(token ? null : 'Enlace inválido.');
  const [nombreExamen, setNombreExamen] = useState('');
  const [pacienteNombre, setPacienteNombre] = useState('');

  const [errorCamara, setErrorCamara] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [fotos, setFotos] = useState<FotoTomada[]>([]);
  const [finalizado, setFinalizado] = useState(false);

  // ---- Validar el token y traer los datos del examen ----
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const info = await getInfoCapturaQr(token);
        setNombreExamen(info.nombre_examen);
        setPacienteNombre(info.paciente_nombre);
      } catch (err) {
        setErrorInicial(extractErrorMessage(err, 'Este código QR ya no es válido o expiró.'));
      } finally {
        setCargando(false);
      }
    })();
  }, [token]);

  // ---- Abrir la cámara (trasera de preferencia) una vez validado el token ----
  useEffect(() => {
    if (cargando || errorInicial || finalizado) return;

    let cancelado = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        if (!cancelado) setErrorCamara('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    })();

    return () => {
      cancelado = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cargando, errorInicial, finalizado]);

  const tomarFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    setPreviewUrl(canvas.toDataURL('image/jpeg', 0.92));
  };

  const repetirFoto = () => setPreviewUrl(null);

  const guardarFoto = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !token) return;
    setSubiendo(true);
    try {
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.92),
      );
      const archivo = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const subida = await subirFotoCapturaQr(token, archivo);
      setFotos((prev) => [...prev, { archivoId: subida.id, previewUrl: canvas.toDataURL('image/jpeg', 0.7) }]);
      setPreviewUrl(null);
    } catch (err) {
      setErrorCamara(extractErrorMessage(err, 'No se pudo subir la fotografía. Intenta de nuevo.'));
    } finally {
      setSubiendo(false);
    }
  };

  const eliminarFoto = async (archivoId: number) => {
    if (!token) return;
    try {
      await eliminarFotoCapturaQr(token, archivoId);
      setFotos((prev) => prev.filter((f) => f.archivoId !== archivoId));
    } catch (err) {
      setErrorCamara(extractErrorMessage(err, 'No se pudo eliminar la fotografía.'));
    }
  };

  const finalizar = async () => {
    if (!token) return;
    try {
      await finalizarCapturaQr(token);
    } catch {
      // Aunque falle la llamada de "finalizar" ya subimos las fotos; no bloqueamos el cierre.
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setFinalizado(true);
  };

  if (cargando) {
    return <div className={styles.capturarFotos}><p className={styles.mensaje}>Cargando...</p></div>;
  }

  if (errorInicial) {
    return (
      <div className={styles.capturarFotos}>
        <div className={styles.mensajeError}>
          <FontAwesomeIcon icon={faTriangleExclamation} />
          <p>{errorInicial}</p>
        </div>
      </div>
    );
  }

  if (finalizado) {
    return (
      <div className={styles.capturarFotos}>
        <div className={styles.mensajeFinal}>
          <FontAwesomeIcon icon={faCircleCheck} />
          <p>Fotografías enviadas. Ya puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.capturarFotos}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Paciente</span>
        <span className={styles.headerValor}>{pacienteNombre}</span>
        <span className={styles.headerLabel}>Examen</span>
        <span className={styles.headerValor}>{nombreExamen}</span>
      </div>

      {errorCamara && (
        <div className={styles.avisoCamara}>
          <FontAwesomeIcon icon={faTriangleExclamation} /> {errorCamara}
        </div>
      )}

      <div className={styles.visor}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={styles.video}
          style={{ display: previewUrl ? 'none' : 'block' }}
        />
        {previewUrl && <img src={previewUrl} alt="Vista previa" className={styles.video} />}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {previewUrl ? (
        <div className={styles.accionesPreview}>
          <button type="button" className={styles.btnSecundario} onClick={repetirFoto} disabled={subiendo}>
            <FontAwesomeIcon icon={faRotateLeft} /> Repetir
          </button>
          <button type="button" className={styles.btnPrincipal} onClick={guardarFoto} disabled={subiendo}>
            {subiendo ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      ) : (
        <button type="button" className={styles.btnTomarFoto} onClick={tomarFoto}>
          <FontAwesomeIcon icon={faCamera} /> Tomar foto
        </button>
      )}

      {fotos.length > 0 && (
        <>
          <p className={styles.contador}>Fotografías tomadas: {fotos.length}</p>
          <div className={styles.grid}>
            {fotos.map((f) => (
              <div key={f.archivoId} className={styles.miniatura}>
                <img src={f.previewUrl} alt="" />
                <button type="button" className={styles.btnEliminarMini} onClick={() => eliminarFoto(f.archivoId)} aria-label="Eliminar">
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <button type="button" className={styles.btnFinalizar} onClick={finalizar} disabled={!!previewUrl}>
        <FontAwesomeIcon icon={faCircleCheck} /> Finalizar
      </button>
    </div>
  );
};

export default CapturarFotos;