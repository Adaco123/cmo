import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * Guard de rutas privadas.
 *
 * - Mientras AuthProvider resuelve la sesión guardada (`loading`), no
 *   renderiza nada: así un F5 en /dashboard no rebota al login antes
 *   de que se sepa si el usuario sigue logueado.
 * - Sin sesión, manda a '/' (donde vive el Login) con `replace`, para
 *   que el botón "atrás" no vuelva a la ruta protegida.
 * - Con sesión, deja pasar a las rutas hijas vía <Outlet />.
 */
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return <Outlet />;
};

export default ProtectedRoute;