import api from './api';
import axios from 'axios';

export type Rol = 'ADMINISTRADOR' | 'MEDICO' | string;

/**
 * Lo que devuelve GET /api/usuarios/me: la cuenta (usuarios) + su empleado
 * y su médico. OJO: son tres tablas con ids distintos — `id` es el de la
 * cuenta; para citas/consultas/controles se usa `medico_id`.
 */
export interface Usuario {
  id: number;
  usuario: string;
  correo: string | null;
  rol_id: number;
  estado?: boolean;
  empleado_id: number | null;
  medico_id: number | null;
  nombres: string | null;
  apellidos: string | null;
  especialidad?: string | null;
  matricula_profesional?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** "Nombres Apellidos" del usuario; si no tiene empleado, cae al nombre de cuenta. */
export function nombreCompleto(user: Usuario | null | undefined): string {
  const nombre = [user?.nombres, user?.apellidos].filter(Boolean).join(' ').trim();
  return nombre || user?.usuario || '';
}

/** Iniciales para el avatar (máx. 2 letras). */
export function iniciales(user: Usuario | null | undefined): string {
  const partes = [user?.nombres, user?.apellidos].filter(Boolean) as string[];
  const letras = partes.length > 0
    ? partes.map((p) => p.trim()[0]).join('')
    : (user?.usuario ?? '').slice(0, 2);
  return letras.slice(0, 2).toUpperCase() || '?';
}

interface LoginResponse {
  access_token: string;
  refresh_token?: string;
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

interface ApiErrorBody {
  detail?: string;
  error?: string;
  message?: string;
}

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    return (
      err.response?.data?.detail ??
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      ''
    );
  }

  if (err instanceof Error) return err.message;
  return String(err ?? '');
}

/** Minúsculas y sin tildes: "Administrador", "administrador" y "ADMINISTRADOR" cuentan igual. */
function normalizarRol(rol: string | null | undefined): string {
  return (rol ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** Lee el claim "role" del payload del JWT (el backend lo agrega al iniciar sesión). */
function leerRolDelToken(token: string | null): Rol | null {
  if (!token) return null;
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

class AuthStore {
  private readonly tokenKey = 'token';
  private readonly refreshTokenKey = 'refresh_token';
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

  /**
   * Rol de la sesión (ej. "Administrador"), leído del token. Solo sirve para
   * decidir qué pantalla mostrar: los permisos de verdad los valida el
   * backend en cada petición (@admin_required lee el rol de la base de datos,
   * no del token).
   */
  get rol(): Rol | null {
    return leerRolDelToken(this.state.token);
  }

  get esAdministrador(): boolean {
    return normalizarRol(this.rol) === 'administrador';
  }

  private persistUser(user: Usuario | null) {
    if (user) {
      localStorage.setItem(this.userKey, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.userKey);
    }
  }

  async init(): Promise<void> {
    // Sin token no hay sesión: se descarta cualquier usuario que haya quedado
    // guardado (así el guard de rutas no deja pasar a alguien "fantasma").
    if (!this.state.token) {
      this.state.user = null;
      localStorage.removeItem(this.userKey);
      return;
    }

    const storedUser = localStorage.getItem(this.userKey);
    if (storedUser) {
      try {
        this.state.user = JSON.parse(storedUser) as Usuario;
      } catch {
        localStorage.removeItem(this.userKey);
      }
    }

    api.defaults.headers.common['Authorization'] = `Bearer ${this.state.token}`;

    // Siempre se refresca el usuario desde /me: el guardado en localStorage
    // puede venir de una versión anterior (sin medico_id, nombres, etc.).
    try {
      const me = await api.get('/api/usuarios/me');
      this.setUser(me.data.user ?? null);
    } catch (err) {
      console.debug('[Auth] init fetch /me failed', err);
      // Sin red o servidor caído: se conserva el usuario guardado. Si el token
      // ya no sirve, el interceptor de api.ts se encarga de mandar al login.
      if (!this.state.user) {
        this.setToken(null);
      }
    }
  }

  setToken(token: string | null, refreshToken?: string | null) {
    this.state.token = token;
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem(this.tokenKey, token);
    } else {
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem(this.tokenKey);
    }

    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    } else if (refreshToken === null) {
      localStorage.removeItem(this.refreshTokenKey);
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
        this.setToken(res.data.access_token, res.data.refresh_token ?? null);
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
    this.setToken(null, null);
  }
}

export const authStore = new AuthStore();