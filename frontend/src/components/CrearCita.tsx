import React, { useState } from 'react';
import { createCita, type CitaPayload } from '../api/citas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faSpinner, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import styles from './CrearCita.module.css';
import { useErrorToast } from './ErrorToastProvider';
import { extractErrorMessage } from '../utils/errors';

interface CrearCitaProps {
  paciente?: { id?: number | null; nombres?: string; apellidos?: string } | null;
  /** Cierra el modal. Se usa tanto para el botón "x" como para el click
   *  en el fondo (backdrop). */
  onClose?: () => void;
  onSuccess?: (data: any) => void;
}

const DEFAULT_MEDICO_ID = 1;
const DEFAULT_CONSULTORIO_ID = 1;

/** "YYYY-MM-DD" en fecha LOCAL, a diferencia de toISOString() que usa UTC
 *  y puede adelantar un día en horas de la noche (Bolivia es UTC-4). */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Suma 1 hora a un "HH:MM" y maneja el desborde de medianoche (23:30 -> 00:30). */
function sumarUnaHora(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const fecha = new Date();
  fecha.setHours(h + 1, m, 0, 0);
  return fecha.toTimeString().slice(0, 5);
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
  const [formData, setFormData] = useState<CitaPayload>({
    paciente_id: paciente?.id ?? 0,
    medico_id: DEFAULT_MEDICO_ID,
    consultorio_id: DEFAULT_CONSULTORIO_ID,
    fecha: toLocalDateString(new Date()),
    hora_inicio: new Date().toTimeString().slice(0, 5),
    hora_fin: '',
    motivo: '',
    estado_id: 1,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const motivo = formData.motivo?.trim() ?? '';

  if (!formData.paciente_id || !formData.fecha || !formData.hora_inicio || !motivo) {
    alert('Por favor completa todos los campos obligatorios (*)');
    return;
  }

  setLoading(true);
  setError(null);
  try {
    const payload: CitaPayload = {
      ...formData,
      motivo: motivo,
      medico_id: DEFAULT_MEDICO_ID,
      consultorio_id: DEFAULT_CONSULTORIO_ID,
      hora_fin: sumarUnaHora(formData.hora_inicio),
    };

    const data = await createCita(payload);
    showSuccess('Cita agendada exitosamente');

    if (onSuccess) onSuccess(data);

    const now = new Date();
    setFormData({
      paciente_id: paciente?.id ?? 0,
      medico_id: DEFAULT_MEDICO_ID,
      consultorio_id: DEFAULT_CONSULTORIO_ID,
      fecha: toLocalDateString(now),
      hora_inicio: now.toTimeString().slice(0, 5),
      hora_fin: '',
      motivo: '',
      estado_id: 1,
    });
  } catch (err) {
    const mensaje = extractErrorMessage(err, 'No se pudo guardar la cita.');
    setError(mensaje);
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

        <form onSubmit={handleSubmit}>
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
                  <option value={1}>Pendiente</option>
                  <option value={2}>Cancelada</option>
                  
                </select>
              </div>
            </div>

            <div className={`${styles.row} ${styles.rowTwo}`}>
              <div className={styles.fieldGroup}>
                <label htmlFor="fecha">Fecha *</label>
                <input
                  type="date"
                  id="fecha"
                  name="fecha"
                  value={formData.fecha}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="hora_inicio">Hora inicio *</label>
                <input
                  type="time"
                  id="hora_inicio"
                  name="hora_inicio"
                  value={formData.hora_inicio}
                  onChange={handleChange}
                  required
                />
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
          {error && <p className={styles.errorText}>{error}</p>}
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
    </div>
  );
};

export default CrearCita;