import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// AxiosRequestConfig no trae un campo `_retry`: lo agregamos nosotros para
// marcar que una request ya pasó por el flujo de refresh y no debe
// reintentarse de nuevo si vuelve a fallar.
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const rawBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/';
const baseURL = rawBaseURL.replace(/\/+$/, '');
const isDebugApi = import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true';

if (isDebugApi) {
  console.debug('[API] baseURL', baseURL);
}

const api = axios.create({
  baseURL,
  timeout: 120000,
});

api.interceptors.request.use(
  (config) => {
    if (isDebugApi) {
      console.debug('[API] request', config.method, config.url);
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

function forzarLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  delete api.defaults.headers.common['Authorization'];
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

function resolvePendingQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  pendingQueue = [];
}

// Pide un access_token nuevo usando el refresh_token guardado. Usa una
// instancia de axios "pelada" (sin los interceptors de arriba) para no
// entrar en loop si esta misma petición devuelve 401.
async function refrescarAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('No hay refresh token disponible');
  }
  const res = await axios.post(
    `${baseURL}/api/usuarios/refresh`,
    {},
    { headers: { Authorization: `Bearer ${refreshToken}` } },
  );
  const nuevoToken = res.data.access_token;
  localStorage.setItem('token', nuevoToken);
  api.defaults.headers.common['Authorization'] = `Bearer ${nuevoToken}`;
  return nuevoToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Si la petición que falló NO llevaba token (ej. un fetch de un
    // Provider global disparado antes de terminar el login), este 401
    // no dice nada sobre la sesión actual — solo que ese pedido en
    // particular no estaba autenticado.
    const teniaToken = !!originalRequest?.headers?.get('Authorization');
    if (!teniaToken || !originalRequest) {
      return Promise.reject(error);
    }

    // El propio intento de refresh falló (refresh token vencido o
    // inválido) — ahí sí no queda otra que mandar a login.
    if (originalRequest.url?.includes('/usuarios/refresh')) {
      forzarLogout();
      return Promise.reject(error);
    }

    // Evita reintentar infinitamente la misma request.
    if (originalRequest._retry) {
      forzarLogout();
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (isRefreshing) {
      // Ya hay un refresh en curso (ej. varias requests en paralelo
      // vencieron a la vez): esperar a que termine y reintentar con
      // el token nuevo en vez de disparar varios refresh a la vez.
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;
    try {
      const nuevoToken = await refrescarAccessToken();
      resolvePendingQueue(null, nuevoToken);
      originalRequest.headers.set('Authorization', `Bearer ${nuevoToken}`);
      return api(originalRequest);
    } catch (refreshError) {
      resolvePendingQueue(refreshError, null);
      forzarLogout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;

const defaultRetryConfig = {
  retries: 2,
  backoff: 500,
};

function esErrorReintentable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const isTimeout = err.code === 'ECONNABORTED' || !!err.message?.toLowerCase().includes('timeout');
  return !err.response || err.response.status >= 500 || isTimeout;
}

export async function getWithRetry<T = unknown>(
  url: string,
  config: AxiosRequestConfig = {},
  retries = defaultRetryConfig.retries,
  backoff = defaultRetryConfig.backoff,
): Promise<AxiosResponse<T>> {
  let attempt = 0;
  while (true) {
    try {
      return await api.get<T>(url, config);
    } catch (err: unknown) {
      attempt++;
      if (attempt > retries || !esErrorReintentable(err)) {
        throw err;
      }
      const delay = backoff * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function postWithRetry<T = unknown>(
  url: string,
  data: unknown = {},
  config: AxiosRequestConfig = {},
  retries = 1,
  backoff = 300,
): Promise<AxiosResponse<T>> {
  let attempt = 0;
  while (true) {
    try {
      return await api.post<T>(url, data, config);
    } catch (err: unknown) {
      attempt++;
      if (attempt > retries || !esErrorReintentable(err)) {
        throw err;
      }
      const delay = backoff * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}