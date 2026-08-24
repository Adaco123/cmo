import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Paciente as ApiPaciente } from '../../api/pacientes';
import { downloadRegistroClinicoPdf, getExpedientePaciente } from '../../api/historialClinico';
import type { RegistroClinico, RegistroCompletoResponse } from '../../api/historialClinico';
import type { SeguimientoControlResponse } from '../../api/seguimientoControl';
import HistoriaClinica from './RegistroClinico';
import RegistroClinicoDetalle from './RegistroClinicoDetalle';
import Control from './Control';
import CrearCita from '../../components/CrearCita.tsx';
import Cobrar from '../../features/pacientes/Cobrar';
import styles from './VerPaciente.module.css';
import '../../components/CrearCita.module.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarCheck,
  faCirclePlus,
  faStethoscope,
  faExclamationCircle,
  faFileMedicalAlt,
  faSpinner,
  faTriangleExclamation,
  faChevronDown,
  faEllipsisVertical,
  faPen,
  faTrash,
  faDownload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';

interface ExpedientePacienteResponse {
  paciente?: ApiPaciente;
  historia_clinica?: { id: number; fecha_apertura?: string | null; estado?: boolean };
  registros_clinicos?: RegistroClinico[];
}

interface VerPacienteProps {
  paciente?: ApiPaciente | null;
  onClose?: () => void;
}

/** Extrae un mensaje de error legible de una respuesta de la API, con fallback genérico. */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    err && typeof err === 'object' && 'response' in err &&
    err.response && typeof err.response === 'object' && 'data' in err.response &&
    err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data &&
    typeof err.response.data.error === 'string'
  ) {
    return err.response.data.error;
  }
  return fallback;
}

function formatearFechaRelativa(fechaStr: string): string {
  if (!fechaStr) return 'Sin fecha';
  const cleanDate = fechaStr.split('T')[0];
  const hoyStr = new Date().toISOString().split('T')[0];
  const hoyUTC = new Date(hoyStr);
  const fechaUTC = new Date(cleanDate);
  if (isNaN(fechaUTC.getTime())) return fechaStr;

  const diffDias = Math.floor((hoyUTC.getTime() - fechaUTC.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias === 0) return 'Hoy';
  if (diffDias === 1) return 'Ayer';
  if (diffDias < 7) return `Hace ${diffDias} días`;
  if (diffDias < 14) return 'Hace 1 semana';
  if (diffDias < 30) return `Hace ${Math.floor(diffDias / 7)} semanas`;
  const diffMeses = Math.floor(diffDias / 30.44);
  if (diffMeses < 12) return `Hace ${diffMeses} meses`;
  const años = Math.floor(diffMeses / 12);
  return `Hace ${años} año${años > 1 ? 's' : ''}`;
}

function getRegistroFechaValor(registro: RegistroClinico): number {
  if (!registro.fecha) return 0;
  const fechaHora = `${registro.fecha}${registro.hora ? `T${registro.hora}` : ''}`;
  const valor = Date.parse(fechaHora);
  return Number.isNaN(valor) ? 0 : valor;
}

/* ================= SUBCOMPONENTES ================= */

interface PacienteSidebarProps {
  nombrePaciente: string;
  paciente?: ApiPaciente | null;
  alergias: string[];
  onNuevaConsulta: () => void;
  onCrearCita: () => void;
  onConsultaControl: () => void;
  controlDisabled: boolean;
}

const PacienteSidebar: React.FC<PacienteSidebarProps> = ({
  nombrePaciente,
  paciente,
  alergias,
  onNuevaConsulta,
  onCrearCita,
  onConsultaControl,
  controlDisabled,
}) => (
  <aside className={styles.sidebar}>
    <div className={styles.pacienteCard}>
      <div className={styles.avatar}>{nombrePaciente.charAt(0) || '?'}</div>
      <h2 className={styles.pacienteNombre}>{nombrePaciente}</h2>
      {paciente?.edad != null && <p className={styles.pacienteMeta}>{paciente.edad} años</p>}
      {paciente?.documento && <p className={styles.pacienteMeta}>Doc: {paciente.documento}</p>}

      <div className={`${styles.alergiaBadge} ${alergias.length > 0 ? styles.alerta : ''}`}>
        <FontAwesomeIcon icon={faTriangleExclamation} />
        {alergias.length > 0 ? alergias.join(', ') : 'Sin alergias registradas'}
      </div>
    </div>

    <div className={styles.acciones}>
      <button type="button" className={styles.accionBtn} onClick={onNuevaConsulta} title="Nueva consulta">
        <FontAwesomeIcon icon={faCirclePlus} />
        <span>Nueva consulta</span>
      </button>
      <button type="button" className={styles.accionBtn} onClick={onCrearCita} title="Crear cita">
        <FontAwesomeIcon icon={faCalendarCheck} />
        <span>Crear cita</span>
      </button>
      <button
        type="button"
        className={styles.accionBtn}
        onClick={onConsultaControl}
        title="Consulta control"
        disabled={controlDisabled}
      >
        <FontAwesomeIcon icon={faStethoscope} />
        <span>Consulta control</span>
      </button>
    </div>
  </aside>
);

interface RegistroCardProps {
  registro: RegistroClinico;
  expandido: boolean;
  menuAbierto: boolean;
  onAbrir: (id: number) => void;
  onToggleMenu: (id: number, e: React.MouseEvent) => void;
  onEditar: (id: number) => void;
  onEliminar: (id: number) => void;
  onDescargarPdf: (id: number) => void;
}

const RegistroCard: React.FC<RegistroCardProps> = React.memo(function RegistroCard({
  registro,
  expandido,
  menuAbierto,
  onAbrir,
  onToggleMenu,
  onEditar,
  onEliminar,
  onDescargarPdf,
}) {
  return (
    <div className={styles.timelineItem}>
      <div className={styles.timelineRail}>
        <div className={`${styles.dot} ${expandido ? styles.dotActive : ''}`} />
        <div className={styles.railLine} />
      </div>

      <div className={`${styles.card} ${expandido ? styles.cardExpanded : ''}`}>
        <div className={styles.cardHead} onClick={() => onAbrir(registro.id)}>
          <div className={styles.cardHeadMain}>
            <span className={styles.cardFecha}>
              {formatearFechaRelativa(registro.fecha)}
              {registro.hora ? ` · ${registro.hora}` : ''}
            </span>
            <span className={styles.cardTitulo}>
              {registro.diagnostico || registro.motivo_consulta || 'Consulta clínica'}
            </span>
            {registro.motivo_consulta && registro.diagnostico && (
              <span className={styles.cardSub}>{registro.motivo_consulta}</span>
            )}
          </div>

          <div className={styles.cardHeadActions}>
            <button
              type="button"
              className={styles.menuBtn}
              onClick={(e) => onToggleMenu(registro.id, e)}
              aria-label="Más acciones"
            >
              <FontAwesomeIcon icon={faEllipsisVertical} />
            </button>
            {menuAbierto && (
              <div className={styles.menuDropdown} onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => onEditar(registro.id)}>
                  <FontAwesomeIcon icon={faPen} /> Editar
                </button>
                <button type="button" onClick={() => onDescargarPdf(registro.id)}>
                  <FontAwesomeIcon icon={faDownload} /> Descargar PDF
                </button>
                <button type="button" className={styles.menuDanger} onClick={() => onEliminar(registro.id)}>
                  <FontAwesomeIcon icon={faTrash} /> Eliminar
                </button>
              </div>
            )}
            <FontAwesomeIcon
              icon={faChevronDown}
              className={`${styles.chevron} ${expandido ? styles.chevronOpen : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

/* ================= COMPONENTE PRINCIPAL ================= */

const VerPaciente: React.FC<VerPacienteProps> = ({ paciente, onClose }) => {
  const [expediente, setExpediente] = useState<ExpedientePacienteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showHistoriaClinica, setShowHistoriaClinica] = useState(false);
  const [showCrearCita, setShowCrearCita] = useState(false);
  const [showControl, setShowControl] = useState(false);
  const [showCobrar, setShowCobrar] = useState(false);
  const [consultaIdParaCobro, setConsultaIdParaCobro] = useState<number | null>(null);

  const [registroIdDetalle, setRegistroIdDetalle] = useState<number | null>(null);
  // Controla la animación de salida del drawer: cuando se pide cerrar, primero
  // se dispara la animación (cerrando = true) y solo al terminar se desmonta
  // (registroIdDetalle = null), para que el drawer salga deslizando hacia la
  // derecha en vez de desaparecer de golpe.
  const [cerrandoDetalle, setCerrandoDetalle] = useState(false);
  const [menuAbiertoId, setMenuAbiertoId] = useState<number | null>(null);

  useEffect(() => {
    if (!paciente?.id) return;
    let isMounted = true;

    const cargarExpediente = async () => {
      try {
        setLoading(true);
        setError(null);
        setExpediente(null);
        const data = await getExpedientePaciente(paciente.id);
        if (isMounted) setExpediente(data);
      } catch (err: unknown) {
        if (isMounted) {
          setError(extractErrorMessage(err, 'No se pudo cargar el expediente clínico del paciente.'));
          setExpediente(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void cargarExpediente();
    return () => { isMounted = false; };
  }, [paciente?.id]);

  const registros = expediente?.registros_clinicos || [];

  // Timeline: siempre del más reciente al más antiguo, sin toggle de orden —
  // la lectura cronológica descendente es la que tiene sentido para un timeline.
  const registrosOrdenados = useMemo(
    () => [...registros].sort((a, b) => getRegistroFechaValor(b) - getRegistroFechaValor(a)),
    [registros],
  );

  const registroMasReciente = registrosOrdenados[0] ?? null;

  const abrirDetalle = useCallback((id: number) => {
    setRegistroIdDetalle(id);
    setCerrandoDetalle(false);
    setMenuAbiertoId(null);
  }, []);

  // Dispara la animación de salida (derecha) y desmonta el drawer al terminar.
  // 280ms debe coincidir con la duración de .drawerRightOut en el CSS.
  const cerrarDetalle = useCallback(() => {
    setCerrandoDetalle(true);
    window.setTimeout(() => {
      setRegistroIdDetalle(null);
      setCerrandoDetalle(false);
    }, 280);
  }, []);

  const toggleMenu = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuAbiertoId((prev) => (prev === id ? null : id));
  }, []);

  const handleEditarRegistro = useCallback((registroId: number) => {
    console.log('Editando registro ID:', registroId);
    setMenuAbiertoId(null);
  }, []);

  const handleEliminarRegistro = useCallback((registroId: number) => {
    if (window.confirm(`¿Eliminar el registro clínico #${registroId}? Esta acción no se puede deshacer.`)) {
      console.log('Eliminando registro ID:', registroId);
    }
    setMenuAbiertoId(null);
  }, []);

  const handleDescargarPdf = useCallback((registroId: number) => {
    void downloadRegistroClinicoPdf(registroId);
  }, []);

  const handleRegistroGuardado = useCallback((resultado: RegistroCompletoResponse) => {
    setExpediente((prev) => {
      if (!prev) return prev;
      return { ...prev, registros_clinicos: [resultado.registro, ...(prev.registros_clinicos || [])] };
    });
    setShowHistoriaClinica(false);
    setConsultaIdParaCobro(resultado.consulta?.id ?? null);
    requestAnimationFrame(() => setShowCobrar(true));
  }, []);

  const handleSeguimientoGuardado = useCallback((_resultado: SeguimientoControlResponse) => {
    setShowControl(false);
    // El seguimiento ya vive dentro del registro clínico correspondiente;
    // si ese registro está expandido, RegistroClinicoDetalle lo vuelve a
    // pedir la próxima vez que se abra. Aquí solo cerramos el formulario.
  }, []);

  const nombrePaciente = paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : 'Sin seleccionar';
  const alergias = Array.isArray(paciente?.alergias) ? paciente.alergias : [];

  return (
    <div className={styles.layout} onClick={() => setMenuAbiertoId(null)}>
      {/* ================= COLUMNA IZQUIERDA: FICHA + ACCIONES ================= */}
      <PacienteSidebar
        nombrePaciente={nombrePaciente}
        paciente={paciente}
        alergias={alergias}
        onNuevaConsulta={() => setShowHistoriaClinica(true)}
        onCrearCita={() => setShowCrearCita(true)}
        onConsultaControl={() => setShowControl(true)}
        controlDisabled={!registroMasReciente}
      />

      {/* ================= COLUMNA DERECHA: TIMELINE ================= */}
      <main className={styles.main}>
        <div className={styles.mainHead}>
          <h1>Historial clínico</h1>
          <div className={styles.mainHeadRight}>
            <span className={styles.contador}>
              {registrosOrdenados.length} {registrosOrdenados.length === 1 ? 'consulta' : 'consultas'}
            </span>
            {onClose && (
              <button type="button" className={styles.volverBtn} onClick={onClose} title="Cerrar expediente">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className={styles.emptyState}>
            <FontAwesomeIcon icon={faSpinner} spin />
            <p>Cargando historial...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.emptyState}>
            <FontAwesomeIcon icon={faExclamationCircle} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && registrosOrdenados.length === 0 && (
          <div className={styles.emptyState}>
            <FontAwesomeIcon icon={faFileMedicalAlt} />
            <p>No hay registros clínicos para este paciente todavía.</p>
          </div>
        )}

        {!loading && !error && registrosOrdenados.length > 0 && (
          <div className={styles.timeline}>
            {registrosOrdenados.map((registro) => (
              <RegistroCard
                key={registro.id}
                registro={registro}
                expandido={registroIdDetalle === registro.id}
                menuAbierto={menuAbiertoId === registro.id}
                onAbrir={abrirDetalle}
                onToggleMenu={toggleMenu}
                onEditar={handleEditarRegistro}
                onEliminar={handleEliminarRegistro}
                onDescargarPdf={handleDescargarPdf}
              />
            ))}
          </div>
        )}
      </main>

      {/* ================= MODALES DE CREACIÓN ================= */}
      {showHistoriaClinica && (
        <div className={styles.backdrop} onClick={() => setShowHistoriaClinica(false)}>
          <div className={styles.backdropContentWide} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeBtn} onClick={() => setShowHistoriaClinica(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <HistoriaClinica paciente={paciente} onClose={() => setShowHistoriaClinica(false)} onSave={handleRegistroGuardado} />
          </div>
        </div>
      )}

      {showCrearCita && (
        <div className={styles.backdrop} onClick={() => setShowCrearCita(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeBtn} onClick={() => setShowCrearCita(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <CrearCita paciente={paciente} onClose={() => setShowCrearCita(false)} onSuccess={() => setShowCrearCita(false)} />
          </div>
        </div>
      )}

      {showControl && registroMasReciente && (
        <div className={styles.backdrop} onClick={() => setShowControl(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeBtn} onClick={() => setShowControl(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <Control
              registroClinico={registroMasReciente}
              pacienteNombre={nombrePaciente}
              pacienteEdad={paciente?.edad != null ? String(paciente.edad) : '—'}
              pacienteCi={paciente?.documento ?? '—'}
              alergias={alergias.join(', ')}
              onClose={() => setShowControl(false)}
              onSaved={handleSeguimientoGuardado}
            />
          </div>
        </div>
      )}

      {showCobrar && consultaIdParaCobro !== null && (
        <div className={styles.backdrop} onClick={() => setShowCobrar(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.closeBtn} onClick={() => setShowCobrar(false)}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <Cobrar consultaId={consultaIdParaCobro} onCobrado={() => setShowCobrar(false)} />
          </div>
        </div>
      )}

      {/* ================= DRAWER: DETALLE DEL REGISTRO CLÍNICO ================= */}
      {/* Modal tipo drawer lateral: entra deslizando de derecha a izquierda y
          sale deslizando de vuelta hacia la derecha antes de desmontarse. */}
      {registroIdDetalle !== null && (
        <div className={styles.backdrop} onClick={cerrarDetalle}>
          <div
            className={`${styles.backdropContentWide} ${styles.drawerRight} ${cerrandoDetalle ? styles.drawerRightClosing : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" className={styles.closeBtn} onClick={cerrarDetalle}>
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <RegistroClinicoDetalle registroId={registroIdDetalle} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VerPaciente;