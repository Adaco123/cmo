import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faMobileScreenButton, faCircleCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import {
  iniciarCapturaQr,
  getEstadoCapturaQr,
  iniciarCapturaQrPaciente,
  getEstadoCapturaQrPaciente,
} from '../../api/archivos';
import { useErrorToast } from '../../components/ErrorToastProvider';
import styles from './CapturaQrModal.module.css';

export interface CapturaQrDestino {
  tipo: 'examen' | 'paciente';
  id: number;
}

interface Props {
  destino: CapturaQrDestino;
  /** Título/subtítulo del modal (nombre del examen, o del paciente si aún no hay examen). */
  examenNombre: string;
  onClose: () => void;
  /** Se llama cada vez que se detecta una foto nueva, para refrescar la galería.
   * Opcional: no hace falta si quien usa el modal ya reacciona por foto vía onFotoNueva. */
  onFotosActualizadas?: () => void;
  /** Se llama en cuanto se genera el sid, para que el padre pueda acumularlo
   * (ej. Examenes.tsx, que necesita descartar la sesión si se cancela el registro). */
  onSesionIniciada?: (sid: string) => void;
  /** Se llama una vez por cada archivo_id nuevo detectado en el polling, en
   * orden de llegada. Pensado para sesiones transitorias (destino paciente
   * desde Examenes.tsx): quien use el modal descarga esa foto y la reubica
   * (ej. como File[] pendiente de un examen), y borra la copia del servidor. */
  onFotoNueva?: (archivoId: number) => void;
}

const INTERVALO_POLLING_MS = 3000;

const CapturaQrModal: React.FC<Props> = ({ destino, examenNombre, onClose, onFotosActualizadas, onSesionIniciada, onFotoNueva }) => {
  const { showErrorFrom } = useErrorToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fotosPreviasRef = useRef(0);
  // Ids de archivo ya notificados vía onFotoNueva, para no repetirlos en
  // pollings sucesivos (el endpoint de estado devuelve la lista completa).
  const archivoIdsVistosRef = useRef<Set<number>>(new Set());

  const [sid, setSid] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [conectado, setConectado] = useState(false);
  const [fotosCount, setFotosCount] = useState(0);
  const [cerrada, setCerrada] = useState(false);
  const [cargando, setCargando] = useState(true);

  // ---- Iniciar la sesión de captura al abrir el modal ----
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const data = destino.tipo === 'examen'
          ? await iniciarCapturaQr(destino.id)
          : await iniciarCapturaQrPaciente(destino.id);
        if (cancelado) return;
        setSid(data.sid);
        setSegundosRestantes(data.expira_en_segundos);
        setUrl(`${window.location.origin}/capturar-fotos/${data.token}`);
        onSesionIniciada?.(data.sid);
      } catch (err) {
        showErrorFrom(err, 'No se pudo generar el código QR.');
        onClose();
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino.tipo, destino.id]);

  // ---- Dibujar el QR una vez que tenemos la URL ----
  useEffect(() => {
    if (url && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, { width: 220, margin: 1 }).catch(() => {
        showErrorFrom(null, 'No se pudo dibujar el código QR.');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // ---- Cuenta regresiva ----
  useEffect(() => {
    if (!sid || cerrada || segundosRestantes <= 0) return;
    const t = setInterval(() => setSegundosRestantes((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [sid, cerrada, segundosRestantes]);

  // ---- Polling de estado ----
  useEffect(() => {
    if (!sid || cerrada || segundosRestantes <= 0) return;

    const consultar = async () => {
      try {
        const estado = destino.tipo === 'examen'
          ? await getEstadoCapturaQr(destino.id, sid)
          : await getEstadoCapturaQrPaciente(destino.id, sid);
        setConectado(estado.conectado);
        setFotosCount(estado.fotos_count);
        setCerrada(estado.cerrada);
        if (estado.fotos_count > fotosPreviasRef.current) {
          fotosPreviasRef.current = estado.fotos_count;
          onFotosActualizadas?.();
        }
        for (const archivoId of estado.archivo_ids) {
          if (!archivoIdsVistosRef.current.has(archivoId)) {
            archivoIdsVistosRef.current.add(archivoId);
            onFotoNueva?.(archivoId);
          }
        }
      } catch {
        // Un error puntual de polling no debe tumbar el modal; se reintenta solo.
      }
    };

    consultar();
    const t = setInterval(consultar, INTERVALO_POLLING_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid, cerrada, segundosRestantes <= 0]);

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = segundosRestantes % 60;
  const expirado = !cargando && segundosRestantes <= 0 && !cerrada;

  return (
    <div className={styles.capturaQrModal}>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <button type="button" className={styles.cerrar} onClick={onClose} aria-label="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <h3 className={styles.titulo}>Agregar fotografías</h3>
        <p className={styles.subtitulo}>{examenNombre}</p>

        {cargando && (
          <div className={styles.cargando}>
            <FontAwesomeIcon icon={faSpinner} spin /> Generando código...
          </div>
        )}

        {!cargando && url && !cerrada && !expirado && (
          <>
            <canvas ref={canvasRef} className={styles.qr} />
            <p className={styles.ayuda}>Escanea este código con la cámara de tu celular</p>
            <p className={styles.tiempo}>
              Código válido durante {minutos}:{String(segundos).padStart(2, '0')}
            </p>
            <div className={styles.estado}>
              {conectado ? (
                <span className={styles.estadoOk}>
                  <FontAwesomeIcon icon={faMobileScreenButton} /> Celular conectado
                </span>
              ) : (
                <span className={styles.estadoEsperando}>
                  <FontAwesomeIcon icon={faSpinner} spin /> Esperando celular...
                </span>
              )}
              {fotosCount > 0 && (
                <span className={styles.estadoFotos}> {fotosCount} fotografía{fotosCount === 1 ? '' : 's'} recibida{fotosCount === 1 ? '' : 's'}</span>
              )}
            </div>
          </>
        )}

        {expirado && (
          <p className={styles.expirado}>El código expiró. Cierra esta ventana y vuelve a intentarlo.</p>
        )}

        {cerrada && (
          <p className={styles.finalizado}>
            <FontAwesomeIcon icon={faCircleCheck} /> Captura finalizada — {fotosCount} fotografía{fotosCount === 1 ? '' : 's'} recibida{fotosCount === 1 ? '' : 's'}.
          </p>
        )}

        <button type="button" className={styles.btnCerrar} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
};

export default CapturaQrModal;