import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRefresh, faPen, faSave, faSpinner, faXmark, faCalendarCheck } from '@fortawesome/free-solid-svg-icons';
import { type Paciente } from '../../../api/pacientes';
import { type SeguimientoControl, getSeguimientos, updateSeguimientoControl } from '../../../api/seguimientoControl';
import { type Cita, getCitas, updateCita } from '../../../api/citas';
import { type EstadoCita, getEstadosCita } from '../../../api/estadosCita';
import ViewButton from '../../../components/ui/ViewButton';
import { useErrorToast } from '../../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../../utils/errors';
import styles from './Seguimientocontroltab.module.css';

interface SeguimientoControlTabProps {
  active: boolean;
  pacientes: Paciente[];
  searchValue: string;
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
const SeguimientoControlTab: React.FC<SeguimientoControlTabProps> = ({ active, pacientes, searchValue, onVer }) => {
  const { showErrorFrom, showSuccess } = useErrorToast();

  const [citas, setCitas] = useState<Cita[]>([]);
  const [seguimientos, setSeguimientos] = useState<SeguimientoControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  const [editando, setEditando] = useState<FilaAgenda | null>(null);

  const cargar = () => {
    setLoading(true);
    setError(null);
    Promise.all([getCitas(), getSeguimientos()])
      .then(([citasData, seguimientosData]) => {
        setCitas(citasData);
        setSeguimientos(seguimientosData);
        setCargado(true);
      })
      .catch(() => setError('No se pudo cargar la agenda de citas y controles.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (active && !cargado && !loading) {
      cargar();
    }
  }, [active, cargado, loading]);

  const buscarPaciente = (pacienteId: number) => pacientes.find((p) => p.id === pacienteId) || null;

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
    .sort((a, b) => (b.fechaAgenda || '').localeCompare(a.fechaAgenda || ''));

  return (
    <div className={`tab-content ${active ? 'active' : ''}`}>
      <div className="table-card scroll-animated">
        <div className="card-header">
          <h3>Citas con seguimiento control</h3>
          <button type="button" className="glow-btn" onClick={cargar} disabled={loading}>
            <FontAwesomeIcon icon={faRefresh} className={loading ? 'spin' : ''} /> Actualizar
          </button>
        </div>

        {loading && !cargado ? (
          <div className="today-appointments-empty">Cargando agenda...</div>
        ) : error ? (
          <div className="today-appointments-empty">{error}</div>
        ) : filas.length === 0 ? (
          <div className="today-appointments-empty">No hay citas ni controles de seguimiento registrados.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Paciente</th>
                <th>Fecha</th>
                <th>Hora</th>
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
            if (filaActualizada.tipo === 'cita') {
              setCitas((prev) => prev.map((c) => (c.id === filaActualizada.cita.id ? filaActualizada.cita : c)));
            } else {
              setSeguimientos((prev) =>
                prev.map((s) => (s.id === filaActualizada.seguimiento.id ? filaActualizada.seguimiento : s)),
              );
            }
            setEditando(null);
            showSuccess(filaActualizada.tipo === 'cita' ? 'Cita actualizada.' : 'Seguimiento de control actualizado.');
          }}
          showErrorFrom={showErrorFrom}
        />
      )}
    </div>
  );
};

interface EditarFilaModalProps {
  fila: FilaAgenda;
  onClose: () => void;
  onGuardada: (fila: FilaAgenda) => void;
  showErrorFrom: (err: unknown, fallback: string) => void;
}

/**
 * Un solo modal para los dos tipos: cambia los campos que muestra según
 * fila.tipo, pero comparte backdrop/estructura/botones (Seguimientocontroltab.module.css).
 */
const EditarFilaModal: React.FC<EditarFilaModalProps> = ({ fila, onClose, onGuardada, showErrorFrom }) => {
  const esCita = fila.tipo === 'cita';

  const [fecha, setFecha] = useState(esCita ? fila.cita.fecha : (fila.seguimiento.proxima_fecha_control || ''));
  const [horaInicio, setHoraInicio] = useState((esCita ? fila.cita.hora_inicio : fila.seguimiento.hora_inicio) || '');
  const [horaFin, setHoraFin] = useState((esCita ? fila.cita.hora_fin : fila.seguimiento.hora_fin) || '');
  const [motivo, setMotivo] = useState(esCita ? (fila.cita.motivo || '') : '');
  const [estadoId, setEstadoId] = useState<number>(esCita ? fila.cita.estado_id : 0);
  const [estados, setEstados] = useState<EstadoCita[]>([]);
  const [evolucion, setEvolucion] = useState(esCita ? '' : fila.seguimiento.evolucion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!esCita) return;
    getEstadosCita()
      .then(setEstados)
      .catch(() => {
        // Si falla, el select queda solo con el estado actual (ver abajo) —
        // no bloquea poder editar motivo/fecha aunque no cargue el catálogo.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      if (esCita) {
        const citaActualizada = await updateCita(fila.cita.id, {
          fecha,
          hora_inicio: horaInicio || fila.cita.hora_inicio,
          hora_fin: horaFin || null,
          motivo,
          estado_id: estadoId,
        });
        onGuardada({ tipo: 'cita', fechaAgenda: citaActualizada.fecha, cita: citaActualizada, paciente: fila.paciente });
      } else {
        const seguimientoActualizado = await updateSeguimientoControl(fila.seguimiento.id, {
          evolucion,
          proxima_fecha_control: fecha || null,
          hora_inicio: horaInicio || null,
          hora_fin: horaFin || null,
        });
        onGuardada({
          tipo: 'seguimiento',
          fechaAgenda: seguimientoActualizado.proxima_fecha_control || seguimientoActualizado.fecha,
          seguimiento: seguimientoActualizado,
          paciente: fila.paciente,
        });
      }
    } catch (err) {
      const mensaje = extractErrorMessage(err, 'No se pudo guardar el cambio.');
      setError(mensaje);
      showErrorFrom(err, 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.page} onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Cerrar">
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <div className={styles.header}>
          <FontAwesomeIcon icon={faCalendarCheck} />
          <h2>{esCita ? 'Editar cita' : 'Editar seguimiento de control'}</h2>
        </div>

        {error && <div className={styles.error}>{error}</div>}

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
          <div className={styles.horaRow}>
            <input type="date" value={fecha || ''} onChange={(e) => setFecha(e.target.value)} />
            <input type="time" value={horaInicio ? horaInicio.slice(0, 5) : ''} onChange={(e) => setHoraInicio(e.target.value)} />
            <input type="time" value={horaFin ? horaFin.slice(0, 5) : ''} onChange={(e) => setHoraFin(e.target.value)} />
          </div>
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
  );
};

export default SeguimientoControlTab;