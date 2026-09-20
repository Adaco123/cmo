import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { type DashboardTab } from '../../components/layout/Sidebar';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../components/AuthProvider';
import { useCalendario } from '../../components/CalendarioProvider';
import { type Paciente, type OrigenPaciente } from '../../api/pacientes';
import { usePacientes } from '../../components/PacientesProvider';
import PacienteForm from '../../features/pacientes/PacienteForm';
import EditarPacienteForm from '../../features/pacientes/EditarPacienteForm';
import PacienteExterno from '../../features/pacientes/PacienteExterno';
import VerPaciente from '../../features/pacientes/VerPaciente';
import PagosHoyWidget from '../../components/PagosHoyWidget';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../utils/errors';

import InicioTab, { type AgendaHoyItem } from './tabs/Iniciotab';
import NuevaAtencionTab from './tabs/Nuevaatenciontab';
import MisPacientesTab from './tabs/Mispacientestab';
import PacientesExternosTab from './tabs/Pacientesexternostab';
import SeguimientoControlTab from './tabs/SeguimientoControlTab';
import ReportesTab from './tabs/Reportestab';
import './Dashboardpage.css';
import '../../components/CrearCita.module.css';

// "Hoy" siempre en horario boliviano (America/La_Paz, GMT-4), sin importar
// la zona horaria del navegador o del servidor.
function obtenerHoyBolivia(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/La_Paz' }).format(new Date());
}

// Seguimientos que el usuario "finalizó" desde Inicio. Es solo una marca
// visual guardada en este navegador (localStorage): no se manda nada al
// backend. Se guarda junto con la fecha de hoy, así se reinicia sola cada día,
// y por usuario, para que lo que oculta una cuenta no se le oculte a otra que
// use el mismo navegador.
const seguimientosFinalizadosKey = (usuarioId: number | undefined) =>
  `cmo:seguimientos-finalizados-hoy:${usuarioId ?? 'sin-usuario'}`;

function leerSeguimientosFinalizados(usuarioId: number | undefined): number[] {
  try {
    const raw = localStorage.getItem(seguimientosFinalizadosKey(usuarioId));
    if (!raw) return [];
    const data = JSON.parse(raw) as { fecha?: string; ids?: unknown };
    if (data.fecha !== obtenerHoyBolivia() || !Array.isArray(data.ids)) return [];
    return data.ids.filter((id): id is number => typeof id === 'number');
  } catch {
    return [];
  }
}

function guardarSeguimientosFinalizados(usuarioId: number | undefined, ids: number[]): void {
  try {
    localStorage.setItem(
      seguimientosFinalizadosKey(usuarioId),
      JSON.stringify({ fecha: obtenerHoyBolivia(), ids }),
    );
  } catch {
    // Sin localStorage (modo privado, cuota llena): solo se pierde la persistencia.
  }
}

/**
 * Reemplaza CMODashboard.tsx. Solo coordina: qué tab está activo,
 * qué modal está abierto, y pasa los datos de los hooks hacia los
 * componentes de cada tab. Toda la lógica de fetch/estado vive en
 * usePacientes / useBuscarPaciente (dentro de NuevaAtencionTab) y en
 * CalendarioProvider (citas, vía useCalendario()).
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('inicio');
  const [showPacienteForm, setShowPacienteForm] = useState(false);
  const [origenPacienteForm, setOrigenPacienteForm] = useState<OrigenPaciente | undefined>(undefined);
  const [pacienteAEditar, setPacienteAEditar] = useState<Paciente | null>(null);
  const [pacienteExternoSeleccionado, setPacienteExternoSeleccionado] = useState<Paciente | null>(null);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [searchSeguimiento, setSearchSeguimiento] = useState('');

  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const {
    pacientes,
    loading: loadingPacientes,
    error: pacientesError,
    guardarPacienteLocal,
    cambiarEstado,
  } = usePacientes();

  // Los filtros de "Mis Pacientes" / "Externos" son estado de esta
  // pantalla, no dato compartido — por eso viven acá y no en
  // PacientesProvider (ver comentario en ese archivo).
  const [filters, setFilters] = useState({ misPacientes: '', externos: '' });
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };
  const matchesSearch = (p: Paciente, search: string) => {
    const q = search.toLowerCase();
    const fullName = `${p.nombres} ${p.apellidos}`.toLowerCase();
    return (
      !q ||
      fullName.includes(q) ||
      p.documento.toLowerCase().includes(q) ||
      (p.telefono || '').toLowerCase().includes(q) ||
      (p.correo || '').toLowerCase().includes(q)
    );
  };
  const filteredMisPacientes = pacientes.filter((p) => p.origen === 'propio' && matchesSearch(p, filters.misPacientes));
  const filteredExternos = pacientes.filter((p) => p.origen === 'externo' && matchesSearch(p, filters.externos));

  const { showError, showSuccess } = useErrorToast();

  const calendarioControl = useCalendario();
  const { citas, seguimientos, estadosCita, loading: loadingCitas, error: citasError, agendaCargada, refrescarAgenda, finalizarCita } = calendarioControl;

  // La agenda del CalendarioProvider antes solo se cargaba cuando alguien
  // abría el picker del calendario. Dashboardpage la necesita apenas se
  // monta (para "citas de hoy"), así que la dispara acá si todavía no se
  // cargó desde ningún otro lado.
  useEffect(() => {
    if (!agendaCargada && !loadingCitas) {
      refrescarAgenda();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [finalizandoId, setFinalizandoId] = useState<number | null>(null);
  const [seguimientosFinalizados, setSeguimientosFinalizados] = useState<number[]>(() => leerSeguimientosFinalizados(user?.id));

  // "Hoy" siempre en horario boliviano (America/La_Paz, GMT-4), sin
  // importar en qué zona horaria esté configurado el navegador o el
  // servidor donde corra la app — evita que "citas de hoy" se corra un
  // día si alguien la abre desde una máquina con otro huso horario.
  const hoyBoliviaKey = obtenerHoyBolivia();

  // "Citas de hoy" pendientes de atender: de la fecha de hoy, y sin contar
  // las que ya están Canceladas o Atendidas (buscadas por NOMBRE sobre
  // estadosCita, nunca por id — ver comentario en CalendarioProvider).
  const estadosOcultos = new Set(['cancelada', 'atendida']);
  const nombreEstadoPorId = new Map(estadosCita.map((e) => [e.id, e.nombre.trim().toLowerCase()]));
  const citasHoy = citas
    .filter((cita) => String(cita.fecha || '').slice(0, 10) === hoyBoliviaKey)
    .filter((cita) => !estadosOcultos.has(nombreEstadoPorId.get(cita.estado_id) || ''))
    .sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

  // Controles de seguimiento agendados para hoy. Un seguimiento no tiene
  // estado: cada control registrado crea una fila nueva que define la
  // próxima fecha. Por eso, de cada registro clínico solo cuenta el ÚLTIMO
  // seguimiento (el de id mayor): su proxima_fecha_control es el control
  // realmente pendiente. Cuando se atiende y se guarda el siguiente control,
  // el anterior deja de ser el último y sale solo de la lista de hoy.
  const ultimoSeguimientoPorRegistro = new Map<number, (typeof seguimientos)[number]>();
  for (const s of seguimientos) {
    const actual = ultimoSeguimientoPorRegistro.get(s.registro_clinico_id);
    if (!actual || s.id > actual.id) ultimoSeguimientoPorRegistro.set(s.registro_clinico_id, s);
  }
  const controlesHoy = [...ultimoSeguimientoPorRegistro.values()]
    .filter((s) => String(s.proxima_fecha_control || '').slice(0, 10) === hoyBoliviaKey)
    .filter((s) => !seguimientosFinalizados.includes(s.id));

  // Agenda de hoy = citas pendientes + controles de seguimiento de hoy,
  // ordenados por hora (los que no tienen hora van al final).
  const agendaHoy: AgendaHoyItem[] = [
    ...citasHoy.map((cita): AgendaHoyItem => ({
      tipo: 'cita',
      key: `cita-${cita.id}`,
      hora: cita.hora_inicio || '',
      cita,
    })),
    ...controlesHoy.map((seguimiento): AgendaHoyItem => ({
      tipo: 'seguimiento',
      key: `seguimiento-${seguimiento.id}`,
      hora: seguimiento.hora_inicio || '',
      seguimiento,
    })),
  ].sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'));

  // Abre la pantalla de atención que corresponde al ORIGEN del paciente:
  // externos → PacienteExterno (archivos / atención externa), propios →
  // VerPaciente (historia clínica). Antes "Atender" (Inicio) y "Iniciar
  // atención" (Nueva atención) abrían siempre VerPaciente.
  const abrirAtencion = (p: Paciente) => {
    if (p.origen === 'externo') setPacienteExternoSeleccionado(p);
    else setSelectedPaciente(p);
  };

  const handleFinalizarCita = async (citaId: number) => {
    setFinalizandoId(citaId);
    try {
      await finalizarCita(citaId);
    } catch (err) {
      showError(extractErrorMessage(err, 'No se pudo finalizar la cita.'));
    } finally {
      setFinalizandoId(null);
    }
  };

  // "Finalizar" de un seguimiento en Inicio: solo lo oculta de la lista de
  // hoy (marca local, ver arriba). No cambia nada en el backend.
  const handleFinalizarSeguimiento = (seguimientoId: number) => {
    if (seguimientosFinalizados.includes(seguimientoId)) return;
    const siguientes = [...seguimientosFinalizados, seguimientoId];
    setSeguimientosFinalizados(siguientes);
    guardarSeguimientosFinalizados(user?.id, siguientes);
  };

  const handleCambiarEstado = async (p: Paciente) => {
    const nombreCompleto = `${p.nombres} ${p.apellidos}`.trim();
    const activaba = !p.estado;
    try {
      await cambiarEstado(p);
      showSuccess(`${nombreCompleto} ahora está ${activaba ? 'activo' : 'inactivo'}`);
    } catch (err) {
      showError(extractErrorMessage(err, 'No se pudo cambiar el estado del paciente.'));
    }
  };

  return (
    <>
      <DashboardLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={handleLogout}
        citasHoyCount={agendaHoy.length}
      >
        <PagosHoyWidget />
        <InicioTab
          active={activeTab === 'inicio'}
          pacientes={pacientes}
          agendaHoy={agendaHoy}
          loadingCitas={loadingCitas}
          citasError={citasError}
          finalizandoId={finalizandoId}
          onRefreshCitas={() => refrescarAgenda()}
          onAtender={abrirAtencion}
          onFinalizar={(cita) => void handleFinalizarCita(cita.id)}
          onFinalizarSeguimiento={(seguimiento) => handleFinalizarSeguimiento(seguimiento.id)}
        />

        <NuevaAtencionTab
          active={activeTab === 'nueva_atencion'}
          pacientes={pacientes}
          onIniciarAtencion={abrirAtencion}
          onCrearPaciente={() => setShowPacienteForm(true)}
        />

        <MisPacientesTab
          active={activeTab === 'mis_pacientes'}
          pacientes={filteredMisPacientes}
          loading={loadingPacientes}
          error={pacientesError}
          searchValue={filters.misPacientes}
          onSearchChange={(v) => handleFilterChange('misPacientes', v)}
          onAgregar={() => setShowPacienteForm(true)}
          onVer={(p) => setSelectedPaciente(p)}
          onEditar={(p) => setPacienteAEditar(p)}
          onCambiarEstado={handleCambiarEstado}
        />

        <PacientesExternosTab
          active={activeTab === 'pacientes_externos'}
          pacientes={filteredExternos}
          loading={loadingPacientes}
          error={pacientesError}
          searchValue={filters.externos}
          onSearchChange={(v) => handleFilterChange('externos', v)}
          onAgregar={() => {
            setOrigenPacienteForm('externo');
            setShowPacienteForm(true);
          }}
          onVer={(p) => setPacienteExternoSeleccionado(p)}
          onEditar={(p) => setPacienteAEditar(p)}
          onCambiarEstado={handleCambiarEstado}
        />

        <SeguimientoControlTab
          active={activeTab === 'seguimiento_control'}
          pacientes={pacientes}
          searchValue={searchSeguimiento}
          onSearchChange={setSearchSeguimiento}
          onVer={(p) => setSelectedPaciente(p)}
        />

        <ReportesTab active={activeTab === 'reportes'} />
      </DashboardLayout>

      {pacienteExternoSeleccionado && (
        <Modal onClose={() => setPacienteExternoSeleccionado(null)}>
          <PacienteExterno
            paciente={pacienteExternoSeleccionado}
            onClose={() => setPacienteExternoSeleccionado(null)}
          />
        </Modal>
      )}

      {showPacienteForm && (
        <Modal
          onClose={() => {
            setShowPacienteForm(false);
            setOrigenPacienteForm(undefined);
          }}
        >
          <PacienteForm
            origenInicial={origenPacienteForm}
            onSuccess={(pacienteCreado) => {
              setShowPacienteForm(false);
              setOrigenPacienteForm(undefined);
              // El paciente ya viene del backend: se inserta en la lista
              // compartida sin recargarla entera (sin parpadeo de la tabla).
              guardarPacienteLocal(pacienteCreado);
            }}
            onClose={() => {
              setShowPacienteForm(false);
              setOrigenPacienteForm(undefined);
            }}
          />
        </Modal>
      )}

      {pacienteAEditar && (
        <Modal onClose={() => setPacienteAEditar(null)}>
          <EditarPacienteForm
            paciente={pacienteAEditar}
            onSuccess={(pacienteActualizado) => {
              setPacienteAEditar(null);
              guardarPacienteLocal(pacienteActualizado);
            }}
            onClose={() => setPacienteAEditar(null)}
          />
        </Modal>
      )}

      {selectedPaciente && (
        <Modal
          onClose={() => setSelectedPaciente(null)}
          contentClassName="paciente-modal-content"
        >
          <div style={{ position: 'relative' }}>
            
            <VerPaciente paciente={selectedPaciente} onClose={() => setSelectedPaciente(null)} />
          </div>
        </Modal>
      )}
    </>
  );
};

export default DashboardPage;