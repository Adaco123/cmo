import api from './api';
import axios from 'axios';

export type Rol = 'ADMINISTRADOR' | 'MEDICO' | string;

export interface Usuario {
  id: string;
  rol_id: number;
  nombres: string;
  apellidos: string;
  username: string;
  email: string | null;
  registro_profesional?: string | null;
  activo?: boolean;
  ultimo_login?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface LoginResponse {
  access_token: string;
  rol?: string | null;
  usuario?: string | null;
  id?: number | string;
}

export interface RegisterPayload {
  nombres: string;
  apellidos: string;
  username: string;
  email?: string | null;
  password: string;
  rol_id: number;
  registro_profesional?: string | null;
}

export interface ActionResult {
  success: boolean;
  message?: string;
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return (
      (err.response?.data as any)?.detail ??
      (err.response?.data as any)?.error ??
      (err.response?.data as any)?.message ??
      err.message ??
      ''
    );
  }

  if (err instanceof Error) return err.message;
  return String(err ?? '');
}

class AuthStore {
  private readonly tokenKey = 'token';
  private readonly userKey = 'user';

  state = {
    user: null as Usuario | null,
    token: (localStorage.getItem(this.tokenKey) || null) as string | null,
  };

  get isAuthenticated() {
    return !!this.state.token;
  }

  get user() {
    return this.state.user;
  }

  private persistUser(user: Usuario | null) {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.userKey);
    }
  }

  async init(): Promise<void> {
    const storedUser = localStorage.getItem(this.userKey);
    if (storedUser) {
      try {
        this.state.user = JSON.parse(storedUser) as Usuario;
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }

    if (this.state.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${this.state.token}`;
      // try to refresh user from backend if not present
      if (!this.state.user) {
        try {
          const me = await api.get('/api/usuarios/me');
          this.setUser(me.data.user ?? null);
        } catch (err) {
          // ignore — token might be invalid
          console.debug('[Auth] init fetch /me failed', err);
          this.setToken(null);
        }
      }
    }
  }

  setToken(token: string | null) {
    this.state.token = token;
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem(this.tokenKey, token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem(this.tokenKey);
    }
  }

  setUser(user: Usuario | null) {
    this.state.user = user;
    this.persistUser(user);
  }

  async login(usernameOrEmail: string, password: string): Promise<ActionResult> {
    try {
      // backend expects 'correo' and 'contra'
      const payload: Record<string, string> = { correo: usernameOrEmail, contra: password };
      const res = await api.post<LoginResponse>('/api/usuarios/login', payload);
      if (res.status === 200 && res.data && res.data.access_token) {
        this.setToken(res.data.access_token);
        // fetch full user object from /me
        try {
          const me = await api.get('/api/usuarios/me');
          this.setUser(me.data.user ?? null);
        } catch (err) {
          console.debug('[Auth] fetch /me failed after login', err);
        }
        return { success: true };
      }

      return { success: false, message: 'Error al iniciar sesión' };
    } catch (err: unknown) {
      console.error('[Auth] login failed', err);
      return { success: false, message: getErrorMessage(err) || 'Error de conexión' };
    }
  }

  async register(payload: RegisterPayload): Promise<ActionResult> {
    try {
      // backend expects: usuario, correo, contra, rol_id
      const res = await api.post('/api/usuarios/registrar', {
        usuario: payload.username,
        correo: payload.email ?? null,
        contra: payload.password,
        rol_id: payload.rol_id,
      });

      if (res.status === 200 || res.status === 201) {
        return { success: true };
      }

      return { success: false, message: 'Error inesperado al registrar' };
    } catch (err: unknown) {
      console.error('[Auth] register failed', err);
      return { success: false, message: getErrorMessage(err) || 'Error al registrar usuario' };
    }
  }

  logout() {
    this.setUser(null);
    this.setToken(null);
  }
}

export const authStore = new AuthStore();
