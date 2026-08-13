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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      delete api.defaults.headers.common['Authorization'];
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
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

