import React, { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faClock } from '@fortawesome/free-solid-svg-icons';
import { type Cita } from '../../api/citas';
import { type Paciente } from '../../api/pacientes';
import styles from './Calendario.module.css';

interface CalendarioProps {
  /** Debe incluir TODAS las citas (no solo las de hoy) para poder marcar
   *  cualquier fecha en el calendario. Si en InicioTab solo tienes
   *  `citasHoy`, pide/trae la lista completa desde el padre (CMODashboard),
   *  donde probablemente ya la usas para la pestaña "Citas". */
  citas: Cita[];
  pacientes: Paciente[];
  onClose: () => void;
  onSelectCita?: (cita: Cita) => void;
}

/**
 * Extrae 'YYYY-MM-DD' de un campo fecha (string ISO o Date).
 * OJO: asumo que tu tipo `Cita` tiene un campo `fecha`. Si en tu API se
 * llama distinto (ej. `fecha_cita`), cambia las 2 referencias a
 * `cita.fecha` de abajo.
 */
function toDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

const Calendario: React.FC<CalendarioProps> = ({ citas, pacientes, onClose, onSelectCita }) => {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  // Mapa fecha -> citas de ese día
  const citasPorFecha = useMemo(() => {
    const map = new Map<string, Cita[]>();
    citas.forEach((cita) => {
      const fecha = (cita as any).fecha;
      if (!fecha) return;
      const key = toDateKey(fecha);
      const arr = map.get(key) ?? [];
      arr.push(cita);
      map.set(key, arr);
    });
    return map;
  }, [citas]);

  const diasConCitas = useMemo(
    () => Array.from(citasPorFecha.keys()).map((key) => new Date(`${key}T00:00:00`)),
    [citasPorFecha]
  );

  const citasDelDiaSeleccionado = selectedDay ? citasPorFecha.get(toDateKey(selectedDay)) ?? [] : [];

  const nombrePaciente = (pacienteId: number) => {
    const p = pacientes.find((x) => x.id === pacienteId);
    return p ? `${p.nombres} ${p.apellidos}`.trim() : `Paciente #${pacienteId}`;
  };

  return (
    <div className="historia-backdrop" onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>Calendario de citas</h3>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className={styles.body}>
          <DayPicker
            mode="single"
            locale={es}
            selected={selectedDay}
            onSelect={setSelectedDay}
            modifiers={{ conCitas: diasConCitas }}
            modifiersClassNames={{ conCitas: styles.diaConCitas, selected: styles.diaSeleccionado }}
            className={styles.dayPicker}
            classNames={{
              months: styles.months,
              month: styles.month,
              caption: styles.caption,
              caption_label: styles.captionLabel,
              nav: styles.nav,
              nav_button: styles.navButton,
              table: styles.table,
              head_row: styles.headRow,
              head_cell: styles.headCell,
              row: styles.row,
              cell: styles.cell,
              day: styles.day,
              day_today: styles.diaHoy,
              day_outside: styles.diaFuera,
            }}
          />

          <div className={styles.listaDia}>
            <h4>
              {selectedDay
                ? new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(
                    selectedDay
                  )
                : 'Selecciona un día'}
            </h4>

            {citasDelDiaSeleccionado.length === 0 ? (
              <p className={styles.sinCitas}>No hay citas registradas este día.</p>
            ) : (
              <ul className={styles.citasList}>
                {citasDelDiaSeleccionado.map((cita) => (
                  <li key={cita.id} className={styles.citaItem} onClick={() => onSelectCita?.(cita)}>
                    <span className={styles.citaHora}>
                      <FontAwesomeIcon icon={faClock} />{' '}
                      {cita.hora_inicio ? String(cita.hora_inicio).slice(0, 5) : '—'}
                    </span>
                    <span className={styles.citaNombre}>{nombrePaciente(cita.paciente_id)}</span>
                    <span className={styles.citaMotivo}>{cita.motivo || 'Sin motivo registrado'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendario;