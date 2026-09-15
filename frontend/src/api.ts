import axios from 'axios';

const rawBaseURL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/';
const baseURL = rawBaseURL.replace(/\/+$/, '');
const isDebugApi = import.meta.env.DEV || (import.meta as any).env?.VITE_DEBUG_API === 'true';

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
      if (!config.headers) (config as any).headers = {};
      (config as any).headers['Authorization'] = `Bearer ${token}`;
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
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // Si la petición que falló NO llevaba token (ej. un fetch de un
    // Provider global disparado antes de terminar el login), este 401
    // no dice nada sobre la sesión actual — solo que ese pedido en
    // particular no estaba autenticado.
    const teniaToken = !!(originalRequest?.headers as any)?.['Authorization'];
    if (!teniaToken) {
      return Promise.reject(error);
    }

    // El propio intento de refresh falló (refresh token vencido o
    // inválido) — ahí sí no queda otra que mandar a login.
    if (originalRequest?.url?.includes('/usuarios/refresh')) {
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
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
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
      originalRequest.headers['Authorization'] = `Bearer ${nuevoToken}`;
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

export async function getWithRetry(url: string, config: any = {}, retries = defaultRetryConfig.retries, backoff = defaultRetryConfig.backoff) {
  let attempt = 0;
  while (true) {
    try {
      const res = await api.get(url, config);
      return res;
    } catch (err: any) {
      attempt++;
      const isTimeout = err?.code === 'ECONNABORTED' || (err?.message && err.message.toLowerCase().includes('timeout'));
      const shouldRetry = attempt <= retries && (!err.response || err.response.status >= 500 || isTimeout);
      if (!shouldRetry) {
        throw err;
      }
      const delay = backoff * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function postWithRetry(url: string, data: any = {}, config: any = {}, retries = 1, backoff = 300) {
  let attempt = 0;
  while (true) {
    try {
      const res = await api.post(url, data, config);
      return res;
    } catch (err: any) {
      attempt++;
      const isTimeout = err?.code === 'ECONNABORTED' || (err?.message && err.message.toLowerCase().includes('timeout'));
      const shouldRetry = attempt <= retries && (!err.response || err.response.status >= 500 || isTimeout);
      if (!shouldRetry) throw err;
      const delay = backoff * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}