import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { type DashboardTab } from '../../components/layout/Sidebar';
import Modal from '../../components/ui/Modal';
import { authStore } from '../../auth';
import { type Paciente } from '../../api/pacientes';
import { usePacientes } from '../../features/pacientes/hooks/UsePacientes';
import { useCitasHoy } from '../../features/citas/hooks/Usecitashoy';
import PacienteForm from '../../features/pacientes/PacienteForm';
import EditarPacienteForm from '../../features/pacientes/EditarPacienteForm';
import PacienteExterno from '../../features/pacientes/PacienteExterno';
import VerPaciente from '../../features/pacientes/VerPaciente';
import PagosHoyWidget from '../../components/PagosHoyWidget';
import { useErrorToast } from '../../components/ErrorToastProvider';
import { extractErrorMessage } from '../../utils/errors';

import InicioTab from './tabs/Iniciotab';
import NuevaAtencionTab from './tabs/Nuevaatenciontab';
import MisPacientesTab from './tabs/Mispacientestab';
import PacientesExternosTab from './tabs/Pacientesexternostab';
import ModelosTab from './tabs/Modelostab';
import ReportesTab from './tabs/Reportestab';
import './Dashboardpage.css';
import '../../components/CrearCita.module.css';

// Mismo criterio que PacienteForm.tsx / usePacientes.ts.
const ORIGEN_EXTERNO = 2;

/**
 * Reemplaza CMODashboard.tsx. Solo coordina: qué tab está activo,
 * qué modal está abierto, y pasa los datos de los hooks hacia los
 * componentes de cada tab. Toda la lógica de fetch/estado vive en
 * usePacientes / useCitasHoy / useBuscarPaciente (dentro de NuevaAtencionTab).
 */
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>('inicio');
  const [showPacienteForm, setShowPacienteForm] = useState(false);
  const [origenPacienteForm, setOrigenPacienteForm] = useState<number | undefined>(undefined);
  const [pacienteAEditar, setPacienteAEditar] = useState<Paciente | null>(null);
  const [pacienteExternoSeleccionado, setPacienteExternoSeleccionado] = useState<Paciente | null>(null);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);

  const handleLogout = () => {
    authStore.logout();
    navigate('/login');
  };

  const {
    pacientes,
    loading: loadingPacientes,
    error: pacientesError,
    filters,
    handleFilterChange,
    reload: loadPacientes,
    filteredMisPacientes,
    filteredExternos,
    cambiarEstado,
  } = usePacientes();

  const {
    citasHoy,
    loading: loadingCitas,
    error: citasError,
    finalizandoId,
    reload: loadCitas,
    finalizar: finalizarCita,
  } = useCitasHoy();

  const { showError, showSuccess } = useErrorToast();

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
      >
        <PagosHoyWidget />
        <InicioTab
          active={activeTab === 'inicio'}
          pacientes={pacientes}
          citasHoy={citasHoy}
          loadingCitas={loadingCitas}
          citasError={citasError}
          finalizandoId={finalizandoId}
          onRefreshCitas={() => void loadCitas()}
          onAtender={(p) => setSelectedPaciente(p)}
          onFinalizar={(cita) => void finalizarCita(cita)}
        />

        <NuevaAtencionTab
          active={activeTab === 'nueva_atencion'}
          pacientes={pacientes}
          onIniciarAtencion={(p) => setSelectedPaciente(p)}
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
            setOrigenPacienteForm(ORIGEN_EXTERNO);
            setShowPacienteForm(true);
          }}
          onVer={(p) => setPacienteExternoSeleccionado(p)}
          onEditar={(p) => setPacienteAEditar(p)}
          onCambiarEstado={handleCambiarEstado}
        />

        <ModelosTab active={activeTab === 'modelos'} searchValue="" />

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
            onSuccess={() => {
              setShowPacienteForm(false);
              setOrigenPacienteForm(undefined);
              void loadPacientes();
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
            onSuccess={() => {
              setPacienteAEditar(null);
              void loadPacientes();
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