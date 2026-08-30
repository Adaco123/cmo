import { BrowserRouter, Route, Routes } from 'react-router-dom';
import EcoVisionHome from './components/EcoVisionHome';
import DashboardPage from './pages/dashboard/Dashboardpage';
import HistoriaClinica from './features/pacientes/RegistroClinico';
import Login from './components/Login';
import { ErrorToastProvider } from './components/ErrorToastProvider';

function App() {
  return (
    <ErrorToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EcoVisionHome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<DashboardPage/>} />
          <Route path="/historia-clinica" element={<HistoriaClinica />} />
        </Routes>
      </BrowserRouter>
    </ErrorToastProvider>
  );
}

export default App;