import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRefresh, faPen, faSave, faSpinner, faXmark, faCalendarCheck, faCalendarDays } from '@fortawesome/free-solid-svg-icons';
import { type Paciente } from '../../../api/pacientes';
import { type SeguimientoControl } from '../../../api/seguimientoControl';
import { type Cita } from '../../../api/citas';
import { useCalendario } from '../../../components/CalendarioProvider';
import Calendario from '../../../features/citas/Calendario';
import ViewButton from '../../../components/ui/ViewButton';
import { useErrorToast } from '../../../components/ErrorToastProvider';
import styles from './Seguimientocontroltab.module.css';

interface SeguimientoControlTabProps {
  active: boolean;
  pacientes: Paciente[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onVer: (paciente: Paciente) => void;
}

type FilaAgenda =
  | { tipo: 'cita'; fechaAgenda: string; cita: Cita; paciente: Paciente | null }
  | { tipo: 'seguimiento'; fechaAgenda: string; seguimiento: SeguimientoControl; paciente: Paciente | null };

/** "YYYY-MM-DD" -> "DD/MM/YYYY", igual que el resto de fechas en el dashboard. */
function formatFecha(fecha?: string | null): string {
  if (!fecha) return '—';
  const [year, month, day] = fecha.slice(0, 10).split('-');
  if (!year || !month || !day) return fecha;
  return `${day}/${month}/${year}`;
}

function formatHora(inicio?: string | null, fin?: string | null): string {
  if (!inicio) return '—';
  const corta = (h: string) => h.slice(0, 5);
  return fin ? `${corta(inicio)} - ${corta(fin)}` : corta(inicio);
}

/** "YYYY-MM-DD" en fecha LOCAL, para comparar contra fechaAgenda sin líos de UTC. */
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** "HH:MM" + minutos -> "HH:MM" (misma lógica que Control.tsx y CrearCita.tsx). */
function sumarMinutos(hora: string, minutos: number): string {
  const [h, m] = hora.split(':').map(Number);
  const fecha = new Date();
  fecha.setHours(h, m + minutos, 0, 0);
  return fecha.toTimeString().slice(0, 5);
}

/** Nombre del estado -> clase de color del badge (ver .badge-estado en
 * Dashboardpage.css). Por nombre, nunca por id — los ids del catálogo
 * pueden variar entre instalaciones. */
function claseEstado(nombre: string): string {
  const norm = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (norm.includes('program')) return 'programada';
  if (norm.includes('cancel')) return 'cancelada';
  if (norm.includes('asisti')) return 'no-asistio';
  return 'otro';
}

/**
 * Reemplaza la pestaña "Modelos" (data estática de prueba) por una agenda
 * combinada de Citas + Seguimientos de control, cada quien con su color
 * (ver .badge-tipo en Dashboardpage.css), editable haciendo click en el
 * lápiz de cada fila.
 *
 * Para Citas se reusa updateCita (ya existía con soporte de edición
 * parcial). Para Seguimientos se agregó updateSeguimientoControl, que
 * llama al nuevo PUT /api/historial_clinico/seguimientos/<id>.
 *
 * La "fecha de agenda" que se usa para ordenar y mostrar es: cita.fecha
 * para citas, y seguimiento.proxima_fecha_control para seguimientos (la
 * fecha del PRÓXIMO control agendado, no la fecha de la nota de
 * evolución) — es la fecha comparable a una cita, ambas son "cuándo es
 * lo próximo". Si un seguimiento no tiene próximo control (alta), se usa
 * su propia fecha como respaldo solo para no desaparecer de la lista.
 */
const SeguimientoControlTab: React.FC<SeguimientoControlTabProps> = ({ active, pacientes, searchValue, onSearchChange, onVer }) => {
  const { showSuccess } = useErrorToast();

  const {
    citas,
    seguimientos,
    estadosCita,
    agendaCargada,
    loading,
    error,
    refrescarAgenda,
  } = useCalendario();
  const [verHistorialCompleto, setVerHistorialCompleto] = useState(false);

  const [editando, setEditando] = useState<FilaAgenda | null>(null);

  useEffect(() => {
    if (active && !agendaCargada && !loading) {
      refrescarAgenda();
    }
  }, [active, agendaCargada, loading, refrescarAgenda]);

  const buscarPaciente = (pacienteId: number) => pacientes.find((p) => p.id === pacienteId) || null;
  const nombreEstado = (estadoId: number) => estadosCita.find((e) => e.id === estadoId)?.nombre ?? null;

  const hoyStr = toLocalDateString(new Date());

  const filas: FilaAgenda[] = [
    ...citas.map((cita): FilaAgenda => ({
      tipo: 'cita',
      fechaAgenda: cita.fecha,
      cita,
      paciente: buscarPaciente(cita.paciente_id),
    })),
    ...seguimientos.map((seguimiento): FilaAgenda => ({
      tipo: 'seguimiento',
      fechaAgenda: seguimiento.proxima_fecha_control || seguimiento.fecha,
      seguimiento,
      paciente: buscarPaciente(seguimiento.paciente_id),
    })),
  ]
    .filter((fila) => {
      if (!searchValue) return true;
      const nombre = fila.paciente ? `${fila.paciente.nombres} ${fila.paciente.apellidos}` : '';
      return nombre.toLowerCase().includes(searchValue.toLowerCase());
    })
    .filter((fila) => verHistorialCompleto || (fila.fechaAgenda || '') >= hoyStr)
    .sort((a, b) => (a.fechaAgenda || '').localeCompare(b.fechaAgenda || ''));

  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <div className="table-card scroll-animated">
        <div className="card-header">
          <h3>Citas con seguimiento control</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="glow-btn"
                style={!verHistorialCompleto ? undefined : { opacity: 0.55 }}
                onClick={() => setVerHistorialCompleto(false)}
              >
                Próximas
              </button>
              <button
                type="button"
                className="glow-btn"
                style={verHistorialCompleto ? undefined : { opacity: 0.55 }}
                onClick={() => setVerHistorialCompleto(true)}
              >
                Ver historial completo
              </button>
            </div>
            <div className="search-table">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por paciente..."
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
            <button type="button" className="glow-btn" onClick={refrescarAgenda} disabled={loading}>
              <FontAwesomeIcon icon={faRefresh} className={loading ? 'spin' : ''} /> Actualizar
            </button>
          </div>
        </div>

        {loading && !agendaCargada ? (
          <div className="today-appointments-empty">Cargando agenda...</div>
        ) : error ? (
          <div className="today-appointments-empty">{error}</div>
        ) : filas.length === 0 ? (
          <div className="today-appointments-empty">
            {verHistorialCompleto ? 'No hay citas ni controles de seguimiento registrados.' : 'No hay citas ni controles próximos.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Paciente</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Estado</th>
                <th>Detalle</th>
                <th>Ver</th>
                <th>Editar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => {
                const key = fila.tipo === 'cita' ? `cita-${fila.cita.id}` : `seguimiento-${fila.seguimiento.id}`;
                const detalle = fila.tipo === 'cita' ? (fila.cita.motivo || 'Sin motivo registrado') : fila.seguimiento.evolucion;
                const hora = fila.tipo === 'cita'
                  ? formatHora(fila.cita.hora_inicio, fila.cita.hora_fin)
                  : formatHora(fila.seguimiento.hora_inicio, fila.seguimiento.hora_fin);
                const estadoNombre = fila.tipo === 'cita' ? nombreEstado(fila.cita.estado_id) : null;

                return (
                  <tr key={key}>
                    <td>
                      <span className={`badge-tipo ${fila.tipo}`}>
                        {fila.tipo === 'cita' ? 'Cita' : 'Seguimiento'}
                      </span>
                    </td>
                    <td className="patient-name">
                      {fila.paciente
                        ? `${fila.paciente.nombres} ${fila.paciente.apellidos}`
                        : `Paciente #${fila.tipo === 'cita' ? fila.cita.paciente_id : fila.seguimiento.paciente_id}`}
                    </td>
                    <td>{formatFecha(fila.fechaAgenda)}</td>
                    <td>{hora}</td>
                    <td>
                      {estadoNombre ? (
                        <span className={`badge-estado ${claseEstado(estadoNombre)}`}>{estadoNombre}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="diagnostico-cell">{detalle}</td>
                    <td>
                      {fila.paciente ? (
                        <ViewButton name={`${fila.paciente.nombres} ${fila.paciente.apellidos}`} onClick={() => onVer(fila.paciente as Paciente)} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <button type="button" className="view-btn" title="Editar" onClick={() => setEditando(fila)}>
                        <FontAwesomeIcon icon={faPen} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editando && (
        <EditarFilaModal
          fila={editando}
          onClose={() => setEditando(null)}
          onGuardada={(filaActualizada) => {
            // Ya no hace falta mergear el resultado a mano acá: actualizarCita
            // / actualizarSeguimiento (llamados dentro de EditarFilaModal) ya
            // actualizaron el array compartido en CalendarioProvider, y este
            // componente lee `citas`/`seguimientos` de ahí — se re-renderiza solo.
            setEditando(null);
            showSuccess(filaActualizada.tipo === 'cita' ? 'Cita actualizada.' : 'Seguimiento de control actualizado.');
          }}
        />
      )}
    </div>
  );
};

interface EditarFilaModalProps {
  fila: FilaAgenda;
  onClose: () => void;
  onGuardada: (fila: FilaAgenda) => void;
}

/**
 * Un solo modal para los dos tipos: cambia los campos que muestra según
 * fila.tipo, pero comparte backdrop/estructura/botones (Seguimientocontroltab.module.css).
 *
 * Fecha y hora se eligen igual que en Control.tsx / CrearCita.tsx: chip que
 * abre el calendario compartido + hora de inicio editable + hora de fin
 * automática (inicio + 45 min). Todos los avisos van por el toast.
 */
const EditarFilaModal: React.FC<EditarFilaModalProps> = ({ fila, onClose, onGuardada }) => {
  const esCita = fila.tipo === 'cita';
  const { showError, showErrorFrom } = useErrorToast();
  const calendarioControl = useCalendario();
  const { estadosCita: estados, actualizarCita, actualizarSeguimiento } = calendarioControl;

  const horaInicioOriginal = ((esCita ? fila.cita.hora_inicio : fila.seguimiento.hora_inicio) || '').slice(0, 5);
  const horaFinOriginal = ((esCita ? fila.cita.hora_fin : fila.seguimiento.hora_fin) || '').slice(0, 5);

  const [fecha, setFecha] = useState<string | null>(
    esCita ? fila.cita.fecha : (fila.seguimiento.proxima_fecha_control || null),
  );
  const [horaInicio, setHoraInicio] = useState(horaInicioOriginal);
  const [motivo, setMotivo] = useState(esCita ? (fila.cita.motivo || '') : '');
  const [estadoId, setEstadoId] = useState<number>(esCita ? fila.cita.estado_id : 0);
  const [evolucion, setEvolucion] = useState(esCita ? '' : fila.seguimiento.evolucion);
  const [guardando, setGuardando] = useState(false);

  // hora_fin se calcula sola (inicio + 45 min), igual que en Control/CrearCita.
  // Si no se tocó la hora de inicio, se respeta la hora de fin que ya tenía
  // el registro para no cambiarla sin querer al editar solo otro campo.
  const horaFinCalculada = (() => {
    if (!horaInicio) return '';
    const calculada = sumarMinutos(horaInicio, 45);
    // Si cruza medianoche, no hay hora_fin automática válida.
    return calculada > horaInicio ? calculada : '';
  })();
  const conservaHoraOriginal = !!horaFinOriginal && horaInicio === horaInicioOriginal;
  const horaFin = conservaHoraOriginal ? horaFinOriginal : horaFinCalculada;

  const guardar = async () => {
    if (esCita) {
      if (!motivo.trim()) {
        showError('Escribe el motivo de la cita.');
        return;
      }
      if (!estadoId) {
        showError('Selecciona el estado de la cita.');
        return;
      }
      if (!fecha) {
        showError('Elige la fecha de la cita.');
        return;
      }
      if (!horaInicio) {
        showError('Indica la hora de la cita.');
        return;
      }
    } else if (!evolucion.trim()) {
      showError('Escribe cómo sigue el paciente antes de guardar.');
      return;
    }

    setGuardando(true);
    try {
      if (esCita) {
        const citaActualizada = await actualizarCita(fila.cita.id, {
          fecha: fecha as string,
          hora_inicio: horaInicio,
          hora_fin: horaFin || null,
          motivo: motivo.trim(),
          estado_id: estadoId,
        });
        onGuardada({ tipo: 'cita', fechaAgenda: citaActualizada.fecha, cita: citaActualizada, paciente: fila.paciente });
      } else {
        const seguimientoActualizado = await actualizarSeguimiento(fila.seguimiento.id, {
          evolucion: evolucion.trim(),
          proxima_fecha_control: fecha,
          // Sin próxima fecha (alta / sin control) no hay hora que guardar.
          hora_inicio: fecha ? (horaInicio || null) : null,
          hora_fin: fecha ? (horaFin || null) : null,
        });
        onGuardada({
          tipo: 'seguimiento',
          fechaAgenda: seguimientoActualizado.proxima_fecha_control || seguimientoActualizado.fecha,
          seguimiento: seguimientoActualizado,
          paciente: fila.paciente,
        });
      }
    } catch (err) {
      showErrorFrom(err, 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose}>
        <div className={styles.page} onClick={(e) => e.stopPropagation()}>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
            <FontAwesomeIcon icon={faXmark} />
          </button>

          <div className={styles.header}>
            <FontAwesomeIcon icon={faCalendarCheck} />
            <h2>{esCita ? 'Editar cita' : 'Editar seguimiento de control'}</h2>
          </div>

          {esCita ? (
            <div className={styles.field}>
              <label>Motivo</label>
              <input type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la cita" />
            </div>
          ) : (
            <div className={styles.field}>
              <label>Evolución</label>
              <textarea value={evolucion} onChange={(e) => setEvolucion(e.target.value)} placeholder="Evolución del paciente" />
            </div>
          )}

          {esCita && (
            <div className={styles.field}>
              <label>Estado</label>
              <select
                className={styles.select}
                value={estadoId}
                onChange={(e) => setEstadoId(Number(e.target.value))}
              >
                {estados.length === 0 && <option value={estadoId}>Estado actual (#{estadoId})</option>}
                {estados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label>{esCita ? 'Fecha de la cita' : 'Próxima fecha de control'}</label>
            <div className={styles.chips}>
              {!esCita && (
                <button
                  type="button"
                  className={`${styles.chip} ${fecha === null ? styles.active : ''}`}
                  onClick={() => {
                    setFecha(null);
                    setHoraInicio('');
                  }}
                >
                  Alta / sin control
                </button>
              )}
              <button type="button" className={styles.chip} onClick={calendarioControl.abrir}>
                <FontAwesomeIcon icon={faCalendarDays} /> {fecha ? formatFecha(fecha) : 'Elegir fecha'}
              </button>
            </div>
            {fecha && (
              <div className={styles.horaRow}>
                <span>Hora</span>
                <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                <span>a</span>
                <input
                  type="time"
                  value={horaFin}
                  disabled
                  title="Se calcula sola: hora de inicio + 45 min"
                  style={{ opacity: 0.75, cursor: 'not-allowed' }}
                />
                <span className={styles.subhint}>
                  {conservaHoraOriginal ? '(hora fin original)' : '(+45 min automático)'}
                </span>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnGhost} onClick={onClose} disabled={guardando}>
              Cancelar
            </button>
            <button type="button" className={styles.btnSave} onClick={guardar} disabled={guardando}>
              <FontAwesomeIcon icon={guardando ? faSpinner : faSave} className={guardando ? 'spin' : ''} />
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {/* Fuera del backdrop del modal: los eventos de un portal suben por el
          árbol de React, y así un click en el fondo del calendario no cierra
          también este modal. */}
      {calendarioControl.abierto &&
        createPortal(
          <Calendario
            citas={calendarioControl.citas}
            seguimientos={calendarioControl.seguimientos}
            pacientes={calendarioControl.pacientes}
            onClose={calendarioControl.cerrar}
            onConfirmarFecha={(nuevaFecha) => {
              setFecha(nuevaFecha);
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
    </>
  );
};

export default SeguimientoControlTab;