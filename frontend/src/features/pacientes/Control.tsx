import React, { useState, useRef, useEffect } from 'react';
import { createSeguimientoControl } from '../../api/seguimientoControl';
import type { SeguimientoControlResponse } from '../../api/seguimientoControl';
import type { RegistroClinico } from '../../api/historialClinico';
import Receta from './Receta';
import type { RecetaHandle } from './Receta';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faSpinner, faSave, faCapsules, faXmark } from '@fortawesome/free-solid-svg-icons';
import styles from './Control.module.css';

// TODO: reemplazar por el id del médico autenticado cuando exista login real
const MEDICO_ID = 1;

/** "YYYY-MM-DD" en fecha LOCAL, a diferencia de toISOString() que usa UTC
 *  y puede adelantar un día en horas de la noche (Bolivia es UTC-4). */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface Props {
  registroClinico: RegistroClinico;
  pacienteNombre?: string;
  pacienteEdad?: string;
  pacienteCi?: string;
  alergias?: string;
  medicoNombre?: string;
  onSaved?: (resultado: SeguimientoControlResponse) => void;
  /** Cierra el modal. Se usa tanto para el botón "x" como para "Cancelar"
   *  y para el click en el fondo (backdrop). */
  onClose?: () => void;
}

const CONTROL_CHIPS: { label: string; val: string }[] = [
  { label: '7 días', val: '7' },
  { label: '15 días', val: '15' },
  { label: '1 mes', val: '30' },
  { label: 'Alta / sin control', val: '' },
];

/**
 * Modal de consulta control. Es autocontenido: renderiza su propio
 * backdrop + botón de cerrar, así que el componente que lo usa
 * (VerPaciente.tsx) solo necesita montarlo condicionalmente, sin
 * envolverlo en su propio wrapper de modal:
 *
 *   {showControl && registroMasReciente && (
 *     <Control registroClinico={...} onClose={...} onSaved={...} />
 *   )}
 */
const Control: React.FC<Props> = ({
  registroClinico,
  pacienteNombre = '—',
  pacienteEdad = '—',
  pacienteCi = '—',
  alergias = '',
  medicoNombre = 'Dr. Miguel',
  onSaved,
  onClose,
}) => {
  const [evolucion, setEvolucion] = useState('');
  const [controlDias, setControlDias] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const evolucionRef = useRef<HTMLTextAreaElement>(null);

  // ---------- receta del seguimiento ----------
  const [drawerRxOpen, setDrawerRxOpen] = useState(false);
  const recetaRef = useRef<RecetaHandle>(null);
  const [tieneReceta, setTieneReceta] = useState(false);

  useEffect(() => {
    evolucionRef.current?.focus();
  }, []);

  const proximaFechaControl = (() => {
    if (!controlDias.trim()) return null;
    const d = new Date();
    d.setDate(d.getDate() + parseInt(controlDias, 10));
    return toLocalDateString(d);
  })();

  const proximaFechaLegible = proximaFechaControl
    ? new Date(proximaFechaControl + 'T00:00:00').toLocaleDateString('es-BO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null;

  // Se llama cuando el doctor cierra el drawer de receta (con o sin guardar líneas)
  const handleCerrarReceta = () => {
    setDrawerRxOpen(false);
    const payload = recetaRef.current?.getPayload();
    setTieneReceta(!!payload);
  };

  const handleGuardar = async () => {
    const texto = evolucion.trim();
    if (!texto) {
      setError('Escribe cómo sigue el paciente antes de guardar.');
      evolucionRef.current?.focus();
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const recetaPayload = recetaRef.current?.getPayload();

      const resultado = await createSeguimientoControl(registroClinico.id, {
        medico_id: MEDICO_ID,
        evolucion: texto,
        proxima_fecha_control: proximaFechaControl,
        hora_inicio: horaInicio.trim() || null,
        hora_fin: horaFin.trim() || null,
        recetas: recetaPayload || {},
      });

      recetaRef.current?.reset();
      onSaved?.(resultado);
    } catch (err) {
      setError('No se pudo guardar el control. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={() => onClose?.()}>
      <div className={styles.page} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}

        <div className={styles.header}>
          <FontAwesomeIcon icon={faCalendarCheck} className={styles.headerIcon} />
          <div>
            <h2>Consulta control</h2>
            <p className={styles.contexto}>
              Sobre el registro del <b>{registroClinico.fecha}</b>
              {registroClinico.motivo_consulta && ` · ${registroClinico.motivo_consulta}`}
              {registroClinico.diagnostico && ` · Dx: ${registroClinico.diagnostico}`}
            </p>
          </div>
        </div>

        <div className={styles.field}>
          <label>¿Cómo sigue el paciente?</label>
          <textarea
            ref={evolucionRef}
            rows={4}
            placeholder="Ej: Sigue con fiebre, se ajusta antibiótico..."
            value={evolucion}
            onChange={(e) => setEvolucion(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label>Próximo control</label>
          <div className={styles.chips}>
            {CONTROL_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                className={`${styles.chip} ${controlDias === c.val ? styles.active : ''}`}
                onClick={() => setControlDias(c.val)}
              >
                {c.label}
              </button>
            ))}
          </div>
          {proximaFechaLegible && <div className={styles.subhint}>Próximo control: {proximaFechaLegible}</div>}
          {controlDias.trim() && (
            <div className={styles.horaRow}>
              <span>Hora</span>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              <span>a</span>
              <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
              <span className={styles.subhint}>(opcional)</span>
            </div>
          )}
        </div>

        {/* ---- Receta del seguimiento (opcional) ---- */}
        <div className={styles.field}>
          <label>Receta</label>
          <button
            type="button"
            className={`${styles.btnRx} ${tieneReceta ? styles.btnRxActive : ''}`}
            onClick={() => setDrawerRxOpen(true)}
          >
            <FontAwesomeIcon icon={faCapsules} />
            {tieneReceta ? 'Receta agregada — editar' : 'Recetar en este control'}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          {onClose && (
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={saving}>
              Cancelar
            </button>
          )}
          <button type="button" className={styles.btnSave} onClick={handleGuardar} disabled={saving}>
            {saving ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faSave} />}
            {saving ? 'Guardando...' : 'Guardar seguimiento'}
          </button>
        </div>

        {/* ---- Drawer de receta, reutilizado tal cual ---- */}
        <Receta
          ref={recetaRef}
          isOpen={drawerRxOpen}
          onClose={handleCerrarReceta}
          pacienteNombre={pacienteNombre}
          pacienteEdad={pacienteEdad}
          pacienteCi={pacienteCi}
          alergias={alergias}
          medicoNombre={medicoNombre}
        />
      </div>
    </div>
  );
};

export default Control;