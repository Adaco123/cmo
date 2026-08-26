import React, { useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faClock } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { type Cita } from '../../api/citas';
import { type Paciente } from '../../api/pacientes';
import { type SeguimientoControl } from '../../api/seguimientoControl';
import styles from './Calendario.module.css';

interface CalendarioProps {
  citas: Cita[];
  seguimientos: SeguimientoControl[];
  pacientes: Paciente[];
  onClose: () => void;
  onSelectCita?: (cita: Cita) => void;
}

function toDateKey(value: string | Date): string {
  if (typeof value === 'string') {
    const soloFecha = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (soloFecha) return `${soloFecha[1]}-${soloFecha[2]}-${soloFecha[3]}`;
  }
  const d = typeof value === 'string' ? new Date(value) : value;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toWhatsAppNumber(telefono: string): string {
  const digits = telefono.replace(/\D/g, '');
  return digits.startsWith('591') ? digits : `591${digits}`;
}

function buildWhatsAppUrl(telefono: string, mensaje: string): string {
  return `https://wa.me/${toWhatsAppNumber(telefono)}?text=${encodeURIComponent(mensaje)}`;
}

function mensajeRecordatorio(nombrePaciente: string, fechaLabel: string, hora: string, motivo?: string | null): string {
  const motivoTexto = motivo ? ` Motivo: ${motivo}.` : '';
  return `Hola ${nombrePaciente}, te recordamos tu cita en CMO el ${fechaLabel} a las ${hora}.${motivoTexto}`;
}

function mensajeSeguimiento(nombrePaciente: string, fechaLabel: string, evolucion?: string | null): string {
  const evolucionTexto = evolucion ? ` Evolución: ${evolucion}.` : '';
  return `Hola ${nombrePaciente}, te recordamos tu seguimiento de control en CMO el ${fechaLabel}.${evolucionTexto}`;
}

const Calendario: React.FC<CalendarioProps> = ({ citas, seguimientos, pacientes, onClose, onSelectCita }) => {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

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

  const seguimientosPorFecha = useMemo(() => {
    const map = new Map<string, SeguimientoControl[]>();
    seguimientos.forEach((s) => {
      if (!s.fecha) return;
      const key = toDateKey(s.fecha);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    });
    return map;
  }, [seguimientos]);

  const diasConCitas = useMemo(
    () => Array.from(citasPorFecha.keys()).map((key) => new Date(`${key}T00:00:00`)),
    [citasPorFecha]
  );

  const diasConSeguimientos = useMemo(
    () => Array.from(seguimientosPorFecha.keys()).map((key) => new Date(`${key}T00:00:00`)),
    [seguimientosPorFecha]
  );

  const citasDelDiaSeleccionado = selectedDay ? citasPorFecha.get(toDateKey(selectedDay)) ?? [] : [];
  const seguimientosDelDiaSeleccionado = selectedDay
    ? seguimientosPorFecha.get(toDateKey(selectedDay)) ?? []
    : [];

  const pacienteDe = (pacienteId: number): Paciente | undefined =>
    pacientes.find((x) => x.id === pacienteId);

  const nombrePaciente = (pacienteId: number) => {
    const p = pacienteDe(pacienteId);
    return p ? `${p.nombres} ${p.apellidos}`.trim() : `Paciente #${pacienteId}`;
  };

  const fechaLabel = selectedDay
    ? new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long', year: 'numeric' }).format(selectedDay)
    : '';

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
            modifiers={{ conCitas: diasConCitas, conSeguimientos: diasConSeguimientos }}
            modifiersClassNames={{
              conCitas: styles.diaConCitas,
              conSeguimientos: styles.diaConSeguimientos,
            }}
            className={styles.dayPicker}
            classNames={{
              months: styles.months,
              month: styles.month,
              month_caption: styles.caption,
              caption_label: styles.captionLabel,
              nav: styles.nav,
              button_previous: styles.navButton,
              button_next: styles.navButton,
              month_grid: styles.table,
              weekday: styles.headCell,
              day: styles.cell,
              day_button: styles.day,
              today: styles.diaHoy,
              outside: styles.diaFuera,
              selected: styles.diaSeleccionado,
            }}
          />

          <div className={styles.listaDia}>
            <h4>{fechaLabel || 'Selecciona un día'}</h4>
            <h4 className={styles.subtitulo}>Citas</h4>
            {citasDelDiaSeleccionado.length === 0 ? (
              <p className={styles.sinCitas}>No hay citas registradas este día.</p>
            ) : (
              <ul className={styles.citasList}>
                {citasDelDiaSeleccionado.map((cita) => {
                  const paciente = pacienteDe(cita.paciente_id);
                  const hora = cita.hora_inicio ? String(cita.hora_inicio).slice(0, 5) : '—';

                  return (
                    <li key={cita.id} className={styles.citaItem} onClick={() => onSelectCita?.(cita)}>
                      <div className={styles.citaItemTop}>
                        <div className={styles.citaItemInfo}>
                          <span className={styles.citaHora}>
                            <FontAwesomeIcon icon={faClock} /> {hora}
                          </span>
                          <span className={styles.citaNombre}>{nombrePaciente(cita.paciente_id)}</span>
                          <span className={styles.citaMotivo}>{cita.motivo || 'Sin motivo registrado'}</span>
                        </div>

                        {paciente?.telefono && (
                          <a
                            className={styles.whatsappBtn}
                            href={buildWhatsAppUrl(
                              paciente.telefono,
                              mensajeRecordatorio(nombrePaciente(cita.paciente_id), fechaLabel, hora, cita.motivo)
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Enviar recordatorio por WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FontAwesomeIcon icon={faWhatsapp} />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {seguimientosDelDiaSeleccionado.length > 0 && (
              <>
                <h4 className={styles.subtitulo}>Seguimientos de control</h4>
                <ul className={styles.citasList}>
                  {seguimientosDelDiaSeleccionado.map((s) => (
                    <li key={s.id} className={styles.citaItem}>
                      <div className={styles.citaItemTop}>
                        <div className={styles.citaItemInfo}>
                          <span className={styles.citaNombre}>{nombrePaciente(s.paciente_id)}</span>
                          <span className={styles.citaMotivo}>{s.evolucion}</span>
                          {s.proxima_fecha_control && (
                            <span className={styles.citaMotivo}>
                              Próximo control: {s.proxima_fecha_control}
                            </span>
                          )}
                        </div>

                        {pacienteDe(s.paciente_id)?.telefono && (
                          <a
                            className={styles.whatsappBtn}
                            href={buildWhatsAppUrl(
                              pacienteDe(s.paciente_id)!.telefono!,
                              mensajeSeguimiento(
                                nombrePaciente(s.paciente_id),
                                new Intl.DateTimeFormat('es-BO', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                }).format(new Date(`${toDateKey(s.fecha)}T00:00:00`)),
                                s.evolucion
                              )
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Enviar recordatorio por WhatsApp"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FontAwesomeIcon icon={faWhatsapp} />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendario;