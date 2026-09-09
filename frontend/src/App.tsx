import { BrowserRouter, Route, Routes } from 'react-router-dom';
import EcoVisionHome from './components/EcoVisionHome';
import DashboardPage from './pages/dashboard/Dashboardpage';
import HistoriaClinica from './features/pacientes/RegistroClinico';
import Login from './components/Login';
import CapturarFotos from './features/capturar-fotos/CapturarFotos';
import { ErrorToastProvider } from './components/ErrorToastProvider';
import { CalendarioProvider } from './components/CalendarioProvider';
import { AuthProvider } from './components/AuthProvider';
import { ReportesHoyProvider } from './components/ReportesHoyProvider';
import { PacientesProvider } from './components/PacientesProvider';

function App() {
  return (
    <AuthProvider>
      <ErrorToastProvider>
        <PacientesProvider>
          <CalendarioProvider>
            <ReportesHoyProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<EcoVisionHome />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/dashboard" element={<DashboardPage/>} />
                  <Route path="/historia-clinica" element={<HistoriaClinica />} />
                  <Route path="/capturar-fotos/:token" element={<CapturarFotos />} />
                </Routes>
              </BrowserRouter>
            </ReportesHoyProvider>
          </CalendarioProvider>
        </PacientesProvider>
      </ErrorToastProvider>
    </AuthProvider>
  );
}

export default App;