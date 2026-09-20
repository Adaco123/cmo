import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * Guard de rutas solo para administradores. Va dentro de <ProtectedRoute />
 * (que ya se ocupa de mandar al login a quien no tiene sesión).
 *
 * Un usuario con sesión pero sin rol de administrador vuelve al dashboard
 * normal. Esto es solo comodidad de navegación: el backend rechaza igual
 * cualquier petición de administrador que no venga de un administrador.
 */
const AdminRoute: React.FC = () => {
  const { esAdmin, loading } = useAuth();

  if (loading) return null;
  if (!esAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

export default AdminRoute;