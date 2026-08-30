import React, { useState } from 'react';
import { updatePaciente, type Paciente, type PacientePayload } from '../../api/pacientes';
import styles from './PacienteForm.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserPen,
  faCalendarAlt,
  faIdCard,
  faUser,
  faIdBadge,
  faVenusMars,
  faMapPin,
  faPhoneAlt,
  faEnvelope,
  faHospital,
  faUserMd,
  faSave,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../utils/errors';

interface EditarPacienteFormData {
  nombres: string;
  apellidos: string;
  documento: string;
  fecha_nacimiento: string;
  sexo: string;
  direccion: string;
  telefono: string;
  correo: string;

  origen_id: string;
  medico_referente_externo: string;
  consultorio_id: string;
  estado: boolean;
}

const ORIGEN_EXTERNO = 2;
const ORIGEN_MIS_PACIENTES = 1;

/** 'M' | 'F' | 'O' -> valor de <select> del formulario */
const SEXO_BACKEND_A_FORM: Record<string, string> = {
  M: 'masculino',
  F: 'femenino',
  O: 'otro',
};

/** valor de <select> del formulario -> 'M' | 'F' | 'O' */
const SEXO_FORM_A_BACKEND: Record<string, PacientePayload['sexo']> = {
  masculino: 'M',
  femenino: 'F',
  otro: 'O',
};

function pacienteToFormData(paciente: Paciente): EditarPacienteFormData {
  return {
    nombres: paciente.nombres,
    apellidos: paciente.apellidos,
    documento: paciente.documento,
    fecha_nacimiento: paciente.fecha_nacimiento || '',
    sexo: SEXO_BACKEND_A_FORM[paciente.sexo] || '',
    direccion: paciente.direccion || '',
    telefono: paciente.telefono || '',
    correo: paciente.correo || '',
    origen_id: String(paciente.origen_id ?? ORIGEN_MIS_PACIENTES),
    medico_referente_externo: paciente.medico_referente_externo || '',
    consultorio_id: paciente.consultorio_id != null ? String(paciente.consultorio_id) : '',
    estado: paciente.estado ?? true,
  };
}

interface EditarPacienteFormProps {
  paciente: Paciente;
  onSuccess?: (pacienteActualizado: Paciente) => void;
  onClose?: () => void;
}

const EditarPacienteForm: React.FC<EditarPacienteFormProps> = ({ paciente, onSuccess, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditarPacienteFormData>(() => pacienteToFormData(paciente));
  const { showError, showSuccess } = useErrorToast();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.nombres.trim() || !formData.apellidos.trim() || !formData.documento.trim() || !formData.fecha_nacimiento || !formData.sexo) {
      setSubmitError('Completa los campos obligatorios antes de guardar.');
      return;
    }

    const normalizeOptional = (value: string) => (value.trim() ? value.trim() : null);

    const payload: Partial<PacientePayload> = {
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      documento: formData.documento.trim(),
      fecha_nacimiento: formData.fecha_nacimiento,
      sexo: SEXO_FORM_A_BACKEND[formData.sexo] ?? 'O',
      direccion: normalizeOptional(formData.direccion),
      telefono: normalizeOptional(formData.telefono),
      correo: normalizeOptional(formData.correo),

      origen_id: Number(formData.origen_id || ORIGEN_MIS_PACIENTES),
      medico_referente_externo: normalizeOptional(formData.medico_referente_externo),
      consultorio_id: formData.consultorio_id ? Number(formData.consultorio_id) : null,
      estado: formData.estado,
    };

    try {
      setIsSubmitting(true);
      const pacienteActualizado = await updatePaciente(paciente.id, payload);
      showSuccess('Paciente actualizado correctamente');
      onSuccess?.(pacienteActualizado);
    } catch (error: unknown) {
      const mensaje = extractErrorMessage(error, 'No se pudo actualizar el paciente.');
      setSubmitError(mensaje);
      showError(mensaje);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <FontAwesomeIcon icon={faUserPen} />
        <h1>Editar Paciente</h1>
        <span className={styles.headerDate}>
          <FontAwesomeIcon icon={faCalendarAlt} /> Ficha: <span>#{paciente.id}</span>
        </span>
        {onClose && (
          <button
            type="button"
            className={styles.closeIconBtn}
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.sectionsGrid}>
          {/* 1. Datos Personales */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <FontAwesomeIcon icon={faIdCard} />
              Datos Personales
            </div>
            <div className={`${styles.row} ${styles.rowThree}`}>
              <div className={styles.fieldGroup}>
                <label htmlFor="nombres"><FontAwesomeIcon icon={faUser} /> Nombres</label>
                <input
                  type="text"
                  id="nombres"
                  name="nombres"
                  placeholder="Ej: María José"
                  value={formData.nombres}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="apellidos"><FontAwesomeIcon icon={faUser} /> Apellidos</label>
                <input
                  type="text"
                  id="apellidos"
                  name="apellidos"
                  placeholder="Ej: González López"
                  value={formData.apellidos}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="documento"><FontAwesomeIcon icon={faIdBadge} /> Documento</label>
                <input
                  type="text"
                  id="documento"
                  name="documento"
                  placeholder="Ej: 12345678"
                  value={formData.documento}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className={`${styles.row} ${styles.rowThree}`}>
              <div className={styles.fieldGroup}>
                <label htmlFor="fecha_nacimiento"><FontAwesomeIcon icon={faCalendarAlt} /> Fecha de Nacimiento</label>
                <input
                  type="date"
                  id="fecha_nacimiento"
                  name="fecha_nacimiento"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="sexo"><FontAwesomeIcon icon={faVenusMars} /> Sexo</label>
                <select id="sexo" name="sexo" value={formData.sexo} onChange={handleChange}>
                  <option value="">Seleccione</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="direccion"><FontAwesomeIcon icon={faMapPin} /> Dirección</label>
                <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  placeholder="Ej: Calle Bolívar #123, La Paz"
                  value={formData.direccion}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={`${styles.row} ${styles.rowThree}`}>
              <div className={styles.fieldGroup}>
                <label htmlFor="telefono"><FontAwesomeIcon icon={faPhoneAlt} /> Teléfono</label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  placeholder="Ej: +591 71234567"
                  value={formData.telefono}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="correo"><FontAwesomeIcon icon={faEnvelope} /> Correo Electrónico</label>
                <input
                  type="email"
                  id="correo"
                  name="correo"
                  placeholder="Ej: maria@ejemplo.com"
                  value={formData.correo}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>

          {/* 2. Datos Médicos y Administrativos */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <FontAwesomeIcon icon={faUserMd} />
              Datos Médicos y Administrativos
            </div>
            <div className={`${styles.row} ${styles.rowThree}`}>
              <div className={styles.fieldGroup}>
                <label htmlFor="origen_id"><FontAwesomeIcon icon={faHospital} /> Origen</label>
                <select id="origen_id" name="origen_id" value={formData.origen_id} onChange={handleChange}>
                  <option value={String(ORIGEN_MIS_PACIENTES)}>Mis pacientes</option>
                  <option value={String(ORIGEN_EXTERNO)}>Externo</option>
                </select>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="medico_referente_externo"><FontAwesomeIcon icon={faUserMd} /> Médico Referente Externo</label>
                <input
                  type="text"
                  id="medico_referente_externo"
                  name="medico_referente_externo"
                  placeholder="Ej: Dr. López"
                  value={formData.medico_referente_externo}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={`${styles.row} ${styles.rowTwo}`}>
              <div className={styles.fieldGroup}>
                <label>Estado</label>
                <div className={styles.toggleWrapper}>
                  <span className={styles.toggleLabel}>Inactivo</span>
                  <label className={styles.toggleSwitch}>
                    <input
                      type="checkbox"
                      id="estado"
                      name="estado"
                      checked={formData.estado}
                      onChange={handleChange}
                    />
                    <span className={styles.slider}></span>
                  </label>
                  <span className={styles.toggleLabel}>Activo</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {submitError && <p className={styles.errorText}>{submitError}</p>}
        <button type="submit" className={styles.btnSaveModern} disabled={isSubmitting}>
          <FontAwesomeIcon icon={faSave} /> {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </form>
    </div>
  );
};

export default EditarPacienteForm;