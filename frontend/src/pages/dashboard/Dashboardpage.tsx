import React, { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { type DashboardTab } from '../../components/layout/Sidebar';
import Modal from '../../components/ui/Modal';
import { type Paciente } from '../../api/pacientes';
import { usePacientes } from '../../features/pacientes/hooks/UsePacientes';
import { useCitasHoy } from '../../features/citas/hooks/Usecitashoy';
import PacienteForm from '../../features/pacientes/PacienteForm';
import PacienteExterno from '../../features/pacientes/PacienteExterno';
import VerPaciente from '../../features/pacientes/VerPaciente';
import PagosHoyWidget from '../../components/PagosHoyWidget';

import InicioTab from './tabs/Iniciotab';
import NuevaAtencionTab from './tabs/Nuevaatenciontab';
import MisPacientesTab from './tabs/Mispacientestab';
import PacientesExternosTab from './tabs/Pacientesexternostab';
import ModelosTab from './tabs/Modelostab';
import ReportesTab from './tabs/Reportestab';
import './Dashboardpage.css';
import '../../components/CrearCita.module.css';
/**
 * Reemplaza CMODashboard.tsx. Solo coordina: qué tab está activo,
 * qué modal está abierto, y pasa los datos de los hooks hacia los
 * componentes de cada tab. Toda la lógica de fetch/estado vive en
 * usePacientes / useCitasHoy / useBuscarPaciente (dentro de NuevaAtencionTab).
 */
const DashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('inicio');
  const [showPacienteForm, setShowPacienteForm] = useState(false);
  const [showPacienteExterno, setShowPacienteExterno] = useState(false);
  const [pacienteExternoInicial, setPacienteExternoInicial] = useState<Paciente | null>(null);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);

  const {
    pacientes,
    loading: loadingPacientes,
    error: pacientesError,
    filters,
    handleFilterChange,
    reload: loadPacientes,
    filteredMisPacientes,
    filteredExternos,
  } = usePacientes();

  const {
    citasHoy,
    loading: loadingCitas,
    error: citasError,
    finalizandoId,
    reload: loadCitas,
    finalizar: finalizarCita,
  } = useCitasHoy();

  const cerrarPacienteExterno = () => {
    setShowPacienteExterno(false);
    setPacienteExternoInicial(null);
  };

  return (
    <>
      <DashboardLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={() => alert('Cerrando sesión…')}
      >
        <PagosHoyWidget monto={16450} cantidadPagos={12} loading={false} />
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
        />

        <PacientesExternosTab
          active={activeTab === 'pacientes_externos'}
          pacientes={filteredExternos}
          loading={loadingPacientes}
          error={pacientesError}
          searchValue={filters.externos}
          onSearchChange={(v) => handleFilterChange('externos', v)}
          onAgregar={() => {
            setPacienteExternoInicial(null);
            setShowPacienteExterno(true);
          }}
          onVer={(p) => {
            setPacienteExternoInicial(p);
            setShowPacienteExterno(true);
          }}
        />

        <ModelosTab active={activeTab === 'modelos'} searchValue="" />

        <ReportesTab active={activeTab === 'reportes'} />
      </DashboardLayout>

      {showPacienteExterno && (
        <Modal onClose={cerrarPacienteExterno}>
          <PacienteExterno
            pacientesExternos={filteredExternos}
            pacienteInicial={pacienteExternoInicial}
            onClose={cerrarPacienteExterno}
            onPacienteCreado={() => void loadPacientes()}
          />
        </Modal>
      )}

      {showPacienteForm && (
        <Modal onClose={() => setShowPacienteForm(false)}>
          <PacienteForm
            onSuccess={() => {
              setShowPacienteForm(false);
              void loadPacientes();
            }}
            onClose={() => setShowPacienteForm(false)}
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