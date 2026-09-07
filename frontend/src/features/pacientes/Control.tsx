import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createSeguimientoControl } from '../../api/seguimientoControl';
import type { SeguimientoControlResponse } from '../../api/seguimientoControl';
import type { RegistroClinico } from '../../api/historialClinico';
import Calendario from '../citas/Calendario';
import { useCalendarioData } from '../citas/hooks/Usecalendariodata';
import Receta from './Receta';
import type { RecetaHandle } from './Receta';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faSpinner, faSave, faCapsules, faXmark, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import styles from './Control.module.css';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../utils/errors';

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

/** "HH:MM" + minutos -> "HH:MM". Usado para calcular hora_fin sola, sin
 * dejar que se ingrese por teclado. */
function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const fecha = new Date();
  fecha.setHours(h, m + minutos, 0, 0);
  return fecha.toTimeString().slice(0, 5);
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
  const [controlFecha, setControlFecha] = useState<string | null>(null);
  const [horaInicio, setHoraInicio] = useState('');
  const horaFin = (() => {
    if (!horaInicio) return '';
    const calculada = sumarMinutos(horaInicio, 45);
    // Si cruza medianoche, no hay hora_fin automática válida — se manda null.
    return calculada > horaInicio ? calculada : '';
  })();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showError, showSuccess } = useErrorToast();
  const evolucionRef = useRef<HTMLTextAreaElement>(null);

  // ---------- calendario para elegir la fecha del próximo control ----------
  const calendarioControl = useCalendarioData();

  // ---------- receta del seguimiento ----------
  const [drawerRxOpen, setDrawerRxOpen] = useState(false);
  const recetaRef = useRef<RecetaHandle>(null);
  const [tieneReceta, setTieneReceta] = useState(false);

  useEffect(() => {
    evolucionRef.current?.focus();
  }, []);

  const proximaFechaControl = controlFecha;

  const proximaFechaLegible = proximaFechaControl
    ? new Date(proximaFechaControl + 'T00:00:00').toLocaleDateString('es-BO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : null;

  const fecha7DiasStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return toLocalDateString(d);
  })();

  const elegirChip = (val: string) => {
    if (val === '7') {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      setControlFecha(toLocalDateString(d));
    } else {
      setControlFecha(null);
    }
  };

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
        hora_fin: horaFin || null,
        recetas: recetaPayload || {},
      });

      recetaRef.current?.reset();
      showSuccess('Control guardado correctamente');
      onSaved?.(resultado);
    } catch (err) {
      const mensaje = extractErrorMessage(err, 'No se pudo guardar el control. Intenta de nuevo.');
      setError(mensaje);
      showError(mensaje);
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
                className={`${styles.chip} ${
                  (c.val === '7' && controlFecha === fecha7DiasStr) || (c.val === '' && controlFecha === null)
                    ? styles.active : ''
                }`}
                onClick={() => elegirChip(c.val)}
              >
                {c.label}
              </button>
            ))}
            <button type="button" className={styles.chip} onClick={calendarioControl.abrir}>
              <FontAwesomeIcon icon={faCalendarDays} /> {proximaFechaLegible ? proximaFechaLegible : 'Elegir fecha'}
            </button>
          </div>
          {controlFecha && (
            <div className={styles.horaRow}>
              <span>Hora</span>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
              <span>a</span>
              <input type="time" value={horaFin} disabled title="Se calcula sola: hora de inicio + 45 min" style={{ opacity: 0.75, cursor: 'not-allowed' }} />
              <span className={styles.subhint}>(+45 min automático)</span>
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

      {calendarioControl.abierto &&
        createPortal(
          <Calendario
            citas={calendarioControl.citas}
            seguimientos={calendarioControl.seguimientos}
            pacientes={calendarioControl.pacientes}
            onClose={calendarioControl.cerrar}
            onConfirmarFecha={(fecha) => {
              setControlFecha(fecha);
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

export default Control;