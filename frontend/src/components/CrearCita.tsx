import React, { useState } from 'react';
import { createCita, type CitaPayload } from '../api/citas';
import './CrearCita.css';

interface CrearCitaProps {
  paciente?: { id?: number | null; nombres?: string; apellidos?: string } | null;
  onClose?: () => void;
  onSuccess?: (data: any) => void;
}

const DEFAULT_MEDICO_ID = 1;
const DEFAULT_CONSULTORIO_ID = 1;

const CrearCita: React.FC<CrearCitaProps> = ({ paciente, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<CitaPayload>({
    paciente_id: paciente?.id ?? 0,
    medico_id: DEFAULT_MEDICO_ID,
    consultorio_id: DEFAULT_CONSULTORIO_ID,
    fecha: new Date().toISOString().split('T')[0],
    hora_inicio: new Date().toTimeString().slice(0, 5),
    hora_fin: '',
    motivo: '',
    estado_id: 1,
  });

  const [loading, setLoading] = useState(false);
  const [folio] = useState(`#${Math.floor(Math.random() * 900000 + 100000)}`);

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
    try {
      const payload: CitaPayload = {
        ...formData,
        motivo: motivo,
        medico_id: DEFAULT_MEDICO_ID,
        consultorio_id: DEFAULT_CONSULTORIO_ID,
        hora_fin: null,
      };

      const data = await createCita(payload);
      alert('✅ Cita agendada exitosamente');

      if (onSuccess) onSuccess(data);

      const now = new Date();
      setFormData({
        paciente_id: paciente?.id ?? 0,
        medico_id: DEFAULT_MEDICO_ID,
        consultorio_id: DEFAULT_CONSULTORIO_ID,
        fecha: now.toISOString().split('T')[0],
        hora_inicio: now.toTimeString().slice(0, 5),
        hora_fin: '',
        motivo: '',
        estado_id: 1,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la cita.';
      console.error('Error al guardar la cita:', error);
      alert('❌ Ocurrió un error al guardar la cita: ' + message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container historia-modal">
      

      <div className="header">
        <i className="fas fa-calendar-plus"></i>
        <h1>Agendar Cita</h1>
        <span>{folio}</span>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="section">
          <div className="section-title">
            <i className="fas fa-user"></i>
            Datos de la Cita
          </div>

          <div className="row row-2">
            <div className="field-group">
              <label htmlFor="estado_id">Estado *</label>
              <select
                id="estado_id"
                name="estado_id"
                value={formData.estado_id}
                onChange={handleChange}
                required
              >
                <option value={1}>Pendiente</option>
                <option value={2}>Confirmada</option>
                <option value={3}>Cancelada</option>
                <option value={4}>Atendida</option>
              </select>
            </div>
          </div>

          <div className="row row-2">
            <div className="field-group">
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
            <div className="field-group">
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

          <div className="field-group" style={{ marginTop: '1.2rem' }}>
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

        <button type="submit" className="btn-save-modern" disabled={loading}>
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i> Guardando...
            </>
          ) : (
            <>
              <i className="fas fa-save"></i> Guardar Cita
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default CrearCita;