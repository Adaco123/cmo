import React, { useState, useEffect } from 'react';
import { createPaciente, type PacientePayload } from '../../api/pacientes';
import styles from './PacienteForm.module.css';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserPlus,
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
} from "@fortawesome/free-solid-svg-icons";

interface PacienteFormData {
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

const CONSULTORIO_ID = 1;
const ORIGEN_MIS_PACIENTES = 1;
const ORIGEN_EXTERNO = 2;

interface PacienteFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

const initialFormData: PacienteFormData = {
  nombres: '',
  apellidos: '',
  documento: '',
  fecha_nacimiento: '',
  sexo: '',
  direccion: '',
  telefono: '',
  correo: '',
  origen_id: '',
  medico_referente_externo: '',
  consultorio_id: '',
  estado: true,
};

const PacienteForm: React.FC<PacienteFormProps> = ({ onSuccess, onClose }) => {
  const [currentDate, setCurrentDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [formData, setFormData] = useState<PacienteFormData>({
    ...initialFormData,
    origen_id: String(ORIGEN_MIS_PACIENTES),
    consultorio_id: String(CONSULTORIO_ID),
  });

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    );
  }, []);

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

    const sexoMap: Record<string, PacientePayload['sexo']> = {
      masculino: 'M',
      femenino: 'F',
      otro: 'O',
    };

    const normalizeOptional = (value: string) => (value.trim() ? value.trim() : null);

    const payload: PacientePayload = {
      nombres: formData.nombres.trim(),
      apellidos: formData.apellidos.trim(),
      documento: formData.documento.trim(),
      fecha_nacimiento: formData.fecha_nacimiento,
      sexo: sexoMap[formData.sexo] ?? 'O',
      direccion: normalizeOptional(formData.direccion),
      telefono: normalizeOptional(formData.telefono),
      correo: normalizeOptional(formData.correo),

      origen_id: Number(formData.origen_id || ORIGEN_MIS_PACIENTES),
      medico_referente_externo: normalizeOptional(formData.medico_referente_externo),
      consultorio_id: Number(formData.consultorio_id || CONSULTORIO_ID),
      estado: formData.estado,
    };

    try {
      setIsSubmitting(true);
      await createPaciente(payload);
      setFormData({
        ...initialFormData,
        origen_id: String(ORIGEN_MIS_PACIENTES),
        consultorio_id: String(CONSULTORIO_ID),
      });
      onSuccess?.();
      alert(' Paciente guardado correctamente');
    } catch (error: any) {
      const data = error?.response?.data;
      const primerErrorMarshmallow =
        data && typeof data === 'object'
          ? Object.values(data).flat().find((v) => typeof v === 'string')
          : undefined;
      const backendMessage = data?.error || data?.msg || primerErrorMarshmallow || error?.message;
      setSubmitError(backendMessage || 'No se pudo guardar el paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <FontAwesomeIcon icon={faUserPlus} />
        <h1>Nuevo Paciente</h1>
        <span className={styles.headerDate}>
          <FontAwesomeIcon icon={faCalendarAlt} /> Fecha: <span>{currentDate}</span>
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

          {/* 3. Datos Médicos y Administrativos */}
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
          <FontAwesomeIcon icon={faSave} /> {isSubmitting ? 'Guardando...' : 'Guardar Paciente'}
        </button>
      </form>
    </div>
  );
};

export default PacienteForm;