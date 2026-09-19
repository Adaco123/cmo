import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import DashboardPage from './pages/dashboard/Dashboardpage';
import HistoriaClinica from './features/pacientes/RegistroClinico';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
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
                  
                  <Route path="/" element={<Login />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/dashboard" element={<DashboardPage/>} />
                    <Route path="/historia-clinica" element={<HistoriaClinica />} />
                  </Route>
                  <Route path="/capturar-fotos/:token" element={<CapturarFotos />} />
                  {/* Cualquier ruta inexistente (ej. /login) vuelve al login en vez de quedar en blanco */}
                  <Route path="*" element={<Navigate to="/" replace />} />
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