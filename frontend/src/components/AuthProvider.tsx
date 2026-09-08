import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authStore, type ActionResult, type Usuario } from '../auth';

interface AuthContextValue {
  /** Usuario logueado, o null si no hay sesión (o todavía se está resolviendo). */
  user: Usuario | null;
  /** true mientras se resuelve la sesión guardada al cargar la app. */
  loading: boolean;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<ActionResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Provider global de sesión.
 *
 * `authStore` (src/auth.ts) ya maneja token/usuario y los persiste en
 * localStorage, pero es una clase de JS plana: cuando algo le llama
 * `.login()` o `.logout()`, ningún componente de React se entera —
 * `this.state.user` cambia por fuera del ciclo de renders. Por eso hoy
 * nadie podía leer "quién es el médico logueado" de forma reactiva, y
 * varias pantallas (CrearCita, RegistroClinico, Control) terminaron con
 * un `MEDICO_ID = 1` hardcodeado en vez de usar el usuario real.
 *
 * Este Provider mantiene una copia del usuario en `useState`, así que
 * cualquier componente que use `useAuth()` se re-renderiza solo cuando
 * cambia el usuario. Además llama a `authStore.init()` al montar, que
 * antes no se llamaba desde ningún lado — sin eso, al recargar la
 * página el usuario se perdía de la sesión aunque el token siguiera
 * guardado.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(authStore.user);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let activo = true;
    authStore.init().finally(() => {
      if (activo) {
        setUser(authStore.user);
        setLoading(false);
      }
    });
    return () => {
      activo = false;
    };
  }, []);

  const login = useCallback(async (usernameOrEmail: string, password: string) => {
    const result = await authStore.login(usernameOrEmail, password);
    if (result.success) {
      setUser(authStore.user);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    authStore.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Hook para leer el usuario logueado o iniciar/cerrar sesión desde cualquier componente. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}