import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createCita, type CitaPayload, type Cita } from '../api/citas';
import { type EstadoCita } from '../api/estadosCita';
import Calendario from '../features/citas/Calendario';
import { useCalendario } from './CalendarioProvider';
import { useAuth } from './AuthProvider';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faSpinner, faFloppyDisk, faXmark, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import styles from './CrearCita.module.css';
import { useErrorToast } from './ErrorToastProvider';
import { extractErrorMessage } from '../utils/errors';

interface CrearCitaProps {
  paciente?: { id?: number | null; nombres?: string; apellidos?: string } | null;
  /** Cierra el modal. Se usa tanto para el botón "x" como para el click
   *  en el fondo (backdrop). */
  onClose?: () => void;
  onSuccess?: (data: Cita) => void;
}

// Fallback solo por si el Provider todavía no resolvió el usuario
// (o no hay sesión) — en circunstancias normales se usa medicoId, que
// sale del médico realmente logueado (ver useAuth() abajo).
const DEFAULT_MEDICO_ID = 1;
const DEFAULT_CONSULTORIO_ID = 1;

/** "YYYY-MM-DD" -> "DD/MM/AAAA" (mismo formato que usa Control.tsx). */
function formatFechaLegible(fechaYmd: string): string {
  return new Date(fechaYmd + 'T00:00:00').toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Suma 1 hora a un "HH:MM" y maneja el desborde de medianoche (23:30 -> 00:30). */
/** "HH:MM" + minutos -> "HH:MM". */
function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const fecha = new Date();
  fecha.setHours(h, m + minutos, 0, 0);
  return fecha.toTimeString().slice(0, 5);
}
/** Nombre del estado que se usa por defecto al agendar una cita nueva. */
const NOMBRE_ESTADO_POR_DEFECTO = 'Programada';

function idEstadoPorDefecto(lista: EstadoCita[]): number {
  return lista.find((e) => e.nombre === NOMBRE_ESTADO_POR_DEFECTO)?.id ?? lista[0]?.id ?? 0;
}

/**
 * Modal para agendar una cita. Es autocontenido: renderiza su propio
 * backdrop + botón de cerrar, así que el componente que lo usa
 * (VerPaciente.tsx, PacienteExterno.tsx, etc.) solo necesita montarlo
 * condicionalmente, sin envolverlo en su propio wrapper de modal:
 *
 *   {showCrearCita && (
 *     <CrearCita paciente={paciente} onClose={...} onSuccess={...} />
 *   )}
 */
const CrearCita: React.FC<CrearCitaProps> = ({ paciente, onClose, onSuccess }) => {
  const { user } = useAuth();
  // Usuario.id es string (viene del backend así); medico_id en los
  // payloads es number. Si por algo no hay usuario o el id no es
  // numérico, cae al fallback en vez de mandar NaN al backend.
  const medicoId = Number(user?.id) || DEFAULT_MEDICO_ID;

  const [formData, setFormData] = useState<CitaPayload>({
    paciente_id: paciente?.id ?? 0,
    medico_id: medicoId,
    consultorio_id: DEFAULT_CONSULTORIO_ID,
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    motivo: '',
    estado_id: 0,
  });

  // ---------- calendario para elegir la fecha (atajo visual, opcional) ----------
  const calendarioControl = useCalendario();
  const estados = calendarioControl.estadosCita;

  useEffect(() => {
    // Si ninguna otra pantalla ya cargó la agenda (citas/estados/etc.),
    // la disparamos acá — CrearCita puede montarse fuera del dashboard
    // (ej. desde VerPaciente en /historia-clinica), donde nadie más la
    // pidió todavía. Si ya está cargada, agendaCargada evita repetir el
    // fetch.
    if (!calendarioControl.agendaCargada && !calendarioControl.loading) {
      calendarioControl.refrescarAgenda();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estados.length > 0) {
      setFormData((prev) => ({ ...prev, estado_id: prev.estado_id || idEstadoPorDefecto(estados) }));
    }
  }, [estados]);

  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useErrorToast();
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: ['paciente_id', 'estado_id'].includes(name)
        ? Number(value)
        : value,
    }));
  };

  // hora_fin se calcula sola: hora de inicio + 45 min (igual que Control.tsx).
  const horaFin = (() => {
    if (!formData.hora_inicio) return '';
    const calculada = sumarMinutos(formData.hora_inicio, 45);
    // Si cruza medianoche, no hay hora_fin automática válida — se manda null.
    return calculada > formData.hora_inicio ? calculada : '';
  })();

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const motivo = formData.motivo?.trim() ?? '';

  // Validación propia (el <form> lleva noValidate): así ningún aviso sale
  // como tooltip nativo del navegador, todo pasa por el toast.
  if (!formData.paciente_id) {
    showError('No hay un paciente seleccionado.');
    return;
  }
  if (!formData.estado_id) {
    showError('Selecciona el estado de la cita.');
    return;
  }
  if (!formData.fecha) {
    showError('Elige la fecha de la cita.');
    return;
  }
  if (!formData.hora_inicio) {
    showError('Indica la hora de la cita.');
    return;
  }
  if (!motivo) {
    showError('Escribe el motivo de la cita.');
    return;
  }

  setLoading(true);
  try {
    const payload: CitaPayload = {
      ...formData,
      motivo: motivo,
      medico_id: medicoId,
      consultorio_id: DEFAULT_CONSULTORIO_ID,
      hora_fin: horaFin || null,
    };

    const data = await createCita(payload);
    showSuccess('Cita agendada exitosamente');

    // La cita se creó en el backend pero el estado compartido de
    // CalendarioProvider (citas/seguimientos) no se entera solo —
    // sin esto, la agenda del día / calendario seguían mostrando la
    // lista vieja hasta recargar la página.
    calendarioControl.refrescarAgenda();

    if (onSuccess) onSuccess(data);

    setFormData({
      paciente_id: paciente?.id ?? 0,
      medico_id: medicoId,
      consultorio_id: DEFAULT_CONSULTORIO_ID,
      fecha: '',
      hora_inicio: '',
      hora_fin: '',
      motivo: '',
      estado_id: idEstadoPorDefecto(estados),
    });
  } catch (err) {
    const mensaje = extractErrorMessage(err, 'No se pudo guardar la cita.');
    showError(mensaje);
  } finally {
    setLoading(false);
  }
};

  return (
    <div className={styles.backdrop} onClick={() => onClose?.()}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}

        <div className={styles.header}>
          <h1>Agendar Cita</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <FontAwesomeIcon icon={faUser} />
              Datos de la Cita
            </div>

            <div className={`${styles.row} ${styles.rowTwo}`}>
              <div className={styles.fieldGroup}>
                <label htmlFor="estado_id">Estado *</label>
                <select
                  id="estado_id"
                  name="estado_id"
                  value={formData.estado_id}
                  onChange={handleChange}
                  required
                >
                  <option value={0} disabled>Selecciona un estado</option>
                  {estados.map((estado) => (
                    <option key={estado.id} value={estado.id}>
                      {estado.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.fieldGroup}>
                <label htmlFor="fecha">Fecha y hora *</label>
                <div className={styles.chips}>
                  <button
                    type="button"
                    id="fecha"
                    className={styles.chip}
                    onClick={calendarioControl.abrir}
                  >
                    <FontAwesomeIcon icon={faCalendarDays} /> {formData.fecha ? formatFechaLegible(formData.fecha) : 'Elegir fecha'}
                  </button>
                </div>
                {formData.fecha && (
                  <div className={styles.horaRow}>
                    <span>Hora</span>
                    <input
                      type="time"
                      name="hora_inicio"
                      value={formData.hora_inicio}
                      onChange={handleChange}
                      required
                    />
                    <span>a</span>
                    <input type="time" value={horaFin} disabled title="Se calcula sola: hora de inicio + 45 min" style={{ opacity: 0.75, cursor: 'not-allowed' }} />
                    <span className={styles.subhint}>(+45 min automático)</span>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.fieldGroup} style={{ marginTop: '1.2rem' }}>
              <label htmlFor="motivo">Motivo de la Cita *</label>
              <textarea
                id="motivo"
                name="motivo"
                rows={3}
                value={formData.motivo ?? ''}
                onChange={handleChange}
                placeholder="Describe brevemente el motivo de la consulta..."
                required
              />
            </div>
          </div>
          <button type="submit" className={styles.btnGuardar} disabled={loading}>
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Guardando...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faFloppyDisk} /> Guardar Cita
              </>
            )}
          </button>
        </form>
      </div>

      {calendarioControl.abierto &&
        createPortal(
          <Calendario
            citas={calendarioControl.citas}
            seguimientos={calendarioControl.seguimientos}
            pacientes={calendarioControl.pacientes}
            onClose={calendarioControl.cerrar}
            onConfirmarFecha={(fecha) => {
              setFormData((prev) => ({ ...prev, fecha }));
              calendarioControl.cerrar();
            }}
          />,
          document.body,
        )}
      {calendarioControl.abierto && calendarioControl.loading &&
        createPortal(
          <div className="today-appointments-empty" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 200 }}>
            Cargando datos del calendario...
          </div>,
          document.body,
        )}
      {calendarioControl.abierto && calendarioControl.error &&
        createPortal(
          <div className="today-appointments-empty" style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 200 }}>
            {calendarioControl.error}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default CrearCita;