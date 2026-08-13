import React, { useEffect, useState } from 'react';
import type { Paciente as ApiPaciente } from '../../api/pacientes';
import { downloadRegistroClinicoPdf, getExpedientePaciente, getRegistroClinicoById } from '../../api/historialClinico';
import type { RegistroClinico, RegistroCompletoResponse } from '../../api/historialClinico';
import HistoriaClinica from './RegistroClinico';
import CrearCita from '../../components/CrearCita';
import Cobrar from '../../features/pacientes/Cobrar';
import styles from './VerPaciente.module.css';
import '../../components/CrearCita.css'; // se mantiene si es necesario
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCalendarCheck,
  faCirclePlus,
  faClipboardList,
  faDownload,
  faExclamationCircle,
  faEye,
  faFileMedicalAlt,
  faFilter,
  faSearch,
  faSpinner,
  faPen,
  faTrash,
  faXmark, // <--- Icono importado para cerrar
} from "@fortawesome/free-solid-svg-icons";

interface ExpedientePacienteResponse {
  paciente?: ApiPaciente;
  historia_clinica?: {
    id: number;
    fecha_apertura?: string | null;
    estado?: boolean;
  };
  registros_clinicos?: RegistroClinico[];
}

interface VerPacienteProps {
  paciente?: ApiPaciente | null;
  onClose?: () => void;
}

const VerPaciente: React.FC<VerPacienteProps> = ({ paciente }) => {
  const [expediente, setExpediente] = useState<ExpedientePacienteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistoriaClinica, setShowHistoriaClinica] = useState(false);
  const [showCrearCita, setShowCrearCita] = useState(false);
  const [showRegistroDetalle, setShowRegistroDetalle] = useState(false);
  const [registroDetalle, setRegistroDetalle] = useState<RegistroClinico | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'recientes' | 'antiguos'>('recientes');
  const [showCobrar, setShowCobrar] = useState(false);
  const [consultaIdParaCobro, setConsultaIdParaCobro] = useState<number | null>(null);

  // Cargar expediente al montar el componente
  useEffect(() => {
    if (!paciente?.id) {
      return;
    }

    let isMounted = true;

    const cargarExpediente = async () => {
      try {
        setLoading(true);
        setError(null);
        setExpediente(null);
        const data = await getExpedientePaciente(paciente.id);
        if (isMounted) {
          setExpediente(data);
        }
      } catch (err: unknown) {
        const errorMessage =
          err && typeof err === 'object' && 'response' in err &&
          err.response && typeof err.response === 'object' && 'data' in err.response &&
          err.response.data && typeof err.response.data === 'object' && 'error' in err.response.data &&
          typeof err.response.data.error === 'string'
            ? err.response.data.error
            : 'No se pudo cargar el expediente clínico del paciente.';

        if (isMounted) {
          setError(errorMessage);
          setExpediente(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void cargarExpediente();

    return () => {
      isMounted = false;
    };
  }, [paciente?.id]);

  const registros = expediente?.registros_clinicos || [];

  // Función para calcular el valor timestamp de la fecha (para ordenar)
  const getRegistroFechaValor = (registro: RegistroClinico) => {
    if (!registro.fecha) {
      return 0;
    }

    const fechaHora = `${registro.fecha}${registro.hora ? `T${registro.hora}` : ''}`;
    const valor = Date.parse(fechaHora);

    return Number.isNaN(valor) ? 0 : valor;
  };

  const registrosOrdenados = [...registros].sort((a, b) => {
    const valorA = getRegistroFechaValor(a);
    const valorB = getRegistroFechaValor(b);

    if (sortOrder === 'recientes') {
      return valorB - valorA;
    }

    return valorA - valorB;
  });

  // Función para formatear fecha relativa (CORREGIDA con UTC para evitar errores de zona horaria)
  const formatearFechaRelativa = (fechaStr: string) => {
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
    if (diffDias < 30) {
      const semanas = Math.floor(diffDias / 7);
      return `Hace ${semanas} semanas`;
    }
    
    const diffMeses = Math.floor(diffDias / 30.44);
    if (diffMeses < 12) return `Hace ${diffMeses} meses`;

    const años = Math.floor(diffMeses / 12);
    return `Hace ${años} año${años > 1 ? 's' : ''}`;
  };

  // Abrir modal con detalle completo del registro
  const abrirRegistroDetalle = async (registroId: number) => {
    setShowRegistroDetalle(true);
    setDetalleLoading(true);
    setDetalleError(null);
    setRegistroDetalle(null);

    try {
      const data = await getRegistroClinicoById(registroId);
      setRegistroDetalle(data);
    } catch {
      setDetalleError('No se pudo cargar el registro clínico completo.');
    } finally {
      setDetalleLoading(false);
    }
  };

  // Manejar edición (abrir modal de HistoriaClinica en modo edición)
  const handleEditarRegistro = (registroId: number) => {
    console.log("Editando registro ID:", registroId);
    // Aquí deberías:
    // 1. Guardar el ID en un estado (ej. setRegistroEditarId(registroId))
    // 2. Abrir el modal de HistoriaClinica (setShowHistoriaClinica(true))
    // 3. En HistoriaClinica, pasar el ID como prop y cargar los datos del backend
  };

  // Manejar eliminación (con confirmación)
  const handleEliminarRegistro = (registroId: number) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el registro clínico #${registroId}? Esta acción no se puede deshacer.`)) {
      console.log("Eliminando registro ID:", registroId);
      // Aquí llamarías a tu API para eliminar el registro (ej. deleteRegistroClinico(registroId))
      // Luego actualizas el estado del expediente (eliminarlo de la lista)
    }
  };

  // Cuando se guarda un nuevo registro desde HistoriaClinica
  const handleRegistroGuardado = (resultado: RegistroCompletoResponse) => {
    setExpediente((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        registros_clinicos: [resultado.registro, ...(prev.registros_clinicos || [])],
      };
    });
    setShowHistoriaClinica(false);
    setConsultaIdParaCobro(resultado.consulta?.id ?? null);
    requestAnimationFrame(() => {
      setShowCobrar(true);
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <FontAwesomeIcon icon={faEye} className={styles.headerIcon} />
        <h1>Expediente clínico</h1>
        <span>
          <FontAwesomeIcon icon={faSearch} /> Paciente: {paciente ? `${paciente.nombres} ${paciente.apellidos}`.trim() : 'Sin seleccionar'}
        </span>
      </div>

      <div className={styles.clinicalRecordBox}>
        <div className={styles.recordHeader}>
          <div className={styles.titleGroup}>
            <FontAwesomeIcon icon={faClipboardList} />
            <span>Historial del paciente</span>
          </div>
          <div className={styles.actionsBar}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className={`${styles.btnAction} ${sortOrder === 'recientes' ? styles.active : ''}`}
                onClick={() => setSortOrder('recientes')}
              >
                <FontAwesomeIcon icon={faFilter} /> Más recientes
              </button>
            </div>
            <button
              className={styles.btnAction}
              onClick={() => setShowHistoriaClinica(true)}
              aria-label="Agregar registro clínico"
              title="Agregar nuevo registro"
            >
              <FontAwesomeIcon icon={faCirclePlus} /> Nueva Consulta
            </button>
            <button
              className={styles.btnAction}
              onClick={() => setShowCrearCita(true)}
              aria-label="Crear cita"
              title="Crear cita"
            >
              <FontAwesomeIcon icon={faCalendarCheck} /> Crear Cita
            </button>
            <button
              className={styles.btnAction}
              onClick={() => setShowCrearCita(true)}
              aria-label="Consulta Control"
              title="Consulta Control"
            >
              <FontAwesomeIcon icon={faSpinner} /> Consulta Control
            </button>
          </div>
        </div>

        {loading && (
          <div className={styles.emptyStateCard}>
            <FontAwesomeIcon icon={faSpinner} spin />
            <p>Cargando registros clínicos...</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.emptyStateCard}>
            <FontAwesomeIcon icon={faExclamationCircle} />
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && registros.length === 0 && (
          <div className={styles.emptyStateCard}>
            <FontAwesomeIcon icon={faFileMedicalAlt} />
            <p>No hay registros clínicos para este paciente.</p>
          </div>
        )}

        {!loading && !error && registros.length > 0 && (
          <div className={styles.recordsScrollContainer}>
            <div className={styles.recordsGrid}>
              {registrosOrdenados.map((registro) => (
                <div key={registro.id} className={styles.recordCard}>
                  <div className={styles.recordCardTitle} title={registro.fecha || ''}>
                    <FontAwesomeIcon icon={faCalendarCheck} /> {formatearFechaRelativa(registro.fecha)}
                    {registro.hora ? ` • ${registro.hora}` : ''}
                  </div>

                  <div className={styles.clinicalData}>
                    <div className={styles.dataRow}>
                      <span className={styles.label}>Motivo</span>
                      <span className={styles.value}>{registro.motivo_consulta || '—'}</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span className={styles.label}>Diagnóstico</span>
                      <span className={styles.value}>{registro.diagnostico || '—'}</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span className={styles.label}>Tratamiento</span>
                      <span className={styles.value}>{registro.tratamiento || '—'}</span>
                    </div>
                    <div className={styles.dataRow}>
                      <span className={styles.label}>Observaciones</span>
                      <span className={styles.value}>{registro.observaciones || '—'}</span>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    {/* Botón Ver (detalle) */}
                    <button
                      type="button"
                      className={`${styles.btnCard} ${styles.btnView}`}
                      onClick={() => void abrirRegistroDetalle(registro.id)}
                      aria-label="Ver historial clínico completo"
                      title="Ver historial clínico completo"
                    >
                      <FontAwesomeIcon icon={faEye} />
                    </button>

                    {/* Botón Editar */}
                    <button
                      type="button"
                      className={`${styles.btnCard} ${styles.btnEdit}`}
                      onClick={() => handleEditarRegistro(registro.id)}
                      aria-label="Editar registro clínico"
                      title="Editar registro clínico"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      className={`${styles.btnCard} ${styles.btnDelete}`}
                      onClick={() => handleEliminarRegistro(registro.id)}
                      aria-label="Eliminar registro clínico"
                      title="Eliminar registro clínico"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>

                    {/* Botón Descargar PDF */}
                    <button
                      type="button"
                      className={`${styles.btnCard} ${styles.btnDownload}`}
                      onClick={() => void downloadRegistroClinicoPdf(registro.id)}
                      aria-label="Descargar historial clínico"
                      title="Descargar historial clínico"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Registro detalle */}
      {showRegistroDetalle && (
        <div className={styles.backdrop} onClick={() => setShowRegistroDetalle(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowRegistroDetalle(false)}
              aria-label="Cerrar"
              title="Cerrar"
            >
              {/* Cambié el texto × por el icono faXmark */}
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <div className={styles.recordHeader}>
              <div className={styles.titleGroup}>
                <FontAwesomeIcon icon={faClipboardList} />
                <span>Registro clínico completo</span>
              </div>
            </div>

            {detalleLoading && (
              <div className={styles.emptyStateCard}>
                <FontAwesomeIcon icon={faSpinner} spin />
                <p>Cargando registro clínico...</p>
              </div>
            )}

            {!detalleLoading && detalleError && (
              <div className={styles.emptyStateCard}>
                <FontAwesomeIcon icon={faExclamationCircle} />
                <p>{detalleError}</p>
              </div>
            )}

            {!detalleLoading && !detalleError && registroDetalle && (
              <div className={styles.clinicalData} style={{ marginTop: '12px' }}>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Fecha</span>
                  <span className={styles.value}>{registroDetalle.fecha || '—'} {registroDetalle.hora ? `• ${registroDetalle.hora}` : ''}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Presión arterial</span>
                  <span className={styles.value}>{registroDetalle.presion_arterial || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Frecuencia cardiaca</span>
                  <span className={styles.value}>{registroDetalle.frecuencia_cardiaca || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Frecuencia respiratoria</span>
                  <span className={styles.value}>{registroDetalle.frecuencia_respiratoria || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Temperatura</span>
                  <span className={styles.value}>{registroDetalle.temperatura || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Peso</span>
                  <span className={styles.value}>{registroDetalle.peso || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Talla</span>
                  <span className={styles.value}>{registroDetalle.talla || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Motivo de consulta</span>
                  <span className={styles.value}>{registroDetalle.motivo_consulta || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Enfermedad actual</span>
                  <span className={styles.value}>{registroDetalle.enfermedad_actual || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Examen físico</span>
                  <span className={styles.value}>{registroDetalle.examen_fisico || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Diagnóstico</span>
                  <span className={styles.value}>{registroDetalle.diagnostico || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Tratamiento</span>
                  <span className={styles.value}>{registroDetalle.tratamiento || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Consulta control</span>
                  <span className={styles.value}>{registroDetalle.consulta_control || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Alergias</span>
                  <span className={styles.value}>{registroDetalle.alergias || '—'}</span>
                </div>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Observaciones</span>
                  <span className={styles.value}>{registroDetalle.observaciones || '—'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Historia clínica (RegistroClinico) */}
      {showHistoriaClinica && (
        <div className={styles.backdrop} onClick={() => setShowHistoriaClinica(false)}>
          <div className={styles.backdropContentWide} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowHistoriaClinica(false)}
              aria-label="Cerrar"
              title="Cerrar"
            >
              {/* Cambié el texto × por el icono faXmark */}
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <HistoriaClinica
              paciente={paciente}
              onClose={() => setShowHistoriaClinica(false)}
              onSave={handleRegistroGuardado}
            />
          </div>
        </div>
      )}

      {/* Modal: Crear cita */}
      {showCrearCita && (
        <div className={styles.backdrop} onClick={() => setShowCrearCita(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowCrearCita(false)}
              aria-label="Cerrar"
              title="Cerrar"
            >
              {/* Cambié el texto × por el icono faXmark */}
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <CrearCita
              paciente={paciente}
              onClose={() => setShowCrearCita(false)}
              onSuccess={() => setShowCrearCita(false)}
            />
          </div>
        </div>
      )}

      {/* Modal: Cobrar */}
      {showCobrar && consultaIdParaCobro !== null && (
        <div className={styles.backdrop} onClick={() => setShowCobrar(false)}>
          <div className={styles.backdropContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowCobrar(false)}
              aria-label="Cerrar"
              title="Cerrar"
            >
              {/* Cambié el texto × por el icono faXmark */}
              <FontAwesomeIcon icon={faXmark} />
            </button>
            <Cobrar
              consultaId={consultaIdParaCobro}
              onCobrado={() => setShowCobrar(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default VerPaciente;